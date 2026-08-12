import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =========================================================
   TYPES
========================================================= */

type Branch = {
  id: string;
  branch_name: string;
};

type Expense = {
  id: number;
  expense_date: string;
  branch_id: string | null;
  category: string;
  person_vendor: string | null;
  amount: number | null;
  vat_applicable: boolean;
  vat_rate: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  payment_method: string;
  attachment_url: string | null;
  notes: string | null;
  created_at: string | null;
};

type ExpenseForm = {
  expense_date: string;
  branch_id: string;
  category: string;
  person_vendor: string;
  amount: string;
  vat_applicable: boolean;
  vat_rate: string;
  payment_method: string;
  notes: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const VAT_RATE = 15;

const EXPENSE_CATEGORIES = [
  "RENT",
  "ELECTRICITY",
  "WATER",
  "TELEPHONE",
  "FOOD",
  "MAINTENANCE",
  "OFFICE",
  "TRANSPORT",
  "FUEL",
  "REPAIRS",
  "SALARIES",
  "GOVERNMENT FEES",
  "OTHER EXPENSES",
];

const PAYMENT_METHODS = ["CASH", "BANK"];

const COMPANY_NAME_EN = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";

const emptyForm: ExpenseForm = {
  expense_date: new Date().toISOString().split("T")[0],
  branch_id: "",
  category: "",
  person_vendor: "",
  amount: "",
  vat_applicable: false,
  vat_rate: String(VAT_RATE),
  payment_method: "CASH",
  notes: "",
};

/* =========================================================
   COMPONENT
========================================================= */

function Expenses() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<ExpenseForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    fetchBranches();
    fetchExpenses();
  }, []);

  /* =======================================================
     FETCH BRANCHES
  ======================================================= */

  async function fetchBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("branch_name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Unable to load branches: " + error.message);
      return;
    }

    setBranches(data || []);
  }

  /* =======================================================
     FETCH EXPENSES
  ======================================================= */

  async function fetchExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false });

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Unable to load expenses: " + error.message);
      return;
    }

    setExpenses(data || []);
  }

  /* =======================================================
     FORM UPDATE
  ======================================================= */

  function updateField(field: keyof ExpenseForm, value: string | boolean) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const expenseAmount = Number(form.amount) || 0;
  const formVatRate = Number(form.vat_rate) || 0;
  const formVatAmount = form.vat_applicable ? expenseAmount * (formVatRate / 100) : 0;
  const formTotalAmount = expenseAmount + formVatAmount;

  /* =======================================================
     BRANCH NAME
  ======================================================= */

  function getBranchName(branchId: string | null) {
    if (!branchId) return "-";
    const branch = branches.find((item) => item.id === branchId);
    return branch?.branch_name || "-";
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateForm() {
    if (!form.expense_date) {
      alert("Expense date is required.");
      return false;
    }
    if (!form.branch_id) {
      alert("Please select a branch.");
      return false;
    }
    if (!form.category) {
      alert("Please select an expense category.");
      return false;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      alert("Expense amount must be greater than zero.");
      return false;
    }
    if (form.vat_applicable && Number(form.vat_rate) < 0) {
      alert("VAT rate cannot be negative.");
      return false;
    }
    if (!form.payment_method) {
      alert("Please select payment method.");
      return false;
    }
    return true;
  }

  /* =======================================================
     ATTACHMENT UPLOAD
  ======================================================= */

  async function uploadAttachment(file: File): Promise<string | null> {
    setUploading(true);

    try {
      const extension = file.name.split(".").pop() || "file";
      const fileName = `expense-${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
      const filePath = `expenses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("erp-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        alert("Unable to upload attachment: " + uploadError.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("erp-documents")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl || null;
    } finally {
      setUploading(false);
    }
  }

  /* =======================================================
     HANDLE ATTACHMENT
  ======================================================= */

  async function handleAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Attachment size cannot exceed 10 MB.");
      event.target.value = "";
      return;
    }

    const uploadedUrl = await uploadAttachment(file);
    if (uploadedUrl) {
      setAttachmentUrl(uploadedUrl);
    }

    event.target.value = "";
  }

  /* =======================================================
     SAVE EXPENSE
  ======================================================= */

  async function saveExpense() {
    if (!validateForm()) return;

    setSaving(true);

    const vatAmount = form.vat_applicable ? expenseAmount * (Number(form.vat_rate) / 100) : 0;
    const totalAmount = expenseAmount + vatAmount;

    const expenseData = {
      expense_date: form.expense_date,
      branch_id: form.branch_id,
      category: form.category,
      person_vendor: form.person_vendor.trim() || null,
      amount: expenseAmount,
      vat_applicable: form.vat_applicable,
      vat_rate: form.vat_applicable ? Number(form.vat_rate) : 0,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      payment_method: form.payment_method,
      attachment_url: attachmentUrl,
      notes: form.notes.trim() || null,
    };

    let error = null;

    if (editingId !== null) {
      const result = await supabase.from("expenses").update(expenseData).eq("id", editingId);
      error = result.error;
    } else {
      const result = await supabase.from("expenses").insert(expenseData);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Unable to save expense: " + error.message);
      return;
    }

    alert(editingId !== null ? "Expense updated successfully." : "Expense saved successfully.");
    clearForm();
    await fetchExpenses();
  }

  /* =======================================================
     EDIT EXPENSE
  ======================================================= */

  function editExpense(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
      branch_id: expense.branch_id || "",
      category: expense.category || "",
      person_vendor: expense.person_vendor || "",
      amount: expense.amount !== null ? String(expense.amount) : "",
      vat_applicable: Boolean(expense.vat_applicable),
      vat_rate: expense.vat_rate !== null ? String(expense.vat_rate) : String(VAT_RATE),
      payment_method: expense.payment_method || "CASH",
      notes: expense.notes || "",
    });
    setAttachmentUrl(expense.attachment_url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteExpense(id: number) {
    const confirmed = window.confirm("Are you sure you want to delete this expense?");
    if (!confirmed) return;

    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
      alert("Unable to delete expense: " + error.message);
      return;
    }

    alert("Expense deleted successfully.");
    await fetchExpenses();
  }

  /* =======================================================
     CLEAR FORM
  ======================================================= */

  function clearForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setAttachmentUrl(null);
  }

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredExpenses = useMemo(() => {
    const text = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const branchName = getBranchName(expense.branch_id);
      const searchable = [
        expense.category,
        expense.person_vendor,
        expense.payment_method,
        expense.notes,
        branchName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (text && !searchable.includes(text)) return false;
      if (categoryFilter && expense.category !== categoryFilter) return false;
      if (branchFilter && expense.branch_id !== branchFilter) return false;
      if (dateFrom && expense.expense_date < dateFrom) return false;
      if (dateTo && expense.expense_date > dateTo) return false;

      return true;
    });
  }, [expenses, search, categoryFilter, branchFilter, dateFrom, dateTo, branches]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const totalCount = filteredExpenses.length;
  const totalNet = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalVat = filteredExpenses.reduce((sum, expense) => sum + Number(expense.vat_amount || 0), 0);
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

  /* =======================================================
     CATEGORY REPORT
  ======================================================= */

  const categoryReport = useMemo(() => {
    const report: Record<string, { count: number; net: number; vat: number; total: number }> = {};

    filteredExpenses.forEach((expense) => {
      const category = expense.category || "OTHER EXPENSES";
      if (!report[category]) {
        report[category] = { count: 0, net: 0, vat: 0, total: 0 };
      }
      report[category].count += 1;
      report[category].net += Number(expense.amount || 0);
      report[category].vat += Number(expense.vat_amount || 0);
      report[category].total += Number(expense.total_amount || 0);
    });

    return Object.entries(report).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredExpenses]);

  /* =======================================================
     PDF FONT
  ======================================================= */

  async function loadArabicFont(doc: jsPDF): Promise<boolean> {
    try {
      const response = await fetch("/fonts/NotoSansArabic-Regular.ttf");
      if (!response.ok) {
        throw new Error("Arabic font file not found.");
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 0x8000;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
      }

      const base64 = btoa(binary);
      doc.addFileToVFS("NotoSansArabic-Regular.ttf", base64);
      doc.addFont("NotoSansArabic-Regular.ttf", "NotoSansArabic", "normal");

      return true;
    } catch (error) {
      console.error("Arabic font loading error:", error);
      return false;
    }
  }

  /* =======================================================
     MONEY
  ======================================================= */

  function formatMoney(value: number) {
    return `${Number(value || 0).toFixed(2)} SAR`;
  }

  /* =======================================================
     MONTH
  ======================================================= */

  function formatMonth(monthValue: string) {
    const date = new Date(`${monthValue}-01T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  /* =======================================================
     SAFE AUTOTABLE - FIXED VERSION
  ======================================================= */

  function sanitizeTableData(data: any[][]): any[][] {
    if (!data || !Array.isArray(data)) return [];
    return data.map(row => 
      row.map(cell => 
        cell === null || cell === undefined ? "" : String(cell)
      )
    );
  }

  function createSafeTable(doc: jsPDF, options: Parameters<typeof autoTable>[1]) {
    const sanitizedOptions = { ...options };
    
    if (sanitizedOptions.body && Array.isArray(sanitizedOptions.body)) {
      sanitizedOptions.body = sanitizeTableData(sanitizedOptions.body);
    }
    
    if (sanitizedOptions.head && Array.isArray(sanitizedOptions.head)) {
      sanitizedOptions.head = sanitizeTableData(sanitizedOptions.head);
    }
    
    if (sanitizedOptions.foot && Array.isArray(sanitizedOptions.foot)) {
      sanitizedOptions.foot = sanitizeTableData(sanitizedOptions.foot);
    }

    try {
      autoTable(doc, {
        ...sanitizedOptions,
        tableWidth: "auto",
        styles: {
          font: "helvetica",
          fontSize: 7,
          cellPadding: 2.5,
          overflow: "linebreak",
          valign: "middle",
          ...(options.styles || {}),
        },
        margin: {
          left: 14,
          right: 14,
          top: 48,
          bottom: 18,
          ...(options.margin || {}),
        },
      });
    } catch (error) {
      console.error("AutoTable error:", error);
      try {
        autoTable(doc, {
          head: sanitizedOptions.head || [[]],
          body: sanitizedOptions.body || [[]],
          startY: sanitizedOptions.startY || 50,
          theme: "grid",
        });
      } catch (fallbackError) {
        console.error("Fallback AutoTable also failed:", fallbackError);
      }
    }
  }

  /* =======================================================
     PDF HEADER
  ======================================================= */

  function drawPdfHeader(doc: jsPDF, title: string, subtitle: string, arabicFontLoaded: boolean) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(7, 17, 31);
    doc.rect(0, 0, pageWidth, 42, "F");

    doc.setFillColor(34, 211, 238);
    doc.rect(0, 40, pageWidth, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(34, 211, 238);
    doc.text(COMPANY_NAME_EN, 14, 13);

    if (arabicFontLoaded) {
      doc.setFont("NotoSansArabic", "normal");
      doc.setFontSize(11);
      doc.setTextColor(226, 232, 240);
      doc.text(COMPANY_NAME_AR, pageWidth - 14, 13, { align: "right" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, 14, 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 30, { align: "right" });
  }

  /* =======================================================
     PDF SECTION TITLE
  ======================================================= */

  function drawPdfSectionTitle(doc: jsPDF, title: string, y: number) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, y - 6, pageWidth - 28, 12, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(34, 211, 238);
    doc.text(title, 18, y + 1);
  }

  /* =======================================================
     PDF FOOTER
  ======================================================= */

  function drawPdfFooter(doc: jsPDF, arabicFontLoaded: boolean) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(203, 213, 225);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(COMPANY_NAME_EN, 14, pageHeight - 7);

    if (arabicFontLoaded) {
      doc.setFont("NotoSansArabic", "normal");
      doc.setFontSize(7);
      doc.text(COMPANY_NAME_AR, pageWidth / 2, pageHeight - 7, { align: "center" });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const pageNumber = typeof doc.getCurrentPageInfo === "function"
      ? doc.getCurrentPageInfo().pageNumber
      : doc.getNumberOfPages();

    doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }

  /* =======================================================
     PDF SUMMARY CARDS
  ======================================================= */

  function drawPdfSummaryCards(doc: jsPDF, startY: number, count: number, net: number, vat: number, total: number) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const gap = 5;
    const boxWidth = (pageWidth - 28 - gap * 3) / 4;

    const values = [
      { title: "EXPENSE COUNT", value: String(count) },
      { title: "NET EXPENSE", value: formatMoney(net) },
      { title: "TOTAL VAT", value: formatMoney(vat) },
      { title: "TOTAL EXPENSE", value: formatMoney(total) },
    ];

    values.forEach((item, index) => {
      const x = 14 + index * (boxWidth + gap);

      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(x, startY, boxWidth, 25, 2.5, 2.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.title, x + 5, startY + 8);

      doc.setFontSize(11);
      doc.setTextColor(34, 211, 238);
      doc.text(item.value, x + 5, startY + 18);
    });
  }

  /* =======================================================
     CATEGORY SUMMARY PDF - FIXED
  ======================================================= */

  function addCategorySummaryPdf(doc: jsPDF, data: Expense[], arabicFontLoaded: boolean) {
    const report: Record<string, { count: number; net: number; vat: number; total: number }> = {};

    data.forEach((expense) => {
      const category = expense.category || "OTHER EXPENSES";
      if (!report[category]) {
        report[category] = { count: 0, net: 0, vat: 0, total: 0 };
      }
      report[category].count++;
      report[category].net += Number(expense.amount || 0);
      report[category].vat += Number(expense.vat_amount || 0);
      report[category].total += Number(expense.total_amount || 0);
    });

    const rows = Object.entries(report)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, values]) => [
        category,
        String(values.count),
        formatMoney(values.net),
        formatMoney(values.vat),
        formatMoney(values.total),
      ]);

    if (rows.length === 0) {
      createSafeTable(doc, {
        body: [["No data available"]],
        startY: 50,
        theme: "grid",
      });
      return;
    }

    const grandNet = data.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const grandVat = data.reduce((sum, expense) => sum + Number(expense.vat_amount || 0), 0);
    const grandTotal = data.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

    createSafeTable(doc, {
      head: [["CATEGORY", "COUNT", "NET (SAR)", "VAT (SAR)", "TOTAL (SAR)"]],
      body: rows,
      startY: 50,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [51, 65, 85],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [103, 232, 249],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      foot: [
        [
          "GRAND TOTAL",
          String(data.length),
          formatMoney(grandNet),
          formatMoney(grandVat),
          formatMoney(grandTotal),
        ],
      ],
      footStyles: {
        fillColor: [7, 17, 31],
        textColor: [34, 211, 238],
        fontStyle: "bold",
      },
      didDrawPage: () => {
        drawPdfFooter(doc, arabicFontLoaded);
      },
    });
  }

  /* =======================================================
     EXPENSE DETAIL PDF - FIXED
  ======================================================= */

  function addExpenseDetailsPdf(doc: jsPDF, data: Expense[], startY: number, arabicFontLoaded: boolean) {
    if (data.length === 0) {
      createSafeTable(doc, {
        body: [["No expense data available"]],
        startY,
        theme: "grid",
      });
      return;
    }

    const rows = data.map((expense) => [
      expense.expense_date || "-",
      getBranchName(expense.branch_id) || "-",
      expense.category || "-",
      expense.person_vendor || "-",
      formatMoney(Number(expense.amount || 0)),
      formatMoney(Number(expense.vat_amount || 0)),
      formatMoney(Number(expense.total_amount || 0)),
      expense.payment_method || "-",
      expense.attachment_url ? "YES" : "NO",
      expense.notes || "-",
    ]);

    createSafeTable(doc, {
      head: [
        [
          "DATE",
          "BRANCH",
          "CATEGORY",
          "PERSON / VENDOR",
          "NET",
          "VAT",
          "TOTAL",
          "PAYMENT",
          "ATTACHMENT",
          "NOTES",
        ],
      ],
      body: rows,
      startY,
      theme: "grid",
      tableWidth: "auto",
      styles: {
        fontSize: 6.2,
        cellPadding: 2.2,
        textColor: [51, 65, 85],
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [103, 232, 249],
        fontStyle: "bold",
        fontSize: 6.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: () => {
        drawPdfFooter(doc, arabicFontLoaded);
      },
    });
  }

  /* =======================================================
     FINAL SUMMARY PAGE - FIXED
  ======================================================= */

  function addFinalSummaryPage(
    doc: jsPDF,
    data: Expense[],
    reportTitle: string,
    reportSubtitle: string,
    arabicFontLoaded: boolean
  ) {
    doc.addPage();

    drawPdfHeader(doc, "FINAL EXPENSE SUMMARY", reportSubtitle, arabicFontLoaded);
    drawPdfSectionTitle(doc, "MONTHLY EXPENSE SUMMARY", 52);

    const net = data.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const vat = data.reduce((sum, expense) => sum + Number(expense.vat_amount || 0), 0);
    const total = data.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);
    const count = data.length;

    drawPdfSummaryCards(doc, 62, count, net, vat, total);
    drawPdfSectionTitle(doc, "EXPENSE BREAKDOWN BY CATEGORY", 105);

    const report: Record<string, { count: number; net: number; vat: number; total: number }> = {};

    data.forEach((expense) => {
      const category = expense.category || "OTHER EXPENSES";
      if (!report[category]) {
        report[category] = { count: 0, net: 0, vat: 0, total: 0 };
      }
      report[category].count++;
      report[category].net += Number(expense.amount || 0);
      report[category].vat += Number(expense.vat_amount || 0);
      report[category].total += Number(expense.total_amount || 0);
    });

    const rows = Object.entries(report)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, values]) => [
        category,
        String(values.count),
        formatMoney(values.net),
        formatMoney(values.vat),
        formatMoney(values.total),
      ]);

    if (rows.length > 0) {
      createSafeTable(doc, {
        head: [["CATEGORY", "COUNT", "NET", "VAT", "TOTAL"]],
        body: rows,
        startY: 113,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 3,
          textColor: [51, 65, 85],
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [103, 232, 249],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        foot: [
          [
            "GRAND TOTAL",
            String(count),
            formatMoney(net),
            formatMoney(vat),
            formatMoney(total),
          ],
        ],
        footStyles: {
          fillColor: [7, 17, 31],
          textColor: [34, 211, 238],
          fontStyle: "bold",
        },
        didDrawPage: () => {
          drawPdfFooter(doc, arabicFontLoaded);
        },
      });
    }

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 180;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const boxY = Math.min(finalY + 12, pageHeight - 55);

    doc.setFillColor(7, 17, 31);
    doc.setDrawColor(34, 211, 238);
    doc.roundedRect(14, boxY, pageWidth - 28, 32, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("FINAL MONTHLY EXPENSE", 20, boxY + 10);

    doc.setFontSize(16);
    doc.setTextColor(34, 211, 238);
    doc.text(formatMoney(total), 20, boxY + 23);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(reportTitle, pageWidth - 20, boxY + 10, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${count} expense records`, pageWidth - 20, boxY + 18, { align: "right" });
    doc.text(`Net: ${formatMoney(net)} | VAT: ${formatMoney(vat)}`, pageWidth - 20, boxY + 25, { align: "right" });

    drawPdfFooter(doc, arabicFontLoaded);
  }

  /* =======================================================
     MONTHLY PDF - FIXED
  ======================================================= */

  async function generateMonthlyPdf() {
    if (pdfLoading) return;

    const defaultMonth = dateFrom ? dateFrom.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const month = window.prompt("Enter month in YYYY-MM format:", defaultMonth);

    if (!month) return;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      alert("Please enter the month like 2026-08.");
      return;
    }

    setPdfLoading(true);

    try {
      const startDate = `${month}-01`;
      const nextMonthDate = new Date(`${month}-01T00:00:00`);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonth = nextMonthDate.toISOString().substring(0, 10);

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", startDate)
        .lt("expense_date", nextMonth)
        .order("expense_date", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;

      const monthlyExpenses = (data || []) as Expense[];

      if (monthlyExpenses.length === 0) {
        alert(`No expenses found for ${formatMonth(month)}.`);
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const arabicFontLoaded = await loadArabicFont(doc);

      // PAGE 1
      drawPdfHeader(doc, "MONTHLY EXPENSE REPORT", `${formatMonth(month)} | Complete Expense Report`, arabicFontLoaded);
      drawPdfSectionTitle(doc, "REPORT OVERVIEW", 52);

      const monthNet = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const monthVat = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.vat_amount || 0), 0);
      const monthTotal = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

      drawPdfSummaryCards(doc, 62, monthlyExpenses.length, monthNet, monthVat, monthTotal);
      drawPdfSectionTitle(doc, "REPORT INFORMATION", 105);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`Company: ${COMPANY_NAME_EN}`, 18, 116);

      if (arabicFontLoaded) {
        doc.setFont("NotoSansArabic", "normal");
        doc.text(COMPANY_NAME_AR, 18, 125);
      }

      doc.setFont("helvetica", "normal");
      doc.text(`Reporting Month: ${formatMonth(month)}`, 18, 134);
      doc.text(`Number of Expense Records: ${monthlyExpenses.length}`, 18, 143);
      doc.text("Report Type: Full Monthly Expense Report", 18, 152);

      drawPdfFooter(doc, arabicFontLoaded);

      // PAGE 2
      doc.addPage();
      drawPdfHeader(doc, "EXPENSE CATEGORY SUMMARY", formatMonth(month), arabicFontLoaded);
      drawPdfSectionTitle(doc, "EXPENSE SUMMARY BY CATEGORY", 52);
      addCategorySummaryPdf(doc, monthlyExpenses, arabicFontLoaded);

      // PAGE 3
      doc.addPage();
      drawPdfHeader(doc, "FULL EXPENSE DETAILS", `${formatMonth(month)} | All Expense Transactions`, arabicFontLoaded);
      drawPdfSectionTitle(doc, "ALL EXPENSE TRANSACTIONS", 48);
      addExpenseDetailsPdf(doc, monthlyExpenses, 57, arabicFontLoaded);

      // FINAL SUMMARY
      addFinalSummaryPage(
        doc,
        monthlyExpenses,
        "MONTHLY EXPENSE REPORT",
        `${formatMonth(month)} | Final Summary`,
        arabicFontLoaded
      );

      doc.save(`Expense_Report_${month}.pdf`);
    } catch (error) {
      console.error("MONTHLY PDF GENERATION ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Unable to generate monthly PDF report.\n\nError: ${errorMessage}`);
    } finally {
      setPdfLoading(false);
    }
  }

  /* =======================================================
     FILTERED PDF
  ======================================================= */

  async function generateFilteredPdf() {
    if (pdfLoading) return;

    if (filteredExpenses.length === 0) {
      alert("There are no expenses to export.");
      return;
    }

    setPdfLoading(true);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const arabicFontLoaded = await loadArabicFont(doc);

      let filterText = "All Expense Records";

      if (dateFrom || dateTo) {
        filterText = `Date: ${dateFrom || "ALL"} to ${dateTo || "ALL"}`;
      }

      if (branchFilter) {
        filterText += ` | Branch: ${getBranchName(branchFilter)}`;
      }

      if (categoryFilter) {
        filterText += ` | Category: ${categoryFilter}`;
      }

      // PAGE 1
      drawPdfHeader(doc, "FILTERED EXPENSE REPORT", filterText, arabicFontLoaded);
      drawPdfSectionTitle(doc, "FILTERED REPORT OVERVIEW", 52);

      drawPdfSummaryCards(doc, 62, filteredExpenses.length, totalNet, totalVat, totalAmount);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`Company: ${COMPANY_NAME_EN}`, 18, 105);

      if (arabicFontLoaded) {
        doc.setFont("NotoSansArabic", "normal");
        doc.text(COMPANY_NAME_AR, 18, 114);
      }

      drawPdfFooter(doc, arabicFontLoaded);

      // PAGE 2
      doc.addPage();
      drawPdfHeader(doc, "EXPENSE CATEGORY SUMMARY", filterText, arabicFontLoaded);
      drawPdfSectionTitle(doc, "EXPENSE SUMMARY BY CATEGORY", 52);
      addCategorySummaryPdf(doc, filteredExpenses, arabicFontLoaded);

      // PAGE 3
      doc.addPage();
      drawPdfHeader(doc, "FULL EXPENSE DETAILS", filterText, arabicFontLoaded);
      drawPdfSectionTitle(doc, "ALL FILTERED EXPENSE TRANSACTIONS", 48);
      addExpenseDetailsPdf(doc, filteredExpenses, 57, arabicFontLoaded);

      // FINAL SUMMARY
      addFinalSummaryPage(
        doc,
        filteredExpenses,
        "FILTERED EXPENSE REPORT",
        `${filterText} | Final Summary`,
        arabicFontLoaded
      );

      const safeName = filterText.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 60);
      doc.save(`Expense_Report_${safeName}.pdf`);
    } catch (error) {
      console.error("FILTERED PDF GENERATION ERROR:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Unable to generate filtered PDF report.\n\nError: ${errorMessage}`);
    } finally {
      setPdfLoading(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "12px",
        boxSizing: "border-box",
        background: "linear-gradient(135deg,#07111f,#0f172a,#111827)",
        color: "#ffffff",
        overflowX: "hidden",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#22d3ee",
              fontSize: "clamp(20px, 2vw, 25px)",
              fontWeight: 800,
            }}
          >
            EXPENSES
          </h1>
          <div
            style={{
              marginTop: "3px",
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            Branch Expense Management
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "6px",
            padding: "7px 12px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {expenses.length} Expenses
        </div>
      </div>

      {/* FORM */}
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "15px",
            }}
          >
            {editingId !== null ? "EDIT EXPENSE" : "NEW EXPENSE"}
          </h2>
          {editingId !== null && (
            <button onClick={clearForm} style={secondaryButtonStyle}>
              Cancel
            </button>
          )}
        </div>

        <div
          style={{
            color: "#22d3ee",
            fontSize: "10px",
            fontWeight: 800,
            marginBottom: "9px",
          }}
        >
          EXPENSE INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: "9px",
          }}
        >
          <div>
            <label style={labelStyle}>DATE *</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => updateField("expense_date", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>BRANCH *</label>
            <select
              value={form.branch_id}
              onChange={(e) => updateField("branch_id", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>CATEGORY *</label>
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Category</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>PERSON / VENDOR</label>
            <input
              value={form.person_vendor}
              placeholder="Vendor or person name"
              onChange={(e) => updateField("person_vendor", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>AMOUNT *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              placeholder="0.00"
              onChange={(e) => updateField("amount", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>VAT</label>
            <select
              value={form.vat_applicable ? "YES" : "NO"}
              onChange={(e) => updateField("vat_applicable", e.target.value === "YES")}
              style={inputStyle}
            >
              <option value="NO">Non-VAT</option>
              <option value="YES">VAT Applicable</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>VAT RATE %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!form.vat_applicable}
              value={form.vat_rate}
              onChange={(e) => updateField("vat_rate", e.target.value)}
              style={{
                ...inputStyle,
                opacity: form.vat_applicable ? 1 : 0.5,
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>PAID FROM *</label>
            <select
              value={form.payment_method}
              onChange={(e) => updateField("payment_method", e.target.value)}
              style={inputStyle}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ATTACHMENT */}
        <div style={{ marginTop: "10px" }}>
          <label style={labelStyle}>ATTACHMENT</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "34px",
                padding: "0 13px",
                background: "linear-gradient(135deg,#334155,#1e293b)",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 700,
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading..." : "Choose File"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                onChange={handleAttachment}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
            {attachmentUrl && (
              <>
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#22d3ee",
                    fontSize: "11px",
                    textDecoration: "none",
                  }}
                >
                  View Attachment
                </a>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl(null)}
                  style={smallDangerButtonStyle}
                >
                  Remove
                </button>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: "4px",
              color: "#64748b",
              fontSize: "9px",
            }}
          >
            Maximum file size: 10 MB
          </div>
        </div>

        {/* NOTES */}
        <div style={{ marginTop: "10px" }}>
          <label style={labelStyle}>NOTES</label>
          <textarea
            value={form.notes}
            placeholder="Optional expense notes"
            onChange={(e) => updateField("notes", e.target.value)}
            style={{
              ...inputStyle,
              height: "55px",
              padding: "8px 10px",
              resize: "vertical",
            }}
          />
        </div>

        {/* CALCULATIONS */}
        <div
          style={{
            marginTop: "10px",
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: "8px",
          }}
        >
          <CalculationCard
            title="NET AMOUNT"
            value={expenseAmount.toFixed(2)}
            suffix="SAR"
          />
          <CalculationCard
            title={`VAT ${form.vat_applicable ? form.vat_rate : "0"}%`}
            value={formVatAmount.toFixed(2)}
            suffix="SAR"
          />
          <CalculationCard
            title="TOTAL"
            value={formTotalAmount.toFixed(2)}
            suffix="SAR"
            highlight
          />
        </div>

        {/* BUTTONS */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "7px",
            marginTop: "11px",
          }}
        >
          {editingId !== null && (
            <button onClick={clearForm} style={secondaryButtonStyle}>
              Cancel
            </button>
          )}
          <button
            onClick={saveExpense}
            disabled={saving || uploading}
            style={{
              background: "linear-gradient(135deg,#06b6d4,#2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 18px",
              fontWeight: 700,
              fontSize: "11px",
              cursor: saving || uploading ? "not-allowed" : "pointer",
              opacity: saving || uploading ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : editingId !== null ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <SummaryCard title="EXPENSE COUNT" value={String(totalCount)} suffix="RECORDS" />
        <SummaryCard title="NET EXPENSE" value={totalNet.toFixed(2)} suffix="SAR" />
        <SummaryCard title="TOTAL VAT" value={totalVat.toFixed(2)} suffix="SAR" />
        <SummaryCard title="TOTAL EXPENSE" value={totalAmount.toFixed(2)} suffix="SAR" />
      </div>

      {/* PDF REPORT BUTTONS */}
      <div
        style={{
          background: "linear-gradient(135deg,#111827,#0b1220)",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#22d3ee",
              fontWeight: 800,
              fontSize: "12px",
            }}
          >
            EXPENSE PDF REPORTS
          </div>
          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
              marginTop: "3px",
            }}
          >
            Arabic + English | Professional full report | Final summary included
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={generateMonthlyPdf}
            disabled={pdfLoading}
            style={{
              background: "linear-gradient(135deg,#0891b2,#2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 13px",
              fontSize: "10px",
              fontWeight: 800,
              cursor: pdfLoading ? "not-allowed" : "pointer",
              opacity: pdfLoading ? 0.6 : 1,
            }}
          >
            {pdfLoading ? "Generating..." : "Monthly PDF"}
          </button>
          <button
            onClick={generateFilteredPdf}
            disabled={pdfLoading || filteredExpenses.length === 0}
            style={{
              background: "linear-gradient(135deg,#475569,#334155)",
              color: "#ffffff",
              border: "1px solid #64748b",
              borderRadius: "6px",
              padding: "8px 13px",
              fontSize: "10px",
              fontWeight: 800,
              cursor: pdfLoading || filteredExpenses.length === 0 ? "not-allowed" : "pointer",
              opacity: pdfLoading || filteredExpenses.length === 0 ? 0.6 : 1,
            }}
          >
            {pdfLoading ? "Generating..." : "Filtered PDF"}
          </button>
        </div>
      </div>

      {/* CATEGORY REPORT */}
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "13px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px 0",
            color: "#60a5fa",
            fontSize: "14px",
          }}
        >
          EXPENSE REPORT BY CATEGORY
        </h2>
        <div
          style={{
            width: "100%",
            overflowX: "auto",
            border: "1px solid #263548",
            borderRadius: "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: "650px",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#0b1220" }}>
                <th style={thStyle}>CATEGORY</th>
                <th style={thStyle}>COUNT</th>
                <th style={thStyle}>NET</th>
                <th style={thStyle}>VAT</th>
                <th style={thStyle}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {categoryReport.length === 0 ? (
                <tr>
                  <td colSpan={5} style={emptyStyle}>
                    No report data found.
                  </td>
                </tr>
              ) : (
                categoryReport.map(([category, data]) => (
                  <tr key={category}>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      {category}
                    </td>
                    <td style={tdStyle}>{data.count}</td>
                    <td style={tdStyle}>{data.net.toFixed(2)} SAR</td>
                    <td style={tdStyle}>{data.vat.toFixed(2)} SAR</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#22d3ee",
                        fontWeight: 800,
                      }}
                    >
                      {data.total.toFixed(2)} SAR
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {categoryReport.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: "#0b1220" }}>
                  <td
                    style={{
                      ...tdStyle,
                      color: "#22d3ee",
                      fontWeight: 800,
                    }}
                  >
                    GRAND TOTAL
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "#ffffff",
                      fontWeight: 800,
                    }}
                  >
                    {totalCount}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "#ffffff",
                      fontWeight: 800,
                    }}
                  >
                    {totalNet.toFixed(2)} SAR
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "#facc15",
                      fontWeight: 800,
                    }}
                  >
                    {totalVat.toFixed(2)} SAR
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "#22d3ee",
                      fontWeight: 800,
                    }}
                  >
                    {totalAmount.toFixed(2)} SAR
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* EXPENSE RECORDS */}
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "13px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "14px",
            }}
          >
            EXPENSE RECORDS
          </h2>
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              placeholder="Search vendor, category..."
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                width: "210px",
              }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                ...inputStyle,
                width: "155px",
              }}
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{
                ...inputStyle,
                width: "140px",
              }}
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                ...inputStyle,
                width: "130px",
              }}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                ...inputStyle,
                width: "130px",
              }}
            />
            {(search || categoryFilter || branchFilter || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                  setBranchFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
                style={secondaryButtonStyle}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div
          style={{
            width: "100%",
            overflowX: "auto",
            border: "1px solid #263548",
            borderRadius: "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: "1200px",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#0b1220" }}>
                <th style={thStyle}>DATE</th>
                <th style={thStyle}>BRANCH</th>
                <th style={thStyle}>CATEGORY</th>
                <th style={thStyle}>PERSON / VENDOR</th>
                <th style={thStyle}>NET</th>
                <th style={thStyle}>VAT</th>
                <th style={thStyle}>TOTAL</th>
                <th style={thStyle}>PAYMENT</th>
                <th style={thStyle}>ATTACHMENT</th>
                <th style={thStyle}>NOTES</th>
                <th style={thStyle}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={emptyStyle}>
                    Loading expenses...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={11} style={emptyStyle}>
                    No expenses found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={tdStyle}>{expense.expense_date}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      {getBranchName(expense.branch_id)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#22d3ee",
                        fontWeight: 700,
                      }}
                    >
                      {expense.category}
                    </td>
                    <td style={tdStyle}>{expense.person_vendor || "-"}</td>
                    <td style={tdStyle}>{Number(expense.amount || 0).toFixed(2)} SAR</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: expense.vat_applicable ? "#facc15" : "#64748b",
                      }}
                    >
                      {Number(expense.vat_amount || 0).toFixed(2)} SAR
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#22d3ee",
                        fontWeight: 800,
                      }}
                    >
                      {Number(expense.total_amount || 0).toFixed(2)} SAR
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge text={expense.payment_method} type="payment" />
                    </td>
                    <td style={tdStyle}>
                      {expense.attachment_url ? (
                        <a
                          href={expense.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#22d3ee",
                            textDecoration: "none",
                            fontWeight: 700,
                          }}
                        >
                          View
                        </a>
                      ) : (
                        <span style={{ color: "#64748b" }}>None</span>
                      )}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        maxWidth: "180px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={expense.notes || ""}
                    >
                      {expense.notes || "-"}
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                        }}
                      >
                        <button
                          onClick={() => editExpense(expense)}
                          style={smallBlueButtonStyle}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          style={smallDangerButtonStyle}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CALCULATION CARD
========================================================= */

function CalculationCard({
  title,
  value,
  suffix,
  highlight = false,
}: {
  title: string;
  value: string;
  suffix: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "linear-gradient(135deg,#082f49,#172554)" : "#0b1220",
        border: highlight ? "1px solid #0891b2" : "1px solid #263548",
        borderRadius: "7px",
        padding: "9px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "9px",
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: highlight ? "#22d3ee" : "#ffffff",
          fontSize: "17px",
          fontWeight: 800,
          marginTop: "3px",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#64748b",
          fontSize: "8px",
          marginTop: "1px",
        }}
      >
        {suffix}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  suffix,
}: {
  title: string;
  value: string;
  suffix: string;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg,#111827,#0b1220)",
        border: "1px solid #263548",
        borderRadius: "8px",
        padding: "10px",
        boxShadow: "0 0 15px rgba(34,211,238,.08)",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "8px",
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#22d3ee",
          fontSize: "18px",
          fontWeight: 800,
          marginTop: "3px",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#64748b",
          fontSize: "8px",
          marginTop: "1px",
        }}
      >
        {suffix}
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ text }: { text: string; type: "payment" }) {
  let color = "#60a5fa";

  if (text === "CASH") {
    color = "#4ade80";
  }

  if (text === "BANK") {
    color = "#60a5fa";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 7px",
        borderRadius: "4px",
        backgroundColor: `${color}20`,
        color,
        fontWeight: 700,
        fontSize: "8px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/* =========================================================
   STYLES
========================================================= */

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "34px",
  padding: "0 9px",
  backgroundColor: "#0b1220",
  color: "#ffffff",
  border: "1px solid #334155",
  borderRadius: "6px",
  boxSizing: "border-box",
  fontSize: "11px",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#94a3b8",
  fontSize: "9px",
  fontWeight: 700,
};

const thStyle: React.CSSProperties = {
  padding: "7px 6px",
  textAlign: "left",
  color: "#67e8f9",
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom: "1px solid #263548",
};

const tdStyle: React.CSSProperties = {
  padding: "6px",
  color: "#cbd5e1",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #1e293b",
};

const emptyStyle: React.CSSProperties = {
  padding: "25px",
  textAlign: "center",
  color: "#64748b",
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: "#374151",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 15px",
  fontSize: "11px",
  cursor: "pointer",
};

const smallBlueButtonStyle: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  padding: "5px 8px",
  cursor: "pointer",
  fontSize: "9px",
};

const smallDangerButtonStyle: React.CSSProperties = {
  backgroundColor: "#dc2626",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  padding: "5px 8px",
  cursor: "pointer",
  fontSize: "9px",
};

export default Expenses;