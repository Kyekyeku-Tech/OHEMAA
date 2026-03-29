// AdminPriceList.jsx

import React, { useState } from "react";
import {
  LayoutDashboard,
  CreditCard,
  Users,
  LogOut,
  Tag,
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

const entries = Object.entries(ORIGINAL_PRICE_LIST).map(([gb, price]) => ({
  gb: Number(gb),
  price,
}));

export default function AdminPriceList() {
  const [theme] = useState(localStorage.getItem("admin-theme") || "dark");
  const isDark = theme === "dark";
  const glass = "bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl";

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/agent/login";
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0c1a2e_0%,#020617_60%)] text-white p-4 md:p-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className={`flex justify-between items-center rounded-3xl p-4 md:p-5 ${glass}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Tag size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40">Admin</p>
              <h1 className="text-xl font-extrabold">Original Price List</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => (window.location.href = "/admin/dashboard")}
              className="px-4 py-2 rounded-2xl text-xs font-semibold border bg-sky-500/15 border-sky-500/30 text-sky-300 hover:bg-sky-500/25 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <LayoutDashboard size={13} /> Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-2xl text-xs font-semibold border bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25 active:scale-95 transition-all hidden md:flex items-center gap-1.5"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>

        {/* INFO BANNER */}
        <div className="rounded-2xl px-5 py-3 border bg-sky-500/10 border-sky-500/20 text-sky-200 text-sm">
          These are the <strong>wholesale/original costs</strong> per data bundle. Selling above these prices generates commission.
        </div>

        {/* PRICE TABLE */}
        <div className={`rounded-3xl overflow-hidden ${glass}`}>
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-xs tracking-[0.15em] uppercase font-semibold opacity-40 mb-0.5">Reference</p>
            <p className="font-bold">Bundle Pricing</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr>
                  {["#", "Bundle Size", "Original Cost", "Cost / GB"].map((heading) => (
                    <th key={heading} className="px-6 py-3 text-xs font-semibold opacity-50 uppercase tracking-wider text-left">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(({ gb, price }, index) => (
                  <tr
                    key={gb}
                    className={`border-t border-white/[0.05] transition-colors ${index % 2 === 1 ? "bg-white/[0.02]" : ""} hover:bg-white/[0.05]`}
                  >
                    <td className="px-6 py-3 opacity-30 text-xs">{index + 1}</td>
                    <td className="px-6 py-3 font-bold">{gb} GB</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                        GHS {price.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3 opacity-50 text-xs">GHS {(price / gb).toFixed(2)} / GB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap gap-6 text-sm">
            {[
              { label: "Total Bundles", value: entries.length },
              { label: "Smallest", value: "1 GB — GHS 4.40" },
              { label: "Largest", value: "100 GB — GHS 385.00" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs opacity-40 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                <p className="font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE NAV */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-xl bg-slate-950/95 border-t border-white/[0.08] flex justify-around py-3 px-2">
        {[
          { icon: <LayoutDashboard size={20} />, label: "Home", link: "/admin/dashboard" },
          { icon: <CreditCard size={20} />, label: "Payments", link: "/admin/payment-settings" },
          { icon: <Users size={20} />, label: "Users", link: "/admin/users" },
        ].map(({ icon, label, link }) => (
          <button
            key={label}
            onClick={() => (window.location.href = link)}
            className={`flex flex-col items-center gap-0.5 transition-colors ${isDark ? "text-white/50 hover:text-white/90" : "text-slate-500"}`}
          >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center gap-0.5 text-red-400">
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
