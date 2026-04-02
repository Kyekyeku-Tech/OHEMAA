// waec.jsx — ULTRA MODERN SMART EXAM VERSION (CI SAFE)

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Phone, Hash, Mail } from "lucide-react";
import jsPDF from "jspdf";

/* ================= MAIN ================= */
export default function Waec() {
  const navigate = useNavigate();

  /* ===== STATE ===== */
  const [packages, setPackages] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loadingPackages, setLoadingPackages] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [indexNumber, setIndexNumber] = useState("");
  const [examYear, setExamYear] = useState("");
  const [examType, setExamType] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  /* ===== CONFIG ===== */
  const PAYSTACK_KEY =
    process.env.REACT_APP_PAYSTACK_KEY_CUSTOMER ||
    import.meta.env?.VITE_PAYSTACK_KEY_CUSTOMER ||
    import.meta.env?.VITE_PAYSTACK_KEY ||
    process.env.REACT_APP_PAYSTACK_KEY;

  const MNOTIFY_KEY =
    import.meta.env?.VITE_MNOTIFY_KEY ||
    process.env.REACT_APP_MNOTIFY_KEY ||
    "zov6giqNXoQeyMdHQeqgXkOCa";

  const senderId = "KyekyekuTec";

  /* ================= LOAD PACKAGES ================= */
  useEffect(() => {
    async function loadPackages() {
      try {
        setLoadingPackages(true);
        setError("");

        const snap = await getDocs(collection(db, "packages"));
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const pkgs = docs.length
          ? docs
          : [
              {
                id: "bronze",
                name: "Bronze",
                price: 18,
                exam: "BECE",
                description: "3× BECE Result PIN (No PDF)",
              },
              {
                id: "silver",
                name: "Silver",
                price: 20,
                exam: "BECE",
                description: "3× BECE Result PIN (With PDF)",
              },
              {
                id: "gold",
                name: "Gold",
                price: 18,
                exam: "WASSCE",
                description: "3× WASSCE Result PIN (No PDF)",
              },
              {
                id: "vip",
                name: "VIP",
                price: 20,
                exam: "WASSCE",
                description: "3× WASSCE Result PIN (With PDF)",
              },
            ];

        setPackages(pkgs);

        const avail = {};
        for (const p of pkgs) {
          const credSnap = await getDocs(
            query(
              collection(db, "credentials"),
              where("packageId", "==", p.id),
              where("used", "==", false)
            )
          );
          avail[p.id] = !credSnap.empty;
        }

        setAvailability(avail);
      } catch {
        setError("Failed to load WAEC packages");
      } finally {
        setLoadingPackages(false);
      }
    }

    loadPackages();
  }, []);

  /* ================= AUTO EXAM DETECTION ================= */
  useEffect(() => {
    if (!indexNumber) {
      setExamType(null);
      setError("");
      return;
    }

    if (!/^\d+$/.test(indexNumber)) {
      setExamType(null);
      setError("Index number must be digits only");
      return;
    }

    if (indexNumber.length === 10) {
      setExamType("BECE");
      setError("");
    } else if (indexNumber.length === 8) {
      setExamType("WASSCE");
      setError("");
    } else {
      setExamType(null);
      setError("Invalid index number length");
    }
  }, [indexNumber]);

  const filteredPackages = packages.filter(
    (p) => p.exam === examType
  );

  /* ================= SMS ================= */
  const sendSMS = async (to, msg) => {
    try {
      await fetch("https://apps.mnotify.net/smsapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: MNOTIFY_KEY,
          to,
          msg,
          sender_id: senderId,
        }),
      });
    } catch {
      // silent fail
    }
  };

  /* ================= PDF ================= */
  const generateTicketPDF = ({ username, password }) => {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text("WAEC RESULT CHECKER", 20, 20);

    pdf.setFontSize(12);
    pdf.text(`Name: ${name}`, 20, 50);
    pdf.text(`Phone: ${phone}`, 20, 60);
    pdf.text(`Index Number: ${indexNumber}`, 20, 70);
    pdf.text(`Exam Type: ${examType}`, 20, 80);
    pdf.text(`Exam Year: ${examYear}`, 20, 90);

    pdf.line(20, 105, 190, 105);

    pdf.setFontSize(14);
    pdf.text("LOGIN DETAILS", 20, 120);

    pdf.setFontSize(12);
    pdf.text(`Serial: ${username}`, 20, 135);
    pdf.text(`PIN: ${password}`, 20, 145);
    pdf.text("Visit: https://ghana.waecdirect.org", 20, 165);

    pdf.save(`WAEC_TICKET_${indexNumber}.pdf`);
  };

  /* ================= PAY ================= */
  const payPackage = (pkg) => {
    if (!name || !phone || !indexNumber || !examYear) {
      alert("Please fill all required fields");
      return;
    }

    if (!examType) {
      alert("Invalid index number");
      return;
    }

    setProcessing(true);

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: email || "no-reply@ukconnectivity.site",
      amount: Math.round(pkg.price * 102),
      currency: "GHS",
      callback: (res) => handleSuccess(res.reference, pkg),
      onClose: () => setProcessing(false),
    });

    handler.openIframe();
  };

  /* ================= SUCCESS ================= */
  const handleSuccess = async (reference, pkg) => {
    const snap = await getDocs(
      query(
        collection(db, "credentials"),
        where("packageId", "==", pkg.id),
        where("used", "==", false)
      )
    );

    if (snap.empty) {
      alert("Out of stock");
      setProcessing(false);
      return;
    }

    const cred = snap.docs[0];
    const credData = cred.data();

    await updateDoc(doc(db, "credentials", cred.id), {
      used: true,
      assignedTo: phone,
      assignedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "transactions"), {
      reference,
      name,
      phone,
      indexNumber,
      examType,
      examYear,
      packageId: pkg.id,
      ...credData,
      createdAt: serverTimestamp(),
    });

    generateTicketPDF(credData);

    await sendSMS(
      phone,
      `Hello ${name}, your ${examType} Checker is ready!

SERIAL: ${credData.username}
PIN: ${credData.password}
Ref: ${reference}

ghana.waecdirect.org`
    );

    alert("Payment successful!");
    setProcessing(false);
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <motion.div className="w-full max-w-5xl bg-white/10 rounded-3xl p-8 border border-white/20">

        {loadingPackages && (
          <p className="text-sm text-gray-400 mb-3">
            Loading packages...
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500 mb-3">
            {error}
          </p>
        )}

        <button onClick={() => navigate(-1)} className="text-sky-400 mb-6">
          ← Back
        </button>

        <h1 className="text-3xl font-extrabold text-center text-sky-400 mb-8">
          Smart Result Checker
        </h1>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Input icon={<User />} placeholder="Full Name" onChange={(e) => setName(e.target.value)} />
          <Input icon={<Mail />} placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <Input icon={<Phone />} placeholder="Phone" onChange={(e) => setPhone(e.target.value)} />
          <Input icon={<Hash />} placeholder="Index Number" value={indexNumber} onChange={(e) => setIndexNumber(e.target.value)} />

          <select
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
            className="h-12 px-4 rounded-xl bg-black/40 border border-white/20"
          >
            <option value="">Select Exam Year</option>
            {Array.from({ length: 10 }).map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y}>{y}</option>;
            })}
          </select>
        </div>

        {examType && (
          <div className="text-center font-bold py-2 rounded-xl bg-sky-600 mb-6">
            Detected Exam: {examType}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {filteredPackages.map((p) => (
            <div key={p.id} className="bg-white/10 rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="opacity-80">{p.description}</p>
              <p className="text-2xl font-bold mt-2">GHS {p.price}</p>

              <button
                disabled={!availability[p.id] || processing}
                onClick={() => payPackage(p)}
                className="mt-4 w-full py-3 rounded-full bg-sky-600 disabled:opacity-40"
              >
                {processing ? "Processing..." : availability[p.id] ? "Pay Now" : "Sold Out"}
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ================= INPUT ================= */
function Input({ icon, ...props }) {
  return (
    <div className="flex items-center gap-3 h-12 px-4 rounded-xl bg-black/40 border border-white/20">
      {icon}
      <input {...props} className="bg-transparent outline-none w-full" />
    </div>
  );
}
