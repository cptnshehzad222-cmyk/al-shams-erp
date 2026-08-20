import { useEffect, useState, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

/* ============================================================
   TYPES - Matching your existing schema
============================================================ */

type ReminderPriority = "overdue" | "upcoming" | "info";

type Reminder = {
  id: string;
  title: string;
  description: string;
  priority: ReminderPriority;
  dueDate: string | null;
  category: string;
  relatedId: number | null;
  relatedType: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  actionLink?: string; // For navigation
  actionLabel?: string; // For button text
};

type Customer = {
  id: number;
  customer_name: string;
  phone: string | null;
  email: string | null;
  balance: number;
};

type Supplier = {
  id: number;
  supplier_name: string;
  phone: string | null;
  email: string | null;
  balance: number;
};

type Vehicle = {
  id: number;
  plate_number: string;
  vehicle_type: string;
  istimara_expiry: string | null;
  fahas_expiry: string | null;
  insurance_expiry: string | null;
};

type Employee = {
  id: number;
  employee_name: string;
  position: string;
  contract_expiry: string | null;
  visa_expiry: string | null;
};

type Invoice = {
  id: number;
  invoice_number: string;
  customer_id: number;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
};

type PurchaseInvoice = {
  id: number;
  invoice_number: string;
  supplier_id: number;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
};

/* ============================================================
   CONSTANTS
============================================================ */

const REMINDER_CATEGORIES = {
  CUSTOMER_PAYMENT: "Customer Payment",
  SUPPLIER_PAYMENT: "Supplier Payment",
  INVOICE_PENDING: "Pending Invoice",
  INVOICE_OVERDUE: "Overdue Invoice",
  PURCHASE_INVOICE_PENDING: "Purchase Invoice Pending",
  PURCHASE_INVOICE_OVERDUE: "Purchase Invoice Overdue",
  VEHICLE_ISTIMARA: "Vehicle Istimara",
  VEHICLE_FAHAS: "Vehicle Fahas",
  VEHICLE_INSURANCE: "Vehicle Insurance",
  EMPLOYEE_CONTRACT: "Employee Contract",
  EMPLOYEE_VISA: "Employee Visa",
} as const;

/* ============================================================
   MAIN COMPONENT
============================================================ */

function ReminderCenter() {
  const navigate = useNavigate();
  
  /* ==========================================================
     STATE
  ========================================================== */

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ReminderPriority>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    overdue: 0,
    upcoming: 0,
    info: 0,
    total: 0,
  });
  const [playSound, setPlaySound] = useState(true);
  const [lastChecked, setLastChecked] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ==========================================================
     SOUND EFFECTS
  ========================================================== */

  useEffect(() => {
    // Create notification sound
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqFhYqF"
    );
    audioRef.current.load();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (playSound && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [playSound]);

  /* ==========================================================
     FETCH REAL DATA FROM ALL PAGES
  ========================================================== */

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const allReminders: Reminder[] = [];
    let overdueCount = 0;

    try {
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // ==========================================================
      // 1. CUSTOMER PAYMENTS (from Customers page)
      // ==========================================================
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .gt("balance", 0)
        .order("balance", { ascending: false });

      if (!customersError && customers) {
        (customers as Customer[]).forEach((customer) => {
          const balance = Number(customer.balance || 0);
          
          if (balance > 100) {
            // Check if we have invoices for this customer
            const isOverdue = balance > 500; // Mark as overdue if balance is high
            
            allReminders.push({
              id: `customer-balance-${customer.id}`,
              title: isOverdue ? `⚠️ Customer Payment Overdue` : `Customer Balance Due`,
              description: `${customer.customer_name} has unpaid balance of SAR ${balance.toFixed(2)}`,
              priority: isOverdue ? "overdue" : "upcoming",
              dueDate: new Date().toISOString(),
              category: REMINDER_CATEGORIES.CUSTOMER_PAYMENT,
              relatedId: customer.id,
              relatedType: "customer",
              isRead: false,
              isDismissed: false,
              createdAt: new Date().toISOString(),
              actionLink: "/customers",
              actionLabel: "View Customer",
            });
            
            if (isOverdue) overdueCount++;
          }
        });
      }

      // ==========================================================
      // 2. SUPPLIER PAYMENTS (from Suppliers page)
      // ==========================================================
      const { data: suppliers, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .gt("balance", 0)
        .order("balance", { ascending: false });

      if (!suppliersError && suppliers) {
        (suppliers as Supplier[]).forEach((supplier) => {
          const balance = Number(supplier.balance || 0);
          
          if (balance > 100) {
            const isOverdue = balance > 500;
            
            allReminders.push({
              id: `supplier-balance-${supplier.id}`,
              title: isOverdue ? `⚠️ Supplier Payment Overdue` : `Supplier Payment Due`,
              description: `${supplier.supplier_name} has pending payment of SAR ${balance.toFixed(2)}`,
              priority: isOverdue ? "overdue" : "upcoming",
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              category: REMINDER_CATEGORIES.SUPPLIER_PAYMENT,
              relatedId: supplier.id,
              relatedType: "supplier",
              isRead: false,
              isDismissed: false,
              createdAt: new Date().toISOString(),
              actionLink: "/suppliers",
              actionLabel: "View Supplier",
            });
            
            if (isOverdue) overdueCount++;
          }
        });
      }

      // ==========================================================
      // 3. VEHICLES (from Vehicles page)
      // ==========================================================
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("*");

      if (!vehiclesError && vehicles) {
        (vehicles as Vehicle[]).forEach((vehicle) => {
          // Check Istimara
          if (vehicle.istimara_expiry) {
            const expiryDate = new Date(vehicle.istimara_expiry);
            if (expiryDate < now) {
              allReminders.push({
                id: `vehicle-istimara-${vehicle.id}`,
                title: `🚨 Istimara Expired`,
                description: `Vehicle ${vehicle.plate_number} (${vehicle.vehicle_type}) - Istimara has expired`,
                priority: "overdue",
                dueDate: vehicle.istimara_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_ISTIMARA,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
              overdueCount++;
            } else if (expiryDate < thirtyDaysLater) {
              allReminders.push({
                id: `vehicle-istimara-upcoming-${vehicle.id}`,
                title: `🟡 Istimara Expiring Soon`,
                description: `Vehicle ${vehicle.plate_number} - Istimara expires on ${expiryDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: vehicle.istimara_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_ISTIMARA,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
            }
          }

          // Check Fahas
          if (vehicle.fahas_expiry) {
            const expiryDate = new Date(vehicle.fahas_expiry);
            if (expiryDate < now) {
              allReminders.push({
                id: `vehicle-fahas-${vehicle.id}`,
                title: `🚨 Fahas Expired`,
                description: `Vehicle ${vehicle.plate_number} - Fahas inspection has expired`,
                priority: "overdue",
                dueDate: vehicle.fahas_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_FAHAS,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
              overdueCount++;
            } else if (expiryDate < thirtyDaysLater) {
              allReminders.push({
                id: `vehicle-fahas-upcoming-${vehicle.id}`,
                title: `🟡 Fahas Expiring Soon`,
                description: `Vehicle ${vehicle.plate_number} - Fahas expires on ${expiryDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: vehicle.fahas_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_FAHAS,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
            }
          }

          // Check Insurance
          if (vehicle.insurance_expiry) {
            const expiryDate = new Date(vehicle.insurance_expiry);
            if (expiryDate < now) {
              allReminders.push({
                id: `vehicle-insurance-${vehicle.id}`,
                title: `🚨 Insurance Expired`,
                description: `Vehicle ${vehicle.plate_number} - Insurance has expired`,
                priority: "overdue",
                dueDate: vehicle.insurance_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_INSURANCE,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
              overdueCount++;
            } else if (expiryDate < thirtyDaysLater) {
              allReminders.push({
                id: `vehicle-insurance-upcoming-${vehicle.id}`,
                title: `🟡 Insurance Expiring Soon`,
                description: `Vehicle ${vehicle.plate_number} - Insurance expires on ${expiryDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: vehicle.insurance_expiry,
                category: REMINDER_CATEGORIES.VEHICLE_INSURANCE,
                relatedId: vehicle.id,
                relatedType: "vehicle",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/vehicles",
                actionLabel: "View Vehicle",
              });
            }
          }
        });
      }

      // ==========================================================
      // 4. EMPLOYEES (from Employees page)
      // ==========================================================
      const { data: employees, error: employeesError } = await supabase
        .from("employees")
        .select("*");

      if (!employeesError && employees) {
        (employees as Employee[]).forEach((employee) => {
          // Contract expiry
          if (employee.contract_expiry) {
            const expiryDate = new Date(employee.contract_expiry);
            if (expiryDate < now) {
              allReminders.push({
                id: `employee-contract-${employee.id}`,
                title: `🚨 Contract Expired`,
                description: `${employee.employee_name} (${employee.position}) - Contract has expired`,
                priority: "overdue",
                dueDate: employee.contract_expiry,
                category: REMINDER_CATEGORIES.EMPLOYEE_CONTRACT,
                relatedId: employee.id,
                relatedType: "employee",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/employees",
                actionLabel: "View Employee",
              });
              overdueCount++;
            } else if (expiryDate < thirtyDaysLater) {
              allReminders.push({
                id: `employee-contract-upcoming-${employee.id}`,
                title: `🟡 Contract Expiring Soon`,
                description: `${employee.employee_name}'s contract expires on ${expiryDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: employee.contract_expiry,
                category: REMINDER_CATEGORIES.EMPLOYEE_CONTRACT,
                relatedId: employee.id,
                relatedType: "employee",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/employees",
                actionLabel: "View Employee",
              });
            }
          }

          // Visa expiry
          if (employee.visa_expiry) {
            const expiryDate = new Date(employee.visa_expiry);
            if (expiryDate < now) {
              allReminders.push({
                id: `employee-visa-${employee.id}`,
                title: `🚨 Visa Expired`,
                description: `${employee.employee_name}'s visa has expired`,
                priority: "overdue",
                dueDate: employee.visa_expiry,
                category: REMINDER_CATEGORIES.EMPLOYEE_VISA,
                relatedId: employee.id,
                relatedType: "employee",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/employees",
                actionLabel: "View Employee",
              });
              overdueCount++;
            } else if (expiryDate < thirtyDaysLater) {
              allReminders.push({
                id: `employee-visa-upcoming-${employee.id}`,
                title: `🟡 Visa Expiring Soon`,
                description: `${employee.employee_name}'s visa expires on ${expiryDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: employee.visa_expiry,
                category: REMINDER_CATEGORIES.EMPLOYEE_VISA,
                relatedId: employee.id,
                relatedType: "employee",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/employees",
                actionLabel: "View Employee",
              });
            }
          }
        });
      }

      // ==========================================================
      // 5. CUSTOMER INVOICES (from Sales/Invoices page)
      // ==========================================================
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (customer_name)
        `)
        .neq("status", "paid");

      if (!invoicesError && invoices) {
        (invoices as any[]).forEach((invoice) => {
          const dueDate = new Date(invoice.due_date);
          const remaining = invoice.total_amount - (invoice.paid_amount || 0);
          const customerName = invoice.customers?.customer_name || "Unknown Customer";

          if (remaining > 0) {
            if (dueDate < now) {
              allReminders.push({
                id: `invoice-overdue-${invoice.id}`,
                title: `🚨 Invoice Overdue`,
                description: `Invoice #${invoice.invoice_number} for ${customerName} - SAR ${remaining.toFixed(2)} overdue`,
                priority: "overdue",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.INVOICE_OVERDUE,
                relatedId: invoice.id,
                relatedType: "invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/sales",
                actionLabel: "View Invoice",
              });
              overdueCount++;
            } else if (dueDate < sevenDaysLater) {
              allReminders.push({
                id: `invoice-upcoming-${invoice.id}`,
                title: `🟡 Invoice Due Soon`,
                description: `Invoice #${invoice.invoice_number} for ${customerName} - SAR ${remaining.toFixed(2)} due on ${dueDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.INVOICE_PENDING,
                relatedId: invoice.id,
                relatedType: "invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/sales",
                actionLabel: "View Invoice",
              });
            } else {
              allReminders.push({
                id: `invoice-pending-${invoice.id}`,
                title: `Invoice Pending`,
                description: `Invoice #${invoice.invoice_number} for ${customerName} - SAR ${remaining.toFixed(2)} pending`,
                priority: "info",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.INVOICE_PENDING,
                relatedId: invoice.id,
                relatedType: "invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/sales",
                actionLabel: "View Invoice",
              });
            }
          }
        });
      }

      // ==========================================================
      // 6. PURCHASE INVOICES (from Purchases page)
      // ==========================================================
      const { data: purchaseInvoices, error: purchaseInvoicesError } = await supabase
        .from("purchase_invoices")
        .select(`
          *,
          suppliers (supplier_name)
        `)
        .neq("status", "paid");

      if (!purchaseInvoicesError && purchaseInvoices) {
        (purchaseInvoices as any[]).forEach((invoice) => {
          const dueDate = new Date(invoice.due_date);
          const remaining = invoice.total_amount - (invoice.paid_amount || 0);
          const supplierName = invoice.suppliers?.supplier_name || "Unknown Supplier";

          if (remaining > 0) {
            if (dueDate < now) {
              allReminders.push({
                id: `purchase-invoice-overdue-${invoice.id}`,
                title: `🚨 Supplier Invoice Overdue`,
                description: `Supplier Invoice #${invoice.invoice_number} from ${supplierName} - SAR ${remaining.toFixed(2)} overdue`,
                priority: "overdue",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.PURCHASE_INVOICE_OVERDUE,
                relatedId: invoice.id,
                relatedType: "purchase_invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/purchases",
                actionLabel: "View Purchase",
              });
              overdueCount++;
            } else if (dueDate < sevenDaysLater) {
              allReminders.push({
                id: `purchase-invoice-upcoming-${invoice.id}`,
                title: `🟡 Supplier Invoice Due Soon`,
                description: `Supplier Invoice #${invoice.invoice_number} from ${supplierName} - SAR ${remaining.toFixed(2)} due on ${dueDate.toLocaleDateString()}`,
                priority: "upcoming",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.PURCHASE_INVOICE_PENDING,
                relatedId: invoice.id,
                relatedType: "purchase_invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/purchases",
                actionLabel: "View Purchase",
              });
            } else {
              allReminders.push({
                id: `purchase-invoice-pending-${invoice.id}`,
                title: `Supplier Invoice Pending`,
                description: `Supplier Invoice #${invoice.invoice_number} from ${supplierName} - SAR ${remaining.toFixed(2)} pending`,
                priority: "info",
                dueDate: invoice.due_date,
                category: REMINDER_CATEGORIES.PURCHASE_INVOICE_PENDING,
                relatedId: invoice.id,
                relatedType: "purchase_invoice",
                isRead: false,
                isDismissed: false,
                createdAt: new Date().toISOString(),
                actionLink: "/purchases",
                actionLabel: "View Purchase",
              });
            }
          }
        });
      }

      // ==========================================================
      // SORT AND SAVE REMINDERS
      // ==========================================================
      
      // Sort: overdue first, then upcoming, then info
      const sortedReminders = allReminders.sort((a, b) => {
        const priorityOrder = { overdue: 0, upcoming: 1, info: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      setReminders(sortedReminders);
      setLastChecked(new Date().toLocaleString());

      // Update stats
      const statsData = {
        overdue: sortedReminders.filter((r) => r.priority === "overdue").length,
        upcoming: sortedReminders.filter((r) => r.priority === "upcoming").length,
        info: sortedReminders.filter((r) => r.priority === "info").length,
        total: sortedReminders.length,
      };
      setStats(statsData);

      // Play sound if there are overdue reminders
      if (statsData.overdue > 0) {
        playNotificationSound();
      }

    } catch (error) {
      console.error("Error loading reminders:", error);
    } finally {
      setLoading(false);
    }
  }, [playNotificationSound]);

  /* ==========================================================
     LOAD ON MOUNT & REFRESH
  ========================================================== */

  useEffect(() => {
    fetchAllData();

    // Refresh every 2 minutes (more frequent for real-time updates)
    const interval = setInterval(fetchAllData, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAllData]);

  /* ==========================================================
     ACTIONS
  ========================================================== */

  const dismissReminder = useCallback(async (id: string) => {
    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.id === id ? { ...reminder, isDismissed: true } : reminder
      )
    );
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.id === id ? { ...reminder, isRead: true } : reminder
      )
    );
  }, []);

  const dismissAll = useCallback(async () => {
    if (window.confirm("Dismiss all reminders?")) {
      setReminders((prev) =>
        prev.map((reminder) => ({ ...reminder, isDismissed: true }))
      );
    }
  }, []);

  const navigateToAction = useCallback((link: string) => {
    navigate(link);
  }, [navigate]);

  /* ==========================================================
     FILTERED REMINDERS
  ========================================================== */

  const getFilteredReminders = useCallback(() => {
    const activeReminders = reminders.filter((r) => !r.isDismissed);

    let filtered = activeReminders;

    if (filter !== "all") {
      filtered = filtered.filter((r) => r.priority === filter);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter((r) => r.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [reminders, filter, selectedCategory, searchTerm]);

  const getCategories = useCallback(() => {
    const categories = new Set<string>();
    reminders.forEach((r) => {
      if (!r.isDismissed) {
        categories.add(r.category);
      }
    });
    return Array.from(categories);
  }, [reminders]);

  /* ==========================================================
     STYLES
  ========================================================== */

  const getPriorityColor = (priority: ReminderPriority): string => {
    switch (priority) {
      case "overdue": return "#ef4444";
      case "upcoming": return "#f59e0b";
      case "info": return "#3b82f6";
      default: return "#64748b";
    }
  };

  const getPriorityBgColor = (priority: ReminderPriority): string => {
    switch (priority) {
      case "overdue": return "#450a0a";
      case "upcoming": return "#451a03";
      case "info": return "#0b1220";
      default: return "#111827";
    }
  };

  const getPriorityEmoji = (priority: ReminderPriority): string => {
    switch (priority) {
      case "overdue": return "🔴";
      case "upcoming": return "🟡";
      case "info": return "🔵";
      default: return "⚪";
    }
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 10px",
    backgroundColor: "#0b1220",
    color: "#ffffff",
    border: "1px solid #334155",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "12px",
    outline: "none",
  };

  const sectionStyle: CSSProperties = {
    backgroundColor: "#111827",
    border: "1px solid #263548",
    borderRadius: "10px",
    padding: "17px",
    marginBottom: "15px",
  };

  const buttonStyle: CSSProperties = {
    border: "none",
    borderRadius: "6px",
    padding: "8px 13px",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "11px",
  };

  /* ==========================================================
     RETURN
  ========================================================== */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "18px",
        boxSizing: "border-box",
        background: "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#22d3ee", fontSize: "25px", fontWeight: 800 }}>
            🔔 REMINDER CENTER
          </h1>
          <div style={{ marginTop: "3px", color: "#64748b", fontSize: "11px" }}>
            Centralized reminders from all ERP modules
          </div>
          <div style={{ marginTop: "2px", color: "#4b5563", fontSize: "10px" }}>
            Last checked: {lastChecked || "Never"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
          <button
            onClick={fetchAllData}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "⏳ Loading..." : "↻ Refresh"}
          </button>

          <button
            onClick={dismissAll}
            style={{
              ...buttonStyle,
              backgroundColor: "#7f1d1d",
            }}
          >
            Dismiss All
          </button>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#94a3b8",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={playSound}
              onChange={(e) => setPlaySound(e.target.checked)}
            />
            🔔 Sound
          </label>
        </div>
      </div>

      {/* STATS CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #263548",
            borderLeft: "3px solid #ef4444",
            borderRadius: "8px",
            padding: "11px",
          }}
        >
          <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700 }}>
            🔴 Overdue
          </div>
          <div style={{ color: "#ef4444", fontSize: "22px", fontWeight: 800 }}>
            {stats.overdue}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #263548",
            borderLeft: "3px solid #f59e0b",
            borderRadius: "8px",
            padding: "11px",
          }}
        >
          <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700 }}>
            🟡 Upcoming
          </div>
          <div style={{ color: "#f59e0b", fontSize: "22px", fontWeight: 800 }}>
            {stats.upcoming}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #263548",
            borderLeft: "3px solid #3b82f6",
            borderRadius: "8px",
            padding: "11px",
          }}
        >
          <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700 }}>
            🔵 Information
          </div>
          <div style={{ color: "#3b82f6", fontSize: "22px", fontWeight: 800 }}>
            {stats.info}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #263548",
            borderLeft: "3px solid #22d3ee",
            borderRadius: "8px",
            padding: "11px",
          }}
        >
          <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700 }}>
            📊 Total
          </div>
          <div style={{ color: "#22d3ee", fontSize: "22px", fontWeight: 800 }}>
            {stats.total}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div
        style={{
          ...sectionStyle,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "11px",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "5px", color: "#94a3b8", fontSize: "10px", fontWeight: 700 }}>
            PRIORITY
          </label>
          <select
            style={inputStyle}
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All Priorities</option>
            <option value="overdue">🔴 Overdue</option>
            <option value="upcoming">🟡 Upcoming</option>
            <option value="info">🔵 Information</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", color: "#94a3b8", fontSize: "10px", fontWeight: 700 }}>
            CATEGORY
          </label>
          <select
            style={inputStyle}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {getCategories().map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "5px", color: "#94a3b8", fontSize: "10px", fontWeight: 700 }}>
            SEARCH
          </label>
          <input
            style={inputStyle}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reminders..."
          />
        </div>
      </div>

      {/* REMINDERS LIST */}
      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ margin: 0, color: "#60a5fa", fontSize: "16px" }}>
            REMINDERS
          </h2>
          <span style={{ color: "#64748b", fontSize: "10px" }}>
            {getFilteredReminders().length} active reminders
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            Loading reminders...
          </div>
        ) : getFilteredReminders().length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            🎉 No active reminders found
            <div style={{ fontSize: "11px", marginTop: "6px", color: "#4b5563" }}>
              {searchTerm || selectedCategory !== "all"
                ? "Try changing your filters"
                : "Everything is up to date!"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {getFilteredReminders().map((reminder) => (
              <div
                key={reminder.id}
                style={{
                  backgroundColor: getPriorityBgColor(reminder.priority),
                  border: `1px solid ${getPriorityColor(reminder.priority)}`,
                  borderRadius: "8px",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                  opacity: reminder.isRead ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flex: 1,
                    minWidth: "200px",
                  }}
                >
                  <div style={{ fontSize: "20px" }}>
                    {getPriorityEmoji(reminder.priority)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                      {reminder.title}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                      {reminder.description}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "4px",
                        fontSize: "10px",
                        color: "#64748b",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>📂 {reminder.category}</span>
                      {reminder.dueDate && (
                        <span>📅 {new Date(reminder.dueDate).toLocaleDateString()}</span>
                      )}
                      <span
                        style={{
                          color: getPriorityColor(reminder.priority),
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {reminder.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {reminder.actionLink && (
                    <button
                      onClick={() => navigateToAction(reminder.actionLink!)}
                      style={{
                        ...buttonStyle,
                        backgroundColor: "#1e3a5f",
                        fontSize: "10px",
                        padding: "4px 10px",
                      }}
                    >
                      {reminder.actionLabel || "View"}
                    </button>
                  )}
                  {!reminder.isRead && (
                    <button
                      onClick={() => markAsRead(reminder.id)}
                      style={{
                        ...buttonStyle,
                        backgroundColor: "#164e63",
                        fontSize: "10px",
                        padding: "4px 10px",
                      }}
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => dismissReminder(reminder.id)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: "#7f1d1d",
                      fontSize: "10px",
                      padding: "4px 10px",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   EXPORT
============================================================ */

export default ReminderCenter;