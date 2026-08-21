import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Customer = {
  id: number;
  customer_name: string;
  active: boolean | null;
};

type Item = {
  id: number;
  item_name: string;
  unit: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type Driver = {
  id: number;
  driver_name: string;
  active?: boolean | null;
};

type Sale = {
  id: number;
  created_at: string | null;
  sales_date: string;
  delivery_note_no: string | null;
  customer_name: string;
  item_id: number;
  driver_name: string | null;
  quantity: number;
  unit_price: number;
  vat_percent: number;
  total_amount: number;
  payment_type: string | null;
  payment_status: string | null; // NEW: 'PAID' | 'UNPAID' | 'PARTIAL'
  notes: string | null;
  branch_id: string;
  sales_description: string | null;
  description: string | null;
  invoice_status: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  erp_invoice_status: string | null;
  erp_invoice_number: string | null;
  erp_invoice_date: string | null;
};

type SaleForm = {
  sales_date: string;
  delivery_note_no: string;
  customer_name: string;
  item_id: string;
  driver_name: string;
  quantity: string;
  unit_price: string;
  vat_percent: string;
  payment_type: string;
  payment_status: string; // NEW
  branch_id: string;
  sales_description: string;
  description: string;
  notes: string;
};

type DocumentAttachment = {
  id: number;
  created_at: string;
  document_type: "SALE" | "PURCHASE";
  reference_id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
};

type ItemSalesSummary = {
  itemId: number;
  itemName: string;
  unit: string;
  quantity: number;
  amount: number;
};

// ============================================================
// COMPANY DETAILS
// ============================================================
const COMPANY_NAME_EN = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";
const COMPANY_CR_NUMBER = "1011142013";
const COMPANY_VAT_NUMBER = "310208502500003";
const COMPANY_ADDRESS = "Riyadh, Saudi Arabia";
const COMPANY_PHONE = "+966 5X XXX XXXX";
const COMPANY_EMAIL = "info@alshams.com";
const CURRENCY = "SAR";

const emptyForm: SaleForm = {
  sales_date: new Date().toISOString().split("T")[0],
  delivery_note_no: "",
  customer_name: "",
  item_id: "",
  driver_name: "",
  quantity: "",
  unit_price: "",
  vat_percent: "15",
  payment_type: "CASH",
  payment_status: "UNPAID",
  branch_id: "",
  sales_description: "",
  description: "",
  notes: "",
};

function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [form, setForm] = useState<SaleForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL"); // NEW

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [invoiceModal, setInvoiceModal] = useState<"PENDING" | "GENERATED" | null>(null);
  const [externalInvoiceSale, setExternalInvoiceSale] = useState<Sale | null>(null);
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState("");
  const [externalInvoiceDate, setExternalInvoiceDate] = useState(new Date().toISOString().split("T")[0]);

  const [documentSale, setDocumentSale] = useState<Sale | null>(null);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentDescription, setDocumentDescription] = useState("");

  // ============================================================
  // PROFESSIONAL SALES TAX INVOICE PDF - REDESIGNED
  // ============================================================
  function exportERPInvoicePDF(sale: Sale) {
    if (!sale) {
      alert("No sale data to export.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    let y = margin;

    const item = items.find((i) => i.id === sale.item_id);
    const itemName = item?.item_name || `Item #${sale.item_id}`;
    const unit = item?.unit || "PCS";
    const description = sale.sales_description || itemName;
    
    const subtotal = Number(sale.quantity || 0) * Number(sale.unit_price || 0);
    const vat = subtotal * (Number(sale.vat_percent || 0) / 100);
    const total = Number(sale.total_amount || 0);

    // ==========================================================
    // TOP COLOR BAR
    // ==========================================================
    doc.setFillColor(20, 60, 120);
    doc.rect(0, 0, pageWidth, 6, "F");

    doc.setFillColor(10, 20, 40);
    doc.rect(0, pageHeight - 6, pageWidth, 6, "F");

    // ==========================================================
    // HEADER - COMPANY LOGO AREA & DETAILS
    // ==========================================================
    y = margin + 4;

    // Company Name - Large
    doc.setFillColor(20, 60, 120);
    doc.roundedRect(margin, y, 85, 32, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(COMPANY_NAME_EN, margin + 5, y + 12);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 210, 230);
    doc.text(COMPANY_NAME_AR, margin + 5, y + 22);
    doc.text("C.R. " + COMPANY_CR_NUMBER, margin + 5, y + 29);

    // Company Details - Right side
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin + 88, y, pageWidth - margin - 88 - margin, 32, 3, 3, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin + 88, y, pageWidth - margin - 88 - margin, 32, 3, 3, "S");

    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("VAT Registration #", margin + 93, y + 8);
    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(COMPANY_VAT_NUMBER, margin + 93, y + 15);

    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(COMPANY_ADDRESS, margin + 93, y + 23);
    doc.text(COMPANY_PHONE + " | " + COMPANY_EMAIL, margin + 93, y + 29);

    y += 38;

    // ==========================================================
    // INVOICE TITLE BAR
    // ==========================================================
    doc.setFillColor(230, 240, 250);
    doc.rect(margin, y, pageWidth - margin * 2, 12, "F");
    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, pageWidth - margin * 2, 12, "S");

    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SALES TAX INVOICE", pageWidth / 2, y + 9, { align: "center" });

    y += 14;

    // ==========================================================
    // INVOICE NUMBER & DATE BOX
    // ==========================================================
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, "S");

    doc.setTextColor(60, 60, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const invoiceNumber = sale.erp_invoice_number || "ERP-" + String(sale.id).padStart(6, "0");
    doc.text(`Invoice #: ${invoiceNumber}`, margin + 8, y + 7);
    doc.text(`Date: ${sale.erp_invoice_date || sale.sales_date || "-"}`, margin + 85, y + 7);
    doc.text(`Delivery Note: ${sale.delivery_note_no || "-"}`, pageWidth - margin - 8, y + 7, { align: "right" });

    y += 14;

    // ==========================================================
    // SELLER & BUYER DETAILS - TWO COLUMN LAYOUT
    // ==========================================================
    // SELLER
    doc.setFillColor(20, 60, 120);
    doc.roundedRect(margin, y, (pageWidth - margin * 2 - 6) / 2, 34, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SELLER DETAILS", margin + 6, y + 6);

    doc.setTextColor(220, 230, 250);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(COMPANY_NAME_EN, margin + 6, y + 14);
    doc.text(COMPANY_NAME_AR, margin + 6, y + 20);
    doc.text(`C.R. ${COMPANY_CR_NUMBER} | VAT ${COMPANY_VAT_NUMBER}`, margin + 6, y + 26);
    doc.text(COMPANY_ADDRESS, margin + 6, y + 31);

    // BUYER
    const buyerX = margin + (pageWidth - margin * 2 - 6) / 2 + 6;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(buyerX, y, (pageWidth - margin * 2 - 6) / 2, 34, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(buyerX, y, (pageWidth - margin * 2 - 6) / 2, 34, 2, 2, "S");

    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BUYER DETAILS", buyerX + 6, y + 6);

    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(sale.customer_name || "-", buyerX + 6, y + 14);
    doc.text(`Payment: ${sale.payment_type || "-"}`, buyerX + 6, y + 21);
    doc.text(`Driver: ${sale.driver_name || "-"}`, buyerX + 6, y + 28);
    doc.text(`Branch: ${branches.find(b => b.id === sale.branch_id)?.branch_name || "-"}`, buyerX + 6, y + 33);

    y += 40;

    // ==========================================================
    // ITEM DETAILS TABLE
    // ==========================================================
    doc.setFillColor(20, 60, 120);
    doc.rect(margin, y, pageWidth - margin * 2, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    const colWidths = {
      no: 12,
      description: 55,
      unit: 18,
      qty: 20,
      price: 22,
      total: 25,
      vatPercent: 15,
      vatAmount: 22,
      netTotal: 25,
    };

    let xPos = margin + 3;
    doc.text("#", xPos, y + 6.5);
    xPos += colWidths.no;
    doc.text("Item Description", xPos, y + 6.5);
    xPos += colWidths.description;
    doc.text("Unit", xPos, y + 6.5);
    xPos += colWidths.unit;
    doc.text("Qty", xPos, y + 6.5);
    xPos += colWidths.qty;
    doc.text("Unit Price", xPos, y + 6.5);
    xPos += colWidths.price;
    doc.text("Total", xPos, y + 6.5);
    xPos += colWidths.total;
    doc.text("VAT %", xPos, y + 6.5);
    xPos += colWidths.vatPercent;
    doc.text("VAT Amt", xPos, y + 6.5);
    xPos += colWidths.vatAmount;
    doc.text("Net Total", xPos, y + 6.5);

    y += 9;

    // Table Row
    const rowHeight = 8;
    const safeDescription = description.length > 30 ? description.substring(0, 28) + "…" : description;

    // Alternate row color
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");

    doc.setDrawColor(220, 225, 230);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    doc.setTextColor(40, 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    xPos = margin + 3;
    doc.text("1", xPos, y + 5.5);
    xPos += colWidths.no;
    doc.text(safeDescription, xPos, y + 5.5);
    xPos += colWidths.description;
    doc.text(unit, xPos, y + 5.5);
    xPos += colWidths.unit;
    doc.text(String(sale.quantity || 0), xPos, y + 5.5);
    xPos += colWidths.qty;
    doc.text(`${Number(sale.unit_price || 0).toFixed(2)}`, xPos, y + 5.5);
    xPos += colWidths.price;
    doc.text(`${subtotal.toFixed(2)}`, xPos, y + 5.5);
    xPos += colWidths.total;
    doc.text(`${Number(sale.vat_percent || 0).toFixed(0)}%`, xPos, y + 5.5);
    xPos += colWidths.vatPercent;
    doc.text(`${vat.toFixed(2)}`, xPos, y + 5.5);
    xPos += colWidths.vatAmount;
    doc.text(`${total.toFixed(2)}`, xPos, y + 5.5);

    y += rowHeight + 5;

    // ==========================================================
    // TOTALS SECTION - Right aligned box
    // ==========================================================
    const totalsX = 125;
    const totalsWidth = 68;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(totalsX, y, totalsWidth, 48, 3, 3, "FD");
    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.5);
    doc.roundedRect(totalsX, y, totalsWidth, 48, 3, 3, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Subtotal
    doc.setTextColor(60, 60, 70);
    doc.text("Subtotal:", totalsX + 6, y + 8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${CURRENCY} ${subtotal.toFixed(2)}`, totalsX + totalsWidth - 6, y + 8, { align: "right" });

    // VAT
    doc.setTextColor(60, 60, 70);
    doc.text(`VAT (${sale.vat_percent || 0}%):`, totalsX + 6, y + 18);
    doc.setTextColor(180, 120, 0);
    doc.text(`${CURRENCY} ${vat.toFixed(2)}`, totalsX + totalsWidth - 6, y + 18, { align: "right" });

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsX + 6, y + 23, totalsX + totalsWidth - 6, y + 23);

    // Grand Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 60, 120);
    doc.text("GRAND TOTAL:", totalsX + 6, y + 35);
    doc.setTextColor(0, 150, 80);
    doc.setFontSize(13);
    doc.text(`${CURRENCY} ${total.toFixed(2)}`, totalsX + totalsWidth - 6, y + 35, { align: "right" });

    y += 54;

    // ==========================================================
    // NOTES / DESCRIPTION
    // ==========================================================
    if (sale.description || sale.notes) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "F");
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "S");

      doc.setTextColor(20, 60, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("NOTES / DESCRIPTION", margin + 8, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 70);
      
      const notesText = sale.description || sale.notes || "";
      const noteLines = doc.splitTextToSize(notesText, pageWidth - margin * 2 - 20);
      doc.text(noteLines, margin + 8, y + 14);

      y += 28;
    }

    // ==========================================================
    // TERMS & CONDITIONS
    // ==========================================================
    if (y > pageHeight - 65) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 2, 2, "S");

    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TERMS & CONDITIONS", margin + 8, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 70);

    const terms = [
      "1. Goods once sold cannot be returned without prior authorization.",
      "2. Payment terms: As per agreed terms and conditions.",
      "3. This is a system-generated tax invoice and is legally valid.",
      "4. VAT is charged as per Saudi ZATCA regulations.",
    ];

    let termY = y + 12;
    terms.forEach((term) => {
      doc.text(term, margin + 8, termY);
      termY += 4.5;
    });

    y += 34;

    // ==========================================================
    // SIGNATURE SECTION
    // ==========================================================
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);

    const sigWidth = (pageWidth - margin * 2 - 30) / 3;

    // Receiver Signature
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, sigWidth, 18, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, sigWidth, 18, 2, 2, "S");
    doc.line(margin + 5, y + 10, margin + sigWidth - 5, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 110);
    doc.text("Receiver Signature", margin + sigWidth / 2, y + 16, { align: "center" });

    // Accountant Signature
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + sigWidth + 15, y, sigWidth, 18, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin + sigWidth + 15, y, sigWidth, 18, 2, 2, "S");
    doc.line(margin + sigWidth + 20, y + 10, margin + sigWidth * 2 + 10, y + 10);
    doc.text("Accountant Signature", margin + sigWidth + 15 + sigWidth / 2, y + 16, { align: "center" });

    // Authorized Signature
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + sigWidth * 2 + 30, y, sigWidth, 18, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin + sigWidth * 2 + 30, y, sigWidth, 18, 2, 2, "S");
    doc.line(margin + sigWidth * 2 + 35, y + 10, margin + sigWidth * 3 + 25, y + 10);
    doc.text("Authorized Signature", margin + sigWidth * 2 + 30 + sigWidth / 2, y + 16, { align: "center" });

    y += 22;

    // ==========================================================
    // FOOTER
    // ==========================================================
    const footerY = pageHeight - 10;

    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(120, 130, 140);

    doc.text(`Generated: ${new Date().toLocaleString("en-SA")}`, margin, footerY);
    doc.text(`Invoice: ${invoiceNumber}`, pageWidth / 2, footerY, { align: "center" });
    doc.text(`Thank you for your business!`, pageWidth - margin, footerY, { align: "right" });

    // Page numbers
    const pageCount = (doc as any).getNumberOfPages?.() ?? 1;
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120, 130, 140);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 3, { align: "right" });
    }

    doc.save(`${invoiceNumber}.pdf`);
  }

  // ============================================================
  // PDF EXPORT - DETAILED SALES REPORT
  // ============================================================
  const exportSalesReportPDF = () => {
    if (sales.length === 0) {
      alert("No sales data to export.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 12;
    const borderMargin = 6;
    let y = margin + 5;

    // ==========================================================
    // PAGE BORDER
    // ==========================================================
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.roundedRect(
      borderMargin,
      borderMargin,
      pageWidth - borderMargin * 2,
      pageHeight - borderMargin * 2,
      3,
      3,
      "S"
    );

    // ==========================================================
    // HEADER SECTION
    // ==========================================================
    doc.setFillColor(10, 20, 40);
    doc.rect(margin, y, pageWidth - margin * 2, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(COMPANY_NAME_EN, margin + 5, y + 11);

    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(COMPANY_NAME_AR, margin + 5, y + 19);

    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`C.R: ${COMPANY_CR_NUMBER}`, pageWidth - margin - 5, y + 8, { align: "right" });
    doc.text(`VAT #: ${COMPANY_VAT_NUMBER}`, pageWidth - margin - 5, y + 15, { align: "right" });
    doc.text(COMPANY_ADDRESS, pageWidth - margin - 5, y + 22, { align: "right" });

    y += 38;

    // ==========================================================
    // DOCUMENT TITLE
    // ==========================================================
    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DETAILED SALES REPORT", pageWidth / 2, y, { align: "center" });

    y += 6;

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    
    const dateLabel = dateFilter ? `Date: ${dateFilter}` : "All Dates";
    const customerLabel = customerFilter !== "ALL" ? `Customer: ${customerFilter}` : "All Customers";
    const branchLabel = branchFilter !== "ALL" ? `Branch: ${branches.find(b => b.id === branchFilter)?.branch_name || branchFilter}` : "All Branches";
    const paymentStatusLabel = paymentStatusFilter !== "ALL" ? `Payment: ${paymentStatusFilter}` : "All Payments";
    
    doc.text(`Generated: ${new Date().toLocaleString("en-SA")}`, margin + 5, y);
    doc.text(dateLabel, margin + 75, y);
    doc.text(customerLabel, margin + 130, y);
    doc.text(branchLabel, margin + 185, y);
    doc.text(paymentStatusLabel, pageWidth - margin - 5, y, { align: "right" });

    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // ==========================================================
    // SECTION 1: INVOICE DETAILS TABLE
    // ==========================================================
    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("1. INVOICE DETAILS", margin + 2, y);
    y += 6;

    const columns = [
      { header: "Date", width: 16 },
      { header: "Delivery Note", width: 18 },
      { header: "Invoice No.", width: 20 },
      { header: "Item / Description", width: 28 },
      { header: "Customer", width: 24 },
      { header: "Driver", width: 14 },
      { header: "Qty", width: 10 },
      { header: "Price", width: 16 },
      { header: "Total (Qty×Price)", width: 20 },
      { header: "VAT %", width: 10 },
      { header: "VAT Amt", width: 16 },
      { header: "Net Total", width: 20 },
      { header: "Payment", width: 18 },
    ];

    const tableData = filteredSales.map((sale) => {
      const item = items.find((i) => i.id === sale.item_id);
      const itemName = item?.item_name || `Item #${sale.item_id}`;
      const subtotal = Number(sale.quantity || 0) * Number(sale.unit_price || 0);
      const vatAmount = subtotal * (Number(sale.vat_percent || 0) / 100);
      
      const description = sale.sales_description || itemName;
      
      return [
        sale.sales_date || "-",
        sale.delivery_note_no || "-",
        sale.erp_invoice_number || sale.invoice_number || "-",
        description.length > 18 ? description.substring(0, 16) + "…" : description,
        sale.customer_name || "-",
        sale.driver_name || "-",
        Number(sale.quantity || 0).toFixed(0),
        Number(sale.unit_price || 0).toFixed(2),
        subtotal.toFixed(2),
        `${Number(sale.vat_percent || 0).toFixed(0)}%`,
        vatAmount.toFixed(2),
        Number(sale.total_amount || 0).toFixed(2),
        sale.payment_status || "UNPAID",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [columns.map(c => c.header)],
      body: tableData,
      theme: "striped",
      styles: {
        fontSize: 5,
        cellPadding: 1.5,
        textColor: [50, 50, 60],
      },
      headStyles: {
        fillColor: [20, 60, 120],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: columns.reduce((acc, col, index) => {
        acc[index] = { cellWidth: col.width };
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didDrawPage: (data) => {
        y = data.cursor?.y || y + 20;
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;

    // Check if we need a new page for summary
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin + 5;
      
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.roundedRect(
        borderMargin,
        borderMargin,
        pageWidth - borderMargin * 2,
        pageHeight - borderMargin * 2,
        3,
        3,
        "S"
      );
      
      doc.setFillColor(10, 20, 40);
      doc.rect(margin, y, pageWidth - margin * 2, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(COMPANY_NAME_EN, margin + 5, y + 11);
      doc.setTextColor(200, 200, 200);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(COMPANY_NAME_AR, margin + 5, y + 19);
      doc.setTextColor(200, 200, 200);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(`C.R: ${COMPANY_CR_NUMBER}`, pageWidth - margin - 5, y + 8, { align: "right" });
      doc.text(`VAT #: ${COMPANY_VAT_NUMBER}`, pageWidth - margin - 5, y + 15, { align: "right" });
      doc.text(COMPANY_ADDRESS, pageWidth - margin - 5, y + 22, { align: "right" });
      y += 38;
      
      doc.setTextColor(20, 60, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DETAILED SALES REPORT (continued)", pageWidth / 2, y, { align: "center" });
      y += 10;
      
      doc.setTextColor(20, 60, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. SUMMARY", margin + 2, y);
      y += 6;
    } else {
      doc.setTextColor(20, 60, 120);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. SUMMARY", margin + 2, y);
      y += 6;
    }

    // ==========================================================
    // PAYMENT STATUS SUMMARY
    // ==========================================================
    const paidCount = filteredSales.filter(s => (s.payment_status || "UNPAID") === "PAID").length;
    const unpaidCount = filteredSales.filter(s => (s.payment_status || "UNPAID") === "UNPAID").length;
    const partialCount = filteredSales.filter(s => (s.payment_status || "UNPAID") === "PARTIAL").length;
    const paidAmount = filteredSales.filter(s => (s.payment_status || "UNPAID") === "PAID").reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const unpaidAmount = filteredSales.filter(s => (s.payment_status || "UNPAID") === "UNPAID").reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    doc.setFillColor(240, 245, 250);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, "F");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, "S");

    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("PAYMENT STATUS SUMMARY", margin + 8, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 70);

    const statusWidth = (pageWidth - margin * 2 - 20) / 6;
    let sx = margin + 8;

    doc.text(`✅ Paid: ${paidCount} (SAR ${paidAmount.toFixed(2)})`, sx, y + 14);
    sx += statusWidth;
    doc.text(`⏳ Unpaid: ${unpaidCount} (SAR ${unpaidAmount.toFixed(2)})`, sx, y + 14);
    sx += statusWidth;
    doc.text(`🔄 Partial: ${partialCount}`, sx, y + 14);
    sx += statusWidth;
    doc.text(`Total Invoices: ${filteredSales.length}`, sx, y + 14);

    y += 24;

    // ==========================================================
    // ITEM-WISE SUMMARY TABLE
    // ==========================================================
    const itemMap = new Map<number, { itemId: number; itemName: string; unit: string; quantity: number; amount: number }>();
    
    filteredSales.forEach((sale) => {
      const item = items.find((i) => i.id === sale.item_id);
      const itemName = item?.item_name || `Item #${sale.item_id}`;
      const unit = item?.unit || "PCS";

      const existing = itemMap.get(sale.item_id);
      if (existing) {
        existing.quantity += Number(sale.quantity || 0);
        existing.amount += Number(sale.total_amount || 0);
      } else {
        itemMap.set(sale.item_id, {
          itemId: sale.item_id,
          itemName,
          unit,
          quantity: Number(sale.quantity || 0),
          amount: Number(sale.total_amount || 0),
        });
      }
    });

    const itemSummary = Array.from(itemMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));

    const summaryColumns = [
      { header: "#", width: 12 },
      { header: "Item Name", width: 65 },
      { header: "Unit", width: 18 },
      { header: "Total Qty", width: 28 },
      { header: "Total Amount", width: 38 },
    ];

    const summaryData = itemSummary.map((item, index) => [
      String(index + 1),
      item.itemName,
      item.unit,
      Number(item.quantity).toFixed(0),
      `SAR ${Number(item.amount).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [summaryColumns.map(c => c.header)],
      body: summaryData,
      theme: "striped",
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [50, 50, 60],
      },
      headStyles: {
        fillColor: [20, 60, 120],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: summaryColumns.reduce((acc, col, index) => {
        acc[index] = { cellWidth: col.width };
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
      didDrawPage: (data) => {
        y = data.cursor?.y || y + 20;
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;

    // ==========================================================
    // GRAND TOTALS
    // ==========================================================
    const grandQuantity = itemSummary.reduce((sum, i) => sum + i.quantity, 0);
    const grandAmount = itemSummary.reduce((sum, i) => sum + i.amount, 0);
    
    const totalSubtotal = filteredSales.reduce((sum, s) => sum + (Number(s.quantity || 0) * Number(s.unit_price || 0)), 0);
    const totalVatAmount = filteredSales.reduce((sum, s) => {
      const subtotal = Number(s.quantity || 0) * Number(s.unit_price || 0);
      return sum + (subtotal * (Number(s.vat_percent || 0) / 100));
    }, 0);

    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin + 5;
    }

    doc.setFillColor(240, 245, 250);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, "FD");
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, "S");

    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("GRAND TOTALS", margin + 8, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);

    const totalWidth = (pageWidth - margin * 2 - 20) / 6;
    let tpos = margin + 8;

    doc.text(`Total Invoices: ${filteredSales.length}`, tpos, y + 18);
    tpos += totalWidth;
    doc.text(`Total Items: ${itemSummary.length}`, tpos, y + 18);
    tpos += totalWidth;
    doc.text(`Total Quantity: ${grandQuantity.toFixed(0)}`, tpos, y + 18);
    tpos += totalWidth;
    doc.text(`Total Sales (w/o VAT): SAR ${totalSubtotal.toFixed(2)}`, tpos, y + 18);
    tpos += totalWidth;
    doc.text(`Total VAT Amount: SAR ${totalVatAmount.toFixed(2)}`, tpos, y + 18);
    tpos += totalWidth;
    doc.text(`Total Paid: SAR ${paidAmount.toFixed(2)}`, tpos, y + 18);

    doc.setFillColor(20, 60, 120);
    doc.roundedRect(margin, y + 32, pageWidth - margin * 2, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`GRAND TOTAL WITH VAT: SAR ${grandAmount.toFixed(2)}`, pageWidth / 2, y + 39, { align: "center" });

    y += 48;

    // ==========================================================
    // FOOTER
    // ==========================================================
    const footerY2 = pageHeight - 14;

    doc.setDrawColor(200, 210, 220);
    doc.line(margin, footerY2 - 4, pageWidth - margin, footerY2 - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 130, 140);

    doc.text(`Generated: ${new Date().toLocaleString("en-SA")}`, margin, footerY2);
    doc.text("AL SHAMS ERP - Detailed Sales Report", pageWidth / 2, footerY2, { align: "center" });

    const pageCount2 = (doc as any).getNumberOfPages?.() ?? 1;
    for (let page = 1; page <= pageCount2; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(120, 130, 140);
      doc.text(`Page ${page} of ${pageCount2}`, pageWidth - margin, pageHeight - 14, { align: "right" });
    }

    doc.save(`Detailed_Sales_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [
        salesResult,
        customersResult,
        itemsResult,
        branchesResult,
        driversResult,
      ] = await Promise.all([
        supabase.from("sales").select("*").order("id", { ascending: false }),
        supabase.from("customers").select("id, customer_name, active").eq("active", true).order("customer_name", { ascending: true }),
        supabase.from("items").select("id, item_name, unit").order("item_name", { ascending: true }),
        supabase.from("branches").select("id, branch_name").order("branch_name", { ascending: true }),
        supabase.from("drivers").select("id, driver_name, active").eq("active", true).order("driver_name", { ascending: true }),
      ]);

      if (salesResult.error) throw new Error(`Sales: ${salesResult.error.message}`);
      if (customersResult.error) throw new Error(`Customers: ${customersResult.error.message}`);
      if (itemsResult.error) throw new Error(`Items: ${itemsResult.error.message}`);
      if (branchesResult.error) throw new Error(`Branches: ${branchesResult.error.message}`);
      if (driversResult.error) throw new Error(`Drivers: ${driversResult.error.message}`);

      setSales(salesResult.data || []);
      setCustomers(customersResult.data || []);
      setItems(itemsResult.data || []);
      setBranches(branchesResult.data || []);
      setDrivers(driversResult.data || []);

      if (!form.branch_id && branchesResult.data && branchesResult.data.length === 1) {
        setForm((prev) => ({
          ...prev,
          branch_id: String(branchesResult.data[0].id),
        }));
      }
    } catch (error) {
      console.error("Sales loading error:", error);
      alert(error instanceof Error ? error.message : "Unable to load sales data.");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof SaleForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ============================================================
  // TOGGLE PAYMENT STATUS
  // ============================================================
  async function togglePaymentStatus(sale: Sale) {
    const currentStatus = sale.payment_status || "UNPAID";
    const statuses = ["UNPAID", "PARTIAL", "PAID"];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    const confirmed = window.confirm(
      `Change payment status for ${sale.customer_name} (DN: ${sale.delivery_note_no})?\n\n` +
      `Current: ${currentStatus}\n` +
      `Next: ${nextStatus}`
    );
    
    if (!confirmed) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sales")
        .update({ payment_status: nextStatus })
        .eq("id", sale.id);
      
      if (error) throw new Error(error.message);
      
      await loadAllData();
      alert(`Payment status updated to: ${nextStatus}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update payment status.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // CALCULATIONS
  // ============================================================
  const quantity = Number(form.quantity) || 0;
  const unitPrice = Number(form.unit_price) || 0;
  const vatPercent = Number(form.vat_percent) || 0;
  const subtotal = quantity * unitPrice;
  const vatAmount = subtotal * (vatPercent / 100);
  const grandTotal = subtotal + vatAmount;

  // ============================================================
  // VALIDATION
  // ============================================================
  function validateForm() {
    if (!form.sales_date) { alert("Sales date is required."); return false; }
    if (!form.delivery_note_no.trim()) { alert("Delivery Note Number is required."); return false; }
    if (!form.customer_name.trim()) { alert("Customer is required."); return false; }
    if (!form.item_id) { alert("Item is required."); return false; }
    if (!form.branch_id) { alert("Branch is required."); return false; }
    if (quantity <= 0) { alert("Quantity must be greater than zero."); return false; }
    if (unitPrice < 0) { alert("Unit price cannot be negative."); return false; }
    if (Number.isNaN(quantity) || Number.isNaN(unitPrice)) {
      alert("Quantity and unit price must be valid numbers.");
      return false;
    }
    if (Number.isNaN(vatPercent) || vatPercent < 0) {
      alert("VAT percentage is invalid.");
      return false;
    }
    return true;
  }

  // ============================================================
  // ERP INVOICE NUMBER
  // ============================================================
  async function generateNextERPInvoiceNumber() {
    const currentYear = new Date().getFullYear();
    const { data, error } = await supabase
      .from("sales")
      .select("erp_invoice_number")
      .not("erp_invoice_number", "is", null)
      .order("id", { ascending: false });

    if (error) throw new Error(`Unable to generate ERP invoice number: ${error.message}`);

    let highestNumber = 0;
    for (const row of data || []) {
      const invoiceNumber = row.erp_invoice_number;
      if (typeof invoiceNumber !== "string") continue;
      const match = invoiceNumber.match(/ERP-S-\d{4}-(\d+)/);
      if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
    }
    const nextNumber = highestNumber + 1;
    return `ERP-S-${currentYear}-${String(nextNumber).padStart(5, "0")}`;
  }

  // ============================================================
  // CREATE STOCK MOVEMENT
  // ============================================================
  async function createSaleStockMovement(
    saleId: number,
    itemId: number,
    branchId: string,
    saleQuantity: number,
    deliveryNoteNo: string,
    saleDate: string
  ) {
    const { error } = await supabase.from("stock_movements").insert({
      date: saleDate,
      item_id: itemId,
      branch_id: branchId,
      movement_type: "SALE",
      quantity: -Math.abs(saleQuantity),
      reference_type: "SALE",
      reference_id: saleId,
      notes: `Delivery Note: ${deliveryNoteNo}`,
    });
    if (error) throw new Error(`Stock movement: ${error.message}`);
  }

  // ============================================================
  // SAVE SALE
  // ============================================================
  async function saveSale() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const branchId = String(form.branch_id).trim();

      const saleData: Record<string, string | number | null> = {
        sales_date: form.sales_date,
        delivery_note_no: form.delivery_note_no.trim(),
        customer_name: form.customer_name.trim(),
        item_id: Number(form.item_id),
        driver_name: form.driver_name.trim() || null,
        quantity: quantity,
        unit_price: unitPrice,
        vat_percent: vatPercent,
        total_amount: grandTotal,
        payment_type: form.payment_type,
        payment_status: form.payment_status,
        branch_id: branchId,
        sales_description: form.sales_description.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingId !== null) {
        const { error: deleteMovementError } = await supabase
          .from("stock_movements")
          .delete()
          .eq("reference_type", "SALE")
          .eq("reference_id", editingId);
        if (deleteMovementError) throw new Error(`Unable to remove old stock movement: ${deleteMovementError.message}`);

        const { error: updateSaleError } = await supabase
          .from("sales")
          .update(saleData)
          .eq("id", editingId);
        if (updateSaleError) throw new Error(`Unable to update sale: ${updateSaleError.message}`);

        await createSaleStockMovement(
          editingId,
          Number(form.item_id),
          branchId,
          quantity,
          form.delivery_note_no.trim(),
          form.sales_date
        );

        alert("Sale updated successfully.");
      } else {
        const erpInvoiceNumber = await generateNextERPInvoiceNumber();
        const today = new Date().toISOString().split("T")[0];

        saleData.invoice_status = "PENDING";
        saleData.erp_invoice_status = "GENERATED";
        saleData.erp_invoice_number = erpInvoiceNumber;
        saleData.erp_invoice_date = today;

        const { data: insertedSale, error: insertSaleError } = await supabase
          .from("sales")
          .insert(saleData)
          .select("*")
          .single();

        if (insertSaleError) throw new Error(`Unable to create sale: ${insertSaleError.message}`);
        if (!insertedSale) throw new Error("Sale was created but no sale ID was returned.");

        try {
          await createSaleStockMovement(
            insertedSale.id,
            Number(form.item_id),
            branchId,
            quantity,
            form.delivery_note_no.trim(),
            form.sales_date
          );
        } catch (stockError) {
          await supabase.from("sales").delete().eq("id", insertedSale.id);
          throw stockError;
        }

        alert(`Sale added successfully.\n\nERP Invoice: ${erpInvoiceNumber}\n\nExternal Invoice: PENDING`);
      }

      clearForm();
      await loadAllData();
    } catch (error) {
      console.error("Save sale error:", error);
      alert(error instanceof Error ? error.message : "Unable to save sale.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // EDIT SALE
  // ============================================================
  function editSale(sale: Sale) {
    setEditingId(sale.id);
    setForm({
      sales_date: sale.sales_date || "",
      delivery_note_no: sale.delivery_note_no || "",
      customer_name: sale.customer_name || "",
      item_id: String(sale.item_id),
      driver_name: sale.driver_name || "",
      quantity: String(sale.quantity),
      unit_price: String(sale.unit_price),
      vat_percent: String(sale.vat_percent ?? 15),
      payment_type: sale.payment_type || "CASH",
      payment_status: sale.payment_status || "UNPAID",
      branch_id: sale.branch_id || "",
      sales_description: sale.sales_description || "",
      description: sale.description || "",
      notes: sale.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ============================================================
  // DELETE SALE
  // ============================================================
  async function deleteSale(sale: Sale) {
    if (!window.confirm(`Delete Sale #${sale.id}?`)) return;
    setSaving(true);
    try {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("reference_type", "SALE")
        .eq("reference_id", sale.id);
      if (movementError) throw new Error(`Unable to delete stock movement: ${movementError.message}`);

      const { error: saleError } = await supabase.from("sales").delete().eq("id", sale.id);
      if (saleError) throw new Error(`Unable to delete sale: ${saleError.message}`);

      alert("Sale deleted successfully.");
      await loadAllData();
    } catch (error) {
      console.error("Delete sale error:", error);
      alert(error instanceof Error ? error.message : "Unable to delete sale.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // CLEAR FORM
  // ============================================================
  function clearForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      branch_id: branches.length === 1 ? String(branches[0].id) : "",
    });
  }

  // ============================================================
  // FILTER SALES
  // ============================================================
  const filteredSales = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const matchesSearch =
        !searchText ||
        sale.customer_name?.toLowerCase().includes(searchText) ||
        sale.delivery_note_no?.toLowerCase().includes(searchText) ||
        sale.driver_name?.toLowerCase().includes(searchText) ||
        sale.sales_description?.toLowerCase().includes(searchText) ||
        sale.erp_invoice_number?.toLowerCase().includes(searchText) ||
        sale.invoice_number?.toLowerCase().includes(searchText);

      const matchesDate = !dateFilter || sale.sales_date === dateFilter;
      const matchesCustomer = customerFilter === "ALL" || sale.customer_name === customerFilter;
      const matchesBranch = branchFilter === "ALL" || sale.branch_id === branchFilter;
      const matchesPaymentStatus = paymentStatusFilter === "ALL" || (sale.payment_status || "UNPAID") === paymentStatusFilter;

      return matchesSearch && matchesDate && matchesCustomer && matchesBranch && matchesPaymentStatus;
    });
  }, [sales, search, dateFilter, customerFilter, branchFilter, paymentStatusFilter]);

  // ============================================================
  // INVOICE COUNTS
  // ============================================================
  const pendingExternalInvoices = useMemo(
    () => sales.filter((sale) => (sale.invoice_status || "PENDING").toUpperCase() === "PENDING"),
    [sales]
  );
  const generatedExternalInvoices = useMemo(
    () => sales.filter((sale) => (sale.invoice_status || "PENDING").toUpperCase() === "GENERATED"),
    [sales]
  );

  // ============================================================
  // PAYMENT STATUS COUNTS
  // ============================================================
  const paidInvoices = useMemo(
    () => sales.filter((sale) => (sale.payment_status || "UNPAID") === "PAID"),
    [sales]
  );
  const unpaidInvoices = useMemo(
    () => sales.filter((sale) => (sale.payment_status || "UNPAID") === "UNPAID"),
    [sales]
  );
  const partialInvoices = useMemo(
    () => sales.filter((sale) => (sale.payment_status || "UNPAID") === "PARTIAL"),
    [sales]
  );

  // ============================================================
  // OVERALL SUMMARY
  // ============================================================
  const totalQuantity = filteredSales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalSubtotal = filteredSales.reduce((sum, s) => sum + Number(s.quantity || 0) * Number(s.unit_price || 0), 0);
  const totalVat = filteredSales.reduce((sum, s) => {
    const saleSubtotal = Number(s.quantity || 0) * Number(s.unit_price || 0);
    return sum + saleSubtotal * (Number(s.vat_percent || 0) / 100);
  }, 0);

  // ============================================================
  // ITEM-WISE SUMMARY
  // ============================================================
  const itemSalesSummary = useMemo(() => {
    const map = new Map<number, ItemSalesSummary>();
    for (const sale of filteredSales) {
      const item = items.find((i) => i.id === sale.item_id);
      const itemName = item?.item_name || `Item #${sale.item_id}`;
      const unit = item?.unit || "PCS";
      const existing = map.get(sale.item_id);
      if (existing) {
        existing.quantity += Number(sale.quantity || 0);
        existing.amount += Number(sale.total_amount || 0);
      } else {
        map.set(sale.item_id, {
          itemId: sale.item_id,
          itemName,
          unit,
          quantity: Number(sale.quantity || 0),
          amount: Number(sale.total_amount || 0),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [filteredSales, items]);

  const itemSummaryGrandQuantity = itemSalesSummary.reduce((sum, row) => sum + row.quantity, 0);
  const itemSummaryGrandAmount = itemSalesSummary.reduce((sum, row) => sum + row.amount, 0);

  // ============================================================
  // EXTERNAL INVOICE UPDATE
  // ============================================================
  function openExternalInvoiceEditor(sale: Sale) {
    setExternalInvoiceSale(sale);
    setExternalInvoiceNumber(sale.invoice_number || "");
    setExternalInvoiceDate(sale.invoice_date || new Date().toISOString().split("T")[0]);
  }

  async function markExternalInvoiceGenerated() {
    if (!externalInvoiceSale) return;
    if (!externalInvoiceNumber.trim()) { alert("Please enter the external invoice number."); return; }
    if (!externalInvoiceDate) { alert("Please enter the external invoice date."); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("sales")
        .update({
          invoice_status: "GENERATED",
          invoice_number: externalInvoiceNumber.trim(),
          invoice_date: externalInvoiceDate,
        })
        .eq("id", externalInvoiceSale.id);

      if (error) throw new Error(error.message);
      alert("External invoice marked as GENERATED.");
      setExternalInvoiceSale(null);
      await loadAllData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update invoice.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================
  async function openDocuments(sale: Sale) {
    setDocumentSale(sale);
    await loadDocuments(sale.id);
  }

  async function loadDocuments(saleId: number) {
    setDocumentLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_attachments")
        .select("*")
        .eq("document_type", "SALE")
        .eq("reference_id", saleId)
        .order("id", { ascending: false });
      if (error) throw new Error(error.message);
      setDocuments(data || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load documents.");
    } finally {
      setDocumentLoading(false);
    }
  }

  async function uploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    if (!documentSale) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `sales/${documentSale.id}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("erp-documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { error: databaseError } = await supabase.from("document_attachments").insert({
        document_type: "SALE",
        reference_id: documentSale.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || null,
        file_size: file.size,
        description: documentDescription.trim() || null,
        uploaded_by: "Admin",
      });
      if (databaseError) {
        await supabase.storage.from("erp-documents").remove([filePath]);
        throw new Error(`Unable to save document record: ${databaseError.message}`);
      }

      setDocumentDescription("");
      event.target.value = "";
      await loadDocuments(documentSale.id);
      alert("Document uploaded successfully.");
    } catch (error) {
      console.error("Document upload error:", error);
      alert(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function viewDocument(document: DocumentAttachment) {
    try {
      const { data, error } = await supabase.storage
        .from("erp-documents")
        .createSignedUrl(document.file_path, 60 * 60);
      if (error) throw new Error(error.message);
      if (!data?.signedUrl) throw new Error("Unable to create document URL.");
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to open document.");
    }
  }

  async function deleteDocument(document: DocumentAttachment) {
    if (!window.confirm(`Delete document "${document.file_name}"?`)) return;
    try {
      const { error: storageError } = await supabase.storage.from("erp-documents").remove([document.file_path]);
      if (storageError) throw new Error(`Storage: ${storageError.message}`);

      const { error: databaseError } = await supabase.from("document_attachments").delete().eq("id", document.id);
      if (databaseError) throw new Error(databaseError.message);

      if (documentSale) await loadDocuments(documentSale.id);
      alert("Document deleted successfully.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete document.");
    }
  }

  // ============================================================
  // STYLES
  // ============================================================
  const inputStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: 700,
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 7px",
    textAlign: "left",
    color: "#67e8f9",
    fontWeight: 700,
    whiteSpace: "nowrap",
    borderBottom: "1px solid #263548",
  };

  const tdStyle: React.CSSProperties = {
    padding: "7px",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #1e293b",
  };

  const emptyStyle: React.CSSProperties = {
    padding: "25px",
    textAlign: "center",
    color: "#64748b",
  };

  const getPaymentStatusStyle = (status: string | null) => {
    const s = status || "UNPAID";
    switch (s) {
      case "PAID":
        return { bg: "#14532d", color: "#86efac", icon: "✅" };
      case "PARTIAL":
        return { bg: "#451a03", color: "#fbbf24", icon: "🔄" };
      default:
        return { bg: "#7f1d1d", color: "#fca5a5", icon: "⏳" };
    }
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, color: "#22d3ee", fontSize: "25px", fontWeight: 800 }}>SALES</h1>
          <div style={{ marginTop: "3px", color: "#64748b", fontSize: "11px" }}>
            Sales, Delivery Notes & Invoices
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={exportSalesReportPDF}
            disabled={loading || sales.length === 0}
            style={{
              border: "none",
              borderRadius: "6px",
              padding: "8px 15px",
              background: "linear-gradient(135deg, #dc2626, #991b1b)",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading || sales.length === 0 ? "not-allowed" : "pointer",
              opacity: loading || sales.length === 0 ? 0.6 : 1,
            }}
          >
            📄 Export Detailed Report
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: "6px",
              padding: "8px 15px",
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS - Added Payment Status Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <SummaryCard title="SALES QTY" value={totalQuantity} color="#22d3ee" />
        <SummaryCard title="SUBTOTAL" value={totalSubtotal} suffix="SAR" color="#60a5fa" />
        <SummaryCard title="VAT" value={totalVat} suffix="SAR" color="#f59e0b" />
        <SummaryCard title="TOTAL SALES" value={totalSalesAmount} suffix="SAR" color="#22c55e" />
        <SummaryCard title="✅ PAID" value={paidInvoices.length} color="#22c55e" />
        <SummaryCard title="⏳ UNPAID" value={unpaidInvoices.length} color="#ef4444" />
      </div>

      {/* SALE FORM */}
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
          marginBottom: "15px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ margin: 0, color: "#60a5fa", fontSize: "16px" }}>
            {editingId !== null ? "EDIT SALE" : "RECORD NEW SALE"}
          </h2>
          {editingId !== null && (
            <button
              onClick={clearForm}
              style={{
                backgroundColor: "#374151",
                color: "#ffffff",
                border: "none",
                borderRadius: "5px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        <div style={{ color: "#22d3ee", fontSize: "11px", fontWeight: 800, marginBottom: "10px" }}>SALE INFORMATION</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "11px" }}>
          <div>
            <label style={labelStyle}>SALE DATE *</label>
            <input
              type="date"
              style={inputStyle}
              value={form.sales_date}
              onChange={(e) => updateField("sales_date", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>DELIVERY NOTE NO. *</label>
            <input
              style={inputStyle}
              value={form.delivery_note_no}
              placeholder="e.g. 4546"
              onChange={(e) => updateField("delivery_note_no", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>CUSTOMER *</label>
            <select
              style={inputStyle}
              value={form.customer_name}
              onChange={(e) => updateField("customer_name", e.target.value)}
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.customer_name}>
                  {c.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>BRANCH *</label>
            <select
              style={inputStyle}
              value={form.branch_id}
              onChange={(e) => updateField("branch_id", e.target.value)}
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>ITEM *</label>
            <select
              style={inputStyle}
              value={form.item_id}
              onChange={(e) => updateField("item_id", e.target.value)}
            >
              <option value="">Select Item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>DRIVER</label>
            <select
              style={inputStyle}
              value={form.driver_name}
              onChange={(e) => updateField("driver_name", e.target.value)}
            >
              <option value="">Select Driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.driver_name}>
                  {d.driver_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>QUANTITY *</label>
            <input
              type="number"
              min="0"
              step="1"
              style={inputStyle}
              value={form.quantity}
              placeholder="0"
              onChange={(e) => updateField("quantity", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>UNIT PRICE *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
              value={form.unit_price}
              placeholder="0.00"
              onChange={(e) => updateField("unit_price", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>VAT %</label>
            <input
              type="number"
              min="0"
              step="1"
              style={inputStyle}
              value={form.vat_percent}
              onChange={(e) => updateField("vat_percent", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>PAYMENT TYPE</label>
            <select
              style={inputStyle}
              value={form.payment_type}
              onChange={(e) => updateField("payment_type", e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
              <option value="BANK">Bank</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>PAYMENT STATUS *</label>
            <select
              style={inputStyle}
              value={form.payment_status}
              onChange={(e) => updateField("payment_status", e.target.value)}
            >
              <option value="UNPAID">⏳ Unpaid</option>
              <option value="PARTIAL">🔄 Partial</option>
              <option value="PAID">✅ Paid</option>
            </select>
          </div>
        </div>

        {/* Calculation */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
            marginTop: "15px",
            padding: "12px",
            backgroundColor: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "7px",
          }}
        >
          <CalculationBox title="SUBTOTAL" value={subtotal} color="#60a5fa" />
          <CalculationBox title={`VAT (${vatPercent}%)`} value={vatAmount} color="#f59e0b" />
          <CalculationBox title="TOTAL" value={grandTotal} color="#22c55e" />
        </div>

        {/* Description */}
        <div style={{ marginTop: "18px", color: "#22d3ee", fontSize: "11px", fontWeight: 800, marginBottom: "10px" }}>
          DESCRIPTION
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px" }}>
          <div>
            <label style={labelStyle}>SALES DESCRIPTION</label>
            <input
              style={inputStyle}
              value={form.sales_description}
              placeholder="e.g. EMPTY STEEL DRUMS OPEN TOP - BLUE"
              onChange={(e) => updateField("sales_description", e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>DESCRIPTION</label>
            <input
              style={inputStyle}
              value={form.description}
              placeholder="Optional description"
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>NOTES</label>
            <textarea
              value={form.notes}
              placeholder="Optional notes"
              onChange={(e) => updateField("notes", e.target.value)}
              style={{ ...inputStyle, height: "65px", padding: "9px 10px", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "15px" }}>
          {editingId !== null && (
            <button
              onClick={clearForm}
              style={{
                backgroundColor: "#374151",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "9px 18px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={saveSale}
            disabled={saving}
            style={{
              background: "linear-gradient(135deg, #06b6d4, #2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 22px",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : editingId !== null ? "Update Sale" : "Record Sale"}
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr",
          gap: "10px",
          padding: "12px",
          marginBottom: "14px",
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "9px",
        }}
      >
        <div>
          <label style={labelStyle}>SEARCH</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, delivery note, invoice..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>DATE</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>CUSTOMER</label>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={inputStyle}>
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.customer_name}>
                {c.customer_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>BRANCH</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={inputStyle}>
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>PAYMENT STATUS</label>
          <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} style={inputStyle}>
            <option value="ALL">All Status</option>
            <option value="PAID">✅ Paid</option>
            <option value="PARTIAL">🔄 Partial</option>
            <option value="UNPAID">⏳ Unpaid</option>
          </select>
        </div>
      </div>

      {/* SALES RECORDS */}
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0, color: "#60a5fa", fontSize: "16px" }}>SALES RECORDS</h2>
          <span style={{ color: "#64748b", fontSize: "10px" }}>{filteredSales.length} records</span>
        </div>

        <div style={{ width: "100%", overflowX: "auto", border: "1px solid #263548", borderRadius: "6px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ backgroundColor: "#0b1220" }}>
                <th style={thStyle}>DATE</th>
                <th style={thStyle}>DN NO.</th>
                <th style={thStyle}>CUSTOMER</th>
                <th style={thStyle}>ITEM</th>
                <th style={thStyle}>QTY</th>
                <th style={thStyle}>TOTAL</th>
                <th style={thStyle}>PAYMENT STATUS</th>
                <th style={thStyle}>EXTERNAL INVOICE</th>
                <th style={thStyle}>ERP INVOICE</th>
                <th style={thStyle}>DOCUMENTS</th>
                <th style={thStyle}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={emptyStyle}>Loading sales...</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={11} style={emptyStyle}>No sales found.</td>
                </tr>
              ) : (
                filteredSales.map((sale, index) => {
                  const item = items.find((i) => i.id === sale.item_id);
                  const externalGenerated = (sale.invoice_status || "PENDING").toUpperCase() === "GENERATED";
                  const paymentStyle = getPaymentStatusStyle(sale.payment_status);
                  return (
                    <tr key={sale.id} style={{ backgroundColor: index % 2 === 0 ? "#111827" : "#0f172a" }}>
                      <td style={tdStyle}>{sale.sales_date}</td>
                      <td style={{ ...tdStyle, color: "#22d3ee", fontWeight: 700 }}>{sale.delivery_note_no || "-"}</td>
                      <td style={{ ...tdStyle, color: "#ffffff", fontWeight: 700 }}>{sale.customer_name}</td>
                      <td style={tdStyle}>{item?.item_name || `Item #${sale.item_id}`}</td>
                      <td style={{ ...tdStyle, color: "#f59e0b", fontWeight: 700 }}>{sale.quantity}</td>
                      <td style={{ ...tdStyle, color: "#22c55e", fontWeight: 800 }}>
                        {Number(sale.total_amount).toFixed(2)} SAR
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => togglePaymentStatus(sale)}
                          style={{
                            border: "none",
                            borderRadius: "5px",
                            padding: "5px 10px",
                            backgroundColor: paymentStyle.bg,
                            color: paymentStyle.color,
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {paymentStyle.icon} {sale.payment_status || "UNPAID"}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => openExternalInvoiceEditor(sale)}
                          style={{
                            border: "none",
                            borderRadius: "5px",
                            padding: "5px 8px",
                            backgroundColor: externalGenerated ? "#14532d" : "#7f1d1d",
                            color: externalGenerated ? "#86efac" : "#fca5a5",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: 800,
                          }}
                        >
                          {externalGenerated ? `✓ ${sale.invoice_number || "GENERATED"}` : "⚠ PENDING"}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => exportERPInvoicePDF(sale)}
                          style={{
                            border: "none",
                            borderRadius: "5px",
                            padding: "5px 8px",
                            backgroundColor: "#172554",
                            color: "#67e8f9",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: 800,
                          }}
                        >
                          📄 {sale.erp_invoice_number || "ERP PDF"}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => openDocuments(sale)}
                          style={{
                            border: "none",
                            borderRadius: "5px",
                            padding: "5px 8px",
                            backgroundColor: "#312e81",
                            color: "#c4b5fd",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: 800,
                          }}
                        >
                          📎 Documents
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                          <button
                            onClick={() => editSale(sale)}
                            disabled={saving}
                            style={{
                              backgroundColor: "#2563eb",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "4px",
                              padding: "5px 8px",
                              cursor: "pointer",
                              fontSize: "10px",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSale(sale)}
                            disabled={saving}
                            style={{
                              backgroundColor: "#dc2626",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "4px",
                              padding: "5px 8px",
                              cursor: "pointer",
                              fontSize: "10px",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ITEM-WISE SUMMARY */}
      <div
        style={{
          marginTop: "15px",
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h2 style={{ margin: 0, color: "#22d3ee", fontSize: "16px" }}>ITEM-WISE SALES SUMMARY</h2>
            <div style={{ marginTop: "3px", color: "#64748b", fontSize: "10px" }}>
              Total quantity and amount for each item
            </div>
          </div>
          <span style={{ color: "#64748b", fontSize: "10px" }}>{itemSalesSummary.length} items</span>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #263548", borderRadius: "6px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ backgroundColor: "#0b1220" }}>
                <th style={{ ...thStyle, width: "55%" }}>ITEM</th>
                <th style={thStyle}>TOTAL QTY</th>
                <th style={thStyle}>UNIT</th>
                <th style={{ ...thStyle, textAlign: "right" }}>TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {itemSalesSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} style={emptyStyle}>No item sales to summarize.</td>
                </tr>
              ) : (
                itemSalesSummary.map((row, index) => (
                  <tr key={row.itemId} style={{ backgroundColor: index % 2 === 0 ? "#111827" : "#0f172a" }}>
                    <td style={{ ...tdStyle, color: "#ffffff", fontWeight: 700 }}>{row.itemName}</td>
                    <td style={{ ...tdStyle, color: "#f59e0b", fontWeight: 800 }}>{row.quantity}</td>
                    <td style={tdStyle}>{row.unit}</td>
                    <td style={{ ...tdStyle, color: "#22c55e", fontWeight: 800, textAlign: "right" }}>
                      {Number(row.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                  </tr>
                ))
              )}
              {itemSalesSummary.length > 0 && (
                <tr style={{ background: "linear-gradient(135deg, #172554, #0f172a)", borderTop: "2px solid #22d3ee" }}>
                  <td style={{ padding: "11px 7px", color: "#22d3ee", fontWeight: 900 }}>GRAND TOTAL</td>
                  <td style={{ padding: "11px 7px", color: "#f59e0b", fontWeight: 900 }}>{itemSummaryGrandQuantity}</td>
                  <td style={{ padding: "11px 7px", color: "#64748b", fontWeight: 700 }}>ALL ITEMS</td>
                  <td style={{ padding: "11px 7px", color: "#22c55e", fontWeight: 900, textAlign: "right" }}>
                    {Number(itemSummaryGrandAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXTERNAL INVOICE LIST MODAL */}
      {invoiceModal && (
        <div style={modalOverlayStyle} onClick={() => setInvoiceModal(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, color: invoiceModal === "PENDING" ? "#f87171" : "#4ade80", fontSize: "17px" }}>
                {invoiceModal === "PENDING" ? "PENDING EXTERNAL INVOICES" : "GENERATED EXTERNAL INVOICES"}
              </h2>
              <button onClick={() => setInvoiceModal(null)} style={closeButtonStyle}>×</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0b1220" }}>
                    <th style={thStyle}>DATE</th>
                    <th style={thStyle}>DN NO.</th>
                    <th style={thStyle}>CUSTOMER</th>
                    <th style={thStyle}>AMOUNT</th>
                    <th style={thStyle}>PAYMENT</th>
                    <th style={thStyle}>EXTERNAL INVOICE</th>
                    <th style={thStyle}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoiceModal === "PENDING" ? pendingExternalInvoices : generatedExternalInvoices).map((sale) => {
                    const paymentStyle = getPaymentStatusStyle(sale.payment_status);
                    return (
                      <tr key={sale.id}>
                        <td style={tdStyle}>{sale.sales_date}</td>
                        <td style={{ ...tdStyle, color: "#22d3ee", fontWeight: 700 }}>{sale.delivery_note_no}</td>
                        <td style={tdStyle}>{sale.customer_name}</td>
                        <td style={tdStyle}>{Number(sale.total_amount).toFixed(2)} SAR</td>
                        <td style={tdStyle}>
                          <span style={{ color: paymentStyle.color, fontWeight: 700 }}>
                            {paymentStyle.icon} {sale.payment_status || "UNPAID"}
                          </span>
                        </td>
                        <td style={tdStyle}>{sale.invoice_number || "—"}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => openExternalInvoiceEditor(sale)}
                            style={{
                              backgroundColor: invoiceModal === "PENDING" ? "#2563eb" : "#374151",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "5px",
                              padding: "6px 10px",
                              cursor: "pointer",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {invoiceModal === "PENDING" ? "Mark Generated" : "View / Edit"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(invoiceModal === "PENDING" ? pendingExternalInvoices : generatedExternalInvoices).length === 0 && (
                    <tr>
                      <td colSpan={7} style={emptyStyle}>
                        {invoiceModal === "PENDING" ? "No pending external invoices." : "No generated external invoices."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EXTERNAL INVOICE EDIT MODAL */}
      {externalInvoiceSale && (
        <div style={modalOverlayStyle} onClick={() => setExternalInvoiceSale(null)}>
          <div style={{ ...modalStyle, maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h2 style={{ margin: 0, color: "#22d3ee", fontSize: "17px" }}>EXTERNAL INVOICE</h2>
              <button onClick={() => setExternalInvoiceSale(null)} style={closeButtonStyle}>×</button>
            </div>
            <div style={{ padding: "10px", backgroundColor: "#0b1220", border: "1px solid #263548", borderRadius: "7px", marginBottom: "12px" }}>
              <div style={{ color: "#94a3b8", fontSize: "10px" }}>DELIVERY NOTE</div>
              <div style={{ color: "#22d3ee", fontWeight: 800, marginTop: "3px" }}>{externalInvoiceSale.delivery_note_no}</div>
              <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "8px" }}>CUSTOMER</div>
              <div style={{ color: "#ffffff", fontWeight: 700 }}>{externalInvoiceSale.customer_name}</div>
              <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "8px" }}>PAYMENT STATUS</div>
              <div style={{ color: getPaymentStatusStyle(externalInvoiceSale.payment_status).color, fontWeight: 700 }}>
                {getPaymentStatusStyle(externalInvoiceSale.payment_status).icon} {externalInvoiceSale.payment_status || "UNPAID"}
              </div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>EXTERNAL INVOICE NUMBER</label>
              <input
                style={inputStyle}
                value={externalInvoiceNumber}
                placeholder="Enter invoice number"
                onChange={(e) => setExternalInvoiceNumber(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={labelStyle}>EXTERNAL INVOICE DATE</label>
              <input
                type="date"
                style={inputStyle}
                value={externalInvoiceDate}
                onChange={(e) => setExternalInvoiceDate(e.target.value)}
              />
            </div>
            <button
              onClick={markExternalInvoiceGenerated}
              disabled={saving}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "6px",
                padding: "10px",
                background: "linear-gradient(135deg, #06b6d4, #2563eb)",
                color: "#ffffff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ✓ MARK EXTERNAL INVOICE GENERATED
            </button>
          </div>
        </div>
      )}

      {/* DOCUMENT MODAL */}
      {documentSale && (
        <div style={modalOverlayStyle} onClick={() => setDocumentSale(null)}>
          <div style={{ ...modalStyle, maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <div>
                <h2 style={{ margin: 0, color: "#c4b5fd", fontSize: "17px" }}>SALE DOCUMENTS</h2>
                <div style={{ color: "#64748b", fontSize: "10px", marginTop: "3px" }}>
                  DN: {documentSale.delivery_note_no} | {documentSale.customer_name}
                </div>
              </div>
              <button onClick={() => setDocumentSale(null)} style={closeButtonStyle}>×</button>
            </div>
            <div style={{ padding: "12px", backgroundColor: "#0b1220", border: "1px solid #263548", borderRadius: "7px", marginBottom: "15px" }}>
              <div style={{ color: "#22d3ee", fontSize: "11px", fontWeight: 800, marginBottom: "8px" }}>ATTACH NEW DOCUMENT</div>
              <input
                style={{ ...inputStyle, marginBottom: "8px", paddingTop: "9px" }}
                type="file"
                onChange={uploadDocument}
                disabled={uploadingDocument}
              />
              <input
                style={inputStyle}
                value={documentDescription}
                placeholder="Document description (optional)"
                onChange={(e) => setDocumentDescription(e.target.value)}
              />
              {uploadingDocument && <div style={{ color: "#f59e0b", fontSize: "10px", marginTop: "8px" }}>Uploading document...</div>}
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 700, marginBottom: "8px" }}>ATTACHED DOCUMENTS</div>
              {documentLoading ? (
                <div style={emptyStyle}>Loading documents...</div>
              ) : documents.length === 0 ? (
                <div style={{ ...emptyStyle, border: "1px solid #263548", borderRadius: "6px" }}>No documents attached.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "9px",
                        backgroundColor: "#0f172a",
                        border: "1px solid #263548",
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          📎 {doc.file_name}
                        </div>
                        <div style={{ color: "#64748b", fontSize: "9px", marginTop: "3px" }}>
                          {doc.description || "No description"} • {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : "Unknown size"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
                        <button
                          onClick={() => viewDocument(doc)}
                          style={{
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "5px 9px",
                            cursor: "pointer",
                            fontSize: "10px",
                          }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteDocument(doc)}
                          style={{
                            backgroundColor: "#dc2626",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "5px 9px",
                            cursor: "pointer",
                            fontSize: "10px",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================
function SummaryCard({
  title,
  value,
  suffix,
  color,
}: {
  title: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid #263548",
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        padding: "11px",
      }}
    >
      <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, marginBottom: "4px" }}>{title}</div>
      <div style={{ color, fontSize: "18px", fontWeight: 800 }}>
        {Number(value).toLocaleString("en-US", {
          minimumFractionDigits: suffix ? 2 : 0,
          maximumFractionDigits: suffix ? 2 : 0,
        })}{" "}
        {suffix && <span style={{ fontSize: "10px" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ============================================================
// CALCULATION BOX
// ============================================================
function CalculationBox({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, marginBottom: "4px" }}>{title}</div>
      <div style={{ color, fontSize: "17px", fontWeight: 800 }}>
        {Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
      </div>
    </div>
  );
}

// ============================================================
// MODAL STYLES
// ============================================================
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "20px",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1000px",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#111827",
  border: "1px solid #334155",
  borderRadius: "10px",
  padding: "18px",
  boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
};

const closeButtonStyle: React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#374151",
  color: "#ffffff",
  fontSize: "20px",
  cursor: "pointer",
};

export default Sales;
