import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/agent/login"); // SPA navigation
  };

  return (
    <motion.button
      onClick={handleLogout}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-3 px-5 py-3 bg-red-600 text-white font-extrabold rounded-xl shadow-lg hover:bg-red-500 transition"
    >
      <motion.span
        animate={{ x: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      >
        <LogOut size={18} />
      </motion.span>
      Logout
    </motion.button>
  );
}

export default LogoutButton;
