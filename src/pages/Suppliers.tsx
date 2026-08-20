import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: number;
  supplier_name: string;
  phone: string | null;
  vat_number: string | null;
  opening_balance: number | null;
  credit_terms: string | null;
};

type SupplierTransaction = {
  id: number;
  created_at: string;
  supplier_id: number;
  transaction_date: string;
  transaction_type: string;
  reference_id: number | null;
  reference_type: string | null;
  description: string | null;
  debit: number | null;
  credit: number | null;
  payment_method: string | null;
  branch_id: string | null;
  notes: string | null;
  item_id: number | null;
  quantity: number | null;
  unit_price: number | null;
  vat_percent: number | null;
  total_amount: number | null;
};

type Item = {
  id: number;
  item_name: string;
};

type ItemSummary = {
  itemName: string;
  quantity: number;
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
};

const COMPANY_NAME = "AL SHAMS AL GHAYABA TRD EST.";

function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedSupplierId, setSelectedSupplierId] =
    useState<number | "">("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [showSupplierModal, setShowSupplierModal] =
    useState(false);

  const [editingSupplier, setEditingSupplier] =
    useState<Supplier | null>(null);

  const [savingSupplier, setSavingSupplier] =
    useState(false);

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: "",
    phone: "",
    vat_number: "",
    opening_balance: "",
    credit_terms: "",
  });

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    try {
      await Promise.all([
        fetchSuppliers(),
        fetchTransactions(),
        fetchItems(),
      ]);
    } catch (error) {
      console.error(
        "Supplier page loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        `
          id,
          supplier_name,
          phone,
          vat_number,
          opening_balance,
          credit_terms
        `
      )
      .order("supplier_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Supplier loading error:",
        error
      );

      alert(
        "Unable to load suppliers: " +
          error.message
      );

      return;
    }

    setSuppliers(data || []);
  }

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from("supplier_transactions")
      .select(
        `
          id,
          created_at,
          supplier_id,
          transaction_date,
          transaction_type,
          reference_id,
          reference_type,
          description,
          debit,
          credit,
          payment_method,
          branch_id,
          notes,
          item_id,
          quantity,
          unit_price,
          vat_percent,
          total_amount
        `
      )
      .order("transaction_date", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Supplier transaction loading error:",
        error
      );

      alert(
        "Unable to load supplier transactions: " +
          error.message
      );

      return;
    }

    setTransactions(data || []);
  }

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("id, item_name")
      .order("item_name", {
        ascending: true,
      });

    if (error) {
      console.warn(
        "Items could not be loaded:",
        error.message
      );

      setItems([]);
      return;
    }

    setItems(data || []);
  }

  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId === "") {
      return null;
    }

    return (
      suppliers.find(
        (supplier) =>
          supplier.id === selectedSupplierId
      ) || null
    );
  }, [selectedSupplierId, suppliers]);

  const visibleSuppliers = useMemo(() => {
    const query =
      supplierSearch.trim().toLowerCase();

    if (!query) {
      return suppliers;
    }

    return suppliers.filter(
      (supplier) => {
        return [
          supplier.supplier_name,
          supplier.phone || "",
          supplier.vat_number || "",
          supplier.credit_terms || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }
    );
  }, [suppliers, supplierSearch]);

  const supplierTransactions = useMemo(() => {
    if (!selectedSupplier) {
      return [];
    }

    return transactions.filter(
      (transaction) =>
        transaction.supplier_id ===
        selectedSupplier.id
    );
  }, [
    transactions,
    selectedSupplier,
  ]);

  function getItemName(
    itemId: number | null
  ) {
    if (!itemId) {
      return "-";
    }

    return (
      items.find(
        (item) => item.id === itemId
      )?.item_name ||
      `Item #${itemId}`
    );
  }

  const filteredTransactions =
    useMemo(() => {
      const filtered =
        supplierTransactions.filter(
          (transaction) => {
            if (
              fromDate &&
              transaction.transaction_date <
                fromDate
            ) {
              return false;
            }

            if (
              toDate &&
              transaction.transaction_date >
                toDate
            ) {
              return false;
            }

            const itemName =
              getItemName(
                transaction.item_id
              );

            const searchText = [
              transaction.transaction_date,
              transaction.transaction_type,
              transaction.description ||
                "",
              transaction.notes || "",
              transaction.payment_method ||
                "",
              transaction.reference_id
                ? String(
                    transaction.reference_id
                  )
                : "",
              transaction.reference_type ||
                "",
              itemName,
            ]
              .join(" ")
              .toLowerCase();

            return searchText.includes(
              search.toLowerCase()
            );
          }
        );

      return filtered.sort((a, b) => {
        const dateCompare =
          a.transaction_date.localeCompare(
            b.transaction_date
          );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return a.id - b.id;
      });
    }, [
      supplierTransactions,
      fromDate,
      toDate,
      search,
      items,
    ]);

  /*
   * =====================================
   * SUPPLIER ACCOUNT REPORT
   * =====================================
   *
   * Purchase = CREDIT
   * Payment  = DEBIT
   *
   * Balance =
   * Opening + Credit - Debit
   */
  const report = useMemo(() => {
    if (!selectedSupplier) {
      return {
        openingBalance: 0,
        purchases: 0,
        payments: 0,
        debit: 0,
        credit: 0,
        finalBalance: 0,
      };
    }

    let openingBalance =
      Number(
        selectedSupplier.opening_balance ||
          0
      );

    if (fromDate) {
      supplierTransactions.forEach(
        (transaction) => {
          if (
            transaction.transaction_date <
            fromDate
          ) {
            openingBalance +=
              Number(
                transaction.credit || 0
              ) -
              Number(
                transaction.debit || 0
              );
          }
        }
      );
    }

    let purchases = 0;
    let payments = 0;
    let debit = 0;
    let credit = 0;

    filteredTransactions.forEach(
      (transaction) => {
        const transactionDebit =
          Number(
            transaction.debit || 0
          );

        const transactionCredit =
          Number(
            transaction.credit || 0
          );

        debit += transactionDebit;
        credit += transactionCredit;

        if (
          transaction.transaction_type ===
          "PAYMENT"
        ) {
          payments += transactionDebit;
        }

        if (
          transaction.transaction_type ===
          "PURCHASE"
        ) {
          purchases += transactionCredit;
        }
      }
    );

    const finalBalance =
      openingBalance +
      credit -
      debit;

    return {
      openingBalance,
      purchases,
      payments,
      debit,
      credit,
      finalBalance,
    };
  }, [
    selectedSupplier,
    supplierTransactions,
    filteredTransactions,
    fromDate,
  ]);

  function formatAmount(
    amount: number
  ) {
    return Number(
      amount || 0
    ).toLocaleString("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(
    date: string
  ) {
    if (!date) {
      return "-";
    }

    const parts =
      date.split("-");

    if (parts.length !== 3) {
      return date;
    }

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  function getTransactionLabel(
    transaction: SupplierTransaction
  ) {
    if (
      transaction.transaction_type ===
      "PURCHASE"
    ) {
      return "PURCHASE";
    }

    if (
      transaction.transaction_type ===
      "PAYMENT"
    ) {
      return "PAYMENT";
    }

    return (
      transaction.transaction_type ||
      "-"
    );
  }

  function getVatAmount(
    transaction: SupplierTransaction
  ) {
    const total =
      Number(
        transaction.total_amount || 0
      );

    const vatPercent =
      Number(
        transaction.vat_percent || 0
      );

    if (
      total > 0 &&
      vatPercent > 0
    ) {
      return (
        (total * vatPercent) /
        (100 + vatPercent)
      );
    }

    return 0;
  }

  function getTransactionTotal(
    transaction: SupplierTransaction
  ) {
    const total =
      Number(
        transaction.total_amount || 0
      );

    if (total > 0) {
      return total;
    }

    const quantity =
      Number(
        transaction.quantity || 0
      );

    const unitPrice =
      Number(
        transaction.unit_price || 0
      );

    const vatPercent =
      Number(
        transaction.vat_percent || 0
      );

    const subtotal =
      quantity * unitPrice;

    return (
      subtotal +
      subtotal *
        (vatPercent / 100)
    );
  }

  const itemSummary =
    useMemo(() => {
      const map =
        new Map<
          string,
          ItemSummary
        >();

      filteredTransactions
        .filter(
          (transaction) =>
            transaction.transaction_type ===
            "PURCHASE"
        )
        .forEach(
          (transaction) => {
            const itemName =
              getItemName(
                transaction.item_id
              );

            const quantity =
              Number(
                transaction.quantity ||
                  0
              );

            const total =
              getTransactionTotal(
                transaction
              );

            const vat =
              getVatAmount(
                transaction
              );

            const amountBeforeVat =
              total - vat;

            const existing =
              map.get(itemName);

            if (existing) {
              existing.quantity +=
                quantity;

              existing.amountBeforeVat +=
                amountBeforeVat;

              existing.vatAmount +=
                vat;

              existing.totalAmount +=
                total;
            } else {
              map.set(itemName, {
                itemName,
                quantity,
                amountBeforeVat,
                vatAmount: vat,
                totalAmount: total,
              });
            }
          }
        );

      return Array.from(
        map.values()
      ).sort((a, b) =>
        a.itemName.localeCompare(
          b.itemName
        )
      );
    }, [
      filteredTransactions,
      items,
    ]);

  const itemSummaryTotals =
    useMemo(() => {
      return itemSummary.reduce(
        (total, item) => ({
          quantity:
            total.quantity +
            item.quantity,

          amountBeforeVat:
            total.amountBeforeVat +
            item.amountBeforeVat,

          vatAmount:
            total.vatAmount +
            item.vatAmount,

          totalAmount:
            total.totalAmount +
            item.totalAmount,
        }),
        {
          quantity: 0,
          amountBeforeVat: 0,
          vatAmount: 0,
          totalAmount: 0,
        }
      );
    }, [itemSummary]);

  function calculateRunningBalances() {
    let runningBalance =
      report.openingBalance;

    return filteredTransactions.map(
      (transaction) => {
        const debit =
          Number(
            transaction.debit || 0
          );

        const credit =
          Number(
            transaction.credit || 0
          );

        runningBalance =
          runningBalance +
          credit -
          debit;

        return {
          transaction,
          runningBalance,
        };
      }
    );
  }

  function openAddSupplier() {
    setEditingSupplier(null);

    setSupplierForm({
      supplier_name: "",
      phone: "",
      vat_number: "",
      opening_balance: "",
      credit_terms: "",
    });

    setShowSupplierModal(true);
  }

  function openEditSupplier(
    supplier: Supplier
  ) {
    setEditingSupplier(
      supplier
    );

    setSupplierForm({
      supplier_name:
        supplier.supplier_name || "",

      phone:
        supplier.phone || "",

      vat_number:
        supplier.vat_number || "",

      opening_balance:
        supplier.opening_balance !==
        null
          ? String(
              supplier.opening_balance
            )
          : "",

      credit_terms:
        supplier.credit_terms ||
        "",
    });

    setShowSupplierModal(true);
  }

  function closeSupplierModal() {
    if (savingSupplier) {
      return;
    }

    setShowSupplierModal(false);
    setEditingSupplier(null);
  }

  async function saveSupplier() {
    const supplierName =
      supplierForm.supplier_name.trim();

    if (!supplierName) {
      alert(
        "Please enter supplier name."
      );
      return;
    }

    setSavingSupplier(true);

    try {
      const openingBalance =
        Number(
          supplierForm.opening_balance ||
            0
        );

      const supplierData = {
        supplier_name:
          supplierName,

        phone:
          supplierForm.phone.trim() ||
          null,

        vat_number:
          supplierForm.vat_number.trim() ||
          null,

        opening_balance:
          openingBalance,

        credit_terms:
          supplierForm.credit_terms.trim() ||
          null,
      };

      if (editingSupplier) {
        const { error } =
          await supabase
            .from("suppliers")
            .update(
              supplierData
            )
            .eq(
              "id",
              editingSupplier.id
            );

        if (error) {
          throw error;
        }

        alert(
          "Supplier updated successfully."
        );

        setSelectedSupplierId(
          editingSupplier.id
        );
      } else {
        const { data, error } =
          await supabase
            .from("suppliers")
            .insert(
              supplierData
            )
            .select()
            .single();

        if (error) {
          throw error;
        }

        alert(
          "Supplier added successfully."
        );

        if (data?.id) {
          setSelectedSupplierId(
            data.id
          );
        }
      }

      setShowSupplierModal(false);
      setEditingSupplier(null);

      await fetchSuppliers();
    } catch (error: any) {
      console.error(
        "Supplier save error:",
        error
      );

      alert(
        "Unable to save supplier: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setSavingSupplier(false);
    }
  }

  async function deleteSupplier(
    supplier: Supplier
  ) {
    const hasTransactions =
      transactions.some(
        (transaction) =>
          transaction.supplier_id ===
          supplier.id
      );

    if (hasTransactions) {
      alert(
        "This supplier cannot be deleted because supplier transactions already exist for this supplier."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete supplier "${supplier.supplier_name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const { error } =
        await supabase
          .from("suppliers")
          .delete()
          .eq(
            "id",
            supplier.id
          );

      if (error) {
        throw error;
      }

      if (
        selectedSupplierId ===
        supplier.id
      ) {
        setSelectedSupplierId("");
      }

      await fetchSuppliers();

      alert(
        "Supplier deleted successfully."
      );
    } catch (error: any) {
      console.error(
        "Supplier delete error:",
        error
      );

      alert(
        "Unable to delete supplier: " +
          (error?.message ||
            "Unknown error")
      );
    }
  }

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setSearch("");
  }

  async function exportPDF() {
    if (!selectedSupplier) {
      alert(
        "Please select a supplier first."
      );
      return;
    }

    if (
      filteredTransactions.length ===
      0
    ) {
      alert(
        "There are no transactions to export."
      );
      return;
    }

    setExporting(true);

    try {
      const doc =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      doc.setFillColor(
        7,
        17,
        31
      );

      doc.rect(
        0,
        0,
        pageWidth,
        28,
        "F"
      );

      doc.setTextColor(
        34,
        211,
        238
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(16);

      doc.text(
        COMPANY_NAME,
        10,
        10
      );

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.setFontSize(11);

      doc.text(
        "SUPPLIER LEDGER REPORT",
        10,
        19
      );

      doc.setFontSize(7);

      doc.setTextColor(
        148,
        163,
        184
      );

      doc.text(
        `Generated: ${new Date().toLocaleString(
          "en-SA"
        )}`,
        pageWidth - 10,
        10,
        {
          align: "right",
        }
      );

      doc.setTextColor(
        15,
        23,
        42
      );

      doc.setFontSize(8);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "SUPPLIER",
        10,
        36
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(9);

      doc.text(
        selectedSupplier.supplier_name,
        10,
        42
      );

      doc.setFontSize(7);

      doc.setTextColor(
        100,
        116,
        139
      );

      doc.text(
        `Phone: ${
          selectedSupplier.phone ||
          "-"
        }`,
        10,
        48
      );

      doc.text(
        `VAT: ${
          selectedSupplier.vat_number ||
          "-"
        }`,
        10,
        53
      );

      doc.text(
        `Credit Terms: ${
          selectedSupplier.credit_terms ||
          "-"
        }`,
        10,
        58
      );

      doc.text(
        `Period: ${
          fromDate
            ? formatDate(fromDate)
            : "Beginning"
        } → ${
          toDate
            ? formatDate(toDate)
            : "Present"
        }`,
        85,
        42
      );

      const summaryY = 63;

      const summaryBoxWidth =
        (pageWidth - 20 - 15) /
        4;

      const summaryGap = 5;

      const summaries = [
        {
          title:
            "OPENING BALANCE",
          value:
            report.openingBalance,
          color: [14, 165, 233],
        },

        {
          title:
            "TOTAL PURCHASES",
          value:
            report.purchases,
          color: [245, 158, 11],
        },

        {
          title:
            "TOTAL PAYMENTS",
          value:
            report.payments,
          color: [34, 197, 94],
        },

        {
          title:
            "CURRENT BALANCE",
          value:
            report.finalBalance,
          color:
            report.finalBalance >
            0
              ? [245, 158, 11]
              : [34, 197, 94],
        },
      ];

      summaries.forEach(
        (
          summary,
          index
        ) => {
          const x =
            10 +
            index *
              (summaryBoxWidth +
                summaryGap);

          doc.setFillColor(
            241,
            245,
            249
          );

          doc.roundedRect(
            x,
            summaryY,
            summaryBoxWidth,
            17,
            2,
            2,
            "F"
          );

          doc.setFontSize(6);

          doc.setTextColor(
            100,
            116,
            139
          );

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.text(
            summary.title,
            x + 4,
            summaryY + 5
          );

          doc.setFontSize(9);

          doc.setTextColor(
            summary.color[0],
            summary.color[1],
            summary.color[2]
          );

          doc.text(
            `${formatAmount(
              summary.value
            )} SAR`,
            x + 4,
            summaryY + 12
          );
        }
      );

      const rows =
        calculateRunningBalances().map(
          ({
            transaction,
            runningBalance,
          }) => {
            const quantity =
              Number(
                transaction.quantity ||
                  0
              );

            const unitPrice =
              Number(
                transaction.unit_price ||
                  0
              );

            const vatPercent =
              Number(
                transaction.vat_percent ||
                  0
              );

            const vatAmount =
              getVatAmount(
                transaction
              );

            const totalAmount =
              getTransactionTotal(
                transaction
              );

            return [
              formatDate(
                transaction.transaction_date
              ),

              getTransactionLabel(
                transaction
              ),

              transaction.reference_id
                ? String(
                    transaction.reference_id
                  )
                : "-",

              getItemName(
                transaction.item_id
              ),

              quantity
                ? quantity.toLocaleString(
                    "en-SA"
                  )
                : "-",

              unitPrice
                ? formatAmount(
                    unitPrice
                  )
                : "-",

              vatPercent
                ? `${vatPercent}%`
                : "-",

              vatAmount
                ? formatAmount(
                    vatAmount
                  )
                : "-",

              totalAmount
                ? formatAmount(
                    totalAmount
                  )
                : "-",

              transaction.debit
                ? formatAmount(
                    Number(
                      transaction.debit
                    )
                  )
                : "-",

              transaction.credit
                ? formatAmount(
                    Number(
                      transaction.credit
                    )
                  )
                : "-",

              transaction.payment_method ||
                "-",

              formatAmount(
                runningBalance
              ),

              transaction.description ||
                "-",

              transaction.notes ||
                "-",
            ];
          }
        );

      autoTable(doc, {
        startY: 84,

        head: [
          [
            "DATE",
            "TYPE",
            "REF",
            "ITEM",
            "QTY",
            "UNIT PRICE",
            "VAT %",
            "VAT AMT",
            "TOTAL",
            "DEBIT",
            "CREDIT",
            "METHOD",
            "BALANCE",
            "DESCRIPTION",
            "NOTES",
          ],
        ],

        body: rows,

        theme: "grid",

        margin: {
          left: 6,
          right: 6,
          top: 84,
          bottom: 13,
        },

        styles: {
          fontSize: 5.4,
          cellPadding: 1.5,
          overflow:
            "linebreak",
          textColor: [
            30,
            41,
            59,
          ],
          lineColor: [
            203,
            213,
            225,
          ],
          lineWidth: 0.1,
        },

        headStyles: {
          fillColor: [
            15,
            23,
            42,
          ],
          textColor: [
            103,
            232,
            249,
          ],
          fontStyle:
            "bold",
          fontSize: 5.3,
          cellPadding: 2,
        },

        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },

        columnStyles: {
          0: {
            cellWidth: 14,
          },

          1: {
            cellWidth: 16,
          },

          2: {
            cellWidth: 11,
          },

          3: {
            cellWidth: 23,
          },

          4: {
            cellWidth: 10,
            halign: "right",
          },

          5: {
            cellWidth: 17,
            halign: "right",
          },

          6: {
            cellWidth: 10,
            halign: "right",
          },

          7: {
            cellWidth: 16,
            halign: "right",
          },

          8: {
            cellWidth: 17,
            halign: "right",
          },

          9: {
            cellWidth: 17,
            halign: "right",
          },

          10: {
            cellWidth: 17,
            halign: "right",
          },

          11: {
            cellWidth: 15,
          },

          12: {
            cellWidth: 18,
            halign: "right",
          },

          13: {
            cellWidth: 29,
          },

          14: {
            cellWidth: 25,
          },
        },
      });

      const finalY =
        (doc as any)
          .lastAutoTable
          ?.finalY || 90;

      let itemSummaryY =
        finalY + 8;

      if (
        itemSummaryY >
        pageHeight - 55
      ) {
        doc.addPage();

        itemSummaryY = 14;
      }

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(11);

      doc.setTextColor(
        15,
        23,
        42
      );

      doc.text(
        "TOTAL ITEM PURCHASE SUMMARY",
        10,
        itemSummaryY
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);

      doc.setTextColor(
        100,
        116,
        139
      );

      doc.text(
        "Purchase quantity and amount grouped by item name",
        10,
        itemSummaryY + 5
      );

      const itemRows =
        itemSummary.map(
          (item) => [
            item.itemName,

            item.quantity.toLocaleString(
              "en-SA"
            ),

            formatAmount(
              item.amountBeforeVat
            ),

            formatAmount(
              item.vatAmount
            ),

            formatAmount(
              item.totalAmount
            ),
          ]
        );

      itemRows.push([
        "TOTAL",

        itemSummaryTotals.quantity.toLocaleString(
          "en-SA"
        ),

        formatAmount(
          itemSummaryTotals.amountBeforeVat
        ),

        formatAmount(
          itemSummaryTotals.vatAmount
        ),

        formatAmount(
          itemSummaryTotals.totalAmount
        ),
      ]);

      autoTable(doc, {
        startY:
          itemSummaryY + 9,

        head: [
          [
            "ITEM",
            "TOTAL QTY",
            "AMOUNT BEFORE VAT",
            "VAT",
            "TOTAL AMOUNT",
          ],
        ],

        body: itemRows,

        theme: "grid",

        margin: {
          left: 10,
          right: 10,
          bottom: 15,
        },

        styles: {
          fontSize: 7,
          cellPadding: 2.5,
          textColor: [
            30,
            41,
            59,
          ],
        },

        headStyles: {
          fillColor: [
            15,
            23,
            42,
          ],
          textColor: [
            103,
            232,
            249,
          ],
          fontStyle:
            "bold",
          fontSize: 7,
        },

        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },

        columnStyles: {
          0: {
            cellWidth: 70,
          },

          1: {
            cellWidth: 25,
            halign: "right",
          },

          2: {
            cellWidth: 38,
            halign: "right",
          },

          3: {
            cellWidth: 30,
            halign: "right",
          },

          4: {
            cellWidth: 38,
            halign: "right",
          },
        },

        didParseCell: (
          data: any
        ) => {
          if (
            data.row.index ===
              itemRows.length - 1 &&
            data.section ===
              "body"
          ) {
            data.cell.styles.fontStyle =
              "bold";

            data.cell.styles.fillColor =
              [226, 232, 240];
          }
        },
      });

      const itemFinalY =
        (doc as any)
          .lastAutoTable
          ?.finalY ||
        itemSummaryY + 20;

      let balanceY =
        itemFinalY + 8;

      if (
        balanceY >
        pageHeight - 35
      ) {
        doc.addPage();

        balanceY = 18;
      }

      doc.setFillColor(
        7,
        17,
        31
      );

      doc.roundedRect(
        10,
        balanceY,
        pageWidth - 20,
        22,
        2,
        2,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        103,
        232,
        249
      );

      doc.text(
        "SUPPLIER ACCOUNT SUMMARY",
        15,
        balanceY + 7
      );

      doc.setFontSize(7);

      doc.setTextColor(
        203,
        213,
        225
      );

      doc.text(
        `Opening: ${formatAmount(
          report.openingBalance
        )} SAR`,
        15,
        balanceY + 14
      );

      doc.text(
        `Purchases: ${formatAmount(
          report.purchases
        )} SAR`,
        65,
        balanceY + 14
      );

      doc.text(
        `Payments: ${formatAmount(
          report.payments
        )} SAR`,
        120,
        balanceY + 14
      );

      doc.setFontSize(10);

      doc.setTextColor(
        report.finalBalance >
        0
          ? 245
          : 34,

        report.finalBalance >
        0
          ? 158
          : 197,

        report.finalBalance >
        0
          ? 11
          : 94
      );

      doc.text(
        `CURRENT BALANCE: ${formatAmount(
          report.finalBalance
        )} SAR`,
        pageWidth - 15,
        balanceY + 14,
        {
          align: "right",
        }
      );

      const totalPages =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        doc.setPage(page);

        const footerY =
          pageHeight - 6;

        doc.setDrawColor(
          203,
          213,
          225
        );

        doc.setLineWidth(
          0.2
        );

        doc.line(
          7,
          pageHeight - 11,
          pageWidth - 7,
          pageHeight - 11
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(6.5);

        doc.setTextColor(
          100,
          116,
          139
        );

        doc.text(
          COMPANY_NAME,
          7,
          footerY,
          {
            align: "left",
          }
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          `SUPPLIER LEDGER • PAGE ${page} OF ${totalPages}`,
          pageWidth - 7,
          footerY,
          {
            align: "right",
          }
        );
      }

      const safeName =
        selectedSupplier.supplier_name.replace(
          /[^a-zA-Z0-9-_]/g,
          "_"
        );

      doc.save(
        `Supplier_Report_${safeName}.pdf`
      );
    } catch (error) {
      console.error(
        "PDF export error:",
        error
      );

      alert(
        "Unable to generate PDF report."
      );
    } finally {
      setExporting(false);
    }
  }

  function exportExcel() {
    if (!selectedSupplier) {
      alert(
        "Please select a supplier first."
      );
      return;
    }

    if (
      filteredTransactions.length ===
      0
    ) {
      alert(
        "There are no transactions to export."
      );
      return;
    }

    try {
      const runningRows =
        calculateRunningBalances();

      const excelRows =
        runningRows.map(
          ({
            transaction,
            runningBalance,
          }) => ({
            Date:
              transaction.transaction_date,

            Type:
              getTransactionLabel(
                transaction
              ),

            "Reference ID":
              transaction.reference_id ||
              "",

            "Reference Type":
              transaction.reference_type ||
              "",

            Item:
              getItemName(
                transaction.item_id
              ),

            Quantity:
              Number(
                transaction.quantity ||
                  0
              ),

            "Unit Price":
              Number(
                transaction.unit_price ||
                  0
              ),

            "VAT %":
              Number(
                transaction.vat_percent ||
                  0
              ),

            "VAT Amount":
              getVatAmount(
                transaction
              ),

            "Total Amount":
              getTransactionTotal(
                transaction
              ),

            Debit:
              Number(
                transaction.debit ||
                  0
              ),

            Credit:
              Number(
                transaction.credit ||
                  0
              ),

            "Payment Method":
              transaction.payment_method ||
              "",

            Description:
              transaction.description ||
              "",

            Notes:
              transaction.notes ||
              "",

            "Running Balance":
              Number(
                runningBalance
              ),
          })
        );

      const itemRows =
        itemSummary.map(
          (item) => ({
            Item:
              item.itemName,

            "Total Quantity":
              item.quantity,

            "Amount Before VAT":
              item.amountBeforeVat,

            VAT:
              item.vatAmount,

            "Total Amount":
              item.totalAmount,
          })
        );

      itemRows.push({
        Item: "TOTAL",

        "Total Quantity":
          itemSummaryTotals.quantity,

        "Amount Before VAT":
          itemSummaryTotals.amountBeforeVat,

        VAT:
          itemSummaryTotals.vatAmount,

        "Total Amount":
          itemSummaryTotals.totalAmount,
      });

      const summaryRows = [
        {
          "SUPPLIER REPORT":
            COMPANY_NAME,
        },

        {
          Supplier:
            selectedSupplier.supplier_name,
        },

        {
          Phone:
            selectedSupplier.phone ||
            "",
        },

        {
          "VAT Number":
            selectedSupplier.vat_number ||
            "",
        },

        {
          "Credit Terms":
            selectedSupplier.credit_terms ||
            "",
        },

        {
          "Report From":
            fromDate ||
            "Beginning",
        },

        {
          "Report To":
            toDate ||
            "Present",
        },

        {},

        {
          "Opening Balance":
            report.openingBalance,
        },

        {
          "Total Purchases":
            report.purchases,
        },

        {
          "Total Payments":
            report.payments,
        },

        {
          "Total Debit":
            report.debit,
        },

        {
          "Total Credit":
            report.credit,
        },

        {
          "Current Balance":
            report.finalBalance,
        },

        {},

        {
          "TRANSACTION LEDGER":
            "Complete Supplier Transactions",
        },
      ];

      const worksheet =
        XLSX.utils.json_to_sheet(
          summaryRows
        );

      XLSX.utils.sheet_add_json(
        worksheet,
        excelRows,
        {
          origin: "A17",
        }
      );

      const itemStartRow =
        19 +
        excelRows.length;

      XLSX.utils.sheet_add_json(
        worksheet,
        itemRows,
        {
          origin: `A${itemStartRow}`,
        }
      );

      worksheet["!cols"] = [
        {
          width: 16,
        },

        {
          width: 14,
        },

        {
          width: 16,
        },

        {
          width: 18,
        },

        {
          width: 28,
        },

        {
          width: 14,
        },

        {
          width: 16,
        },

        {
          width: 10,
        },

        {
          width: 16,
        },

        {
          width: 18,
        },

        {
          width: 16,
        },

        {
          width: 16,
        },

        {
          width: 18,
        },

        {
          width: 35,
        },

        {
          width: 35,
        },

        {
          width: 18,
        },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Supplier Ledger"
      );

      const safeName =
        selectedSupplier.supplier_name.replace(
          /[^a-zA-Z0-9-_]/g,
          "_"
        );

      XLSX.writeFile(
        workbook,
        `Supplier_Report_${safeName}.xlsx`
      );
    } catch (error) {
      console.error(
        "Excel export error:",
        error
      );

      alert(
        "Unable to generate Excel report."
      );
    }
  }

  // ============================================================
  // NEON STYLES - MATCHING DASHBOARD
  // ============================================================

  const pageStyle: CSSProperties = {
    minHeight: "100%",
    width: "100%",
    boxSizing: "border-box",
    padding: "16px",
    background: "#000000",
    color: "#ffffff",
  };

  const loadingStyle: CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000000",
    color: "#67e8f9",
    fontSize: "15px",
    fontWeight: 700,
    textShadow: "0 0 20px rgba(34,211,238,0.2)",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    gap: "12px",
    flexWrap: "wrap",
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    color: "#22d3ee",
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "2px",
    textShadow: "0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.15)",
    textTransform: "uppercase",
  };

  const subtitleStyle: CSSProperties = {
    margin: "4px 0 0",
    color: "#67e8f9",
    fontSize: "13px",
    textShadow: "0 0 15px rgba(34,211,238,0.15)",
    opacity: 0.8,
    letterSpacing: "0.5px",
  };

  const headerActionsStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  };

  const supplierCountStyle: CSSProperties = {
    padding: "9px 16px",
    borderRadius: "8px",
    background: "rgba(11,18,32,0.6)",
    border: "1px solid rgba(34,211,238,0.15)",
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: 800,
    boxShadow: "0 0 15px rgba(34,211,238,0.05)",
    backdropFilter: "blur(10px)",
  };

  const addSupplierButtonStyle: CSSProperties = {
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))",
    color: "#67e8f9",
    fontWeight: 900,
    fontSize: "11px",
    cursor: "pointer",
    border: "1px solid rgba(34,211,238,0.25)",
    boxShadow: "0 0 20px rgba(34,211,238,0.08), 0 0 40px rgba(34,211,238,0.03)",
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)",
  };

  const panelStyle: CSSProperties = {
    background: "linear-gradient(145deg, rgba(15,26,46,0.7), rgba(10,20,37,0.7))",
    border: "1px solid rgba(34,211,238,0.08)",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 0 20px rgba(34,211,238,0.03), inset 0 0 30px rgba(34,211,238,0.01)",
  };

  const sectionTitleStyle: CSSProperties = {
    margin: 0,
    color: "#60a5fa",
    fontSize: "15px",
    fontWeight: 800,
    textShadow: "0 0 20px rgba(96,165,250,0.15)",
  };

  const sectionSubtitleStyle: CSSProperties = {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: "10px",
  };

  const managementHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  };

  const supplierSearchStyle: CSSProperties = {
    width: "260px",
    height: "36px",
    padding: "0 12px",
    boxSizing: "border-box",
    background: "rgba(11,18,32,0.8)",
    color: "#ffffff",
    border: "1px solid rgba(34,211,238,0.15)",
    borderRadius: "6px",
    outline: "none",
    fontSize: "11px",
    transition: "all 0.3s ease",
  };

  const supplierCardsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  };

  const supplierCardStyle: CSSProperties = {
    background: "linear-gradient(145deg, rgba(11,18,32,0.6), rgba(17,24,39,0.4))",
    border: "1px solid rgba(34,211,238,0.08)",
    borderRadius: "10px",
    padding: "14px",
    transition: "all 0.3s ease",
    backdropFilter: "blur(10px)",
  };

  const supplierCardTopStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
  };

  const supplierNameStyle: CSSProperties = {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 900,
    textShadow: "0 0 10px rgba(34,211,238,0.05)",
  };

  const supplierMetaStyle: CSSProperties = {
    marginTop: "3px",
    color: "#475569",
    fontSize: "8px",
  };

  const supplierBalanceBadgeStyle: CSSProperties = {
    padding: "5px 10px",
    borderRadius: "5px",
    background: "rgba(245,158,11,0.1)",
    color: "#f59e0b",
    fontSize: "8px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    border: "1px solid rgba(245,158,11,0.1)",
  };

  const supplierDetailsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "7px",
    marginTop: "12px",
    paddingTop: "10px",
    borderTop: "1px solid rgba(34,211,238,0.06)",
  };

  const smallLabelStyle: CSSProperties = {
    display: "block",
    color: "#475569",
    fontSize: "7px",
    fontWeight: 800,
    marginBottom: "3px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const supplierCardActionsStyle: CSSProperties = {
    display: "flex",
    gap: "5px",
    marginTop: "12px",
  };

  const viewSupplierButtonStyle: CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: "5px",
    padding: "7px",
    background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))",
    color: "#67e8f9",
    fontSize: "8px",
    fontWeight: 800,
    cursor: "pointer",
    border: "1px solid rgba(34,211,238,0.15)",
    transition: "all 0.3s ease",
  };

  const editButtonStyle: CSSProperties = {
    border: "1px solid rgba(34,211,238,0.1)",
    borderRadius: "5px",
    padding: "7px 9px",
    background: "rgba(30,41,59,0.4)",
    color: "#cbd5e1",
    fontSize: "8px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const deleteButtonStyle: CSSProperties = {
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "5px",
    padding: "7px 9px",
    background: "rgba(239,68,68,0.08)",
    color: "#f87171",
    fontSize: "8px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const noSupplierStyle: CSSProperties = {
    gridColumn: "1 / -1",
    padding: "30px",
    textAlign: "center",
    color: "#64748b",
  };

  const formGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "14px",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 12px",
    boxSizing: "border-box",
    background: "rgba(11,18,32,0.8)",
    color: "#ffffff",
    border: "1px solid rgba(34,211,238,0.15)",
    borderRadius: "6px",
    outline: "none",
    fontSize: "12px",
    transition: "all 0.3s ease",
  };

  const buttonRowStyle: CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "14px",
    flexWrap: "wrap",
  };

  const clearButtonStyle: CSSProperties = {
    border: "1px solid rgba(34,211,238,0.1)",
    borderRadius: "7px",
    padding: "9px 16px",
    background: "rgba(30,41,59,0.4)",
    color: "#cbd5e1",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const pdfButtonStyle: CSSProperties = {
    border: "none",
    borderRadius: "7px",
    padding: "9px 16px",
    background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.2))",
    color: "#fca5a5",
    fontWeight: 800,
    cursor: "pointer",
    border: "1px solid rgba(239,68,68,0.2)",
    transition: "all 0.3s ease",
  };

  const excelButtonStyle: CSSProperties = {
    border: "none",
    borderRadius: "7px",
    padding: "9px 16px",
    background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(21,128,61,0.2))",
    color: "#86efac",
    fontWeight: 800,
    cursor: "pointer",
    border: "1px solid rgba(34,197,94,0.2)",
    transition: "all 0.3s ease",
  };

  const supplierInfoStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    background: "rgba(11,18,32,0.6)",
    border: "1px solid rgba(34,211,238,0.08)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "12px",
    backdropFilter: "blur(10px)",
  };

  const infoLabelStyle: CSSProperties = {
    display: "block",
    color: "#64748b",
    fontSize: "8px",
    fontWeight: 800,
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const summaryGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  };

  const ledgerHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap",
    gap: "8px",
  };

  const transactionCountStyle: CSSProperties = {
    color: "#67e8f9",
    fontSize: "11px",
    fontWeight: 800,
    padding: "5px 12px",
    borderRadius: "5px",
    background: "rgba(34,211,238,0.05)",
    border: "1px solid rgba(34,211,238,0.08)",
  };

  const tableContainerStyle: CSSProperties = {
    overflowX: "auto",
    border: "1px solid rgba(34,211,238,0.06)",
    borderRadius: "8px",
  };

  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "10px",
  };

  const thStyle: CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    color: "#67e8f9",
    fontWeight: 700,
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(34,211,238,0.06)",
    background: "rgba(11,18,32,0.5)",
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const thRightStyle: CSSProperties = {
    ...thStyle,
    textAlign: "right",
  };

  const tdStyle: CSSProperties = {
    padding: "7px 10px",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(34,211,238,0.04)",
    fontSize: "10px",
  };

  const tdRightStyle: CSSProperties = {
    ...tdStyle,
    textAlign: "right",
  };

  const emptyStyle: CSSProperties = {
    padding: "30px",
    textAlign: "center",
    color: "#64748b",
  };

  const totalsStyle: CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "30px",
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid rgba(34,211,238,0.06)",
    color: "#64748b",
    fontSize: "9px",
    fontWeight: 800,
    flexWrap: "wrap",
  };

  const emptySupplierStyle: CSSProperties = {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(145deg, rgba(17,24,39,0.5), rgba(11,18,32,0.5))",
    border: "1px solid rgba(34,211,238,0.06)",
    borderRadius: "12px",
    color: "#64748b",
    textAlign: "center",
    padding: "20px",
    backdropFilter: "blur(10px)",
  };

  const currentBalanceStyle: CSSProperties = {
    background: "linear-gradient(135deg, rgba(7,17,31,0.8), rgba(11,18,32,0.8))",
    border: "1px solid rgba(34,211,238,0.08)",
    borderRadius: "10px",
    padding: "18px",
    marginBottom: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    backdropFilter: "blur(10px)",
  };

  const currentBalanceLabelStyle: CSSProperties = {
    color: "#64748b",
    fontSize: "9px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const currentBalanceDescriptionStyle: CSSProperties = {
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: 700,
    marginTop: "4px",
  };

  const currentBalanceRightStyle: CSSProperties = {
    textAlign: "right",
  };

  const footerStyle: CSSProperties = {
    marginTop: "12px",
    textAlign: "right",
    color: "#475569",
    fontSize: "9px",
  };

  const modalOverlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
    backdropFilter: "blur(10px)",
  };

  const modalStyle: CSSProperties = {
    width: "min(620px, 100%)",
    background: "linear-gradient(145deg, rgba(11,18,32,0.95), rgba(17,24,39,0.95))",
    border: "1px solid rgba(34,211,238,0.12)",
    borderRadius: "12px",
    boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.03)",
    overflow: "hidden",
    backdropFilter: "blur(20px)",
  };

  const modalHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "18px 20px",
    borderBottom: "1px solid rgba(34,211,238,0.06)",
  };

  const modalTitleStyle: CSSProperties = {
    margin: 0,
    color: "#22d3ee",
    fontSize: "17px",
    fontWeight: 900,
    textShadow: "0 0 20px rgba(34,211,238,0.15)",
  };

  const modalSubtitleStyle: CSSProperties = {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "10px",
  };

  const modalCloseButtonStyle: CSSProperties = {
    border: "1px solid rgba(34,211,238,0.1)",
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    background: "rgba(30,41,59,0.4)",
    color: "#cbd5e1",
    fontSize: "20px",
    lineHeight: "20px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const modalFormGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "13px",
    padding: "18px 20px",
  };

  const modalFooterStyle: CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "15px 20px",
    borderTop: "1px solid rgba(34,211,238,0.06)",
    background: "rgba(11,18,32,0.5)",
  };

  const modalCancelButtonStyle: CSSProperties = {
    border: "1px solid rgba(34,211,238,0.1)",
    borderRadius: "7px",
    padding: "9px 15px",
    background: "rgba(30,41,59,0.4)",
    color: "#cbd5e1",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.3s ease",
  };

  const modalSaveButtonStyle: CSSProperties = {
    border: "none",
    borderRadius: "7px",
    padding: "9px 18px",
    background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))",
    color: "#67e8f9",
    fontWeight: 900,
    cursor: "pointer",
    border: "1px solid rgba(34,211,238,0.2)",
    boxShadow: "0 0 20px rgba(34,211,238,0.05)",
    transition: "all 0.3s ease",
  };

  if (loading) {
    return (
      <div style={loadingStyle}>
        LOADING SUPPLIERS...
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* HEADER */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>✦ SUPPLIERS</h1>
          <p style={subtitleStyle}>Supplier management, purchases, payments and complete supplier ledger</p>
        </div>

        <div style={headerActionsStyle}>
          <div style={supplierCountStyle}>
            TOTAL: {suppliers.length}
          </div>

          <button
            type="button"
            onClick={openAddSupplier}
            style={addSupplierButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 40px rgba(34,211,238,0.2), 0 0 80px rgba(34,211,238,0.05)";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.08), 0 0 40px rgba(34,211,238,0.03)";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.25)";
            }}
          >
            + ADD SUPPLIER
          </button>
        </div>
      </div>

      {/* SUPPLIER DIRECTORY */}
      <div style={panelStyle}>
        <div style={managementHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>SUPPLIER DIRECTORY</h2>
            <p style={sectionSubtitleStyle}>Manage your suppliers and supplier account information</p>
          </div>

          <input
            type="text"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            placeholder="🔍 Search supplier..."
            style={supplierSearchStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
              e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={supplierCardsGridStyle}>
          {visibleSuppliers.length === 0 ? (
            <div style={noSupplierStyle}>No suppliers found.</div>
          ) : (
            visibleSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                style={{
                  ...supplierCardStyle,
                  borderColor: selectedSupplierId === supplier.id
                    ? "rgba(34,211,238,0.3)"
                    : "rgba(34,211,238,0.06)",
                  boxShadow: selectedSupplierId === supplier.id
                    ? "0 0 25px rgba(34,211,238,0.05)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = selectedSupplierId === supplier.id
                    ? "rgba(34,211,238,0.3)"
                    : "rgba(34,211,238,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={supplierCardTopStyle}>
                  <div>
                    <div style={supplierNameStyle}>{supplier.supplier_name}</div>
                    <div style={supplierMetaStyle}>ID #{supplier.id}</div>
                  </div>

                  <div style={supplierBalanceBadgeStyle}>
                    {formatAmount(Number(supplier.opening_balance || 0))} SAR
                  </div>
                </div>

                <div style={supplierDetailsGridStyle}>
                  <div>
                    <span style={smallLabelStyle}>PHONE</span>
                    <strong>{supplier.phone || "-"}</strong>
                  </div>
                  <div>
                    <span style={smallLabelStyle}>VAT</span>
                    <strong>{supplier.vat_number || "-"}</strong>
                  </div>
                  <div>
                    <span style={smallLabelStyle}>TERMS</span>
                    <strong>{supplier.credit_terms || "-"}</strong>
                  </div>
                </div>

                <div style={supplierCardActionsStyle}>
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierId(supplier.id)}
                    style={viewSupplierButtonStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    VIEW LEDGER
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditSupplier(supplier)}
                    style={editButtonStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(34,211,238,0.1)";
                    }}
                  >
                    EDIT
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteSupplier(supplier)}
                    style={deleteButtonStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                      e.currentTarget.style.background = "rgba(239,68,68,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                      e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                    }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* REPORT FILTERS */}
      <div style={panelStyle}>
        <h2 style={sectionTitleStyle}>SUPPLIER REPORT</h2>

        <div style={formGridStyle}>
          <Field label="SELECT SUPPLIER">
            <select
              value={selectedSupplierId === "" ? "" : String(selectedSupplierId)}
              onChange={(e) =>
                setSelectedSupplierId(e.target.value ? Number(e.target.value) : "")
              }
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="FROM DATE">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </Field>

          <Field label="TO DATE">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </Field>

          <Field label="SEARCH LEDGER">
            <input
              type="text"
              placeholder="🔍 Item, description, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </Field>
        </div>

        <div style={buttonRowStyle}>
          <button
            type="button"
            onClick={clearFilters}
            style={clearButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.1)";
            }}
          >
            CLEAR FILTERS
          </button>

          <button
            type="button"
            onClick={exportExcel}
            disabled={!selectedSupplier || filteredTransactions.length === 0}
            style={{
              ...excelButtonStyle,
              opacity: !selectedSupplier || filteredTransactions.length === 0 ? 0.4 : 1,
              cursor: !selectedSupplier || filteredTransactions.length === 0 ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (selectedSupplier && filteredTransactions.length > 0) {
                e.currentTarget.style.boxShadow = "0 0 25px rgba(34,197,94,0.15)";
                e.currentTarget.style.borderColor = "rgba(34,197,94,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(34,197,94,0.2)";
            }}
          >
            📊 EXPORT EXCEL
          </button>

          <button
            type="button"
            onClick={exportPDF}
            disabled={exporting || !selectedSupplier || filteredTransactions.length === 0}
            style={{
              ...pdfButtonStyle,
              opacity: exporting || !selectedSupplier || filteredTransactions.length === 0 ? 0.4 : 1,
              cursor: exporting || !selectedSupplier || filteredTransactions.length === 0 ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (selectedSupplier && filteredTransactions.length > 0 && !exporting) {
                e.currentTarget.style.boxShadow = "0 0 25px rgba(239,68,68,0.15)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
            }}
          >
            {exporting ? "GENERATING PDF..." : "📄 EXPORT PDF"}
          </button>
        </div>
      </div>

      {/* SELECTED SUPPLIER */}
      {selectedSupplier && (
        <>
          {/* SUPPLIER INFO */}
          <div style={supplierInfoStyle}>
            <div>
              <span style={infoLabelStyle}>SUPPLIER</span>
              <strong style={{ color: "#ffffff" }}>{selectedSupplier.supplier_name}</strong>
            </div>
            <div>
              <span style={infoLabelStyle}>PHONE</span>
              <strong style={{ color: "#cbd5e1" }}>{selectedSupplier.phone || "-"}</strong>
            </div>
            <div>
              <span style={infoLabelStyle}>VAT NUMBER</span>
              <strong style={{ color: "#cbd5e1" }}>{selectedSupplier.vat_number || "-"}</strong>
            </div>
            <div>
              <span style={infoLabelStyle}>CREDIT / PAYMENT TERMS</span>
              <strong style={{ color: "#cbd5e1" }}>{selectedSupplier.credit_terms || "-"}</strong>
            </div>
          </div>

          {/* SUMMARY CARDS */}
          <div style={summaryGridStyle}>
            <SummaryCard title="OPENING BALANCE" value={report.openingBalance} color="#38bdf8" />
            <SummaryCard title="TOTAL PURCHASES" value={report.purchases} color="#f59e0b" />
            <SummaryCard title="TOTAL PAYMENTS" value={report.payments} color="#22c55e" />
            <SummaryCard title="CURRENT BALANCE" value={report.finalBalance} color={report.finalBalance > 0 ? "#f59e0b" : "#22c55e"} />
          </div>

          {/* COMPLETE LEDGER */}
          <div style={panelStyle}>
            <div style={ledgerHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>COMPLETE SUPPLIER LEDGER</h2>
                <p style={sectionSubtitleStyle}>Purchases, payments, quantities, VAT, amounts and running balance</p>
              </div>
              <div style={transactionCountStyle}>
                {filteredTransactions.length} TRANSACTIONS
              </div>
            </div>

            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {[
                      "DATE", "TYPE", "REF", "ITEM", "QTY",
                      "UNIT PRICE", "VAT %", "VAT AMT", "TOTAL",
                      "DEBIT", "CREDIT", "METHOD", "BALANCE",
                      "DESCRIPTION", "NOTES"
                    ].map((heading, index) => (
                      <th key={heading} style={index >= 4 ? thRightStyle : thStyle}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={emptyStyle}>
                        No transactions found for this supplier.
                      </td>
                    </tr>
                  ) : (
                    calculateRunningBalances().map(({ transaction, runningBalance }) => (
                      <tr
                        key={transaction.id}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(34,211,238,0.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td style={tdStyle}>{formatDate(transaction.transaction_date)}</td>

                        <td style={{
                          ...tdStyle,
                          color: transaction.transaction_type === "PURCHASE" ? "#f59e0b" : "#22c55e",
                          fontWeight: 800,
                        }}>
                          {getTransactionLabel(transaction)}
                        </td>

                        <td style={tdStyle}>{transaction.reference_id || "-"}</td>

                        <td style={{ ...tdStyle, color: "#ffffff", fontWeight: 700 }}>
                          {getItemName(transaction.item_id)}
                        </td>

                        <td style={tdRightStyle}>
                          {transaction.quantity ? Number(transaction.quantity).toLocaleString() : "-"}
                        </td>

                        <td style={tdRightStyle}>
                          {transaction.unit_price ? formatAmount(Number(transaction.unit_price)) : "-"}
                        </td>

                        <td style={tdRightStyle}>
                          {transaction.vat_percent ? `${transaction.vat_percent}%` : "-"}
                        </td>

                        <td style={tdRightStyle}>
                          {getVatAmount(transaction) ? formatAmount(getVatAmount(transaction)) : "-"}
                        </td>

                        <td style={{ ...tdRightStyle, color: "#38bdf8", fontWeight: 800 }}>
                          {getTransactionTotal(transaction) ? formatAmount(getTransactionTotal(transaction)) : "-"}
                        </td>

                        <td style={{ ...tdRightStyle, color: "#22c55e", fontWeight: 800 }}>
                          {transaction.debit ? formatAmount(Number(transaction.debit)) : "-"}
                        </td>

                        <td style={{ ...tdRightStyle, color: "#f59e0b", fontWeight: 800 }}>
                          {transaction.credit ? formatAmount(Number(transaction.credit)) : "-"}
                        </td>

                        <td style={tdStyle}>{transaction.payment_method || "-"}</td>

                        <td style={{
                          ...tdRightStyle,
                          color: runningBalance > 0 ? "#f59e0b" : "#22c55e",
                          fontWeight: 900,
                        }}>
                          {formatAmount(runningBalance)}
                        </td>

                        <td style={tdStyle}>{transaction.description || "-"}</td>

                        <td style={tdStyle}>{transaction.notes || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={totalsStyle}>
              <div>
                TOTAL DEBIT
                <strong style={{ color: "#22c55e", marginLeft: "6px" }}>
                  {formatAmount(report.debit)} SAR
                </strong>
              </div>
              <div>
                TOTAL CREDIT
                <strong style={{ color: "#f59e0b", marginLeft: "6px" }}>
                  {formatAmount(report.credit)} SAR
                </strong>
              </div>
              <div>
                FINAL BALANCE
                <strong style={{
                  color: report.finalBalance > 0 ? "#f59e0b" : "#22c55e",
                  marginLeft: "6px",
                }}>
                  {formatAmount(report.finalBalance)} SAR
                </strong>
              </div>
            </div>
          </div>

          {/* ITEM PURCHASE SUMMARY */}
          <div style={panelStyle}>
            <div style={{ marginBottom: "12px" }}>
              <h2 style={sectionTitleStyle}>TOTAL ITEM PURCHASE SUMMARY</h2>
              <p style={sectionSubtitleStyle}>Total purchased quantity and amount grouped by item name</p>
            </div>

            <div style={tableContainerStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ITEM NAME</th>
                    <th style={thRightStyle}>TOTAL QTY</th>
                    <th style={thRightStyle}>AMOUNT BEFORE VAT</th>
                    <th style={thRightStyle}>VAT</th>
                    <th style={thRightStyle}>TOTAL AMOUNT</th>
                  </tr>
                </thead>

                <tbody>
                  {itemSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={emptyStyle}>No purchase items found.</td>
                    </tr>
                  ) : (
                    <>
                      {itemSummary.map((item) => (
                        <tr key={item.itemName}>
                          <td style={{ ...tdStyle, color: "#ffffff", fontWeight: 700 }}>
                            {item.itemName}
                          </td>
                          <td style={tdRightStyle}>{item.quantity.toLocaleString()}</td>
                          <td style={tdRightStyle}>{formatAmount(item.amountBeforeVat)} SAR</td>
                          <td style={tdRightStyle}>{formatAmount(item.vatAmount)} SAR</td>
                          <td style={{ ...tdRightStyle, color: "#38bdf8", fontWeight: 800 }}>
                            {formatAmount(item.totalAmount)} SAR
                          </td>
                        </tr>
                      ))}

                      <tr style={{ background: "rgba(11,18,32,0.5)" }}>
                        <td style={{ ...tdStyle, color: "#67e8f9", fontWeight: 900 }}>TOTAL</td>
                        <td style={{ ...tdRightStyle, color: "#67e8f9", fontWeight: 900 }}>
                          {itemSummaryTotals.quantity.toLocaleString()}
                        </td>
                        <td style={{ ...tdRightStyle, color: "#67e8f9", fontWeight: 900 }}>
                          {formatAmount(itemSummaryTotals.amountBeforeVat)} SAR
                        </td>
                        <td style={{ ...tdRightStyle, color: "#67e8f9", fontWeight: 900 }}>
                          {formatAmount(itemSummaryTotals.vatAmount)} SAR
                        </td>
                        <td style={{ ...tdRightStyle, color: "#67e8f9", fontWeight: 900 }}>
                          {formatAmount(itemSummaryTotals.totalAmount)} SAR
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CURRENT BALANCE */}
          <div style={currentBalanceStyle}>
            <div>
              <div style={currentBalanceLabelStyle}>SUPPLIER ACCOUNT SUMMARY</div>
              <div style={currentBalanceDescriptionStyle}>Opening + Purchases - Payments</div>
            </div>
            <div style={currentBalanceRightStyle}>
              <div style={currentBalanceLabelStyle}>CURRENT BALANCE</div>
              <div style={{
                marginTop: "3px",
                color: report.finalBalance > 0 ? "#f59e0b" : "#22c55e",
                fontSize: "22px",
                fontWeight: 900,
                textShadow: `0 0 30px ${report.finalBalance > 0 ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}`,
              }}>
                {formatAmount(report.finalBalance)} SAR
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedSupplier && (
        <div style={emptySupplierStyle}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>📊</div>
          <h2 style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: "18px" }}>Select a Supplier</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            Select a supplier above to view the complete supplier ledger, purchase summary and account balance.
          </p>
        </div>
      )}

      <div style={footerStyle}>
        {COMPANY_NAME} • Supplier Management & Ledger
      </div>

      {/* MODAL */}
      {showSupplierModal && (
        <div style={modalOverlayStyle} onClick={closeSupplierModal}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>
                  {editingSupplier ? "✏️ EDIT SUPPLIER" : "✨ ADD SUPPLIER"}
                </h2>
                <p style={modalSubtitleStyle}>Enter supplier account information</p>
              </div>
              <button
                type="button"
                onClick={closeSupplierModal}
                style={modalCloseButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                  e.currentTarget.style.color = "#f87171";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.1)";
                  e.currentTarget.style.color = "#cbd5e1";
                }}
              >
                ×
              </button>
            </div>

            <div style={modalFormGridStyle}>
              <Field label="SUPPLIER NAME *">
                <input
                  type="text"
                  value={supplierForm.supplier_name}
                  onChange={(e) =>
                    setSupplierForm((previous) => ({
                      ...previous,
                      supplier_name: e.target.value,
                    }))
                  }
                  placeholder="Supplier name"
                  style={inputStyle}
                  autoFocus
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </Field>

              <Field label="PHONE">
                <input
                  type="text"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm((previous) => ({
                      ...previous,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+966..."
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </Field>

              <Field label="VAT NUMBER">
                <input
                  type="text"
                  value={supplierForm.vat_number}
                  onChange={(e) =>
                    setSupplierForm((previous) => ({
                      ...previous,
                      vat_number: e.target.value,
                    }))
                  }
                  placeholder="VAT number"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </Field>

              <Field label="OPENING BALANCE">
                <input
                  type="number"
                  step="0.01"
                  value={supplierForm.opening_balance}
                  onChange={(e) =>
                    setSupplierForm((previous) => ({
                      ...previous,
                      opening_balance: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="CREDIT / PAYMENT TERMS">
                  <input
                    type="text"
                    value={supplierForm.credit_terms}
                    onChange={(e) =>
                      setSupplierForm((previous) => ({
                        ...previous,
                        credit_terms: e.target.value,
                      }))
                    }
                    placeholder="Example: 30 Days, Cash, 60 Days..."
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                      e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </Field>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <button
                type="button"
                onClick={closeSupplierModal}
                disabled={savingSupplier}
                style={modalCancelButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.1)";
                }}
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={saveSupplier}
                disabled={savingSupplier}
                style={{
                  ...modalSaveButtonStyle,
                  opacity: savingSupplier ? 0.6 : 1,
                  cursor: savingSupplier ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!savingSupplier) {
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
                }}
              >
                {savingSupplier
                  ? "SAVING..."
                  : editingSupplier
                    ? "UPDATE SUPPLIER"
                    : "SAVE SUPPLIER"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", color: "#94a3b8", fontSize: "9px", fontWeight: 800 }}>
      {label}
      <div style={{ marginTop: "5px" }}>{children}</div>
    </label>
  );
}

function SummaryCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, rgba(17,24,39,0.6), rgba(11,18,32,0.6))",
      border: "1px solid rgba(34,211,238,0.06)",
      borderRadius: "10px",
      padding: "14px",
      boxShadow: `0 0 20px ${color}10, inset 0 0 20px ${color}03`,
      backdropFilter: "blur(10px)",
    }}>
      <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </div>
      <div style={{
        marginTop: "6px",
        color: color,
        fontSize: "19px",
        fontWeight: 900,
        textShadow: `0 0 20px ${color}20`,
      }}>
        {Number(value || 0).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
      </div>
    </div>
  );
}

export default Suppliers;