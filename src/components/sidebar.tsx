import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="sidebar-title">
        AL SHAMS ERP TEST
      </div>

      {/* =========================
          DASHBOARD
      ========================== */}

      <Link to="/dashboard">
        Dashboard
      </Link>

      {/* =========================
          ITEMS
      ========================== */}

      <Link to="/items">
        Items
      </Link>

      {/* =========================
          PURCHASES
      ========================== */}

      <Link to="/purchases">
        Purchases
      </Link>

      {/* =========================
          STOCK
      ========================== */}

      <Link to="/stock">
        📦 Stock
      </Link>

      {/* =========================
          SALES
      ========================== */}

      <Link to="/sales">
        Sales
      </Link>

      {/* =========================
          REPAIR JOBS
      ========================== */}

      <Link to="/repair-jobs">
        🔧 Repair Jobs
      </Link>

      {/* =========================
          CUSTOMERS
      ========================== */}

      <Link to="/customers">
        Customers
      </Link>

      <Link to="/customer-payments">
        💳 Customer Payments
      </Link>

      <Link to="/customer-account-statement">
        📊 Customer Account Statement
      </Link>

      {/* =========================
          SUPPLIERS
      ========================== */}

      <Link to="/suppliers">
        Suppliers
      </Link>

      <Link to="/supplier-payments">
        💳 Supplier Payments
      </Link>

      {/* =========================
          DRIVERS
      ========================== */}

      <Link to="/drivers">
        Drivers
      </Link>

      {/* =========================
          EXPENSES
      ========================== */}

      <Link to="/expenses">
        💰 Expenses
      </Link>

      <Link to="/labour-expenses">
        🍽️ Labour Expenses
      </Link>

      {/* =========================
          REPORTS
      ========================== */}

      <Link to="/reports">
        Reports
      </Link>

      {/* =========================
          SETTINGS
      ========================== */}

      <Link to="/settings">
        Settings
      </Link>

    </aside>
  );
}

export default Sidebar;