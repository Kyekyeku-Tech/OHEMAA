// AdminPaymentSettings.jsx

import React, { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Save, Loader2, CheckCircle } from "lucide-react";

const formatGhs = (value) => `GHS ${Number(value || 0).toFixed(2)}`;

export default function AdminPaymentSettings() {
  /* FORM (always empty) */
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentName, setPaymentName] = useState("");
  const [personalNumber, setPersonalNumber] = useState("");

  /* CURRENT SAVED DATA */
  const [current, setCurrent] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [payoutRows, setPayoutRows] = useState([]);

  /* LOAD CURRENT SETTINGS */
  useEffect(() => {
    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, "settings", "payment"));
        if (snap.exists()) {
          setCurrent(snap.data());
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const loadPayouts = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "payouts"), orderBy("dateKey", "desc"))
      );
      setPayoutRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load payouts:", err);
      setPayoutRows([]);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  /* SAVE SETTINGS */
  const saveSettings = async () => {
    if (!paymentNumber.trim() || !paymentName.trim() || !personalNumber.trim()) {
      alert("All payment fields are required");
      return;
    }

    setSaving(true);
    setSuccess(false);

    try {
      const payload = {
        paymentNumber: paymentNumber.trim(),
        paymentName: paymentName.trim(),
        personalNumber: personalNumber.trim(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "settings", "payment"), payload, { merge: true });

      setCurrent(payload);
      setPaymentNumber("");
      setPaymentName("");
      setPersonalNumber("");
      setSuccess(true);

      alert("Details saved for payment.\nKindly note payment payout dispatch is 9:00am every day.");
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Failed to save payment details");
    }

    setSaving(false);
  };

  /* ===== DESIGN CONSTANTS ===== */
  const glass = "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl";
  const inputCls = "w-full px-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none text-sm font-medium transition-all";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-sky-400" size={36} />
          <p className="text-sm opacity-50">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* HEADER */}
        <div className={`flex items-center justify-between p-5 rounded-3xl ${glass}`}>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40 mb-1">Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Payment Settings</h1>
          </div>
          <button
            onClick={() => (window.location.href = "/admin/dashboard")}
            className="px-4 py-2 rounded-xl text-sm font-semibold border bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition-all active:scale-95"
          >
            ⬅ Dashboard
          </button>
        </div>

        {/* FORM */}
        <div className={`p-6 rounded-3xl space-y-4 ${glass}`}>
          <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-1">Update Details</p>
          <div className="space-y-3">
            <div>
              <label className="block mb-1.5 text-xs font-semibold opacity-60 uppercase tracking-wider">Payment Number</label>
              <input value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} placeholder="Enter payment number" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold opacity-60 uppercase tracking-wider">Payment Name</label>
              <input value={paymentName} onChange={(e) => setPaymentName(e.target.value)} placeholder="Enter payment name" className={inputCls} />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold opacity-60 uppercase tracking-wider">Personal Number</label>
              <input value={personalNumber} onChange={(e) => setPersonalNumber(e.target.value)} placeholder="Enter personal number" className={inputCls} />
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-3.5 mt-2 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all"
          >
            {saving ? <><Loader2 className="animate-spin" size={18} /> Saving…</> : <><Save size={18} /> Update Settings</>}
          </button>
          {success && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
              <CheckCircle size={16} /> Saved successfully
            </div>
          )}
        </div>

        {/* CURRENT SETTINGS */}
        {current && (
          <div className={`p-6 rounded-3xl ${glass}`}>
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-3">Current Active Details</p>
            <div className="space-y-1">
              {[
                { label: "Payment Number", value: current.paymentNumber },
                { label: "Payment Name",   value: current.paymentName },
                { label: "Personal Number",value: current.personalNumber },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
                  <span className="text-xs opacity-50 font-medium">{label}</span>
                  <span className="font-bold text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAILY PAYOUTS */}
        <div className={`rounded-3xl overflow-hidden ${glass}`}>
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">Finance</p>
              <p className="font-bold mt-0.5">Daily Payouts</p>
            </div>
            <button
              onClick={() => (window.location.href = "/admin/daily-payout")}
              className="px-4 py-2 rounded-xl text-xs font-semibold border bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition-all active:scale-95"
            >
              Open Payout Control
            </button>
          </div>
          <p className="px-6 py-3 text-xs opacity-50 border-b border-white/[0.04]">Payout will be made tomorrow by 9:00am.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["Date", "Commission", "Status", "Paid At"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold opacity-40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payoutRows.length ? payoutRows.map((row) => (
                  <tr key={row.id} className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs">{row.dateKey || "-"}</td>
                    <td className="px-5 py-3 font-bold">{formatGhs(row.commissionAmount)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${row.status === "paid" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-amber-500/15 border-amber-500/30 text-amber-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === "paid" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                        {row.status || "pending"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs opacity-60">{row.paidAt?.toDate ? row.paidAt.toDate().toLocaleString() : "-"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center opacity-40 text-sm">No payout records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
