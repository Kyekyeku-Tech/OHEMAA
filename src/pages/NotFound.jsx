import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6 overflow-hidden">

      {/* Floating Animation Container */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="text-center z-10"
      >

        {/* 404 Number */}
        <motion.h1
          initial={{ scale: 0.7 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-7xl md:text-8xl font-extrabold text-red-500 drop-shadow-lg"
        >
          404
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-4 text-lg md:text-xl text-gray-300"
        >
          Oops! The page you're looking for doesn't exist.
        </motion.p>

        {/* Thank You */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-2 text-md md:text-lg text-yellow-400 font-medium"
        >
          Thank you for visiting our portal ❤️
        </motion.p>

        {/* ACTION BUTTONS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
        >
          {/* Customer */}
          <Link
            to="/"
            className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 transition shadow-md text-white text-lg font-semibold"
          >
            🧑 Customer Home
          </Link>

          {/* Admin */}
          <Link
            to="/agent/login"
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 transition shadow-md text-white text-lg font-semibold"
          >
            🧑‍💼 Agent Login
          </Link>
        </motion.div>

      </motion.div>

      {/* Animated Glow Circle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
        className="absolute bottom-10 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none"
      ></motion.div>

    </div>
  );
}
