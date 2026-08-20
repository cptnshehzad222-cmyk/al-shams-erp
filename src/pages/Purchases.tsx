import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type Supplier = {
  id: number;
  supplier_name: string;
  phone?: string | null;
  vat_number?: string | null;
  address?: string | null;
};

type Item = {
  id: number;
  item_name: string;
  unit?: string | null;
  item_type?: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type Driver = {
  id: number;
  driver_name: string;
};

type Purchase = {
  id: number;
  purchase_date: string;
  supplier_name: string | null;
  item_id: number | null;
  quantity: number;
  unit_price: number;
  vat_percent: number | null;
  total_amount: number;
  payment_type: string | null;
  notes: string | null;
  driver: string | null;
  driver_id: number | null;
  branch_id: string | null;

  external_invoice_number?: string | null;
  external_invoice_status?: string | null;

  created_at?: string;
};

type PurchaseAttachment = {
  id: number;
  purchase_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at?: string | null;
};

type FormData = {
  purchase_date: string;
  supplier_id: string;
  supplier_name: string;
  item_id: string;
  branch_id: string;
  driver_id: string;
  quantity: string;
  unit_price: string;
  vat_enabled: boolean;
  vat_percent: string;
  payment_type: string;
  payment_amount: string;
  notes: string;

  external_invoice_number: string;
  external_invoice_status: string;
};

const emptyForm: FormData = {
  purchase_date: new Date().toISOString().split("T")[0],
  supplier_id: "",
  supplier_name: "",
  item_id: "",
  branch_id: "",
  driver_id: "",
  quantity: "",
  unit_price: "",
  vat_enabled: false,
  vat_percent: "15",
  payment_type: "On Account",
  payment_amount: "",
  notes: "",

  external_invoice_number: "",
  external_invoice_status: "Pending",
};

type FormKey = keyof FormData;

export default function Purchase() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [attachments, setAttachments] = useState<PurchaseAttachment[]>([]);

  const [form, setForm] = useState<FormData>(emptyForm);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [uploadingAttachment, setUploadingAttachment] =
    useState(false);

  const [selectedPurchaseForAttachments, setSelectedPurchaseForAttachments] =
    useState<Purchase | null>(null);

  const [showPendingInvoices, setShowPendingInvoices] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoadingData(true);
    setError("");

    try {
      const [
        suppliersResult,
        itemsResult,
        branchesResult,
        driversResult,
        purchasesResult,
        attachmentsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select("*")
          .order("supplier_name", { ascending: true }),

        supabase
          .from("items")
          .select("*")
          .order("item_name", { ascending: true }),

        supabase
          .from("branches")
          .select("*")
          .order("branch_name", { ascending: true }),

        supabase
          .from("drivers")
          .select("*")
          .order("driver_name", { ascending: true }),

        supabase
          .from("purchases")
          .select("*")
          .order("purchase_date", { ascending: false })
          .order("id", { ascending: false }),

        supabase
          .from("purchase_attachments")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (suppliersResult.error) throw suppliersResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (branchesResult.error) throw branchesResult.error;
      if (driversResult.error) throw driversResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      setSuppliers(suppliersResult.data || []);

      const purchaseItems = (itemsResult.data || []).filter(
        (item: Item) => {
          const type = (item.item_type || "").toLowerCase();

          return (
            type === "" ||
            type.includes("purchase") ||
            item.item_name.toLowerCase().includes("open top")
          );
        }
      );

      setItems(purchaseItems);
      setBranches(branchesResult.data || []);
      setDrivers(driversResult.data || []);
      setPurchases(purchasesResult.data || []);

      if (!attachmentsResult.error) {
        setAttachments(attachmentsResult.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "Failed to load purchase data."
      );
    } finally {
      setLoadingData(false);
    }
  }

  function updateForm<K extends FormKey>(
    key: K,
    value: FormData[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function handleSupplierChange(value: string) {
    const supplier = suppliers.find(
      (item) => String(item.id) === value
    );

    setForm((previous) => ({
      ...previous,
      supplier_id: value,
      supplier_name: supplier?.supplier_name || "",
    }));
  }

  function handleDriverChange(value: string) {
    updateForm("driver_id", value);
  }

  const quantity = Number(form.quantity) || 0;
  const unitPrice = Number(form.unit_price) || 0;

  const subtotal = quantity * unitPrice;

  const vatPercent = form.vat_enabled
    ? Number(form.vat_percent) || 0
    : 0;

  const vatAmount = subtotal * (vatPercent / 100);

  const grandTotal = subtotal + vatAmount;

  const paymentAmount =
    form.payment_type === "Paid"
      ? grandTotal
      : Math.min(
          Number(form.payment_amount) || 0,
          grandTotal
        );

  const balanceAmount = Math.max(
    grandTotal - paymentAmount,
    0
  );

  const itemNameById = (id: number | null) => {
    if (!id) return "-";

    return (
      items.find((item) => item.id === id)?.item_name ||
      "-"
    );
  };

  const branchNameById = (id: string | null) => {
    if (!id) return "-";

    return (
      branches.find((branch) => branch.id === id)
        ?.branch_name || "-"
    );
  };

  const driverNameById = (id: number | null) => {
    if (!id) return "-";

    return (
      drivers.find((driver) => driver.id === id)
        ?.driver_name || "-"
    );
  };

  const filteredPurchases = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const itemName = itemNameById(
        purchase.item_id
      ).toLowerCase();

      const matchesSearch =
        !keyword ||
        (purchase.supplier_name || "")
          .toLowerCase()
          .includes(keyword) ||
        itemName.includes(keyword) ||
        (purchase.notes || "")
          .toLowerCase()
          .includes(keyword) ||
        (purchase.driver || "")
          .toLowerCase()
          .includes(keyword) ||
        (purchase.external_invoice_number || "")
          .toLowerCase()
          .includes(keyword);

      const matchesDateFrom =
        !dateFrom ||
        purchase.purchase_date >= dateFrom;

      const matchesDateTo =
        !dateTo ||
        purchase.purchase_date <= dateTo;

      const matchesItem =
        !itemFilter ||
        String(purchase.item_id) === itemFilter;

      const matchesSupplier =
        !supplierFilter ||
        (purchase.supplier_name || "") ===
          supplierFilter;

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesItem &&
        matchesSupplier
      );
    });
  }, [
    purchases,
    search,
    dateFrom,
    dateTo,
    itemFilter,
    supplierFilter,
    items,
  ]);

  const totalQuantity = filteredPurchases.reduce(
    (sum, purchase) =>
      sum + Number(purchase.quantity || 0),
    0
  );

  const totalAmount = filteredPurchases.reduce(
    (sum, purchase) =>
      sum + Number(purchase.total_amount || 0),
    0
  );

  const totalVAT = filteredPurchases.reduce(
    (sum, purchase) => {
      const sub =
        Number(purchase.quantity || 0) *
        Number(purchase.unit_price || 0);

      return (
        sum +
        Math.max(
          Number(purchase.total_amount || 0) -
            sub,
          0
        )
      );
    },
    0
  );

  const pendingExternalInvoices =
    purchases.filter(
      (purchase) =>
        !purchase.external_invoice_number ||
        !purchase.external_invoice_status ||
        purchase.external_invoice_status ===
          "Pending"
    );

  /*
   * ITEM SUMMARY
   */
  const itemSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        item: string;
        quantity: number;
        amount: number;
      }
    >();

    filteredPurchases.forEach((purchase) => {
      const item = itemNameById(
        purchase.item_id
      );

      const existing = map.get(item);

      if (existing) {
        existing.quantity += Number(
          purchase.quantity || 0
        );

        existing.amount += Number(
          purchase.total_amount || 0
        );
      } else {
        map.set(item, {
          item,
          quantity: Number(
            purchase.quantity || 0
          ),
          amount: Number(
            purchase.total_amount || 0
          ),
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.quantity - a.quantity
    );
  }, [filteredPurchases, items]);

  function resetForm() {
    setForm({
      ...emptyForm,
      purchase_date:
        new Date().toISOString().split("T")[0],
    });

    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function addStockMovement(
    purchase: Purchase,
    operation: "insert" | "delete"
  ) {
    const quantityChange =
      operation === "insert"
        ? Number(purchase.quantity)
        : -Number(purchase.quantity);

    const { error } = await supabase
      .from("stock_movements")
      .insert({
        item_id: purchase.item_id,
        branch_id: purchase.branch_id,
        quantity: quantityChange,
        movement_type:
          operation === "insert"
            ? "Purchase"
            : "Purchase Reversal",
        reference_id: purchase.id,
        reference_type: "purchase",
        movement_date:
          purchase.purchase_date,
        notes:
          operation === "insert"
            ? `Purchase #${purchase.id}`
            : `Reversal of Purchase #${purchase.id}`,
      });

    if (error) throw error;
  }

  async function addSupplierTransaction(
    purchase: Purchase,
    operation: "insert" | "delete"
  ) {
    const total = Number(
      purchase.total_amount || 0
    );

    const payment =
      purchase.payment_type === "Paid"
        ? total
        : 0;

    const purchaseAmount =
      operation === "insert"
        ? total
        : -total;

    const paymentAmount =
      operation === "insert"
        ? -payment
        : payment;

    const rows: any[] = [];

    if (purchaseAmount !== 0) {
      rows.push({
        supplier_name:
          purchase.supplier_name,
        transaction_date:
          purchase.purchase_date,
        transaction_type:
          operation === "insert"
            ? "Purchase"
            : "Purchase Reversal",
        debit:
          purchaseAmount > 0
            ? purchaseAmount
            : 0,
        credit:
          purchaseAmount < 0
            ? Math.abs(purchaseAmount)
            : 0,
        amount: Math.abs(
          purchaseAmount
        ),
        reference_id: purchase.id,
        notes:
          operation === "insert"
            ? `Purchase #${purchase.id}`
            : `Reversal of Purchase #${purchase.id}`,
      });
    }

    if (paymentAmount !== 0) {
      rows.push({
        supplier_name:
          purchase.supplier_name,
        transaction_date:
          purchase.purchase_date,
        transaction_type:
          operation === "insert"
            ? "Payment"
            : "Payment Reversal",
        debit:
          paymentAmount > 0
            ? paymentAmount
            : 0,
        credit:
          paymentAmount < 0
            ? Math.abs(paymentAmount)
            : 0,
        amount: Math.abs(
          paymentAmount
        ),
        reference_id: purchase.id,
        notes:
          operation === "insert"
            ? `Payment against Purchase #${purchase.id}`
            : `Payment reversal for Purchase #${purchase.id}`,
      });
    }

    if (rows.length === 0) return;

    const { error } = await supabase
      .from("supplier_transactions")
      .insert(rows);

    if (error) throw error;
  }

  async function savePurchase() {
    setError("");
    setMessage("");

    if (!form.purchase_date) {
      setError(
        "Please select purchase date."
      );
      return;
    }

    if (!form.supplier_id) {
      setError("Please select a supplier.");
      return;
    }

    if (!form.item_id) {
      setError("Please select an item.");
      return;
    }

    if (!form.branch_id) {
      setError("Please select a branch.");
      return;
    }

    if (quantity <= 0) {
      setError(
        "Quantity must be greater than zero."
      );
      return;
    }

    if (unitPrice < 0) {
      setError(
        "Unit price cannot be negative."
      );
      return;
    }

    if (
      form.payment_type === "On Account" &&
      Number(form.payment_amount) >
        grandTotal
    ) {
      setError(
        "Payment cannot be greater than purchase total."
      );
      return;
    }

    setLoading(true);

    try {
      if (editingId !== null) {
        const oldPurchase =
          purchases.find(
            (purchase) =>
              purchase.id === editingId
          );

        if (!oldPurchase) {
          throw new Error(
            "Purchase record not found."
          );
        }

        await addStockMovement(
          oldPurchase,
          "delete"
        );

        await addSupplierTransaction(
          oldPurchase,
          "delete"
        );

        const { data, error } =
          await supabase
            .from("purchases")
            .update({
              purchase_date:
                form.purchase_date,
              supplier_name:
                form.supplier_name,
              item_id: Number(
                form.item_id
              ),
              quantity,
              unit_price: unitPrice,
              vat_percent:
                vatPercent,
              total_amount:
                grandTotal,
              payment_type:
                form.payment_type,
              notes:
                form.notes || null,
              driver:
                drivers.find(
                  (driver) =>
                    String(
                      driver.id
                    ) ===
                    form.driver_id
                )?.driver_name ||
                null,
              driver_id:
                form.driver_id
                  ? Number(
                      form.driver_id
                    )
                  : null,
              branch_id:
                form.branch_id,
              external_invoice_number:
                form.external_invoice_number ||
                null,
              external_invoice_status:
                form.external_invoice_number
                  ? form.external_invoice_status
                  : "Pending",
            })
            .eq("id", editingId)
            .select()
            .single();

        if (error) throw error;

        const updatedPurchase =
          data as Purchase;

        await addStockMovement(
          updatedPurchase,
          "insert"
        );

        await addSupplierTransaction(
          updatedPurchase,
          "insert"
        );

        setPurchases((previous) =>
          previous.map(
            (purchase) =>
              purchase.id === editingId
                ? updatedPurchase
                : purchase
          )
        );

        setMessage(
          "Purchase updated successfully."
        );
      } else {
        const { data, error } =
          await supabase
            .from("purchases")
            .insert({
              purchase_date:
                form.purchase_date,
              supplier_name:
                form.supplier_name,
              item_id: Number(
                form.item_id
              ),
              quantity,
              unit_price: unitPrice,
              vat_percent:
                vatPercent,
              total_amount:
                grandTotal,
              payment_type:
                form.payment_type,
              notes:
                form.notes || null,
              driver:
                drivers.find(
                  (driver) =>
                    String(
                      driver.id
                    ) ===
                    form.driver_id
                )?.driver_name ||
                null,
              driver_id:
                form.driver_id
                  ? Number(
                      form.driver_id
                    )
                  : null,
              branch_id:
                form.branch_id,
              external_invoice_number:
                form.external_invoice_number ||
                null,
              external_invoice_status:
                form.external_invoice_number
                  ? form.external_invoice_status
                  : "Pending",
            })
            .select()
            .single();

        if (error) throw error;

        const newPurchase =
          data as Purchase;

        await addStockMovement(
          newPurchase,
          "insert"
        );

        await addSupplierTransaction(
          newPurchase,
          "insert"
        );

        setPurchases((previous) => [
          newPurchase,
          ...previous,
        ]);

        setMessage(
          "Purchase saved successfully."
        );
      }

      resetForm();
    } catch (err: any) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong while saving the purchase."
      );
    } finally {
      setLoading(false);
    }
  }

  function editPurchase(
    purchase: Purchase
  ) {
    const supplier = suppliers.find(
      (item) =>
        item.supplier_name ===
        purchase.supplier_name
    );

    const hasVAT =
      Number(
        purchase.vat_percent || 0
      ) > 0;

    setForm({
      purchase_date:
        purchase.purchase_date,
      supplier_id: supplier
        ? String(supplier.id)
        : "",
      supplier_name:
        purchase.supplier_name || "",
      item_id:
        purchase.item_id
          ? String(
              purchase.item_id
            )
          : "",
      branch_id:
        purchase.branch_id || "",
      driver_id:
        purchase.driver_id
          ? String(
              purchase.driver_id
            )
          : "",
      quantity: String(
        purchase.quantity || ""
      ),
      unit_price: String(
        purchase.unit_price || ""
      ),
      vat_enabled: hasVAT,
      vat_percent: hasVAT
        ? String(
            purchase.vat_percent
          )
        : "15",
      payment_type:
        purchase.payment_type ||
        "On Account",
      payment_amount:
        purchase.payment_type ===
        "Paid"
          ? String(
              purchase.total_amount
            )
          : "",
      notes:
        purchase.notes || "",

      external_invoice_number:
        purchase.external_invoice_number ||
        "",
      external_invoice_status:
        purchase.external_invoice_status ||
        "Pending",
    });

    setEditingId(purchase.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deletePurchase(
    purchase: Purchase
  ) {
    const confirmed =
      window.confirm(
        `Delete Purchase #${purchase.id}?\n\nThis will reverse the stock and supplier ledger transaction.`
      );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await addStockMovement(
        purchase,
        "delete"
      );

      await addSupplierTransaction(
        purchase,
        "delete"
      );

      const { error } =
        await supabase
          .from("purchases")
          .delete()
          .eq("id", purchase.id);

      if (error) throw error;

      setPurchases((previous) =>
        previous.filter(
          (item) =>
            item.id !== purchase.id
        )
      );

      setAttachments((previous) =>
        previous.filter(
          (item) =>
            item.purchase_id !==
            purchase.id
        )
      );

      if (
        editingId === purchase.id
      ) {
        resetForm();
      }

      setMessage(
        "Purchase deleted and stock/ledger reversed successfully."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err.message ||
          "Failed to delete purchase."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setItemFilter("");
    setSupplierFilter("");
  }

  /*
   * ATTACHMENTS
   */

  async function loadAttachments(
    purchaseId: number
  ) {
    const { data, error } =
      await supabase
        .from("purchase_attachments")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("created_at", {
          ascending: false,
        });

    if (!error) {
      setAttachments((previous) => {
        const others =
          previous.filter(
            (item) =>
              item.purchase_id !==
              purchaseId
          );

        return [
          ...others,
          ...(data || []),
        ];
      });
    }
  }

  async function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (
      !file ||
      !selectedPurchaseForAttachments
    ) {
      return;
    }

    setUploadingAttachment(true);
    setError("");
    setMessage("");

    try {
      const purchaseId =
        selectedPurchaseForAttachments.id;

      const safeName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const filePath = `purchase-${purchaseId}/${Date.now()}-${safeName}`;

      const { error: uploadError } =
        await supabase.storage
          .from(
            "purchase-attachments"
          )
          .upload(
            filePath,
            file,
            {
              cacheControl: "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const { data, error } =
        await supabase
          .from("purchase_attachments")
          .insert({
            purchase_id:
              purchaseId,
            file_name:
              file.name,
            file_path:
              filePath,
            file_size:
              file.size,
          })
          .select()
          .single();

      if (error) throw error;

      setAttachments((previous) => [
        data as PurchaseAttachment,
        ...previous,
      ]);

      setMessage(
        "Attachment uploaded successfully."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err.message ||
          "Failed to upload attachment."
      );
    } finally {
      setUploadingAttachment(false);

      event.target.value = "";
    }
  }

  function getAttachmentPublicUrl(
    filePath: string
  ) {
    const { data } =
      supabase.storage
        .from(
          "purchase-attachments"
        )
        .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteAttachment(
    attachment: PurchaseAttachment
  ) {
    const confirmed =
      window.confirm(
        `Delete "${attachment.file_name}"?`
      );

    if (!confirmed) return;

    try {
      const { error: storageError } =
        await supabase.storage
          .from(
            "purchase-attachments"
          )
          .remove([
            attachment.file_path,
          ]);

      if (storageError) {
        console.warn(
          storageError
        );
      }

      const { error } =
        await supabase
          .from(
            "purchase_attachments"
          )
          .delete()
          .eq(
            "id",
            attachment.id
          );

      if (error) throw error;

      setAttachments((previous) =>
        previous.filter(
          (item) =>
            item.id !==
            attachment.id
        )
      );

      setMessage(
        "Attachment deleted successfully."
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err.message ||
          "Failed to delete attachment."
      );
    }
  }

  /*
   * EXCEL REPORT
   */

  function exportExcel() {
    const rows =
      filteredPurchases.map(
        (purchase) => {
          const purchaseSubtotal =
            Number(
              purchase.quantity || 0
            ) *
            Number(
              purchase.unit_price || 0
            );

          const vat =
            Number(
              purchase.total_amount || 0
            ) -
            purchaseSubtotal;

          return {
            ID: purchase.id,
            Date:
              purchase.purchase_date,
            Supplier:
              purchase.supplier_name ||
              "",
            Item:
              itemNameById(
                purchase.item_id
              ),
            Branch:
              branchNameById(
                purchase.branch_id
              ),
            Driver:
              purchase.driver ||
              driverNameById(
                purchase.driver_id
              ),
            Quantity:
              purchase.quantity,
            "Unit Price":
              purchase.unit_price,
            Subtotal:
              purchaseSubtotal,
            "VAT %":
              purchase.vat_percent ||
              0,
            "VAT Amount":
              vat,
            "Total Amount":
              purchase.total_amount,
            "Payment Type":
              purchase.payment_type ||
              "",
            "External Invoice":
              purchase.external_invoice_number ||
              "",
            "Invoice Status":
              purchase.external_invoice_status ||
              "Pending",
            Notes:
              purchase.notes || "",
          };
        }
      );

    rows.push({
      ID: 0,
      Date: "",
      Supplier: "",
      Item: "TOTAL",
      Branch: "",
      Driver: "",
      Quantity: totalQuantity,
      "Unit Price": 0,
      Subtotal: 0,
      "VAT %": 0,
      "VAT Amount": totalVAT,
      "Total Amount":
        totalAmount,
      "Payment Type": "",
      "External Invoice": "",
      "Invoice Status": "",
      Notes: "",
    });

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 13 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 35 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Purchases"
    );

    XLSX.writeFile(
      workbook,
      "AL_SHAMS_Purchases.xlsx"
    );
  }

  /*
   * PURCHASE REPORT PDF
   */

  function exportPDF() {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth =
      doc.internal.pageSize.getWidth();

    doc.setFillColor(
      9,
      14,
      22
    );

    doc.rect(
      0,
      0,
      pageWidth,
      297,
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
      "AL SHAMS AL GHAYABA TRD. EST.",
      pageWidth / 2,
      15,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);

    doc.setTextColor(
      120,
      200,
      255
    );

    doc.text(
      "PURCHASE REPORT",
      pageWidth / 2,
      23,
      {
        align: "center",
      }
    );

    doc.setTextColor(
      190,
      200,
      215
    );

    let filterText =
      "All Purchase Records";

    if (dateFrom || dateTo) {
      filterText =
        `${dateFrom || "Beginning"}  →  ${
          dateTo || "Today"
        }`;
    }

    doc.setFontSize(8);

    doc.text(
      filterText,
      pageWidth / 2,
      30,
      {
        align: "center",
      }
    );

    const tableRows =
      filteredPurchases.map(
        (purchase) => {
          const purchaseSubtotal =
            Number(
              purchase.quantity || 0
            ) *
            Number(
              purchase.unit_price || 0
            );

          const vat =
            Number(
              purchase.total_amount || 0
            ) -
            purchaseSubtotal;

          return [
            purchase.id,
            purchase.purchase_date,
            purchase.supplier_name ||
              "-",
            itemNameById(
              purchase.item_id
            ),
            branchNameById(
              purchase.branch_id
            ),
            Number(
              purchase.quantity || 0
            ).toLocaleString(),
            Number(
              purchase.unit_price || 0
            ).toFixed(2),
            purchaseSubtotal.toFixed(
              2
            ),
            `${Number(
              purchase.vat_percent || 0
            ).toFixed(0)}%`,
            vat.toFixed(2),
            Number(
              purchase.total_amount || 0
            ).toFixed(2),
            purchase.payment_type ||
              "-",
          ];
        }
      );

    autoTable(doc, {
      startY: 36,
      head: [
        [
          "ID",
          "Date",
          "Supplier",
          "Item",
          "Branch",
          "Qty",
          "Unit Price",
          "Subtotal",
          "VAT",
          "VAT Amount",
          "Total",
          "Payment",
        ],
      ],
      body: tableRows,
      foot: [
        [
          "",
          "",
          "",
          "",
          "TOTAL",
          totalQuantity.toLocaleString(),
          "",
          "",
          "",
          totalVAT.toFixed(2),
          totalAmount.toFixed(2),
          "",
        ],
      ],
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: [
          35,
          45,
          60,
        ],
        lineColor: [
          210,
          215,
          222,
        ],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [
          15,
          78,
          120,
        ],
        textColor: [
          255,
          255,
          255,
        ],
        fontStyle:
          "bold",
      },
      footStyles: {
        fillColor: [
          225,
          235,
          245,
        ],
        textColor: [
          20,
          35,
          50,
        ],
        fontStyle:
          "bold",
      },
      alternateRowStyles: {
        fillColor: [
          247,
          249,
          252,
        ],
      },
      margin: {
        left: 10,
        right: 10,
      },
    });

    const finalY =
      (doc as any).lastAutoTable
        ?.finalY || 40;

    doc.setFillColor(
      15,
      78,
      120
    );

    doc.roundedRect(
      10,
      finalY + 8,
      90,
      25,
      3,
      3,
      "F"
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "TOTAL PURCHASE QUANTITY",
      15,
      finalY + 17
    );

    doc.setFontSize(13);

    doc.text(
      totalQuantity.toLocaleString(),
      15,
      finalY + 27
    );

    doc.setFillColor(
      20,
      130,
      85
    );

    doc.roundedRect(
      105,
      finalY + 8,
      90,
      25,
      3,
      3,
      "F"
    );

    doc.setFontSize(8);

    doc.text(
      "TOTAL PURCHASE AMOUNT",
      110,
      finalY + 17
    );

    doc.setFontSize(13);

    doc.text(
      `SAR ${totalAmount.toFixed(
        2
      )}`,
      110,
      finalY + 27
    );

    doc.setTextColor(
      110,
      120,
      135
    );

    doc.setFontSize(7);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      pageWidth - 10,
      finalY + 42,
      {
        align: "right",
      }
    );

    doc.save(
      "AL_SHAMS_Purchase_Report.pdf"
    );
  }

  /*
   * PROFESSIONAL SINGLE PURCHASE INVOICE
   */

  function exportPurchaseInvoice(
    purchase: Purchase
  ) {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    const supplier =
      suppliers.find(
        (item) =>
          item.supplier_name ===
          purchase.supplier_name
      );

    const item =
      items.find(
        (item) =>
          item.id ===
          purchase.item_id
      );

    const branch =
      branches.find(
        (branch) =>
          branch.id ===
          purchase.branch_id
      );

    const purchaseSubtotal =
      Number(
        purchase.quantity || 0
      ) *
      Number(
        purchase.unit_price || 0
      );

    const purchaseVAT =
      Number(
        purchase.total_amount || 0
      ) -
      purchaseSubtotal;

    /*
     * HEADER
     */

    doc.setFillColor(
      9,
      18,
      30
    );

    doc.rect(
      0,
      0,
      pageWidth,
      43,
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

    doc.setFontSize(19);

    doc.text(
      "AL SHAMS AL GHAYABA",
      14,
      16
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      185,
      200,
      215
    );

    doc.text(
      "TRADING ESTABLISHMENT",
      14,
      23
    );

    doc.text(
      "PURCHASE MANAGEMENT SYSTEM",
      14,
      29
    );

    /*
     * INVOICE LABEL
     */

    doc.setTextColor(
      90,
      200,
      255
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(20);

    doc.text(
      "PURCHASE INVOICE",
      pageWidth - 14,
      16,
      {
        align: "right",
      }
    );

    doc.setFontSize(9);

    doc.setTextColor(
      230,
      235,
      240
    );

    doc.text(
      `PUR-${purchase.id}`,
      pageWidth - 14,
      24,
      {
        align: "right",
      }
    );

    doc.text(
      purchase.purchase_date,
      pageWidth - 14,
      30,
      {
        align: "right",
      }
    );

    /*
     * SUPPLIER BOX
     */

    doc.setFillColor(
      244,
      247,
      250
    );

    doc.roundedRect(
      14,
      51,
      pageWidth - 28,
      38,
      3,
      3,
      "F"
    );

    doc.setTextColor(
      70,
      80,
      95
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "SUPPLIER INFORMATION",
      20,
      59
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(10);

    doc.setTextColor(
      25,
      35,
      50
    );

    doc.text(
      supplier?.supplier_name ||
        purchase.supplier_name ||
        "-",
      20,
      68
    );

    doc.setFontSize(8);

    doc.setTextColor(
      90,
      100,
      115
    );

    doc.text(
      `Phone: ${
        supplier?.phone || "-"
      }`,
      20,
      76
    );

    doc.text(
      `VAT No: ${
        supplier?.vat_number ||
        "-"
      }`,
      80,
      76
    );

    doc.text(
      `Address: ${
        supplier?.address || "-"
      }`,
      20,
      83
    );

    /*
     * PURCHASE DETAILS
     */

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(8);

    doc.setTextColor(
      70,
      80,
      95
    );

    doc.text(
      "PURCHASE DETAILS",
      14,
      100
    );

    autoTable(doc, {
      startY: 104,
      head: [
        [
          "Item",
          "Branch",
          "Driver",
          "Quantity",
          "Unit Price",
          "VAT",
          "Total",
        ],
      ],
      body: [
        [
          item?.item_name ||
            "-",
          branch?.branch_name ||
            "-",
          purchase.driver ||
            driverNameById(
              purchase.driver_id
            ) ||
            "-",
          Number(
            purchase.quantity || 0
          ).toLocaleString(),
          `SAR ${Number(
            purchase.unit_price ||
              0
          ).toFixed(2)}`,
          `${Number(
            purchase.vat_percent ||
              0
          ).toFixed(0)}%`,
          `SAR ${Number(
            purchase.total_amount ||
              0
          ).toFixed(2)}`,
        ],
      ],
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: [
          35,
          45,
          60,
        ],
        lineColor: [
          210,
          215,
          220,
        ],
      },
      headStyles: {
        fillColor: [
          15,
          78,
          120,
        ],
        textColor: [
          255,
          255,
          255,
        ],
        fontStyle:
          "bold",
      },
    });

    const detailY =
      (doc as any).lastAutoTable
        ?.finalY || 125;

    /*
     * FINANCIAL SUMMARY
     */

    doc.setFillColor(
      247,
      249,
      252
    );

    doc.roundedRect(
      14,
      detailY + 10,
      pageWidth - 28,
      45,
      3,
      3,
      "F"
    );

    doc.setTextColor(
      70,
      80,
      95
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(9);

    doc.text(
      "FINANCIAL SUMMARY",
      20,
      detailY + 19
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    doc.setTextColor(
      55,
      65,
      80
    );

    doc.text(
      "Subtotal",
      20,
      detailY + 30
    );

    doc.text(
      `SAR ${purchaseSubtotal.toFixed(
        2
      )}`,
      85,
      detailY + 30
    );

    doc.text(
      `VAT (${Number(
        purchase.vat_percent || 0
      ).toFixed(0)}%)`,
      20,
      detailY + 39
    );

    doc.text(
      `SAR ${purchaseVAT.toFixed(
        2
      )}`,
      85,
      detailY + 39
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setTextColor(
      15,
      78,
      120
    );

    doc.text(
      "GRAND TOTAL",
      125,
      detailY + 30
    );

    doc.setFontSize(13);

    doc.text(
      `SAR ${Number(
        purchase.total_amount ||
          0
      ).toFixed(2)}`,
      125,
      detailY + 41
    );

    /*
     * PAYMENT INFORMATION
     */

    const paymentY =
      detailY + 65;

    doc.setTextColor(
      70,
      80,
      95
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "PAYMENT INFORMATION",
      14,
      paymentY
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(9);

    doc.setTextColor(
      40,
      50,
      65
    );

    doc.text(
      `Payment Type: ${
        purchase.payment_type ||
        "-"
      }`,
      14,
      paymentY + 9
    );

    doc.text(
      `External Invoice: ${
        purchase.external_invoice_number ||
        "Pending"
      }`,
      14,
      paymentY + 17
    );

    doc.text(
      `Invoice Status: ${
        purchase.external_invoice_status ||
        "Pending"
      }`,
      14,
      paymentY + 25
    );

    /*
     * NOTES
     */

    if (purchase.notes) {
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        70,
        80,
        95
      );

      doc.text(
        "NOTES",
        14,
        paymentY + 39
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        60,
        70,
        85
      );

      const noteLines =
        doc.splitTextToSize(
          purchase.notes,
          pageWidth - 28
        );

      doc.text(
        noteLines,
        14,
        paymentY + 47
      );
    }

    /*
     * FOOTER
     */

    doc.setDrawColor(
      215,
      220,
      225
    );

    doc.line(
      14,
      pageHeight - 25,
      pageWidth - 14,
      pageHeight - 25
    );

    doc.setFontSize(7);

    doc.setTextColor(
      120,
      130,
      140
    );

    doc.text(
      "AL SHAMS AL GHAYABA TRD. EST. • Purchase Invoice",
      14,
      pageHeight - 17
    );

    doc.text(
      `Generated ${new Date().toLocaleString()}`,
      pageWidth - 14,
      pageHeight - 17,
      {
        align: "right",
      }
    );

    doc.save(
      `AL_SHAMS_PURCHASE_INVOICE_${purchase.id}.pdf`
    );
  }

  return (
    <div className="purchase-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .purchase-page {
          width: 100%;
          min-height: 100vh;
          padding: 14px 16px 30px;
          background:
            radial-gradient(
              circle at top right,
              rgba(20, 110, 170, 0.10),
              transparent 30%
            ),
            #07090d;
          color: #f4f7fb;
          overflow-x: hidden;
        }

        .purchase-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
        }

        .purchase-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }

        .purchase-title {
          margin: 0;
          font-size: clamp(22px, 2vw, 30px);
          font-weight: 800;
          letter-spacing: .4px;
        }

        .purchase-subtitle {
          margin: 4px 0 0;
          color: #8995a5;
          font-size: 12px;
        }

        .purchase-card {
          width: 100%;
          background: linear-gradient(
            145deg,
            #10151d,
            #0c1016
          );
          border: 1px solid #202a36;
          border-radius: 12px;
          padding: 15px;
          margin-bottom: 14px;
          box-shadow:
            0 8px 25px rgba(0,0,0,.18);
        }

        .purchase-card-title {
          margin: 0 0 13px;
          font-size: 15px;
          font-weight: 700;
          color: #f2f6fa;
        }

        .purchase-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .purchase-field {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .purchase-field label {
          color: #9ba7b6;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .3px;
        }

        .purchase-field input,
        .purchase-field select,
        .purchase-field textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid #293441;
          background: #080b10;
          color: #f4f7fb;
          border-radius: 7px;
          padding: 8px 9px;
          outline: none;
          font-size: 12px;
        }

        .purchase-field input:focus,
        .purchase-field select:focus,
        .purchase-field textarea:focus {
          border-color: #32b9ff;
          box-shadow:
            0 0 0 2px
            rgba(50,185,255,.09);
        }

        .purchase-field textarea {
          min-height: 62px;
          resize: vertical;
        }

        .purchase-full {
          grid-column: 1 / -1;
        }

        .vat-box {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 35px;
          padding: 7px 9px;
          border: 1px solid #293441;
          border-radius: 7px;
          background: #080b10;
        }

        .vat-box input {
          width: 15px;
          height: 15px;
        }

        .vat-label {
          font-size: 12px;
          font-weight: 600;
        }

        .vat-disabled {
          opacity: .45;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 9px;
          margin-top: 13px;
        }

        .summary-box {
          min-width: 0;
          padding: 11px;
          border-radius: 8px;
          background: #090d13;
          border: 1px solid #202b38;
        }

        .summary-label {
          color: #7f8b9b;
          font-size: 9px;
          margin-bottom: 3px;
          font-weight: 700;
          letter-spacing: .5px;
        }

        .summary-value {
          font-size: 16px;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 13px;
        }

        .purchase-btn {
          border: 0;
          border-radius: 7px;
          padding: 9px 13px;
          color: white;
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          transition: .15s ease;
        }

        .purchase-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .purchase-btn.primary {
          background: #087fc1;
        }

        .purchase-btn.secondary {
          background: #242d39;
        }

        .purchase-btn.danger {
          background: #b82d3a;
        }

        .purchase-btn.excel {
          background: #177245;
        }

        .purchase-btn.pdf {
          background: #9b2734;
        }

        .purchase-btn.invoice {
          background: #6d42c1;
        }

        .purchase-btn.attach {
          background: #16845c;
        }

        .purchase-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
          transform: none;
        }

        .message {
          padding: 9px 12px;
          border-radius: 7px;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .message.success {
          background:
            rgba(30,150,90,.12);
          border: 1px solid
            rgba(30,150,90,.35);
          color: #67e3a4;
        }

        .message.error {
          background:
            rgba(190,45,55,.12);
          border: 1px solid
            rgba(190,45,55,.35);
          color: #ff8992;
        }

        .reminder-card {
          cursor: pointer;
          border-color:
            rgba(245,158,11,.45);
          background:
            linear-gradient(
              135deg,
              rgba(245,158,11,.10),
              rgba(20,20,20,.2)
            );
          transition: .2s ease;
        }

        .reminder-card:hover {
          transform: translateY(-2px);
          border-color:
            rgba(245,158,11,.75);
        }

        .reminder-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .reminder-number {
          font-size: 25px;
          font-weight: 900;
          color: #fbbf24;
        }

        .reminder-title {
          font-size: 13px;
          font-weight: 800;
          color: #f8fafc;
        }

        .reminder-subtitle {
          margin-top: 3px;
          font-size: 10px;
          color: #9ba7b6;
        }

        .filter-grid {
          display: grid;
          grid-template-columns:
            2fr repeat(4, minmax(0, 1fr));
          gap: 9px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          border-radius: 7px;
        }

        .purchase-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        .purchase-table th {
          text-align: left;
          color: #91a0b0;
          font-size: 9px;
          text-transform: uppercase;
          padding: 10px 7px;
          border-bottom:
            1px solid #29323e;
          white-space: nowrap;
          background: #0d1219;
        }

        .purchase-table td {
          padding: 9px 7px;
          border-bottom:
            1px solid #1e2630;
          font-size: 11px;
          white-space: nowrap;
        }

        .purchase-table tr:hover {
          background:
            rgba(255,255,255,.025);
        }

        .small-btn {
          border: 0;
          border-radius: 5px;
          padding: 5px 7px;
          cursor: pointer;
          color: white;
          font-size: 9px;
          margin-right: 3px;
          margin-bottom: 3px;
          font-weight: 700;
        }

        .edit-btn {
          background: #176ea4;
        }

        .delete-btn {
          background: #9d2b37;
        }

        .invoice-btn {
          background: #6540a7;
        }

        .attachment-btn {
          background: #16845c;
        }

        .pending-btn {
          background: #a56a00;
        }

        .empty-row {
          text-align: center;
          padding: 30px !important;
          color: #748091;
        }

        .status-badge {
          display: inline-block;
          padding: 3px 6px;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 800;
        }

        .status-pending {
          background:
            rgba(245,158,11,.14);
          color: #fbbf24;
        }

        .status-received {
          background:
            rgba(30,120,220,.14);
          color: #60a5fa;
        }

        .status-verified {
          background:
            rgba(30,150,90,.14);
          color: #4ade80;
        }

        .item-summary-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(190px, 1fr)
            );
          gap: 9px;
          margin-top: 12px;
        }

        .item-summary-box {
          padding: 10px;
          border: 1px solid #202b38;
          border-radius: 8px;
          background: #090d13;
        }

        .item-summary-name {
          font-size: 11px;
          font-weight: 800;
          color: #e6edf4;
          margin-bottom: 7px;
        }

        .item-summary-line {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: #8f9aaa;
          font-size: 9px;
          margin-top: 3px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background:
            rgba(2,6,12,.72);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
        }

        .modal {
          width: min(850px, 100%);
          max-height: 90vh;
          overflow: hidden;
          background: #10151d;
          border: 1px solid #293442;
          border-radius: 13px;
          box-shadow:
            0 25px 70px rgba(0,0,0,.5);
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #252e39;
        }

        .modal-title {
          margin: 0;
          font-size: 15px;
          font-weight: 800;
        }

        .modal-close {
          border: 0;
          background: transparent;
          color: #8995a5;
          font-size: 24px;
          cursor: pointer;
        }

        .modal-body {
          padding: 15px;
          overflow-y: auto;
        }

        .upload-zone {
          border: 1px dashed #344151;
          border-radius: 10px;
          padding: 22px;
          text-align: center;
          background: #0b1017;
          margin-bottom: 14px;
        }

        .upload-icon {
          font-size: 28px;
          margin-bottom: 7px;
        }

        .upload-title {
          font-size: 12px;
          font-weight: 700;
          color: #dce5ee;
        }

        .upload-subtitle {
          font-size: 10px;
          color: #778495;
          margin: 4px 0 12px;
        }

        .file-label {
          display: inline-block;
          padding: 8px 12px;
          background: #087fc1;
          border-radius: 6px;
          cursor: pointer;
          color: white;
          font-size: 10px;
          font-weight: 700;
        }

        .file-label input {
          display: none;
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .file-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px;
          border: 1px solid #26313d;
          border-radius: 7px;
          background: #0b1017;
        }

        .file-info {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .file-name {
          font-size: 10px;
          font-weight: 700;
          color: #dbe5ef;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-meta {
          font-size: 8px;
          color: #748091;
          margin-top: 2px;
        }

        .file-actions {
          display: flex;
          gap: 5px;
          flex-shrink: 0;
        }

        .file-action {
          border: 0;
          border-radius: 5px;
          padding: 5px 8px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 700;
        }

        .view-file {
          background: #202b38;
          color: #dbe5ef;
        }

        .delete-file {
          background: #491c23;
          color: #ff8b96;
        }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .pending-row {
          display: grid;
          grid-template-columns:
            80px 1fr 150px 100px;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border: 1px solid #293441;
          border-radius: 7px;
          background: #0b1017;
        }

        .pending-id {
          font-size: 10px;
          font-weight: 800;
          color: #60c9ff;
        }

        .pending-supplier {
          font-size: 11px;
          font-weight: 700;
          color: #e5edf5;
        }

        .pending-date {
          font-size: 9px;
          color: #7e8b9b;
        }

        .pending-open {
          border: 0;
          background: #087fc1;
          color: white;
          border-radius: 5px;
          padding: 6px 8px;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 1250px) {
          .purchase-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .filter-grid
            .purchase-field:first-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 900px) {
          .purchase-page {
            padding: 10px;
          }

          .purchase-grid,
          .summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .filter-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .pending-row {
            grid-template-columns:
              1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .purchase-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .purchase-grid,
          .summary-grid,
          .filter-grid {
            grid-template-columns: 1fr;
          }

          .filter-grid
            .purchase-field:first-child {
            grid-column: auto;
          }

          .reminder-content {
            align-items: flex-start;
          }

          .pending-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="purchase-container">

        {/* HEADER */}

        <div className="purchase-header">
          <div>
            <h1 className="purchase-title">
              Purchase Management
            </h1>

            <p className="purchase-subtitle">
              Record purchases, update stock,
              manage supplier transactions
              and maintain purchase documents.
            </p>
          </div>

          {editingId !== null && (
            <button
              className="purchase-btn secondary"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>

        {message && (
          <div className="message success">
            {message}
          </div>
        )}

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {/* PENDING EXTERNAL INVOICE REMINDER */}

        <div
          className="purchase-card reminder-card"
          onClick={() =>
            setShowPendingInvoices(true)
          }
        >
          <div className="reminder-content">
            <div>
              <div className="reminder-title">
                External Invoice Reminder
              </div>

              <div className="reminder-subtitle">
                Click to view all purchases
                waiting for an external
                supplier invoice.
              </div>
            </div>

            <div className="reminder-number">
              {pendingExternalInvoices.length}
            </div>
          </div>
        </div>

        {/* PURCHASE FORM */}

        <div className="purchase-card">

          <h2 className="purchase-card-title">
            {editingId !== null
              ? `Edit Purchase #${editingId}`
              : "New Purchase"}
          </h2>

          <div className="purchase-grid">

            <div className="purchase-field">
              <label>
                Purchase Date
              </label>

              <input
                type="date"
                value={
                  form.purchase_date
                }
                onChange={(e) =>
                  updateForm(
                    "purchase_date",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="purchase-field">
              <label>
                Supplier *
              </label>

              <select
                value={
                  form.supplier_id
                }
                onChange={(e) =>
                  handleSupplierChange(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Supplier
                </option>

                {suppliers.map(
                  (supplier) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.id
                      }
                    >
                      {
                        supplier.supplier_name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="purchase-field">
              <label>
                Item *
              </label>

              <select
                value={form.item_id}
                onChange={(e) =>
                  updateForm(
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
                      key={item.id}
                      value={item.id}
                    >
                      {
                        item.item_name
                      }
                      {item.unit
                        ? ` (${item.unit})`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="purchase-field">
              <label>
                Branch *
              </label>

              <select
                value={
                  form.branch_id
                }
                onChange={(e) =>
                  updateForm(
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

            <div className="purchase-field">
              <label>
                Driver
              </label>

              <select
                value={
                  form.driver_id
                }
                onChange={(e) =>
                  handleDriverChange(
                    e.target.value
                  )
                }
              >
                <option value="">
                  No Driver
                </option>

                {drivers.map(
                  (driver) => (
                    <option
                      key={
                        driver.id
                      }
                      value={
                        driver.id
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

            <div className="purchase-field">
              <label>
                Quantity *
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.quantity
                }
                onChange={(e) =>
                  updateForm(
                    "quantity",
                    e.target.value
                  )
                }
                placeholder="0"
              />
            </div>

            <div className="purchase-field">
              <label>
                Unit Price *
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.unit_price
                }
                onChange={(e) =>
                  updateForm(
                    "unit_price",
                    e.target.value
                  )
                }
                placeholder="0.00"
              />
            </div>

            <div className="purchase-field">
              <label>
                VAT
              </label>

              <div className="vat-box">
                <input
                  type="checkbox"
                  checked={
                    form.vat_enabled
                  }
                  onChange={(e) =>
                    updateForm(
                      "vat_enabled",
                      e.target.checked
                    )
                  }
                />

                <span className="vat-label">
                  Add 15% VAT
                </span>
              </div>
            </div>

            <div
              className={`purchase-field ${
                !form.vat_enabled
                  ? "vat-disabled"
                  : ""
              }`}
            >
              <label>
                VAT %
              </label>

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  form.vat_percent
                }
                disabled={
                  !form.vat_enabled
                }
                onChange={(e) =>
                  updateForm(
                    "vat_percent",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="purchase-field">
              <label>
                Payment Type
              </label>

              <select
                value={
                  form.payment_type
                }
                onChange={(e) =>
                  updateForm(
                    "payment_type",
                    e.target.value
                  )
                }
              >
                <option value="On Account">
                  On Account
                </option>

                <option value="Paid">
                  Paid
                </option>
              </select>
            </div>

            {form.payment_type ===
              "On Account" && (
              <div className="purchase-field">
                <label>
                  Payment Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    form.payment_amount
                  }
                  onChange={(e) =>
                    updateForm(
                      "payment_amount",
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </div>
            )}

            {/* EXTERNAL INVOICE */}

            <div className="purchase-field">
              <label>
                External Invoice No.
              </label>

              <input
                type="text"
                value={
                  form.external_invoice_number
                }
                onChange={(e) =>
                  updateForm(
                    "external_invoice_number",
                    e.target.value
                  )
                }
                placeholder="Supplier invoice number"
              />
            </div>

            <div className="purchase-field">
              <label>
                External Invoice Status
              </label>

              <select
                value={
                  form.external_invoice_status
                }
                onChange={(e) =>
                  updateForm(
                    "external_invoice_status",
                    e.target.value
                  )
                }
              >
                <option value="Pending">
                  Pending
                </option>

                <option value="Received">
                  Received
                </option>

                <option value="Verified">
                  Verified
                </option>
              </select>
            </div>

            <div className="purchase-field purchase-full">
              <label>
                Notes
              </label>

              <textarea
                value={
                  form.notes
                }
                onChange={(e) =>
                  updateForm(
                    "notes",
                    e.target.value
                  )
                }
                placeholder="Optional notes..."
              />
            </div>

          </div>

          {/* CALCULATION */}

          <div className="summary-grid">

            <div className="summary-box">
              <div className="summary-label">
                SUBTOTAL
              </div>

              <div className="summary-value">
                SAR{" "}
                {subtotal.toFixed(
                  2
                )}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                VAT
              </div>

              <div className="summary-value">
                SAR{" "}
                {vatAmount.toFixed(
                  2
                )}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                TOTAL
              </div>

              <div className="summary-value">
                SAR{" "}
                {grandTotal.toFixed(
                  2
                )}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                SUPPLIER BALANCE
              </div>

              <div className="summary-value">
                SAR{" "}
                {balanceAmount.toFixed(
                  2
                )}
              </div>
            </div>

          </div>

          <div className="button-row">

            <button
              className="purchase-btn primary"
              onClick={
                savePurchase
              }
              disabled={loading}
            >
              {loading
                ? "Saving..."
                : editingId !== null
                ? "Update Purchase"
                : "Save Purchase"}
            </button>

            <button
              className="purchase-btn secondary"
              onClick={
                resetForm
              }
              disabled={loading}
            >
              Clear
            </button>

          </div>

        </div>

        {/* FILTERS + SUMMARY */}

        <div className="purchase-card">

          <h2 className="purchase-card-title">
            Purchase Records &
            Summary
          </h2>

          <div className="filter-grid">

            <div className="purchase-field">
              <label>
                Search
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Supplier, item, invoice..."
              />
            </div>

            <div className="purchase-field">
              <label>
                From Date
              </label>

              <input
                type="date"
                value={
                  dateFrom
                }
                onChange={(e) =>
                  setDateFrom(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="purchase-field">
              <label>
                To Date
              </label>

              <input
                type="date"
                value={
                  dateTo
                }
                onChange={(e) =>
                  setDateTo(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="purchase-field">
              <label>
                Item
              </label>

              <select
                value={
                  itemFilter
                }
                onChange={(e) =>
                  setItemFilter(
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Items
                </option>

                {items.map(
                  (item) => (
                    <option
                      key={item.id}
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

            <div className="purchase-field">
              <label>
                Supplier
              </label>

              <select
                value={
                  supplierFilter
                }
                onChange={(e) =>
                  setSupplierFilter(
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Suppliers
                </option>

                {suppliers.map(
                  (supplier) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.supplier_name
                      }
                    >
                      {
                        supplier.supplier_name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

          </div>

          <div className="button-row">

            <button
              className="purchase-btn secondary"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>

            <button
              className="purchase-btn excel"
              onClick={
                exportExcel
              }
              disabled={
                filteredPurchases.length ===
                0
              }
            >
              Export Excel
            </button>

            <button
              className="purchase-btn pdf"
              onClick={
                exportPDF
              }
              disabled={
                filteredPurchases.length ===
                0
              }
            >
              Export Report PDF
            </button>

          </div>

          <div className="summary-grid">

            <div className="summary-box">
              <div className="summary-label">
                RECORDS
              </div>

              <div className="summary-value">
                {
                  filteredPurchases.length
                }
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                TOTAL QUANTITY
              </div>

              <div className="summary-value">
                {totalQuantity.toLocaleString()}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                TOTAL PURCHASE
              </div>

              <div className="summary-value">
                SAR{" "}
                {totalAmount.toFixed(
                  2
                )}
              </div>
            </div>

            <div className="summary-box">
              <div className="summary-label">
                VAT AMOUNT
              </div>

              <div className="summary-value">
                SAR{" "}
                {totalVAT.toFixed(
                  2
                )}
              </div>
            </div>

          </div>

          {/* ITEM SUMMARY */}

          <div className="item-summary-grid">

            {itemSummary.length ===
            0 ? (
              <div className="item-summary-box">
                <div className="item-summary-name">
                  No item summary
                </div>

                <div className="item-summary-line">
                  <span>
                    No purchase records
                  </span>
                </div>
              </div>
            ) : (
              itemSummary.map(
                (summary) => (
                  <div
                    key={
                      summary.item
                    }
                    className="item-summary-box"
                  >
                    <div className="item-summary-name">
                      {
                        summary.item
                      }
                    </div>

                    <div className="item-summary-line">
                      <span>
                        Quantity
                      </span>

                      <strong>
                        {summary.quantity.toLocaleString()}
                      </strong>
                    </div>

                    <div className="item-summary-line">
                      <span>
                        Amount
                      </span>

                      <strong>
                        SAR{" "}
                        {summary.amount.toFixed(
                          2
                        )}
                      </strong>
                    </div>
                  </div>
                )
              )
            )}

          </div>

        </div>

        {/* PURCHASE TABLE */}

        <div className="purchase-card">

          <div className="table-wrapper">

            <table className="purchase-table">

              <thead>
                <tr>
                  <th>
                    ID
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Supplier
                  </th>

                  <th>
                    Item
                  </th>

                  <th>
                    Branch
                  </th>

                  <th>
                    Qty
                  </th>

                  <th>
                    Unit Price
                  </th>

                  <th>
                    VAT
                  </th>

                  <th>
                    Total
                  </th>

                  <th>
                    Ext. Invoice
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>

                {loadingData ? (
                  <tr>
                    <td
                      colSpan={
                        12
                      }
                      className="empty-row"
                    >
                      Loading purchases...
                    </td>
                  </tr>
                ) : filteredPurchases.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        12
                      }
                      className="empty-row"
                    >
                      No purchase
                      records found.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(
                    (purchase) => (
                      <tr
                        key={
                          purchase.id
                        }
                      >

                        <td>
                          #
                          {
                            purchase.id
                          }
                        </td>

                        <td>
                          {
                            purchase.purchase_date
                          }
                        </td>

                        <td>
                          {
                            purchase.supplier_name ||
                            "-"
                          }
                        </td>

                        <td>
                          {itemNameById(
                            purchase.item_id
                          )}
                        </td>

                        <td>
                          {branchNameById(
                            purchase.branch_id
                          )}
                        </td>

                        <td>
                          {Number(
                            purchase.quantity
                          ).toLocaleString()}
                        </td>

                        <td>
                          SAR{" "}
                          {Number(
                            purchase.unit_price
                          ).toFixed(
                            2
                          )}
                        </td>

                        <td>
                          {Number(
                            purchase.vat_percent ||
                              0
                          ).toFixed(
                            0
                          )}
                          %
                        </td>

                        <td>
                          <strong>
                            SAR{" "}
                            {Number(
                              purchase.total_amount
                            ).toFixed(
                              2
                            )}
                          </strong>
                        </td>

                        <td>
                          {purchase.external_invoice_number ||
                            "-"}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${
                              purchase.external_invoice_status ===
                              "Verified"
                                ? "status-verified"
                                : purchase.external_invoice_status ===
                                  "Received"
                                ? "status-received"
                                : "status-pending"
                            }`}
                          >
                            {purchase.external_invoice_status ||
                              "Pending"}
                          </span>
                        </td>

                        <td>

                          <button
                            className="small-btn invoice-btn"
                            onClick={() =>
                              exportPurchaseInvoice(
                                purchase
                              )
                            }
                            title="Download Purchase Invoice PDF"
                          >
                            Invoice
                          </button>

                          <button
                            className="small-btn attachment-btn"
                            onClick={() => {
                              setSelectedPurchaseForAttachments(
                                purchase
                              );

                              loadAttachments(
                                purchase.id
                              );
                            }}
                            title="Manage Attachments"
                          >
                            Files
                          </button>

                          <button
                            className="small-btn edit-btn"
                            onClick={() =>
                              editPurchase(
                                purchase
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="small-btn delete-btn"
                            onClick={() =>
                              deletePurchase(
                                purchase
                              )
                            }
                          >
                            Delete
                          </button>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

              {filteredPurchases.length >
                0 && (
                <tfoot>
                  <tr>

                    <th
                      colSpan={
                        5
                      }
                    >
                      TOTAL
                    </th>

                    <th>
                      {totalQuantity.toLocaleString()}
                    </th>

                    <th></th>

                    <th></th>

                    <th>
                      SAR{" "}
                      {totalAmount.toFixed(
                        2
                      )}
                    </th>

                    <th
                      colSpan={
                        3
                      }
                    ></th>

                  </tr>
                </tfoot>
              )}

            </table>

          </div>

        </div>

      </div>

      {/* ATTACHMENTS MODAL */}

      {selectedPurchaseForAttachments && (
        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <h3 className="modal-title">
                Purchase Documents —
                PUR-
                {
                  selectedPurchaseForAttachments.id
                }
              </h3>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedPurchaseForAttachments(
                    null
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="modal-body">

              <div className="upload-zone">

                <div className="upload-icon">
                  📎
                </div>

                <div className="upload-title">
                  Attach Supplier
                  Invoice,
                  Receipt or
                  Supporting
                  Document
                </div>

                <div className="upload-subtitle">
                  PDF, images,
                  scanned
                  documents and
                  other files
                </div>

                <label className="file-label">
                  {uploadingAttachment
                    ? "Uploading..."
                    : "Browse File"}

                  <input
                    type="file"
                    onChange={
                      handleFileUpload
                    }
                    disabled={
                      uploadingAttachment
                    }
                  />
                </label>

              </div>

              <div className="file-list">

                {attachments.filter(
                  (attachment) =>
                    attachment.purchase_id ===
                    selectedPurchaseForAttachments.id
                ).length === 0 ? (
                  <div className="empty-row">
                    No attachments
                    uploaded for
                    this purchase.
                  </div>
                ) : (
                  attachments
                    .filter(
                      (attachment) =>
                        attachment.purchase_id ===
                        selectedPurchaseForAttachments.id
                    )
                    .map(
                      (
                        attachment
                      ) => (
                        <div
                          className="file-row"
                          key={
                            attachment.id
                          }
                        >

                          <div className="file-info">

                            <span>
                              📄
                            </span>

                            <div>
                              <div className="file-name">
                                {
                                  attachment.file_name
                                }
                              </div>

                              <div className="file-meta">
                                {(
                                  attachment.file_size /
                                  1024
                                ).toFixed(
                                  1
                                )}{" "}
                                KB
                                {" • "}
                                {attachment.created_at
                                  ? new Date(
                                      attachment.created_at
                                    ).toLocaleDateString()
                                  : ""}
                              </div>
                            </div>

                          </div>

                          <div className="file-actions">

                            <a
                              className="file-action view-file"
                              href={getAttachmentPublicUrl(
                                attachment.file_path
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>

                            <button
                              className="file-action delete-file"
                              onClick={() =>
                                deleteAttachment(
                                  attachment
                                )
                              }
                            >
                              Delete
                            </button>

                          </div>

                        </div>
                      )
                    )
                )}

              </div>

            </div>

          </div>

        </div>
      )}

      {/* PENDING EXTERNAL INVOICE MODAL */}

      {showPendingInvoices && (
        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <div>
                <h3 className="modal-title">
                  Pending External
                  Invoices
                </h3>

                <div
                  style={{
                    fontSize:
                      "9px",
                    color:
                      "#7f8b9b",
                    marginTop:
                      "3px",
                  }}
                >
                  {
                    pendingExternalInvoices.length
                  }{" "}
                  purchase record(s)
                  require external
                  supplier invoice
                  information.
                </div>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowPendingInvoices(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="modal-body">

              {pendingExternalInvoices.length ===
              0 ? (
                <div className="empty-row">
                  All purchase
                  invoices have
                  been recorded.
                </div>
              ) : (
                <div className="pending-list">

                  {pendingExternalInvoices.map(
                    (purchase) => (
                      <div
                        className="pending-row"
                        key={
                          purchase.id
                        }
                      >

                        <div className="pending-id">
                          PUR-
                          {
                            purchase.id
                          }
                        </div>

                        <div>
                          <div className="pending-supplier">
                            {
                              purchase.supplier_name ||
                              "-"
                            }
                          </div>

                          <div className="pending-date">
                            {
                              purchase.purchase_date
                            }
                            {" • "}
                            {itemNameById(
                              purchase.item_id
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            color:
                              "#fbbf24",
                          }}
                        >
                          SAR{" "}
                          {Number(
                            purchase.total_amount ||
                              0
                          ).toFixed(
                            2
                          )}
                        </div>

                        <button
                          className="pending-open"
                          onClick={() => {
                            setShowPendingInvoices(
                              false
                            );

                            editPurchase(
                              purchase
                            );
                          }}
                        >
                          Open Purchase
                        </button>

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