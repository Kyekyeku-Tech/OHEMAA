// src/App.js

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Kyetech from "./pages/Kyetech";
import AgentLogin from "./pages/AgentLogin";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import Transactions from "./pages/Transactions";
import AdminUploadTickets from "./pages/AdminUploadTickets";
import AdminPaymentSettings from "./pages/AdminPaymentSettings";
import DailyPayoutControl from "./pages/DailyPayoutControl";
import AdminPriceList from "./pages/AdminPriceList";

import Waec from "./pages/waec";
import NotFound from "./pages/NotFound";

import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>

        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<Kyetech />} />
        <Route path="/waec" element={<Waec />} />

        {/* ================= AUTH ================= */}
        <Route path="/agent/login" element={<AgentLogin />} />

        {/* ================= ADMIN ONLY ================= */}
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute allow="admin">
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route path="/admin/payment-settings" 
        element={
        <PrivateRoute allow="admin">
        <AdminPaymentSettings />
        </PrivateRoute>
        }
        />

        <Route
          path="/admin/daily-payout"
          element={
            <PrivateRoute allow="admin">
              <DailyPayoutControl />
            </PrivateRoute>
          }
        />


        <Route
          path="/admin/users"
          element={
            <PrivateRoute allow="admin">
              <UserManagement />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/transactions"
          element={
            <PrivateRoute allow="admin">
              <Transactions />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/upload"
          element={
            <PrivateRoute allow="admin">
              <AdminUploadTickets />
            </PrivateRoute>
          }
        />

        

        <Route
          path="/admin/price-list"
          element={
            <PrivateRoute allow="admin">
              <AdminPriceList />
            </PrivateRoute>
          }
        />

        {/* ================= 404 ================= */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
