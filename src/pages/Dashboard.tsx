import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type DashboardData = {
  totalSalesQty: number;
  totalSalesAmount: number;
  totalPurchaseQty: number;
  totalPurchaseAmount: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalItems: number;
  totalVehicles: number;
  totalEmployees: number;
  totalPartners: number;
  totalExpenses: number;
  totalExpensesAmount: number;
  totalDrivers: number;
  totalBranches: number;
  pendingInvoices: number;
  lowStockItems: number;
  todaySales: number;
  todaySalesAmount: number;
  monthSales: number;
  monthSalesAmount: number;
  monthPurchases: number;
  monthPurchasesAmount: number;
  monthExpenses: number;
  monthExpensesAmount: number;
  monthProfit: number;
  totalProfit: number;
};

type RecentSaleRow = {
  id: number;
  sales_date: string | null;
  customer_name: string | null;
  total_amount: number | null;
  quantity: number | null;
};

type RecentPurchaseRow = {
  id: number;
  purchase_date: string | null;
  supplier_name: string | null;
  total_amount: number | null;
  quantity: number | null;
};

const emptyStats: DashboardData = {
  totalSalesQty: 0,
  totalSalesAmount: 0,
  totalPurchaseQty: 0,
  totalPurchaseAmount: 0,
  totalCustomers: 0,
  totalSuppliers: 0,
  totalItems: 0,
  totalVehicles: 0,
  totalEmployees: 0,
  totalPartners: 0,
  totalExpenses: 0,
  totalExpensesAmount: 0,
  totalDrivers: 0,
  totalBranches: 0,
  pendingInvoices: 0,
  lowStockItems: 0,
  todaySales: 0,
  todaySalesAmount: 0,
  monthSales: 0,
  monthSalesAmount: 0,
  monthPurchases: 0,
  monthPurchasesAmount: 0,
  monthExpenses: 0,
  monthExpensesAmount: 0,
  monthProfit: 0,
  totalProfit: 0,
};

const currency = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardData>(emptyStats);
  const [recentSales, setRecentSales] = useState<RecentSaleRow[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchaseRow[]>([]);

  useEffect(() => {
    void loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [
        salesResult,
        purchasesResult,
        expensesResult,
        customersResult,
        suppliersResult,
        itemsResult,
        vehiclesResult,
        employeesResult,
        partnersResult,
        driversResult,
        branchesResult,
        pendingInvoicesResult,
        recentSalesResult,
        recentPurchasesResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("quantity,total_amount,sales_date,invoice_status"),
        supabase
          .from("purchases")
          .select("quantity,total_amount,purchase_date"),
        supabase
          .from("expenses")
          .select("total_amount,expense_date"),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("suppliers").select("id", { count: "exact", head: true }),
        supabase
          .from("items")
          .select("current_stock,min_stock_level", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("invoice_status", "PENDING"),
        supabase
          .from("sales")
          .select("id,sales_date,customer_name,total_amount,quantity")
          .order("id", { ascending: false })
          .limit(5),
        supabase
          .from("purchases")
          .select("id,purchase_date,supplier_name,total_amount,quantity")
          .order("id", { ascending: false })
          .limit(5),
      ]);

      const salesData = salesResult.data ?? [];
      const purchasesData = purchasesResult.data ?? [];
      const expensesData = expensesResult.data ?? [];
      const lowStockItems = (itemsResult.data ?? []).filter(
        (item) => (item.current_stock ?? 0) <= (item.min_stock_level ?? 0)
      ).length;

      const totalSalesQty = salesData.reduce(
        (sum, row) => sum + (row.quantity ?? 0),
        0
      );
      const totalSalesAmount = salesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );
      const totalPurchaseQty = purchasesData.reduce(
        (sum, row) => sum + (row.quantity ?? 0),
        0
      );
      const totalPurchaseAmount = purchasesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );
      const totalExpensesAmount = expensesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );

      const todaySalesData = salesData.filter((row) => row.sales_date === today);
      const monthSalesData = salesData.filter(
        (row) => (row.sales_date ?? "") >= monthStartStr
      );
      const monthPurchasesData = purchasesData.filter(
        (row) => (row.purchase_date ?? "") >= monthStartStr
      );
      const monthExpensesData = expensesData.filter(
        (row) => (row.expense_date ?? "") >= monthStartStr
      );

      const todaySalesAmount = todaySalesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );
      const monthSalesAmount = monthSalesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );
      const monthPurchasesAmount = monthPurchasesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );
      const monthExpensesAmount = monthExpensesData.reduce(
        (sum, row) => sum + (row.total_amount ?? 0),
        0
      );

      setStats({
        totalSalesQty,
        totalSalesAmount,
        totalPurchaseQty,
        totalPurchaseAmount,
        totalCustomers: customersResult.count ?? 0,
        totalSuppliers: suppliersResult.count ?? 0,
        totalItems: itemsResult.count ?? 0,
        totalVehicles: vehiclesResult.count ?? 0,
        totalEmployees: employeesResult.count ?? 0,
        totalPartners: partnersResult.count ?? 0,
        totalExpenses: expensesData.length,
        totalExpensesAmount,
        totalDrivers: driversResult.count ?? 0,
        totalBranches: branchesResult.count ?? 0,
        pendingInvoices: pendingInvoicesResult.count ?? 0,
        lowStockItems,
        todaySales: todaySalesData.reduce(
          (sum, row) => sum + (row.quantity ?? 0),
          0
        ),
        todaySalesAmount,
        monthSales: monthSalesData.reduce(
          (sum, row) => sum + (row.quantity ?? 0),
          0
        ),
        monthSalesAmount,
        monthPurchases: monthPurchasesData.reduce(
          (sum, row) => sum + (row.quantity ?? 0),
          0
        ),
        monthPurchasesAmount,
        monthExpenses: monthExpensesData.length,
        monthExpensesAmount,
        monthProfit: monthSalesAmount - monthPurchasesAmount - monthExpensesAmount,
        totalProfit: totalSalesAmount - totalPurchaseAmount - totalExpensesAmount,
      });

      setRecentSales((recentSalesResult.data ?? []) as RecentSaleRow[]);
      setRecentPurchases((recentPurchasesResult.data ?? []) as RecentPurchaseRow[]);
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { label: "Sales Qty", value: stats.totalSalesQty.toLocaleString(), note: "All time", color: "blue" },
    { label: "Sales Amount", value: `SAR ${currency.format(stats.totalSalesAmount)}`, note: "All time", color: "teal" },
    { label: "Purchase Qty", value: stats.totalPurchaseQty.toLocaleString(), note: "All time", color: "amber" },
    { label: "Purchase Amount", value: `SAR ${currency.format(stats.totalPurchaseAmount)}`, note: "All time", color: "rose" },
    { label: "Profit", value: `SAR ${currency.format(stats.totalProfit)}`, note: "All time", color: stats.totalProfit >= 0 ? "green" : "red" },
    { label: "Customers", value: stats.totalCustomers.toLocaleString(), note: "Records", color: "violet" },
    { label: "Suppliers", value: stats.totalSuppliers.toLocaleString(), note: "Records", color: "orange" },
    { label: "Low Stock", value: stats.lowStockItems.toLocaleString(), note: "Items to review", color: "slate" },
  ];

  const quickLinks = [
    { label: "Sales", path: "/sales" },
    { label: "Purchases", path: "/purchases" },
    { label: "Items", path: "/items" },
    { label: "Stock", path: "/stock" },
    { label: "Customers", path: "/customers" },
    { label: "Suppliers", path: "/suppliers" },
    { label: "Expenses", path: "/expenses" },
    { label: "Reports", path: "/reports" },
  ];

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">AL SHAMS ERP</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Flat, fast overview with the minimum data needed for daily work.</p>
        </div>

        <button className="button button-primary" onClick={() => void loadDashboardData()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <section className="section-card">
        <div className="section-head">
          <h2>Quick Stats</h2>
          <span>{stats.pendingInvoices} pending invoices</span>
        </div>

        <div className="card-grid">
          {cards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="metric-card"
              data-tone={card.color}
              onClick={() => navigate(card.label === "Customers" ? "/customers" : card.label === "Suppliers" ? "/suppliers" : card.label === "Low Stock" ? "/stock" : card.label === "Profit" ? "/reports" : card.label === "Sales Qty" || card.label === "Sales Amount" ? "/sales" : "/purchases")}
            >
              <span className="metric-label">{card.label}</span>
              <strong className="metric-value">{card.value}</strong>
              <span className="metric-note">{card.note}</span>
            </button>
          ))}
        </div>

        <div className="summary-row">
          <div className="summary-pill">Today sales: {stats.todaySales.toLocaleString()} units</div>
          <div className="summary-pill">Today amount: SAR {currency.format(stats.todaySalesAmount)}</div>
          <div className="summary-pill">Month profit: SAR {currency.format(stats.monthProfit)}</div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-head">
          <h2>Quick Links</h2>
          <span>{stats.totalItems.toLocaleString()} items</span>
        </div>

        <div className="quick-link-grid">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              className="quick-link"
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
      </section>

      <div className="split-grid">
        <section className="section-card">
          <div className="section-head">
            <h2>Recent Sales</h2>
            <span>{recentSales.length} rows</span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">No recent sales.</td>
                  </tr>
                ) : (
                  recentSales.map((row) => (
                    <tr key={row.id}>
                      <td>{row.sales_date ?? "-"}</td>
                      <td>{row.customer_name ?? "-"}</td>
                      <td>{(row.quantity ?? 0).toLocaleString()}</td>
                      <td>SAR {currency.format(row.total_amount ?? 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-card">
          <div className="section-head">
            <h2>Recent Purchases</h2>
            <span>{recentPurchases.length} rows</span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">No recent purchases.</td>
                  </tr>
                ) : (
                  recentPurchases.map((row) => (
                    <tr key={row.id}>
                      <td>{row.purchase_date ?? "-"}</td>
                      <td>{row.supplier_name ?? "-"}</td>
                      <td>{(row.quantity ?? 0).toLocaleString()}</td>
                      <td>SAR {currency.format(row.total_amount ?? 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
