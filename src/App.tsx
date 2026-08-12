import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
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

import "./App.css";

function App() {
  return (
    <BrowserRouter>
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

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;