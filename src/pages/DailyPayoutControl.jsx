import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { CheckCircle, Loader2, Shield } from "lucide-react";

const REQUIRED_ACCESS_ID = "204715";
const ACCESS_SESSION_KEY = "payout_access_granted";

const ORIGINAL_PRICE_LIST = {
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

const getOriginalPriceFromPackage = (packageId) => {
  const gb = Number(String(packageId ?? "").replace(/[^0-9]/g, ""));
  return ORIGINAL_PRICE_LIST[gb] ?? 0;
};

const isToday = (assignedAt) => {
  if (!assignedAt?.toDate) return false;
  const txDate = assignedAt.toDate();
  const now = new Date();
  return (
    txDate.getFullYear() === now.getFullYear() &&
    txDate.getMonth() === now.getMonth() &&
    txDate.getDate() === now.getDate()
  );
};

const formatGhs = (value) => `GHS ${Number(value || 0).toFixed(2)}`;

export default function DailyPayoutControl() {
  const [accessId, setAccessId] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payoutRows, setPayoutRows] = useState([]);
  const [credentials, setCredentials] = useState([]);

  const todayKey = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const granted = sessionStorage.getItem(ACCESS_SESSION_KEY) === "true";
    setUnlocked(granted);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payoutSnap, credentialSnap] = await Promise.all([
        getDocs(query(collection(db, "payouts"), orderBy("dateKey", "desc"))),
        getDocs(collection(db, "credentials")),
      ]);

      setPayoutRows(
        payoutSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setCredentials(credentialSnap.docs.map((d) => d.data()));
    } catch (err) {
      console.error("Failed to load payout control data:", err);
      setPayoutRows([]);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!unlocked) return;
    loadData();
  }, [unlocked]);

  const todayCommission = useMemo(() => {
    return credentials.reduce((sum, tx) => {
      if (!isToday(tx.assignedAt)) return sum;
      const paid = Number(tx.totalPaid || tx.packagePrice || 0);
      const originalPrice = getOriginalPriceFromPackage(tx.packageId);
      return sum + (paid - originalPrice);
    }, 0);
  }, [credentials]);

  const todayPayout = useMemo(
    () => payoutRows.find((row) => row.dateKey === todayKey),
    [payoutRows, todayKey]
  );

  const unlockPage = () => {
    if (accessId.trim() !== REQUIRED_ACCESS_ID) {
      setUnlockError("Invalid ID. Access denied.");
      return;
    }

    setUnlockError("");
    setUnlocked(true);
    sessionStorage.setItem(ACCESS_SESSION_KEY, "true");
  };

  const markTodayAsPaid = async () => {
    try {
      setSaving(true);
      await setDoc(
        doc(db, "payouts", todayKey),
        {
          dateKey: todayKey,
          commissionAmount: Number(todayCommission || 0),
          status: "paid",
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadData();
      alert("Today's payout has been recorded as paid.");
    } catch (err) {
      console.error("Failed to save payout:", err);
      alert("Failed to save payout.");
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    const glass = "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl";
    const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 outline-none transition-all";
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white flex items-center justify-center px-4">
        <div className={`w-full max-w-sm rounded-3xl p-6 space-y-5 ${glass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Shield size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">Restricted</p>
              <h1 className="font-extrabold text-lg">Daily Payout Access</h1>
            </div>
          </div>
          <p className="text-sm opacity-60">Enter the required ID to open payout control.</p>
          <input value={accessId} onChange={(e) => setAccessId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlockPage()}
            placeholder="Enter Access ID" className={inputCls} />
          {unlockError && <p className="text-xs text-red-400">{unlockError}</p>}
          <button onClick={unlockPage}
            className="w-full py-3 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] transition-all text-white shadow-lg shadow-emerald-900/30">
            Unlock
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white">
        <Loader2 className="animate-spin text-emerald-400" size={36} />
        <p className="text-sm opacity-50">Loading payout data…</p>
      </div>
    );
  }

  const glass = "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white px-4 md:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER CARD */}
        <div className={`rounded-3xl p-6 ${glass}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">Finance</p>
              <h1 className="text-xl font-extrabold">Daily Payout Control</h1>
            </div>
          </div>
          <p className="text-sm opacity-50 mb-5">Payout will be made tomorrow by 9:00am.</p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div>
              <p className="text-xs opacity-50 mb-0.5 uppercase tracking-wider font-semibold">Today's Commission</p>
              <p className="text-2xl font-extrabold text-emerald-400">{formatGhs(todayCommission)}</p>
            </div>
            <button onClick={markTodayAsPaid} disabled={saving}
              className="px-6 py-3 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-emerald-900/30">
              {saving ? "Saving…" : todayPayout?.status === "paid" ? "Update Today as Paid" : "Mark Paid (Today)"}
            </button>
          </div>
        </div>

        {/* PAYOUT TABLE */}
        <div className={`rounded-3xl overflow-hidden ${glass}`}>
          <div className="p-4 border-b border-white/[0.06]">
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-0.5">Records</p>
            <p className="font-bold">Daily Payout Table</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["Date","Commission","Status","Paid At"].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold opacity-50 uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payoutRows.length ? payoutRows.map((row, i) => (
                  <tr key={row.id} className={`border-t border-white/[0.05] transition-colors ${i%2===1?"bg-white/[0.02]":""} hover:bg-white/[0.05]`}>
                    <td className="px-4 py-3 font-mono text-xs">{row.dateKey || "—"}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">{formatGhs(row.commissionAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        row.status === "paid"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-300"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status==="paid"?"bg-emerald-400":"bg-amber-300 animate-pulse"}`}/>
                        {row.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs opacity-60">
                      {row.paidAt?.toDate ? row.paidAt.toDate().toLocaleString() : "—"}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-4 py-8 text-center opacity-40">No payout records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
