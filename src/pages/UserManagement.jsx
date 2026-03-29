// src/pages/UserManagement.jsx

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  LogOut,
  Shield,
  Trash2,
} from "lucide-react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const SUPER_ADMIN_EMAIL = "admin@admin.com";


  const usersPerPage = 10;
  const navigate = useNavigate();

  /* ================= AUTH (ADMIN ONLY) ================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/agent/login");
        return;
      }

      const snap = await getDocs(query(collection(db, "users")));
      const me = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find(
          (u) =>
            u.email?.toLowerCase() === user.email?.toLowerCase()
        );

      if (!me || me.role !== "admin" || me.approved !== true) {
        alert("Admins only.");
        await signOut(auth);
        navigate("/agent/login");
      }
    });

    return unsub;
  }, [navigate]);

  /* ================= LOAD USERS ================= */
  const loadUsers = async () => {
    setLoading(true);
    const q = query(
      collection(db, "users"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
   setUsers(
  snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (u) =>
        u.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    )
);

    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  /* ================= ACTIONS ================= */

  // Cycle role: user → agent → admin → user
  const toggleRole = async (id, role) => {
    const next =
      role === "user" ? "agent" : role === "agent" ? "admin" : "user";

    if (!window.confirm(`Change role to ${next}?`)) return;

    await updateDoc(doc(db, "users", id), {
      role: next,
      approved: next === "admin" ? false : true,
    });

    loadUsers();
  };

  // Approve / revoke admin
  const toggleApproval = async (id, approved) => {
    await updateDoc(doc(db, "users", id), {
      approved: !approved,
    });
    loadUsers();
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    await deleteDoc(doc(db, "users", id));
    setUsers((p) => p.filter((u) => u.id !== id));
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/agent/login");
  };

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(users.length / usersPerPage) || 1;
  const pageUsers = users.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  /* ================= UI ================= */
  const glass = "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white p-4 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
          className={`flex justify-between items-center rounded-3xl p-4 md:p-5 ${glass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Shield size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">Admin Panel</p>
              <h1 className="text-xl font-extrabold">User Management</h1>
            </div>
          </div>
          <div className="hidden md:flex gap-2">
            {[
              { label: "Dashboard", icon: <LayoutDashboard size={15}/>, link: "/admin/dashboard", cls: "bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25" },
              { label: "Transactions", icon: <CreditCard size={15}/>, link: "/admin/transactions", cls: "bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25" },
              { label: "Logout", icon: <LogOut size={15}/>, onClick: handleLogout, cls: "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25" },
            ].map(({ label, icon, link, onClick: oc, cls }) => (
              <button key={label} onClick={() => link ? navigate(link) : oc()}
                className={`px-4 py-2 rounded-2xl text-xs font-semibold border flex items-center gap-1.5 active:scale-95 transition-all ${cls}`}>
                {icon}{label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* TABLE */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl overflow-hidden ${glass}`}>
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-0.5">Registry</p>
              <p className="font-bold">{users.length} user{users.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["Email","Role","Approved","Paid","Actions"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold opacity-50 uppercase tracking-wider ${i === 0 ? "text-left" : i === 4 ? "text-right" : "text-center"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {loading ? (
                    <tr><td colSpan="5" className="p-8 text-center opacity-50">Loading…</td></tr>
                  ) : (
                    pageUsers.map((u, i) => (
                      <motion.tr key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`border-t border-white/[0.05] transition-colors ${i%2===1?"bg-white/[0.02]":""} hover:bg-white/[0.05]`}>
                        <td className="px-4 py-3 font-medium">{u.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            u.role==="admin" ? "bg-violet-500/20 text-violet-300" :
                            u.role==="agent" ? "bg-sky-500/20 text-sky-300" :
                            "bg-white/10 text-white/60"
                          }`}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.role === "admin" ? (
                            u.approved
                              ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Active</span>
                              : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-500/15 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400"/>Revoked</span>
                          ) : <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.role === "agent"
                            ? u.paid
                              ? <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-400">Paid</span>
                              : <span className="px-2.5 py-1 rounded-full text-xs bg-amber-500/15 text-amber-300">Unpaid</span>
                            : <span className="opacity-30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => toggleRole(u.id, u.role)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all">
                              Role
                            </button>
                            {u.role === "admin" && (
                              <button onClick={() => toggleApproval(u.id, u.approved)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${u.approved ? "bg-red-500/15 border-red-500/30 text-red-400" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"}`}>
                                {u.approved ? "Revoke" : "Approve"}
                              </button>
                            )}
                            <button onClick={() => deleteUser(u.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25 active:scale-95 transition-all flex items-center gap-1">
                              <Trash2 size={11}/> Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3">
            <button disabled={currentPage===1} onClick={() => setCurrentPage(p => p-1)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30 ${glass}`}>◀</button>
            <span className="text-sm opacity-50">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage===totalPages} onClick={() => setCurrentPage(p => p+1)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-all disabled:opacity-30 ${glass}`}>▶</button>
          </div>
        )}
      </div>

      {/* MOBILE NAV */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-xl bg-slate-950/95 border-t border-white/[0.08] flex justify-around py-3 px-2">
        {[
          { icon: <LayoutDashboard size={20}/>, label: "Home", link: "/admin/dashboard" },
          { icon: <Users size={20}/>, label: "Users" },
          { icon: <CreditCard size={20}/>, label: "Txns", link: "/admin/transactions" },
        ].map(({ icon, label, link }) => (
          <button key={label} onClick={() => link && navigate(link)}
            className="flex flex-col items-center gap-0.5 text-white/50 hover:text-white/90 transition-colors">
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center gap-0.5 text-red-400">
          <LogOut size={20}/><span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
