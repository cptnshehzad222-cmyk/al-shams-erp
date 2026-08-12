import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type LabourExpense = {
  id: number;
  expense_date: string;
  branch: string;
  item_description: string;
  quantity: number;
  unit: string | null;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const BRANCHES = [
  "AL SHIFA",
  "AD DILLAM",
  "MOHAMMADIA",
  "EXIT 9 NUMBER",
];

const PAYMENT_METHODS = ["Cash", "Bank", "Credit", "Other"];

const EMPTY_FORM = {
  expense_date: new Date().toISOString().split("T")[0],
  branch: "AL SHIFA",
  item_description: "",
  quantity: "1",
  unit: "",
  amount: "",
  payment_method: "Cash",
  notes: "",
};

function LabourExpenses() {
  const [expenses, setExpenses] = useState<LabourExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ============================================================
  // FETCH EXPENSES
  // ============================================================

  const fetchExpenses = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("labour_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("id", { ascending: false });

    if (fetchError) {
      console.error(fetchError);
      setError(fetchError.message);
      setExpenses([]);
    } else {
      setExpenses((data || []) as LabourExpense[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // ============================================================
  // FORM HANDLING
  // ============================================================

  const handleChange = (
    field: keyof typeof EMPTY_FORM,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMessage("");
    setError("");
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      expense_date: new Date().toISOString().split("T")[0],
    });

    setEditingId(null);
    setMessage("");
    setError("");
  };

  // ============================================================
  // SAVE / UPDATE
  // ============================================================

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!form.expense_date) {
      setError("Please select a date.");
      return;
    }

    if (!form.branch) {
      setError("Please select a branch.");
      return;
    }

    if (!form.item_description.trim()) {
      setError("Please enter an item or description.");
      return;
    }

    const quantity = Number(form.quantity);
    const amount = Number(form.amount);

    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Please enter a valid quantity.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSaving(true);

    const payload = {
      expense_date: form.expense_date,
      branch: form.branch,
      item_description: form.item_description.trim(),
      quantity,
      unit: form.unit.trim() || null,
      amount,
      payment_method: form.payment_method,
      notes: form.notes.trim() || null,
    };

    if (editingId !== null) {
      const { error: updateError } = await supabase
        .from("labour_expenses")
        .update(payload)
        .eq("id", editingId);

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
      } else {
        setMessage("Labour expense updated successfully.");
        resetForm();
        await fetchExpenses();
      }
    } else {
      const { error: insertError } = await supabase
        .from("labour_expenses")
        .insert([payload]);

      if (insertError) {
        console.error(insertError);
        setError(insertError.message);
      } else {
        setMessage("Labour expense added successfully.");
        resetForm();
        await fetchExpenses();
      }
    }

    setSaving(false);
  };

  // ============================================================
  // EDIT
  // ============================================================

  const handleEdit = (expense: LabourExpense) => {
    setEditingId(expense.id);

    setForm({
      expense_date: expense.expense_date,
      branch: expense.branch,
      item_description: expense.item_description,
      quantity: String(expense.quantity ?? 1),
      unit: expense.unit ?? "",
      amount: String(expense.amount ?? 0),
      payment_method: expense.payment_method,
      notes: expense.notes ?? "",
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this labour expense?"
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase
      .from("labour_expenses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setMessage("Labour expense deleted successfully.");

    if (editingId === id) {
      resetForm();
    }

    await fetchExpenses();
  };

  // ============================================================
  // FILTERED EXPENSES
  // ============================================================

  const filteredExpenses = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !searchText ||
        expense.item_description.toLowerCase().includes(searchText) ||
        (expense.notes || "").toLowerCase().includes(searchText) ||
        expense.branch.toLowerCase().includes(searchText);

      const matchesBranch =
        branchFilter === "ALL" || expense.branch === branchFilter;

      const matchesPayment =
        paymentFilter === "ALL" ||
        expense.payment_method === paymentFilter;

      const matchesFrom =
        !dateFrom || expense.expense_date >= dateFrom;

      const matchesTo =
        !dateTo || expense.expense_date <= dateTo;

      return (
        matchesSearch &&
        matchesBranch &&
        matchesPayment &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    expenses,
    search,
    branchFilter,
    paymentFilter,
    dateFrom,
    dateTo,
  ]);

  // ============================================================
  // TOTALS
  // ============================================================

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    );
  }, [filteredExpenses]);

  const totalQuantity = useMemo(() => {
    return filteredExpenses.reduce(
      (total, expense) => total + Number(expense.quantity || 0),
      0
    );
  }, [filteredExpenses]);

  const totalRecords = filteredExpenses.length;

  // ============================================================
  // BRANCH TOTALS
  // ============================================================

  const branchTotals = useMemo(() => {
    return BRANCHES.map((branch) => {
      const branchExpenses = filteredExpenses.filter(
        (expense) => expense.branch === branch
      );

      return {
        branch,
        records: branchExpenses.length,
        amount: branchExpenses.reduce(
          (total, expense) => total + Number(expense.amount || 0),
          0
        ),
      };
    });
  }, [filteredExpenses]);

  // ============================================================
  // FORMATTERS
  // ============================================================

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (value: string) => {
    if (!value) return "";

    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // ============================================================
  // REPORT DATE RANGE
  // ============================================================

  const getReportPeriod = (data: LabourExpense[]) => {
    if (data.length === 0) {
      return "All Records";
    }

    const dates = data
      .map((item) => item.expense_date)
      .sort();

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    if (firstDate === lastDate) {
      return formatDate(firstDate);
    }

    return `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
  };

  // ============================================================
  // PDF EXPORT
  // ============================================================

  const exportPDF = (
    data: LabourExpense[],
    reportTitle: string,
    includeBranchColumn: boolean
  ) => {
    if (data.length === 0) {
      setError("There are no records available for this PDF report.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const reportPeriod = getReportPeriod(data);

      const reportTotalAmount = data.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

      const reportTotalQuantity = data.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );

      // --------------------------------------------------------
      // HEADER
      // --------------------------------------------------------

      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, pageWidth, 34, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("AL SHAMS ERP", 14, 13);

      doc.setFontSize(13);
      doc.text(reportTitle, 14, 21);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(190, 190, 190);

      doc.text(
        `Report Period: ${reportPeriod}`,
        14,
        28
      );

      doc.text(
        `Generated: ${new Date().toLocaleString("en-GB")}`,
        pageWidth - 14,
        28,
        { align: "right" }
      );

      // --------------------------------------------------------
      // SUMMARY BOXES
      // --------------------------------------------------------

      const summaryY = 42;

      doc.setFillColor(245, 245, 245);
      doc.roundedRect(14, summaryY, 72, 19, 3, 3, "F");

      doc.roundedRect(92, summaryY, 72, 19, 3, 3, "F");

      doc.roundedRect(170, summaryY, 72, 19, 3, 3, "F");

      doc.setTextColor(90, 90, 90);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      doc.text("TOTAL RECORDS", 18, summaryY + 7);
      doc.text("TOTAL QUANTITY", 96, summaryY + 7);
      doc.text("TOTAL EXPENSE", 174, summaryY + 7);

      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);

      doc.text(
        String(data.length),
        18,
        summaryY + 15
      );

      doc.text(
        Number(reportTotalQuantity).toLocaleString(),
        96,
        summaryY + 15
      );

      doc.text(
        `${formatAmount(reportTotalAmount)} SAR`,
        174,
        summaryY + 15
      );

      // --------------------------------------------------------
      // TABLE
      // --------------------------------------------------------

      const tableHead = includeBranchColumn
        ? [
            [
              "Date",
              "Branch",
              "Item / Description",
              "Quantity",
              "Unit",
              "Amount (SAR)",
              "Payment",
              "Notes",
            ],
          ]
        : [
            [
              "Date",
              "Item / Description",
              "Quantity",
              "Unit",
              "Amount (SAR)",
              "Payment",
              "Notes",
            ],
          ];

      const tableBody = data.map((expense) => {
        if (includeBranchColumn) {
          return [
            formatDate(expense.expense_date),
            expense.branch,
            expense.item_description,
            Number(expense.quantity || 0).toLocaleString(),
            expense.unit || "-",
            formatAmount(Number(expense.amount || 0)),
            expense.payment_method,
            expense.notes || "-",
          ];
        }

        return [
          formatDate(expense.expense_date),
          expense.item_description,
          Number(expense.quantity || 0).toLocaleString(),
          expense.unit || "-",
          formatAmount(Number(expense.amount || 0)),
          expense.payment_method,
          expense.notes || "-",
        ];
      });

      autoTable(doc, {
        startY: 68,
        head: tableHead,
        body: tableBody,

        theme: "grid",

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 3,
          textColor: [35, 35, 35],
          lineColor: [210, 210, 210],
          lineWidth: 0.2,
          valign: "middle",
        },

        headStyles: {
          fillColor: [25, 25, 25],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },

        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },

        columnStyles: includeBranchColumn
          ? {
              0: { cellWidth: 25 },
              1: { cellWidth: 32 },
              2: { cellWidth: 52 },
              3: { cellWidth: 22, halign: "right" },
              4: { cellWidth: 20 },
              5: { cellWidth: 28, halign: "right" },
              6: { cellWidth: 25 },
              7: { cellWidth: "auto" },
            }
          : {
              0: { cellWidth: 27 },
              1: { cellWidth: 62 },
              2: { cellWidth: 25, halign: "right" },
              3: { cellWidth: 22 },
              4: { cellWidth: 32, halign: "right" },
              5: { cellWidth: 28 },
              6: { cellWidth: "auto" },
            },

        didDrawPage: (pageData) => {
          const pageNumber = pageData.pageNumber;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);

          doc.text(
            "AL SHAMS ERP - Labour Expenses",
            14,
            pageHeight - 8
          );

          doc.text(
            `Page ${pageNumber}`,
            pageWidth - 14,
            pageHeight - 8,
            { align: "right" }
          );
        },
      });

      // --------------------------------------------------------
      // FINAL TOTAL
      // --------------------------------------------------------

      const finalY =
        (doc as jsPDF & { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY ?? 68;

      let summaryBottomY = finalY + 10;

      if (summaryBottomY > pageHeight - 30) {
        doc.addPage();
        summaryBottomY = 20;
      }

      doc.setFillColor(245, 245, 245);
      doc.roundedRect(
        14,
        summaryBottomY,
        pageWidth - 28,
        18,
        3,
        3,
        "F"
      );

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);

      doc.text(
        `TOTAL: ${data.length} RECORDS`,
        20,
        summaryBottomY + 11
      );

      doc.text(
        `QUANTITY: ${Number(reportTotalQuantity).toLocaleString()}`,
        pageWidth / 2,
        summaryBottomY + 11,
        { align: "center" }
      );

      doc.text(
        `TOTAL EXPENSE: ${formatAmount(reportTotalAmount)} SAR`,
        pageWidth - 20,
        summaryBottomY + 11,
        { align: "right" }
      );

      // --------------------------------------------------------
      // FILE NAME
      // --------------------------------------------------------

      const safeTitle = reportTitle
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const fileName = `${safeTitle}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      doc.save(fileName);

      setMessage("PDF exported successfully.");
    } catch (pdfError) {
      console.error(pdfError);
      setError(
        "PDF export failed. Please check that jsPDF and jspdf-autotable are installed."
      );
    }
  };

  // ============================================================
  // SINGLE BRANCH PDF
  // ============================================================

  const exportSingleBranchPDF = () => {
    if (branchFilter === "ALL") {
      setError(
        "Please select one branch from the Branch filter before exporting a Single Branch PDF."
      );
      return;
    }

    const branchData = filteredExpenses.filter(
      (expense) => expense.branch === branchFilter
    );

    if (branchData.length === 0) {
      setError(
        `No records found for ${branchFilter} with the current filters.`
      );
      return;
    }

    exportPDF(
      branchData,
      `${branchFilter} Labour Expenses`,
      false
    );
  };

  // ============================================================
  // COMBINED PDF
  // ============================================================

  const exportCombinedPDF = () => {
    const combinedData = filteredExpenses;

    if (combinedData.length === 0) {
      setError(
        "There are no labour expense records available for the combined PDF."
      );
      return;
    }

    exportPDF(
      combinedData,
      "Combined Labour Expenses - All Branches",
      true
    );
  };

  // ============================================================
  // EXCEL EXPORT
  // ============================================================

  const exportExcel = (
    data: LabourExpense[],
    reportTitle: string,
    includeBranchColumn: boolean
  ) => {
    if (data.length === 0) {
      setError("There are no records available for this Excel report.");
      return;
    }

    try {
      const reportTotalAmount = data.reduce(
        (total, item) => total + Number(item.amount || 0),
        0
      );

      const reportTotalQuantity = data.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0
      );

      const rows = data.map((expense) => {
        if (includeBranchColumn) {
          return {
            Date: expense.expense_date,
            Branch: expense.branch,
            "Item / Description": expense.item_description,
            Quantity: Number(expense.quantity || 0),
            Unit: expense.unit || "",
            "Amount (SAR)": Number(expense.amount || 0),
            "Payment Method": expense.payment_method,
            Notes: expense.notes || "",
          };
        }

        return {
          Date: expense.expense_date,
          "Item / Description": expense.item_description,
          Quantity: Number(expense.quantity || 0),
          Unit: expense.unit || "",
          "Amount (SAR)": Number(expense.amount || 0),
          "Payment Method": expense.payment_method,
          Notes: expense.notes || "",
        };
      });

      // Summary rows at the top
      const summaryRows = [
        {
          [reportTitle]: "",
          "Total Records": data.length,
          "Total Quantity": reportTotalQuantity,
          "Total Expense (SAR)": reportTotalAmount,
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Add title above data
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          ["AL SHAMS ERP"],
          [reportTitle],
          [`Report Period: ${getReportPeriod(data)}`],
          [],
        ],
        { origin: "A1" }
      );

      // Add summary to the right
      XLSX.utils.sheet_add_json(
        worksheet,
        summaryRows,
        {
          origin: "J1",
          skipHeader: false,
        }
      );

      // Header row begins at A5
      const headerRow = includeBranchColumn
        ? [
            "Date",
            "Branch",
            "Item / Description",
            "Quantity",
            "Unit",
            "Amount (SAR)",
            "Payment Method",
            "Notes",
          ]
        : [
            "Date",
            "Item / Description",
            "Quantity",
            "Unit",
            "Amount (SAR)",
            "Payment Method",
            "Notes",
          ];

      XLSX.utils.sheet_add_aoa(
        worksheet,
        [headerRow],
        { origin: "A5" }
      );

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Labour Expenses"
      );

      // Column widths
      worksheet["!cols"] = includeBranchColumn
        ? [
            { wch: 14 },
            { wch: 22 },
            { wch: 32 },
            { wch: 12 },
            { wch: 12 },
            { wch: 17 },
            { wch: 18 },
            { wch: 35 },
          ]
        : [
            { wch: 14 },
            { wch: 38 },
            { wch: 12 },
            { wch: 12 },
            { wch: 17 },
            { wch: 18 },
            { wch: 35 },
          ];

      const safeTitle = reportTitle
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      XLSX.writeFile(
        workbook,
        `${safeTitle}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );

      setMessage("Excel file exported successfully.");
      setError("");
    } catch (excelError) {
      console.error(excelError);
      setError(
        "Excel export failed. Please check that the xlsx package is installed."
      );
    }
  };

  // ============================================================
  // SINGLE BRANCH EXCEL
  // ============================================================

  const exportSingleBranchExcel = () => {
    if (branchFilter === "ALL") {
      setError(
        "Please select one branch from the Branch filter before exporting a Single Branch Excel file."
      );
      return;
    }

    const branchData = filteredExpenses.filter(
      (expense) => expense.branch === branchFilter
    );

    if (branchData.length === 0) {
      setError(
        `No records found for ${branchFilter} with the current filters.`
      );
      return;
    }

    exportExcel(
      branchData,
      `${branchFilter} Labour Expenses`,
      false
    );
  };

  // ============================================================
  // COMBINED EXCEL
  // ============================================================

  const exportCombinedExcel = () => {
    if (filteredExpenses.length === 0) {
      setError(
        "There are no labour expense records available for the combined Excel file."
      );
      return;
    }

    exportExcel(
      filteredExpenses,
      "Combined Labour Expenses - All Branches",
      true
    );
  };

  // ============================================================
  // CLEAR FILTERS
  // ============================================================

  const clearFilters = () => {
    setSearch("");
    setBranchFilter("ALL");
    setPaymentFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px",
        background: "#050505",
        color: "#ffffff",
        boxSizing: "border-box",
      }}
    >
      {/* ======================================================
          HEADER
      ======================================================= */}

      <div style={{ marginBottom: "25px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "0.5px",
          }}
        >
          Labour Expenses
        </h1>

        <p
          style={{
            marginTop: "8px",
            marginBottom: 0,
            color: "#9ca3af",
            fontSize: "14px",
          }}
        >
          Daily food, utility and other labour-related expenses
        </p>
      </div>

      {/* ======================================================
          MESSAGES
      ======================================================= */}

      {message && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(34, 197, 94, 0.12)",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            color: "#86efac",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* ======================================================
          ENTRY FORM
      ======================================================= */}

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#101010",
          border: "1px solid #242424",
          borderRadius: "14px",
          padding: "22px",
          marginBottom: "25px",
          boxShadow: "0 0 25px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "20px" }}>
            {editingId !== null
              ? "Edit Labour Expense"
              : "Add Labour Expense"}
          </h2>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              style={secondaryButtonStyle}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div style={formGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Date *</label>

            <input
              type="date"
              value={form.expense_date}
              onChange={(e) =>
                handleChange("expense_date", e.target.value)
              }
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Branch *</label>

            <select
              value={form.branch}
              onChange={(e) =>
                handleChange("branch", e.target.value)
              }
              style={inputStyle}
            >
              {BRANCHES.map((branch) => (
                <option
                  key={branch}
                  value={branch}
                  style={{
                    background: "#111111",
                    color: "#ffffff",
                  }}
                >
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Item / Description *
            </label>

            <input
              type="text"
              value={form.item_description}
              onChange={(e) =>
                handleChange(
                  "item_description",
                  e.target.value
                )
              }
              placeholder="e.g. Rice, Chicken, Water, Gas"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Quantity</label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) =>
                handleChange("quantity", e.target.value)
              }
              placeholder="1"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Unit</label>

            <input
              type="text"
              value={form.unit}
              onChange={(e) =>
                handleChange("unit", e.target.value)
              }
              placeholder="KG, BOX, PCS..."
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Amount (SAR) *</label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                handleChange("amount", e.target.value)
              }
              placeholder="0.00"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Payment Method *
            </label>

            <select
              value={form.payment_method}
              onChange={(e) =>
                handleChange(
                  "payment_method",
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {PAYMENT_METHODS.map((method) => (
                <option
                  key={method}
                  value={method}
                  style={{
                    background: "#111111",
                    color: "#ffffff",
                  }}
                >
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Notes</label>

            <input
              type="text"
              value={form.notes}
              onChange={(e) =>
                handleChange("notes", e.target.value)
              }
              placeholder="Optional notes"
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "20px",
          }}
        >
          <button
            type="submit"
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : editingId !== null
              ? "Update Expense"
              : "Add Expense"}
          </button>
        </div>
      </form>

      {/* ======================================================
          SUMMARY CARDS
      ======================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <SummaryCard
          title="Total Records"
          value={String(totalRecords)}
        />

        <SummaryCard
          title="Total Quantity"
          value={totalQuantity.toLocaleString()}
        />

        <SummaryCard
          title="Total Expenses"
          value={`${formatAmount(totalAmount)} SAR`}
          highlight
        />
      </div>

      {/* ======================================================
          BRANCH SUMMARY
      ======================================================= */}

      <div
        style={{
          background: "#101010",
          border: "1px solid #242424",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "25px",
          overflowX: "auto",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "18px",
            fontSize: "19px",
          }}
        >
          Branch Summary
        </h2>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "600px",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Records</th>
              <th style={thStyle}>Total Amount</th>
            </tr>
          </thead>

          <tbody>
            {branchTotals.map((item) => (
              <tr key={item.branch}>
                <td style={tdStyle}>{item.branch}</td>

                <td style={tdStyle}>{item.records}</td>

                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 700,
                  }}
                >
                  {formatAmount(item.amount)} SAR
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ======================================================
          FILTERS
      ======================================================= */}

      <div
        style={{
          background: "#101010",
          border: "1px solid #242424",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
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
          <h2
            style={{
              margin: 0,
              fontSize: "19px",
            }}
          >
            Filters
          </h2>

          <button
            type="button"
            onClick={clearFilters}
            style={secondaryButtonStyle}
          >
            Clear Filters
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <div style={fieldStyle}>
            <label style={labelStyle}>Search</label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, branch, notes..."
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Branch</label>

            <select
              value={branchFilter}
              onChange={(e) =>
                setBranchFilter(e.target.value)
              }
              style={inputStyle}
            >
              <option
                value="ALL"
                style={{
                  background: "#111111",
                  color: "#ffffff",
                }}
              >
                All Branches
              </option>

              {BRANCHES.map((branch) => (
                <option
                  key={branch}
                  value={branch}
                  style={{
                    background: "#111111",
                    color: "#ffffff",
                  }}
                >
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Payment Method
            </label>

            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value)
              }
              style={inputStyle}
            >
              <option
                value="ALL"
                style={{
                  background: "#111111",
                  color: "#ffffff",
                }}
              >
                All Methods
              </option>

              {PAYMENT_METHODS.map((method) => (
                <option
                  key={method}
                  value={method}
                  style={{
                    background: "#111111",
                    color: "#ffffff",
                  }}
                >
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>From Date</label>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>To Date</label>

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ======================================================
          EXPORT BUTTONS
      ======================================================= */}

      <div
        style={{
          background: "#101010",
          border: "1px solid #242424",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <div style={{ marginBottom: "15px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "19px",
            }}
          >
            Export Reports
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#9ca3af",
              fontSize: "13px",
            }}
          >
            Use the Branch filter to export one branch, or use
            Combined to export all branches together.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={exportSingleBranchPDF}
            disabled={branchFilter === "ALL"}
            style={{
              ...exportButtonStyle,
              opacity: branchFilter === "ALL" ? 0.45 : 1,
              cursor:
                branchFilter === "ALL"
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            📄 Single Branch PDF
          </button>

          <button
            type="button"
            onClick={exportCombinedPDF}
            style={exportButtonStyle}
          >
            📄 Combined PDF
          </button>

          <button
            type="button"
            onClick={exportSingleBranchExcel}
            disabled={branchFilter === "ALL"}
            style={{
              ...excelButtonStyle,
              opacity: branchFilter === "ALL" ? 0.45 : 1,
              cursor:
                branchFilter === "ALL"
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            📊 Single Branch Excel
          </button>

          <button
            type="button"
            onClick={exportCombinedExcel}
            style={excelButtonStyle}
          >
            📊 Combined Excel
          </button>
        </div>

        {branchFilter !== "ALL" && (
          <div
            style={{
              marginTop: "13px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "rgba(59, 130, 246, 0.10)",
              border:
                "1px solid rgba(59, 130, 246, 0.25)",
              color: "#93c5fd",
              fontSize: "13px",
            }}
          >
            Single branch export selected:{" "}
            <strong>{branchFilter}</strong>
          </div>
        )}
      </div>

      {/* ======================================================
          RECORDS TABLE
      ======================================================= */}

      <div
        style={{
          background: "#101010",
          border: "1px solid #242424",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #242424",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
              }}
            >
              Labour Expense Records
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              Showing {filteredExpenses.length} record
              {filteredExpenses.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            {formatAmount(totalAmount)} SAR
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            Loading labour expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div
            style={{
              padding: "50px",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            No labour expenses found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1050px",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Branch</th>
                  <th style={thStyle}>
                    Item / Description
                  </th>
                  <th style={thStyle}>Quantity</th>
                  <th style={thStyle}>Unit</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Notes</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td style={tdStyle}>
                      {formatDate(expense.expense_date)}
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: "#181818",
                          border: "1px solid #303030",
                          fontSize: "12px",
                        }}
                      >
                        {expense.branch}
                      </span>
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 600,
                      }}
                    >
                      {expense.item_description}
                    </td>

                    <td style={tdStyle}>
                      {Number(
                        expense.quantity
                      ).toLocaleString()}
                    </td>

                    <td style={tdStyle}>
                      {expense.unit || "-"}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatAmount(
                        Number(expense.amount)
                      )}{" "}
                      SAR
                    </td>

                    <td style={tdStyle}>
                      {expense.payment_method}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        color: "#9ca3af",
                      }}
                    >
                      {expense.notes || "-"}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "7px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(expense)
                          }
                          style={smallButtonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(expense.id)
                          }
                          style={{
                            ...smallButtonStyle,
                            borderColor:
                              "rgba(239,68,68,0.35)",
                            color: "#fca5a5",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tdStyle,
                      fontWeight: 800,
                      textAlign: "right",
                    }}
                  >
                    FILTERED TOTAL:
                  </td>

                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 900,
                      fontSize: "16px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatAmount(totalAmount)} SAR
                  </td>

                  <td colSpan={3} style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "#101010",
        border: highlight
          ? "1px solid rgba(59, 130, 246, 0.45)"
          : "1px solid #242424",
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <div
        style={{
          color: "#9ca3af",
          fontSize: "13px",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "24px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "15px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#d1d5db",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: "8px",
  border: "1px solid #303030",
  background: "#080808",
  color: "#ffffff",
  outline: "none",
  fontSize: "14px",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "11px 20px",
  borderRadius: "8px",
  border: "1px solid rgba(59,130,246,0.55)",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "9px 15px",
  borderRadius: "8px",
  border: "1px solid #303030",
  background: "#151515",
  color: "#d1d5db",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: "6px",
  border: "1px solid #303030",
  background: "#151515",
  color: "#d1d5db",
  fontWeight: 600,
  fontSize: "12px",
  cursor: "pointer",
};

const exportButtonStyle: React.CSSProperties = {
  padding: "11px 16px",
  borderRadius: "8px",
  border: "1px solid rgba(239, 68, 68, 0.45)",
  background: "#171717",
  color: "#fca5a5",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const excelButtonStyle: React.CSSProperties = {
  padding: "11px 16px",
  borderRadius: "8px",
  border: "1px solid rgba(34, 197, 94, 0.45)",
  background: "#171717",
  color: "#86efac",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "13px 12px",
  textAlign: "left",
  borderBottom: "1px solid #303030",
  background: "#0b0b0b",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  borderBottom: "1px solid #202020",
  color: "#e5e7eb",
  fontSize: "13px",
  verticalAlign: "middle",
};

export default LabourExpenses;