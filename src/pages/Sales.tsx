import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

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
  notes: string | null;
  branch_id: string;
  sales_description: string | null;
  description: string | null;

  /* External invoice */
  invoice_status: string | null;
  invoice_number: string | null;
  invoice_date: string | null;

  /* ERP invoice */
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

  const [form, setForm] = useState<SaleForm>({
    ...emptyForm,
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ============================================================
     INVOICE MODALS
     ============================================================ */

  const [invoiceModal, setInvoiceModal] = useState<
    "PENDING" | "GENERATED" | null
  >(null);

  const [externalInvoiceSale, setExternalInvoiceSale] =
    useState<Sale | null>(null);

  const [externalInvoiceNumber, setExternalInvoiceNumber] =
    useState("");

  const [externalInvoiceDate, setExternalInvoiceDate] =
    useState(new Date().toISOString().split("T")[0]);

  /* ============================================================
     DOCUMENT MODAL
     ============================================================ */

  const [documentSale, setDocumentSale] =
    useState<Sale | null>(null);

  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);

  const [documentLoading, setDocumentLoading] =
    useState(false);

  const [uploadingDocument, setUploadingDocument] =
    useState(false);

  const [documentDescription, setDocumentDescription] =
    useState("");

  /* ============================================================
     LOAD DATA
     ============================================================ */

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
        supabase
          .from("sales")
          .select("*")
          .order("id", {
            ascending: false,
          }),

        supabase
          .from("customers")
          .select(
            "id, customer_name, active"
          )
          .eq("active", true)
          .order("customer_name", {
            ascending: true,
          }),

        supabase
          .from("items")
          .select(
            "id, item_name, unit"
          )
          .order("item_name", {
            ascending: true,
          }),

        supabase
          .from("branches")
          .select(
            "id, branch_name"
          )
          .order("branch_name", {
            ascending: true,
          }),

        supabase
          .from("drivers")
          .select(
            "id, driver_name, active"
          )
          .eq("active", true)
          .order("driver_name", {
            ascending: true,
          }),
      ]);

      if (salesResult.error) {
        throw new Error(
          `Sales: ${salesResult.error.message}`
        );
      }

      if (customersResult.error) {
        throw new Error(
          `Customers: ${customersResult.error.message}`
        );
      }

      if (itemsResult.error) {
        throw new Error(
          `Items: ${itemsResult.error.message}`
        );
      }

      if (branchesResult.error) {
        throw new Error(
          `Branches: ${branchesResult.error.message}`
        );
      }

      if (driversResult.error) {
        throw new Error(
          `Drivers: ${driversResult.error.message}`
        );
      }

      setSales(
        (salesResult.data || []) as Sale[]
      );

      setCustomers(
        (customersResult.data || []) as Customer[]
      );

      setItems(
        (itemsResult.data || []) as Item[]
      );

      setBranches(
        (branchesResult.data || []) as Branch[]
      );

      setDrivers(
        (driversResult.data || []) as Driver[]
      );

      if (
        !form.branch_id &&
        branchesResult.data &&
        branchesResult.data.length === 1
      ) {
        setForm((previous) => ({
          ...previous,
          branch_id:
            branchesResult.data[0].id,
        }));
      }
    } catch (error) {
      console.error(
        "Sales loading error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load sales data."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    field: keyof SaleForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* ============================================================
     CALCULATIONS
     ============================================================ */

  const quantity =
    Number(form.quantity) || 0;

  const unitPrice =
    Number(form.unit_price) || 0;

  const vatPercent =
    Number(form.vat_percent) || 0;

  const subtotal =
    quantity * unitPrice;

  const vatAmount =
    subtotal *
    (vatPercent / 100);

  const grandTotal =
    subtotal + vatAmount;

  /* ============================================================
     VALIDATION
     ============================================================ */

  function validateForm() {
    if (!form.sales_date) {
      alert(
        "Sales date is required."
      );
      return false;
    }

    if (
      !form.delivery_note_no.trim()
    ) {
      alert(
        "Delivery Note Number is required."
      );
      return false;
    }

    if (
      !form.customer_name.trim()
    ) {
      alert(
        "Customer is required."
      );
      return false;
    }

    if (!form.item_id) {
      alert(
        "Item is required."
      );
      return false;
    }

    if (!form.branch_id) {
      alert(
        "Branch is required."
      );
      return false;
    }

    if (quantity <= 0) {
      alert(
        "Quantity must be greater than zero."
      );
      return false;
    }

    if (unitPrice < 0) {
      alert(
        "Unit price cannot be negative."
      );
      return false;
    }

    if (
      Number.isNaN(quantity) ||
      Number.isNaN(unitPrice)
    ) {
      alert(
        "Quantity and unit price must be valid numbers."
      );
      return false;
    }

    if (
      Number.isNaN(vatPercent) ||
      vatPercent < 0
    ) {
      alert(
        "VAT percentage is invalid."
      );
      return false;
    }

    return true;
  }

  /* ============================================================
     ERP INVOICE NUMBER
     ============================================================ */

  async function generateNextERPInvoiceNumber() {
    const currentYear =
      new Date().getFullYear();

    const { data, error } =
      await supabase
        .from("sales")
        .select(
          "erp_invoice_number"
        )
        .not(
          "erp_invoice_number",
          "is",
          null
        )
        .order("id", {
          ascending: false,
        });

    if (error) {
      throw new Error(
        `Unable to generate ERP invoice number: ${error.message}`
      );
    }

    let highestNumber = 0;

    for (const row of data || []) {
      const invoiceNumber =
        row.erp_invoice_number;

      if (
        typeof invoiceNumber !==
        "string"
      ) {
        continue;
      }

      const match =
        invoiceNumber.match(
          /ERP-S-\d{4}-(\d+)/
        );

      if (match) {
        highestNumber =
          Math.max(
            highestNumber,
            Number(match[1])
          );
      }
    }

    const nextNumber =
      highestNumber + 1;

    return `ERP-S-${currentYear}-${String(
      nextNumber
    ).padStart(5, "0")}`;
  }

  /* ============================================================
     CREATE STOCK MOVEMENT
     ============================================================ */

  async function createSaleStockMovement(
    saleId: number,
    itemId: number,
    branchId: string,
    saleQuantity: number,
    deliveryNoteNo: string,
    saleDate: string
  ) {
    const { error } =
      await supabase
        .from("stock_movements")
        .insert({
          date: saleDate,
          item_id: itemId,
          branch_id: branchId,
          movement_type: "SALE",
          quantity:
            -Math.abs(
              saleQuantity
            ),
          reference_type: "SALE",
          reference_id: saleId,
          notes:
            `Delivery Note: ${deliveryNoteNo}`,
        });

    if (error) {
      throw new Error(
        `Stock movement: ${error.message}`
      );
    }
  }

  /* ============================================================
     SAVE SALE
     ============================================================ */

  async function saveSale() {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const saleData: Record<
        string,
        string | number | null
      > = {
        sales_date:
          form.sales_date,

        delivery_note_no:
          form.delivery_note_no.trim(),

        customer_name:
          form.customer_name.trim(),

        item_id:
          Number(form.item_id),

        driver_name:
          form.driver_name.trim() ||
          null,

        quantity:
          quantity,

        unit_price:
          unitPrice,

        vat_percent:
          vatPercent,

        total_amount:
          grandTotal,

        payment_type:
          form.payment_type,

        branch_id:
          form.branch_id,

        sales_description:
          form.sales_description.trim() ||
          null,

        description:
          form.description.trim() ||
          null,

        notes:
          form.notes.trim() ||
          null,
      };

      /* ========================================================
         EDIT SALE
         ======================================================== */

      if (editingId !== null) {
        const {
          data: oldSale,
          error: oldSaleError,
        } = await supabase
          .from("sales")
          .select("*")
          .eq("id", editingId)
          .single();

        if (oldSaleError) {
          throw new Error(
            `Unable to find old sale: ${oldSaleError.message}`
          );
        }

        const {
          error:
            deleteMovementError,
        } = await supabase
          .from("stock_movements")
          .delete()
          .eq(
            "reference_type",
            "SALE"
          )
          .eq(
            "reference_id",
            editingId
          );

        if (deleteMovementError) {
          throw new Error(
            `Unable to remove old stock movement: ${deleteMovementError.message}`
          );
        }

        const {
          error:
            updateSaleError,
        } = await supabase
          .from("sales")
          .update(saleData)
          .eq(
            "id",
            editingId
          );

        if (updateSaleError) {
          throw new Error(
            `Unable to update sale: ${updateSaleError.message}`
          );
        }

        await createSaleStockMovement(
          editingId,
          Number(form.item_id),
          form.branch_id,
          quantity,
          form.delivery_note_no.trim(),
          form.sales_date
        );

        alert(
          "Sale updated successfully."
        );
      }

      /* ========================================================
         NEW SALE
         ======================================================== */

      else {
        /*
         * Generate ERP invoice number
         * automatically.
         */

        const erpInvoiceNumber =
          await generateNextERPInvoiceNumber();

        const today =
          new Date()
            .toISOString()
            .split("T")[0];

        saleData.invoice_status =
          "PENDING";

        saleData.erp_invoice_status =
          "GENERATED";

        saleData.erp_invoice_number =
          erpInvoiceNumber;

        saleData.erp_invoice_date =
          today;

        const {
          data: insertedSale,
          error: insertSaleError,
        } = await supabase
          .from("sales")
          .insert(saleData)
          .select("*")
          .single();

        if (insertSaleError) {
          throw new Error(
            `Unable to create sale: ${insertSaleError.message}`
          );
        }

        if (!insertedSale) {
          throw new Error(
            "Sale was created but no sale ID was returned."
          );
        }

        try {
          await createSaleStockMovement(
            insertedSale.id,
            Number(form.item_id),
            form.branch_id,
            quantity,
            form.delivery_note_no.trim(),
            form.sales_date
          );
        } catch (stockError) {
          await supabase
            .from("sales")
            .delete()
            .eq(
              "id",
              insertedSale.id
            );

          throw stockError;
        }

        alert(
          `Sale added successfully.\n\nERP Invoice: ${erpInvoiceNumber}\n\nExternal Invoice: PENDING`
        );
      }

      clearForm();

      await loadAllData();
    } catch (error) {
      console.error(
        "Save sale error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save sale."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     EDIT SALE
     ============================================================ */

  function editSale(sale: Sale) {
    setEditingId(sale.id);

    setForm({
      sales_date:
        sale.sales_date || "",

      delivery_note_no:
        sale.delivery_note_no || "",

      customer_name:
        sale.customer_name || "",

      item_id:
        String(sale.item_id),

      driver_name:
        sale.driver_name || "",

      quantity:
        String(sale.quantity),

      unit_price:
        String(sale.unit_price),

      vat_percent:
        String(
          sale.vat_percent ?? 15
        ),

      payment_type:
        sale.payment_type ||
        "CASH",

      branch_id:
        sale.branch_id || "",

      sales_description:
        sale.sales_description ||
        "",

      description:
        sale.description ||
        "",

      notes:
        sale.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* ============================================================
     DELETE SALE
     ============================================================ */

  async function deleteSale(
    sale: Sale
  ) {
    const confirmed =
      window.confirm(
        `Delete Sale #${sale.id}?\n\nDelivery Note: ${
          sale.delivery_note_no ||
          "-"
        }\nQuantity: ${
          sale.quantity
        }`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const {
        error: movementError,
      } = await supabase
        .from("stock_movements")
        .delete()
        .eq(
          "reference_type",
          "SALE"
        )
        .eq(
          "reference_id",
          sale.id
        );

      if (movementError) {
        throw new Error(
          `Unable to delete stock movement: ${movementError.message}`
        );
      }

      const {
        error: saleError,
      } = await supabase
        .from("sales")
        .delete()
        .eq(
          "id",
          sale.id
        );

      if (saleError) {
        throw new Error(
          `Unable to delete sale: ${saleError.message}`
        );
      }

      alert(
        "Sale deleted successfully."
      );

      await loadAllData();
    } catch (error) {
      console.error(
        "Delete sale error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete sale."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     CLEAR FORM
     ============================================================ */

  function clearForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      branch_id:
        branches.length === 1
          ? branches[0].id
          : "",
    });
  }

  /* ============================================================
     FILTER SALES
     ============================================================ */

  const filteredSales =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return sales.filter(
        (sale) => {
          const matchesSearch =
            !searchText ||
            sale.customer_name
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            sale.delivery_note_no
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            sale.driver_name
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            sale.sales_description
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            sale.erp_invoice_number
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            sale.invoice_number
              ?.toLowerCase()
              .includes(
                searchText
              );

          const matchesDate =
            !dateFilter ||
            sale.sales_date ===
              dateFilter;

          const matchesCustomer =
            customerFilter ===
              "ALL" ||
            sale.customer_name ===
              customerFilter;

          const matchesBranch =
            branchFilter ===
              "ALL" ||
            sale.branch_id ===
              branchFilter;

          return (
            matchesSearch &&
            matchesDate &&
            matchesCustomer &&
            matchesBranch
          );
        }
      );
    }, [
      sales,
      search,
      dateFilter,
      customerFilter,
      branchFilter,
    ]);

  /* ============================================================
     INVOICE COUNTS
     ============================================================ */

  const pendingExternalInvoices =
    useMemo(
      () =>
        sales.filter(
          (sale) =>
            (
              sale.invoice_status ||
              "PENDING"
            ).toUpperCase() ===
            "PENDING"
        ),
      [sales]
    );

  const generatedExternalInvoices =
    useMemo(
      () =>
        sales.filter(
          (sale) =>
            (
              sale.invoice_status ||
              "PENDING"
            ).toUpperCase() ===
            "GENERATED"
        ),
      [sales]
    );

  /* ============================================================
     OVERALL SUMMARY
     ============================================================ */

  const totalQuantity =
    filteredSales.reduce(
      (total, sale) =>
        total +
        Number(
          sale.quantity || 0
        ),
      0
    );

  const totalSalesAmount =
    filteredSales.reduce(
      (total, sale) =>
        total +
        Number(
          sale.total_amount || 0
        ),
      0
    );

  const totalSubtotal =
    filteredSales.reduce(
      (total, sale) =>
        total +
        Number(
          sale.quantity || 0
        ) *
          Number(
            sale.unit_price || 0
          ),
      0
    );

  const totalVat =
    filteredSales.reduce(
      (total, sale) => {
        const saleSubtotal =
          Number(
            sale.quantity || 0
          ) *
          Number(
            sale.unit_price || 0
          );

        return (
          total +
          saleSubtotal *
            (Number(
              sale.vat_percent || 0
            ) /
              100)
        );
      },
      0
    );

  /* ============================================================
     ITEM-WISE SALES SUMMARY
     ============================================================ */

  const itemSalesSummary =
    useMemo(() => {
      const summaryMap =
        new Map<
          number,
          ItemSalesSummary
        >();

      for (const sale of filteredSales) {
        const item =
          items.find(
            (currentItem) =>
              currentItem.id ===
              sale.item_id
          );

        const itemName =
          item?.item_name ||
          `Item #${sale.item_id}`;

        const unit =
          item?.unit ||
          "PCS";

        const existing =
          summaryMap.get(
            sale.item_id
          );

        if (existing) {
          existing.quantity +=
            Number(
              sale.quantity || 0
            );

          existing.amount +=
            Number(
              sale.total_amount || 0
            );
        } else {
          summaryMap.set(
            sale.item_id,
            {
              itemId:
                sale.item_id,

              itemName:
                itemName,

              unit:
                unit,

              quantity:
                Number(
                  sale.quantity || 0
                ),

              amount:
                Number(
                  sale.total_amount ||
                    0
                ),
            }
          );
        }
      }

      return Array.from(
        summaryMap.values()
      ).sort((a, b) =>
        a.itemName.localeCompare(
          b.itemName
        )
      );
    }, [
      filteredSales,
      items,
    ]);

  const itemSummaryGrandQuantity =
    itemSalesSummary.reduce(
      (total, row) =>
        total + row.quantity,
      0
    );

  const itemSummaryGrandAmount =
    itemSalesSummary.reduce(
      (total, row) =>
        total + row.amount,
      0
    );

  /* ============================================================
     EXTERNAL INVOICE UPDATE
     ============================================================ */

  function openExternalInvoiceEditor(
    sale: Sale
  ) {
    setExternalInvoiceSale(
      sale
    );

    setExternalInvoiceNumber(
      sale.invoice_number ||
        ""
    );

    setExternalInvoiceDate(
      sale.invoice_date ||
        new Date()
          .toISOString()
          .split("T")[0]
    );
  }

  async function markExternalInvoiceGenerated() {
    if (!externalInvoiceSale) {
      return;
    }

    if (
      !externalInvoiceNumber.trim()
    ) {
      alert(
        "Please enter the external invoice number."
      );
      return;
    }

    if (!externalInvoiceDate) {
      alert(
        "Please enter the external invoice date."
      );
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("sales")
          .update({
            invoice_status:
              "GENERATED",

            invoice_number:
              externalInvoiceNumber.trim(),

            invoice_date:
              externalInvoiceDate,
          })
          .eq(
            "id",
            externalInvoiceSale.id
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      alert(
        "External invoice marked as GENERATED."
      );

      setExternalInvoiceSale(
        null
      );

      await loadAllData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to update invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     ERP INVOICE PDF
     ============================================================ */

  function exportERPInvoicePDF(
    sale: Sale
  ) {
    const doc =
      new jsPDF();

    const item =
      items.find(
        (i) =>
          i.id ===
          sale.item_id
      );

    const branch =
      branches.find(
        (b) =>
          b.id ===
          sale.branch_id
      );

    const itemName =
      item?.item_name ||
      `Item #${sale.item_id}`;

    const unit =
      item?.unit ||
      "PCS";

    const branchName =
      branch?.branch_name ||
      "-";

    const subtotal =
      Number(sale.quantity || 0) *
      Number(sale.unit_price || 0);

    const vat =
      subtotal *
      (Number(
        sale.vat_percent || 0
      ) / 100);

    const total =
      Number(
        sale.total_amount || 0
      );

    /* Header */

    doc.setFillColor(
      7,
      17,
      31
    );

    doc.rect(
      0,
      0,
      210,
      38,
      "F"
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(20);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "AL SHAMS AL GHAYABA TRD EST.",
      15,
      16
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "ERP SALES INVOICE",
      15,
      25
    );

    doc.text(
      `Invoice No: ${
        sale.erp_invoice_number ||
        "-"
      }`,
      130,
      16
    );

    doc.text(
      `Date: ${
        sale.erp_invoice_date ||
        sale.sales_date ||
        "-"
      }`,
      130,
      24
    );

    /* Customer section */

    doc.setTextColor(
      30,
      41,
      59
    );

    doc.setFontSize(11);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "CUSTOMER",
      15,
      52
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      sale.customer_name ||
        "-",
      15,
      60
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "DELIVERY NOTE",
      75,
      52
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      sale.delivery_note_no ||
        "-",
      75,
      60
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "BRANCH",
      140,
      52
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      branchName,
      140,
      60
    );

    /* Table */

    doc.setFillColor(
      15,
      23,
      42
    );

    doc.rect(
      15,
      72,
      180,
      10,
      "F"
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "DESCRIPTION",
      18,
      79
    );

    doc.text(
      "QTY",
      105,
      79
    );

    doc.text(
      "UNIT PRICE",
      125,
      79
    );

    doc.text(
      "TOTAL",
      165,
      79
    );

    doc.setTextColor(
      30,
      41,
      59
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    const description =
      sale.sales_description ||
      itemName;

    doc.text(
      description.substring(
        0,
        45
      ),
      18,
      92
    );

    doc.text(
      `${sale.quantity} ${unit}`,
      105,
      92
    );

    doc.text(
      `${Number(
        sale.unit_price
      ).toFixed(2)} SAR`,
      125,
      92
    );

    doc.text(
      `${subtotal.toFixed(
        2
      )} SAR`,
      165,
      92
    );

    /* Totals */

    doc.line(
      15,
      105,
      195,
      105
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "SUBTOTAL:",
      125,
      117
    );

    doc.text(
      `${subtotal.toFixed(
        2
      )} SAR`,
      165,
      117
    );

    doc.text(
      `VAT (${sale.vat_percent}%):`,
      125,
      127
    );

    doc.text(
      `${vat.toFixed(
        2
      )} SAR`,
      165,
      127
    );

    doc.setFontSize(13);

    doc.text(
      "GRAND TOTAL:",
      125,
      141
    );

    doc.text(
      `${total.toFixed(
        2
      )} SAR`,
      165,
      141
    );

    /* Payment */

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Payment Type: ${
        sale.payment_type ||
        "-"
      }`,
      15,
      120
    );

    doc.text(
      `Driver: ${
        sale.driver_name ||
        "-"
      }`,
      15,
      128
    );

    /* Footer */

    doc.setDrawColor(
      200,
      200,
      200
    );

    doc.line(
      15,
      165,
      195,
      165
    );

    doc.setFontSize(9);

    doc.setTextColor(
      100,
      116,
      139
    );

    doc.text(
      "Generated by AL SHAMS ERP",
      15,
      175
    );

    doc.text(
      "This is an ERP-generated sales invoice.",
      15,
      182
    );

    doc.save(
      `${
        sale.erp_invoice_number ||
        `ERP-SALE-${sale.id}`
      }.pdf`
    );
  }

  /* ============================================================
     DOCUMENTS
     ============================================================ */

  async function openDocuments(
    sale: Sale
  ) {
    setDocumentSale(
      sale
    );

    await loadDocuments(
      sale.id
    );
  }

  async function loadDocuments(
    saleId: number
  ) {
    setDocumentLoading(
      true
    );

    try {
      const { data, error } =
        await supabase
          .from(
            "document_attachments"
          )
          .select("*")
          .eq(
            "document_type",
            "SALE"
          )
          .eq(
            "reference_id",
            saleId
          )
          .order(
            "id",
            {
              ascending:
                false,
            }
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setDocuments(
        (data ||
          []) as DocumentAttachment[]
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load documents."
      );
    } finally {
      setDocumentLoading(
        false
      );
    }
  }

  async function uploadDocument(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (
      !documentSale
    ) {
      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingDocument(
      true
    );

    try {
      const safeFileName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const filePath =
        `sales/${documentSale.id}/${Date.now()}-${safeFileName}`;

      const {
        error:
          uploadError,
      } = await supabase.storage
        .from(
          "erp-documents"
        )
        .upload(
          filePath,
          file,
          {
            cacheControl:
              "3600",
            upsert: false,
          }
        );

      if (uploadError) {
        throw new Error(
          `Upload failed: ${uploadError.message}`
        );
      }

      const {
        error:
          databaseError,
      } = await supabase
        .from(
          "document_attachments"
        )
        .insert({
          document_type:
            "SALE",

          reference_id:
            documentSale.id,

          file_name:
            file.name,

          file_path:
            filePath,

          file_type:
            file.type ||
            null,

          file_size:
            file.size,

          description:
            documentDescription.trim() ||
            null,

          uploaded_by:
            "Admin",
        });

      if (databaseError) {
        await supabase.storage
          .from(
            "erp-documents"
          )
          .remove([
            filePath,
          ]);

        throw new Error(
          `Unable to save document record: ${databaseError.message}`
        );
      }

      setDocumentDescription(
        ""
      );

      event.target.value =
        "";

      await loadDocuments(
        documentSale.id
      );

      alert(
        "Document uploaded successfully."
      );
    } catch (error) {
      console.error(
        "Document upload error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to upload document."
      );
    } finally {
      setUploadingDocument(
        false
      );
    }
  }

  async function viewDocument(
    document: DocumentAttachment
  ) {
    try {
      const {
        data,
        error,
      } = await supabase.storage
        .from(
          "erp-documents"
        )
        .createSignedUrl(
          document.file_path,
          60 * 60
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Unable to create document URL."
        );
      }

      window.open(
        data.signedUrl,
        "_blank"
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to open document."
      );
    }
  }

  async function deleteDocument(
    document: DocumentAttachment
  ) {
    const confirmed =
      window.confirm(
        `Delete document "${document.file_name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const {
        error:
          storageError,
      } = await supabase.storage
        .from(
          "erp-documents"
        )
        .remove([
          document.file_path,
        ]);

      if (storageError) {
        throw new Error(
          `Storage: ${storageError.message}`
        );
      }

      const {
        error:
          databaseError,
      } = await supabase
        .from(
          "document_attachments"
        )
        .delete()
        .eq(
          "id",
          document.id
        );

      if (databaseError) {
        throw new Error(
          databaseError.message
        );
      }

      if (documentSale) {
        await loadDocuments(
          documentSale.id
        );
      }

      alert(
        "Document deleted successfully."
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete document."
      );
    }
  }

  /* ============================================================
     STYLES
     ============================================================ */

  const inputStyle:
    React.CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 10px",
    backgroundColor:
      "#0b1220",
    color: "#ffffff",
    border:
      "1px solid #334155",
    borderRadius: "6px",
    boxSizing:
      "border-box",
    fontSize: "12px",
    outline: "none",
  };

  const labelStyle:
    React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: 700,
  };

  const thStyle:
    React.CSSProperties = {
    padding: "8px 7px",
    textAlign: "left",
    color: "#67e8f9",
    fontWeight: 700,
    whiteSpace:
      "nowrap",
    borderBottom:
      "1px solid #263548",
  };

  const tdStyle:
    React.CSSProperties = {
    padding: "7px",
    color: "#cbd5e1",
    whiteSpace:
      "nowrap",
    borderBottom:
      "1px solid #1e293b",
  };

  const emptyStyle:
    React.CSSProperties = {
    padding: "25px",
    textAlign: "center",
    color: "#64748b",
  };

  /* ============================================================
     RETURN
     ============================================================ */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "18px",
        boxSizing:
          "border-box",
        background:
          "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
      }}
    >
      {/* ========================================================
          HEADER
      ======================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          marginBottom:
            "15px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#22d3ee",
              fontSize: "25px",
              fontWeight: 800,
            }}
          >
            SALES
          </h1>

          <div
            style={{
              marginTop: "3px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Sales, Delivery Notes & Invoices
          </div>
        </div>

        <button
          onClick={
            loadAllData
          }
          disabled={loading}
          style={{
            border: "none",
            borderRadius:
              "6px",
            padding:
              "8px 15px",
            background:
              "linear-gradient(135deg, #06b6d4, #2563eb)",
            color:
              "#ffffff",
            fontWeight: 700,
            cursor: loading
              ? "not-allowed"
              : "pointer",
            opacity: loading
              ? 0.6
              : 1,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ========================================================
          SUMMARY CARDS
      ======================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(6, minmax(0, 1fr))",
          gap: "10px",
          marginBottom:
            "14px",
        }}
      >
        <SummaryCard
          title="SALES QTY"
          value={
            totalQuantity
          }
          color="#22d3ee"
        />

        <SummaryCard
          title="SUBTOTAL"
          value={
            totalSubtotal
          }
          suffix="SAR"
          color="#60a5fa"
        />

        <SummaryCard
          title="VAT"
          value={
            totalVat
          }
          suffix="SAR"
          color="#f59e0b"
        />

        <SummaryCard
          title="TOTAL SALES"
          value={
            totalSalesAmount
          }
          suffix="SAR"
          color="#22c55e"
        />

        {/* PENDING EXTERNAL INVOICES */}

        <ClickableInvoiceCard
          title="PENDING INVOICES"
          value={
            pendingExternalInvoices.length
          }
          color="#ef4444"
          onClick={() =>
            setInvoiceModal(
              "PENDING"
            )
          }
        />

        {/* GENERATED EXTERNAL INVOICES */}

        <ClickableInvoiceCard
          title="GENERATED INVOICES"
          value={
            generatedExternalInvoices.length
          }
          color="#22c55e"
          onClick={() =>
            setInvoiceModal(
              "GENERATED"
            )
          }
        />
      </div>

      {/* ========================================================
          SALE FORM
      ======================================================== */}

      <div
        style={{
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius:
            "10px",
          padding: "17px",
          marginBottom:
            "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "15px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            {editingId !== null
              ? "EDIT SALE"
              : "RECORD NEW SALE"}
          </h2>

          {editingId !==
            null && (
            <button
              onClick={
                clearForm
              }
              style={{
                backgroundColor:
                  "#374151",
                color:
                  "#ffffff",
                border: "none",
                borderRadius:
                  "5px",
                padding:
                  "6px 12px",
                cursor:
                  "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginBottom:
              "10px",
          }}
        >
          SALE INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              SALE DATE *
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.sales_date
              }
              onChange={(e) =>
                updateField(
                  "sales_date",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              DELIVERY NOTE NO. *
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.delivery_note_no
              }
              placeholder="e.g. 4546"
              onChange={(e) =>
                updateField(
                  "delivery_note_no",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              CUSTOMER *
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.customer_name
              }
              onChange={(e) =>
                updateField(
                  "customer_name",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Customer
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={
                      customer.id
                    }
                    value={
                      customer.customer_name
                    }
                  >
                    {
                      customer.customer_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              BRANCH *
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.branch_id
              }
              onChange={(e) =>
                updateField(
                  "branch_id",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Branch
              </option>

              {branches.map(
                (branch) => (
                  <option
                    key={
                      branch.id
                    }
                    value={
                      branch.id
                    }
                  >
                    {
                      branch.branch_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              ITEM *
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.item_id
              }
              onChange={(e) =>
                updateField(
                  "item_id",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Item
              </option>

              {items.map(
                (item) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.item_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              DRIVER
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.driver_name
              }
              onChange={(e) =>
                updateField(
                  "driver_name",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Driver
              </option>

              {drivers.map(
                (driver) => (
                  <option
                    key={
                      driver.id
                    }
                    value={
                      driver.driver_name
                    }
                  >
                    {
                      driver.driver_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              QUANTITY *
            </label>

            <input
              type="number"
              min="0"
              step="1"
              style={
                inputStyle
              }
              value={
                form.quantity
              }
              placeholder="0"
              onChange={(e) =>
                updateField(
                  "quantity",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              UNIT PRICE *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              style={
                inputStyle
              }
              value={
                form.unit_price
              }
              placeholder="0.00"
              onChange={(e) =>
                updateField(
                  "unit_price",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              VAT %
            </label>

            <input
              type="number"
              min="0"
              step="1"
              style={
                inputStyle
              }
              value={
                form.vat_percent
              }
              onChange={(e) =>
                updateField(
                  "vat_percent",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              PAYMENT TYPE
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.payment_type
              }
              onChange={(e) =>
                updateField(
                  "payment_type",
                  e.target.value
                )
              }
            >
              <option value="CASH">
                Cash
              </option>

              <option value="CREDIT">
                Credit
              </option>

              <option value="BANK">
                Bank
              </option>

              <option value="PARTIAL">
                Partial
              </option>
            </select>
          </div>
        </div>

        {/* CALCULATION */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: "10px",
            marginTop: "15px",
            padding: "12px",
            backgroundColor:
              "#0b1220",
            border:
              "1px solid #263548",
            borderRadius:
              "7px",
          }}
        >
          <CalculationBox
            title="SUBTOTAL"
            value={
              subtotal
            }
            color="#60a5fa"
          />

          <CalculationBox
            title={`VAT (${vatPercent}%)`}
            value={
              vatAmount
            }
            color="#f59e0b"
          />

          <CalculationBox
            title="TOTAL"
            value={
              grandTotal
            }
            color="#22c55e"
          />
        </div>

        {/* DESCRIPTION */}

        <div
          style={{
            marginTop: "18px",
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginBottom:
              "10px",
          }}
        >
          DESCRIPTION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "11px",
          }}
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              SALES DESCRIPTION
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.sales_description
              }
              placeholder="e.g. EMPTY STEEL DRUMS OPEN TOP - BLUE"
              onChange={(e) =>
                updateField(
                  "sales_description",
                  e.target.value
                )
              }
            />
          </div>

          <div>
            <label
              style={
                labelStyle
              }
            >
              DESCRIPTION
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.description
              }
              placeholder="Optional description"
              onChange={(e) =>
                updateField(
                  "description",
                  e.target.value
                )
              }
            />
          </div>

          <div
            style={{
              gridColumn:
                "span 2",
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              NOTES
            </label>

            <textarea
              value={
                form.notes
              }
              placeholder="Optional notes"
              onChange={(e) =>
                updateField(
                  "notes",
                  e.target.value
                )
              }
              style={{
                ...inputStyle,
                height: "65px",
                padding:
                  "9px 10px",
                resize:
                  "vertical",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "8px",
            marginTop: "15px",
          }}
        >
          {editingId !==
            null && (
            <button
              onClick={
                clearForm
              }
              style={{
                backgroundColor:
                  "#374151",
                color:
                  "#ffffff",
                border: "none",
                borderRadius:
                  "6px",
                padding:
                  "9px 18px",
                cursor:
                  "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            onClick={
              saveSale
            }
            disabled={saving}
            style={{
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              color:
                "#ffffff",
              border: "none",
              borderRadius:
                "6px",
              padding:
                "9px 22px",
              fontWeight: 700,
              cursor: saving
                ? "not-allowed"
                : "pointer",
              opacity: saving
                ? 0.6
                : 1,
            }}
          >
            {saving
              ? "Saving..."
              : editingId !==
                null
              ? "Update Sale"
              : "Record Sale"}
          </button>
        </div>
      </div>

      {/* ========================================================
          FILTERS
      ======================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "2fr 1fr 1fr 1fr",
          gap: "10px",
          padding: "12px",
          marginBottom:
            "14px",
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius:
            "9px",
        }}
      >
        <div>
          <label
            style={
              labelStyle
            }
          >
            SEARCH
          </label>

          <input
            type="text"
            value={
              search
            }
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Customer, delivery note, invoice..."
            style={
              inputStyle
            }
          />
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            DATE
          </label>

          <input
            type="date"
            value={
              dateFilter
            }
            onChange={(e) =>
              setDateFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          />
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            CUSTOMER
          </label>

          <select
            value={
              customerFilter
            }
            onChange={(e) =>
              setCustomerFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Customers
            </option>

            {customers.map(
              (customer) => (
                <option
                  key={
                    customer.id
                  }
                  value={
                    customer.customer_name
                  }
                >
                  {
                    customer.customer_name
                  }
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            BRANCH
          </label>

          <select
            value={
              branchFilter
            }
            onChange={(e) =>
              setBranchFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Branches
            </option>

            {branches.map(
              (branch) => (
                <option
                  key={
                    branch.id
                  }
                  value={
                    branch.id
                  }
                >
                  {
                    branch.branch_name
                  }
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* ========================================================
          SALES RECORDS
      ======================================================== */}

      <div
        style={{
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius:
            "10px",
          padding: "17px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            SALES RECORDS
          </h2>

          <span
            style={{
              color:
                "#64748b",
              fontSize:
                "10px",
            }}
          >
            {
              filteredSales.length
            }{" "}
            records
          </span>
        </div>

        <div
          style={{
            width: "100%",
            overflowX:
              "auto",
            border:
              "1px solid #263548",
            borderRadius:
              "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize:
                "11px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor:
                    "#0b1220",
                }}
              >
                <th
                  style={
                    thStyle
                  }
                >
                  DATE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DN NO.
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  CUSTOMER
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  ITEM
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  QTY
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  TOTAL
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  EXTERNAL INVOICE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  ERP INVOICE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DOCUMENTS
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    style={
                      emptyStyle
                    }
                  >
                    Loading sales...
                  </td>
                </tr>
              ) : filteredSales.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={
                      emptyStyle
                    }
                  >
                    No sales found.
                  </td>
                </tr>
              ) : (
                filteredSales.map(
                  (
                    sale,
                    index
                  ) => {
                    const item =
                      items.find(
                        (i) =>
                          i.id ===
                          sale.item_id
                      );

                    const externalGenerated =
                      (
                        sale.invoice_status ||
                        "PENDING"
                      ).toUpperCase() ===
                      "GENERATED";

                    return (
                      <tr
                        key={
                          sale.id
                        }
                        style={{
                          backgroundColor:
                            index %
                              2 ===
                            0
                              ? "#111827"
                              : "#0f172a",
                        }}
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            sale.sales_date
                          }
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#22d3ee",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            sale.delivery_note_no ||
                            "-"
                          }
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#ffffff",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            sale.customer_name
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {item
                            ?.item_name ||
                            `Item #${sale.item_id}`}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#f59e0b",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            sale.quantity
                          }
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#22c55e",
                            fontWeight:
                              800,
                          }}
                        >
                          {Number(
                            sale.total_amount
                          ).toFixed(
                            2
                          )}{" "}
                          SAR
                        </td>

                        {/* EXTERNAL INVOICE */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              openExternalInvoiceEditor(
                                sale
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                "5px",
                              padding:
                                "5px 8px",
                              backgroundColor:
                                externalGenerated
                                  ? "#14532d"
                                  : "#7f1d1d",
                              color:
                                externalGenerated
                                  ? "#86efac"
                                  : "#fca5a5",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                800,
                            }}
                          >
                            {externalGenerated
                              ? `✓ ${
                                  sale.invoice_number ||
                                  "GENERATED"
                                }`
                              : "⚠ PENDING"}
                          </button>
                        </td>

                        {/* ERP INVOICE */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              exportERPInvoicePDF(
                                sale
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                "5px",
                              padding:
                                "5px 8px",
                              backgroundColor:
                                "#172554",
                              color:
                                "#67e8f9",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                800,
                            }}
                          >
                            📄{" "}
                            {sale.erp_invoice_number ||
                              "ERP PDF"}
                          </button>
                        </td>

                        {/* DOCUMENTS */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              openDocuments(
                                sale
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                "5px",
                              padding:
                                "5px 8px",
                              backgroundColor:
                                "#312e81",
                              color:
                                "#c4b5fd",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                800,
                            }}
                          >
                            📎 Documents
                          </button>
                        </td>

                        {/* ACTIONS */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "5px",
                            }}
                          >
                            <button
                              onClick={() =>
                                editSale(
                                  sale
                                )
                              }
                              disabled={
                                saving
                              }
                              style={{
                                backgroundColor:
                                  "#2563eb",
                                color:
                                  "#ffffff",
                                border:
                                  "none",
                                borderRadius:
                                  "4px",
                                padding:
                                  "5px 8px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "10px",
                              }}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                deleteSale(
                                  sale
                                )
                              }
                              disabled={
                                saving
                              }
                              style={{
                                backgroundColor:
                                  "#dc2626",
                                color:
                                  "#ffffff",
                                border:
                                  "none",
                                borderRadius:
                                  "4px",
                                padding:
                                  "5px 8px",
                                cursor:
                                  "pointer",
                                fontSize:
                                  "10px",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          ITEM-WISE SUMMARY
      ======================================================== */}

      <div
        style={{
          marginTop: "15px",
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius:
            "10px",
          padding: "17px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "12px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#22d3ee",
                fontSize:
                  "16px",
              }}
            >
              ITEM-WISE SALES SUMMARY
            </h2>

            <div
              style={{
                marginTop:
                  "3px",
                color:
                  "#64748b",
                fontSize:
                  "10px",
              }}
            >
              Total quantity and amount for each item
            </div>
          </div>

          <span
            style={{
              color:
                "#64748b",
              fontSize:
                "10px",
            }}
          >
            {
              itemSalesSummary.length
            }{" "}
            items
          </span>
        </div>

        <div
          style={{
            overflowX:
              "auto",
            border:
              "1px solid #263548",
            borderRadius:
              "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize:
                "11px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor:
                    "#0b1220",
                }}
              >
                <th
                  style={{
                    ...thStyle,
                    width: "55%",
                  }}
                >
                  ITEM
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  TOTAL QTY
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  UNIT
                </th>

                <th
                  style={{
                    ...thStyle,
                    textAlign:
                      "right",
                  }}
                >
                  TOTAL AMOUNT
                </th>
              </tr>
            </thead>

            <tbody>
              {itemSalesSummary.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={
                      emptyStyle
                    }
                  >
                    No item sales to summarize.
                  </td>
                </tr>
              ) : (
                itemSalesSummary.map(
                  (
                    row,
                    index
                  ) => (
                    <tr
                      key={
                        row.itemId
                      }
                      style={{
                        backgroundColor:
                          index %
                            2 ===
                          0
                            ? "#111827"
                            : "#0f172a",
                      }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#ffffff",
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          row.itemName
                        }
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#f59e0b",
                          fontWeight:
                            800,
                        }}
                      >
                        {
                          row.quantity
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          row.unit
                        }
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#22c55e",
                          fontWeight:
                            800,
                          textAlign:
                            "right",
                        }}
                      >
                        {Number(
                          row.amount
                        ).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits:
                              2,
                            maximumFractionDigits:
                              2,
                          }
                        )}{" "}
                        SAR
                      </td>
                    </tr>
                  )
                )
              )}

              {itemSalesSummary.length >
                0 && (
                <tr
                  style={{
                    background:
                      "linear-gradient(135deg, #172554, #0f172a)",
                    borderTop:
                      "2px solid #22d3ee",
                  }}
                >
                  <td
                    style={{
                      padding:
                        "11px 7px",
                      color:
                        "#22d3ee",
                      fontWeight:
                        900,
                    }}
                  >
                    GRAND TOTAL
                  </td>

                  <td
                    style={{
                      padding:
                        "11px 7px",
                      color:
                        "#f59e0b",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      itemSummaryGrandQuantity
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "11px 7px",
                      color:
                        "#64748b",
                      fontWeight:
                        700,
                    }}
                  >
                    ALL ITEMS
                  </td>

                  <td
                    style={{
                      padding:
                        "11px 7px",
                      color:
                        "#22c55e",
                      fontWeight:
                        900,
                      textAlign:
                        "right",
                    }}
                  >
                    {Number(
                      itemSummaryGrandAmount
                    ).toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits:
                          2,
                        maximumFractionDigits:
                          2,
                      }
                    )}{" "}
                    SAR
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          EXTERNAL INVOICE LIST MODAL
      ======================================================== */}

      {invoiceModal && (
        <div
          style={
            modalOverlayStyle
          }
          onClick={() =>
            setInvoiceModal(
              null
            )
          }
        >
          <div
            style={
              modalStyle
            }
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom:
                  "15px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color:
                    invoiceModal ===
                    "PENDING"
                      ? "#f87171"
                      : "#4ade80",
                  fontSize:
                    "17px",
                }}
              >
                {invoiceModal ===
                "PENDING"
                  ? "PENDING EXTERNAL INVOICES"
                  : "GENERATED EXTERNAL INVOICES"}
              </h2>

              <button
                onClick={() =>
                  setInvoiceModal(
                    null
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>
            </div>

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  fontSize:
                    "11px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor:
                        "#0b1220",
                    }}
                  >
                    <th
                      style={
                        thStyle
                      }
                    >
                      DATE
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      DN NO.
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      CUSTOMER
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      AMOUNT
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      EXTERNAL INVOICE
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(invoiceModal ===
                  "PENDING"
                    ? pendingExternalInvoices
                    : generatedExternalInvoices
                  ).map(
                    (sale) => (
                      <tr
                        key={
                          sale.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            sale.sales_date
                          }
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#22d3ee",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            sale.delivery_note_no
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            sale.customer_name
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {Number(
                            sale.total_amount
                          ).toFixed(
                            2
                          )}{" "}
                          SAR
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {sale.invoice_number ||
                            "—"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              openExternalInvoiceEditor(
                                sale
                              )
                            }
                            style={{
                              backgroundColor:
                                invoiceModal ===
                                "PENDING"
                                  ? "#2563eb"
                                  : "#374151",
                              color:
                                "#ffffff",
                              border:
                                "none",
                              borderRadius:
                                "5px",
                              padding:
                                "6px 10px",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                700,
                            }}
                          >
                            {invoiceModal ===
                            "PENDING"
                              ? "Mark Generated"
                              : "View / Edit"}
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {(invoiceModal ===
                    "PENDING"
                    ? pendingExternalInvoices
                    : generatedExternalInvoices
                  ).length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={
                          emptyStyle
                        }
                      >
                        {invoiceModal ===
                        "PENDING"
                          ? "No pending external invoices."
                          : "No generated external invoices."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EXTERNAL INVOICE EDIT MODAL
      ======================================================== */}

      {externalInvoiceSale && (
        <div
          style={
            modalOverlayStyle
          }
          onClick={() =>
            setExternalInvoiceSale(
              null
            )
          }
        >
          <div
            style={{
              ...modalStyle,
              maxWidth:
                "450px",
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom:
                  "15px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color:
                    "#22d3ee",
                  fontSize:
                    "17px",
                }}
              >
                EXTERNAL INVOICE
              </h2>

              <button
                onClick={() =>
                  setExternalInvoiceSale(
                    null
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding:
                  "10px",
                backgroundColor:
                  "#0b1220",
                border:
                  "1px solid #263548",
                borderRadius:
                  "7px",
                marginBottom:
                  "12px",
              }}
            >
              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "10px",
                }}
              >
                DELIVERY NOTE
              </div>

              <div
                style={{
                  color:
                    "#22d3ee",
                  fontWeight:
                    800,
                  marginTop:
                    "3px",
                }}
              >
                {
                  externalInvoiceSale.delivery_note_no
                }
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "10px",
                  marginTop:
                    "8px",
                }}
              >
                CUSTOMER
              </div>

              <div
                style={{
                  color:
                    "#ffffff",
                  fontWeight:
                    700,
                }}
              >
                {
                  externalInvoiceSale.customer_name
                }
              </div>
            </div>

            <div
              style={{
                marginBottom:
                  "12px",
              }}
            >
              <label
                style={
                  labelStyle
                }
              >
                EXTERNAL INVOICE NUMBER
              </label>

              <input
                style={
                  inputStyle
                }
                value={
                  externalInvoiceNumber
                }
                placeholder="Enter invoice number"
                onChange={(e) =>
                  setExternalInvoiceNumber(
                    e.target.value
                  )
                }
              />
            </div>

            <div
              style={{
                marginBottom:
                  "15px",
              }}
            >
              <label
                style={
                  labelStyle
                }
              >
                EXTERNAL INVOICE DATE
              </label>

              <input
                type="date"
                style={
                  inputStyle
                }
                value={
                  externalInvoiceDate
                }
                onChange={(e) =>
                  setExternalInvoiceDate(
                    e.target.value
                  )
                }
              />
            </div>

            <button
              onClick={
                markExternalInvoiceGenerated
              }
              disabled={
                saving
              }
              style={{
                width: "100%",
                border:
                  "none",
                borderRadius:
                  "6px",
                padding:
                  "10px",
                background:
                  "linear-gradient(135deg, #06b6d4, #2563eb)",
                color:
                  "#ffffff",
                fontWeight:
                  800,
                cursor:
                  "pointer",
              }}
            >
              ✓ MARK EXTERNAL INVOICE GENERATED
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          DOCUMENT MODAL
      ======================================================== */}

      {documentSale && (
        <div
          style={
            modalOverlayStyle
          }
          onClick={() =>
            setDocumentSale(
              null
            )
          }
        >
          <div
            style={{
              ...modalStyle,
              maxWidth:
                "700px",
            }}
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                marginBottom:
                  "15px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color:
                      "#c4b5fd",
                    fontSize:
                      "17px",
                  }}
                >
                  SALE DOCUMENTS
                </h2>

                <div
                  style={{
                    color:
                      "#64748b",
                    fontSize:
                      "10px",
                    marginTop:
                      "3px",
                  }}
                >
                  DN:{" "}
                  {
                    documentSale.delivery_note_no
                  }{" "}
                  |{" "}
                  {
                    documentSale.customer_name
                  }
                </div>
              </div>

              <button
                onClick={() =>
                  setDocumentSale(
                    null
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>
            </div>

            {/* UPLOAD */}

            <div
              style={{
                padding:
                  "12px",
                backgroundColor:
                  "#0b1220",
                border:
                  "1px solid #263548",
                borderRadius:
                  "7px",
                marginBottom:
                  "15px",
              }}
            >
              <div
                style={{
                  color:
                    "#22d3ee",
                  fontSize:
                    "11px",
                  fontWeight:
                    800,
                  marginBottom:
                    "8px",
                }}
              >
                ATTACH NEW DOCUMENT
              </div>

              <input
                style={{
                  ...inputStyle,
                  marginBottom:
                    "8px",
                  paddingTop:
                    "9px",
                }}
                type="file"
                onChange={
                  uploadDocument
                }
                disabled={
                  uploadingDocument
                }
              />

              <input
                style={
                  inputStyle
                }
                value={
                  documentDescription
                }
                placeholder="Document description (optional)"
                onChange={(e) =>
                  setDocumentDescription(
                    e.target.value
                  )
                }
              />

              {uploadingDocument && (
                <div
                  style={{
                    color:
                      "#f59e0b",
                    fontSize:
                      "10px",
                    marginTop:
                      "8px",
                  }}
                >
                  Uploading document...
                </div>
              )}
            </div>

            {/* DOCUMENT LIST */}

            <div>
              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "10px",
                  fontWeight:
                    700,
                  marginBottom:
                    "8px",
                }}
              >
                ATTACHED DOCUMENTS
              </div>

              {documentLoading ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  Loading documents...
                </div>
              ) : documents.length ===
                0 ? (
                <div
                  style={{
                    ...emptyStyle,
                    border:
                      "1px solid #263548",
                    borderRadius:
                      "6px",
                  }}
                >
                  No documents attached.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: "7px",
                  }}
                >
                  {documents.map(
                    (document) => (
                      <div
                        key={
                          document.id
                        }
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          padding:
                            "9px",
                          backgroundColor:
                            "#0f172a",
                          border:
                            "1px solid #263548",
                          borderRadius:
                            "6px",
                        }}
                      >
                        <div
                          style={{
                            minWidth:
                              0,
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#ffffff",
                              fontWeight:
                                700,
                              fontSize:
                                "11px",
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                            }}
                          >
                            📎{" "}
                            {
                              document.file_name
                            }
                          </div>

                          <div
                            style={{
                              color:
                                "#64748b",
                              fontSize:
                                "9px",
                              marginTop:
                                "3px",
                            }}
                          >
                            {document.description ||
                              "No description"}
                            {" • "}
                            {document.file_size
                              ? `${(
                                  document.file_size /
                                  1024
                                ).toFixed(
                                  1
                                )} KB`
                              : "Unknown size"}
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap:
                              "5px",
                            marginLeft:
                              "10px",
                          }}
                        >
                          <button
                            onClick={() =>
                              viewDocument(
                                document
                              )
                            }
                            style={{
                              backgroundColor:
                                "#2563eb",
                              color:
                                "#ffffff",
                              border:
                                "none",
                              borderRadius:
                                "4px",
                              padding:
                                "5px 9px",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                            }}
                          >
                            View
                          </button>

                          <button
                            onClick={() =>
                              deleteDocument(
                                document
                              )
                            }
                            style={{
                              backgroundColor:
                                "#dc2626",
                              color:
                                "#ffffff",
                              border:
                                "none",
                              borderRadius:
                                "4px",
                              padding:
                                "5px 9px",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SUMMARY CARD
================================================================ */

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
        backgroundColor:
          "#111827",
        border:
          "1px solid #263548",
        borderLeft:
          `3px solid ${color}`,
        borderRadius:
          "8px",
        padding:
          "11px",
      }}
    >
      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "9px",
          fontWeight:
            700,
          marginBottom:
            "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize:
            "18px",
          fontWeight:
            800,
        }}
      >
        {Number(
          value
        ).toLocaleString(
          "en-US",
          {
            minimumFractionDigits:
              suffix ? 2 : 0,
            maximumFractionDigits:
              suffix ? 2 : 0,
          }
        )}{" "}
        {suffix && (
          <span
            style={{
              fontSize:
                "10px",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   CLICKABLE INVOICE CARD
================================================================ */

function ClickableInvoiceCard({
  title,
  value,
  color,
  onClick,
}: {
  title: string;
  value: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={
        onClick
      }
      style={{
        textAlign:
          "left",
        backgroundColor:
          "#111827",
        border:
          "1px solid #263548",
        borderLeft:
          `3px solid ${color}`,
        borderRadius:
          "8px",
        padding:
          "11px",
        cursor:
          "pointer",
        transition:
          "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform =
          "translateY(-2px)";
        e.currentTarget.style.borderColor =
          color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform =
          "translateY(0)";
        e.currentTarget.style.borderColor =
          "#263548";
      }}
    >
      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "9px",
          fontWeight:
            700,
          marginBottom:
            "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize:
            "18px",
          fontWeight:
            800,
        }}
      >
        {value}
      </div>

      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "8px",
          marginTop:
            "3px",
        }}
      >
        Click to view →
      </div>
    </button>
  );
}

/* ================================================================
   CALCULATION BOX
================================================================ */

function CalculationBox({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "9px",
          fontWeight:
            700,
          marginBottom:
            "4px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color,
          fontSize:
            "17px",
          fontWeight:
            800,
        }}
      >
        {Number(
          value
        ).toLocaleString(
          "en-US",
          {
            minimumFractionDigits:
              2,
            maximumFractionDigits:
              2,
          }
        )}{" "}
        SAR
      </div>
    </div>
  );
}

/* ================================================================
   MODAL STYLES
================================================================ */

const modalOverlayStyle:
  React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor:
    "rgba(0, 0, 0, 0.75)",
  display: "flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  zIndex: 9999,
  padding: "20px",
};

const modalStyle:
  React.CSSProperties = {
  width: "100%",
  maxWidth: "1000px",
  maxHeight:
    "90vh",
  overflowY:
    "auto",
  backgroundColor:
    "#111827",
  border:
    "1px solid #334155",
  borderRadius:
    "10px",
  padding: "18px",
  boxShadow:
    "0 25px 50px rgba(0,0,0,0.5)",
};

const closeButtonStyle:
  React.CSSProperties = {
  width: "30px",
  height: "30px",
  border: "none",
  borderRadius:
    "6px",
  backgroundColor:
    "#374151",
  color: "#ffffff",
  fontSize: "20px",
  cursor: "pointer",
};

export default Sales;