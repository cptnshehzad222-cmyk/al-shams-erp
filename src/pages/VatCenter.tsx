import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type VatTransaction = {
  id: number;
  transaction_date: string;
  source_type: string | null;
  source_id: number | null;
  document_number: string | null;
  branch_id: number | null;
  party_name: string | null;
  vat_type: string | null;
  taxable_amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  vat_direction: string | null;
  adjustment_type: string | null;
  original_document_number: string | null;
  vat_period_id: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
};

type VatPeriod = {
  id: number;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  due_date: string | null;
  status: string;
  output_vat: number | null;
  input_vat: number | null;
  adjustment_vat: number | null;
  vat_payable: number | null;
  vat_receivable: number | null;
};

type ReturnRow = {
  id: number | string;
  date: string;
  total: number;
  taxable: number;
  vat: number;
  vatRate: number;
  source: "sales_return" | "purchase_return";
  document: string | null;
  party: string | null;
};

type SourceVatRow = {
  id: number;
  date: string;
  source: string;
  document: string | null;
  party: string | null;
  taxable: number;
  vatRate: number;
  vat: number;
  total: number;
  direction: "output" | "input";
  notes: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  sale: "Sales",
  sales: "Sales",
  purchase: "Purchases",
  purchases: "Purchases",
  expense: "Expenses",
  expenses: "Expenses",
  diesel: "Diesel",
  driver_expense: "Diesel",
  adjustment: "Adjustment",
};

const formatSAR = (value: number) =>
  new Intl.NumberFormat("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (date: string | null) => {
  if (!date) return "-";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-GB");
};

const getSourceLabel = (source: string | null) => {
  if (!source) return "Other";

  return (
    SOURCE_LABELS[source.toLowerCase()] ||
    source.charAt(0).toUpperCase() + source.slice(1)
  );
};

const getSourceClass = (source: string | null) => {
  const value = source?.toLowerCase();

  if (value === "sale" || value === "sales") {
    return "vat-source sales";
  }

  if (value === "purchase" || value === "purchases") {
    return "vat-source purchases";
  }

  if (
    value === "expense" ||
    value === "expenses" ||
    value === "diesel" ||
    value === "driver_expense"
  ) {
    return "vat-source expenses";
  }

  return "vat-source adjustment";
};

export default function VatCenter() {
  const [transactions, setTransactions] = useState<VatTransaction[]>([]);
  const [sourceVatRows, setSourceVatRows] = useState<SourceVatRow[]>([]);
  const [periods, setPeriods] = useState<VatPeriod[]>([]);
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "periods" | "report"
  >("overview");

  useEffect(() => {
    loadVatData();
  }, []);

  async function loadVatData() {
    try {
      setLoading(true);
      setError("");

      const [
        transactionResult,
        periodResult,
        salesResult,
        purchasesResult,
        expensesResult,
        dieselResult,
        salesReturnsResult,
        purchaseReturnsResult,
      ] = await Promise.all([
        supabase
          .from("vat_transactions")
          .select("*")
          .order("transaction_date", { ascending: false }),

        supabase
          .from("vat_periods")
          .select("*")
          .order("start_date", { ascending: false }),

        supabase
          .from("sales")
          .select(
            `
              id,
              sales_date,
              delivery_note_no,
              invoice_number,
              customer_name,
              quantity,
              unit_price,
              vat_percent,
              total_amount,
              notes
            `
          )
          .order("sales_date", { ascending: false }),

        supabase
          .from("purchases")
          .select(
            `
              id,
              purchase_date,
              invoice_number,
              document_number,
              supplier_name,
              quantity,
              unit_price,
              vat_percent,
              total_amount,
              notes
            `
          )
          .order("purchase_date", { ascending: false }),

        supabase
          .from("expenses")
          .select(
            `
              id,
              expense_date,
              category,
              person_vendor,
              amount,
              vat_applicable,
              vat_rate,
              vat_amount,
              total_amount,
              notes
            `
          )
          .order("expense_date", { ascending: false }),

        supabase
          .from("driver_expenses")
          .select(
            `
              id,
              expense_date,
              expense_type,
              vehicle,
              supplier_name,
              invoice_number,
              item_description,
              quantity,
              total_amount,
              vat_rate,
              vat_amount,
              amount_before_vat,
              notes
            `
          )
          .order("expense_date", { ascending: false }),

        supabase.from("sales_returns").select("*"),
        supabase.from("purchase_returns").select("*"),
      ]);

      if (transactionResult.error) {
        console.error(
          "VAT TRANSACTIONS ERROR:",
          transactionResult.error
        );
      }

      if (periodResult.error) {
        console.error("VAT PERIODS ERROR:", periodResult.error);
      }

      if (salesResult.error) {
        throw salesResult.error;
      }

      if (purchasesResult.error) {
        throw purchasesResult.error;
      }

      if (expensesResult.error) {
        throw expensesResult.error;
      }

      if (dieselResult.error) {
        throw dieselResult.error;
      }

      setTransactions(
        (transactionResult.data || []) as VatTransaction[]
      );

      setPeriods((periodResult.data || []) as VatPeriod[]);

      const rows: SourceVatRow[] = [];

      (salesResult.data || []).forEach((sale: any) => {
        const quantity = Number(sale.quantity || 0);
        const unitPrice = Number(sale.unit_price || 0);
        const vatRate = Number(sale.vat_percent || 0);
        const storedTotal = Number(sale.total_amount || 0);

        const calculatedTaxable = quantity * unitPrice;

        let taxable = calculatedTaxable;
        let vat = 0;
        let total = storedTotal || calculatedTaxable;

        if (vatRate > 0) {
          const expectedVat =
            calculatedTaxable * (vatRate / 100);

          const expectedTotal =
            calculatedTaxable + expectedVat;

          if (
            storedTotal > 0 &&
            Math.abs(storedTotal - expectedTotal) < 0.01
          ) {
            taxable = calculatedTaxable;
            vat = storedTotal - calculatedTaxable;
            total = storedTotal;
          } else if (storedTotal > calculatedTaxable) {
            taxable =
              storedTotal / (1 + vatRate / 100);

            vat = storedTotal - taxable;
            total = storedTotal;
          } else {
            taxable = calculatedTaxable;
            vat = expectedVat;
            total = expectedTotal;
          }
        } else {
          taxable = calculatedTaxable;
          vat = 0;
          total = storedTotal || calculatedTaxable;
        }

        rows.push({
          id: Number(sale.id),
          date: sale.sales_date,
          source: "sales",
          document:
            sale.invoice_number ||
            sale.delivery_note_no ||
            `SALE-${sale.id}`,
          party: sale.customer_name || null,
          taxable,
          vatRate,
          vat,
          total,
          direction: "output",
          notes: sale.notes || null,
        });
      });

      (purchasesResult.data || []).forEach((purchase: any) => {
        const quantity = Number(purchase.quantity || 0);
        const unitPrice = Number(purchase.unit_price || 0);
        const vatRate = Number(purchase.vat_percent || 0);
        const storedTotal = Number(purchase.total_amount || 0);

        const taxable = quantity * unitPrice;
        const vat = taxable * (vatRate / 100);

        const total =
          storedTotal > 0
            ? storedTotal
            : taxable + vat;

        rows.push({
          id: Number(purchase.id),
          date: purchase.purchase_date,
          source: "purchases",
          document:
            purchase.invoice_number ||
            purchase.document_number ||
            `PUR-${purchase.id}`,
          party: purchase.supplier_name || null,
          taxable,
          vatRate,
          vat,
          total,
          direction: "input",
          notes: purchase.notes || null,
        });
      });

      (expensesResult.data || []).forEach((expense: any) => {
        const amount = Number(expense.amount || 0);
        const vatRate = Number(expense.vat_rate || 0);
        const storedVat = Number(expense.vat_amount || 0);

        const vatApplicable =
          Boolean(expense.vat_applicable);

        const vat = vatApplicable
          ? storedVat > 0
            ? storedVat
            : amount * (vatRate / 100)
          : 0;

        const taxable = amount;

        const total =
          Number(expense.total_amount || 0) > 0
            ? Number(expense.total_amount)
            : taxable + vat;

        rows.push({
          id: Number(expense.id),
          date: expense.expense_date,
          source: "expenses",
          document: `EXP-${expense.id}`,
          party:
            expense.person_vendor ||
            expense.category ||
            null,
          taxable,
          vatRate,
          vat,
          total,
          direction: "input",
          notes: expense.notes || null,
        });
      });

      (dieselResult.data || []).forEach((diesel: any) => {
        const vatRate = Number(diesel.vat_rate || 0);
        const storedVat = Number(diesel.vat_amount || 0);

        const amountBeforeVat =
          Number(diesel.amount_before_vat || 0);

        const totalAmount =
          Number(diesel.total_amount || 0);

        const taxable =
          amountBeforeVat > 0
            ? amountBeforeVat
            : vatRate > 0 && totalAmount > 0
            ? totalAmount / (1 + vatRate / 100)
            : totalAmount;

        const vat =
          storedVat > 0
            ? storedVat
            : taxable * (vatRate / 100);

        const total =
          totalAmount > 0
            ? totalAmount
            : taxable + vat;

        rows.push({
          id: Number(diesel.id),
          date: diesel.expense_date,
          source: "diesel",
          document:
            diesel.invoice_number ||
            `DIESEL-${diesel.id}`,
          party:
            diesel.supplier_name ||
            diesel.vehicle ||
            diesel.expense_type ||
            null,
          taxable,
          vatRate,
          vat,
          total,
          direction: "input",
          notes:
            diesel.notes ||
            diesel.item_description ||
            null,
        });
      });

      const normalizedReturns: ReturnRow[] = [];

      const normalizeReturn = (
        item: any,
        source: "sales_return" | "purchase_return"
      ): ReturnRow => {
        const date =
          item.return_date ||
          item.sales_return_date ||
          item.purchase_return_date ||
          item.date ||
          item.created_at?.slice?.(0, 10) ||
          "";

        const vatRate = Number(
          item.vat_percent ??
            item.vat_rate ??
            item.tax_rate ??
            15
        );

        const rawTotal = Number(
          item.total_amount ??
            item.return_amount ??
            item.amount ??
            0
        );

        const rawTaxable = Number(
          item.taxable_amount ??
            item.amount_before_vat ??
            item.subtotal ??
            0
        );

        const taxable =
          rawTaxable > 0
            ? rawTaxable
            : vatRate > 0 && rawTotal > 0
            ? rawTotal / (1 + vatRate / 100)
            : rawTotal;

        const storedReturnVat = Number(
          item.vat_amount ??
            item.tax_amount ??
            0
        );

        const vat =
          storedReturnVat > 0
            ? storedReturnVat
            : taxable * (vatRate / 100);

        const total =
          rawTotal > 0
            ? rawTotal
            : taxable + vat;

        return {
          id:
            item.id ??
            `${source}-${Math.random()}`,
          date,
          total,
          taxable,
          vat,
          vatRate,
          source,
          document:
            item.invoice_number ||
            item.document_number ||
            item.return_number ||
            item.reference_number ||
            null,
          party:
            item.customer_name ||
            item.supplier_name ||
            item.party_name ||
            item.person_vendor ||
            null,
        };
      };

      if (!salesReturnsResult.error) {
        (salesReturnsResult.data || []).forEach(
          (item: any) => {
            normalizedReturns.push(
              normalizeReturn(
                item,
                "sales_return"
              )
            );
          }
        );
      }

      if (!purchaseReturnsResult.error) {
        (purchaseReturnsResult.data || []).forEach(
          (item: any) => {
            normalizedReturns.push(
              normalizeReturn(
                item,
                "purchase_return"
              )
            );
          }
        );
      }

      setReturnRows(normalizedReturns);
      setSourceVatRows(rows);
    } catch (err: any) {
      console.error(
        "VAT CENTER LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load VAT data. Please check your Supabase connection."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredSourceVatRows = useMemo(() => {
    const searchText =
      search.trim().toLowerCase();

    return sourceVatRows.filter((row) => {
      const source =
        row.source.toLowerCase();

      let matchesSource = true;

      if (sourceFilter === "sales") {
        matchesSource =
          source === "sales";
      }

      if (sourceFilter === "purchases") {
        matchesSource =
          source === "purchases";
      }

      if (sourceFilter === "expenses") {
        matchesSource =
          source === "expenses";
      }

      if (sourceFilter === "diesel") {
        matchesSource =
          source === "diesel";
      }

      const matchesDirection =
        directionFilter === "all" ||
        row.direction ===
          directionFilter;

      const matchesFrom =
        !dateFrom ||
        row.date >= dateFrom;

      const matchesTo =
        !dateTo ||
        row.date <= dateTo;

      const matchesSearch =
        !searchText ||
        [
          row.document,
          row.party,
          row.source,
          row.notes,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(searchText)
          );

      return (
        matchesSource &&
        matchesDirection &&
        matchesFrom &&
        matchesTo &&
        matchesSearch
      );
    });
  }, [
    sourceVatRows,
    search,
    sourceFilter,
    directionFilter,
    dateFrom,
    dateTo,
  ]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) => {
        const source =
          transaction.source_type?.toLowerCase() ||
          "";

        let matchesSource = true;

        if (sourceFilter === "sales") {
          matchesSource =
            source === "sale" ||
            source === "sales";
        }

        if (sourceFilter === "purchases") {
          matchesSource =
            source === "purchase" ||
            source === "purchases";
        }

        if (sourceFilter === "expenses") {
          matchesSource =
            source === "expense" ||
            source === "expenses";
        }

        if (sourceFilter === "diesel") {
          matchesSource =
            source === "diesel" ||
            source === "driver_expense";
        }

        if (sourceFilter === "adjustment") {
          matchesSource =
            source === "adjustment";
        }

        const matchesDirection =
          directionFilter === "all" ||
          transaction.vat_direction?.toLowerCase() ===
            directionFilter;

        const matchesFrom =
          !dateFrom ||
          transaction.transaction_date >=
            dateFrom;

        const matchesTo =
          !dateTo ||
          transaction.transaction_date <=
            dateTo;

        const searchText =
          search.trim().toLowerCase();

        const matchesSearch =
          !searchText ||
          [
            transaction.document_number,
            transaction.party_name,
            transaction.notes,
            transaction.source_type,
            transaction.vat_type,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(searchText)
            );

        return (
          matchesSource &&
          matchesDirection &&
          matchesFrom &&
          matchesTo &&
          matchesSearch
        );
      }
    );
  }, [
    transactions,
    search,
    sourceFilter,
    directionFilter,
    dateFrom,
    dateTo,
  ]);

  const summary = useMemo(() => {
    let salesVat = 0;
    let purchaseVat = 0;
    let expenseVat = 0;
    let dieselVat = 0;
    let adjustmentVat = 0;

    let salesTaxable = 0;
    let purchaseTaxable = 0;
    let expenseTaxable = 0;
    let dieselTaxable = 0;

    filteredSourceVatRows.forEach(
      (row) => {
        const vat =
          Number(row.vat || 0);

        const taxable =
          Number(row.taxable || 0);

        if (row.source === "sales") {
          salesVat += vat;
          salesTaxable += taxable;
        }

        if (row.source === "purchases") {
          purchaseVat += vat;
          purchaseTaxable += taxable;
        }

        if (row.source === "expenses") {
          expenseVat += vat;
          expenseTaxable += taxable;
        }

        if (row.source === "diesel") {
          dieselVat += vat;
          dieselTaxable += taxable;
        }
      }
    );

    transactions.forEach(
      (transaction) => {
        const source =
          transaction.source_type?.toLowerCase() ||
          "";

        if (source === "adjustment") {
          const vat =
            Number(
              transaction.vat_amount || 0
            );

          if (
            (!dateFrom ||
              transaction.transaction_date >=
                dateFrom) &&
            (!dateTo ||
              transaction.transaction_date <=
                dateTo)
          ) {
            adjustmentVat += vat;
          }
        }
      }
    );

    const totalInputVat =
      purchaseVat +
      expenseVat +
      dieselVat;

    const netVat =
      salesVat -
      totalInputVat +
      adjustmentVat;

    const vatPayable =
      netVat > 0
        ? netVat
        : 0;

    const vatReceivable =
      netVat < 0
        ? Math.abs(netVat)
        : 0;

    return {
      salesVat,
      purchaseVat,
      expenseVat,
      dieselVat,
      adjustmentVat,
      totalInputVat,
      vatPayable,
      vatReceivable,
      salesTaxable,
      purchaseTaxable,
      expenseTaxable,
      dieselTaxable,
      totalTransactions:
        filteredSourceVatRows.length,
    };
  }, [
    filteredSourceVatRows,
    transactions,
    dateFrom,
    dateTo,
  ]);

  const vatReport = useMemo(() => {
    const inPeriod = (
      date: string
    ) =>
      (!dateFrom ||
        date >= dateFrom) &&
      (!dateTo ||
        date <= dateTo);

    const rows =
      sourceVatRows.filter(
        (row) => inPeriod(row.date)
      );

    const returns =
      returnRows.filter(
        (row) => inPeriod(row.date)
      );

    const sales = rows.filter(
      (row) =>
        row.source === "sales"
    );

    const purchases = rows.filter(
      (row) =>
        row.source === "purchases"
    );

    const expenses = rows.filter(
      (row) =>
        row.source === "expenses"
    );

    const salesReturns =
      returns.filter(
        (row) =>
          row.source ===
          "sales_return"
      );

    const purchaseReturns =
      returns.filter(
        (row) =>
          row.source ===
          "purchase_return"
      );

    const sum = (
      items: { total: number }[]
    ) =>
      items.reduce(
        (total, item) =>
          total +
          Number(item.total || 0),
        0
      );

    const sumTaxable = (
      items: { taxable: number }[]
    ) =>
      items.reduce(
        (total, item) =>
          total +
          Number(item.taxable || 0),
        0
      );

    const sumVat = (
      items: { vat: number }[]
    ) =>
      items.reduce(
        (total, item) =>
          total +
          Number(item.vat || 0),
        0
      );

    const effectiveRate = (
      taxable: number,
      vat: number
    ) =>
      taxable > 0
        ? (vat / taxable) * 100
        : 0;

    const totalSales =
      sum(sales);

    const totalSalesReturned =
      sum(salesReturns);

    const taxableSales =
      sumTaxable(sales);

    const salesVat =
      sumVat(sales);

    const salesReturnVat =
      sumVat(salesReturns);

    const totalPurchases =
      sum(purchases);

    const totalPurchaseReturned =
      sum(purchaseReturns);

    const taxablePurchases =
      sumTaxable(purchases);

    const purchaseVat =
      sumVat(purchases);

    const purchaseReturnVat =
      sumVat(purchaseReturns);

    const taxableExpenses =
      sumTaxable(expenses);

    const expenseVat =
      sumVat(expenses);

    const totalInputVat =
      purchaseVat -
      purchaseReturnVat +
      expenseVat;

    const totalOutputVat =
      salesVat -
      salesReturnVat;

    const vatPayable =
      totalOutputVat -
      totalInputVat;

    return {
      totalSales,
      totalSalesReturned,
      taxableSales,
      salesVat,
      salesRate:
        effectiveRate(
          taxableSales,
          salesVat
        ),

      totalPurchases,
      totalPurchaseReturned,
      taxablePurchases,
      purchaseVat,
      purchaseReturnVat,
      purchaseRate:
        effectiveRate(
          taxablePurchases,
          purchaseVat
        ),

      taxableExpenses,
      expenseVat,
      expenseRate:
        effectiveRate(
          taxableExpenses,
          expenseVat
        ),

      totalInputVat,
      totalOutputVat,
      vatPayable,
      vatReceivable:
        vatPayable < 0
          ? Math.abs(vatPayable)
          : 0,

      returnRows: returns,
    };
  }, [
    sourceVatRows,
    returnRows,
    dateFrom,
    dateTo,
  ]);

  const reportRows = useMemo(
    () => [
      [
        "Total Sales of the Period",
        vatReport.totalSales,
      ],
      [
        "Total Sales Returned of the Period",
        vatReport.totalSalesReturned,
      ],
      [
        "Taxable Sales",
        vatReport.taxableSales,
      ],
      [
        "VAT % — Sales",
        vatReport.salesRate,
      ],
      [
        "Total Output VAT — Sales",
        vatReport.salesVat,
      ],
      [
        "Total Purchases of the Period",
        vatReport.totalPurchases,
      ],
      [
        "Total Purchase Returned of the Period",
        vatReport.totalPurchaseReturned,
      ],
      [
        "Taxable Purchase",
        vatReport.taxablePurchases,
      ],
      [
        "VAT % — Purchases",
        vatReport.purchaseRate,
      ],
      [
        "Total Input VAT — Purchases",
        vatReport.purchaseVat,
      ],
      [
        "Taxable Expenses",
        vatReport.taxableExpenses,
      ],
      [
        "VAT % — Expenses",
        vatReport.expenseRate,
      ],
      [
        "Total Input VAT — Expenses",
        vatReport.expenseVat,
      ],
      [
        "Total Input VAT",
        vatReport.totalInputVat,
      ],
      [
        "Total VAT Payable",
        vatReport.vatPayable,
      ],
    ],
    [vatReport]
  );

  const getReportPeriodLabel =
    () => {
      if (dateFrom && dateTo) {
        return `${formatDate(
          dateFrom
        )} to ${formatDate(dateTo)}`;
      }

      if (dateFrom) {
        return `From ${formatDate(
          dateFrom
        )}`;
      }

      if (dateTo) {
        return `Up to ${formatDate(
          dateTo
        )}`;
      }

      return "All available records";
    };

  const exportVatReportExcel =
    () => {
      try {
        const summarySheet = [
          [
            "AL SHAMS AL GHAYABA TRD EST.",
          ],
          ["VAT REPORT"],
          [
            `Period: ${getReportPeriodLabel()}`,
          ],
          [],
          [
            "VAT Report Summary",
            "Value",
            "Currency / Unit",
          ],
          ...reportRows.map(
            ([label, value]) => [
              label,
              Number(value),
              String(label).includes(
                "VAT %"
              )
                ? "%"
                : "SAR",
            ]
          ),
        ];

        const detailSheet = [
          [
            "Date",
            "Source",
            "Document",
            "Party",
            "Taxable Amount",
            "VAT %",
            "VAT Amount",
            "Total Amount",
          ],

          ...sourceVatRows
            .filter(
              (row) =>
                (!dateFrom ||
                  row.date >= dateFrom) &&
                (!dateTo ||
                  row.date <= dateTo)
            )
            .map((row) => [
              row.date,
              getSourceLabel(
                row.source
              ),
              row.document || "",
              row.party || "",
              Number(
                row.taxable || 0
              ),
              Number(
                row.vatRate || 0
              ),
              Number(
                row.vat || 0
              ),
              Number(
                row.total || 0
              ),
            ]),

          ...returnRows
            .filter(
              (row) =>
                (!dateFrom ||
                  row.date >= dateFrom) &&
                (!dateTo ||
                  row.date <= dateTo)
            )
            .map((row) => [
              row.date,
              row.source ===
              "sales_return"
                ? "Sales Return"
                : "Purchase Return",
              row.document || "",
              row.party || "",
              -Math.abs(
                Number(
                  row.taxable || 0
                )
              ),
              Number(
                row.vatRate || 0
              ),
              -Math.abs(
                Number(
                  row.vat || 0
                )
              ),
              -Math.abs(
                Number(
                  row.total || 0
                )
              ),
            ]),
        ];

        const workbook =
          XLSX.utils.book_new();

        const summaryWorksheet =
          XLSX.utils.aoa_to_sheet(
            summarySheet
          );

        const detailWorksheet =
          XLSX.utils.aoa_to_sheet(
            detailSheet
          );

        summaryWorksheet["!cols"] = [
          { wch: 42 },
          { wch: 18 },
          { wch: 20 },
        ];

        detailWorksheet["!cols"] = [
          { wch: 14 },
          { wch: 16 },
          { wch: 22 },
          { wch: 28 },
          { wch: 18 },
          { wch: 12 },
          { wch: 18 },
          { wch: 18 },
        ];

        XLSX.utils.book_append_sheet(
          workbook,
          summaryWorksheet,
          "VAT Report"
        );

        XLSX.utils.book_append_sheet(
          workbook,
          detailWorksheet,
          "Transactions"
        );

        XLSX.writeFile(
          workbook,
          `VAT_Report_${new Date()
            .toISOString()
            .slice(0, 10)}.xlsx`
        );
      } catch (err) {
        console.error(
          "VAT EXCEL EXPORT ERROR:",
          err
        );

        setError(
          "Unable to export Excel report."
        );
      }
    };

  // ============================================================
  // PDF EXPORT - SUMMARY ONLY (Fixed setTextColor)
  // ============================================================
  const exportVatSummaryPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = 18;

      // --- HEADER ---
      doc.setFillColor(10, 20, 40);
      doc.rect(0, 0, pageWidth, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("AL SHAMS AL GHAYABA TRD EST.", margin, 15);

      doc.setFontSize(14);
      doc.text("VAT SUMMARY REPORT", margin, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Period: ${getReportPeriodLabel()}`, pageWidth - margin, 28, { align: "right" });

      doc.setTextColor(30, 40, 60);
      y = 52;

      // --- SECTION: VAT SUMMARY ---
      doc.setFillColor(240, 245, 250);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 40, 60);
      doc.text("VAT RETURN SUMMARY", margin + 4, y + 6);
      y += 14;

      const totalOutput = vatReport.salesVat;
      const totalInput = vatReport.totalInputVat;
      const netVat = totalOutput - totalInput;
      const vatPayable = netVat > 0 ? netVat : 0;
      const vatReceivable = netVat < 0 ? Math.abs(netVat) : 0;

      const summaryData = [
        { label: "Total Sales (Output)", value: vatReport.totalSales, unit: "SAR" },
        { label: "Sales Returns", value: vatReport.totalSalesReturned, unit: "SAR" },
        { label: "Net Sales", value: vatReport.totalSales - vatReport.totalSalesReturned, unit: "SAR" },
        { label: "Taxable Sales", value: vatReport.taxableSales, unit: "SAR" },
        { label: "Output VAT Rate", value: vatReport.salesRate, unit: "%" },
        { label: "Output VAT", value: totalOutput, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Total Purchases (Input)", value: vatReport.totalPurchases, unit: "SAR" },
        { label: "Purchase Returns", value: vatReport.totalPurchaseReturned, unit: "SAR" },
        { label: "Net Purchases", value: vatReport.totalPurchases - vatReport.totalPurchaseReturned, unit: "SAR" },
        { label: "Taxable Purchases", value: vatReport.taxablePurchases, unit: "SAR" },
        { label: "Input VAT Rate", value: vatReport.purchaseRate, unit: "%" },
        { label: "Input VAT (Purchases)", value: vatReport.purchaseVat, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Taxable Expenses", value: vatReport.taxableExpenses, unit: "SAR" },
        { label: "Expense VAT Rate", value: vatReport.expenseRate, unit: "%" },
        { label: "Input VAT (Expenses)", value: vatReport.expenseVat, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Total Input VAT", value: totalInput, unit: "SAR" },
        { label: "Total Output VAT", value: totalOutput, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "NET VAT POSITION", value: netVat, unit: "SAR" },
        { label: "VAT Payable", value: vatPayable, unit: "SAR" },
        { label: "VAT Receivable", value: vatReceivable, unit: "SAR" },
      ];

      summaryData.forEach((item) => {
        if (y + 8 > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }

        if (item.label === "") {
          y += 4;
          return;
        }

        const isHighlight = item.label.includes("NET VAT") || 
                           item.label.includes("VAT Payable") || 
                           item.label.includes("VAT Receivable");
        const isBold = item.label.includes("Total Input VAT") || 
                       item.label.includes("Total Output VAT");

        if (isHighlight) {
          doc.setFillColor(255, 215, 0, 0.15);
          doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 9, 1, 1, "F");
        }

        doc.setDrawColor(220, 225, 230);
        doc.line(margin, y + 7, pageWidth - margin, y + 7);

        doc.setFont("helvetica", isBold || isHighlight ? "bold" : "normal");
        doc.setFontSize(isHighlight ? 10 : 8.5);
        
        // FIXED: Use setTextColor with proper arguments
        if (isHighlight) {
          doc.setTextColor(180, 130, 0);
        } else {
          doc.setTextColor(60, 70, 85);
        }

        doc.text(item.label, margin + 2, y + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(isHighlight ? 11 : 9);
        
        // FIXED: Use setTextColor with proper arguments
        if (isHighlight) {
          doc.setTextColor(180, 130, 0);
        } else {
          doc.setTextColor(20, 40, 70);
        }

        let displayValue = "";
        if (item.unit === "%") {
          displayValue = `${Number(item.value || 0).toFixed(2)}%`;
        } else if (item.unit === "SAR") {
          displayValue = `SAR ${formatSAR(Number(item.value || 0))}`;
        } else {
          displayValue = String(item.value);
        }

        doc.text(displayValue, pageWidth - margin - 2, y + 5, { align: "right" });

        y += 8;
      });

      doc.setDrawColor(200, 210, 220);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 130, 145);
      doc.text(`Generated: ${new Date().toLocaleString("en-SA")}`, margin, pageHeight - 7);
      doc.text("AL SHAMS ERP - VAT Summary Report", pageWidth - margin, pageHeight - 7, { align: "right" });

      doc.save(`VAT_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      console.error("VAT SUMMARY PDF EXPORT ERROR:", err);
      setError(`Unable to export PDF summary: ${err?.message || "Unknown error"}`);
    }
  };

  // ============================================================
  // PDF EXPORT - FULL REPORT (Fixed setTextColor)
  // ============================================================
  const exportVatFullReportPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = 18;

      doc.setFillColor(10, 20, 40);
      doc.rect(0, 0, pageWidth, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("AL SHAMS AL GHAYABA TRD EST.", margin, 15);

      doc.setFontSize(14);
      doc.text("VAT FULL REPORT", margin, 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Period: ${getReportPeriodLabel()}`, pageWidth - margin, 28, { align: "right" });

      doc.setTextColor(30, 40, 60);
      y = 52;

      doc.setFillColor(240, 245, 250);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 40, 60);
      doc.text("1. VAT RETURN SUMMARY", margin + 4, y + 6);
      y += 14;

      const totalOutput = vatReport.salesVat;
      const totalInput = vatReport.totalInputVat;
      const netVat = totalOutput - totalInput;
      const vatPayable = netVat > 0 ? netVat : 0;
      const vatReceivable = netVat < 0 ? Math.abs(netVat) : 0;

      const summaryData = [
        { label: "Total Sales (Output)", value: vatReport.totalSales, unit: "SAR" },
        { label: "Sales Returns", value: vatReport.totalSalesReturned, unit: "SAR" },
        { label: "Net Sales", value: vatReport.totalSales - vatReport.totalSalesReturned, unit: "SAR" },
        { label: "Taxable Sales", value: vatReport.taxableSales, unit: "SAR" },
        { label: "Output VAT Rate", value: vatReport.salesRate, unit: "%" },
        { label: "Output VAT", value: totalOutput, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Total Purchases (Input)", value: vatReport.totalPurchases, unit: "SAR" },
        { label: "Purchase Returns", value: vatReport.totalPurchaseReturned, unit: "SAR" },
        { label: "Net Purchases", value: vatReport.totalPurchases - vatReport.totalPurchaseReturned, unit: "SAR" },
        { label: "Taxable Purchases", value: vatReport.taxablePurchases, unit: "SAR" },
        { label: "Input VAT Rate", value: vatReport.purchaseRate, unit: "%" },
        { label: "Input VAT (Purchases)", value: vatReport.purchaseVat, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Taxable Expenses", value: vatReport.taxableExpenses, unit: "SAR" },
        { label: "Expense VAT Rate", value: vatReport.expenseRate, unit: "%" },
        { label: "Input VAT (Expenses)", value: vatReport.expenseVat, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "Total Input VAT", value: totalInput, unit: "SAR" },
        { label: "Total Output VAT", value: totalOutput, unit: "SAR" },
        { label: "", value: 0, unit: "" },
        { label: "NET VAT POSITION", value: netVat, unit: "SAR" },
        { label: "VAT Payable", value: vatPayable, unit: "SAR" },
        { label: "VAT Receivable", value: vatReceivable, unit: "SAR" },
      ];

      const halfData = Math.ceil(summaryData.length / 2);
      const leftCol = summaryData.slice(0, halfData);
      const rightCol = summaryData.slice(halfData);

      const colWidth = (pageWidth - margin * 2 - 10) / 2;

      const drawSummaryColumn = (data: any[], startX: number, colWidth: number) => {
        let localY = y;
        data.forEach((item) => {
          if (localY + 8 > pageHeight - 30) {
            // This would need page handling - simplified for now
          }

          if (item.label === "") {
            localY += 4;
            return;
          }

          const isHighlight = item.label.includes("NET VAT") || 
                             item.label.includes("VAT Payable") || 
                             item.label.includes("VAT Receivable");
          const isBold = item.label.includes("Total Input VAT") || 
                         item.label.includes("Total Output VAT");

          if (isHighlight) {
            doc.setFillColor(255, 215, 0, 0.12);
            doc.roundedRect(startX, localY - 2, colWidth - 4, 9, 1, 1, "F");
          }

          doc.setDrawColor(220, 225, 230);
          doc.line(startX, localY + 7, startX + colWidth - 4, localY + 7);

          doc.setFont("helvetica", isBold || isHighlight ? "bold" : "normal");
          doc.setFontSize(isHighlight ? 9 : 7.5);
          
          // FIXED: Use setTextColor with proper arguments
          if (isHighlight) {
            doc.setTextColor(180, 130, 0);
          } else {
            doc.setTextColor(60, 70, 85);
          }

          let label = item.label;
          if (label.length > 30) {
            label = label.substring(0, 28) + "…";
          }
          doc.text(label, startX + 2, localY + 5);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(isHighlight ? 10 : 8);
          
          // FIXED: Use setTextColor with proper arguments
          if (isHighlight) {
            doc.setTextColor(180, 130, 0);
          } else {
            doc.setTextColor(20, 40, 70);
          }

          let displayValue = "";
          if (item.unit === "%") {
            displayValue = `${Number(item.value || 0).toFixed(2)}%`;
          } else if (item.unit === "SAR") {
            displayValue = `SAR ${formatSAR(Number(item.value || 0))}`;
          } else {
            displayValue = String(item.value);
          }

          doc.text(displayValue, startX + colWidth - 6, localY + 5, { align: "right" });

          localY += 8;
        });
        return localY;
      };

      const leftY = drawSummaryColumn(leftCol, margin, colWidth);
      const rightY = drawSummaryColumn(rightCol, margin + colWidth + 5, colWidth);
      y = Math.max(leftY, rightY) + 6;

      if (y + 20 > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(240, 245, 250);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 40, 60);
      doc.text("2. VAT TRANSACTION DETAIL", margin + 4, y + 6);
      y += 14;

      const transactionRows = [
        ...sourceVatRows
          .filter(
            (row) =>
              (!dateFrom || row.date >= dateFrom) &&
              (!dateTo || row.date <= dateTo)
          )
          .map((row) => ({
            date: row.date,
            source: getSourceLabel(row.source),
            document: row.document || "-",
            party: row.party || "-",
            taxable: row.taxable,
            vatRate: row.vatRate,
            vat: row.vat,
            total: row.total,
            direction: row.direction,
          })),
        ...returnRows
          .filter(
            (row) =>
              (!dateFrom || row.date >= dateFrom) &&
              (!dateTo || row.date <= dateTo)
          )
          .map((row) => ({
            date: row.date,
            source: row.source === "sales_return" ? "Sales Return" : "Purchase Return",
            document: row.document || "-",
            party: row.party || "-",
            taxable: -Math.abs(row.taxable),
            vatRate: row.vatRate,
            vat: -Math.abs(row.vat),
            total: -Math.abs(row.total),
            direction: row.source === "sales_return" ? "output" : "input",
          })),
      ];

      if (transactionRows.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 130, 145);
        doc.text("No transactions found for the selected period.", margin + 4, y + 6);
      } else {
        const tableData = transactionRows.map((row) => [
          formatDate(row.date),
          row.source,
          row.document,
          row.party,
          `SAR ${formatSAR(row.taxable)}`,
          `${Number(row.vatRate || 0).toFixed(2)}%`,
          `SAR ${formatSAR(row.vat)}`,
          `SAR ${formatSAR(row.total)}`,
          row.direction,
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Date", "Source", "Document", "Party", "Taxable", "Rate", "VAT", "Total", "Direction"]],
          body: tableData,
          theme: "grid",
          styles: {
            fontSize: 6,
            cellPadding: 2,
            textColor: [50, 50, 60],
          },
          headStyles: {
            fillColor: [30, 50, 80],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: "bold",
          },
          alternateRowStyles: {
            fillColor: [245, 248, 250],
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 },
            2: { cellWidth: 30 },
            3: { cellWidth: 35 },
            4: { cellWidth: 25 },
            5: { cellWidth: 15 },
            6: { cellWidth: 25 },
            7: { cellWidth: 25 },
            8: { cellWidth: 20 },
          },
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setDrawColor(200, 210, 220);
              doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7);
              doc.setTextColor(120, 130, 145);
              doc.text(`Generated: ${new Date().toLocaleString("en-SA")}`, margin, pageHeight - 7);
              doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
            }
          },
        });
      }

      doc.save(`VAT_Full_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      console.error("VAT FULL REPORT PDF EXPORT ERROR:", err);
      setError(`Unable to export full PDF report: ${err?.message || "Unknown error"}`);
    }
  };

  const latestPeriod =
    periods.length > 0
      ? periods[0]
      : null;

  return (
    <div className="vat-center-page">
      <style>{`
        .vat-center-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top right,
              rgba(0, 170, 255, 0.08),
              transparent 30%
            ),
            radial-gradient(
              circle at bottom left,
              rgba(0, 255, 170, 0.05),
              transparent 30%
            ),
            #080b10;
          color: #f4f7fb;
          padding: 24px;
          box-sizing: border-box;
          font-family: Inter, Arial, sans-serif;
        }

        .vat-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .vat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .vat-title {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
        }

        .vat-subtitle {
          margin: 6px 0 0;
          color: #8f9aaa;
          font-size: 14px;
        }

        .vat-export-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          align-items: center;
        }

        .vat-export-btn {
          border: 1px solid #2d3b4d;
          background: linear-gradient(
            135deg,
            #12202d,
            #0d151e
          );
          color: #eaf1f8;
          border-radius: 9px;
          padding: 9px 13px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }

        .vat-export-btn:hover {
          border-color: #4a9bd0;
          background: #162536;
        }

        .vat-export-btn.pdf {
          border-color: rgba(
            255,
            185,
            70,
            0.35
          );
        }

        .vat-export-btn.excel {
          border-color: rgba(
            77,
            230,
            154,
            0.35
          );
        }

        .vat-report-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .vat-report-summary {
          border: 1px solid #202a36;
          background: #0b1017;
          border-radius: 12px;
          overflow: hidden;
        }

        .vat-report-summary-header {
          padding: 14px 16px;
          background: #101823;
          border-bottom: 1px solid #202a36;
          font-weight: 800;
        }

        .vat-report-summary-row {
          display: grid;
          grid-template-columns: 1fr 170px;
          gap: 12px;
          padding: 11px 15px;
          border-bottom: 1px solid #18212b;
        }

        .vat-report-summary-row:last-child {
          border-bottom: none;
        }

        .vat-report-summary-row .label {
          color: #8a96a5;
          font-size: 13px;
        }

        .vat-report-summary-row .value {
          text-align: right;
          font-weight: 800;
          color: #edf3f8;
        }

        .vat-report-total {
          margin-top: 14px;
          border: 1px solid rgba(
            255,
            185,
            70,
            0.35
          );
          background: linear-gradient(
            135deg,
            #19170f,
            #111720
          );
          border-radius: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
        }

        .vat-report-total-label {
          color: #b8c2ce;
          font-size: 13px;
          font-weight: 700;
        }

        .vat-report-total-value {
          font-size: 22px;
          font-weight: 900;
        }

        .vat-refresh-btn {
          border: 1px solid #263241;
          background: #111720;
          color: #eaf1f8;
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .vat-refresh-btn:hover {
          border-color: #3e91c9;
          background: #151d28;
        }

        .vat-refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .vat-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid #1d2632;
          padding-bottom: 8px;
          flex-wrap: wrap;
        }

        .vat-tab {
          border: none;
          background: transparent;
          color: #8f9aaa;
          padding: 10px 16px;
          cursor: pointer;
          border-radius: 8px;
          font-weight: 600;
        }

        .vat-tab.active {
          background: #132333;
          color: #63c8ff;
        }

        .vat-cards {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 20px;
        }

        .vat-card {
          background: linear-gradient(
            145deg,
            #111720,
            #0d1219
          );
          border: 1px solid #202a36;
          border-radius: 14px;
          padding: 18px;
          min-height: 110px;
          box-sizing: border-box;
        }

        .vat-card-label {
          color: #8995a5;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .vat-card-value {
          font-size: 25px;
          font-weight: 800;
        }

        .vat-card-note {
          color: #687586;
          font-size: 11px;
          margin-top: 7px;
        }

        .vat-output {
          border-color: rgba(
            255,
            102,
            102,
            0.25
          );
        }

        .vat-input {
          border-color: rgba(
            76,
            194,
            255,
            0.25
          );
        }

        .vat-payable {
          border-color: rgba(
            255,
            185,
            70,
            0.3
          );
        }

        .vat-receivable {
          border-color: rgba(
            77,
            230,
            154,
            0.3
          );
        }

        .vat-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .vat-panel {
          background: #0d1219;
          border: 1px solid #202a36;
          border-radius: 14px;
          overflow: hidden;
        }

        .vat-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 18px;
          border-bottom: 1px solid #202a36;
          gap: 15px;
          flex-wrap: wrap;
        }

        .vat-panel-title {
          margin: 0;
          font-size: 17px;
          font-weight: 750;
        }

        .vat-panel-body {
          padding: 18px;
        }

        .vat-filter-grid {
          display: grid;
          grid-template-columns:
            1.5fr repeat(4, 1fr);
          gap: 10px;
        }

        .vat-input-field,
        .vat-select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #273341;
          background: #0a0f15;
          color: #eaf1f8;
          border-radius: 9px;
          padding: 10px 12px;
          outline: none;
        }

        .vat-input-field:focus,
        .vat-select:focus {
          border-color: #3c91c7;
        }

        .vat-table-wrapper {
          overflow-x: auto;
        }

        .vat-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .vat-table th {
          text-align: left;
          padding: 12px;
          color: #7f8b9a;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #222c38;
          white-space: nowrap;
        }

        .vat-table td {
          padding: 13px 12px;
          border-bottom: 1px solid #18212c;
          color: #dce3ea;
          font-size: 13px;
          white-space: nowrap;
        }

        .vat-table tr:hover td {
          background: #111821;
        }

        .vat-source {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }

        .vat-source.sales {
          background: rgba(
            255,
            86,
            86,
            0.12
          );
          color: #ff8d8d;
        }

        .vat-source.purchases {
          background: rgba(
            74,
            184,
            255,
            0.12
          );
          color: #70caff;
        }

        .vat-source.expenses {
          background: rgba(
            183,
            131,
            255,
            0.12
          );
          color: #c49bff;
        }

        .vat-source.adjustment {
          background: rgba(
            255,
            190,
            70,
            0.12
          );
          color: #ffc96b;
        }

        .vat-direction-output {
          color: #ff8d8d;
          font-weight: 700;
        }

        .vat-direction-input {
          color: #70caff;
          font-weight: 700;
        }

        .vat-empty {
          padding: 50px 20px;
          text-align: center;
          color: #738092;
        }

        .vat-empty-title {
          color: #d9e1e8;
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .vat-loading {
          padding: 60px;
          text-align: center;
          color: #8b98a8;
        }

        .vat-error {
          margin-bottom: 20px;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid rgba(
            255,
            80,
            80,
            0.3
          );
          background: rgba(
            255,
            80,
            80,
            0.08
          );
          color: #ff9b9b;
        }

        .vat-period-card {
          border: 1px solid #222d39;
          background: #0b1017;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }

        .vat-period-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .vat-period-name {
          font-size: 17px;
          font-weight: 750;
        }

        .vat-status {
          padding: 5px 9px;
          border-radius: 20px;
          background: rgba(
            74,
            184,
            255,
            0.1
          );
          color: #70caff;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .vat-period-grid {
          display: grid;
          grid-template-columns: repeat(
            5,
            1fr
          );
          gap: 10px;
        }

        .vat-period-item {
          background: #0f151d;
          border-radius: 9px;
          padding: 11px;
        }

        .vat-period-item-label {
          color: #738092;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .vat-period-item-value {
          font-size: 14px;
          font-weight: 700;
        }

        .vat-summary-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            1fr
          );
          gap: 14px;
        }

        .vat-summary-box {
          border: 1px solid #202a36;
          background: #0b1017;
          border-radius: 12px;
          padding: 16px;
        }

        .vat-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 9px 0;
          border-bottom: 1px solid #18212b;
        }

        .vat-summary-row:last-child {
          border-bottom: none;
        }

        .vat-summary-row span:first-child {
          color: #8793a3;
        }

        .vat-summary-row span:last-child {
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .vat-cards {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .vat-filter-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .vat-period-grid {
            grid-template-columns: repeat(
              2,
              1fr
            );
          }

          .vat-report-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .vat-center-page {
            padding: 12px;
          }

          .vat-cards {
            grid-template-columns: 1fr;
          }

          .vat-filter-grid {
            grid-template-columns: 1fr;
          }

          .vat-summary-grid {
            grid-template-columns: 1fr;
          }

          .vat-period-grid {
            grid-template-columns: 1fr;
          }

          .vat-title {
            font-size: 24px;
          }
        }
      `}</style>

      <div className="vat-container">

        <div className="vat-header">
          <div>
            <h1 className="vat-title">VAT Center</h1>
            <p className="vat-subtitle">Centralized Saudi VAT monitoring, transactions and reporting</p>
          </div>

          <div className="vat-export-actions">
            <button
              type="button"
              className="vat-export-btn pdf"
              onClick={exportVatSummaryPDF}
              disabled={loading}
            >
              📄 Summary Only
            </button>
            <button
              type="button"
              className="vat-export-btn pdf"
              onClick={exportVatFullReportPDF}
              disabled={loading}
            >
              📄 Full Report
            </button>
            <button
              type="button"
              className="vat-export-btn excel"
              onClick={exportVatReportExcel}
              disabled={loading}
            >
              📊 Excel
            </button>
            <button
              className="vat-refresh-btn"
              onClick={loadVatData}
              disabled={loading}
            >
              {loading ? "Loading..." : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="vat-error">{error}</div>
        )}

        <div className="vat-tabs">
          <button
            className={`vat-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`vat-tab ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => setActiveTab("transactions")}
          >
            VAT Transactions
          </button>
          <button
            className={`vat-tab ${activeTab === "periods" ? "active" : ""}`}
            onClick={() => setActiveTab("periods")}
          >
            VAT Periods
          </button>
          <button
            className={`vat-tab ${activeTab === "report" ? "active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            VAT Report
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {loading ? (
              <div className="vat-panel">
                <div className="vat-loading">Loading VAT data from Sales, Purchases, Expenses and Diesel...</div>
              </div>
            ) : (
              <>
                <div className="vat-cards">
                  <div className="vat-card vat-output">
                    <div className="vat-card-label">OUTPUT VAT — SALES</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.salesVat)}</div>
                    <div className="vat-card-note">VAT collected from sales</div>
                  </div>
                  <div className="vat-card vat-input">
                    <div className="vat-card-label">INPUT VAT — PURCHASES</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.purchaseVat)}</div>
                    <div className="vat-card-note">VAT on purchases</div>
                  </div>
                  <div className="vat-card vat-input">
                    <div className="vat-card-label">EXPENSE VAT</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.expenseVat)}</div>
                    <div className="vat-card-note">VAT on general expenses</div>
                  </div>
                  <div className="vat-card vat-input">
                    <div className="vat-card-label">DIESEL VAT</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.dieselVat)}</div>
                    <div className="vat-card-note">VAT on diesel / vehicle expenses</div>
                  </div>
                  <div className="vat-card vat-input">
                    <div className="vat-card-label">TOTAL INPUT VAT</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.totalInputVat)}</div>
                    <div className="vat-card-note">Purchases + expenses + diesel</div>
                  </div>
                  <div className="vat-card">
                    <div className="vat-card-label">ADJUSTMENTS</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.adjustmentVat)}</div>
                    <div className="vat-card-note">Credit / debit adjustments</div>
                  </div>
                  <div className="vat-card vat-payable">
                    <div className="vat-card-label">VAT PAYABLE</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.vatPayable)}</div>
                    <div className="vat-card-note">Estimated net VAT payable</div>
                  </div>
                  <div className="vat-card vat-receivable">
                    <div className="vat-card-label">VAT RECEIVABLE</div>
                    <div className="vat-card-value">SAR {formatSAR(summary.vatReceivable)}</div>
                    <div className="vat-card-note">Estimated refundable balance</div>
                  </div>
                </div>

                <div className="vat-main-grid">
                  <div className="vat-panel">
                    <div className="vat-panel-header">
                      <h2 className="vat-panel-title">VAT Summary</h2>
                      <span style={{ color: "#718092", fontSize: 12 }}>{summary.totalTransactions} source transactions</span>
                    </div>
                    <div className="vat-panel-body">
                      <div className="vat-summary-grid">
                        <div className="vat-summary-box">
                          <div className="vat-summary-row"><span>Sales taxable amount</span><span>SAR {formatSAR(summary.salesTaxable)}</span></div>
                          <div className="vat-summary-row"><span>Output VAT</span><span>SAR {formatSAR(summary.salesVat)}</span></div>
                          <div className="vat-summary-row"><span>Purchase taxable amount</span><span>SAR {formatSAR(summary.purchaseTaxable)}</span></div>
                          <div className="vat-summary-row"><span>Purchase VAT</span><span>SAR {formatSAR(summary.purchaseVat)}</span></div>
                        </div>
                        <div className="vat-summary-box">
                          <div className="vat-summary-row"><span>Expense taxable amount</span><span>SAR {formatSAR(summary.expenseTaxable)}</span></div>
                          <div className="vat-summary-row"><span>Expense VAT</span><span>SAR {formatSAR(summary.expenseVat)}</span></div>
                          <div className="vat-summary-row"><span>Diesel taxable amount</span><span>SAR {formatSAR(summary.dieselTaxable)}</span></div>
                          <div className="vat-summary-row"><span>Diesel VAT</span><span>SAR {formatSAR(summary.dieselVat)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="vat-panel">
                    <div className="vat-panel-header">
                      <h2 className="vat-panel-title">Latest VAT Period</h2>
                    </div>
                    <div className="vat-panel-body">
                      {latestPeriod ? (
                        <div className="vat-period-card">
                          <div className="vat-period-top">
                            <div className="vat-period-name">{latestPeriod.period_name}</div>
                            <div className="vat-status">{latestPeriod.status || "Open"}</div>
                          </div>
                          <div className="vat-period-grid">
                            <div className="vat-period-item">
                              <div className="vat-period-item-label">START</div>
                              <div className="vat-period-item-value">{formatDate(latestPeriod.start_date)}</div>
                            </div>
                            <div className="vat-period-item">
                              <div className="vat-period-item-label">END</div>
                              <div className="vat-period-item-value">{formatDate(latestPeriod.end_date)}</div>
                            </div>
                            <div className="vat-period-item">
                              <div className="vat-period-item-label">OUTPUT VAT</div>
                              <div className="vat-period-item-value">SAR {formatSAR(Number(latestPeriod.output_vat || 0))}</div>
                            </div>
                            <div className="vat-period-item">
                              <div className="vat-period-item-label">INPUT VAT</div>
                              <div className="vat-period-item-value">SAR {formatSAR(Number(latestPeriod.input_vat || 0))}</div>
                            </div>
                            <div className="vat-period-item">
                              <div className="vat-period-item-label">NET VAT</div>
                              <div className="vat-period-item-value">SAR {formatSAR(Number(latestPeriod.vat_payable || 0))}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="vat-empty">
                          <div className="vat-empty-title">No VAT periods yet</div>
                          <div>VAT periods will be created in the next step.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="vat-panel">
            <div className="vat-panel-header">
              <h2 className="vat-panel-title">VAT Transactions</h2>
              <div className="vat-export-actions">
                <span style={{ color: "#718092", fontSize: 12, alignSelf: "center" }}>{filteredSourceVatRows.length} records</span>
                <button type="button" className="vat-export-btn pdf" onClick={exportVatSummaryPDF} disabled={loading}>Summary Only</button>
                <button type="button" className="vat-export-btn pdf" onClick={exportVatFullReportPDF} disabled={loading}>Full Report</button>
                <button type="button" className="vat-export-btn excel" onClick={exportVatReportExcel} disabled={loading}>Export Excel</button>
              </div>
            </div>
            <div className="vat-panel-body">
              <div className="vat-filter-grid">
                <input className="vat-input-field" placeholder="Search document, party, notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="vat-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                  <option value="all">All Sources</option>
                  <option value="sales">Sales</option>
                  <option value="purchases">Purchases</option>
                  <option value="expenses">Expenses</option>
                  <option value="diesel">Diesel</option>
                  <option value="adjustment">Adjustments</option>
                </select>
                <select className="vat-select" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
                  <option value="all">All VAT Types</option>
                  <option value="output">Output VAT</option>
                  <option value="input">Input VAT</option>
                </select>
                <input className="vat-input-field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input className="vat-input-field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>

              <div style={{ height: 18 }} />

              {loading ? (
                <div className="vat-loading">Loading VAT transactions...</div>
              ) : filteredSourceVatRows.length === 0 ? (
                <div className="vat-empty">
                  <div className="vat-empty-title">No VAT transactions found</div>
                  <div>No matching Sales, Purchases, Expenses or Diesel transactions were found.</div>
                </div>
              ) : (
                <div className="vat-table-wrapper">
                  <table className="vat-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Source</th>
                        <th>Document</th>
                        <th>Party</th>
                        <th>Taxable Amount</th>
                        <th>Rate</th>
                        <th>VAT Amount</th>
                        <th>Total</th>
                        <th>Direction</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSourceVatRows.map((row, index) => (
                        <tr key={`${row.source}-${row.id}-${index}`}>
                          <td>{formatDate(row.date)}</td>
                          <td><span className={getSourceClass(row.source)}>{getSourceLabel(row.source)}</span></td>
                          <td>{row.document || "-"}</td>
                          <td>{row.party || "-"}</td>
                          <td>SAR {formatSAR(row.taxable)}</td>
                          <td>{row.vatRate}%</td>
                          <td>SAR {formatSAR(row.vat)}</td>
                          <td>SAR {formatSAR(row.total)}</td>
                          <td className={row.direction === "output" ? "vat-direction-output" : "vat-direction-input"}>{row.direction}</td>
                          <td>{row.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Periods Tab */}
        {activeTab === "periods" && (
          <div className="vat-panel">
            <div className="vat-panel-header">
              <h2 className="vat-panel-title">VAT Periods</h2>
              <span style={{ color: "#718092", fontSize: 12 }}>{periods.length} periods</span>
            </div>
            <div className="vat-panel-body">
              {periods.length === 0 ? (
                <div className="vat-empty">
                  <div className="vat-empty-title">No VAT periods created</div>
                  <div>We will create the automatic VAT period system in the next step.</div>
                </div>
              ) : (
                periods.map((period) => (
                  <div className="vat-period-card" key={period.id}>
                    <div className="vat-period-top">
                      <div className="vat-period-name">{period.period_name}</div>
                      <div className="vat-status">{period.status || "Open"}</div>
                    </div>
                    <div className="vat-period-grid">
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">PERIOD TYPE</div>
                        <div className="vat-period-item-value">{period.period_type}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">START DATE</div>
                        <div className="vat-period-item-value">{formatDate(period.start_date)}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">END DATE</div>
                        <div className="vat-period-item-value">{formatDate(period.end_date)}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">OUTPUT VAT</div>
                        <div className="vat-period-item-value">SAR {formatSAR(Number(period.output_vat || 0))}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">INPUT VAT</div>
                        <div className="vat-period-item-value">SAR {formatSAR(Number(period.input_vat || 0))}</div>
                      </div>
                    </div>
                    <div style={{ height: 10 }} />
                    <div className="vat-period-grid">
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">ADJUSTMENTS</div>
                        <div className="vat-period-item-value">SAR {formatSAR(Number(period.adjustment_vat || 0))}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">VAT PAYABLE</div>
                        <div className="vat-period-item-value">SAR {formatSAR(Number(period.vat_payable || 0))}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">VAT RECEIVABLE</div>
                        <div className="vat-period-item-value">SAR {formatSAR(Number(period.vat_receivable || 0))}</div>
                      </div>
                      <div className="vat-period-item">
                        <div className="vat-period-item-label">DUE DATE</div>
                        <div className="vat-period-item-value">{formatDate(period.due_date)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Report Tab */}
        {activeTab === "report" && (
          <div className="vat-panel">
            <div className="vat-panel-header">
              <div>
                <h2 className="vat-panel-title">VAT Report</h2>
                <div style={{ color: "#718092", fontSize: 12, marginTop: 4 }}>General VAT return-style report and management summary</div>
              </div>
              <div className="vat-export-actions">
                <button type="button" className="vat-export-btn pdf" onClick={exportVatSummaryPDF} disabled={loading}>Summary Only</button>
                <button type="button" className="vat-export-btn pdf" onClick={exportVatFullReportPDF} disabled={loading}>Full Report</button>
                <button type="button" className="vat-export-btn excel" onClick={exportVatReportExcel} disabled={loading}>Export Excel</button>
              </div>
            </div>
            <div className="vat-panel-body">
              <div className="vat-filter-grid">
                <div style={{ color: "#8b98a8", display: "flex", alignItems: "center", fontSize: 13 }}>Reporting Period</div>
                <input className="vat-input-field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input className="vat-input-field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <button type="button" className="vat-refresh-btn" onClick={() => { setDateFrom(""); setDateTo(""); }}>All Dates</button>
              </div>

              <div style={{ height: 20 }} />

              <div className="vat-report-grid">
                <div className="vat-report-summary">
                  <div className="vat-report-summary-header">SALES — OUTPUT VAT</div>
                  {[
                    ["Total Sales of the Period", vatReport.totalSales, "SAR"],
                    ["Total Sales Returned of the Period", vatReport.totalSalesReturned, "SAR"],
                    ["Taxable Sales", vatReport.taxableSales, "SAR"],
                    ["VAT %", vatReport.salesRate, "%"],
                    ["Total Output VAT", vatReport.salesVat, "SAR"],
                  ].map(([label, value, unit]) => (
                    <div className="vat-report-summary-row" key={String(label)}>
                      <div className="label">{String(label)}</div>
                      <div className="value">{unit === "%" ? `${Number(value).toFixed(2)}%` : `SAR ${formatSAR(Number(value))}`}</div>
                    </div>
                  ))}
                </div>

                <div className="vat-report-summary">
                  <div className="vat-report-summary-header">PURCHASES — INPUT VAT</div>
                  {[
                    ["Total Purchase of the Period", vatReport.totalPurchases, "SAR"],
                    ["Total Purchase Returned of the Period", vatReport.totalPurchaseReturned, "SAR"],
                    ["Taxable Purchase", vatReport.taxablePurchases, "SAR"],
                    ["VAT %", vatReport.purchaseRate, "%"],
                    ["Total Input VAT", vatReport.purchaseVat, "SAR"],
                  ].map(([label, value, unit]) => (
                    <div className="vat-report-summary-row" key={String(label)}>
                      <div className="label">{String(label)}</div>
                      <div className="value">{unit === "%" ? `${Number(value).toFixed(2)}%` : `SAR ${formatSAR(Number(value))}`}</div>
                    </div>
                  ))}
                </div>

                <div className="vat-report-summary">
                  <div className="vat-report-summary-header">EXPENSES — INPUT VAT</div>
                  {[
                    ["Taxable Expenses", vatReport.taxableExpenses, "SAR"],
                    ["VAT %", vatReport.expenseRate, "%"],
                    ["Total Input VAT", vatReport.expenseVat, "SAR"],
                  ].map(([label, value, unit]) => (
                    <div className="vat-report-summary-row" key={String(label)}>
                      <div className="label">{String(label)}</div>
                      <div className="value">{unit === "%" ? `${Number(value).toFixed(2)}%` : `SAR ${formatSAR(Number(value))}`}</div>
                    </div>
                  ))}
                </div>

                <div className="vat-report-summary">
                  <div className="vat-report-summary-header">VAT POSITION</div>
                  {[
                    ["Total Output VAT", vatReport.totalOutputVat],
                    ["Total Input VAT", vatReport.totalInputVat],
                    ["Total VAT Payable", vatReport.vatPayable],
                  ].map(([label, value]) => (
                    <div className="vat-report-summary-row" key={String(label)}>
                      <div className="label">{String(label)}</div>
                      <div className="value">SAR {formatSAR(Number(value))}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vat-report-total">
                <div>
                  <div className="vat-report-total-label">TOTAL VAT PAYABLE</div>
                  <div style={{ color: "#718092", fontSize: 11, marginTop: 4 }}>Output VAT less eligible input VAT, after sales and purchase returns</div>
                </div>
                <div className="vat-report-total-value">SAR {formatSAR(vatReport.vatPayable)}</div>
              </div>

              {returnRows.length === 0 && (
                <div style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 9,
                  border: "1px solid rgba(255,185,70,0.25)",
                  background: "rgba(255,185,70,0.06)",
                  color: "#b9a47b",
                  fontSize: 12,
                }}>
                  Sales-return and purchase-return values are currently zero because no return records were found in the optional <strong>sales_returns</strong> and <strong>purchase_returns</strong> sources. The report will automatically include them when those tables contain return records.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}