import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

type NavItem = {
  path: string;
  label: string;
  icon: string;
  subItems?: { path: string; label: string; icon: string }[];
};

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: "▣" },
  { path: "/reminders", label: "Reminder Center", icon: "🔔" },
  { path: "/items", label: "Items", icon: "📦" },
  { path: "/purchases", label: "Purchases", icon: "🛒" },
  { path: "/stock", label: "Stock", icon: "▥" },
  { path: "/sales", label: "Sales", icon: "💰" },
  { path: "/sales-return", label: "Sales Return", icon: "↩" },
  { path: "/repair-jobs", label: "Repair Jobs", icon: "🛠" },
  {
    path: "/customers",
    label: "Customers",
    icon: "👥",
    subItems: [
      { path: "/customers", label: "Customers", icon: "👥" },
      { path: "/customer-payments", label: "Customer Payments", icon: "💳" },
      { path: "/customer-account-statement", label: "Customer Statement", icon: "▦" },
    ],
  },
  {
    path: "/suppliers",
    label: "Suppliers",
    icon: "🏭",
    subItems: [
      { path: "/suppliers", label: "Suppliers", icon: "🏭" },
      { path: "/supplier-payments", label: "Supplier Payments", icon: "💳" },
    ],
  },
  { path: "/drivers", label: "Drivers", icon: "🚚" },
  { path: "/vehicles", label: "Vehicles", icon: "🚗" },
  { path: "/partners", label: "Partners", icon: "🤝" },
  { path: "/staff", label: "Staff", icon: "👔" },
  {
    path: "/expenses",
    label: "Expenses",
    icon: "💸",
    subItems: [
      { path: "/expenses", label: "Expenses", icon: "💸" },
      { path: "/labour-expenses", label: "Labour Expenses", icon: "🧾" },
    ],
  },
  { path: "/vat-center", label: "VAT Center", icon: "🧾" },
  { path: "/reports", label: "Reports", icon: "📄" },
  { path: "/settings", label: "Settings", icon: "⚙" },
];

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const syncUser = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
    };

    void syncUser();
  }, []);

  useEffect(() => {
    const activeParents = navItems
      .filter((item) => item.subItems?.some((sub) => location.pathname === sub.path))
      .map((item) => item.path);

    setOpenMenus((previous) => Array.from(new Set([...previous, ...activeParents])));
  }, [location.pathname]);

  const toggleMenu = (path: string) => {
    setOpenMenus((previous) =>
      previous.includes(path)
        ? previous.filter((item) => item !== path)
        : [...previous, path]
    );
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? "☰" : "×"}
      </button>

      <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div>
            <div className="sidebar-title">AL SHAMS</div>
            <div className="sidebar-subtitle">ERP SYSTEM</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active = location.pathname === item.path || item.subItems?.some((sub) => location.pathname === sub.path);
            const isOpen = openMenus.includes(item.path);

            if (!item.subItems) {
              return (
                <Link key={item.path} to={item.path} className={`sidebar-link ${active ? "active" : ""}`}>
                  <span className="sidebar-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <div key={item.path} className="sidebar-group">
                <button
                  type="button"
                  className={`sidebar-link sidebar-button ${active ? "active" : ""}`}
                  onClick={() => toggleMenu(item.path)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className={`sidebar-caret ${isOpen ? "open" : ""}`}>▾</span>
                </button>

                {isOpen && (
                  <div className="sidebar-sub-list">
                    {item.subItems.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`sidebar-sub-link ${location.pathname === sub.path ? "active" : ""}`}
                      >
                        <span className="sidebar-icon">{sub.icon}</span>
                        <span>{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{email ? email[0].toUpperCase() : "U"}</div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-email">{email || "Signed in user"}</div>
              <div className="sidebar-user-role">Admin</div>
            </div>
          </div>

          <button
            type="button"
            className="button button-ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
