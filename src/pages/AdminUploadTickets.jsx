import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// Full, cleaned, and working AdminDashboard.jsx
// Preserves all your original features (CSV upload, filters, pagination, theme, mobile menu,
// credential add/reset/delete, transactions list/delete/deleteAll, stats, etc.)

export default function AdminDashboard() {
  // Data
  const [credentials, setCredentials] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [loadingTrans, setLoadingTrans] = useState(true);

  // Single credential inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [packageId, setPackageId] = useState("bronze");
  const [description, setDescription] = useState("");
  const [processing, setProcessing] = useState(false);

  // CSV upload errors
  const [csvErrors, setCsvErrors] = useState([]);

  // UI
  const [theme, setTheme] = useState("dark"); // Dark theme by default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  // --- Filters & Pagination states ---
  // Credentials filters
  const [credPackageFilter, setCredPackageFilter] = useState(""); // "" = all
  const [credUsedFilter, setCredUsedFilter] = useState("all"); // all | used | unused
  const [credSearch, setCredSearch] = useState("");

  // Credentials pagination
  const [credCurrentPage, setCredCurrentPage] = useState(1);
  const credItemsPerPage = 10;

  // Transactions filters
  const [transPackageFilter, setTransPackageFilter] = useState(""); // "" = all

  // Transactions pagination
  const [transCurrentPage, setTransCurrentPage] = useState(1);
  const transItemsPerPage = 10;

  const packages = [
  { id: "bronze", name: "Bronze" },
  { id: "silver", name: "Silver" },
  { id: "gold", name: "Gold" },
  { id: "vip", name: "VIP" },
];
const ALLOWED_PACKAGES = ["bronze", "silver", "gold", "vip"];

  // Redirect if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/admin/login");
    });
    return unsubscribe;
  }, [navigate]);

  // Fetch helpers
  const fetchCredentials = async () => {
    setLoadingCreds(true);
    try {
      const snap = await getDocs(collection(db, "credentials"));
      setCredentials(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("fetchCredentials error:", err);
    } finally {
      setLoadingCreds(false);
    }
  };

  const fetchTransactions = async () => {
    setLoadingTrans(true);
    try {
      const snap = await getDocs(collection(db, "transactions"));
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("fetchTransactions error:", err);
    } finally {
      setLoadingTrans(false);
    }
  };

  // Load on mount
  useEffect(() => {
    fetchCredentials();
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Utility: format many timestamp shapes safely
  const formatTimestamp = (t) => {
    if (!t) return "-";
    // Firestore Timestamp
    if (t.seconds) return new Date(t.seconds * 1000).toLocaleString();
    // JS Date object
    if (t.toDate) return t.toDate().toLocaleString();
    // ISO / string
    const d = new Date(t);
    if (!isNaN(d)) return d.toLocaleString();
    return "-";
  };

  // Credential & Transaction functions
  const addCredential = async () => {
    if (!username || !password || !packageId) return alert("Fill all fields.");
    setProcessing(true);
    try {
      await addDoc(collection(db, "credentials"), {
        username,
        password,
        packageId,
        description,
        used: false,
        assignedTo: null,
        createdAt: new Date(),
      });
      setUsername("");
      setPassword("");
      setDescription("");
      await fetchCredentials();
      alert("Credential added successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to add credential.");
    } finally {
      setProcessing(false);
    }
  };

  const deleteCredential = async (id) => {
    if (!window.confirm("Delete this credential?")) return;
    try {
      await deleteDoc(doc(db, "credentials", id));
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  const resetCredential = async (id) => {
    try {
      await updateDoc(doc(db, "credentials", id), {
        used: false,
        assignedTo: null,
      });
      setCredentials((prev) =>
        prev.map((c) => (c.id === id ? { ...c, used: false, assignedTo: null } : c))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to reset.");
    }
  };

  const deleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await deleteDoc(doc(db, "transactions", id));
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete transaction.");
    }
  };

  const deleteAllTransactions = async () => {
    if (!window.confirm("Delete ALL transactions? This cannot be undone!")) return;
    try {
      const snap = await getDocs(collection(db, "transactions"));
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      setTransactions([]);
      alert("All transactions deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete all transactions.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/agent/login");
  };

  // --------------------------
  // CSV file upload from device (kept)
  // --------------------------
  // Accepts same formats as earlier:
  // username,password
  // username,password,packageId
  // username,password,packageId,description
  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    setCsvErrors([]);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = String(event.target.result || "");
      // split lines robustly for different OS
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      // If first line looks like a header (contains "username" and "password"), skip it
      const first = lines[0] || "";
      const startIndex = /username/i.test(first) && /password/i.test(first) ? 1 : 0;

      const rows = [];
      const errors = [];

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        // split on comma but don't break if description has comma — we'll join extras into description
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 2) {
          errors.push(`Line ${i + 1}: missing username/password.`);
          continue;
        }
        const usernameVal = parts[0];
        const passwordVal = parts[1];
        const packageVal = parts[2] || packageId;
        // join remaining parts as description (so description can contain commas)
        const descriptionVal = parts.slice(3).join(",") || parts[3] || "";

        if (!usernameVal || !passwordVal) {
          errors.push(`Line ${i + 1}: username or password empty.`);
          continue;
        }

        rows.push({
          username: usernameVal,
          password: passwordVal,
          packageId: packageVal,
          description: descriptionVal,
        });
      }

      if (rows.length === 0) {
        setCsvErrors(errors.length ? errors : ["No valid rows found in CSV."]);
        return;
      }

      setProcessing(true);
      try {
        const promises = rows.map((r) =>
          addDoc(collection(db, "credentials"), {
            username: r.username,
            password: r.password,
            packageId: r.packageId,
            description: r.description,
            used: false,
            assignedTo: null,
            createdAt: new Date(),
          })
        );
        await Promise.all(promises);

        // refresh credentials
        await fetchCredentials();

        if (errors.length) setCsvErrors(errors);
        else setCsvErrors([]);

        alert(`Uploaded ${rows.length} credential(s) from CSV.`);
      } catch (err) {
        console.error("CSV upload error:", err);
        alert("CSV upload failed.");
      } finally {
        setProcessing(false);
      }
    };

    reader.readAsText(file);
    // clear the input value so same file can be reselected later if needed
    e.target.value = "";
  };

  // Set container class based on theme
  const isDark = theme === "dark";
  const pageBg = isDark
    ? "bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white"
    : "bg-gradient-to-br from-slate-100 via-sky-50 to-white text-gray-900";
  const glass = isDark
    ? "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl"
    : "bg-white border border-slate-200 shadow-sm";
  const inputCls = isDark
    ? "bg-white/[0.06] border border-white/10 text-white placeholder-white/30 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none"
    : "bg-slate-50 border border-slate-200 text-gray-900 placeholder-slate-400 focus:border-sky-400 outline-none";
  const containerClass = `min-h-screen p-4 md:p-8 pb-10 ${pageBg}`;
  const sectionClass = `rounded-3xl p-5 md:p-6 mb-6 ${glass}`;
  const tableClass = "w-full text-left text-sm";

  // --------------------------
  // Derived / filtered data & stats
  // --------------------------
  const totalCredentials = credentials.filter((c) =>
  ALLOWED_PACKAGES.includes(c.packageId)
).length;

const availableCredentials = credentials.filter(
  (c) => ALLOWED_PACKAGES.includes(c.packageId) && !c.used
).length;

const usedCredentials = credentials.filter(
  (c) => ALLOWED_PACKAGES.includes(c.packageId) && !!c.used
).length;


  // Credentials filtering
  const filteredCredentials = credentials
  // 🔐 ONLY show allowed packages
  .filter((c) => ALLOWED_PACKAGES.includes(c.packageId))

  // existing filters (unchanged)
  .filter((c) => (credPackageFilter ? c.packageId === credPackageFilter : true))
  .filter((c) =>
    credUsedFilter === "all"
      ? true
      : credUsedFilter === "used"
      ? !!c.used
      : !c.used
  )
  .filter((c) =>
    credSearch
      ? c.username.toLowerCase().includes(credSearch.toLowerCase())
      : true
  );

  const credTotalPages = Math.max(1, Math.ceil(filteredCredentials.length / credItemsPerPage));
  const credCurrentSlice = filteredCredentials.slice(
    (credCurrentPage - 1) * credItemsPerPage,
    credCurrentPage * credItemsPerPage
  );

  // Transactions filtering (by package)
  const filteredTransactions = transactions.filter((t) =>
    transPackageFilter ? t.packageId === transPackageFilter : true
  );

  const transTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / transItemsPerPage));
  const transCurrentSlice = filteredTransactions.slice(
    (transCurrentPage - 1) * transItemsPerPage,
    transCurrentPage * transItemsPerPage
  );

  // Ensure current pages are within bounds when data changes
  useEffect(() => {
    setCredCurrentPage((p) => Math.min(p, credTotalPages));
  }, [credTotalPages]);

  useEffect(() => {
    setTransCurrentPage((p) => Math.min(p, transTotalPages));
  }, [transTotalPages]);

  return (
    <div className={containerClass}>
      {/* Header */}
      <motion.div
        className={`flex justify-between items-center mb-6 p-5 rounded-3xl ${glass}`}
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40 mb-1">Admin</p>
          <h1 className="text-2xl font-black tracking-tight">Upload Center</h1>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate("/admin/users")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${isDark ? "bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25" : "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"}`}
          >
            Users
          </button>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition-all ${isDark ? "bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600"}`}
          >
            {isDark ? "☀" : "🌙"}
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl text-sm font-semibold border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>

        <button
          className="md:hidden text-2xl px-3 py-1 rounded-xl"
          onClick={() => setMobileMenuOpen(true)}
        >
          ☰
        </button>
      </motion.div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mobile menu"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={`absolute right-0 top-0 h-full w-72 p-6 ${isDark ? "bg-slate-950/95 border-l border-white/[0.08]" : "bg-white border-l border-slate-200"} backdrop-blur-xl`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="text-xl">×</button>
            </div>

            <button
              onClick={() => {
                navigate("/admin/dashboard");
                setMobileMenuOpen(false);
              }}
              className={`block w-full mb-3 px-4 py-3 rounded-2xl text-left font-semibold border ${isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-300" : "bg-sky-50 border-sky-200 text-sky-700"}`}
            >
              Dashboard
            </button>

            <button
              onClick={() => {
                navigate("/admin/users");
                setMobileMenuOpen(false);
              }}
              className={`block w-full mb-3 px-4 py-3 rounded-2xl text-left font-semibold border ${isDark ? "bg-violet-500/15 border-violet-500/30 text-violet-300" : "bg-violet-50 border-violet-200 text-violet-700"}`}
            >
              User Management
            </button>

            <button
              onClick={() => {
                toggleTheme();
                setMobileMenuOpen(false);
              }}
              className={`block w-full mb-3 px-4 py-3 rounded-2xl text-left font-semibold border ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-700"}`}
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>

            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="block w-full px-4 py-3 rounded-2xl text-left font-semibold border bg-red-500/15 border-red-500/30 text-red-400"
            >
              Logout
            </button>
          </motion.div>
        </div>
      )}

      {/* Mini Dashboard Stats */}
      <motion.section className={sectionClass} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-4">Overview</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",     value: totalCredentials,    color: isDark ? "bg-sky-500/10 border-sky-500/20 text-sky-400" : "bg-sky-50 border-sky-200 text-sky-600" },
            { label: "Available", value: availableCredentials,color: isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600" },
            { label: "Used",      value: usedCredentials,     color: isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`p-4 rounded-2xl border text-center ${color}`}>
              <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Add Credential Section */}
      <motion.section className={sectionClass} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-1">New Entry</p>
        <h2 className="font-bold text-lg mb-4">Add Credential</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { ph: "Username",            val: username,    set: setUsername },
            { ph: "Password",            val: password,    set: setPassword },
            { ph: "Description (opt.)",  val: description, set: setDescription },
          ].map(({ ph, val, set }) => (
            <input key={ph} placeholder={ph} value={val} onChange={(e) => set(e.target.value)}
              className={`p-3 rounded-2xl text-sm transition-all ${inputCls}`} />
          ))}
          <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className={`p-3 rounded-2xl text-sm transition-all ${inputCls}`}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={addCredential} disabled={processing}
            className="px-6 py-2.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50">
            {processing ? "Adding…" : "Add Credential"}
          </button>
          <button onClick={() => { setUsername(""); setPassword(""); setDescription(""); }}
            className={`px-6 py-2.5 rounded-2xl font-bold text-sm border active:scale-95 transition-all ${isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-slate-100 border-slate-300 hover:bg-slate-200"}`}>
            Clear
          </button>
        </div>

        {/* CSV Upload (bulk via file) */}
        <div className={`mt-5 p-4 rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.07]" : "bg-slate-50 border-slate-200"}`}>
          <p className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-1">Bulk Import</p>
          <p className="text-xs opacity-40 mb-3">CSV format: <code className="font-mono">username,password,packageId</code></p>
          <input type="file" accept=".csv,text/csv" onChange={handleCSVUpload}
            className={`text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-semibold file:cursor-pointer transition-all ${isDark ? "file:bg-sky-500/20 file:text-sky-300" : "file:bg-sky-100 file:text-sky-700"}`} />
          {csvErrors.length > 0 && (
            <div className={`mt-3 p-3 rounded-xl text-xs ${isDark ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-red-50 border border-red-200 text-red-700"}`}>
              <strong className="block mb-1">CSV problems:</strong>
              <ul className="list-disc pl-4 space-y-0.5">{csvErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
        </div>
      </motion.section>

      {/* Credentials Table with Filters & Pagination */}
      <motion.section className={sectionClass} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-0.5">Records</p>
            <h2 className="font-bold text-lg">All Credentials</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Search username…" value={credSearch}
              onChange={(e) => { setCredSearch(e.target.value); setCredCurrentPage(1); }}
              className={`p-2 rounded-xl text-xs w-40 transition-all ${inputCls}`} />
            <select value={credPackageFilter} onChange={(e) => { setCredPackageFilter(e.target.value); setCredCurrentPage(1); }}
              className={`p-2 rounded-xl text-xs transition-all ${inputCls}`}>
              <option value="">All packages</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={credUsedFilter} onChange={(e) => { setCredUsedFilter(e.target.value); setCredCurrentPage(1); }}
              className={`p-2 rounded-xl text-xs transition-all ${inputCls}`}>
              <option value="all">All</option>
              <option value="unused">Unused</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
        {loadingCreds ? (
          <p className="opacity-50 text-sm py-6 text-center">Loading credentials…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
              <table className={tableClass}>
                <thead className={isDark ? "bg-white/[0.03]" : "bg-slate-50"}>
                  <tr>
                    {["Username","Password","Package","Used","Assigned To","Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold opacity-50 uppercase tracking-wider text-left last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {credCurrentSlice.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`border-t transition-colors ${isDark ? `border-white/[0.05] ${i%2===0?"":"bg-white/[0.02]"} hover:bg-white/[0.05]` : `border-slate-100 ${i%2===0?"":"bg-slate-50/60"} hover:bg-sky-50/30`}`}>
                      <td className="px-4 py-3 font-medium">{c.username}</td>
                      <td className="px-4 py-3 font-mono text-xs opacity-70">{c.password}</td>
                      <td className="px-4 py-3 text-xs">{c.packageId}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.used ? (isDark ? "bg-red-500/15 border border-red-500/30 text-red-400" : "bg-red-50 border border-red-200 text-red-600") : (isDark ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border border-emerald-200 text-emerald-600")}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.used ? "bg-red-400" : "bg-emerald-400"}`} />
                          {c.used ? "Used" : "Free"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs opacity-60">{c.assignedTo || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => resetCredential(c.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25" : "bg-amber-50 border-amber-300 text-amber-700"}`}>Reset</button>
                          <button onClick={() => deleteCredential(c.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" : "bg-red-50 border-red-300 text-red-600"}`}>Delete</button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {credTotalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <button onClick={() => setCredCurrentPage(p => Math.max(p-1,1))} disabled={credCurrentPage===1}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold border disabled:opacity-30 transition-all ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"}`}>Prev</button>
                <span className="text-sm opacity-50">Page {credCurrentPage} of {credTotalPages}</span>
                <button onClick={() => setCredCurrentPage(p => Math.min(p+1,credTotalPages))} disabled={credCurrentPage===credTotalPages}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold border disabled:opacity-30 transition-all ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"}`}>Next</button>
              </div>
            )}
          </>
        )}
      </motion.section>

      {/* Transactions Table with package filter & pagination */}
      <motion.section className={sectionClass} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-0.5">History</p>
            <h2 className="font-bold text-lg">Transactions</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={transPackageFilter} onChange={(e) => { setTransPackageFilter(e.target.value); setTransCurrentPage(1); }}
              className={`p-2 rounded-xl text-xs transition-all ${inputCls}`}>
              <option value="">All packages</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={deleteAllTransactions}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" : "bg-red-50 border-red-300 text-red-600"}`}>
              Delete All
            </button>
          </div>
        </div>
        {loadingTrans ? (
          <p className="opacity-50 text-sm py-6 text-center">Loading transactions…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
              <table className={tableClass}>
                <thead className={isDark ? "bg-white/[0.03]" : "bg-slate-50"}>
                  <tr>
                    {["Name","Phone","Package","Amount","Username","Date","Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold opacity-50 uppercase tracking-wider text-left last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transCurrentSlice.map((t, i) => (
                    <motion.tr key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`border-t transition-colors ${isDark ? `border-white/[0.05] ${i%2===0?"":"bg-white/[0.02]"} hover:bg-white/[0.05]` : `border-slate-100 hover:bg-sky-50/30`}`}>
                      <td className="px-4 py-3">{t.name}</td>
                      <td className="px-4 py-3">{t.phone}</td>
                      <td className="px-4 py-3 text-xs">{t.packageId}</td>
                      <td className="px-4 py-3 font-bold">GHS {t.amount}</td>
                      <td className="px-4 py-3 text-xs opacity-70">{t.username}</td>
                      <td className="px-4 py-3 text-xs opacity-60">{formatTimestamp(t.assignedAt||t.createdAt||t.timestamp||t.date)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteTransaction(t.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" : "bg-red-50 border-red-300 text-red-600"}`}>
                          Delete
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transTotalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <button onClick={() => setTransCurrentPage(p => Math.max(p-1,1))} disabled={transCurrentPage===1}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold border disabled:opacity-30 transition-all ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"}`}>Prev</button>
                <span className="text-sm opacity-50">Page {transCurrentPage} of {transTotalPages}</span>
                <button onClick={() => setTransCurrentPage(p => Math.min(p+1,transTotalPages))} disabled={transCurrentPage===transTotalPages}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold border disabled:opacity-30 transition-all ${isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white border-slate-200"}`}>Next</button>
              </div>
            )}
          </>
        )}
      </motion.section>
    </div>
  );
}