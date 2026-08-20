import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";

type Item = {
  id: number;
  item_name: string | null;
  category: string | null;
  unit: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type Customer = {
  id: number | string;
  customer_name?: string | null;
  name?: string | null;
  company_name?: string | null;
};

type Sale = {
  id: number;
  sales_date: string | null;
  delivery_note_no: string | null;
  customer_name: string | null;
  item_id: number | null;
  driver_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_percent: number | null;
  total_amount: number | null;
  payment_type: string | null;
  branch_id: string | null;
  sales_description: string | null;
  description: string | null;
  notes: string | null;
  erp_invoice_number: string | null;
  invoice_number: string | null;
};

type SalesReturn = {
  id: number;
  original_sale_id: number | null;
  return_date: string | null;
  branch_id: string | null;
  customer_id: number | string | null;
  invoice_no: string | null;
  credit_note_no: string | null;
  reason: string | null;
  notes: string | null;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  status: string | null;
  created_at: string | null;
};

type SalesReturnItem = {
  id: number;
  sales_return_id: number;
  item_id: number;
  quantity: number | null;
  unit_price: number | null;
  taxable_amount: number | null;
  vat: number | null;
  total: number | null;
  created_at: string | null;
};

type ReturnLine = {
  item_id: string;
  quantity: string;
  unit_price: string;
};

const VAT_RATE = 0.15;

// ============================================================
// COMPANY DETAILS
// ============================================================
const COMPANY_NAME_EN = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";
const COMPANY_CR_NUMBER = "1011142013";
const COMPANY_VAT_NUMBER = "310208502500003";
const COMPANY_ADDRESS = "Riyadh, Saudi Arabia";
const CURRENCY = "SAR";

function SalesReturn() {
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [returnItems, setReturnItems] = useState<SalesReturnItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // ============================================================
  // NEW: Invoice number input (instead of dropdown)
  // ============================================================
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [searchError, setSearchError] = useState("");

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<ReturnLine[]>([
    {
      item_id: "",
      quantity: "",
      unit_price: "",
    },
  ]);

  const [search, setSearch] = useState("");

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);

    await Promise.all([
      loadItems(),
      loadBranches(),
      loadCustomers(),
      loadSales(),
      loadReturns(),
      loadReturnItems(),
    ]);

    setLoading(false);
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from("items")
      .select("id,item_name,category,unit")
      .order("item_name", {
        ascending: true,
      });

    if (error) {
      console.error("Items:", error);
      return;
    }

    setItems(data || []);
  }

  async function loadBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("id,branch_name")
      .eq("active", true)
      .order("branch_name", {
        ascending: true,
      });

    if (error) {
      console.error("Branches:", error);
      return;
    }

    setBranches(data || []);
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("id", {
        ascending: true,
      });

    if (error) {
      console.error("Customers:", error);
      setCustomers([]);
      return;
    }

    setCustomers(data || []);
  }

  async function loadSales() {
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sales_date,
        delivery_note_no,
        customer_name,
        item_id,
        driver_name,
        quantity,
        unit_price,
        vat_percent,
        total_amount,
        payment_type,
        branch_id,
        sales_description,
        description,
        notes,
        erp_invoice_number,
        invoice_number
      `)
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error("Sales:", error);
      setSales([]);
      return;
    }

    setSales(data || []);
  }

  async function loadReturns() {
    const { data, error } = await supabase
      .from("sales_returns")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error("Sales returns:", error);
      return;
    }

    setReturns(data || []);
  }

  async function loadReturnItems() {
    const { data, error } = await supabase
      .from("sales_return_items")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error("Sales return items:", error);
      return;
    }

    setReturnItems(data || []);
  }

  /*
   * ============================================================
   * SEARCH INVOICE BY NUMBER
   * ============================================================
   */

  async function searchInvoice(invoiceNumber: string) {
    setSearchError("");
    setFoundSale(null);

    if (!invoiceNumber.trim()) {
      return;
    }

    const searchTerm = invoiceNumber.trim();

    // Search in sales table by invoice number, ERP invoice number, or delivery note
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        sales_date,
        delivery_note_no,
        customer_name,
        item_id,
        driver_name,
        quantity,
        unit_price,
        vat_percent,
        total_amount,
        payment_type,
        branch_id,
        sales_description,
        description,
        notes,
        erp_invoice_number,
        invoice_number
      `)
      .or(`invoice_number.ilike.%${searchTerm}%,erp_invoice_number.ilike.%${searchTerm}%,delivery_note_no.ilike.%${searchTerm}%`)
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Search invoice error:", error);
      setSearchError("Error searching for invoice");
      return;
    }

    if (!data || data.length === 0) {
      setSearchError(`No sale found with invoice number: ${searchTerm}`);
      return;
    }

    const sale = data[0] as Sale;
    setFoundSale(sale);

    // Auto-populate fields
    setBranchId(sale.branch_id || "");
    setInvoiceNo(
      sale.erp_invoice_number || 
      sale.invoice_number || 
      sale.delivery_note_no || 
      `SALE-${sale.id}`
    );

    // Find matching customer
    const matchingCustomer = customers.find((customer) => {
      const customerName = customer.customer_name || customer.company_name || customer.name || "";
      return customerName.trim().toLowerCase() === (sale.customer_name || "").trim().toLowerCase();
    });

    setCustomerId(matchingCustomer ? String(matchingCustomer.id) : "");

    // Set item line
    if (sale.item_id) {
      setLines([
        {
          item_id: String(sale.item_id),
          quantity: "",
          unit_price: sale.unit_price !== null && sale.unit_price !== undefined ? String(sale.unit_price) : "",
        },
      ]);
    } else {
      setLines([
        {
          item_id: "",
          quantity: "",
          unit_price: "",
        },
      ]);
    }
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  function getItemName(itemId: number | null) {
    if (!itemId) return "-";
    const item = items.find((x) => x.id === itemId);
    return item?.item_name || `Item #${itemId}`;
  }

  function getItemUnit(itemId: number | null) {
    if (!itemId) return "";
    const item = items.find((x) => x.id === itemId);
    return item?.unit || "";
  }

  function getBranchName(branchId: string | null) {
    if (!branchId) return "-";
    const branch = branches.find((x) => String(x.id) === String(branchId));
    return branch?.branch_name || "-";
  }

  function getCustomerName(customerId: number | string | null) {
    if (!customerId) return "-";
    const customer = customers.find((x) => String(x.id) === String(customerId));
    if (!customer) return `Customer #${customerId}`;
    return customer.customer_name || customer.company_name || customer.name || `Customer #${customerId}`;
  }

  function getSaleInvoiceNumber(sale: Sale) {
    return sale.erp_invoice_number || sale.invoice_number || sale.delivery_note_no || `SALE-${sale.id}`;
  }

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /*
   * ============================================================
   * CREDIT NOTE NUMBER
   * ============================================================
   */

  function generateCreditNoteNumber() {
    const numbers = returns
      .map((item) => item.credit_note_no || "")
      .map((value) => {
        const match = value.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((value) => value > 0);

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `CN-${String(nextNumber).padStart(6, "0")}`;
  }

  /*
   * ============================================================
   * RETURNED QUANTITY ALREADY USED
   * ============================================================
   */

  function getAlreadyReturnedQuantity(saleId: number, itemId: number) {
    let quantity = 0;
    for (const returnItem of returnItems) {
      if (returnItem.item_id !== itemId) continue;
      const parentReturn = returns.find((x) => x.id === returnItem.sales_return_id);
      if (!parentReturn) continue;
      if (Number(parentReturn.original_sale_id) !== Number(saleId)) continue;
      if (String(parentReturn.status || "").toUpperCase() === "CANCELLED") continue;
      quantity += Number(returnItem.quantity || 0);
    }
    return quantity;
  }

  /*
   * ============================================================
   * SELECTED SALE CALCULATIONS
   * ============================================================
   */

  const selectedSaleAlreadyReturned = useMemo(() => {
    if (!foundSale || !foundSale.item_id) return 0;
    return getAlreadyReturnedQuantity(foundSale.id, foundSale.item_id);
  }, [foundSale, returnItems, returns]);

  const selectedSaleRemainingQuantity = useMemo(() => {
    if (!foundSale) return 0;
    const originalQuantity = Number(foundSale.quantity || 0);
    return Math.max(0, originalQuantity - selectedSaleAlreadyReturned);
  }, [foundSale, selectedSaleAlreadyReturned]);

  /*
   * ============================================================
   * RETURN LINE CALCULATIONS
   * ============================================================
   */

  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const quantity = Number(line.quantity) || 0;
      const unitPrice = Number(line.unit_price) || 0;
      const taxableAmount = quantity * unitPrice;
      const vat = taxableAmount * VAT_RATE;
      const total = taxableAmount + vat;

      return {
        ...line,
        quantityNumber: quantity,
        unitPriceNumber: unitPrice,
        taxableAmount,
        vat,
        total,
      };
    });
  }, [lines]);

  const subtotal = calculatedLines.reduce((sum, line) => sum + line.taxableAmount, 0);
  const vat = calculatedLines.reduce((sum, line) => sum + line.vat, 0);
  const total = calculatedLines.reduce((sum, line) => sum + line.total, 0);

  /*
   * ============================================================
   * LINE MANAGEMENT
   * ============================================================
   */

  function updateLine(index: number, field: keyof ReturnLine, value: string) {
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        item_id: "",
        quantity: "",
        unit_price: "",
      },
    ]);
  }

  function removeLine(index: number) {
    if (lines.length === 1) {
      setLines([
        {
          item_id: "",
          quantity: "",
          unit_price: "",
        },
      ]);
      return;
    }
    setLines((current) => current.filter((_, i) => i !== index));
  }

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  function validateForm() {
    if (!returnDate) {
      alert("Please select return date.");
      return false;
    }

    if (!foundSale) {
      alert("Please search and select the original sale/invoice.");
      return false;
    }

    if (!branchId) {
      alert("Please select branch.");
      return false;
    }

    if (!customerId) {
      alert("Please select customer.");
      return false;
    }

    if (!invoiceNo.trim()) {
      alert("Original invoice number is missing.");
      return false;
    }

    if (!reason.trim()) {
      alert("Please enter return reason.");
      return false;
    }

    if (lines.length === 0) {
      alert("Please add at least one returned item.");
      return false;
    }

    if (foundSale.item_id === null) {
      alert("The original sale does not have an item.");
      return false;
    }

    for (let i = 0; i < calculatedLines.length; i++) {
      const line = calculatedLines[i];

      if (!line.item_id) {
        alert(`Please select item for line ${i + 1}.`);
        return false;
      }

      if (Number(line.item_id) !== Number(foundSale.item_id)) {
        alert(`Returned item on line ${i + 1} does not match the original sale item.`);
        return false;
      }

      if (line.quantityNumber <= 0) {
        alert(`Please enter valid quantity for line ${i + 1}.`);
        return false;
      }

      if (line.unitPriceNumber < 0) {
        alert(`Please enter valid unit price for line ${i + 1}.`);
        return false;
      }
    }

    const totalReturnQuantity = calculatedLines.reduce((sum, line) => sum + line.quantityNumber, 0);

    if (totalReturnQuantity > selectedSaleRemainingQuantity) {
      alert(
        `Return quantity exceeds the remaining quantity.\n\n` +
          `Original Quantity: ${formatMoney(Number(foundSale.quantity || 0))}\n` +
          `Already Returned: ${formatMoney(selectedSaleAlreadyReturned)}\n` +
          `Remaining: ${formatMoney(selectedSaleRemainingQuantity)}\n` +
          `Trying to Return: ${formatMoney(totalReturnQuantity)}`
      );
      return false;
    }

    if (total <= 0) {
      alert("Return total must be greater than zero.");
      return false;
    }

    return true;
  }

  /*
   * ============================================================
   * SAVE SALES RETURN
   * ============================================================
   */

  async function saveSalesReturn() {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const creditNoteNo = generateCreditNoteNumber();

      const { data: returnData, error: returnError } = await supabase
        .from("sales_returns")
        .insert({
          original_sale_id: Number(foundSale!.id),
          return_date: returnDate,
          branch_id: branchId,
          customer_id: customerId,
          invoice_no: invoiceNo.trim(),
          credit_note_no: creditNoteNo,
          reason: reason.trim(),
          notes: notes.trim() || null,
          subtotal: Number(subtotal.toFixed(2)),
          vat: Number(vat.toFixed(2)),
          total: Number(total.toFixed(2)),
          status: "POSTED",
        })
        .select()
        .single();

      if (returnError) {
        throw new Error(`Unable to create sales return: ${returnError.message}`);
      }

      if (!returnData) {
        throw new Error("Sales return was not created.");
      }

      const returnId = returnData.id;

      const returnItemRows = calculatedLines.map((line) => ({
        sales_return_id: returnId,
        item_id: Number(line.item_id),
        quantity: line.quantityNumber,
        unit_price: Number(line.unitPriceNumber.toFixed(2)),
        taxable_amount: Number(line.taxableAmount.toFixed(2)),
        vat: Number(line.vat.toFixed(2)),
        total: Number(line.total.toFixed(2)),
      }));

      const { error: itemsError } = await supabase
        .from("sales_return_items")
        .insert(returnItemRows);

      if (itemsError) {
        await supabase.from("sales_returns").delete().eq("id", returnId);
        throw new Error(`Unable to save returned items: ${itemsError.message}`);
      }

      const stockMovements = calculatedLines.map((line) => ({
        date: returnDate,
        item_id: Number(line.item_id),
        branch_id: branchId,
        movement_type: "SALES_RETURN",
        quantity: Math.abs(line.quantityNumber),
        quantity_in: Math.abs(line.quantityNumber),
        quantity_out: 0,
        unit_cost: line.unitPriceNumber,
        reference_type: "CREDIT_NOTE",
        reference_id: returnId,
        notes: `Sales Return ${creditNoteNo} against Invoice ${invoiceNo.trim()} | Original Sale ID: ${foundSale!.id}`,
        transfer_id: null,
      }));

      const { error: stockError } = await supabase
        .from("stock_movements")
        .insert(stockMovements);

      if (stockError) {
        await supabase.from("sales_return_items").delete().eq("sales_return_id", returnId);
        await supabase.from("sales_returns").delete().eq("id", returnId);
        throw new Error(`Unable to update stock: ${stockError.message}`);
      }

      alert(
        `Sales Return saved successfully.\n\n` +
          `Credit Note: ${creditNoteNo}\n` +
          `Original Invoice: ${invoiceNo.trim()}\n` +
          `Returned Quantity: ${formatMoney(calculatedLines.reduce((sum, line) => sum + line.quantityNumber, 0))}\n` +
          `Credit Amount: SAR ${formatMoney(total)}\n\n` +
          `The original sale remains unchanged.`
      );

      clearForm();
      await Promise.all([loadSales(), loadReturns(), loadReturnItems()]);
    } catch (error) {
      console.error("Save sales return error:", error);
      alert(error instanceof Error ? error.message : "Unable to save sales return.");
    } finally {
      setSaving(false);
    }
  }

  /*
   * ============================================================
   * CLEAR FORM
   * ============================================================
   */

  function clearForm() {
    setReturnDate(new Date().toISOString().split("T")[0]);
    setInvoiceSearch("");
    setFoundSale(null);
    setSearchError("");
    setBranchId("");
    setCustomerId("");
    setInvoiceNo("");
    setReason("");
    setNotes("");
    setLines([
      {
        item_id: "",
        quantity: "",
        unit_price: "",
      },
    ]);
  }

  /*
   * ============================================================
   * FILTER RETURN HISTORY
   * ============================================================
   */

  const filteredReturns = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return returns;
    }

    return returns.filter((item) => {
      const originalSale = item.original_sale_id
        ? sales.find((sale) => sale.id === Number(item.original_sale_id))
        : null;

      const originalInvoice = originalSale ? getSaleInvoiceNumber(originalSale) : "";

      const text = `
        ${item.invoice_no || ""}
        ${item.credit_note_no || ""}
        ${getCustomerName(item.customer_id)}
        ${getBranchName(item.branch_id)}
        ${item.reason || ""}
        ${item.status || ""}
        ${originalInvoice}
      `.toLowerCase();

      return text.includes(searchText);
    });
  }, [returns, search, customers, branches, sales]);

  const totalReturnedValue = filteredReturns.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalReturnedVat = filteredReturns.reduce((sum, item) => sum + Number(item.vat || 0), 0);

  /*
   * ============================================================
   * PDF EXPORT
   * ============================================================
   */

  function exportCreditNotePDF(returnRecord: SalesReturn) {
    const doc = new jsPDF();

    const originalSale = returnRecord.original_sale_id
      ? sales.find((sale) => sale.id === Number(returnRecord.original_sale_id))
      : null;

    const recordItems = returnItems.filter(
      (returnItem) => returnItem.sales_return_id === returnRecord.id
    );

    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AL SHAMS ERP", 15, 18);

    doc.setFontSize(14);
    doc.text("SALES RETURN / CREDIT NOTE", 15, 29);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("AL SHAMS AL GHAYABA TRD EST.", 15, 37);
    doc.text("مؤسسة الشمس الغائبة للتجارة", 15, 44);

    // Credit Note Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Credit Note:", 15, 58);
    doc.setFont("helvetica", "normal");
    doc.text(returnRecord.credit_note_no || "-", 48, 58);

    doc.setFont("helvetica", "bold");
    doc.text("Return Date:", 15, 66);
    doc.setFont("helvetica", "normal");
    doc.text(returnRecord.return_date || "-", 48, 66);

    doc.setFont("helvetica", "bold");
    doc.text("Original Invoice:", 15, 74);
    doc.setFont("helvetica", "normal");
    doc.text(returnRecord.invoice_no || "-", 52, 74);

    doc.setFont("helvetica", "bold");
    doc.text("Customer:", 15, 82);
    doc.setFont("helvetica", "normal");
    doc.text(getCustomerName(returnRecord.customer_id), 48, 82);

    doc.setFont("helvetica", "bold");
    doc.text("Branch:", 15, 90);
    doc.setFont("helvetica", "normal");
    doc.text(getBranchName(returnRecord.branch_id), 48, 90);

    if (originalSale) {
      doc.setFont("helvetica", "bold");
      doc.text("Original Sale ID:", 110, 58);
      doc.setFont("helvetica", "normal");
      doc.text(String(originalSale.id), 150, 58);

      doc.setFont("helvetica", "bold");
      doc.text("Delivery Note:", 110, 66);
      doc.setFont("helvetica", "normal");
      doc.text(originalSale.delivery_note_no || "-", 150, 66);
    }

    // Table Header
    const tableTop = 105;
    doc.setFillColor(230, 235, 240);
    doc.rect(15, tableTop, pageWidth - 30, 9, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Item", 18, tableTop + 6);
    doc.text("Qty", 85, tableTop + 6);
    doc.text("Unit Price", 105, tableTop + 6);
    doc.text("Taxable", 135, tableTop + 6);
    doc.text("VAT", 163, tableTop + 6);
    doc.text("Total", 180, tableTop + 6);

    // Table Rows
    let y = tableTop + 17;
    doc.setFont("helvetica", "normal");

    recordItems.forEach((row) => {
      const itemName = getItemName(row.item_id);
      doc.text(itemName.substring(0, 30), 18, y);
      doc.text(formatMoney(Number(row.quantity || 0)), 85, y);
      doc.text(formatMoney(Number(row.unit_price || 0)), 105, y);
      doc.text(formatMoney(Number(row.taxable_amount || 0)), 135, y);
      doc.text(formatMoney(Number(row.vat || 0)), 163, y);
      doc.text(formatMoney(Number(row.total || 0)), 180, y);
      y += 8;
    });

    // Totals
    y += 8;
    doc.line(125, y, pageWidth - 15, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("Subtotal:", 125, y);
    doc.setFont("helvetica", "normal");
    doc.text(`SAR ${formatMoney(Number(returnRecord.subtotal || 0))}`, 165, y);

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("VAT 15%:", 125, y);
    doc.setFont("helvetica", "normal");
    doc.text(`SAR ${formatMoney(Number(returnRecord.vat || 0))}`, 165, y);

    y += 9;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("CREDIT NOTE TOTAL:", 125, y);
    doc.text(`SAR ${formatMoney(Number(returnRecord.total || 0))}`, 165, y);

    // Reason / Notes
    y += 18;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Return Reason:", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(returnRecord.reason || "-", 48, y);

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 15, y);
    doc.setFont("helvetica", "normal");
    const notesText = returnRecord.notes || "-";
    const notesLines = doc.splitTextToSize(notesText, pageWidth - 63);
    doc.text(notesLines, 48, y);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 18;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    doc.text("Generated by AL SHAMS ERP", 15, footerY);
    doc.text("Original sale remains in Sales Records. This document represents the sales return / credit note.", 15, footerY + 6);

    doc.save(`${returnRecord.credit_note_no || `CREDIT-NOTE-${returnRecord.id}`}.pdf`);
  }

  /*
   * ============================================================
   * STYLES
   * ============================================================
   */

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 10px",
    backgroundColor: "#111827",
    color: "#ffffff",
    border: "1px solid #334155",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "13px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    color: "#cbd5e1",
    fontSize: "11px",
    fontWeight: 600,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#111827",
    border: "1px solid #263548",
    borderRadius: "10px",
    padding: "15px",
  };

  const primaryButtonStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #06b6d4, #2563eb)",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "10px 18px",
    fontWeight: 700,
    cursor: saving ? "not-allowed" : "pointer",
    fontSize: "12px",
    opacity: saving ? 0.6 : 1,
  };

  const secondaryButtonStyle: React.CSSProperties = {
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "11px",
  };

  const pdfButtonStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#ffffff",
    border: "none",
    borderRadius: "5px",
    padding: "6px 10px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "10px",
  };

  const dangerButtonStyle: React.CSSProperties = {
    background: "#7f1d1d",
    color: "#ffffff",
    border: "1px solid #991b1b",
    borderRadius: "5px",
    padding: "7px 10px",
    cursor: "pointer",
    fontSize: "11px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
        padding: "16px",
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
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#22d3ee",
              fontSize: "25px",
            }}
          >
            SALES RETURN
          </h1>

          <div
            style={{
              color: "#64748b",
              fontSize: "11px",
              marginTop: "3px",
            }}
          >
            Sales Return • Credit Note • Stock IN • Original Sale Linked
          </div>
        </div>

        <div
          style={{
            background: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "6px",
            padding: "7px 12px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {returns.length} Returns
        </div>
      </div>

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            TOTAL RETURNS
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#22d3ee",
              fontSize: "21px",
            }}
          >
            {filteredReturns.length}
          </strong>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            RETURNED VAT
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#fbbf24",
              fontSize: "21px",
            }}
          >
            SAR {formatMoney(totalReturnedVat)}
          </strong>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            TOTAL CREDIT
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#4ade80",
              fontSize: "21px",
            }}
          >
            SAR {formatMoney(totalReturnedValue)}
          </strong>
        </div>
      </div>

      {/* CREATE RETURN */}
      <div
        style={{
          ...cardStyle,
          marginBottom: "14px",
        }}
      >
        <h2
          style={{
            margin: "0 0 14px",
            color: "#60a5fa",
            fontSize: "17px",
          }}
        >
          CREATE SALES RETURN / CREDIT NOTE
        </h2>

        {/* ============================================================
            NEW: SEARCH INVOICE BY NUMBER
            ============================================================ */}
        <div
          style={{
            background: "#0b1220",
            border: "1px solid #164e63",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          <label
            style={{
              ...labelStyle,
              color: "#67e8f9",
              fontSize: "12px",
            }}
          >
            SEARCH ORIGINAL INVOICE
          </label>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="Enter Invoice Number, ERP Invoice, or Delivery Note..."
              style={{
                ...inputStyle,
                height: "42px",
                border: "1px solid #0891b2",
                fontWeight: 600,
                flex: 1,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchInvoice(invoiceSearch);
                }
              }}
            />
            <button
              onClick={() => searchInvoice(invoiceSearch)}
              style={{
                ...primaryButtonStyle,
                height: "42px",
                whiteSpace: "nowrap",
              }}
            >
              🔍 Search
            </button>
            <button
              onClick={() => {
                setInvoiceSearch("");
                setFoundSale(null);
                setSearchError("");
              }}
              style={{
                ...secondaryButtonStyle,
                height: "42px",
              }}
            >
              Clear
            </button>
          </div>

          {searchError && (
            <div
              style={{
                marginTop: "8px",
                color: "#f87171",
                fontSize: "12px",
                padding: "8px",
                background: "rgba(248, 113, 113, 0.1)",
                borderRadius: "4px",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              ⚠️ {searchError}
            </div>
          )}

          {foundSale && (
            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              <div
                style={{
                  background: "#111827",
                  padding: "8px",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "9px",
                  }}
                >
                  INVOICE
                </div>

                <strong
                  style={{
                    color: "#22d3ee",
                    fontSize: "11px",
                  }}
                >
                  {getSaleInvoiceNumber(foundSale)}
                </strong>
              </div>

              <div
                style={{
                  background: "#111827",
                  padding: "8px",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "9px",
                  }}
                >
                  CUSTOMER
                </div>

                <strong
                  style={{
                    color: "#ffffff",
                    fontSize: "11px",
                  }}
                >
                  {foundSale.customer_name || "-"}
                </strong>
              </div>

              <div
                style={{
                  background: "#111827",
                  padding: "8px",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "9px",
                  }}
                >
                  ORIGINAL QTY
                </div>

                <strong
                  style={{
                    color: "#ffffff",
                    fontSize: "11px",
                  }}
                >
                  {formatMoney(Number(foundSale.quantity || 0))}
                </strong>
              </div>

              <div
                style={{
                  background: "#111827",
                  padding: "8px",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "9px",
                  }}
                >
                  REMAINING
                </div>

                <strong
                  style={{
                    color: selectedSaleRemainingQuantity > 0 ? "#4ade80" : "#f87171",
                    fontSize: "11px",
                  }}
                >
                  {formatMoney(selectedSaleRemainingQuantity)}
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* HEADER FIELDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>Return Date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
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
            <label style={labelStyle}>Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {getCustomerName(customer.id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Original Invoice No.</label>
            <input
              value={invoiceNo}
              readOnly
              placeholder="Auto-filled from search"
              style={{
                ...inputStyle,
                color: "#67e8f9",
                background: "#0b1220",
              }}
            />
          </div>
        </div>

        {/* REASON */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>Return Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Damaged / Wrong Item / Customer Return..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              style={inputStyle}
            />
          </div>
        </div>

        {/* RETURN ITEMS */}
        <div
          style={{
            marginTop: "18px",
            border: "1px solid #263548",
            borderRadius: "7px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#0b1220",
              padding: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong
              style={{
                color: "#67e8f9",
                fontSize: "12px",
              }}
            >
              RETURNED ITEMS
            </strong>

            <button
              onClick={addLine}
              disabled={saving || Boolean(foundSale)}
              style={{
                ...primaryButtonStyle,
                padding: "6px 12px",
                opacity: saving || foundSale ? 0.5 : 1,
              }}
              title={foundSale ? "This Sales module uses one item per original sale." : ""}
            >
              + Add Item
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "850px",
                fontSize: "11px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#111827" }}>
                  <th style={{ padding: "8px", textAlign: "left", color: "#67e8f9" }}>Item</th>
                  <th style={{ padding: "8px", textAlign: "left", color: "#67e8f9" }}>Qty</th>
                  <th style={{ padding: "8px", textAlign: "left", color: "#67e8f9" }}>Unit</th>
                  <th style={{ padding: "8px", textAlign: "left", color: "#67e8f9" }}>Unit Price</th>
                  <th style={{ padding: "8px", textAlign: "right", color: "#67e8f9" }}>Taxable</th>
                  <th style={{ padding: "8px", textAlign: "right", color: "#67e8f9" }}>VAT 15%</th>
                  <th style={{ padding: "8px", textAlign: "right", color: "#67e8f9" }}>Total</th>
                  <th style={{ padding: "8px", textAlign: "center", color: "#67e8f9" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {calculatedLines.map((line, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        padding: "7px",
                        borderTop: "1px solid #1e293b",
                        width: "230px",
                      }}
                    >
                      <select
                        value={line.item_id}
                        onChange={(e) => updateLine(index, "item_id", e.target.value)}
                        disabled={Boolean(foundSale)}
                        style={{
                          ...inputStyle,
                          opacity: foundSale ? 0.7 : 1,
                        }}
                      >
                        <option value="">Select Item</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        borderTop: "1px solid #1e293b",
                        width: "100px",
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        max={foundSale ? selectedSaleRemainingQuantity : undefined}
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                        placeholder={foundSale ? `Max ${selectedSaleRemainingQuantity}` : ""}
                        style={inputStyle}
                      />
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        borderTop: "1px solid #1e293b",
                        color: "#94a3b8",
                      }}
                    >
                      {getItemUnit(Number(line.item_id))}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        borderTop: "1px solid #1e293b",
                        width: "120px",
                      }}
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(index, "unit_price", e.target.value)}
                        style={inputStyle}
                      />
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        textAlign: "right",
                        borderTop: "1px solid #1e293b",
                        color: "#cbd5e1",
                      }}
                    >
                      {formatMoney(line.taxableAmount)}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        textAlign: "right",
                        borderTop: "1px solid #1e293b",
                        color: "#fbbf24",
                      }}
                    >
                      {formatMoney(line.vat)}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        textAlign: "right",
                        borderTop: "1px solid #1e293b",
                        color: "#4ade80",
                        fontWeight: 700,
                      }}
                    >
                      {formatMoney(line.total)}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        textAlign: "center",
                        borderTop: "1px solid #1e293b",
                      }}
                    >
                      <button
                        onClick={() => removeLine(index)}
                        disabled={saving || Boolean(foundSale)}
                        style={{
                          ...dangerButtonStyle,
                          opacity: foundSale ? 0.5 : 1,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOTALS */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "15px",
          }}
        >
          <div
            style={{
              width: "300px",
              background: "#0b1220",
              border: "1px solid #263548",
              borderRadius: "7px",
              padding: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                color: "#cbd5e1",
                fontSize: "12px",
              }}
            >
              <span>Subtotal</span>
              <strong>SAR {formatMoney(subtotal)}</strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                color: "#fbbf24",
                fontSize: "12px",
              }}
            >
              <span>VAT 15%</span>
              <strong>SAR {formatMoney(vat)}</strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0 0",
                marginTop: "5px",
                borderTop: "1px solid #334155",
                color: "#4ade80",
                fontSize: "16px",
              }}
            >
              <strong>Credit Note Total</strong>
              <strong>SAR {formatMoney(total)}</strong>
            </div>
          </div>
        </div>

        {/* SAVE */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "15px",
          }}
        >
          <button
            onClick={saveSalesReturn}
            disabled={saving}
            style={primaryButtonStyle}
          >
            {saving ? "Saving..." : "Save Sales Return & Credit Note"}
          </button>

          <button
            onClick={clearForm}
            disabled={saving}
            style={secondaryButtonStyle}
          >
            Clear
          </button>
        </div>
      </div>

      {/* RETURN HISTORY */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
            gap: "10px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#60a5fa",
                fontSize: "17px",
              }}
            >
              SALES RETURN HISTORY
            </h2>

            <div
              style={{
                color: "#64748b",
                fontSize: "10px",
                marginTop: "3px",
              }}
            >
              Credit notes linked to original sales
            </div>
          </div>

          <input
            placeholder="Search invoice / credit note / customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...inputStyle,
              width: "280px",
            }}
          />
        </div>

        <div
          style={{
            overflowX: "auto",
            border: "1px solid #263548",
            borderRadius: "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11px",
              minWidth: "1200px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#0b1220" }}>
                {[
                  "Date",
                  "Credit Note",
                  "Original Invoice",
                  "Customer",
                  "Branch",
                  "Reason",
                  "Subtotal",
                  "VAT",
                  "Total",
                  "Status",
                  "PDF",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      color: "#67e8f9",
                      borderBottom: "1px solid #263548",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: "20px", textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                    No sales returns found.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      {item.return_date || "-"}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#22d3ee",
                        fontWeight: 700,
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      {item.credit_note_no || "-"}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#fbbf24",
                        fontWeight: 600,
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      {item.invoice_no || "-"}
                    </td>

                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      {getCustomerName(item.customer_id)}
                    </td>

                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      {getBranchName(item.branch_id)}
                    </td>

                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      {item.reason || "-"}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#cbd5e1",
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      SAR {formatMoney(Number(item.subtotal || 0))}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#fbbf24",
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      SAR {formatMoney(Number(item.vat || 0))}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#4ade80",
                        fontWeight: 700,
                        borderBottom: "1px solid #1e293b",
                      }}
                    >
                      SAR {formatMoney(Number(item.total || 0))}
                    </td>

                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 7px",
                          borderRadius: "4px",
                          background: item.status === "POSTED" ? "#064e3b" : "#334155",
                          color: item.status === "POSTED" ? "#6ee7b7" : "#cbd5e1",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {item.status || "-"}
                      </span>
                    </td>

                    <td style={{ padding: "7px", borderBottom: "1px solid #1e293b" }}>
                      <button onClick={() => exportCreditNotePDF(item)} style={pdfButtonStyle}>
                        Export PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INFORMATION */}
      <div
        style={{
          marginTop: "14px",
          padding: "12px 15px",
          background: "#0b1220",
          border: "1px solid #263548",
          borderRadius: "8px",
          color: "#94a3b8",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#67e8f9" }}>RETURN ACCOUNTING:</strong>{" "}
        A sales return does{" "}
        <strong style={{ color: "#fbbf24" }}>NOT DELETE OR CHANGE</strong> the original sales record.
        Instead, the system creates a separate credit note linked to the original sale through{" "}
        <strong style={{ color: "#22d3ee" }}>original_sale_id</strong>.
        <br />
        <br />
        <strong style={{ color: "#67e8f9" }}>STOCK:</strong> The original sale creates a negative stock
        movement. The sales return creates a positive{" "}
        <strong style={{ color: "#4ade80" }}>SALES_RETURN / STOCK IN</strong> movement.
        <br />
        <br />
        <strong style={{ color: "#67e8f9" }}>NET SALES:</strong> The original sales amount will remain
        in the Sales table, while Sales and Reports will later use the credit notes to calculate
        the correct <strong style={{ color: "#4ade80" }}>NET SALES</strong>.
      </div>
    </div>
  );
}

export default SalesReturn;