import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

type NavItem = {
  path: string;
  label: string;
  icon: string;
  subItems?: { path: string; label: string; icon: string }[];
};

function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [hoverSound, setHoverSound] = useState<HTMLAudioElement | null>(null);
  const [clickSound, setClickSound] = useState<HTMLAudioElement | null>(null);

  // ============================================================
  // SOUND EFFECTS
  // ============================================================

  useEffect(() => {
    // Create hover sound (soft click/glide sound)
    const hover = new Audio(
      "data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBg4SFhoWHhYaFh4WHhoaFh4WGhoWGhoWGhYaFhYaFhoWHhoWGh4WGhoWGh4WGhoWGh4aFh4WGhoWGh4WGhoWGh4aFh4WGhgA="
    );
    hover.volume = 0.15;
    hover.load();

    // Create click sound (soft pop)
    const click = new Audio(
      "data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqF"
    );
    click.volume = 0.2;
    click.load();

    setHoverSound(hover);
    setClickSound(click);

    return () => {
      hover.pause();
      click.pause();
    };
  }, []);

  const playHoverSound = () => {
    if (hoverSound) {
      hoverSound.currentTime = 0;
      hoverSound.play().catch(() => {});
    }
  };

  const playClickSound = () => {
    if (clickSound) {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    }
  };

  // ============================================================
  // NAVIGATION ITEMS
  // ============================================================

  const navItems: NavItem[] = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/reminders", label: "Reminder Center", icon: "🔔" },
    { path: "/items", label: "Items", icon: "📦" },
    { path: "/purchases", label: "Purchases", icon: "🛒" },
    { path: "/stock", label: "Stock", icon: "📊" },
    { path: "/sales", label: "Sales", icon: "💰" },
    { path: "/sales-return", label: "Sales Return", icon: "↩️" },
    { path: "/repair-jobs", label: "Repair Jobs", icon: "🔧" },
    {
      path: "/customers",
      label: "Customers",
      icon: "👥",
      subItems: [
        { path: "/customers", label: "Customers", icon: "👥" },
        { path: "/customer-payments", label: "Customer Payments", icon: "💳" },
        { path: "/customer-account-statement", label: "Customer Statement", icon: "📊" },
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
    { path: "/vehicles", label: "Vehicles / Daynas", icon: "🚗" },
    { path: "/partners", label: "Partners", icon: "🤝" },
    { path: "/staff", label: "Staff Management", icon: "👔" },
    {
      path: "/expenses",
      label: "Expenses",
      icon: "💰",
      subItems: [
        { path: "/expenses", label: "Expenses", icon: "💰" },
        { path: "/labour-expenses", label: "Labour Expenses", icon: "🍽️" },
      ],
    },
    { path: "/vat-center", label: "VAT Center", icon: "🧾" },
    { path: "/reports", label: "Reports", icon: "📄" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ];

  // ============================================================
  // HOOKS
  // ============================================================

  useEffect(() => {
    const currentPath = location.pathname;
    navItems.forEach((item) => {
      if (item.subItems) {
        const isActive = item.subItems.some((sub) => currentPath === sub.path);
        if (isActive && !openMenus.includes(item.path)) {
          setOpenMenus((prev) => [...prev, item.path]);
        }
      }
    });
  }, [location.pathname]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();
        setUser(userData);
      }
    };
    getUser();
  }, []);

  // ============================================================
  // HELPERS
  // ============================================================

  const toggleMenu = (path: string) => {
    playClickSound();
    setOpenMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isSubActive = (subItems?: { path: string; label: string; icon: string }[]) => {
    if (!subItems) return false;
    return subItems.some((sub) => location.pathname === sub.path);
  };

  // ============================================================
  // NEON BOX STYLES
  // ============================================================

  const styles = {
    sidebar: {
      width: collapsed ? "0px" : "270px",
      height: "100vh",
      background: "linear-gradient(180deg, rgba(7,11,30,0.98), rgba(5,8,20,0.99))",
      borderRight: "1px solid rgba(34,211,238,0.06)",
      position: "fixed" as const,
      top: 0,
      left: 0,
      zIndex: 1000,
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column" as const,
      backdropFilter: "blur(20px)",
      boxShadow: "0 0 40px rgba(34,211,238,0.02), inset 0 0 60px rgba(34,211,238,0.01)",
      opacity: collapsed ? 0 : 1,
      transform: collapsed ? "translateX(-100%)" : "translateX(0)",
    },

    brand: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid rgba(34,211,238,0.06)",
      minHeight: "65px",
    },

    brandLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    brandIcon: {
      fontSize: "28px",
      filter: "drop-shadow(0 0 15px rgba(34,211,238,0.3))",
      animation: "pulseGlow 3s ease-in-out infinite",
    },

    brandText: {
      color: "#22d3ee",
      fontSize: "14px",
      fontWeight: 800,
      letterSpacing: "1.5px",
      textShadow: "0 0 20px rgba(34,211,238,0.15), 0 0 40px rgba(34,211,238,0.05)",
      whiteSpace: "nowrap" as const,
    },

    brandSub: {
      color: "#64748b",
      fontSize: "7px",
      fontWeight: 600,
      letterSpacing: "1px",
      opacity: 0.5,
      textTransform: "uppercase" as const,
    },

    toggleBtn: {
      background: "rgba(34,211,238,0.06)",
      border: "1px solid rgba(34,211,238,0.1)",
      borderRadius: "8px",
      color: "#67e8f9",
      cursor: "pointer",
      padding: "6px 12px",
      fontSize: "16px",
      transition: "all 0.3s ease",
      boxShadow: "0 0 10px rgba(34,211,238,0.05)",
    },

    nav: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "12px 14px",
      scrollbarWidth: "thin" as const,
      scrollbarColor: "rgba(34,211,238,0.08) transparent",
    },

    // ==========================================================
    // NEON BOX - MAIN NAV ITEM
    // ==========================================================

    navItem: (active: boolean) => ({
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 16px",
      borderRadius: "10px",
      cursor: "pointer",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      background: active 
        ? "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(37,99,235,0.08))" 
        : "rgba(17,24,39,0.4)",
      border: active 
        ? "1px solid rgba(34,211,238,0.25)" 
        : "1px solid rgba(34,211,238,0.06)",
      boxShadow: active 
        ? "0 0 25px rgba(34,211,238,0.08), inset 0 0 20px rgba(34,211,238,0.03)" 
        : "0 0 10px rgba(34,211,238,0.02)",
      marginBottom: "6px",
      position: "relative" as const,
      textDecoration: "none",
      backdropFilter: "blur(10px)",
    }),

    navItemHover: {
      transform: "translateX(4px) scale(1.01)",
      boxShadow: "0 0 30px rgba(34,211,238,0.12), 0 0 60px rgba(34,211,238,0.05), inset 0 0 20px rgba(34,211,238,0.05)",
      borderColor: "rgba(34,211,238,0.2)",
      background: "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(37,99,235,0.05))",
    },

    navIcon: {
      fontSize: "20px",
      minWidth: "32px",
      textAlign: "center" as const,
      filter: "drop-shadow(0 0 8px rgba(34,211,238,0.08))",
    },

    navLabel: {
      color: "#cbd5e1",
      fontSize: "13px",
      fontWeight: 600,
      whiteSpace: "nowrap" as const,
      transition: "all 0.3s ease",
      flex: 1,
    },

    navLabelActive: {
      color: "#67e8f9",
      textShadow: "0 0 20px rgba(34,211,238,0.12)",
    },

    navArrow: {
      fontSize: "10px",
      color: "#64748b",
      transition: "transform 0.3s ease",
    },

    // ==========================================================
    // NEON BOX - SUB ITEM
    // ==========================================================

    subMenu: {
      overflow: "hidden",
      maxHeight: 0,
      transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      paddingLeft: "12px",
    },

    subMenuOpen: {
      maxHeight: "600px",
    },

    subItem: (active: boolean) => ({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "9px 14px 9px 16px",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      background: active 
        ? "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(37,99,235,0.04))" 
        : "rgba(17,24,39,0.2)",
      border: active 
        ? "1px solid rgba(34,211,238,0.15)" 
        : "1px solid rgba(34,211,238,0.04)",
      marginBottom: "4px",
      textDecoration: "none",
      backdropFilter: "blur(10px)",
    }),

    subItemHover: {
      transform: "translateX(4px)",
      boxShadow: "0 0 20px rgba(34,211,238,0.06)",
      borderColor: "rgba(34,211,238,0.12)",
      background: "rgba(34,211,238,0.04)",
    },

    subIcon: {
      fontSize: "14px",
      minWidth: "24px",
      textAlign: "center" as const,
    },

    subLabel: {
      color: "#94a3b8",
      fontSize: "12px",
      fontWeight: 500,
      whiteSpace: "nowrap" as const,
      transition: "all 0.3s ease",
    },

    subLabelActive: {
      color: "#67e8f9",
    },

    // ==========================================================
    // FOOTER
    // ==========================================================

    footer: {
      padding: "12px 18px",
      borderTop: "1px solid rgba(34,211,238,0.06)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },

    userAvatar: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(37,99,235,0.15))",
      border: "1px solid rgba(34,211,238,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      fontWeight: 700,
      color: "#67e8f9",
      flexShrink: 0,
    },

    userInfo: {
      flex: 1,
      minWidth: 0,
    },

    userName: {
      color: "#e2e8f0",
      fontSize: "12px",
      fontWeight: 700,
    },

    userRole: {
      color: "#64748b",
      fontSize: "9px",
    },

    logoutBtn: {
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.12)",
      borderRadius: "6px",
      color: "#f87171",
      cursor: "pointer",
      padding: "5px 12px",
      fontSize: "10px",
      fontWeight: 600,
      transition: "all 0.3s ease",
    },

    // ==========================================================
    // TOGGLE BUTTON WHEN SIDEBAR IS HIDDEN
    // ==========================================================

    toggleFloat: {
      position: "fixed" as const,
      top: "16px",
      left: collapsed ? "12px" : "280px",
      zIndex: 1001,
      background: "rgba(7,11,30,0.9)",
      border: "1px solid rgba(34,211,238,0.15)",
      borderRadius: "10px",
      color: "#67e8f9",
      cursor: "pointer",
      padding: "8px 14px",
      fontSize: "18px",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: "0 0 30px rgba(34,211,238,0.1), 0 0 60px rgba(34,211,238,0.05)",
      backdropFilter: "blur(20px)",
    },
  };

  // Inject keyframes
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulseGlow {
        0%, 100% { filter: drop-shadow(0 0 15px rgba(34,211,238,0.3)); }
        50% { filter: drop-shadow(0 0 30px rgba(34,211,238,0.5)); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fix for submenu
  const getSubMenuStyle = (path: string) => {
    const isOpen = openMenus.includes(path);
    return {
      ...styles.subMenu,
      ...(isOpen ? styles.subMenuOpen : {}),
    };
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* FLOATING TOGGLE BUTTON */}
      <button
        style={styles.toggleFloat}
        onClick={() => {
          playClickSound();
          setCollapsed(!collapsed);
        }}
        onMouseEnter={(e) => {
          playHoverSound();
          e.currentTarget.style.boxShadow = "0 0 40px rgba(34,211,238,0.2), 0 0 80px rgba(34,211,238,0.1)";
          e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.1), 0 0 60px rgba(34,211,238,0.05)";
          e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
        }}
      >
        {collapsed ? "☰" : "✕"}
      </button>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        {/* BRAND */}
        <div style={styles.brand}>
          <div style={styles.brandLeft}>
            <span style={styles.brandIcon}>✦</span>
            <div>
              <div style={styles.brandText}>AL SHAMS</div>
              <div style={styles.brandSub}>ERP SYSTEM</div>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav style={styles.nav}>
          {navItems.map((item) => {
            const active = isActive(item.path) || isSubActive(item.subItems);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isOpen = openMenus.includes(item.path);

            return (
              <div key={item.path}>
                {hasSubItems ? (
                  <>
                    <div
                      style={styles.navItem(active)}
                      onClick={() => toggleMenu(item.path)}
                      onMouseEnter={(e) => {
                        playHoverSound();
                        Object.assign(e.currentTarget.style, styles.navItemHover);
                      }}
                      onMouseLeave={(e) => {
                        Object.assign(e.currentTarget.style, {
                          transform: "translateX(0) scale(1)",
                          boxShadow: active 
                            ? "0 0 25px rgba(34,211,238,0.08), inset 0 0 20px rgba(34,211,238,0.03)" 
                            : "0 0 10px rgba(34,211,238,0.02)",
                          borderColor: active 
                            ? "rgba(34,211,238,0.25)" 
                            : "rgba(34,211,238,0.06)",
                          background: active 
                            ? "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(37,99,235,0.08))" 
                            : "rgba(17,24,39,0.4)",
                        });
                      }}
                    >
                      <span style={styles.navIcon}>{item.icon}</span>
                      <span
                        style={{
                          ...styles.navLabel,
                          ...(active ? styles.navLabelActive : {}),
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          ...styles.navArrow,
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      >
                        ▾
                      </span>
                    </div>

                    <div style={getSubMenuStyle(item.path)}>
                      {item.subItems?.map((sub) => {
                        const subActive = isActive(sub.path);
                        return (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            style={{ textDecoration: "none" }}
                          >
                            <div
                              style={styles.subItem(subActive)}
                              onMouseEnter={(e) => {
                                playHoverSound();
                                Object.assign(e.currentTarget.style, styles.subItemHover);
                              }}
                              onMouseLeave={(e) => {
                                Object.assign(e.currentTarget.style, {
                                  transform: "translateX(0)",
                                  boxShadow: subActive 
                                    ? "0 0 20px rgba(34,211,238,0.06)" 
                                    : "none",
                                  borderColor: subActive 
                                    ? "rgba(34,211,238,0.15)" 
                                    : "rgba(34,211,238,0.04)",
                                  background: subActive 
                                    ? "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(37,99,235,0.04))" 
                                    : "rgba(17,24,39,0.2)",
                                });
                              }}
                            >
                              <span style={styles.subIcon}>{sub.icon}</span>
                              <span
                                style={{
                                  ...styles.subLabel,
                                  ...(subActive ? styles.subLabelActive : {}),
                                }}
                              >
                                {sub.label}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <Link to={item.path} style={{ textDecoration: "none" }}>
                    <div
                      style={styles.navItem(active)}
                      onMouseEnter={(e) => {
                        playHoverSound();
                        Object.assign(e.currentTarget.style, styles.navItemHover);
                      }}
                      onMouseLeave={(e) => {
                        Object.assign(e.currentTarget.style, {
                          transform: "translateX(0) scale(1)",
                          boxShadow: active 
                            ? "0 0 25px rgba(34,211,238,0.08), inset 0 0 20px rgba(34,211,238,0.03)" 
                            : "0 0 10px rgba(34,211,238,0.02)",
                          borderColor: active 
                            ? "rgba(34,211,238,0.25)" 
                            : "rgba(34,211,238,0.06)",
                          background: active 
                            ? "linear-gradient(135deg, rgba(34,211,238,0.12), rgba(37,99,235,0.08))" 
                            : "rgba(17,24,39,0.4)",
                        });
                      }}
                    >
                      <span style={styles.navIcon}>{item.icon}</span>
                      <span
                        style={{
                          ...styles.navLabel,
                          ...(active ? styles.navLabelActive : {}),
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* USER FOOTER */}
        <div style={styles.footer}>
          <div style={styles.userAvatar}>
            {user?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.full_name || "User"}</div>
            <div style={styles.userRole}>{user?.role || "Admin"}</div>
          </div>
          <button
            style={styles.logoutBtn}
            onClick={async () => {
              playClickSound();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            onMouseEnter={(e) => {
              playHoverSound();
              e.currentTarget.style.background = "rgba(239,68,68,0.18)";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.12)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default Sidebar;