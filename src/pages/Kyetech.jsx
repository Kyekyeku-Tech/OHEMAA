import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  runTransaction,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, mirrorDb } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, RefreshCcw } from "lucide-react";

/* ===== NETWORK LOGOS ===== */
import mtnLogo from "../assets/networks/mtn.png";
import airteltigoLogo from "../assets/networks/airteltigo.png";
import telecelLogo from "../assets/networks/telecel.png";

/* ================= CONFIG ================= */
const PAYSTACK_FEE_RATE = 0.02;

const ADMIN_WALLET_COST_BY_GB = {
  1: 4.4,
  2: 8.5,
  3: 12.5,
  4: 16.5,
  5: 21,
  6: 25,
  7: 29,
  8: 33,
  9: 38,
  10: 42,
  15: 59,
  20: 77,
  25: 98,
  30: 118,
  40: 158,
  50: 198,
  100: 385,
};

const ADMIN_PHONE =
  import.meta.env?.VITE_ADMIN_PHONE ||
  process.env.REACT_APP_ADMIN_PHONE ||
  "233545454000";

/* ================= NETWORK PREFIXES ================= */
const MTN_PREFIXES = ["024", "054", "055", "059", "025", "053"];
const AIRTELTIGO_PREFIXES = ["026", "027", "056", "057"];

/* ================= NEW — ADMIN COLLECTION HELPER ================= */
const getPackageCollection = (network) => {
  switch (network) {
    case "MTN":
      return "packages_MTN";
    case "AirtelTigo":
      return "packages_AirtelTigo";
    case "Telecel":
      return "packages_Telecel";
    default:
      return "packages_MTN";
  }
};

/* ================= STATUS UI ================= */
const StatusBadge = ({ status }) => {
  if (status === "pending") {
    return (
      <div className="flex items-center justify-center gap-2 text-yellow-400 font-bold">
        <Loader2 size={18} className="animate-spin" />
        Pending
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex items-center justify-center gap-2 text-blue-400 font-bold">
        <RefreshCcw size={18} className="animate-spin" />
        Processing
      </div>
    );
  }

  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220 }}
        className="flex items-center justify-center gap-2 text-green-400 font-bold"
      >
        <CheckCircle size={18} />
        Completed
      </motion.div>
    );
  }

  return <span className="text-gray-400">{status}</span>;
};

/* ================= COMPONENT ================= */
export default function Kyetech() {
  /* ADMIN DATA */
  const [packages, setPackages] = useState([]);
  const [packagesActive, setPackagesActive] = useState(true);

  /* NETWORK FILTER */
  const [selectedNetwork, setSelectedNetwork] = useState("MTN");

  /* USER STATES */
  const [phone, setPhone] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [showSheet, setShowSheet] = useState(false);

  /* NETWORK DETECTION */
  const [detectedNetwork, setDetectedNetwork] = useState("");
  const [finalNetwork, setFinalNetwork] = useState("");
  const [isPorted, setIsPorted] = useState(false);

  /* STATUS CHECK INPUT */
  const [showTopPhoneInput, setShowTopPhoneInput] = useState(false);

  /* DATE FILTER */
  const todayISO = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState(todayISO);

  const PAYSTACK_KEY =
    process.env.REACT_APP_PAYSTACK_KEY_CUSTOMER ||
    import.meta.env?.VITE_PAYSTACK_KEY_CUSTOMER ||
    import.meta.env?.VITE_PAYSTACK_KEY ||
    process.env.REACT_APP_PAYSTACK_KEY;

  const apiKey =
    import.meta.env?.VITE_MNOTIFY_KEY ||
    process.env.REACT_APP_MNOTIFY_KEY ||
    "zov6giqNXoQeyMdHQeqgXkOCa";

  const senderId = "KyekyekuTec";

  /* ================= HELPERS ================= */
  const formatGhs = (x) => `GHS ${Number(x || 0).toFixed(2)}`;
  const isValidPhone = (v) => /^0\d{9}$/.test(v);

  const normalizePhone = (p) => (p?.startsWith("0") ? "233" + p.slice(1) : p);

  const generateCustomerEmail = (customerPhone) =>
    `${customerPhone}@ohemaadigitalhub.store`;

  const calculateTotal = (price) => {
    const fee = price * PAYSTACK_FEE_RATE;
    return { totalPaid: price + fee };
  };

  const getAdminWalletDebitAmount = (pkg) => {
    const gb = Number(pkg?.id?.replace(/[^0-9]/g, ""));
    if (Number.isFinite(gb) && ADMIN_WALLET_COST_BY_GB[gb] != null) {
      return Number(ADMIN_WALLET_COST_BY_GB[gb]);
    }
    // Fallback for unexpected package IDs not in the table.
    return Number(pkg?.price || 0);
  };

  const deductAdminWallet = async ({ amount, paystackRef, phone: buyerPhone, packageId }) => {
    const walletRef = doc(db, "settings", "adminWallet");
    const numericAmount = Number(amount || 0);

    const walletAfter = await runTransaction(db, async (transaction) => {
      const walletSnap = await transaction.get(walletRef);
      const currentBalance = walletSnap.exists()
        ? Number(walletSnap.data().balance || 0)
        : 0;
      const nextBalance = currentBalance - numericAmount;

      transaction.set(
        walletRef,
        {
          balance: nextBalance,
          updatedAt: serverTimestamp(),
          lastDebitAt: serverTimestamp(),
          lastDebitRef: paystackRef,
        },
        { merge: true }
      );

      return nextBalance;
    });

    await addDoc(collection(db, "admin_wallet_ledger"), {
      type: "debit",
      amount: numericAmount,
      reference: paystackRef,
      balanceAfter: walletAfter,
      customerPhone: buyerPhone,
      packageId,
      createdAt: serverTimestamp(),
    });

    return walletAfter;
  };

  /* ===== PACKAGE AVAILABILITY ===== */
  const getAvailability = (pkg) => {
    if (!packagesActive) return { text: "Unavailable", color: "bg-red-600" };
    if (pkg.outOfStock) return { text: "Out of Stock", color: "bg-red-600" };
    return { text: "Available", color: "bg-green-600" };
  };

  /* ================= GLOBAL SWITCH ================= */
  useEffect(() => {
    async function loadSwitch() {
      const snap = await getDoc(doc(db, "settings", "packages"));
      setPackagesActive(snap.exists() ? snap.data().packagesActive : true);
    }
    loadSwitch();
  }, []);

  /* ================= LOAD PACKAGES ================= */
  useEffect(() => {
    async function loadPackages() {
      const colName = getPackageCollection(selectedNetwork);
      const snap = await getDocs(collection(db, colName));
      setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadPackages();
  }, [selectedNetwork]);

  /* ================= NETWORK AUTO-DETECT ================= */
  useEffect(() => {
    if (!isValidPhone(phone)) {
      setDetectedNetwork("");
      setFinalNetwork("");
      setIsPorted(false);
      return;
    }

    const prefix = phone.substring(0, 3);
    let detected = "";

    if (MTN_PREFIXES.includes(prefix)) detected = "MTN";
    if (AIRTELTIGO_PREFIXES.includes(prefix)) detected = "AirtelTigo";
    if (!detected) detected = "Telecel";

    setDetectedNetwork(detected);
    setFinalNetwork(isPorted ? selectedNetwork : detected);
  }, [phone, isPorted, selectedNetwork]);

  /* ================= FILTERED PACKAGES ================= */
  const filteredPackages = useMemo(() => {
    return packages
      .filter((p) => p.network === selectedNetwork)
      .map((p) => ({
        ...p,
        gb: Number(p.id.replace(/[^0-9]/g, "")),
      }))
      .filter((p) => p.gb >= 1 && p.gb <= 50)
      .sort((a, b) => a.gb - b.gb);
  }, [packages, selectedNetwork]);
  /* ===== FILTER TRANSACTIONS BY DATE ===== */
  const filteredTransactions = useMemo(() => {
    if (!transactions.length) return [];
    return transactions.filter((t) => {
      if (!t.assignedAt) return false;
      const d = t.assignedAt.toDate().toISOString().split("T")[0];
      return d === filterDate;
    });
  }, [transactions, filterDate]);

  /* ================= PAYMENT ================= */
  const startPayment = () => {
    if (!selectedPkg || !isValidPhone(phone)) return alert("Invalid details");
    if (!PAYSTACK_KEY) return alert("Paystack key missing");

    setProcessing(true);
    setShowSheet(false);

    const { totalPaid } = calculateTotal(selectedPkg.price);

    window.PaystackPop.setup({
      key: PAYSTACK_KEY,
      email: generateCustomerEmail(phone),
      amount: Math.round(totalPaid * 100),
      currency: "GHS",

      metadata: {
        custom_fields: [
          {
            display_name: "Phone Number",
            variable_name: "phone",
            value: phone,
          },
          {
            display_name: "Network",
            variable_name: "network",
            value: finalNetwork,
          },
          {
            display_name: "Package",
            variable_name: "package",
            value: selectedPkg.id,
          },
          {
            display_name: "Ported Number",
            variable_name: "ported",
            value: isPorted ? "YES" : "NO",
          },
        ],
      },

      callback: (res) => handleSuccess(res.reference),
      onClose: () => setProcessing(false),
    }).openIframe();
  };

  const handleSuccess = async (ref) => {
    const { totalPaid } = calculateTotal(selectedPkg.price);
    const walletDebitAmount = getAdminWalletDebitAmount(selectedPkg);
    let adminWalletBalanceAfter = null;

    try {
      adminWalletBalanceAfter = await deductAdminWallet({
        amount: walletDebitAmount,
        paystackRef: ref,
        phone,
        packageId: selectedPkg.id,
      });
    } catch (walletErr) {
      console.error("⚠️ Admin wallet deduction failed:", walletErr);
    }

    console.log("💰 Payment successful! Ref:", ref);
    console.log("📋 Creating order with details:", {
      phone,
      network: finalNetwork,
      detectedNetwork,
      isPorted,
      packageId: selectedPkg.id,
      packagePrice: selectedPkg.price,
      totalPaid,
    });
    const transactionPayload = {
      assignedTo: phone,
      network: finalNetwork,
      detectedNetwork,
      isPorted,
      status: "pending",
      packageId: selectedPkg.id,
      packagePrice: selectedPkg.price,
      totalPaid,
      walletDebitAmount,
      adminWalletBalanceAfter,
      walletDeducted: adminWalletBalanceAfter !== null,
      assignedAt: serverTimestamp(),
      paystackRef: ref,
    };

    // manual backend trigger (primary database)
    const docRef = await addDoc(collection(db, "credentials"), transactionPayload);

    // mirror transaction to secondary Firebase project
    try {
      await addDoc(collection(mirrorDb, "credentials"), {
        ...transactionPayload,
        sourceDocId: docRef.id,
      });
    } catch (mirrorErr) {
      console.error("⚠️ Mirror write failed:", mirrorErr);
    }

    console.log("✅ Order created successfully! DocId:", docRef.id);
    console.log(
      "📡 processPendingOrders() listener will automatically detect and process this order"
    );

    // Send SMS notifications
    await sendSMS(
      phone,
      `Your Order on ${phone} received and processing.\nDelivery in 5–10 minutes.\nThank you for choosing ohemaadigitahub.store`
    );
    console.log("📱 Customer SMS sent");

    await sendSMS(
      ADMIN_PHONE,
      `New Order Received\namount: ${formatGhs(
        selectedPkg.price
      )}\nPhone: ${phone}\n\nThank You!.`
    );
    console.log("📱 Admin SMS sent");

    alert("Payment successful! Your order is processing...");
    setProcessing(false);
    // automatic order creation
    //       try {
    //  const docRef= await addDoc(collection(db, "credentials"), {
    //     assignedTo: phone,
    //     network: finalNetwork,
    //     detectedNetwork,
    //     isPorted,
    //     status: "pending",
    //     packageId: selectedPkg.id,
    //     totalPaid: selectedPkg.price,
    //     assignedAt: serverTimestamp(),
    //     paystackRef: ref,
    //   });
    //    console.log("✅ Order created successfully! DocId:", docRef);
    //    console.log("📡 This will trigger processPendingOrders() on the backend");

    //   //  SEND SMS
    //   await sendSMS(
    //   phone,
    //   `
    // Your Order on ${phone} received and processing.
    // Delivery in 5–10 minutes.
    // Thank you for choosing ukonnectivity.site
    // `
    // );
    // console.log("📱 Customer SMS sent");

    // await sendSMS(
    //   ADMIN_PHONE,
    //   `New Order Received
    // amount: ${formatGhs(selectedPkg.price)}
    // Phone: ${phone}

    // Thank You!.`
    // );
    // console.log("📱 Admin SMS sent");

    //   setProcessing(false);
    //   alert("Payment successful!");
    // } catch (err) {
    //   console.error("❌ Error creating order:", err);
    //   alert("Error processing your order. Contact support.");
    //   setProcessing(false);
    // }
  };

  /* ================= STATUS CHECK ================= */
  const checkStatus = async () => {
    console.warn("⚠️ Invalid phone number:", phone);
    if (!isValidPhone(phone)) return alert("Invalid phone number");
    console.log("🔍 Checking status for phone:", phone);
    setLoadingStatus(true);
    setTransactions([]);
    try {
      const [primarySnap, mirrorSnap] = await Promise.all([
        getDocs(query(collection(db, "credentials"), where("assignedTo", "==", phone))),
        getDocs(query(collection(mirrorDb, "credentials"), where("assignedTo", "==", phone))),
      ]);

      console.log(
        `📊 Found ${primarySnap.size} primary and ${mirrorSnap.size} mirror transactions for phone: ${phone}`
      );

      if (primarySnap.empty && mirrorSnap.empty) {
        console.warn("⚠️ No transactions found");
        alert("No transactions found");
        setLoadingStatus(false);
        return;
      }

      const mirrorBySourceId = new Map();
      const mirrorByPaystackRef = new Map();

      mirrorSnap.docs.forEach((d) => {
        const data = d.data();
        const mirrorRecord = { mirrorId: d.id, ...data };

        if (data.sourceDocId) {
          mirrorBySourceId.set(data.sourceDocId, mirrorRecord);
        }

        if (data.paystackRef) {
          mirrorByPaystackRef.set(data.paystackRef, mirrorRecord);
        }
      });

      let txns = primarySnap.docs.map((d) => {
        const primaryData = d.data();
        const mirrorMatch =
          mirrorBySourceId.get(d.id) ||
          (primaryData.paystackRef ? mirrorByPaystackRef.get(primaryData.paystackRef) : null);
        const mergedAssignedAt = mirrorMatch?.assignedAt || primaryData.assignedAt;

        return {
          id: d.id,
          ...primaryData,
          status: mirrorMatch?.status || primaryData.status,
          assignedAt: mergedAssignedAt,
          date: mergedAssignedAt?.toDate?.()?.toLocaleString(),
        };
      });

      if (primarySnap.empty && !mirrorSnap.empty) {
        txns = mirrorSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.sourceDocId || d.id,
            ...data,
            assignedAt: data.assignedAt,
            date: data.assignedAt?.toDate?.()?.toLocaleString(),
          };
        });
      }

      txns.sort((a, b) => {
        const aSec = a.assignedAt?.seconds || 0;
        const bSec = b.assignedAt?.seconds || 0;
        return bSec - aSec;
      });

      console.log("📋 Transactions:", txns);
      setTransactions(txns);

      setLoadingStatus(false);
    } catch (err) {
      console.error("❌ Error checking status:", err);
      alert("Error checking status. Try again later.");
      setLoadingStatus(false);
    }
  };

  /* ================= SMS ================= */
  async function sendSMS(to, msg) {
    try {
      const p = normalizePhone(to);
      if (!p) {
        console.warn("⚠️ Invalid phone for SMS:", to);
        return;
      }
      console.log(`📤 Sending SMS to ${p}`);
      const res = await fetch(
        `https://api.mnotify.com/api/sms/quick?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: [p],
            sender: senderId,
            message: msg.trim(),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("SMS FAILED:", data);
      } else {
        console.log("SMS SENT:", data);
      }
    } catch (err) {
      console.error("SMS ERROR:", err);
    }
  }


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f172a_0%,#020617_45%,#020617_100%)] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="rounded-3xl border border-sky-400/20 bg-slate-900/70 backdrop-blur-md p-5 md:p-7 shadow-2xl shadow-sky-900/20">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sky-300/70">
                Data Purchase Portal
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-white mt-1">
                Ohemaa Digital Hub
              </h1>
              <p className="text-sm md:text-base text-slate-300 mt-2 max-w-2xl">
                Buy bundles instantly, monitor delivery status, and track network health in one place.
              </p>
            </div>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-yellow-400/20 via-sky-500/10 to-amber-400/20 border border-yellow-300/35"
        >
          <h3 className="text-base md:text-lg font-extrabold text-yellow-300 flex items-center gap-2">
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              !
            </motion.span>
            Important Notice
          </h3>
          <p className="text-sm text-slate-100 mt-2 max-w-3xl leading-relaxed">
            These packages do not support EVD SIM, Turbonet SIM, and Router SIM. Delivery can take between 2 and 30 minutes.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-4 md:p-6 space-y-5">
            <div className="flex flex-col md:flex-row gap-3">
              {showTopPhoneInput && (
                <input
                  className="p-3.5 rounded-xl w-full bg-slate-100 text-black font-semibold"
                  placeholder="Enter number (0XXXXXXXXX)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                />
              )}

              <button
                onClick={() =>
                  !showTopPhoneInput ? setShowTopPhoneInput(true) : checkStatus()
                }
                disabled={loadingStatus}
                className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex items-center justify-center gap-2 min-w-[180px] transition"
              >
                {loadingStatus ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <CheckCircle size={18} />
                )}
                {loadingStatus
                  ? "Checking..."
                  : showTopPhoneInput
                  ? "Check"
                  : "Check Order Status"}
              </button>
            </div>

            {transactions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setFilterDate(todayISO)}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 transition font-bold text-sm"
                >
                  Today
                </button>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-4 py-2 rounded-lg text-black font-semibold"
                />
              </div>
            )}

            {filteredTransactions.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-white/15 bg-slate-950/40">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="p-3 border-b border-white/10 text-left">Date</th>
                      <th className="p-3 border-b border-white/10 text-left">Network</th>
                      <th className="p-3 border-b border-white/10 text-left">Package</th>
                      <th className="p-3 border-b border-white/10 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="odd:bg-white/[0.02]">
                        <td className="p-3 border-b border-white/5">{t.date}</td>
                        <td className="p-3 border-b border-white/5">{t.network}</td>
                        <td className="p-3 border-b border-white/5">{t.packageId}</td>
                        <td className="p-3 border-b border-white/5">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="xl:col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-4 md:p-6 space-y-5">
            <div className="pt-2">
              <h3 className="text-sm uppercase tracking-widest text-slate-300 font-bold mb-3">
                Select Network
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "MTN", logo: mtnLogo },
                  { name: "AirtelTigo", logo: airteltigoLogo },
                  { name: "Telecel", logo: telecelLogo },
                ].map((net) => (
                  <button
                    key={net.name}
                    onClick={() => setSelectedNetwork(net.name)}
                    className={`p-3 rounded-2xl border-2 transition-all duration-200 bg-white ${
                      selectedNetwork === net.name
                        ? "border-sky-500 scale-[1.03] shadow-lg shadow-sky-500/20"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img src={net.logo} alt={net.name} className="h-9 mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <h2 className="text-xl md:text-2xl font-black">Choose Data Package</h2>
            <p className="text-sm text-slate-300">
              Network: <span className="font-bold text-sky-300">{selectedNetwork}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {filteredPackages.map((pkg) => {
              const availability = getAvailability(pkg);
              const unavailable = pkg.outOfStock || !packagesActive;

              return (
                <motion.button
                  key={pkg.id}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!unavailable) {
                      setSelectedPkg(pkg);
                      setShowSheet(true);
                    }
                  }}
                  className={`text-left p-4 md:p-5 rounded-2xl border transition-all duration-200 ${
                    selectedPkg?.id === pkg.id
                      ? "border-sky-400 bg-sky-500/15"
                      : "border-white/10 bg-slate-900/70"
                  } ${
                    unavailable
                      ? "opacity-45 cursor-not-allowed"
                      : "hover:border-sky-400/60 hover:bg-slate-800 cursor-pointer"
                  }`}
                >
                  <h3 className="font-extrabold text-sm md:text-base leading-tight">{pkg.id}</h3>
                  <p className="text-[11px] md:text-xs text-slate-300 mt-1 line-clamp-2">{pkg.description}</p>
                  <p className="text-lg md:text-2xl text-sky-300 mt-3 font-black">
                    {formatGhs(pkg.price)}
                  </p>

                  <span
                    className={`inline-block mt-3 px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-full text-white ${availability.color}`}
                  >
                    {availability.text}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showSheet && selectedPkg && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSheet(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/15 p-5 md:p-6 rounded-t-3xl max-w-2xl mx-auto"
            >
              <h3 className="font-extrabold text-lg mb-1">Confirm Purchase</h3>
              <p className="text-slate-300 text-sm">{selectedPkg.id}</p>

              <p className="text-sky-300 text-2xl font-black mt-2">
                {formatGhs(selectedPkg.price)}
              </p>

              {detectedNetwork && detectedNetwork !== selectedNetwork && (
                <label className="flex items-center gap-3 mt-4 bg-yellow-500/20 p-3 rounded-xl text-sm font-semibold border border-yellow-300/30">
                  <input
                    type="checkbox"
                    checked={isPorted}
                    onChange={(e) => setIsPorted(e.target.checked)}
                  />
                  This {detectedNetwork} number is ported to
                  <span className="text-sky-300"> {selectedNetwork}</span>
                </label>
              )}

              <input
                className="w-full p-4 mt-4 rounded-xl text-black font-semibold"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
              />

              <button
                onClick={startPayment}
                disabled={processing}
                className="w-full mt-4 bg-sky-600 hover:bg-sky-500 transition py-3.5 rounded-xl font-extrabold"
              >
                {processing ? "Processing..." : "Confirm and Pay"}
              </button>

              <button
                onClick={() => setShowSheet(false)}
                className="w-full mt-3 border border-white/20 py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}