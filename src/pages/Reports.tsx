import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const COMPANY_NAME = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";
const COMPANY_CR_NUMBER = "1011142013";
const COMPANY_VAT_NUMBER = "310208502500003";
const COMPANY_ADDRESS = "Riyadh, Kingdom of Saudi Arabia";
const COMPANY_PHONE = "+966 5X XXX XXXX";

const VAT_CATEGORIES = [
  { value: "OUTPUT VAT - SALES", label: "Sales — Output VAT" },
  { value: "INPUT VAT - PURCHASES", label: "Purchases — Input VAT" },
  { value: "INPUT VAT - EXPENSES", label: "Expenses — Input VAT" },
  { value: "INPUT VAT - DRIVER DIESEL", label: "Driver Diesel — Input VAT" },
];

const EXPENSE_CATEGORIES = [
  "RENT", "ELECTRICITY", "WATER", "TELEPHONE", "FOOD", "MAINTENANCE",
  "OFFICE", "TRANSPORT", "FUEL", "REPAIRS", "SALARIES", "GOVERNMENT FEES", "OTHER EXPENSES",
];

const PAYMENT_STATUSES = ["PAID", "PENDING", "PARTIAL", "CREDIT", "CASH", "BANK"];

type ReportType = "sales" | "purchases" | "expenses" | "vat";
type Branch = { id: string; branch_name: string };
type Customer = { id: number; customer_name: string };
type Item = { id: number; item_name: string; unit?: string | null };
type Driver = { id: number; driver_name: string };

type Sale = {
  id: number; sales_date?: string | null; delivery_note_no?: string | null; customer_name?: string | null;
  item_id?: number | null; driver_name?: string | null; quantity?: number | null; unit_price?: number | null;
  vat_percent?: number | null; total_amount?: number | null; payment_type?: string | null; branch_id?: string | null;
  invoice_status?: string | null; invoice_number?: string | null; erp_invoice_number?: string | null; notes?: string | null;
  description?: string | null; sales_description?: string | null; [key: string]: unknown;
};

type Purchase = {
  id: number; purchase_date?: string | null; invoice_number?: string | null; document_number?: string | null;
  supplier_name?: string | null; item_id?: number | null; branch_id?: string | null; quantity?: number | null;
  unit_price?: number | null; vat_percent?: number | null; total_amount?: number | null; payment_method?: string | null;
  payment_type?: string | null; payment_status?: string | null; category?: string | null; notes?: string | null;
  [key: string]: unknown;
};

type Expense = {
  id: number; expense_date?: string | null; branch_id?: string | null; category?: string | null;
  person_vendor?: string | null; amount?: number | null; vat_applicable?: boolean | null; vat_rate?: number | null;
  vat_amount?: number | null; total_amount?: number | null; payment_method?: string | null;
  payment_status?: string | null; notes?: string | null; [key: string]: unknown;
};

type DriverExpense = {
  id: number; expense_date?: string | null; expense_type?: string | null; vehicle?: string | null;
  supplier_name?: string | null; invoice_number?: string | null; item_description?: string | null;
  quantity?: number | null; total_amount?: number | null; vat_rate?: number | null; vat_amount?: number | null;
  amount_before_vat?: number | null; notes?: string | null; [key: string]: unknown;
};

type ReportRow = {
  id: string; date: string; reference: string; party: string; vatNumber: string; item: string; driver: string;
  branch: string; category: string; paymentStatus: string; quantity: number; unitPrice: number; vatPercent: number;
  vatAmount: number; taxableAmount: number; totalAmount: number; notes: string; direction: "input" | "output";
  deliveryNoteNo?: string; invoiceNo?: string; salesDescription?: string;
};

type ItemSummary = {
  itemName: string;
  quantity: number;
  totalAmount: number;
  vatAmount: number;
  taxableAmount: number;
  unit: string;
};

const EMPTY_FILTERS = {
  dateFrom: "",
  dateTo: "",
  branch: "",
  customer: "",
  supplier: "",
  item: "",
  driver: "",
  category: "",
  paymentStatus: "",
  search: "",
};
type Filters = typeof EMPTY_FILTERS;

function n(value: unknown): number { const x = Number(value); return Number.isFinite(x) ? x : 0; }
function money(value: unknown): string { return new Intl.NumberFormat("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n(value)); }
function qty(value: unknown): string { return new Intl.NumberFormat("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n(value)); }
function dateText(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function csv(value: unknown): string { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

function vatNumber(record: Record<string, unknown>): string {
  const keys = ["supplier_vat_number", "supplier_vat_no", "supplier_tax_number", "vat_number", "vat_no", "tax_number", "customer_vat_number"];
  for (const key of keys) if (record[key] != null && String(record[key]).trim()) return String(record[key]);
  return "-";
}

function calcAmounts(quantity: unknown, unitPrice: unknown, vatRate: unknown, storedTotal: unknown) {
  const q = n(quantity), unit = n(unitPrice), rate = n(vatRate), stored = n(storedTotal);
  const base = q * unit;
  if (rate <= 0) return { taxable: base, vat: 0, total: stored || base };
  const expectedVat = base * rate / 100;
  const expectedTotal = base + expectedVat;
  if (stored > 0 && Math.abs(stored - expectedTotal) < 0.01) return { taxable: base, vat: stored - base, total: stored };
  if (stored > base) { const taxable = stored / (1 + rate / 100); return { taxable, vat: stored - taxable, total: stored }; }
  return { taxable: base, vat: expectedVat, total: expectedTotal };
}

function getText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) if (record[key] != null && String(record[key]).trim()) return String(record[key]);
  return "-";
}

function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [vatCategories, setVatCategories] = useState<string[]>(VAT_CATEGORIES.map(x => x.value));
  const [vatMenuOpen, setVatMenuOpen] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [driverExpenses, setDriverExpenses] = useState<DriverExpense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadReportData(); }, []);

  async function loadReportData() {
    try {
      setLoading(true); setError("");
      const results = await Promise.all([
        supabase.from("sales").select("*").order("sales_date", { ascending: false }),
        supabase.from("purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("driver_expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("branches").select("*").order("branch_name"),
        supabase.from("customers").select("*").order("customer_name"),
        supabase.from("items").select("*").order("item_name"),
        supabase.from("drivers").select("*").order("driver_name"),
      ]);
      const [sr, pr, er, dr, br, cr, ir, rr] = results;
      if (sr.error) throw new Error(`Sales: ${sr.error.message}`);
      if (pr.error) throw new Error(`Purchases: ${pr.error.message}`);
      if (er.error) throw new Error(`Expenses: ${er.error.message}`);
      if (dr.error) throw new Error(`Driver Diesel: ${dr.error.message}`);
      if (br.error) throw new Error(`Branches: ${br.error.message}`);
      if (cr.error) throw new Error(`Customers: ${cr.error.message}`);
      if (ir.error) throw new Error(`Items: ${ir.error.message}`);
      if (rr.error) throw new Error(`Drivers: ${rr.error.message}`);
      setSales((sr.data || []) as Sale[]); setPurchases((pr.data || []) as Purchase[]);
      setExpenses((er.data || []) as Expense[]); setDriverExpenses((dr.data || []) as DriverExpense[]);
      setBranches((br.data || []).map((x: any) => ({ id: String(x.id), branch_name: x.branch_name || x.name || "-" })));
      setCustomers((cr.data || []) as Customer[]); setItems((ir.data || []) as Item[]); setDrivers((rr.data || []) as Driver[]);
    } catch (e) {
      console.error(e); setError(e instanceof Error ? e.message : "Unable to load report data.");
    } finally { setLoading(false); }
  }

  const branchName = (id?: string | null) => branches.find(x => String(x.id) === String(id))?.branch_name || "-";
  const itemName = (id?: number | null) => items.find(x => Number(x.id) === Number(id))?.item_name || (id ? `Item #${id}` : "-");
  const itemUnit = (id?: number | null) => items.find(x => Number(x.id) === Number(id))?.unit || "PCS";

  const salesRows = useMemo<ReportRow[]>(() => sales.map(s => {
    const a = calcAmounts(s.quantity, s.unit_price, s.vat_percent, s.total_amount);
    return { 
      id: `sale-${s.id}`, 
      date: s.sales_date || "", 
      reference: getText(s, ["erp_invoice_number", "invoice_number", "delivery_note_no"]) || `SALE-${s.id}`,
      deliveryNoteNo: s.delivery_note_no || "-",
      invoiceNo: s.erp_invoice_number || s.invoice_number || "-",
      salesDescription: s.sales_description || s.description || "",
      party: s.customer_name || "-", 
      vatNumber: vatNumber(s), 
      item: itemName(s.item_id), 
      driver: s.driver_name || "-", 
      branch: branchName(s.branch_id),
      category: "OUTPUT VAT - SALES", 
      paymentStatus: s.payment_type || s.invoice_status || "-", 
      quantity: n(s.quantity), 
      unitPrice: n(s.unit_price), 
      vatPercent: n(s.vat_percent),
      vatAmount: a.vat, 
      taxableAmount: a.taxable, 
      totalAmount: a.total, 
      notes: s.notes || s.description || s.sales_description || "", 
      direction: "output" 
    };
  }), [sales, branches, items]);

  const purchaseRows = useMemo<ReportRow[]>(() => purchases.map(p => {
    const a = calcAmounts(p.quantity, p.unit_price, p.vat_percent, p.total_amount);
    return { 
      id: `purchase-${p.id}`, 
      date: p.purchase_date || "", 
      reference: p.invoice_number || p.document_number || `PUR-${p.id}`,
      deliveryNoteNo: "-",
      invoiceNo: p.invoice_number || "-",
      salesDescription: p.category || "",
      party: p.supplier_name || "-", 
      vatNumber: vatNumber(p), 
      item: itemName(p.item_id), 
      driver: "-", 
      branch: branchName(p.branch_id), 
      category: "INPUT VAT - PURCHASES",
      paymentStatus: p.payment_status || p.payment_method || p.payment_type || "-", 
      quantity: n(p.quantity), 
      unitPrice: n(p.unit_price), 
      vatPercent: n(p.vat_percent),
      vatAmount: a.vat, 
      taxableAmount: a.taxable, 
      totalAmount: a.total, 
      notes: p.notes || "", 
      direction: "input" 
    };
  }), [purchases, branches, items]);

  const expenseRows = useMemo<ReportRow[]>(() => expenses.map(e => {
    const amount = n(e.amount), vat = n(e.vat_amount), total = n(e.total_amount) || amount + vat;
    return { 
      id: `expense-${e.id}`, 
      date: e.expense_date || "", 
      reference: `EXP-${e.id}`,
      deliveryNoteNo: "-",
      invoiceNo: "-",
      salesDescription: e.category || "",
      party: e.person_vendor || "-", 
      vatNumber: vatNumber(e), 
      item: e.category || "-", 
      driver: "-",
      branch: branchName(e.branch_id), 
      category: "INPUT VAT - EXPENSES", 
      paymentStatus: e.payment_status || e.payment_method || "-", 
      quantity: 1, 
      unitPrice: amount,
      vatPercent: n(e.vat_rate), 
      vatAmount: vat, 
      taxableAmount: amount, 
      totalAmount: total, 
      notes: `${e.category || ""}${e.notes ? ` — ${e.notes}` : ""}`.trim(), 
      direction: "input" 
    };
  }), [expenses, branches]);

  const dieselRows = useMemo<ReportRow[]>(() => driverExpenses.map(d => {
    const total = n(d.total_amount); const vat = n(d.vat_amount); const taxable = n(d.amount_before_vat) || (total > vat ? total - vat : 0);
    return { 
      id: `diesel-${d.id}`, 
      date: d.expense_date || "", 
      reference: d.invoice_number || `DIESEL-${d.id}`,
      deliveryNoteNo: "-",
      invoiceNo: d.invoice_number || "-",
      salesDescription: d.item_description || d.expense_type || "Diesel",
      party: d.supplier_name || "-", 
      vatNumber: vatNumber(d),
      item: d.item_description || d.expense_type || "Diesel", 
      driver: d.vehicle || "-", 
      branch: "-", 
      category: "INPUT VAT - DRIVER DIESEL", 
      paymentStatus: "-",
      quantity: n(d.quantity) || 1, 
      unitPrice: taxable, 
      vatPercent: n(d.vat_rate), 
      vatAmount: vat, 
      taxableAmount: taxable, 
      totalAmount: total || taxable + vat, 
      notes: d.notes || "", 
      direction: "input" 
    };
  }), [driverExpenses]);

  const vatRows = useMemo(() => [...salesRows, ...purchaseRows, ...expenseRows, ...dieselRows], [salesRows, purchaseRows, expenseRows, dieselRows]);
  const activeRows = reportType === "sales" ? salesRows : reportType === "purchases" ? purchaseRows : reportType === "expenses" ? expenseRows : vatRows;

  const categories = useMemo(() => {
    if (reportType === "vat") return VAT_CATEGORIES.map(x => x.value);
    if (reportType === "expenses") return EXPENSE_CATEGORIES;
    return Array.from(new Set(activeRows.map(x => x.category))).sort();
  }, [reportType, activeRows]);

  const customerNames = useMemo(() => Array.from(new Set(sales.map(x => x.customer_name).filter(Boolean))).sort() as string[], [sales]);
  const supplierNames = useMemo(() => Array.from(new Set(purchases.map(x => x.supplier_name).filter(Boolean))).sort() as string[], [purchases]);
  const itemNames = useMemo(() => items.map(x => x.item_name).filter(Boolean).sort(), [items]);
  const driverNames = useMemo(() => drivers.map(x => x.driver_name).filter(Boolean).sort(), [drivers]);

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return activeRows.filter(row => {
      if (filters.dateFrom && row.date < filters.dateFrom) return false;
      if (filters.dateTo && row.date > filters.dateTo) return false;
      if (filters.branch && row.branch !== filters.branch) return false;
      if (reportType === "sales" && filters.customer && row.party !== filters.customer) return false;
      if (reportType === "purchases" && filters.supplier && row.party !== filters.supplier) return false;
      if (filters.item && row.item !== filters.item) return false;
      if (filters.driver && row.driver !== filters.driver) return false;
      if (reportType !== "vat" && filters.category && row.category !== filters.category) return false;
      if (reportType === "vat" && vatCategories.length && !vatCategories.includes(row.category)) return false;
      if (filters.paymentStatus && row.paymentStatus !== filters.paymentStatus) return false;
      if (search) {
        const hay = [row.reference, row.party, row.vatNumber, row.item, row.driver, row.branch, row.category, row.paymentStatus, row.notes].join(" ").toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [activeRows, filters, reportType, vatCategories]);

  const itemSummary = useMemo<ItemSummary[]>(() => {
    const map = new Map<string, { quantity: number; totalAmount: number; vatAmount: number; taxableAmount: number; unit: string }>();
    
    filteredRows.forEach(row => {
      const key = row.item;
      if (!map.has(key)) {
        map.set(key, { quantity: 0, totalAmount: 0, vatAmount: 0, taxableAmount: 0, unit: "PCS" });
      }
      const data = map.get(key)!;
      data.quantity += row.quantity;
      data.totalAmount += row.totalAmount;
      data.vatAmount += row.vatAmount;
      data.taxableAmount += row.taxableAmount;
    });

    return Array.from(map.entries())
      .map(([itemName, data]) => ({
        itemName,
        quantity: data.quantity,
        totalAmount: data.totalAmount,
        vatAmount: data.vatAmount,
        taxableAmount: data.taxableAmount,
        unit: data.unit,
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [filteredRows]);

  const totals = useMemo(() => filteredRows.reduce((a, r) => ({
    records: a.records + 1, quantity: a.quantity + n(r.quantity), taxable: a.taxable + n(r.taxableAmount), vat: a.vat + n(r.vatAmount), total: a.total + n(r.totalAmount),
  }), { records: 0, quantity: 0, taxable: 0, vat: 0, total: 0 }), [filteredRows]);

  const vatSummary = useMemo(() => {
    const selected = filteredRows.filter(r => vatCategories.includes(r.category));
    const output = selected.filter(r => r.direction === "output").reduce((s, r) => s + r.vatAmount, 0);
    const input = selected.filter(r => r.direction === "input").reduce((s, r) => s + r.vatAmount, 0);
    const sales = selected.filter(r => r.category === "OUTPUT VAT - SALES");
    const purchases = selected.filter(r => r.category === "INPUT VAT - PURCHASES");
    const expenses = selected.filter(r => r.category === "INPUT VAT - EXPENSES");
    const diesel = selected.filter(r => r.category === "INPUT VAT - DRIVER DIESEL");
    return {
      salesTotal: sales.reduce((s, r) => s + r.totalAmount, 0), salesReturned: 0, salesTaxable: sales.reduce((s, r) => s + r.taxableAmount, 0), salesVat: sales.reduce((s, r) => s + r.vatAmount, 0),
      purchaseTotal: purchases.reduce((s, r) => s + r.totalAmount, 0), purchaseTaxable: purchases.reduce((s, r) => s + r.taxableAmount, 0), purchaseVat: purchases.reduce((s, r) => s + r.vatAmount, 0),
      expenseTaxable: expenses.reduce((s, r) => s + r.taxableAmount, 0), expenseVat: expenses.reduce((s, r) => s + r.vatAmount, 0),
      dieselTaxable: diesel.reduce((s, r) => s + r.taxableAmount, 0), dieselVat: diesel.reduce((s, r) => s + r.vatAmount, 0),
      output, input, payable: output - input,
    };
  }, [filteredRows, vatCategories]);

  function title() { return reportType === "sales" ? "SALES REPORT" : reportType === "purchases" ? "PURCHASE REPORT" : reportType === "expenses" ? "EXPENSE REPORT" : "VAT REPORT"; }
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(p => ({ ...p, [key]: value })); }
  function clearFilters() { setFilters({ ...EMPTY_FILTERS }); setVatCategories(VAT_CATEGORIES.map(x => x.value)); }
  function changeReport(type: ReportType) { setReportType(type); setFilters({ ...EMPTY_FILTERS }); if (type === "vat") setVatCategories(VAT_CATEGORIES.map(x => x.value)); setVatMenuOpen(false); }
  function toggleVatCategory(value: string) { setVatCategories(p => p.includes(value) ? p.filter(x => x !== value) : [...p, value]); }
  function selectAllVat() { setVatCategories(VAT_CATEGORIES.map(x => x.value)); }
  function clearVatCategories() { setVatCategories([]); }

  function exportExcel() {
    try {
      setExporting(true);
      const summary = [
        [COMPANY_NAME], [COMPANY_NAME_AR], [`C.R: ${COMPANY_CR_NUMBER} | VAT: ${COMPANY_VAT_NUMBER}`], [COMPANY_ADDRESS], [],
        [title()], [`Period: ${filters.dateFrom || "Beginning"} → ${filters.dateTo || "Today"}`], [`Branch: ${filters.branch || "All Branches"}`], [],
        ["Total Records", totals.records], ["Total Quantity", totals.quantity], ["Taxable Amount", totals.taxable], ["VAT Amount", totals.vat], ["Total Amount", totals.total],
        ...(reportType === "vat" ? [["Selected VAT Categories", vatCategories.join(", ")], ["Output VAT", vatSummary.output], ["Input VAT", vatSummary.input], ["VAT Payable", vatSummary.payable]] : [])
      ];

      const detailHeaders = reportType === "sales" 
        ? ["S.No", "D/N No.", "Inv No.", "Date", "Item Description", "Customer", "Qty", "Price", "Total", "VAT %", "VAT Amount", "Total Amount", "Branch", "Payment Status"]
        : reportType === "vat"
        ? ["S.No", "Date", "VAT / Tax No.", "Name / Party", "Qty", "Total Amount", "VAT Amount", "Amount Without VAT", "VAT %", "Category"]
        : ["S.No", "Date", "Reference", "Item Description", "Party", "Qty", "Price", "Total", "VAT %", "VAT Amount", "Total Amount", "Branch", "Payment Status"];

      const detailRows = filteredRows.map((r, i) => {
        if (reportType === "sales") {
          return [
            i + 1,
            r.deliveryNoteNo || "-",
            r.invoiceNo || "-",
            dateText(r.date),
            (r.salesDescription || r.item).substring(0, 30),
            r.party,
            qty(r.quantity),
            money(r.unitPrice),
            money(r.quantity * r.unitPrice),
            `${r.vatPercent}%`,
            money(r.vatAmount),
            money(r.totalAmount),
            r.branch,
            r.paymentStatus,
          ];
        } else if (reportType === "vat") {
          return [
            i + 1,
            dateText(r.date),
            r.vatNumber,
            r.party,
            qty(r.quantity),
            money(r.totalAmount),
            money(r.vatAmount),
            money(r.taxableAmount),
            `${r.vatPercent}%`,
            r.category,
          ];
        }
        return [
          i + 1,
          dateText(r.date),
          r.reference,
          (r.salesDescription || r.item).substring(0, 30),
          r.party,
          qty(r.quantity),
          money(r.unitPrice),
          money(r.quantity * r.unitPrice),
          `${r.vatPercent}%`,
          money(r.vatAmount),
          money(r.totalAmount),
          r.branch,
          r.paymentStatus,
        ];
      });

      const itemHeaders = ["S.No", "Item Name", "Unit", "Total Qty", "Taxable Amount", "VAT Amount", "Total Amount"];
      const itemRows = itemSummary.map((item, i) => [
        i + 1,
        item.itemName,
        item.unit,
        qty(item.quantity),
        money(item.taxableAmount),
        money(item.vatAmount),
        money(item.totalAmount),
      ]);

      const wb = XLSX.utils.book_new();
      
      const ws1 = XLSX.utils.aoa_to_sheet(summary);
      const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
      const ws3 = XLSX.utils.aoa_to_sheet([["ITEM-WISE SUMMARY"], [], itemHeaders, ...itemRows, [], 
        ["GRAND TOTAL", "", "", qty(totals.quantity), money(totals.taxable), money(totals.vat), money(totals.total)]
      ]);

      ws1["!cols"] = [{ wch: 35 }, { wch: 32 }];
      ws2["!cols"] = detailHeaders.map(() => ({ wch: 18 }));
      ws3["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

      XLSX.utils.book_append_sheet(wb, ws1, "Summary");
      XLSX.utils.book_append_sheet(wb, ws2, "Details");
      XLSX.utils.book_append_sheet(wb, ws3, "Item Summary");

      XLSX.writeFile(wb, `${title().replace(/\s+/g, "_")}_${today()}.xlsx`);
    } catch (e) { console.error(e); alert("Unable to export Excel report."); } finally { setExporting(false); }
  }

  function exportCSV() {
    try {
      const headers = reportType === "sales" 
        ? ["S.No", "D/N No.", "Inv No.", "Date", "Item Description", "Customer", "Qty", "Price", "Total", "VAT %", "VAT Amount", "Total Amount", "Branch", "Payment Status"]
        : reportType === "vat"
        ? ["S.No", "Date", "VAT / Tax No.", "Name / Party", "Qty", "Total Amount", "VAT Amount", "Amount Without VAT", "VAT %", "Category"]
        : ["S.No", "Date", "Reference", "Item Description", "Party", "Qty", "Price", "Total", "VAT %", "VAT Amount", "Total Amount", "Branch", "Payment Status"];

      const rows = filteredRows.map((r, i) => {
        if (reportType === "sales") {
          return [
            i + 1, r.deliveryNoteNo || "-", r.invoiceNo || "-", dateText(r.date), (r.salesDescription || r.item).substring(0, 30),
            r.party, qty(r.quantity), money(r.unitPrice), money(r.quantity * r.unitPrice),
            `${r.vatPercent}%`, money(r.vatAmount), money(r.totalAmount), r.branch, r.paymentStatus
          ];
        } else if (reportType === "vat") {
          return [
            i + 1, dateText(r.date), r.vatNumber, r.party, qty(r.quantity),
            money(r.totalAmount), money(r.vatAmount), money(r.taxableAmount), `${r.vatPercent}%`, r.category
          ];
        }
        return [
          i + 1, dateText(r.date), r.reference, (r.salesDescription || r.item).substring(0, 30), r.party,
          qty(r.quantity), money(r.unitPrice), money(r.quantity * r.unitPrice),
          `${r.vatPercent}%`, money(r.vatAmount), money(r.totalAmount), r.branch, r.paymentStatus
        ];
      });

      const allRows = [headers.join(","), ...rows.map(r => r.map(csv).join(","))];
      const blob = new Blob([allRows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title().replace(/\s+/g, "_")}_${today()}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert("Unable to export CSV."); }
  }

  // ============================================================
  // PDF EXPORT - FULLY FIXED
  // ============================================================

  function exportPDF() {
    try {
      setExporting(true);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 12;
      const FOOTER_Y = H - 10;
      const BODY_BOTTOM = H - 20;
      let page = 0;

      const header = (continued = false) => {
        page += 1;
        let y = M;

        doc.setDrawColor(34, 211, 238);
        doc.setLineWidth(0.8);
        doc.line(M, y, W - M, y);
        y += 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(7, 17, 31);
        doc.text(COMPANY_NAME, W / 2, y + 5, { align: "center" });
        y += 9;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(COMPANY_NAME_AR, W / 2, y + 3, { align: "center" });
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`C.R: ${COMPANY_CR_NUMBER} | VAT: ${COMPANY_VAT_NUMBER} | ${COMPANY_ADDRESS} | Tel: ${COMPANY_PHONE}`, W / 2, y + 3, { align: "center" });
        y += 7;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(M, y, W - M, y);
        y += 7;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(20, 60, 120);
        doc.text(continued ? `${title()} (Continued)` : title(), W / 2, y + 4, { align: "center" });
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        const infoParts = [];
        if (filters.branch) infoParts.push(`Branch: ${filters.branch}`);
        infoParts.push(`Period: ${filters.dateFrom || "Beginning"} → ${filters.dateTo || "Today"}`);
        infoParts.push(`Generated: ${new Date().toLocaleString("en-SA")}`);
        doc.text(infoParts.join(" | "), W / 2, y + 3, { align: "center" });
        y += 7;

        doc.setDrawColor(34, 211, 238);
        doc.setLineWidth(0.5);
        doc.line(M, y, W - M, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${page}`, W - M, y - 1, { align: "right" });

        return y;
      };

      const footer = () => {
        doc.setDrawColor(190, 198, 208);
        doc.setLineWidth(0.25);
        doc.line(M + 3, FOOTER_Y - 3, W - M - 3, FOOTER_Y - 3);
        doc.setTextColor(100, 110, 120);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text(`${COMPANY_NAME} | ${title()}`, M + 4, FOOTER_Y);
        doc.text(`Generated ${new Date().toLocaleString("en-SA")}`, W - M - 4, FOOTER_Y, { align: "right" });
      };

      const newPage = (continued = true) => { footer(); doc.addPage(); return header(continued); };

      let y = header(false);

      // ==========================================================
      // SUMMARY SECTION
      // ==========================================================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 60, 120);
      doc.text("SUMMARY", M + 2, y);
      y += 5;

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(M + 2, y, W - M - 2, y);
      y += 5;

      const summaryItems = [
        ["Total Records", String(totals.records)],
        ["Total Quantity", qty(totals.quantity)],
        ["Taxable Amount", `SAR ${money(totals.taxable)}`],
        ["VAT Amount", `SAR ${money(totals.vat)}`],
        ["Total Amount", `SAR ${money(totals.total)}`],
      ];

      const gap = 5;
      const cardW = ((W - M * 2) - 10 - gap * 4) / 5;

      summaryItems.forEach((item, i) => {
        const xPos = M + 2 + i * (cardW + gap);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(xPos, y, cardW, 16, 2, 2, "F");
        doc.setDrawColor(220, 226, 232);
        doc.roundedRect(xPos, y, cardW, 16, 2, 2, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item[0], xPos + 3, y + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(20, 60, 120);
        doc.text(item[1], xPos + 3, y + 13);
      });

      y += 22;

      // ==========================================================
      // ITEM-WISE SUMMARY TABLE
      // ==========================================================
      if (itemSummary.length > 0) {
        if (y > BODY_BOTTOM - 50) y = newPage(true);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(20, 60, 120);
        doc.text("ITEM-WISE SUMMARY", M + 2, y);
        y += 5;

        const itemHeaders = ["S.No", "Item Name", "Unit", "Qty", "Taxable", "VAT", "Total"];
        const itemCols = [8, 65, 15, 20, 28, 28, 30];
        const itemTableW = itemCols.reduce((a, b) => a + b, 0);

        doc.setFillColor(20, 60, 120);
        doc.rect(M + 2, y, itemTableW, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        let posX = M + 2;
        itemHeaders.forEach((h, idx) => {
          doc.text(h, posX + 2, y + 5);
          posX += itemCols[idx];
        });
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(51, 65, 85);

        itemSummary.forEach((item, idx) => {
          if (y > BODY_BOTTOM - 20) y = newPage(true);
          const rowBg = idx % 2 === 0 ? 248 : 255;
          doc.setFillColor(rowBg, rowBg, rowBg);
          doc.rect(M + 2, y, itemTableW, 6, "F");
          posX = M + 2;
          const cells = [
            String(idx + 1), item.itemName, item.unit, qty(item.quantity),
            money(item.taxableAmount), money(item.vatAmount), money(item.totalAmount)
          ];
          cells.forEach((cell, j) => {
            doc.text(cell, posX + 2, y + 4.5);
            posX += itemCols[j];
          });
          y += 6;
        });

        doc.setFillColor(7, 17, 31);
        doc.rect(M + 2, y, itemTableW, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        posX = M + 2;
        const footerCells = ["TOTAL", "", "", qty(totals.quantity), money(totals.taxable), money(totals.vat), money(totals.total)];
        footerCells.forEach((cell, j) => {
          doc.text(cell, posX + 2, y + 5);
          posX += itemCols[j];
        });
        y += 9;
      }

      // ==========================================================
      // DETAILED TRANSACTIONS
      // ==========================================================
      doc.addPage();
      y = header(true);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 60, 120);
      doc.text("DETAILED TRANSACTIONS", M + 2, y);
      y += 5;

      const detailHeaders = reportType === "sales"
        ? ["S.No", "D/N", "Inv No.", "Date", "Item Description", "Customer", "Qty", "Price", "Total", "VAT%", "VAT Amt", "Total Amt", "Branch"]
        : reportType === "vat"
        ? ["S.No", "Date", "VAT / Tax No.", "Name / Party", "Qty", "Total Amount", "VAT Amount", "Amount Without VAT", "VAT %", "Category"]
        : ["S.No", "Date", "Reference", "Item Description", "Party", "Qty", "Price", "Total", "VAT%", "VAT Amt", "Total Amt", "Branch"];

      const detailCols = reportType === "sales"
        ? [8, 18, 22, 18, 32, 28, 12, 16, 18, 10, 18, 20, 20]
        : reportType === "vat"
        ? [8, 18, 22, 30, 12, 20, 20, 22, 10, 30]
        : [8, 18, 22, 32, 28, 12, 16, 18, 10, 18, 20, 20];

      const detailTableW = detailCols.reduce((a, b) => a + b, 0);

      const drawDetailHeader = () => {
        doc.setFillColor(20, 60, 120);
        doc.rect(M + 2, y, detailTableW, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        let posX = M + 2;
        detailHeaders.forEach((h, idx) => {
          doc.text(h, posX + 1.5, y + 4.5);
          posX += detailCols[idx];
        });
        y += 7;
      };

      drawDetailHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(51, 65, 85);

      filteredRows.forEach((r, idx) => {
        if (y > BODY_BOTTOM - 10) { y = newPage(true); drawDetailHeader(); }

        const rowBg = idx % 2 === 0 ? 248 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(M + 2, y, detailTableW, 6, "F");

        let posX = M + 2;
        let cells: string[];

        if (reportType === "sales") {
          cells = [
            String(idx + 1),
            r.deliveryNoteNo || "-",
            r.invoiceNo || "-",
            dateText(r.date),
            (r.salesDescription || r.item).substring(0, 20),
            r.party.substring(0, 18),
            qty(r.quantity),
            money(r.unitPrice),
            money(r.quantity * r.unitPrice),
            `${r.vatPercent}%`,
            money(r.vatAmount),
            money(r.totalAmount),
            r.branch,
          ];
        } else if (reportType === "vat") {
          cells = [
            String(idx + 1),
            dateText(r.date),
            r.vatNumber,
            r.party.substring(0, 18),
            qty(r.quantity),
            money(r.totalAmount),
            money(r.vatAmount),
            money(r.taxableAmount),
            `${r.vatPercent}%`,
            r.category.substring(0, 20),
          ];
        } else {
          cells = [
            String(idx + 1),
            dateText(r.date),
            r.reference.substring(0, 15),
            (r.salesDescription || r.item).substring(0, 20),
            r.party.substring(0, 18),
            qty(r.quantity),
            money(r.unitPrice),
            money(r.quantity * r.unitPrice),
            `${r.vatPercent}%`,
            money(r.vatAmount),
            money(r.totalAmount),
            r.branch,
          ];
        }

        cells.forEach((cell, j) => {
          doc.text(cell, posX + 1.5, y + 4.5);
          posX += detailCols[j];
        });
        y += 6;
      });

      // Grand Total Footer
      doc.setFillColor(7, 17, 31);
      doc.rect(M + 2, y, detailTableW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      let posX = M + 2;

      if (reportType === "sales") {
        const footerVals = ["GRAND", "TOTAL", "", "", "", "", qty(totals.quantity), "", money(totals.quantity * 1), "", money(totals.vat), money(totals.total), ""];
        footerVals.forEach((cell, j) => {
          doc.text(cell, posX + 1.5, y + 4.5);
          posX += detailCols[j] || 20;
        });
      } else if (reportType === "vat") {
        const footerVals = ["GRAND", "TOTAL", "", "", qty(totals.quantity), money(totals.total), money(totals.vat), money(totals.taxable), "", ""];
        footerVals.forEach((cell, j) => {
          doc.text(cell, posX + 1.5, y + 4.5);
          posX += detailCols[j] || 20;
        });
      } else {
        const footerVals = ["GRAND", "TOTAL", "", "", "", qty(totals.quantity), "", money(totals.quantity * 1), "", money(totals.vat), money(totals.total), ""];
        footerVals.forEach((cell, j) => {
          doc.text(cell, posX + 1.5, y + 4.5);
          posX += detailCols[j] || 20;
        });
      }
      y += 9;

      footer();
      doc.save(`${title().replace(/\s+/g, "_")}_${today()}.pdf`);
    } catch (e) {
      console.error("PDF EXPORT ERROR", e);
      alert(`Unable to export PDF report. ${e instanceof Error ? e.message : ""}`);
    } finally { setExporting(false); }
  }

  const showCustomer = reportType === "sales";
  const showSupplier = reportType === "purchases";
  const showItem = reportType === "sales" || reportType === "purchases";
  const showDriver = reportType === "sales";
  const showCategory = reportType !== "sales";
  const selectedCategoryLabel = vatCategories.length === VAT_CATEGORIES.length ? "All VAT Categories" : vatCategories.length === 0 ? "No VAT Categories" : `${vatCategories.length} VAT categories selected`;

  return <div style={pageStyle}>
    <div style={topBar}><div><div style={eyebrow}>AL SHAMS ERP</div><h1 style={h1}>Reports</h1><div style={subtitle}>Simple reports • powerful filters • clean exports</div></div><button style={refreshBtn} onClick={() => void loadReportData()} disabled={loading}>{loading ? "Loading..." : "↻ Refresh"}</button></div>
    {error && <div style={errorStyle}><b>Report loading error:</b> {error}</div>}

    <div style={tabsStyle}>{([["sales", "📈", "Sales"], ["purchases", "📦", "Purchases"], ["expenses", "💳", "Expenses"], ["vat", "🧾", "VAT"]] as const).map(([v, icon, label]) => <button key={v} onClick={() => changeReport(v)} style={reportType === v ? activeTabStyle : tabStyle}><span style={{ fontSize: 18 }}>{icon}</span>{label} Report</button>)}</div>

    <section style={panelStyle}>
      <div style={panelHead}><div><b style={{ fontSize: 16 }}>Filters</b><div style={{ color: "#718096", fontSize: 11, marginTop: 3 }}>Choose only what you need. VAT supports multiple categories.</div></div><button style={clearBtn} onClick={clearFilters}>Clear</button></div>
      <div style={filterGrid}>
        <Field label="Date From"><input type="date" value={filters.dateFrom} onChange={e => setFilter("dateFrom", e.target.value)} style={inputStyle}/></Field>
        <Field label="Date To"><input type="date" value={filters.dateTo} onChange={e => setFilter("dateTo", e.target.value)} style={inputStyle}/></Field>
        <Field label="Branch"><select value={filters.branch} onChange={e => setFilter("branch", e.target.value)} style={inputStyle}><option value="">All Branches</option>{branches.map(b => <option key={b.id} value={b.branch_name}>{b.branch_name}</option>)}</select></Field>
        {showCustomer && <Field label="Customer"><select value={filters.customer} onChange={e => setFilter("customer", e.target.value)} style={inputStyle}><option value="">All Customers</option>{customerNames.map(x => <option key={x}>{x}</option>)}</select></Field>}
        {showSupplier && <Field label="Supplier"><select value={filters.supplier} onChange={e => setFilter("supplier", e.target.value)} style={inputStyle}><option value="">All Suppliers</option>{supplierNames.map(x => <option key={x}>{x}</option>)}</select></Field>}
        {showItem && <Field label="Item"><select value={filters.item} onChange={e => setFilter("item", e.target.value)} style={inputStyle}><option value="">All Items</option>{itemNames.map(x => <option key={x}>{x}</option>)}</select></Field>}
        {showDriver && <Field label="Driver"><select value={filters.driver} onChange={e => setFilter("driver", e.target.value)} style={inputStyle}><option value="">All Drivers</option>{driverNames.map(x => <option key={x}>{x}</option>)}</select></Field>}
        {showCategory && reportType !== "vat" && <Field label="Category"><select value={filters.category} onChange={e => setFilter("category", e.target.value)} style={inputStyle}><option value="">All Categories</option>{categories.map(x => <option key={x}>{x}</option>)}</select></Field>}
        {reportType === "vat" && <Field label="VAT Categories"><div style={{ position: "relative" }}><button type="button" onClick={() => setVatMenuOpen(v => !v)} style={{ ...inputStyle, textAlign: "left", cursor: "pointer" }}>{selectedCategoryLabel} <span style={{ float: "right" }}>▾</span></button>{vatMenuOpen && <div style={multiMenuStyle}><div style={menuActions}><button onClick={selectAllVat} style={miniBtn}>Select all</button><button onClick={clearVatCategories} style={miniBtn}>Clear</button></div>{VAT_CATEGORIES.map(c => <label key={c.value} style={checkRow}><input type="checkbox" checked={vatCategories.includes(c.value)} onChange={() => toggleVatCategory(c.value)}/><span>{c.label}</span></label>)}</div>}</div></Field>}
        <Field label="Payment Status"><select value={filters.paymentStatus} onChange={e => setFilter("paymentStatus", e.target.value)} style={inputStyle}><option value="">All Payment Status</option>{PAYMENT_STATUSES.map(x => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Search"><input value={filters.search} onChange={e => setFilter("search", e.target.value)} placeholder="Invoice, supplier, item..." style={inputStyle}/></Field>
      </div>
    </section>

    <div style={actionBar}><button style={csvBtn} onClick={exportCSV} disabled={loading || exporting}>CSV</button><button style={excelBtn} onClick={exportExcel} disabled={loading || exporting}>Excel</button><button style={pdfBtn} onClick={exportPDF} disabled={loading || exporting}>{exporting ? "Preparing..." : "Export PDF"}</button></div>

    {reportType === "vat" && <section style={vatOverview}><div style={sectionTitle}>VAT SUMMARY</div><div style={summaryGrid}>
      <Summary title="Sales — Output VAT" value={`SAR ${money(vatSummary.salesVat)}`} note={`Taxable SAR ${money(vatSummary.salesTaxable)}`}/><Summary title="Purchases — Input VAT" value={`SAR ${money(vatSummary.purchaseVat)}`} note={`Taxable SAR ${money(vatSummary.purchaseTaxable)}`}/><Summary title="Expenses — Input VAT" value={`SAR ${money(vatSummary.expenseVat)}`} note={`Taxable SAR ${money(vatSummary.expenseTaxable)}`}/><Summary title="Driver Diesel — Input VAT" value={`SAR ${money(vatSummary.dieselVat)}`} note={`Taxable SAR ${money(vatSummary.dieselTaxable)}`}/><Summary title="Total Input VAT" value={`SAR ${money(vatSummary.input)}`} note="Purchases + expenses + diesel"/><Summary title="VAT Payable" value={`SAR ${money(vatSummary.payable)}`} note="Output VAT minus selected input VAT" strong/>
    </div></section>}

    <div style={summaryGrid}><Summary title="Records" value={String(totals.records)}/><Summary title="Quantity" value={qty(totals.quantity)}/><Summary title="Amount Without VAT" value={`SAR ${money(totals.taxable)}`}/><Summary title="VAT Amount" value={`SAR ${money(totals.vat)}`}/><Summary title="Total Amount" value={`SAR ${money(totals.total)}`} strong/></div>

    <section style={panelStyle}>
      <div style={panelHead}><div><b style={{ fontSize: 15 }}>{title()}</b><div style={{ color: "#718096", fontSize: 11, marginTop: 3 }}>{filteredRows.length} record(s) found</div></div>{reportType === "vat" && <span style={badge}>VAT DETAILS</span>}</div>
      <div style={{ overflowX: "auto" }}><table style={tableStyle}>
        <thead><tr>
          {reportType === "sales" 
            ? ["S.No", "D/N No.", "Inv No.", "Date", "Item Description", "Customer", "Qty", "Price", "Total", "VAT %", "VAT Amt", "Total Amt", "Branch", "Payment"].map(x => <th key={x} style={th}>{x}</th>)
            : reportType === "vat" 
              ? ["S.No", "Date", "VAT / Tax No.", "Name", "Qty", "Total Amount", "VAT Amount", "Amount Without VAT", "VAT %", "Category"].map(x => <th key={x} style={th}>{x}</th>)
              : ["S.No", "Date", "Reference", "Item Description", "Party", "Qty", "Price", "Total", "VAT %", "VAT Amt", "Total Amt", "Branch", "Payment"].map(x => <th key={x} style={th}>{x}</th>)
          }
        </tr></thead>
        <tbody>{filteredRows.length === 0 ? <tr><td colSpan={14} style={emptyCell}>No records found for the selected filters.</td></tr> : filteredRows.map((r, i) => <tr key={r.id} style={{ background: i % 2 ? "#0b1622" : "#09121e" }}>
          {reportType === "sales" ? (
            <><td style={td}>{i + 1}</td><td style={td}>{r.deliveryNoteNo || "-"}</td><td style={tdStrong}>{r.invoiceNo || "-"}</td><td style={td}>{dateText(r.date)}</td><td style={td}>{r.salesDescription || r.item}</td><td style={tdStrong}>{r.party}</td><td style={tdRight}>{qty(r.quantity)}</td><td style={tdRight}>{money(r.unitPrice)}</td><td style={tdRight}>{money(r.quantity * r.unitPrice)}</td><td style={tdRight}>{r.vatPercent}%</td><td style={tdRight}>{money(r.vatAmount)}</td><td style={tdRightStrong}>{money(r.totalAmount)}</td><td style={td}>{r.branch}</td><td style={td}>{r.paymentStatus}</td></>
          ) : reportType === "vat" ? (
            <><td style={td}>{i + 1}</td><td style={td}>{dateText(r.date)}</td><td style={td}>{r.vatNumber}</td><td style={tdStrong}>{r.party}</td><td style={tdRight}>{qty(r.quantity)}</td><td style={tdRight}>{money(r.totalAmount)}</td><td style={tdRight}>{money(r.vatAmount)}</td><td style={tdRight}>{money(r.taxableAmount)}</td><td style={tdRight}>{r.vatPercent}%</td><td style={td}>{r.category.replace(" - ", " — ")}</td></>
          ) : (
            <><td style={td}>{i + 1}</td><td style={td}>{dateText(r.date)}</td><td style={tdStrong}>{r.reference}</td><td style={td}>{r.salesDescription || r.item}</td><td style={td}>{r.party}</td><td style={tdRight}>{qty(r.quantity)}</td><td style={tdRight}>{money(r.unitPrice)}</td><td style={tdRight}>{money(r.quantity * r.unitPrice)}</td><td style={tdRight}>{r.vatPercent}%</td><td style={tdRight}>{money(r.vatAmount)}</td><td style={tdRightStrong}>{money(r.totalAmount)}</td><td style={td}>{r.branch}</td><td style={td}>{r.paymentStatus}</td></>
          )}
        </tr>)}</tbody>
        {filteredRows.length > 0 && <tfoot><tr>
          {reportType === "sales" ? (
            <><td colSpan={6} style={totalLabel}>GRAND TOTAL</td><td style={tdRightStrong}>{qty(totals.quantity)}</td><td style={tdRightStrong}></td><td style={tdRightStrong}>{money(totals.quantity * 1)}</td><td style={tdRightStrong}></td><td style={tdRightStrong}>{money(totals.vat)}</td><td style={tdRightStrong}>{money(totals.total)}</td><td style={td}></td><td style={td}></td></>
          ) : reportType === "vat" ? (
            <><td colSpan={4} style={totalLabel}>GRAND TOTAL</td><td style={tdRightStrong}>{qty(totals.quantity)}</td><td style={tdRightStrong}>{money(totals.total)}</td><td style={tdRightStrong}>{money(totals.vat)}</td><td style={tdRightStrong}>{money(totals.taxable)}</td><td style={td}></td><td style={td}></td></>
          ) : (
            <><td colSpan={5} style={totalLabel}>GRAND TOTAL</td><td style={tdRightStrong}>{qty(totals.quantity)}</td><td style={tdRightStrong}></td><td style={tdRightStrong}>{money(totals.quantity * 1)}</td><td style={tdRightStrong}></td><td style={tdRightStrong}>{money(totals.vat)}</td><td style={tdRightStrong}>{money(totals.total)}</td><td style={td}></td><td style={td}></td></>
          )}
        </tr></tfoot>}
      </table></div>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={fieldStyle}><span>{label}</span>{children}</label>; }
function Summary({ title, value, note, strong = false }: { title: string; value: string; note?: string; strong?: boolean }) { return <div style={{ ...summaryCard, ...(strong ? { borderColor: "#22d3ee", boxShadow: "0 0 18px rgba(34,211,238,.08)" } : {}) }}><div style={summaryLabel}>{title}</div><div style={{ ...summaryValue, color: strong ? "#67e8f9" : "#edf2f7" }}>{value}</div>{note && <div style={summaryNote}>{note}</div>}</div>; }

const pageStyle: CSSProperties = { minHeight: "100vh", background: "#050b14", color: "#e8edf5", padding: 24, boxSizing: "border-box" };
const topBar: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" };
const eyebrow: CSSProperties = { color: "#6ee7ff", fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 5 };
const h1: CSSProperties = { margin: 0, fontSize: 30, fontWeight: 850 };
const subtitle: CSSProperties = { marginTop: 5, color: "#7d8da1", fontSize: 13 };
const refreshBtn: CSSProperties = { background: "#0b1725", color: "#67e8f9", border: "1px solid #1e4055", borderRadius: 8, padding: "10px 15px", cursor: "pointer", fontWeight: 800 };
const errorStyle: CSSProperties = { background: "#3b1118", border: "1px solid #7f1d1d", color: "#fecaca", padding: 12, borderRadius: 9, marginBottom: 15 };
const tabsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", gap: 9, marginBottom: 14 };
const tabStyle: CSSProperties = { border: "1px solid #17283b", background: "#09121e", color: "#a9b5c5", borderRadius: 9, padding: 13, cursor: "pointer", textAlign: "left", fontWeight: 800 };
const activeTabStyle: CSSProperties = { ...tabStyle, borderColor: "#22d3ee", background: "#0c2533", color: "#67e8f9" };
const panelStyle: CSSProperties = { background: "#09121e", border: "1px solid #17283b", borderRadius: 12, marginBottom: 14, overflow: "visible" };
const panelHead: CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #17283b", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const filterGrid: CSSProperties = { padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 11 };
const fieldStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 5, color: "#9eacbd", fontSize: 11, fontWeight: 800 };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#050c15", color: "#e8edf5", border: "1px solid #203246", borderRadius: 7, padding: "9px 10px", outline: "none", fontSize: 12 };
const clearBtn: CSSProperties = { border: "1px solid #334155", background: "#111827", color: "#cbd5e1", borderRadius: 7, padding: "7px 12px", cursor: "pointer" };
const actionBar: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 14 };
const exportBase: CSSProperties = { borderRadius: 7, padding: "9px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12 };
const csvBtn: CSSProperties = { ...exportBase, background: "#111827", border: "1px solid #334155", color: "#e2e8f0" };
const excelBtn: CSSProperties = { ...exportBase, background: "#0b2a1d", border: "1px solid #166534", color: "#86efac" };
const pdfBtn: CSSProperties = { ...exportBase, background: "#32111a", border: "1px solid #7f1d1d", color: "#fca5a5" };
const summaryGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 };
const summaryCard: CSSProperties = { background: "#09121e", border: "1px solid #17283b", borderRadius: 10, padding: 13 };
const summaryLabel: CSSProperties = { color: "#718096", fontSize: 9, fontWeight: 900, letterSpacing: 0.7, marginBottom: 6 };
const summaryValue: CSSProperties = { fontSize: 17, fontWeight: 900 };
const summaryNote: CSSProperties = { color: "#718096", fontSize: 10, marginTop: 5 };
const vatOverview: CSSProperties = { marginBottom: 14 };
const sectionTitle: CSSProperties = { color: "#8da0b4", fontSize: 11, fontWeight: 900, letterSpacing: 1, marginBottom: 9 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 1200 };
const th: CSSProperties = { background: "#0e1b2b", color: "#91a4b8", padding: "10px 9px", textAlign: "left", fontSize: 9, fontWeight: 900, whiteSpace: "nowrap", borderBottom: "1px solid #1c3044" };
const td: CSSProperties = { padding: "9px", color: "#c5cfdb", fontSize: 10, borderBottom: "1px solid #122235", whiteSpace: "nowrap" };
const tdStrong: CSSProperties = { ...td, fontWeight: 800, color: "#67e8f9" };
const tdRight: CSSProperties = { ...td, textAlign: "right" };
const tdRightStrong: CSSProperties = { ...tdRight, fontWeight: 900, color: "#86efac" };
const totalLabel: CSSProperties = { padding: 12, color: "#fff", fontWeight: 900, borderTop: "2px solid #1f3a4d" };
const emptyCell: CSSProperties = { padding: 40, textAlign: "center", color: "#718096" };
const badge: CSSProperties = { padding: "4px 8px", borderRadius: 5, background: "#0c2533", color: "#67e8f9", fontSize: 9, fontWeight: 900 };
const multiMenuStyle: CSSProperties = { position: "absolute", zIndex: 50, top: "calc(100% + 5px)", left: 0, right: 0, background: "#07111f", border: "1px solid #294156", borderRadius: 8, padding: 8, boxShadow: "0 18px 40px rgba(0,0,0,.4)" };
const menuActions: CSSProperties = { display: "flex", gap: 6, paddingBottom: 6, borderBottom: "1px solid #17283b", marginBottom: 5 };
const miniBtn: CSSProperties = { border: "1px solid #284057", background: "#0c1927", color: "#9ddff0", borderRadius: 5, padding: "5px 7px", cursor: "pointer", fontSize: 10 };
const checkRow: CSSProperties = { display: "flex", gap: 7, alignItems: "center", padding: "7px 4px", color: "#d6dee8", fontSize: 11, cursor: "pointer" };

export default Reports;
