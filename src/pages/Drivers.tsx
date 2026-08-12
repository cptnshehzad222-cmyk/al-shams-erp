import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

// ============================================================
// TYPES
// ============================================================

type Driver = {
  id: number;
  driver_name: string;
  phone: string | null;
  active: boolean | null;
  created_at: string;
};

type DriverExpense = {
  id: number;
  driver_id: number;
  expense_date: string;
  expense_type: "Diesel" | "Food" | "Other";
  vehicle: string | null;
  supplier_name: string;
  supplier_vat_number: string | null;
  supplier_address: string | null;
  invoice_number: string;
  invoice_date: string;
  item_description: string;
  quantity: number | null;
  unit: string | null;
  total_amount: number;
  vat_rate: number;
  vat_amount: number;
  amount_before_vat: number;
  payment_method: string;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

type DriverPayment = {
  id: number;
  driver_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// CONSTANTS
// ============================================================

const EXPENSE_TYPES = ["Diesel", "Food", "Other"];
const PAYMENT_METHODS = ["Cash", "Bank", "Transfer", "Other"];
const STORAGE_BUCKET = "driver-invoices";

const EMPTY_EXPENSE_FORM = {
  driver_id: "",
  expense_date: new Date().toISOString().split("T")[0],
  expense_type: "Diesel",
  vehicle: "",
  supplier_name: "",
  supplier_vat_number: "",
  supplier_address: "",
  invoice_number: "",
  invoice_date: new Date().toISOString().split("T")[0],
  item_description: "",
  quantity: "",
  unit: "",
  total_amount: "",
  vat_rate: "15",
  payment_method: "Cash",
  notes: "",
};

const EMPTY_PAYMENT_FORM = {
  driver_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "Cash",
  reference_number: "",
  notes: "",
};

// ============================================================
// MAIN COMPONENT
// ============================================================

function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [payments, setPayments] = useState<DriverPayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "expenses" | "payments" | "reports" | "vat"
  >("expenses");

  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);

  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [search, setSearch] = useState("");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportDriver, setReportDriver] = useState("ALL");

  // ==========================================================
  // FETCH ALL DATA
  // ==========================================================

  const fetchAllData = async () => {
    setLoading(true);
    setError("");

    const [driversResult, expensesResult, paymentsResult] = await Promise.all([
      supabase.from("drivers").select("*").order("driver_name", { ascending: true }),
      supabase.from("driver_expenses").select("*").order("expense_date", { ascending: false }).order("id", { ascending: false }),
      supabase.from("driver_payments").select("*").order("payment_date", { ascending: false }).order("id", { ascending: false }),
    ]);

    if (driversResult.error) {
      console.error(driversResult.error);
      setError(driversResult.error.message);
    } else {
      setDrivers((driversResult.data || []) as Driver[]);
    }

    if (expensesResult.error) {
      console.error(expensesResult.error);
      setError(expensesResult.error.message);
    } else {
      setExpenses((expensesResult.data || []) as DriverExpense[]);
    }

    if (paymentsResult.error) {
      console.error(paymentsResult.error);
      setError(paymentsResult.error.message);
    } else {
      setPayments((paymentsResult.data || []) as DriverPayment[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const getDriverName = (driverId: number) => {
    const driver = drivers.find((item) => item.id === driverId);
    return driver?.driver_name || "Unknown Driver";
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
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

  const showMessage = (text: string) => {
    setMessage(text);
    setError("");
    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  const showError = (text: string) => {
    setError(text);
    setMessage("");
  };

  // ==========================================================
  // VAT CALCULATION
  // ==========================================================

  const totalInvoiceAmount = Number(expenseForm.total_amount) || 0;
  const vatRate = Number(expenseForm.vat_rate) || 0;
  const calculatedVat = totalInvoiceAmount > 0 ? (totalInvoiceAmount * vatRate) / (100 + vatRate) : 0;
  const calculatedNet = totalInvoiceAmount - calculatedVat;

  // ==========================================================
  // DRIVER BALANCES
  // ==========================================================

  const driverBalances = useMemo(() => {
    return drivers.map((driver) => {
      const driverExpenses = expenses.filter((expense) => expense.driver_id === driver.id);
      const driverPayments = payments.filter((payment) => payment.driver_id === driver.id);

      const moneyReceived = driverPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      const diesel = driverExpenses
        .filter((expense) => expense.expense_type === "Diesel")
        .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

      const food = driverExpenses
        .filter((expense) => expense.expense_type === "Food")
        .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

      const other = driverExpenses
        .filter((expense) => expense.expense_type === "Other")
        .reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);

      const totalSpent = diesel + food + other;
      const remaining = moneyReceived - totalSpent;

      return {
        driver,
        moneyReceived,
        diesel,
        food,
        other,
        totalSpent,
        remaining,
      };
    });
  }, [drivers, expenses, payments]);

  const selectedPaymentDriverBalance = useMemo(() => {
    if (!paymentForm.driver_id) return 0;
    const driverId = Number(paymentForm.driver_id);
    const balance = driverBalances.find((item) => item.driver.id === driverId);
    return balance?.remaining || 0;
  }, [paymentForm.driver_id, driverBalances]);

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleExpenseChange = (field: keyof typeof EMPTY_EXPENSE_FORM, value: string) => {
    setExpenseForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setMessage("");
    setError("");
  };

  const handlePaymentChange = (field: keyof typeof EMPTY_PAYMENT_FORM, value: string) => {
    setPaymentForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setMessage("");
    setError("");
  };

  // ==========================================================
  // RESET FORMS
  // ==========================================================

  const resetExpenseForm = () => {
    setExpenseForm({
      ...EMPTY_EXPENSE_FORM,
      expense_date: new Date().toISOString().split("T")[0],
      invoice_date: new Date().toISOString().split("T")[0],
    });
    setEditingExpenseId(null);
    setSelectedFile(null);
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      payment_date: new Date().toISOString().split("T")[0],
    });
    setEditingPaymentId(null);
  };

  // ==========================================================
  // UPLOAD ATTACHMENT
  // ==========================================================

  const uploadAttachment = async (file: File, prefix: string) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${prefix}_${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ==========================================================
  // SAVE EXPENSE
  // ==========================================================

  const handleExpenseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!expenseForm.driver_id) {
      showError("Please select a driver.");
      return;
    }

    if (!expenseForm.expense_date) {
      showError("Please select the expense date.");
      return;
    }

    if (!expenseForm.expense_type) {
      showError("Please select the expense type.");
      return;
    }

    if (!expenseForm.supplier_name.trim()) {
      showError("Please enter the supplier name.");
      return;
    }

    if (!expenseForm.invoice_number.trim()) {
      showError("Please enter the invoice number.");
      return;
    }

    if (!expenseForm.invoice_date) {
      showError("Please enter the invoice date.");
      return;
    }

    if (!expenseForm.item_description.trim()) {
      showError("Please enter the item description.");
      return;
    }

    if (!Number.isFinite(totalInvoiceAmount) || totalInvoiceAmount <= 0) {
      showError("Please enter a valid total invoice amount.");
      return;
    }

    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      showError("Please enter a valid VAT rate.");
      return;
    }

    setSaving(true);

    try {
      let attachmentUrl =
        editingExpenseId !== null
          ? expenses.find((item) => item.id === editingExpenseId)?.attachment_url || null
          : null;

      if (selectedFile) {
        attachmentUrl = await uploadAttachment(selectedFile, "driver_expense");
      }

      const payload = {
        driver_id: Number(expenseForm.driver_id),
        expense_date: expenseForm.expense_date,
        expense_type: expenseForm.expense_type,
        vehicle: expenseForm.vehicle.trim() || null,
        supplier_name: expenseForm.supplier_name.trim(),
        supplier_vat_number: expenseForm.supplier_vat_number.trim() || null,
        supplier_address: expenseForm.supplier_address.trim() || null,
        invoice_number: expenseForm.invoice_number.trim(),
        invoice_date: expenseForm.invoice_date,
        item_description: expenseForm.item_description.trim(),
        quantity: expenseForm.quantity ? Number(expenseForm.quantity) : null,
        unit: expenseForm.unit.trim() || null,
        total_amount: Number(totalInvoiceAmount.toFixed(2)),
        vat_rate: Number(vatRate.toFixed(2)),
        vat_amount: Number(calculatedVat.toFixed(2)),
        amount_before_vat: Number(calculatedNet.toFixed(2)),
        payment_method: expenseForm.payment_method,
        notes: expenseForm.notes.trim() || null,
        attachment_url: attachmentUrl,
      };

      if (editingExpenseId !== null) {
        const { error: updateError } = await supabase
          .from("driver_expenses")
          .update(payload)
          .eq("id", editingExpenseId);

        if (updateError) {
          throw updateError;
        }

        showMessage("Driver expense invoice updated successfully.");
      } else {
        const { error: insertError } = await supabase.from("driver_expenses").insert([payload]);
        if (insertError) {
          throw insertError;
        }
        showMessage("Driver expense invoice added successfully.");
      }

      resetExpenseForm();
      await fetchAllData();
    } catch (err: any) {
      console.error(err);
      showError(err?.message || "Failed to save driver expense.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // EDIT EXPENSE
  // ==========================================================

  const handleEditExpense = (expense: DriverExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      driver_id: String(expense.driver_id),
      expense_date: expense.expense_date,
      expense_type: expense.expense_type,
      vehicle: expense.vehicle || "",
      supplier_name: expense.supplier_name,
      supplier_vat_number: expense.supplier_vat_number || "",
      supplier_address: expense.supplier_address || "",
      invoice_number: expense.invoice_number,
      invoice_date: expense.invoice_date,
      item_description: expense.item_description,
      quantity: expense.quantity !== null ? String(expense.quantity) : "",
      unit: expense.unit || "",
      total_amount: String(expense.total_amount),
      vat_rate: String(expense.vat_rate),
      payment_method: expense.payment_method,
      notes: expense.notes || "",
    });
    setSelectedFile(null);
    setActiveTab("expenses");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ==========================================================
  // DELETE EXPENSE
  // ==========================================================

  const handleDeleteExpense = async (id: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this driver expense invoice?");
    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error: deleteError } = await supabase.from("driver_expenses").delete().eq("id", id);

    if (deleteError) {
      showError(deleteError.message);
      return;
    }

    showMessage("Driver expense invoice deleted successfully.");
    await fetchAllData();
  };

  // ==========================================================
  // SAVE PAYMENT
  // ==========================================================

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!paymentForm.driver_id) {
      showError("Please select a driver.");
      return;
    }

    if (!paymentForm.payment_date) {
      showError("Please select a payment date.");
      return;
    }

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError("Please enter a valid payment amount.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        driver_id: Number(paymentForm.driver_id),
        payment_date: paymentForm.payment_date,
        amount: Number(amount.toFixed(2)),
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number.trim() || null,
        notes: paymentForm.notes.trim() || null,
      };

      if (editingPaymentId !== null) {
        const { error: updateError } = await supabase
          .from("driver_payments")
          .update(payload)
          .eq("id", editingPaymentId);

        if (updateError) {
          throw updateError;
        }
        showMessage("Driver payment updated successfully.");
      } else {
        const { error: insertError } = await supabase.from("driver_payments").insert([payload]);
        if (insertError) {
          throw insertError;
        }
        showMessage("Driver payment recorded successfully.");
      }

      resetPaymentForm();
      await fetchAllData();
    } catch (err: any) {
      console.error(err);
      showError(err?.message || "Failed to save driver payment.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // EDIT PAYMENT
  // ==========================================================

  const handleEditPayment = (payment: DriverPayment) => {
    setEditingPaymentId(payment.id);
    setPaymentForm({
      driver_id: String(payment.driver_id),
      payment_date: payment.payment_date,
      amount: String(payment.amount),
      payment_method: payment.payment_method,
      reference_number: payment.reference_number || "",
      notes: payment.notes || "",
    });
    setActiveTab("payments");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ==========================================================
  // DELETE PAYMENT
  // ==========================================================

  const handleDeletePayment = async (id: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this driver payment?");
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from("driver_payments").delete().eq("id", id);

    if (deleteError) {
      showError(deleteError.message);
      return;
    }

    showMessage("Driver payment deleted successfully.");
    await fetchAllData();
  };

  // ==========================================================
  // FILTERED EXPENSES
  // ==========================================================

  const filteredExpenses = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !searchText ||
        expense.invoice_number.toLowerCase().includes(searchText) ||
        expense.supplier_name.toLowerCase().includes(searchText) ||
        expense.item_description.toLowerCase().includes(searchText) ||
        getDriverName(expense.driver_id).toLowerCase().includes(searchText);

      const matchesDriver = driverFilter === "ALL" || String(expense.driver_id) === driverFilter;
      const matchesType = expenseTypeFilter === "ALL" || expense.expense_type === expenseTypeFilter;
      const matchesFrom = !dateFrom || expense.expense_date >= dateFrom;
      const matchesTo = !dateTo || expense.expense_date <= dateTo;

      return matchesSearch && matchesDriver && matchesType && matchesFrom && matchesTo;
    });
  }, [expenses, search, driverFilter, expenseTypeFilter, dateFrom, dateTo, drivers]);

  // ==========================================================
  // REPORT DATA
  // ==========================================================

  const reportExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesDriver = reportDriver === "ALL" || String(expense.driver_id) === reportDriver;
      const matchesFrom = !dateFrom || expense.expense_date >= dateFrom;
      const matchesTo = !dateTo || expense.expense_date <= dateTo;
      return matchesDriver && matchesFrom && matchesTo;
    });
  }, [expenses, reportDriver, dateFrom, dateTo]);

  const reportPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesDriver = reportDriver === "ALL" || String(payment.driver_id) === reportDriver;
      const matchesFrom = !dateFrom || payment.payment_date >= dateFrom;
      const matchesTo = !dateTo || payment.payment_date <= dateTo;
      return matchesDriver && matchesFrom && matchesTo;
    });
  }, [payments, reportDriver, dateFrom, dateTo]);

  // ==========================================================
  // VAT REPORT DATA
  // ==========================================================

  const vatReportExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesDriver = reportDriver === "ALL" || String(expense.driver_id) === reportDriver;
      const matchesFrom = !dateFrom || expense.invoice_date >= dateFrom;
      const matchesTo = !dateTo || expense.invoice_date <= dateTo;
      return matchesDriver && matchesFrom && matchesTo;
    });
  }, [expenses, reportDriver, dateFrom, dateTo]);

  const totalVat = useMemo(() => {
    return vatReportExpenses.reduce((sum, expense) => sum + Number(expense.vat_amount || 0), 0);
  }, [vatReportExpenses]);

  const totalNet = useMemo(() => {
    return vatReportExpenses.reduce((sum, expense) => sum + Number(expense.amount_before_vat || 0), 0);
  }, [vatReportExpenses]);

  const totalVatInvoiceAmount = useMemo(() => {
    return vatReportExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);
  }, [vatReportExpenses]);

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch("");
    setDriverFilter("ALL");
    setExpenseTypeFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  // ==========================================================
  // PDF HELPERS
  // ==========================================================

  const createPdfHeader = (doc: jsPDF, title: string) => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AL SHAMS ERP", 14, 18);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(title, 14, 27);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 34);

    doc.line(14, 38, 196, 38);
  };

  const addPdfTable = (doc: jsPDF, headers: string[], rows: string[][], startY: number, columnWidths?: number[]) => {
    let y = startY;
    const widths = columnWidths || headers.map(() => 182 / headers.length);

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");

    let x = 14;
    headers.forEach((header, index) => {
      doc.rect(x, y, widths[index], 8);
      doc.text(header.substring(0, 22), x + 2, y + 5);
      x += widths[index];
    });

    y += 8;
    doc.setFont("helvetica", "normal");

    rows.forEach((row) => {
      if (y > 275) {
        doc.addPage();
        y = 15;
        doc.setFont("helvetica", "bold");
        let headerX = 14;
        headers.forEach((header, index) => {
          doc.rect(headerX, y, widths[index], 8);
          doc.text(header.substring(0, 22), headerX + 2, y + 5);
          headerX += widths[index];
        });
        y += 8;
        doc.setFont("helvetica", "normal");
      }

      let rowX = 14;
      row.forEach((cell, index) => {
        doc.rect(rowX, y, widths[index], 8);
        doc.text(String(cell).substring(0, 28), rowX + 2, y + 5);
        rowX += widths[index];
      });

      y += 8;
    });

    return y;
  };

  // ==========================================================
  // EXPORT DRIVER STATEMENT PDF
  // ==========================================================

  const exportDriverStatementPDF = (driverId: number) => {
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) return;

    const driverExpenses = expenses.filter((expense) => expense.driver_id === driverId);
    const driverPayments = payments.filter((payment) => payment.driver_id === driverId);

    const filteredDriverExpenses = driverExpenses.filter((expense) => {
      const fromOk = !dateFrom || expense.expense_date >= dateFrom;
      const toOk = !dateTo || expense.expense_date <= dateTo;
      return fromOk && toOk;
    });

    const filteredDriverPayments = driverPayments.filter((payment) => {
      const fromOk = !dateFrom || payment.payment_date >= dateFrom;
      const toOk = !dateTo || payment.payment_date <= dateTo;
      return fromOk && toOk;
    });

    const moneyReceived = filteredDriverPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const totalSpent = filteredDriverExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0);
    const remaining = moneyReceived - totalSpent;

    const doc = new jsPDF("landscape", "mm", "a4");

    createPdfHeader(doc, `Driver Statement - ${driver.driver_name}`);

    doc.setFontSize(10);
    doc.text(`Driver: ${driver.driver_name}`, 14, 47);
    doc.text(`Period: ${dateFrom || "Beginning"} to ${dateTo || "Today"}`, 14, 54);
    doc.text(`Money Received: ${formatAmount(moneyReceived)} SAR`, 100, 47);
    doc.text(`Total Spent: ${formatAmount(totalSpent)} SAR`, 100, 54);
    doc.text(`Remaining: ${formatAmount(remaining)} SAR`, 160, 47);

    const rows = [
      ...filteredDriverExpenses.map((expense) => [
        formatDate(expense.expense_date),
        "Expense",
        expense.expense_type,
        expense.invoice_number,
        expense.supplier_name,
        formatAmount(expense.total_amount),
        "OUT",
      ]),
      ...filteredDriverPayments.map((payment) => [
        formatDate(payment.payment_date),
        "Payment",
        "Advance",
        payment.reference_number || "-",
        payment.payment_method,
        formatAmount(payment.amount),
        "IN",
      ]),
    ].sort((a, b) => a[0].localeCompare(b[0]));

    addPdfTable(doc, ["Date", "Transaction", "Type", "Invoice/Ref", "Supplier/Method", "Amount", "Direction"], rows, 64, [
      27, 28, 25, 32, 55, 30, 25,
    ]);

    doc.save(`${driver.driver_name}_Driver_Statement.pdf`);
  };

  // ==========================================================
  // EXPORT ALL DRIVERS SUMMARY PDF
  // ==========================================================

  const exportAllDriversSummaryPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");

    createPdfHeader(doc, "All Drivers Summary Report");

    doc.setFontSize(10);
    doc.text(`Period: ${dateFrom || "Beginning"} to ${dateTo || "Today"}`, 14, 47);

    const filteredBalances = driverBalances.filter(
      (item) => reportDriver === "ALL" || String(item.driver.id) === reportDriver
    );

    const rows = filteredBalances.map((item) => [
      item.driver.driver_name,
      formatAmount(item.moneyReceived),
      formatAmount(item.diesel),
      formatAmount(item.food),
      formatAmount(item.other),
      formatAmount(item.totalSpent),
      formatAmount(item.remaining),
    ]);

    addPdfTable(
      doc,
      ["Driver", "Received", "Diesel", "Food", "Other", "Total Spent", "Remaining"],
      rows,
      56,
      [35, 28, 25, 25, 25, 28, 28]
    );

    doc.save("All_Drivers_Summary.pdf");
  };

  // ==========================================================
  // EXPORT DETAILED TRANSACTIONS PDF
  // ==========================================================

  const exportDetailedTransactionsPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");

    createPdfHeader(doc, "Detailed Driver Transactions Report");

    doc.setFontSize(10);
    doc.text(`Period: ${dateFrom || "Beginning"} to ${dateTo || "Today"}`, 14, 47);

    const transactions = [
      ...reportExpenses.map((expense) => ({
        date: expense.expense_date,
        driver: getDriverName(expense.driver_id),
        transaction: "Expense",
        type: expense.expense_type,
        reference: expense.invoice_number,
        inAmount: 0,
        outAmount: expense.total_amount,
      })),
      ...reportPayments.map((payment) => ({
        date: payment.payment_date,
        driver: getDriverName(payment.driver_id),
        transaction: "Payment",
        type: "Advance",
        reference: payment.reference_number || "-",
        inAmount: payment.amount,
        outAmount: 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const rows = transactions.map((row) => [
      formatDate(row.date),
      row.driver,
      row.transaction,
      row.type,
      row.reference,
      row.inAmount > 0 ? formatAmount(row.inAmount) : "-",
      row.outAmount > 0 ? formatAmount(row.outAmount) : "-",
    ]);

    addPdfTable(
      doc,
      ["Date", "Driver", "Transaction", "Type", "Reference", "In", "Out"],
      rows,
      56,
      [27, 30, 27, 25, 35, 28, 28]
    );

    doc.save("Detailed_Transactions.pdf");
  };

  // ==========================================================
  // EXPORT VAT PDF
  // ==========================================================

  const exportVatPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");

    createPdfHeader(doc, "Driver Expenses VAT Report");

    doc.setFontSize(9);
    doc.text(`Period: ${dateFrom || "Beginning"} to ${dateTo || "Today"}`, 14, 47);
    doc.text(`Net Amount: ${formatAmount(totalNet)} SAR`, 14, 54);
    doc.text(`VAT: ${formatAmount(totalVat)} SAR`, 75, 54);
    doc.text(`Total: ${formatAmount(totalVatInvoiceAmount)} SAR`, 125, 54);

    const rows = vatReportExpenses.map((expense) => [
      formatDate(expense.invoice_date),
      expense.supplier_name,
      expense.supplier_vat_number || "-",
      expense.invoice_number,
      getDriverName(expense.driver_id),
      expense.expense_type,
      expense.quantity !== null ? String(expense.quantity) : "-",
      formatAmount(expense.amount_before_vat),
      formatAmount(expense.vat_amount),
      formatAmount(expense.total_amount),
    ]);

    addPdfTable(doc, ["Date", "Supplier", "VAT No.", "Invoice", "Driver", "Type", "Qty", "Net", "VAT", "Total"], rows, 62, [
      24, 35, 31, 28, 32, 25, 20, 28, 28, 30,
    ]);

    doc.save("Driver_VAT_Report.pdf");
  };

  // ==========================================================
  // EXPORT EXPENSES EXCEL
  // ==========================================================

  const exportExpensesExcel = () => {
    const data = filteredExpenses.map((expense) => ({
      Date: expense.expense_date,
      Driver: getDriverName(expense.driver_id),
      "Expense Type": expense.expense_type,
      Vehicle: expense.vehicle || "",
      Supplier: expense.supplier_name,
      "Supplier VAT Number": expense.supplier_vat_number || "",
      "Invoice Number": expense.invoice_number,
      "Invoice Date": expense.invoice_date,
      Description: expense.item_description,
      Quantity: expense.quantity ?? "",
      Unit: expense.unit || "",
      "Amount Before VAT": Number(expense.amount_before_vat),
      "VAT Rate": Number(expense.vat_rate),
      "VAT Amount": Number(expense.vat_amount),
      "Total Amount": Number(expense.total_amount),
      "Payment Method": expense.payment_method,
      Notes: expense.notes || "",
      Attachment: expense.attachment_url || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Driver Expenses");
    XLSX.writeFile(workbook, "Driver_Expenses.xlsx");
  };

  // ==========================================================
  // EXPORT VAT EXCEL
  // ==========================================================

  const exportVatExcel = () => {
    const data = vatReportExpenses.map((expense) => ({
      "Invoice Date": expense.invoice_date,
      Supplier: expense.supplier_name,
      "Supplier VAT Number": expense.supplier_vat_number || "",
      "Invoice Number": expense.invoice_number,
      Driver: getDriverName(expense.driver_id),
      "Expense Type": expense.expense_type,
      Vehicle: expense.vehicle || "",
      Description: expense.item_description,
      Quantity: expense.quantity ?? "",
      Unit: expense.unit || "",
      "Amount Before VAT": Number(expense.amount_before_vat),
      "VAT Rate": Number(expense.vat_rate),
      "VAT Amount": Number(expense.vat_amount),
      "Total Invoice Amount": Number(expense.total_amount),
      "Payment Method": expense.payment_method,
    }));

    data.push({
      "Invoice Date": "",
      Supplier: "",
      "Supplier VAT Number": "",
      "Invoice Number": "",
      Driver: "",
      "Expense Type": "",
      Vehicle: "",
      Description: "TOTAL",
      Quantity: "",
      Unit: "",
      "Amount Before VAT": Number(totalNet.toFixed(2)),
      "VAT Rate": "",
      "VAT Amount": Number(totalVat.toFixed(2)),
      "Total Invoice Amount": Number(totalVatInvoiceAmount.toFixed(2)),
      "Payment Method": "",
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "VAT Report");
    XLSX.writeFile(workbook, "Driver_VAT_Report.xlsx");
  };

  // ==========================================================
  // EXPORT MONTHLY DRIVER SUMMARY EXCEL
  // ==========================================================

  const exportSummaryExcel = () => {
    const data = driverBalances.map((item) => ({
      Driver: item.driver.driver_name,
      "Money Received": Number(item.moneyReceived.toFixed(2)),
      Diesel: Number(item.diesel.toFixed(2)),
      Food: Number(item.food.toFixed(2)),
      Other: Number(item.other.toFixed(2)),
      "Total Spent": Number(item.totalSpent.toFixed(2)),
      Remaining: Number(item.remaining.toFixed(2)),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Driver Summary");
    XLSX.writeFile(workbook, "Driver_Monthly_Summary.xlsx");
  };

  // ==========================================================
  // RENDER
  // ==========================================================

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

      <div
        style={{
          marginBottom: "25px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 800,
          }}
        >
          Driver Management
        </h1>

        <p
          style={{
            marginTop: "8px",
            color: "#9ca3af",
          }}
        >
          Driver expenses, advances, balances, payments and VAT reporting
        </p>
      </div>

      {/* ======================================================
          MESSAGE
      ======================================================= */}

      {message && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.35)",
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
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* ======================================================
          TABS
      ======================================================= */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "22px",
        }}
      >
        <TabButton active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")}>
          Driver Expenses
        </TabButton>

        <TabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")}>
          Driver Payments
        </TabButton>

        <TabButton active={activeTab === "reports"} onClick={() => setActiveTab("reports")}>
          Driver Reports
        </TabButton>

        <TabButton active={activeTab === "vat"} onClick={() => setActiveTab("vat")}>
          VAT Report
        </TabButton>
      </div>

      {/* ======================================================
          EXPENSES TAB
      ======================================================= */}

      {activeTab === "expenses" && (
        <>
          <form onSubmit={handleExpenseSubmit} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <h2 style={sectionTitleStyle}>
                {editingExpenseId !== null ? "Edit Driver Expense Invoice" : "Add Driver Expense Invoice"}
              </h2>

              {editingExpenseId !== null && (
                <button type="button" onClick={resetExpenseForm} style={secondaryButtonStyle}>
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={formGridStyle}>
              <FormField label="Driver *">
                <select
                  value={expenseForm.driver_id}
                  onChange={(e) => handleExpenseChange("driver_id", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select Driver</option>
                  {drivers
                    .filter((driver) => driver.active !== false)
                    .map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.driver_name}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="Expense Type *">
                <select
                  value={expenseForm.expense_type}
                  onChange={(e) => handleExpenseChange("expense_type", e.target.value)}
                  style={inputStyle}
                >
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Expense Date *">
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => handleExpenseChange("expense_date", e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Vehicle (Optional)">
                <input
                  value={expenseForm.vehicle}
                  onChange={(e) => handleExpenseChange("vehicle", e.target.value)}
                  placeholder="Vehicle number (optional)"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Supplier Name *">
                <input
                  value={expenseForm.supplier_name}
                  onChange={(e) => handleExpenseChange("supplier_name", e.target.value)}
                  placeholder="Supplier / company name"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Supplier VAT Number">
                <input
                  value={expenseForm.supplier_vat_number}
                  onChange={(e) => handleExpenseChange("supplier_vat_number", e.target.value)}
                  placeholder="VAT number"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Supplier Address (Optional)">
                <input
                  value={expenseForm.supplier_address}
                  onChange={(e) => handleExpenseChange("supplier_address", e.target.value)}
                  placeholder="Supplier address (optional)"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Invoice Number *">
                <input
                  value={expenseForm.invoice_number}
                  onChange={(e) => handleExpenseChange("invoice_number", e.target.value)}
                  placeholder="Invoice number"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Invoice Date *">
                <input
                  type="date"
                  value={expenseForm.invoice_date}
                  onChange={(e) => handleExpenseChange("invoice_date", e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Item / Description *">
                <input
                  value={expenseForm.item_description}
                  onChange={(e) => handleExpenseChange("item_description", e.target.value)}
                  placeholder="Diesel, food, etc."
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Quantity">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={expenseForm.quantity}
                  onChange={(e) => handleExpenseChange("quantity", e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Unit">
                <input
                  value={expenseForm.unit}
                  onChange={(e) => handleExpenseChange("unit", e.target.value)}
                  placeholder="L, KG, PCS"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Total Invoice Amount (VAT Inclusive) *">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.total_amount}
                  onChange={(e) => handleExpenseChange("total_amount", e.target.value)}
                  placeholder="e.g. 1150"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="VAT Rate %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={expenseForm.vat_rate}
                  onChange={(e) => handleExpenseChange("vat_rate", e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Payment Method">
                <select
                  value={expenseForm.payment_method}
                  onChange={(e) => handleExpenseChange("payment_method", e.target.value)}
                  style={inputStyle}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Invoice / Receipt Attachment">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{
                    ...inputStyle,
                    padding: "8px 10px",
                  }}
                />
              </FormField>

              <FormField label="Notes">
                <input
                  value={expenseForm.notes}
                  onChange={(e) => handleExpenseChange("notes", e.target.value)}
                  placeholder="Optional notes"
                  style={inputStyle}
                />
              </FormField>
            </div>

            {/* VAT CALCULATION */}

            <div
              style={{
                marginTop: "20px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <CalculationCard title="Amount Before VAT" value={`${formatAmount(calculatedNet)} SAR`} />
              <CalculationCard title={`VAT (${vatRate}%)`} value={`${formatAmount(calculatedVat)} SAR`} />
              <CalculationCard title="Total Invoice" value={`${formatAmount(totalInvoiceAmount)} SAR`} highlight />
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
                }}
              >
                {saving ? "Saving..." : editingExpenseId !== null ? "Update Invoice" : "Add Invoice"}
              </button>
            </div>
          </form>

          {/* ==================================================
              DRIVER BALANCES
          ================================================== */}

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "18px",
              }}
            >
              <h2 style={sectionTitleStyle}>Current Driver Balances</h2>
              <button type="button" onClick={exportSummaryExcel} style={secondaryButtonStyle}>
                Export Excel
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
              }}
            >
              {driverBalances.map((item) => (
                <div
                  key={item.driver.id}
                  style={{
                    background: "#080808",
                    border: "1px solid #292929",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "17px",
                      marginBottom: "12px",
                    }}
                  >
                    {item.driver.driver_name}
                  </div>

                  <div style={balanceLine}>
                    <span>Money Received</span>
                    <strong>{formatAmount(item.moneyReceived)} SAR</strong>
                  </div>

                  <div style={balanceLine}>
                    <span>Diesel</span>
                    <strong>{formatAmount(item.diesel)} SAR</strong>
                  </div>

                  <div style={balanceLine}>
                    <span>Food</span>
                    <strong>{formatAmount(item.food)} SAR</strong>
                  </div>

                  <div style={balanceLine}>
                    <span>Other</span>
                    <strong>{formatAmount(item.other)} SAR</strong>
                  </div>

                  <div
                    style={{
                      ...balanceLine,
                      borderTop: "1px solid #303030",
                      paddingTop: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <span>Total Spent</span>
                    <strong>{formatAmount(item.totalSpent)} SAR</strong>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      borderRadius: "8px",
                      background: item.remaining >= 0 ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                      color: item.remaining >= 0 ? "#86efac" : "#fca5a5",
                      fontWeight: 900,
                    }}
                  >
                    Remaining Advance: {formatAmount(item.remaining)} SAR
                  </div>

                  <button
                    type="button"
                    onClick={() => exportDriverStatementPDF(item.driver.id)}
                    style={{
                      ...secondaryButtonStyle,
                      width: "100%",
                      marginTop: "10px",
                    }}
                  >
                    Driver PDF
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ==================================================
              FILTERS
          ================================================== */}

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <h2 style={sectionTitleStyle}>Expense Filters</h2>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button type="button" onClick={exportExpensesExcel} style={secondaryButtonStyle}>
                  Export Excel
                </button>

                <button type="button" onClick={clearFilters} style={secondaryButtonStyle}>
                  Clear Filters
                </button>
              </div>
            </div>

            <div style={formGridStyle}>
              <FormField label="Search">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Invoice, supplier, driver..."
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Driver">
                <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} style={inputStyle}>
                  <option value="ALL">All Drivers</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Expense Type">
                <select value={expenseTypeFilter} onChange={(e) => setExpenseTypeFilter(e.target.value)} style={inputStyle}>
                  <option value="ALL">All Types</option>
                  {EXPENSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="From Date">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </FormField>

              <FormField label="To Date">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </FormField>
            </div>
          </div>

          {/* ==================================================
              EXPENSE TABLE
          ================================================== */}

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <div>
                <h2 style={sectionTitleStyle}>Driver Expense Invoices</h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#9ca3af",
                    fontSize: "13px",
                  }}
                >
                  {filteredExpenses.length} records
                </p>
              </div>

              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                }}
              >
                {formatAmount(
                  filteredExpenses.reduce((sum, item) => sum + Number(item.total_amount || 0), 0)
                )}{" "}
                SAR
              </div>
            </div>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1500px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Supplier</th>
                    <th style={thStyle}>VAT No.</th>
                    <th style={thStyle}>Invoice</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Net</th>
                    <th style={thStyle}>VAT</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Attachment</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td style={tdStyle}>{formatDate(expense.expense_date)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                        }}
                      >
                        {getDriverName(expense.driver_id)}
                      </td>
                      <td style={tdStyle}>{expense.expense_type}</td>
                      <td style={tdStyle}>{expense.supplier_name}</td>
                      <td style={tdStyle}>{expense.supplier_vat_number || "-"}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                        }}
                      >
                        {expense.invoice_number}
                      </td>
                      <td style={tdStyle}>{expense.item_description}</td>
                      <td style={tdStyle}>
                        {expense.quantity ?? "-"} {expense.unit || ""}
                      </td>
                      <td style={tdStyle}>{formatAmount(expense.amount_before_vat)}</td>
                      <td style={tdStyle}>{formatAmount(expense.vat_amount)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 900,
                        }}
                      >
                        {formatAmount(expense.total_amount)} SAR
                      </td>
                      <td style={tdStyle}>
                        {expense.attachment_url ? (
                          <a href={expense.attachment_url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                          }}
                        >
                          <button type="button" onClick={() => handleEditExpense(expense)} style={smallButtonStyle}>
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense.id)}
                            style={{
                              ...smallButtonStyle,
                              color: "#fca5a5",
                              borderColor: "rgba(239,68,68,0.35)",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================
          PAYMENTS TAB
      ======================================================= */}

      {activeTab === "payments" && (
        <>
          <form onSubmit={handlePaymentSubmit} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <h2 style={sectionTitleStyle}>
                {editingPaymentId !== null ? "Edit Driver Payment" : "Driver Payment / Advance Control"}
              </h2>

              {editingPaymentId !== null && (
                <button type="button" onClick={resetPaymentForm} style={secondaryButtonStyle}>
                  Cancel Edit
                </button>
              )}
            </div>

            <div style={formGridStyle}>
              <FormField label="Driver *">
                <select
                  value={paymentForm.driver_id}
                  onChange={(e) => handlePaymentChange("driver_id", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select Driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Payment Date *">
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => handlePaymentChange("payment_date", e.target.value)}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Amount *">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => handlePaymentChange("amount", e.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Payment Method">
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => handlePaymentChange("payment_method", e.target.value)}
                  style={inputStyle}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Reference Number">
                <input
                  value={paymentForm.reference_number}
                  onChange={(e) => handlePaymentChange("reference_number", e.target.value)}
                  placeholder="Payment reference"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Notes">
                <input
                  value={paymentForm.notes}
                  onChange={(e) => handlePaymentChange("notes", e.target.value)}
                  placeholder="Optional notes"
                  style={inputStyle}
                />
              </FormField>
            </div>

            {paymentForm.driver_id && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "15px",
                  borderRadius: "10px",
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.30)",
                }}
              >
                Current balance for <strong>{getDriverName(Number(paymentForm.driver_id))}</strong>:{" "}
                <strong>{formatAmount(selectedPaymentDriverBalance)} SAR</strong>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? "Saving..." : editingPaymentId !== null ? "Update Payment" : "Record Payment"}
              </button>
            </div>
          </form>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Driver Payment History</h2>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "850px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>Notes</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={tdStyle}>{formatDate(payment.payment_date)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                        }}
                      >
                        {getDriverName(payment.driver_id)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 900,
                        }}
                      >
                        {formatAmount(payment.amount)} SAR
                      </td>
                      <td style={tdStyle}>{payment.payment_method}</td>
                      <td style={tdStyle}>{payment.reference_number || "-"}</td>
                      <td style={tdStyle}>{payment.notes || "-"}</td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                          }}
                        >
                          <button type="button" onClick={() => handleEditPayment(payment)} style={smallButtonStyle}>
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment.id)}
                            style={{
                              ...smallButtonStyle,
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
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================
          REPORTS TAB
      ======================================================= */}

      {activeTab === "reports" && (
        <>
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <h2 style={sectionTitleStyle}>Driver Monthly / Date Report</h2>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={exportAllDriversSummaryPDF} style={primaryButtonStyle}>
                  Export Summary PDF
                </button>
                <button type="button" onClick={exportSummaryExcel} style={secondaryButtonStyle}>
                  Export Excel
                </button>
              </div>
            </div>

            <div
              style={{
                ...formGridStyle,
                marginTop: "18px",
              }}
            >
              <FormField label="Driver">
                <select value={reportDriver} onChange={(e) => setReportDriver(e.target.value)} style={inputStyle}>
                  <option value="ALL">All Drivers</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="From Date">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </FormField>

              <FormField label="To Date">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </FormField>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <h2 style={sectionTitleStyle}>Driver Summary</h2>
              <button type="button" onClick={exportAllDriversSummaryPDF} style={secondaryButtonStyle}>
                Export PDF
              </button>
            </div>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "900px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Money Received</th>
                    <th style={thStyle}>Diesel</th>
                    <th style={thStyle}>Food</th>
                    <th style={thStyle}>Other</th>
                    <th style={thStyle}>Total Spent</th>
                    <th style={thStyle}>Remaining</th>
                    <th style={thStyle}>PDF</th>
                  </tr>
                </thead>

                <tbody>
                  {driverBalances
                    .filter((item) => reportDriver === "ALL" || String(item.driver.id) === reportDriver)
                    .map((item) => (
                      <tr key={item.driver.id}>
                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 800,
                          }}
                        >
                          {item.driver.driver_name}
                        </td>

                        <td style={tdStyle}>{formatAmount(item.moneyReceived)}</td>
                        <td style={tdStyle}>{formatAmount(item.diesel)}</td>
                        <td style={tdStyle}>{formatAmount(item.food)}</td>
                        <td style={tdStyle}>{formatAmount(item.other)}</td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 800,
                          }}
                        >
                          {formatAmount(item.totalSpent)}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 900,
                            color: item.remaining >= 0 ? "#86efac" : "#fca5a5",
                          }}
                        >
                          {formatAmount(item.remaining)}
                        </td>

                        <td style={tdStyle}>
                          <button type="button" onClick={() => exportDriverStatementPDF(item.driver.id)} style={smallButtonStyle}>
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <h2 style={sectionTitleStyle}>Detailed Driver Transactions</h2>
              <button type="button" onClick={exportDetailedTransactionsPDF} style={secondaryButtonStyle}>
                Export PDF
              </button>
            </div>

            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1100px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Transaction</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>In</th>
                    <th style={thStyle}>Out</th>
                  </tr>
                </thead>

                <tbody>
                  {[
                    ...reportExpenses.map((expense) => ({
                      date: expense.expense_date,
                      driver: getDriverName(expense.driver_id),
                      transaction: "Expense",
                      type: expense.expense_type,
                      reference: expense.invoice_number,
                      inAmount: 0,
                      outAmount: expense.total_amount,
                    })),
                    ...reportPayments.map((payment) => ({
                      date: payment.payment_date,
                      driver: getDriverName(payment.driver_id),
                      transaction: "Payment",
                      type: "Advance",
                      reference: payment.reference_number || "-",
                      inAmount: payment.amount,
                      outAmount: 0,
                    })),
                  ]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((row, index) => (
                      <tr key={`${row.date}-${row.reference}-${index}`}>
                        <td style={tdStyle}>{formatDate(row.date)}</td>
                        <td style={tdStyle}>{row.driver}</td>
                        <td style={tdStyle}>{row.transaction}</td>
                        <td style={tdStyle}>{row.type}</td>
                        <td style={tdStyle}>{row.reference}</td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#86efac",
                          }}
                        >
                          {row.inAmount ? `${formatAmount(row.inAmount)} SAR` : "-"}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#fca5a5",
                          }}
                        >
                          {row.outAmount ? `${formatAmount(row.outAmount)} SAR` : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================
          VAT TAB
      ======================================================= */}

      {activeTab === "vat" && (
        <>
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h2 style={sectionTitleStyle}>Driver Expenses VAT Report</h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#9ca3af",
                    fontSize: "13px",
                  }}
                >
                  Supplier invoices and input VAT records
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button type="button" onClick={exportVatPDF} style={primaryButtonStyle}>
                  Export VAT PDF
                </button>

                <button type="button" onClick={exportVatExcel} style={secondaryButtonStyle}>
                  Export VAT Excel
                </button>
              </div>
            </div>

            <div
              style={{
                ...formGridStyle,
                marginTop: "18px",
              }}
            >
              <FormField label="Driver">
                <select value={reportDriver} onChange={(e) => setReportDriver(e.target.value)} style={inputStyle}>
                  <option value="ALL">All Drivers</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.driver_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="From Date">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </FormField>

              <FormField label="To Date">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
              </FormField>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              marginBottom: "20px",
            }}
          >
            <CalculationCard title="Total Net Purchases" value={`${formatAmount(totalNet)} SAR`} />
            <CalculationCard title="Total Input VAT" value={`${formatAmount(totalVat)} SAR`} highlight />
            <CalculationCard title="Total Invoice Amount" value={`${formatAmount(totalVatInvoiceAmount)} SAR`} />
          </div>

          <div style={cardStyle}>
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1500px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Invoice Date</th>
                    <th style={thStyle}>Supplier</th>
                    <th style={thStyle}>Supplier VAT No.</th>
                    <th style={thStyle}>Invoice No.</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Net</th>
                    <th style={thStyle}>VAT</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {vatReportExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td style={tdStyle}>{formatDate(expense.invoice_date)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                        }}
                      >
                        {expense.supplier_name}
                      </td>
                      <td style={tdStyle}>{expense.supplier_vat_number || "-"}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 800,
                        }}
                      >
                        {expense.invoice_number}
                      </td>
                      <td style={tdStyle}>{getDriverName(expense.driver_id)}</td>
                      <td style={tdStyle}>{expense.expense_type}</td>
                      <td style={tdStyle}>{expense.item_description}</td>
                      <td style={tdStyle}>{expense.quantity ?? "-"}</td>
                      <td style={tdStyle}>{formatAmount(expense.amount_before_vat)}</td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 800,
                        }}
                      >
                        {formatAmount(expense.vat_amount)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 900,
                        }}
                      >
                        {formatAmount(expense.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: 900,
                      }}
                    >
                      TOTAL
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 900,
                      }}
                    >
                      {formatAmount(totalNet)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 900,
                      }}
                    >
                      {formatAmount(totalVat)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 900,
                      }}
                    >
                      {formatAmount(totalVatInvoiceAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 18px",
            borderRadius: "8px",
            background: "#111111",
            border: "1px solid #303030",
            color: "#d1d5db",
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "11px 17px",
        borderRadius: "8px",
        border: active ? "1px solid rgba(59,130,246,0.60)" : "1px solid #303030",
        background: active ? "#111827" : "#111111",
        color: active ? "#ffffff" : "#9ca3af",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CalculationCard({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: "#0c0c0c",
        border: highlight ? "1px solid rgba(59,130,246,0.45)" : "1px solid #242424",
        borderRadius: "10px",
        padding: "15px",
      }}
    >
      <div
        style={{
          color: "#9ca3af",
          fontSize: "12px",
          marginBottom: "7px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "19px",
          fontWeight: 900,
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

const cardStyle: React.CSSProperties = {
  background: "#101010",
  border: "1px solid #242424",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "22px",
  boxShadow: "0 0 25px rgba(0,0,0,0.25)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 800,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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

const balanceLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "8px",
  color: "#9ca3af",
  fontSize: "13px",
};

export default Drivers;