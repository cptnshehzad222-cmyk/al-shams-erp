import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import SalesReturn from "./pages/SalesReturn";
import Customers from "./pages/Customers";
import CustomerPayment from "./pages/CustomerPayment";
import CustomerAccountStatement from "./pages/CustomerAccountStatement";
import Suppliers from "./pages/Suppliers";
import SupplierPayments from "./pages/SupplierPayments";
import RepairJobs from "./pages/RepairJobs";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Drivers from "./pages/Drivers";
import Stock from "./pages/Stock";
import Expenses from "./pages/Expenses";
import LabourExpenses from "./pages/LabourExpenses";
import Staff from "./pages/Staff";
import VatCenter from "./pages/VatCenter";
import Vehicles from "./pages/Vehicles";
import Partners from "./pages/Partners";
import ReminderCenter from "./pages/ReminderCenter";
import Login from "./pages/Login";

import "./App.css";

const AUTH_KEY = "alshams_erp_logged_in";

function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

/* =========================================================
   PROTECTED ERP AREA
========================================================= */

function ProtectedERP() {
  return (
    <div className="erp-layout">

      <Sidebar />

      <main className="erp-content">

        <Routes>

          {/* =========================
              DASHBOARD
          ========================== */}

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          {/* =========================
              REMINDER CENTER
          ========================== */}

          <Route
            path="/reminders"
            element={<ReminderCenter />}
          />

          {/* =========================
              ITEMS
          ========================== */}

          <Route
            path="/items"
            element={<Items />}
          />

          {/* =========================
              PURCHASES
          ========================== */}

          <Route
            path="/purchases"
            element={<Purchases />}
          />

          {/* =========================
              STOCK
          ========================== */}

          <Route
            path="/stock"
            element={<Stock />}
          />

          {/* =========================
              SALES
          ========================== */}

          <Route
            path="/sales"
            element={<Sales />}
          />

          {/* =========================
              SALES RETURN
          ========================== */}

          <Route
            path="/sales-return"
            element={<SalesReturn />}
          />

          {/* =========================
              REPAIR JOBS
          ========================== */}

          <Route
            path="/repair-jobs"
            element={<RepairJobs />}
          />

          {/* =========================
              CUSTOMERS
          ========================== */}

          <Route
            path="/customers"
            element={<Customers />}
          />

          {/* =========================
              CUSTOMER PAYMENTS
          ========================== */}

          <Route
            path="/customer-payments"
            element={<CustomerPayment />}
          />

          {/* =========================
              CUSTOMER ACCOUNT STATEMENT
          ========================== */}

          <Route
            path="/customer-account-statement"
            element={<CustomerAccountStatement />}
          />

          {/* =========================
              SUPPLIERS
          ========================== */}

          <Route
            path="/suppliers"
            element={<Suppliers />}
          />

          {/* =========================
              SUPPLIER PAYMENTS
          ========================== */}

          <Route
            path="/supplier-payments"
            element={<SupplierPayments />}
          />

          {/* =========================
              EXPENSES
          ========================== */}

          <Route
            path="/expenses"
            element={<Expenses />}
          />

          {/* =========================
              VAT CENTER
          ========================== */}

          <Route
            path="/vat-center"
            element={<VatCenter />}
          />

          {/* =========================
              LABOUR EXPENSES
          ========================== */}

          <Route
            path="/labour-expenses"
            element={<LabourExpenses />}
          />

          {/* =========================
              DRIVERS
          ========================== */}

          <Route
            path="/drivers"
            element={<Drivers />}
          />

          {/* =========================
              VEHICLES / DAYNAS
          ========================== */}

          <Route
            path="/vehicles"
            element={<Vehicles />}
          />

          {/* =========================
              PARTNERS
          ========================== */}

          <Route
            path="/partners"
            element={<Partners />}
          />

          {/* =========================
              STAFF
          ========================== */}

          <Route
            path="/staff"
            element={<Staff />}
          />

          {/* =========================
              REPORTS
          ========================== */}

          <Route
            path="/reports"
            element={<Reports />}
          />

          {/* =========================
              SETTINGS
          ========================== */}

          <Route
            path="/settings"
            element={<Settings />}
          />

          {/* Unknown ERP route */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </main>

    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(isLoggedIn());

  useEffect(() => {
    const checkAuthentication = () => {
      setLoggedIn(isLoggedIn());
    };

    // Listen for login/logout changes
    window.addEventListener(
      "alshams-auth-change",
      checkAuthentication
    );

    // Also listen for changes from another browser tab
    window.addEventListener(
      "storage",
      checkAuthentication
    );

    return () => {
      window.removeEventListener(
        "alshams-auth-change",
        checkAuthentication
      );

      window.removeEventListener(
        "storage",
        checkAuthentication
      );
    };
  }, []);

  return (
    <BrowserRouter>

      <Routes>

        {/* =========================
            LOGIN
        ========================== */}

        <Route
          path="/login"
          element={
            loggedIn ? (
              <Navigate to="/" replace />
            ) : (
              <Login />
            )
          }
        />

        {/* =========================
            PROTECTED ERP
        ========================== */}

        <Route
          path="/*"
          element={
            loggedIn ? (
              <ProtectedERP />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;