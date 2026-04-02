import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  LayoutDashboard,
  Users,
  CreditCard,
  Sun,
  Moon,
  Tag,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase"; 


/* ===== NETWORK LOGOS ===== */
import mtnLogo from "../assets/networks/mtn.png";
import airteltigoLogo from "../assets/networks/airteltigo.png";
import telecelLogo from "../assets/networks/telecel.png";

/* ================= HELPERS ================= */
const formatGhs = (x) => `GHS ${Number(x || 0).toFixed(2)}`;

const NETWORKS = [
  { name: "MTN", logo: mtnLogo },
  { name: "AirtelTigo", logo: airteltigoLogo },
  { name: "Telecel", logo: telecelLogo },
];

const DESCRIPTIONS = ["Non-Expiring", "Expiring"];

const PAYSTACK_INLINE_SRC = "https://js.paystack.co/v1/inline.js";
let paystackLoaderPromise = null;

function loadPaystackInline() {
  if (window.PaystackPop) return Promise.resolve();
  if (paystackLoaderPromise) return paystackLoaderPromise;

  paystackLoaderPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.PaystackPop) {
        resolve();
      } else {
        reject(new Error("Paystack script loaded, but PaystackPop is unavailable (possibly blocked by browser extension or network policy)."));
      }
    };

    const fail = () => reject(new Error("Failed to load Paystack inline script."));

    const existing = document.querySelector(`script[src="${PAYSTACK_INLINE_SRC}"]`);
    if (existing) {
      if (window.PaystackPop) {
        resolve();
        return;
      }

      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      window.setTimeout(finish, 3000);
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_INLINE_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = fail;
    document.body.appendChild(script);
  }).catch((err) => {
    paystackLoaderPromise = null;
    throw err;
  });

  return paystackLoaderPromise;
}

/* 🔥 NEW — NETWORK COLLECTION HELPER (NO LOGIC REMOVED) */
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

/* ================= COMPONENT ================= */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const topupTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (topupTimeoutRef.current) {
        clearTimeout(topupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadPaystackInline().catch((err) => {
      console.error("Paystack preload failed:", err);
    });
  }, []);

  const PAYSTACK_KEY =
    process.env.REACT_APP_PAYSTACK_KEY ||
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_PAYSTACK_KEY : undefined);

  /* THEME */
  const [theme, setTheme] = useState(
    localStorage.getItem("admin-theme") || "dark"
  );
  const isDark = theme === "dark";

  /* GLOBAL SWITCH */
  const [packagesActive, setPackagesActive] = useState(true);
  const [switchLoading, setSwitchLoading] = useState(false);

  /* ADMIN WALLET */
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletTopupProcessing, setWalletTopupProcessing] = useState(false);


  /* NETWORK FILTER */
  const [activeNetwork, setActiveNetwork] = useState("MTN");

  /* PACKAGES */
  const [packages, setPackages] = useState([]);

  /* FORM */
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    id: "",
    price: "",
    description: "Non-Expiring",
    network: "MTN",
    outOfStock: false,
  });

  /* ================= LOAD DATA ================= */
  useEffect(() => {
  async function load() {
    const ref = doc(db, "settings", "packages");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      setPackagesActive(snap.data().packagesActive);
    } else {
      await setDoc(ref, { packagesActive: true });
      setPackagesActive(true);
    }

    await loadWalletBalance();
  }

  load();
}, []);

  async function loadWalletBalance() {
    try {
      setWalletLoading(true);
      const walletRef = doc(db, "settings", "adminWallet");
      const walletSnap = await getDoc(walletRef);

      if (!walletSnap.exists()) {
        await setDoc(walletRef, {
          balance: 0,
          updatedAt: serverTimestamp(),
        });
        setWalletBalance(0);
        return;
      }

      setWalletBalance(Number(walletSnap.data().balance || 0));
    } catch (err) {
      console.error("Failed to load admin wallet:", err);
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleWalletTopup() {
    if (walletTopupProcessing) return;

    const amount = Number(walletAmount);

    if (!amount || amount <= 0) {
      alert("Enter a valid top-up amount");
      return;
    }

    const resolvedKey = String(PAYSTACK_KEY || "").trim();

    if (!resolvedKey) {
      alert("Missing Paystack key. Set REACT_APP_PAYSTACK_KEY in your environment.");
      return;
    }

    if (!resolvedKey.startsWith("pk_")) {
      alert("Invalid Paystack key. Use your PUBLIC key (starts with pk_).\nDo not use secret key.");
      return;
    }

    try {
      setWalletTopupProcessing(true);

      await loadPaystackInline();

      if (!window.PaystackPop) {
        throw new Error("Paystack script loaded but PaystackPop is unavailable");
      }

      // Failsafe: reset button state if Paystack modal never resolves.
      topupTimeoutRef.current = window.setTimeout(() => {
        setWalletTopupProcessing(false);
      }, 120000);

      const processTopupSuccess = async (res) => {
        try {
          if (!res?.reference) {
            throw new Error("Missing payment reference from Paystack callback");
          }

          const walletRef = doc(db, "settings", "adminWallet");
          const result = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(walletRef);
            const currentBalance = snap.exists()
              ? Number(snap.data().balance || 0)
              : 0;
            const newBalance = currentBalance + amount;

            transaction.set(
              walletRef,
              {
                balance: newBalance,
                updatedAt: serverTimestamp(),
                lastTopUpAt: serverTimestamp(),
                lastTopUpRef: res.reference,
              },
              { merge: true }
            );

            return newBalance;
          });

          await addDoc(collection(db, "admin_wallet_ledger"), {
            type: "topup",
            amount,
            reference: res.reference,
            balanceAfter: result,
            createdAt: serverTimestamp(),
          });

          setWalletBalance(result);
          setWalletAmount("");
          alert("Wallet loaded successfully");
        } catch (err) {
          console.error("Wallet top-up failed:", err);
          alert("Payment received but wallet update failed. Check logs.");
        } finally {
          if (topupTimeoutRef.current) {
            clearTimeout(topupTimeoutRef.current);
            topupTimeoutRef.current = null;
          }
          setWalletTopupProcessing(false);
        }
      };

      const paystackOptions = {
        key: resolvedKey,
        email: `admin-wallet-${Date.now()}@ohemaa.app`,
        amount: Math.round(amount * 100),
        currency: "GHS",
        metadata: {
          custom_fields: [
            {
              display_name: "Purpose",
              variable_name: "purpose",
              value: "admin_wallet_topup",
            },
          ],
        },
        callback: function (res) {
          processTopupSuccess(res);
        },
        onClose: function () {
          if (topupTimeoutRef.current) {
            clearTimeout(topupTimeoutRef.current);
            topupTimeoutRef.current = null;
          }
          setWalletTopupProcessing(false);
        },
      };

      const handler = window.PaystackPop.setup(paystackOptions);
      if (!handler || typeof handler.openIframe !== "function") {
        throw new Error("Paystack handler did not initialize correctly");
      }

      handler.openIframe();
    } catch (err) {
      console.error("Failed to initialize Paystack:", err);
      if (topupTimeoutRef.current) {
        clearTimeout(topupTimeoutRef.current);
        topupTimeoutRef.current = null;
      }
      setWalletTopupProcessing(false);
      const msg = err?.message || "Unknown Paystack initialization error";
      alert(`Could not start payment: ${msg}`);
    }
  }

  useEffect(() => {
  async function load() {
    const colName = getPackageCollection(activeNetwork);
    const snap = await getDocs(collection(db, colName));
    setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    setEditingId(null);
    setForm({
      id: "",
      price: "",
      description: "Non-Expiring",
      network: activeNetwork,
      outOfStock: false,
    });
  }

  load();
}, [activeNetwork]);

  async function toggleGlobalPackages() {
    try {
      setSwitchLoading(true);
      await updateDoc(doc(db, "settings", "packages"), {
        packagesActive: !packagesActive,
      });
      setPackagesActive(!packagesActive);
    } finally {
      setSwitchLoading(false);
    }
  }

  /* ================= PACKAGES ================= */
  async function loadPackages() {
    const colName = getPackageCollection(activeNetwork);
    const snap = await getDocs(collection(db, colName));
    setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const filteredPackages = packages
  .filter((p) => p.network === activeNetwork)
  .map((p) => {
    // extract number from ID e.g. MTN_10GB → 10
    const match = p.id.match(/\d+/);
    return {
      ...p,
      gb: match ? Number(match[0]) : 0,
    };
  })
  .sort((a, b) => a.gb - b.gb);


  function startEdit(pkg) {
    setEditingId(pkg.id);
    setForm({
      id: pkg.id,
      price: pkg.price,
      description: pkg.description || "Non-Expiring",
      network: pkg.network,
      outOfStock: pkg.outOfStock || false,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      id: "",
      price: "",
      description: "Non-Expiring",
      network: activeNetwork,
      outOfStock: false,
    });
  }

 async function savePackage() {
  if (!form.id || !form.price) {
    alert("Package ID and price required");
    return;
  }

  const colName = getPackageCollection(form.network);

  const packageDocId = editingId
    ? editingId
    : `${form.network}_${form.id}`;

  await setDoc(doc(db, colName, packageDocId), {
    price: Number(form.price),
    description: form.description,
    network: form.network,
    outOfStock: form.outOfStock,
    updatedAt: serverTimestamp(),
  });

  resetForm();
  loadPackages();
}


  async function deletePackage(id) {
    if (!window.confirm("Delete this package?")) return;
    const colName = getPackageCollection(activeNetwork);
    await deleteDoc(doc(db, colName, id));
    loadPackages();
  }

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
      await signOut(auth);
      navigate("/agent/login");
    };

  /* ================= THEME CLASSES ================= */
  const pageBg = isDark
    ? "bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white"
    : "bg-gradient-to-br from-slate-100 via-sky-50 to-white text-gray-900";

  const glass = isDark
    ? "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl"
    : "bg-white border border-slate-200 shadow-sm";

  const inputCls = isDark
    ? "bg-white/[0.06] border border-white/10 text-white placeholder-white/30 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 outline-none"
    : "bg-slate-50 border border-slate-200 text-gray-900 placeholder-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 outline-none";

  /* ================= UI ================= */
  return (
    <div className={`min-h-screen p-4 md:p-8 pb-28 ${pageBg}`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ───────── HEADER ───────── */}
        <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 md:p-6 rounded-3xl ${glass}`}>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-40 mb-1">Control Panel</p>
            <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Admin Dashboard
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {[
              { label: "Daily Payout", path: "/admin/daily-payout", color: "violet" },
              { label: "Users",        path: "/admin/users",         color: "sky" },
              { label: "Transactions", path: "/admin/transactions",  color: "sky" },
              { label: "Payments",     path: "/admin/payment-settings", color: "sky" },
              { label: "Price List",   path: "/admin/price-list",    color: "emerald" },
            ].map(({ label, path, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95 ${
                  isDark
                    ? color === "violet"
                      ? "bg-violet-600/20 border-violet-500/30 text-violet-300 hover:bg-violet-600/40"
                      : color === "emerald"
                        ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/40"
                        : "bg-sky-600/20 border-sky-500/30 text-sky-300 hover:bg-sky-600/40"
                    : color === "violet"
                      ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                      : color === "emerald"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => { const n = isDark ? "light" : "dark"; setTheme(n); localStorage.setItem("admin-theme", n); }}
              className={`p-2 rounded-xl border transition-all duration-150 ${isDark ? "bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"}`}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 active:scale-95
                bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/25"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        {/* ───────── GLOBAL SWITCH ───────── */}
        <div className={`p-5 rounded-3xl ${glass}`}>
          <div className="flex justify-between items-center gap-4">
            <div>
              <p className="font-bold text-base">Package Availability</p>
              <p className={`text-xs mt-0.5 ${isDark ? "opacity-50" : "text-slate-500"}`}>
                Toggles all packages on the customer storefront
              </p>
            </div>
            <button
              onClick={toggleGlobalPackages}
              disabled={switchLoading}
              className={`relative inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl font-bold text-sm border transition-all duration-200 active:scale-95 disabled:opacity-60 ${
                packagesActive
                  ? isDark
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10"
                    : "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : isDark
                    ? "bg-red-500/20 border-red-500/40 text-red-300"
                    : "bg-red-50 border-red-300 text-red-600"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${packagesActive ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {switchLoading ? "Updating…" : packagesActive ? "Live — Active" : "Offline"}
            </button>
          </div>
        </div>

        {/* ───────── ADMIN WALLET ───────── */}
        <div className={`p-5 md:p-6 rounded-3xl ${glass}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-40 mb-1">
                Admin Wallet
              </p>
              <h2 className="text-lg md:text-xl font-black">Wallet Balance</h2>
              <p className={`text-2xl mt-2 font-extrabold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                {walletLoading ? "Loading..." : formatGhs(walletBalance)}
              </p>
              <p className={`text-xs mt-1 ${isDark ? "opacity-50" : "text-slate-500"}`}>
                Every customer purchase deducts from this balance.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <input
                type="number"
                min="1"
                placeholder="Top-up amount (GHS)"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className={`p-3 rounded-2xl text-sm transition-all w-full md:w-56 ${inputCls}`}
              />
              <button
                onClick={handleWalletTopup}
                disabled={walletTopupProcessing}
                className={`px-5 py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-95 ${
                  walletTopupProcessing
                    ? "bg-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500"
                }`}
              >
                {walletTopupProcessing ? "Processing..." : "Load Wallet"}
              </button>
            </div>
          </div>
        </div>

        {/* ───────── NETWORK SELECTOR ───────── */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {NETWORKS.map((net) => {
            const active = activeNetwork === net.name;
            return (
              <button
                key={net.name}
                onClick={() => setActiveNetwork(net.name)}
                className={`group p-4 md:p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all duration-200 active:scale-95 ${
                  active
                    ? isDark
                      ? "bg-sky-500/15 border-sky-400/50 shadow-xl shadow-sky-500/10"
                      : "bg-sky-50 border-sky-400 shadow-md shadow-sky-100"
                    : isDark
                      ? "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07]"
                      : "bg-white border-slate-200 hover:border-sky-200 hover:bg-sky-50/50"
                }`}
              >
                <img src={net.logo} alt={net.name} className={`h-9 md:h-11 transition-all duration-200 ${active ? "scale-110" : "opacity-70 group-hover:opacity-100"}`} />
                <span className={`text-xs md:text-sm font-bold tracking-wide ${active ? isDark ? "text-sky-300" : "text-sky-600" : "opacity-60"}`}>
                  {net.name}
                </span>
                {active && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-sky-400" : "bg-sky-500"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* ───────── FORM ───────── */}
        <div className={`p-5 md:p-7 rounded-3xl ${glass}`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-1">
                {editingId ? "Editing" : "New Package"}
              </p>
              <h2 className="text-lg font-bold">
                {editingId ? `Edit — ${editingId}` : `Add ${activeNetwork} Package`}
              </h2>
            </div>
            {editingId && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-300 text-amber-700"}`}>
                Editing Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              placeholder="Package ID (e.g. 10GB)"
              value={form.id}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              className={`p-3 rounded-2xl text-sm transition-all ${inputCls} disabled:opacity-40`}
            />
            <input
              type="number"
              placeholder="Price (GHS)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={`p-3 rounded-2xl text-sm transition-all ${inputCls}`}
            />
            <select
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`p-3 rounded-2xl text-sm transition-all ${inputCls}`}
            >
              {DESCRIPTIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <label className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all select-none text-sm font-medium ${
              form.outOfStock
                ? isDark ? "bg-red-500/15 border-red-500/30 text-red-300" : "bg-red-50 border-red-300 text-red-700"
                : isDark ? "bg-white/[0.04] border-white/10" : "bg-slate-50 border-slate-200 text-slate-600"
            }`}>
              <input
                type="checkbox"
                checked={form.outOfStock}
                onChange={(e) => setForm({ ...form, outOfStock: e.target.checked })}
                className="accent-red-500 w-4 h-4"
              />
              Out of Stock
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={savePackage}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 active:scale-95 transition-all duration-150"
            >
              {editingId ? "Update Package" : "Add Package"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className={`px-6 py-2.5 rounded-2xl font-bold text-sm border active:scale-95 transition-all duration-150 ${
                  isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-slate-100 border-slate-300 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* ───────── PACKAGES TABLE ───────── */}
        <div className={`rounded-3xl overflow-hidden ${glass}`}>
          <div className={`px-6 py-4 border-b ${isDark ? "border-white/[0.07]" : "border-slate-100"}`}>
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">
              {activeNetwork} Packages
            </p>
            <p className="font-bold mt-0.5">{filteredPackages.length} bundles listed</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? "bg-white/[0.03]" : "bg-slate-50"}>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider opacity-50 uppercase">Package</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider opacity-50 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider opacity-50 uppercase">Price</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wider opacity-50 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold tracking-wider opacity-50 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center opacity-40 text-sm">
                      No packages for {activeNetwork} yet
                    </td>
                  </tr>
                ) : filteredPackages.map((pkg, i) => (
                  <tr
                    key={pkg.id}
                    className={`border-t transition-colors ${
                      isDark
                        ? `border-white/[0.05] ${i % 2 === 0 ? "" : "bg-white/[0.02]"} hover:bg-white/[0.06]`
                        : `border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/60"} hover:bg-sky-50/40`
                    }`}
                  >
                    <td className="px-5 py-3.5 font-bold">{pkg.id}</td>
                    <td className={`px-5 py-3.5 text-xs font-medium opacity-70`}>{pkg.description}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${isDark ? "text-sky-400" : "text-sky-600"}`}>
                        {formatGhs(pkg.price)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {pkg.outOfStock ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isDark ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Out of Stock
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => startEdit(pkg)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25" : "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePackage(pkg.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${isDark ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" : "bg-red-50 border-red-300 text-red-600 hover:bg-red-100"}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ───────── MOBILE NAV ───────── */}
      <div className={`fixed bottom-0 left-0 right-0 md:hidden border-t z-50 ${
        isDark ? "bg-slate-950/95 border-white/[0.08] backdrop-blur-xl" : "bg-white/95 border-slate-200 backdrop-blur-xl"
      }`}>
        <div className="flex justify-around items-center py-2 px-2">
          {[
            { icon: <LayoutDashboard size={20} />, label: "Home",    link: "" },
            { icon: <Users size={20} />,           label: "Users",   link: "/admin/users" },
            { icon: <CreditCard size={20} />,      label: "Txns",    link: "/admin/transactions" },
            { icon: <CreditCard size={20} />,      label: "Pay",     link: "/admin/payment-settings" },
            { icon: <Tag size={20} />,             label: "Prices",  link: "/admin/price-list" },
          ].map(({ icon, label, link }) => (
            <button
              key={label}
              onClick={() => link && (window.location.href = link)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${isDark ? "text-slate-400 hover:text-sky-400" : "text-slate-500 hover:text-sky-600"}`}
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}

          <button
            onClick={() => { const n = isDark ? "light" : "dark"; setTheme(n); localStorage.setItem("admin-theme", n); }}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all text-yellow-500`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-[10px] font-medium">Theme</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-red-500"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

