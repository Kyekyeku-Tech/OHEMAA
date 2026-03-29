import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Moon, Sun, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();

  /* ================= STATE ================= */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (!cleanEmail || !cleanPassword) {
        setError("Please enter email and password.");
        return;
      }

      if (cleanPassword.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      /* ================= REGISTER ADMIN ================= */
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          cleanPassword
        );

        await setDoc(doc(db, "users", cred.user.uid), {
          email: cleanEmail,
          role: "admin",
          approved: false,
          createdAt: serverTimestamp(),
        });

        await auth.signOut();

        setIsRegister(false);
        setEmail("");
        setPassword("");

        alert("Admin account created. Awaiting approval.");
        return;
      }

      /* ================= LOGIN ADMIN ================= */
      const cred = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const snap = await getDoc(doc(db, "users", cred.user.uid));

      if (!snap.exists()) {
        await auth.signOut();
        setError("Account not authorized.");
        return;
      }

      const data = snap.data();

      if (data.role !== "admin") {
        await auth.signOut();
        setError("Access denied.");
        return;
      }

      if (!data.approved) {
        await auth.signOut();
        setError("Admin approval pending.");
        return;
      }

      navigate("/admin/dashboard");
    } catch {
      // 🔒 Hide Firebase raw errors
      setError(
        isRegister
          ? "Unable to create admin account."
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= THEME ================= */
  const toggleTheme = () =>
    setTheme(theme === "dark" ? "light" : "dark");

  const containerClass =
    theme === "dark"
      ? "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-black to-sky-900 p-4"
      : "min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 p-4";

  const cardClass =
    theme === "dark"
      ? "w-full max-w-md bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-white shadow-2xl"
      : "w-full max-w-md bg-white p-8 rounded-3xl border border-gray-300 text-black shadow-2xl";

  const inputClass =
    "w-full p-3 rounded-xl outline-none transition focus:ring-2 " +
    (theme === "dark"
      ? "bg-black/40 text-white placeholder-gray-400 focus:ring-sky-500"
      : "bg-gray-100 text-black placeholder-gray-500 focus:ring-blue-500");

  const buttonClass =
    "w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition " +
    (loading
      ? "opacity-60 cursor-not-allowed"
      : theme === "dark"
      ? "bg-sky-600 hover:bg-sky-500"
      : "bg-blue-600 hover:bg-blue-500");

  const errorClass =
    theme === "dark"
      ? "bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm text-center"
      : "bg-red-100 border border-red-300 text-red-700 p-3 rounded-xl text-sm text-center";

  /* ================= UI ================= */
  return (
    <div className={containerClass}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cardClass}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-extrabold text-sky-400 flex items-center gap-2">
            <ShieldCheck /> Admin Access
          </h2>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-white/10"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {error && <div className={errorClass}>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className={buttonClass}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Please wait…
              </>
            ) : isRegister ? (
              "Create Admin Account"
            ) : (
              "Sign In"
            )}
          </motion.button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="block mx-auto mt-4 text-sm font-semibold text-sky-400 hover:text-sky-300"
        >
          {isRegister
            ? "Already an admin? Sign In"
            : "Create admin account"}
        </button>
      </motion.div>
    </div>
  );
}
