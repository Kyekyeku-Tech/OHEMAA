// Transactions.jsx — FINAL FULL VERSION (KYETECH COMPATIBLE)

import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { db, mirrorDb } from "../firebase";
import {
  LayoutDashboard,
  Users,
  Sun,
  Moon,
  LogOut,
  Upload,
} from "lucide-react";

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

const getPackageSalePrice = (tx) => {
  if (tx?.packagePrice != null) {
    return Number(tx.packagePrice || 0);
  }
  return getOriginalPriceFromPackage(tx?.packageId);
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

/* ================= STATUS BADGE ================= */
const StatusBadge = ({ status }) => {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-green-500 font-semibold">
        <span className="w-3 h-3 rounded-full border border-green-500 flex items-center justify-center text-[10px]">
          ✓
        </span>
        Done
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-blue-500 font-semibold">
        <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Processing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-yellow-500 font-semibold">
      <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
      Pending
    </span>
  );
};

/* ================= MOBILE NAV ================= */
const MobileNav = ({ icon, label, link, onClick }) => {
  const Tag = link ? "a" : "button";
  return (
    <Tag
      href={link}
      onClick={onClick}
      className="flex flex-col items-center text-xs font-medium"
    >
      {icon}
      <span>{label}</span>
    </Tag>
  );
};

/* ================= COUNTER ================= */
const Counter = ({ title, value, isDark }) => {
  const tone = title.toLowerCase().includes("pending")
    ? isDark
      ? "border-amber-500/30"
      : "border-amber-300"
    : title.toLowerCase().includes("processing")
      ? isDark
        ? "border-blue-500/30"
        : "border-blue-300"
      : title.toLowerCase().includes("completed")
        ? isDark
          ? "border-green-500/30"
          : "border-green-300"
        : isDark
          ? "border-slate-600"
          : "border-slate-200";

  return (
    <div
      className={`p-4 rounded-2xl border ${tone} text-center transition-all duration-200 ${
        isDark
          ? "bg-slate-800/90 shadow-lg shadow-black/20"
          : "bg-white shadow-sm"
      }`}
    >
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider opacity-70">{title}</p>
      <p className="mt-2 text-lg sm:text-2xl font-extrabold leading-tight">{value}</p>
    </div>
  );
};

/* ================= MAIN COMPONENT ================= */
export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tableView, setTableView] = useState("none");


  /* THEME */
  const [theme, setTheme] = useState(
    localStorage.getItem("admin-theme") || "light"
  );
  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("admin-theme", theme);
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme, isDark]);

  /* PAGINATION */
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  /* LOAD TRANSACTIONS */
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [primarySnap, mirrorSnap] = await Promise.all([
        getDocs(query(collection(db, "credentials"), orderBy("assignedAt", "desc"))),
        getDocs(collection(mirrorDb, "credentials")),
      ]);

      const mirrorBySourceId = new Map();
      const mirrorByPaystackRef = new Map();

      mirrorSnap.docs.forEach((d) => {
        const data = d.data();
        const mirrorRecord = { mirrorDocId: d.id, ...data };

        if (data.sourceDocId) {
          mirrorBySourceId.set(data.sourceDocId, mirrorRecord);
        }

        if (data.paystackRef) {
          mirrorByPaystackRef.set(data.paystackRef, mirrorRecord);
        }
      });

      const mergedTransactions = primarySnap.docs.map((d) => {
        const tx = d.data();
        const mirrorMatch =
          mirrorBySourceId.get(d.id) ||
          (tx.paystackRef ? mirrorByPaystackRef.get(tx.paystackRef) : null);

        return {
          docId: d.id,
          ...tx,
          status: mirrorMatch?.status || tx.status,
          mirrorDocId: mirrorMatch?.mirrorDocId || null,
        };
      });

      setTransactions(mergedTransactions);
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);


  const tableFilteredTx = useMemo(() => {
    if (tableView === "none") return [];
    if (tableView === "all") return transactions;
    return transactions.filter((t) => t.status === tableView);
  }, [transactions, tableView]);

  /* PAGINATED DATA */
  const totalPages = Math.ceil(tableFilteredTx.length / ITEMS_PER_PAGE);

  const paginatedTx = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return tableFilteredTx.slice(start, start + ITEMS_PER_PAGE);
  }, [tableFilteredTx, currentPage]);

  /* COUNTERS */
  const statusCounters = useMemo(() => {
    const c = { pending: 0, processing: 0, completed: 0 };
    transactions.forEach((t) => c[t.status]++);
    return c;
  }, [transactions]);

  const todayMetrics = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        if (!isToday(t.assignedAt)) return acc;

        const salePrice = getPackageSalePrice(t);
        const originalPrice = getOriginalPriceFromPackage(t.packageId);

        acc.totalOriginal += originalPrice;
        acc.totalSales += salePrice;
        acc.totalCommission += salePrice - originalPrice;
        return acc;
      },
      { totalOriginal: 0, totalSales: 0, totalCommission: 0 }
    );
  }, [transactions]);

  /* EXPORT CSV */
  const exportCSV = () => {
    const exportRows = tableView === "none" ? transactions : tableFilteredTx;

    if (!exportRows.length) {
      alert("No transactions to export");
      return;
    }

    const headers = [
      "Date",
      "Time",
      "Phone",
      "Package",
      "Amount (GHS)",
      "Status",
    ];

    const rows = exportRows.map((t) => [
      t.assignedAt?.toDate().toLocaleString() || "",
      t.assignedTo,
      t.packageId,
      Number(t.totalPaid || 0).toFixed(2),
      t.status,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ACTIONS */
  const syncMirrorStatus = async (tx, status) => {
    try {
      let mirrorSnap = await getDocs(
        query(
          collection(mirrorDb, "credentials"),
          where("sourceDocId", "==", tx.docId),
          limit(1)
        )
      );

      if (mirrorSnap.empty && tx.paystackRef) {
        mirrorSnap = await getDocs(
          query(
            collection(mirrorDb, "credentials"),
            where("paystackRef", "==", tx.paystackRef),
            limit(1)
          )
        );
      }

      if (mirrorSnap.empty) return;

      await updateDoc(mirrorSnap.docs[0].ref, { status });
    } catch (err) {
      console.error("Mirror status sync failed:", err);
    }
  };

  const updateStatus = async (tx, status) => {
    await updateDoc(doc(db, "credentials", tx.docId), { status });
    await syncMirrorStatus(tx, status);
    loadTransactions();
  };

  const deleteTransaction = async (tx) => {
    if (!window.confirm("Delete transaction?")) return;
    await deleteDoc(doc(db, "credentials", tx.docId));
    loadTransactions();
  };
  const processAllPending = async () => {
  const pending = transactions.filter((t) => t.status === "pending");

  if (!pending.length) return alert("No pending transactions");

  if (!window.confirm(`Move ${pending.length} pending to processing?`)) return;

  await Promise.all(
    pending.map(async (t) => {
      await updateDoc(doc(db, "credentials", t.docId), {
        status: "processing",
      });
      await syncMirrorStatus(t, "processing");
    })
  );

  loadTransactions();
};


  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/agent/login";
  };

  const openTableView = (view) => {
    setTableView(view);
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const bulkUpdateStatus = async (status) => {
  if (!selectedIds.length) {
    alert("No transactions selected");
    return;
  }

  if (!window.confirm(`Update ${selectedIds.length} transactions to ${status}?`)) return;

  await Promise.all(
    selectedIds.map(async (id) => {
      const tx = transactions.find((t) => t.docId === id);
      await updateDoc(doc(db, "credentials", id), { status });
      if (tx) {
        await syncMirrorStatus(tx, status);
      }
    })
  );

  setSelectedIds([]);
  loadTransactions();
};



  if (loading)
    return <p className="p-6 text-white">Loading transactions…</p>;

  const glass = isDark
    ? "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl"
    : "bg-white border border-slate-200 shadow-sm";

  const inputCls = isDark
    ? "bg-white/[0.06] border border-white/10 text-white placeholder-white/30 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none"
    : "bg-slate-50 border border-slate-200 text-gray-900 placeholder-slate-400 focus:border-sky-400 outline-none";

  return (
    <div
      className={`min-h-screen p-4 md:p-8 pb-28 ${
        isDark
          ? "bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white"
          : "bg-gradient-to-br from-slate-100 via-sky-50 to-white text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===== DESKTOP HEADER ===== */}
        <div className={`hidden md:flex justify-between items-center p-5 rounded-3xl ${glass}`}>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40 mb-1">Admin</p>
            <h1 className="text-2xl font-black tracking-tight">Transactions</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (window.location.href = "/admin/dashboard")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
              }`}
            >
              ⬅ Dashboard
            </button>
            <button
              onClick={exportCSV}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Export CSV
            </button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`p-2 rounded-xl border transition-all ${
                isDark ? "bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              {isDark ? <Sun size={17}/> : <Moon size={17}/>}
            </button>
          </div>
        </div>

        <div className={`rounded-3xl p-4 sm:p-6 ${glass}`}>
          <p className="text-sm uppercase tracking-widest opacity-70 mb-4">Enterprise Snapshot</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <Counter title="Pending" value={statusCounters.pending} isDark={isDark} />
          <Counter title="Processing" value={statusCounters.processing} isDark={isDark} />
          <Counter title="Completed" value={statusCounters.completed} isDark={isDark} />
          <Counter
            title="Original Today"
            value={formatGhs(todayMetrics.totalOriginal)}
            isDark={isDark}
          />
          <Counter
            title="Sales Today"
            value={formatGhs(todayMetrics.totalSales)}
            isDark={isDark}
          />
          <Counter
            title="Commission Today"
            value={formatGhs(todayMetrics.totalCommission)}
            isDark={isDark}
          />
          </div>
          <p className="mt-4 text-xs sm:text-sm opacity-80">
            Payout will be made tomorrow by 9:00am.
          </p>
        </div>

        <div className={`rounded-3xl p-4 sm:p-5 ${glass}`}>
          <p className="text-sm uppercase tracking-widest opacity-70 mb-4">Open Transaction Table</p>
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3">
            {[
              { key: "pending",    label: "Pending",    active: "bg-amber-500/20 border-amber-500/60 text-amber-300" },
              { key: "processing", label: "Processing",  active: "bg-blue-500/20 border-blue-500/60 text-blue-300" },
              { key: "completed",  label: "Completed",   active: "bg-emerald-500/20 border-emerald-500/60 text-emerald-300" },
              { key: "all",        label: "All",         active: "bg-sky-500/20 border-sky-500/60 text-sky-300" },
            ].map(({ key, label, active }) => (
              <button
                key={key}
                onClick={() => openTableView(key)}
                className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all duration-150 active:scale-95 ${
                  tableView === key
                    ? active
                    : isDark ? "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tableView !== "none" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "All Pending → Processing", fn: processAllPending, color: isDark ? "bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/25" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
                { label: "Selected → Processing",    fn: () => bulkUpdateStatus("processing"), color: isDark ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25" : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" },
                { label: "Selected → Completed",     fn: () => bulkUpdateStatus("completed"),  color: isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" },
              ].map(({ label, fn, color }) => (
                <button key={label} onClick={fn} className={`px-4 py-2 rounded-2xl text-xs font-semibold border transition-all active:scale-95 ${color}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className={`rounded-3xl overflow-hidden ${glass}`}>
          <table className="w-full text-sm">
           <thead className={isDark ? "bg-white/[0.04]" : "bg-slate-50"}>
  <tr>
    {/* SELECT ALL (CURRENT PAGE) */}
    <th className="p-3">
      <input
        type="checkbox"
        onChange={(e) =>
          setSelectedIds(
            e.target.checked ? paginatedTx.map((t) => t.docId) : []
          )
        }
        checked={
          paginatedTx.length > 0 &&
          paginatedTx.every((t) => selectedIds.includes(t.docId))
        }
      />
    </th>

    <th className="p-3 text-left">Amount</th>
    <th className="p-3 text-left">Phone</th>
    <th className="p-3 text-left">Status</th>
    <th className="p-3 text-left">Date</th>
    <th className="p-3 text-left">Actions</th>
  </tr>
</thead>

            <tbody>
  {paginatedTx.map((t) => (
    <tr key={t.docId} className="border-b">

      {/* ROW CHECKBOX */}
      <td className="p-3">
        <input
          type="checkbox"
          checked={selectedIds.includes(t.docId)}
          onChange={(e) => {
            setSelectedIds((prev) =>
              e.target.checked
                ? [...prev, t.docId]
                : prev.filter((id) => id !== t.docId)
            );
          }}
        />
      </td>

      <td className="p-3 font-bold">
        GHS {Number(t.totalPaid || 0).toFixed(2)}
        <div className="text-xs opacity-70">{t.packageId}</div>
      </td>

      <td className="p-3">{t.assignedTo}</td>

      <td className="p-3">
        <StatusBadge status={t.status} />
      </td>

      <td className="p-3">
        {t.assignedAt?.toDate().toLocaleDateString()}
      </td>

      <td className="p-3 flex gap-2">

                    <select
                      value={t.status}
                      onChange={(e) => updateStatus(t, e.target.value)}
                      className={`text-xs px-2 py-1.5 rounded-xl border outline-none ${inputCls}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      onClick={() => deleteTransaction(t)}
                      className={`px-2 py-1.5 text-xs rounded-xl border font-semibold transition-all ${
                        isDark ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" : "bg-red-50 border-red-200 text-red-600"
                      }`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

            <div className="flex justify-center items-center gap-3 py-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30 ${
              isDark ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]" : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            ◀ Prev
          </button>
          <span className="text-sm font-semibold opacity-60">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            disabled={totalPages === 0 || currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30 ${
              isDark ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]" : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            Next ▶
          </button>
        </div>
          </>
        ) : null}
      </div>

      {/* MOBILE NAV */}
<div
  className={`fixed bottom-0 left-0 right-0 md:hidden border-t flex justify-around py-3 ${
    isDark
      ? "bg-black/90 border-white/10"
      : "bg-white border-gray-200"
  }`}
>
  {/* Export instead of Dashboard */}
 <button
  onClick={exportCSV}
  className="flex flex-col items-center text-green-500"
>
  <Upload size={22} />
  <span className="text-xs">Export</span>
</button>
<MobileNav icon={<LayoutDashboard size={22} />} label="Dashboard" link="/admin/dashboard" />
  <MobileNav icon={<Users size={22} />} label="Users" link="/admin/users" />
  <button
    onClick={() => setTheme(isDark ? "light" : "dark")}
    className="flex flex-col items-center text-yellow-500"
  >
    {isDark ? <Sun size={22} /> : <Moon size={22} />}
    <span className="text-xs">Theme</span>
  </button>

  <button
    onClick={handleLogout}
    className="flex flex-col items-center text-red-500"
  >
    <LogOut size={22} />
    <span className="text-xs">Logout</span>
  </button>
</div>
    </div>
  );
}