import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

/* ============================================================
   TYPES
============================================================ */

type Partner = {
  id: number;
  partner_name: string;
  profit_percentage: number;
  opening_balance: number;
  notes: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProfitAllocation = {
  id: number;
  partner_id: number;
  allocation_date: string;
  period_start: string;
  period_end: string;
  net_profit: number;
  profit_percentage: number;
  allocated_amount: number;
  notes: string | null;
  created_at: string | null;
};

type PartnerPayment = {
  id: number;
  partner_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
};

type SalesRecord = {
  id: number;
  sales_date: string;
  total_amount: number;
};

type SalesReturnRecord = {
  id: number;
  return_date: string;
  total: number;
};

type PurchaseRecord = {
  id: number;
  purchase_date: string;
  total_amount: number;
};

type ExpenseRecord = {
  id: number;
  expense_date: string;
  total_amount: number;
};

type AllocationForm = {
  partner_id: string;
  period_month: string;
  notes: string;
};

type PaymentForm = {
  partner_id: string;
  payment_date: string;
  amount: string;
  payment_method: string;
  reference: string;
  reason: string;
  notes: string;
};

/* ============================================================
   CONSTANTS
============================================================ */

const COMPANY_NAME_EN = "AL SHAMS AL GHAYABA TRD EST.";

const PAYMENT_METHODS = [
  "Cash",
  "Bank",
  "Transfer",
  "Other",
];

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAllocationForm: AllocationForm = {
  partner_id: "",
  period_month: getCurrentMonth(),
  notes: "",
};

const emptyPaymentForm: PaymentForm = {
  partner_id: "",
  payment_date: getToday(),
  amount: "",
  payment_method: "Cash",
  reference: "",
  reason: "",
  notes: "",
};

/* ============================================================
   HELPERS
============================================================ */

function money(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string | null) {
  if (!date) return "-";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-GB");
}

function getMonthName(month: string) {
  if (!month) return "-";

  const date = new Date(`${month}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return month;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getPeriodFromMonth(monthString: string) {
  const [yearString, monthNumberString] = monthString.split("-");

  const year = Number(yearString);
  const monthNumber = Number(monthNumberString);

  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    return {
      start: "",
      end: "",
    };
  }

  const lastDay = new Date(year, monthNumber, 0).getDate();

  return {
    start: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    end: `${year}-${String(monthNumber).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`,
  };
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

function Partners() {
  /* ==========================================================
     STATE
  ========================================================== */

  const [partners, setPartners] =
    useState<Partner[]>([]);

  const [allocations, setAllocations] =
    useState<ProfitAllocation[]>([]);

  const [payments, setPayments] =
    useState<PartnerPayment[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [financialLoading, setFinancialLoading] =
    useState(false);

  const [allocationForm, setAllocationForm] =
    useState<AllocationForm>({
      ...emptyAllocationForm,
    });

  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>({
      ...emptyPaymentForm,
    });

  const [search, setSearch] =
    useState("");

  const [partnerFilter, setPartnerFilter] =
    useState("ALL");

  const [monthFilter, setMonthFilter] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<
      "partners" | "allocation" | "payments"
    >("partners");

  /* ==========================================================
     AUTOMATIC PROFIT & LOSS STATE
  ========================================================== */

  const [financialPeriod, setFinancialPeriod] =
    useState(getCurrentMonth());

  const [salesTotal, setSalesTotal] =
    useState(0);

  const [salesReturnsTotal, setSalesReturnsTotal] =
    useState(0);

  const [purchasesTotal, setPurchasesTotal] =
    useState(0);

  const [expensesTotal, setExpensesTotal] =
    useState(0);

  /* ==========================================================
     LOAD INITIAL DATA
  ========================================================== */

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadFinancialData(financialPeriod);
  }, [financialPeriod]);

  /* ==========================================================
     LOAD ALL PARTNER DATA
  ========================================================== */

  async function loadAllData() {
    setLoading(true);

    try {
      const [
        partnersResult,
        allocationsResult,
        paymentsResult,
      ] = await Promise.all([
        supabase
          .from("partners")
          .select("*")
          .order("id", {
            ascending: true,
          }),

        supabase
          .from("partner_profit_allocations")
          .select("*")
          .order("allocation_date", {
            ascending: false,
          })
          .order("id", {
            ascending: false,
          }),

        supabase
          .from("partner_payments")
          .select("*")
          .order("payment_date", {
            ascending: false,
          })
          .order("id", {
            ascending: false,
          }),
      ]);

      if (partnersResult.error) {
        throw new Error(
          `Partners: ${partnersResult.error.message}`
        );
      }

      if (allocationsResult.error) {
        throw new Error(
          `Profit Allocations: ${allocationsResult.error.message}`
        );
      }

      if (paymentsResult.error) {
        throw new Error(
          `Partner Payments: ${paymentsResult.error.message}`
        );
      }

      setPartners(
        (partnersResult.data || []) as Partner[]
      );

      setAllocations(
        (allocationsResult.data || []) as ProfitAllocation[]
      );

      setPayments(
        (paymentsResult.data || []) as PartnerPayment[]
      );
    } catch (error) {
      console.error(
        "Partner loading error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load partner data."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==========================================================
     AUTOMATIC ERP PROFIT CALCULATION
  ========================================================== */

  async function loadFinancialData(
    month: string
  ) {
    const period = getPeriodFromMonth(month);

    if (!period.start || !period.end) {
      return;
    }

    setFinancialLoading(true);

    try {
      const [
        salesResult,
        salesReturnsResult,
        purchasesResult,
        expensesResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id,sales_date,total_amount"
          )
          .gte(
            "sales_date",
            period.start
          )
          .lte(
            "sales_date",
            period.end
          ),

        supabase
          .from("sales_returns")
          .select(
            "id,return_date,total"
          )
          .gte(
            "return_date",
            period.start
          )
          .lte(
            "return_date",
            period.end
          ),

        supabase
          .from("purchases")
          .select(
            "id,purchase_date,total_amount"
          )
          .gte(
            "purchase_date",
            period.start
          )
          .lte(
            "purchase_date",
            period.end
          ),

        supabase
          .from("expenses")
          .select(
            "id,expense_date,total_amount"
          )
          .gte(
            "expense_date",
            period.start
          )
          .lte(
            "expense_date",
            period.end
          ),
      ]);

      if (salesResult.error) {
        throw new Error(
          `Sales: ${salesResult.error.message}`
        );
      }

      if (salesReturnsResult.error) {
        throw new Error(
          `Sales Returns: ${salesReturnsResult.error.message}`
        );
      }

      if (purchasesResult.error) {
        throw new Error(
          `Purchases: ${purchasesResult.error.message}`
        );
      }

      if (expensesResult.error) {
        throw new Error(
          `Expenses: ${expensesResult.error.message}`
        );
      }

      const sales =
        (salesResult.data || []) as SalesRecord[];

      const salesReturns =
        (salesReturnsResult.data || []) as SalesReturnRecord[];

      const purchases =
        (purchasesResult.data || []) as PurchaseRecord[];

      const expenses =
        (expensesResult.data || []) as ExpenseRecord[];

      const salesAmount =
        sales.reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_amount || 0
            ),
          0
        );

      const salesReturnAmount =
        salesReturns.reduce(
          (sum, item) =>
            sum +
            Number(item.total || 0),
          0
        );

      const purchaseAmount =
        purchases.reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_amount || 0
            ),
          0
        );

      const expenseAmount =
        expenses.reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_amount || 0
            ),
          0
        );

      setSalesTotal(salesAmount);

      setSalesReturnsTotal(
        salesReturnAmount
      );

      setPurchasesTotal(
        purchaseAmount
      );

      setExpensesTotal(
        expenseAmount
      );
    } catch (error) {
      console.error(
        "Financial data loading error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to calculate ERP profit."
      );
    } finally {
      setFinancialLoading(false);
    }
  }

  /* ==========================================================
     NET PROFIT
  ========================================================== */

  const netSales =
    salesTotal -
    salesReturnsTotal;

  const netProfit =
    netSales -
    purchasesTotal -
    expensesTotal;

  /* ==========================================================
     PARTNER HELPERS
  ========================================================== */

  function getPartnerName(
    partnerId: number
  ) {
    return (
      partners.find(
        (partner) =>
          partner.id === partnerId
      )?.partner_name ||
      "Unknown Partner"
    );
  }

  function getPartnerAllocatedProfit(
    partnerId: number
  ) {
    return allocations
      .filter(
        (item) =>
          item.partner_id === partnerId
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.allocated_amount || 0
          ),
        0
      );
  }

  function getPartnerPayments(
    partnerId: number
  ) {
    return payments
      .filter(
        (item) =>
          item.partner_id === partnerId
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(item.amount || 0),
        0
      );
  }

  function getPartnerBalance(
    partnerId: number
  ) {
    const partner = partners.find(
      (item) =>
        item.id === partnerId
    );

    if (!partner) return 0;

    return (
      Number(
        partner.opening_balance || 0
      ) +
      getPartnerAllocatedProfit(
        partnerId
      ) -
      getPartnerPayments(
        partnerId
      )
    );
  }

  /* ==========================================================
     ALLOCATION FORM
  ========================================================== */

  function updateAllocationField(
    field: keyof AllocationForm,
    value: string
  ) {
    setAllocationForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  const selectedAllocationPartner =
    partners.find(
      (partner) =>
        partner.id ===
        Number(
          allocationForm.partner_id
        )
    );

  const selectedAllocationAmount =
    selectedAllocationPartner
      ? netProfit *
        (Number(
          selectedAllocationPartner.profit_percentage
        ) /
          100)
      : 0;

  /* ==========================================================
     VALIDATE PARTNER PERCENTAGES
  ========================================================== */

  const totalPartnerPercentage =
    partners.reduce(
      (sum, partner) =>
        sum +
        Number(
          partner.profit_percentage || 0
        ),
      0
    );

  /* ==========================================================
     SAVE AUTOMATIC PROFIT ALLOCATION
  ========================================================== */

  async function saveProfitAllocation() {
    const period =
      getPeriodFromMonth(
        allocationForm.period_month
      );

    if (!period.start || !period.end) {
      alert(
        "Please select a valid allocation month."
      );
      return;
    }

    if (partners.length === 0) {
      alert(
        "Please add partners before allocating profit."
      );
      return;
    }

    if (
      Math.abs(
        totalPartnerPercentage - 100
      ) > 0.01
    ) {
      alert(
        `Partner profit percentages must total 100%.\n\nCurrent total: ${totalPartnerPercentage.toFixed(
          2
        )}%`
      );

      return;
    }

    if (
      !Number.isFinite(netProfit)
    ) {
      alert(
        "Unable to calculate net profit."
      );

      return;
    }

    const confirmed = window.confirm(
      `Automatic Profit Allocation\n\n` +
        `Period: ${getMonthName(
          allocationForm.period_month
        )}\n` +
        `Sales: SAR ${money(
          salesTotal
        )}\n` +
        `Sales Returns: SAR ${money(
          salesReturnsTotal
        )}\n` +
        `Purchases: SAR ${money(
          purchasesTotal
        )}\n` +
        `Expenses: SAR ${money(
          expensesTotal
        )}\n` +
        `Net Profit: SAR ${money(
          netProfit
        )}\n\n` +
        `Allocate this amount according to all partner percentages?`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      /*
       * Prevent accidental duplicate monthly
       * allocations.
       */

      const {
        data: existingAllocations,
        error: existingError,
      } = await supabase
        .from(
          "partner_profit_allocations"
        )
        .select(
          "id,partner_id,allocated_amount"
        )
        .eq(
          "period_start",
          period.start
        )
        .eq(
          "period_end",
          period.end
        );

      if (existingError) {
        throw new Error(
          `Unable to check existing allocation: ${existingError.message}`
        );
      }

      if (
        existingAllocations &&
        existingAllocations.length > 0
      ) {
        alert(
          `Profit has already been allocated for ${getMonthName(
            allocationForm.period_month
          )}.\n\nDelete the existing allocation first if you need to recalculate it.`
        );

        return;
      }

      const allocationDate =
        period.end;

      const rows =
        partners.map(
          (partner) => {
            const percentage =
              Number(
                partner.profit_percentage || 0
              );

            const allocatedAmount =
              netProfit *
              (percentage / 100);

            return {
              partner_id:
                partner.id,

              allocation_date:
                allocationDate,

              period_start:
                period.start,

              period_end:
                period.end,

              net_profit:
                netProfit,

              profit_percentage:
                percentage,

              allocated_amount:
                allocatedAmount,

              notes:
                allocationForm.notes.trim() ||
                null,
            };
          }
        );

      const { error } =
        await supabase
          .from(
            "partner_profit_allocations"
          )
          .insert(rows);

      if (error) {
        throw new Error(
          `Unable to save profit allocation: ${error.message}`
        );
      }

      alert(
        `Profit allocation saved successfully for ${getMonthName(
          allocationForm.period_month
        )}.`
      );

      setAllocationForm({
        ...emptyAllocationForm,
        period_month:
          allocationForm.period_month,
      });

      await loadAllData();
    } catch (error) {
      console.error(
        "Profit allocation error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save profit allocation."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     PAYMENT FORM
  ========================================================== */

  function updatePaymentField(
    field: keyof PaymentForm,
    value: string
  ) {
    setPaymentForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  function validatePayment() {
    if (!paymentForm.partner_id) {
      alert("Please select a partner.");
      return false;
    }

    const amount =
      Number(paymentForm.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        "Payment amount must be greater than zero."
      );

      return false;
    }

    if (!paymentForm.payment_date) {
      alert(
        "Payment date is required."
      );

      return false;
    }

    if (!paymentForm.payment_method) {
      alert(
        "Payment method is required."
      );

      return false;
    }

    return true;
  }

  /* ==========================================================
     SAVE PAYMENT
  ========================================================== */

  async function savePayment() {
    if (!validatePayment()) {
      return;
    }

    const partner = partners.find(
      (item) =>
        item.id ===
        Number(
          paymentForm.partner_id
        )
    );

    if (!partner) {
      alert("Partner not found.");
      return;
    }

    const amount =
      Number(paymentForm.amount);

    const balance =
      getPartnerBalance(
        partner.id
      );

    if (amount > balance) {
      const confirmed =
        window.confirm(
          `Payment SAR ${money(
            amount
          )} is greater than the current balance of SAR ${money(
            balance
          )}.\n\nDo you still want to record this payment?`
        );

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);

    try {
      const paymentData = {
        partner_id:
          Number(
            paymentForm.partner_id
          ),

        payment_date:
          paymentForm.payment_date,

        amount,

        payment_method:
          paymentForm.payment_method,

        reference:
          paymentForm.reference.trim() ||
          null,

        reason:
          paymentForm.reason.trim() ||
          null,

        notes:
          paymentForm.notes.trim() ||
          null,
      };

      const { error } =
        await supabase
          .from("partner_payments")
          .insert(paymentData);

      if (error) {
        throw new Error(
          `Unable to save payment: ${error.message}`
        );
      }

      alert(
        "Partner payment recorded successfully."
      );

      setPaymentForm({
        ...emptyPaymentForm,
        partner_id:
          paymentForm.partner_id,
        payment_date:
          paymentForm.payment_date,
      });

      await loadAllData();
    } catch (error) {
      console.error(
        "Partner payment error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save partner payment."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     DELETE ALLOCATION
  ========================================================== */

  async function deleteAllocation(
    allocation: ProfitAllocation
  ) {
    const confirmed =
      window.confirm(
        `Delete this profit allocation for ${getPartnerName(
          allocation.partner_id
        )}?\n\nPeriod: ${formatDate(
          allocation.period_start
        )} to ${formatDate(
          allocation.period_end
        )}\n\nAllocated: SAR ${money(
          allocation.allocated_amount
        )}`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from(
            "partner_profit_allocations"
          )
          .delete()
          .eq(
            "id",
            allocation.id
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadAllData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete allocation."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     DELETE PAYMENT
  ========================================================== */

  async function deletePayment(
    payment: PartnerPayment
  ) {
    const confirmed =
      window.confirm(
        `Delete this payment of SAR ${money(
          payment.amount
        )} for ${getPartnerName(
          payment.partner_id
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("partner_payments")
          .delete()
          .eq(
            "id",
            payment.id
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadAllData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete payment."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================
     FILTERED DATA
  ========================================================== */

  const filteredPartners =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return partners.filter(
        (partner) =>
          !searchText ||
          partner.partner_name
            .toLowerCase()
            .includes(searchText)
      );
    }, [
      partners,
      search,
    ]);

  const filteredAllocations =
    useMemo(() => {
      return allocations.filter(
        (allocation) => {
          const matchesPartner =
            partnerFilter ===
              "ALL" ||
            String(
              allocation.partner_id
            ) === partnerFilter;

          const matchesMonth =
            !monthFilter ||
            allocation.period_start.startsWith(
              monthFilter
            );

          return (
            matchesPartner &&
            matchesMonth
          );
        }
      );
    }, [
      allocations,
      partnerFilter,
      monthFilter,
    ]);

  const filteredPayments =
    useMemo(() => {
      return payments.filter(
        (payment) =>
          partnerFilter ===
            "ALL" ||
          String(
            payment.partner_id
          ) === partnerFilter
      );
    }, [
      payments,
      partnerFilter,
    ]);

  /* ==========================================================
     DASHBOARD
  ========================================================== */

  const totalOpeningBalance =
    partners.reduce(
      (sum, partner) =>
        sum +
        Number(
          partner.opening_balance || 0
        ),
      0
    );

  const totalAllocatedProfit =
    allocations.reduce(
      (sum, allocation) =>
        sum +
        Number(
          allocation.allocated_amount ||
            0
        ),
      0
    );

  const totalPayments =
    payments.reduce(
      (sum, payment) =>
        sum +
        Number(payment.amount || 0),
      0
    );

  const totalCurrentBalance =
    partners.reduce(
      (sum, partner) =>
        sum +
        getPartnerBalance(
          partner.id
        ),
      0
    );

  /* ==========================================================
     PDF HELPERS
  ========================================================== */

  function drawPdfHeader(
    doc: jsPDF,
    title: string
  ) {
    doc.setFontSize(16);
    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      COMPANY_NAME_EN,
      14,
      18
    );

    doc.setFontSize(11);

    doc.text(
      title,
      14,
      26
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Generated: ${new Date().toLocaleString(
        "en-GB"
      )}`,
      14,
      32
    );

    doc.line(
      14,
      36,
      196,
      36
    );
  }

  function addPdfTable(
    doc: jsPDF,
    headers: string[],
    rows: string[][],
    startY: number
  ) {
    let y = startY;

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const margin = 10;

    const usableWidth =
      pageWidth -
      margin * 2;

    const columnWidth =
      usableWidth /
      headers.length;

    function drawHeader() {
      headers.forEach(
        (header, index) => {
          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.rect(
            margin +
              index *
                columnWidth,
            y,
            columnWidth,
            8
          );

          doc.text(
            String(header).substring(
              0,
              24
            ),
            margin +
              index *
                columnWidth +
              2,
            y + 5
          );
        }
      );

      y += 8;
    }

    doc.setFontSize(7);

    drawHeader();

    rows.forEach((row) => {
      if (y > 275) {
        doc.addPage();
        y = 15;
        drawHeader();
      }

      row.forEach(
        (value, index) => {
          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.rect(
            margin +
              index *
                columnWidth,
            y,
            columnWidth,
            8
          );

          doc.text(
            String(value || "").substring(
              0,
              28
            ),
            margin +
              index *
                columnWidth +
              2,
            y + 5
          );
        }
      );

      y += 8;
    });

    return y;
  }

  /* ==========================================================
     SINGLE PARTNER PDF
  ========================================================== */

  function exportSinglePartnerPDF(
    partner: Partner
  ) {
    const doc = new jsPDF();

    drawPdfHeader(
      doc,
      `PARTNER STATEMENT - ${partner.partner_name}`
    );

    let y = 45;

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "PARTNER DETAILS",
      14,
      y
    );

    y += 8;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Partner: ${partner.partner_name}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Profit Percentage: ${partner.profit_percentage}%`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Opening Balance: SAR ${money(
        partner.opening_balance
      )}`,
      14,
      y
    );

    y += 10;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "ACCOUNT SUMMARY",
      14,
      y
    );

    y += 7;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Opening Balance: SAR ${money(
        partner.opening_balance
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Allocated Profit: SAR ${money(
        getPartnerAllocatedProfit(
          partner.id
        )
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Payments: SAR ${money(
        getPartnerPayments(
          partner.id
        )
      )}`,
      14,
      y
    );

    y += 6;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      `CURRENT BALANCE: SAR ${money(
        getPartnerBalance(
          partner.id
        )
      )}`,
      14,
      y
    );

    y += 12;

    const partnerAllocations =
      allocations.filter(
        (item) =>
          item.partner_id ===
          partner.id
      );

    if (
      partnerAllocations.length >
      0
    ) {
      doc.text(
        "PROFIT ALLOCATIONS",
        14,
        y
      );

      y += 5;

      y = addPdfTable(
        doc,
        [
          "Period",
          "Net Profit",
          "%",
          "Allocated",
        ],
        partnerAllocations.map(
          (item) => [
            `${formatDate(
              item.period_start
            )} - ${formatDate(
              item.period_end
            )}`,
            money(
              item.net_profit
            ),
            `${item.profit_percentage}%`,
            money(
              item.allocated_amount
            ),
          ]
        ),
        y
      );

      y += 10;
    }

    const partnerPayments =
      payments.filter(
        (item) =>
          item.partner_id ===
          partner.id
      );

    if (
      partnerPayments.length >
      0
    ) {
      if (y > 245) {
        doc.addPage();
        y = 15;
      }

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "PAYMENTS",
        14,
        y
      );

      y += 5;

      addPdfTable(
        doc,
        [
          "Date",
          "Amount",
          "Method",
          "Reference",
          "Reason",
        ],
        partnerPayments.map(
          (item) => [
            formatDate(
              item.payment_date
            ),
            money(item.amount),
            item.payment_method,
            item.reference ||
              "-",
            item.reason ||
              "-",
          ]
        ),
        y
      );
    }

    doc.save(
      `Partner-${partner.partner_name.replace(
        /[^a-zA-Z0-9]/g,
        "-"
      )}-Statement.pdf`
    );
  }

  /* ==========================================================
     ALL PARTNERS PDF
  ========================================================== */

  function exportAllPartnersPDF() {
    const doc = new jsPDF();

    drawPdfHeader(
      doc,
      "PARTNERS - COMPLETE REPORT"
    );

    let y = 45;

    y = addPdfTable(
      doc,
      [
        "Partner",
        "Profit %",
        "Opening",
        "Profit",
        "Payments",
        "Balance",
      ],
      partners.map(
        (partner) => [
          partner.partner_name,
          `${partner.profit_percentage}%`,
          money(
            partner.opening_balance
          ),
          money(
            getPartnerAllocatedProfit(
              partner.id
            )
          ),
          money(
            getPartnerPayments(
              partner.id
            )
          ),
          money(
            getPartnerBalance(
              partner.id
            )
          ),
        ]
      ),
      y
    );

    y += 12;

    if (y > 245) {
      doc.addPage();
      y = 15;
    }

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "ERP PROFIT & LOSS",
      14,
      y
    );

    y += 7;

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Period: ${getMonthName(
        financialPeriod
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Sales: SAR ${money(
        salesTotal
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Sales Returns: SAR ${money(
        salesReturnsTotal
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Net Sales: SAR ${money(
        netSales
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Purchases: SAR ${money(
        purchasesTotal
      )}`,
      14,
      y
    );

    y += 6;

    doc.text(
      `Expenses: SAR ${money(
        expensesTotal
      )}`,
      14,
      y
    );

    y += 7;

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      `NET PROFIT: SAR ${money(
        netProfit
      )}`,
      14,
      y
    );

    doc.save(
      "All-Partners-Report.pdf"
    );
  }

  /* ==========================================================
     SINGLE PARTNER EXCEL
  ========================================================== */

  function exportSinglePartnerExcel(
    partner: Partner
  ) {
    const summary = [
      {
        Partner:
          partner.partner_name,

        "Profit Percentage":
          partner.profit_percentage,

        "Opening Balance":
          partner.opening_balance,

        "Allocated Profit":
          getPartnerAllocatedProfit(
            partner.id
          ),

        Payments:
          getPartnerPayments(
            partner.id
          ),

        "Current Balance":
          getPartnerBalance(
            partner.id
          ),
      },
    ];

    const allocationRows =
      allocations
        .filter(
          (item) =>
            item.partner_id ===
            partner.id
        )
        .map((item) => ({
          "Period Start":
            item.period_start,

          "Period End":
            item.period_end,

          "Net Profit":
            item.net_profit,

          "Profit Percentage":
            item.profit_percentage,

          "Allocated Amount":
            item.allocated_amount,

          Notes:
            item.notes || "",
        }));

    const paymentRows =
      payments
        .filter(
          (item) =>
            item.partner_id ===
            partner.id
        )
        .map((item) => ({
          Date:
            item.payment_date,

          Amount:
            item.amount,

          "Payment Method":
            item.payment_method,

          Reference:
            item.reference || "",

          Reason:
            item.reason || "",

          Notes:
            item.notes || "",
        }));

    const workbook =
      XLSX.utils.book_new();

    const summarySheet =
      XLSX.utils.json_to_sheet(
        summary
      );

    const allocationSheet =
      XLSX.utils.json_to_sheet(
        allocationRows
      );

    const paymentSheet =
      XLSX.utils.json_to_sheet(
        paymentRows
      );

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Summary"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      allocationSheet,
      "Profit Allocations"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      paymentSheet,
      "Payments"
    );

    XLSX.writeFile(
      workbook,
      `Partner-${partner.partner_name.replace(
        /[^a-zA-Z0-9]/g,
        "-"
      )}-Statement.xlsx`
    );
  }

  /* ==========================================================
     ALL PARTNERS EXCEL
  ========================================================== */

  function exportAllPartnersExcel() {
    const rows =
      partners.map(
        (partner) => ({
          Partner:
            partner.partner_name,

          "Profit Percentage":
            partner.profit_percentage,

          "Opening Balance":
            partner.opening_balance,

          "Allocated Profit":
            getPartnerAllocatedProfit(
              partner.id
            ),

          Payments:
            getPartnerPayments(
              partner.id
            ),

          "Current Balance":
            getPartnerBalance(
              partner.id
            ),
        })
      );

    const allocationRows =
      allocations.map(
        (item) => ({
          Partner:
            getPartnerName(
              item.partner_id
            ),

          "Period Start":
            item.period_start,

          "Period End":
            item.period_end,

          "Net Profit":
            item.net_profit,

          "Profit Percentage":
            item.profit_percentage,

          "Allocated Amount":
            item.allocated_amount,

          Notes:
            item.notes || "",
        })
      );

    const paymentRows =
      payments.map(
        (item) => ({
          Partner:
            getPartnerName(
              item.partner_id
            ),

          Date:
            item.payment_date,

          Amount:
            item.amount,

          "Payment Method":
            item.payment_method,

          Reference:
            item.reference || "",

          Reason:
            item.reason || "",

          Notes:
            item.notes || "",
        })
      );

    const profitLossRows = [
      {
        Period:
          getMonthName(
            financialPeriod
          ),

        Sales:
          salesTotal,

        "Sales Returns":
          salesReturnsTotal,

        "Net Sales":
          netSales,

        Purchases:
          purchasesTotal,

        Expenses:
          expensesTotal,

        "Net Profit":
          netProfit,
      },
    ];

    const workbook =
      XLSX.utils.book_new();

    const summarySheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    const allocationSheet =
      XLSX.utils.json_to_sheet(
        allocationRows
      );

    const paymentSheet =
      XLSX.utils.json_to_sheet(
        paymentRows
      );

    const profitLossSheet =
      XLSX.utils.json_to_sheet(
        profitLossRows
      );

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Partners"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      allocationSheet,
      "Profit Allocations"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      paymentSheet,
      "Payments"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      profitLossSheet,
      "ERP Profit Loss"
    );

    XLSX.writeFile(
      workbook,
      "All-Partners-Report.xlsx"
    );
  }

  /* ==========================================================
     STYLES
  ========================================================== */

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 10px",
    backgroundColor: "#0b1220",
    color: "#ffffff",
    border:
      "1px solid #334155",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "12px",
    outline: "none",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    marginBottom: "5px",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: 700,
  };

  const sectionStyle: CSSProperties = {
    backgroundColor: "#111827",
    border:
      "1px solid #263548",
    borderRadius: "10px",
    padding: "17px",
    marginBottom: "15px",
  };

  const buttonStyle: CSSProperties = {
    border: "none",
    borderRadius: "6px",
    padding: "8px 13px",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "11px",
  };

  /* ==========================================================
     RETURN
  ========================================================== */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "18px",
        boxSizing: "border-box",
        background:
          "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
      }}
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "15px",
          gap: "10px",
          flexWrap: "wrap",
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
            PARTNERS
          </h1>

          <div
            style={{
              marginTop: "3px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Automatic ERP Profit,
            Partner Allocation,
            Payments & Balance
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
            onClick={
              exportAllPartnersPDF
            }
            style={{
              ...buttonStyle,
              backgroundColor:
                "#7f1d1d",
            }}
          >
            📄 All Partners PDF
          </button>

          <button
            onClick={
              exportAllPartnersExcel
            }
            style={{
              ...buttonStyle,
              backgroundColor:
                "#166534",
            }}
          >
            📊 All Partners Excel
          </button>

          <button
            onClick={() => {
              loadAllData();
              loadFinancialData(
                financialPeriod
              );
            }}
            disabled={
              loading ||
              financialLoading
            }
            style={{
              ...buttonStyle,
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              opacity:
                loading ||
                financialLoading
                  ? 0.6
                  : 1,
            }}
          >
            ↻ Refresh ERP Data
          </button>
        </div>
      </div>

      {/* ======================================================
          ERP PROFIT & LOSS
      ====================================================== */}

      <div
        style={{
          ...sectionStyle,
          border:
            "1px solid #164e63",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom:
              "15px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#22d3ee",
                fontSize: "17px",
              }}
            >
              AUTOMATIC ERP PROFIT & LOSS
            </h2>

            <div
              style={{
                color: "#64748b",
                fontSize: "10px",
                marginTop: "4px",
              }}
            >
              VAT-inclusive calculation
              from Sales, Sales Returns,
              Purchases and Expenses
            </div>
          </div>

          <div
            style={{
              width: "180px",
            }}
          >
            <label
              style={labelStyle}
            >
              PROFIT PERIOD
            </label>

            <input
              type="month"
              style={inputStyle}
              value={
                financialPeriod
              }
              onChange={(e) =>
                setFinancialPeriod(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(6, minmax(0, 1fr))",
            gap: "9px",
          }}
        >
          <FinanceCard
            title="SALES"
            value={salesTotal}
            color="#60a5fa"
          />

          <FinanceCard
            title="SALES RETURNS"
            value={salesReturnsTotal}
            color="#f87171"
          />

          <FinanceCard
            title="NET SALES"
            value={netSales}
            color="#22d3ee"
          />

          <FinanceCard
            title="PURCHASES"
            value={purchasesTotal}
            color="#f59e0b"
          />

          <FinanceCard
            title="EXPENSES"
            value={expensesTotal}
            color="#fb7185"
          />

          <FinanceCard
            title={
              netProfit >= 0
                ? "NET PROFIT"
                : "NET LOSS"
            }
            value={netProfit}
            color={
              netProfit >= 0
                ? "#22c55e"
                : "#ef4444"
            }
          />
        </div>

        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            backgroundColor:
              "#0b1220",
            borderRadius: "6px",
            color: "#64748b",
            fontSize: "10px",
          }}
        >
          <strong
            style={{
              color: "#94a3b8",
            }}
          >
            Calculation:
          </strong>{" "}
          Sales − Sales Returns −
          Purchases − Expenses = Net
          Profit
          <br />
          <span
            style={{
              color: "#64748b",
            }}
          >
            All amounts are taken using
            the VAT-inclusive totals stored
            in your ERP.
          </span>
        </div>
      </div>

      {/* ======================================================
          DASHBOARD
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "15px",
        }}
      >
        <SummaryCard
          title="TOTAL PARTNERS"
          value={partners.length}
          color="#22d3ee"
        />

        <SummaryCard
          title="OPENING BALANCE"
          value={totalOpeningBalance}
          color="#60a5fa"
          isMoney
        />

        <SummaryCard
          title="ALLOCATED PROFIT"
          value={totalAllocatedProfit}
          color="#22c55e"
          isMoney
        />

        <SummaryCard
          title="TOTAL PAYMENTS"
          value={totalPayments}
          color="#f59e0b"
          isMoney
        />

        <SummaryCard
          title="CURRENT BALANCE"
          value={totalCurrentBalance}
          color="#c084fc"
          isMoney
        />
      </div>

      {/* ======================================================
          TABS
      ====================================================== */}

      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "15px",
          flexWrap: "wrap",
        }}
      >
        <TabButton
          active={
            activeTab ===
            "partners"
          }
          onClick={() =>
            setActiveTab(
              "partners"
            )
          }
        >
          👥 Partners
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "allocation"
          }
          onClick={() =>
            setActiveTab(
              "allocation"
            )
          }
        >
          📈 Profit Allocation
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "payments"
          }
          onClick={() =>
            setActiveTab(
              "payments"
            )
          }
        >
          💳 Partner Payments
        </TabButton>
      </div>

      {/* ======================================================
          PARTNERS TAB
      ====================================================== */}

      {activeTab ===
        "partners" && (
        <>
          <div
            style={{
              ...sectionStyle,
              display: "grid",
              gridTemplateColumns:
                "1fr",
            }}
          >
            <label
              style={labelStyle}
            >
              SEARCH PARTNER
            </label>

            <input
              style={inputStyle}
              value={search}
              placeholder="Search partner..."
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <div
            style={sectionStyle}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom:
                  "12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: "#60a5fa",
                  fontSize:
                    "16px",
                }}
              >
                PARTNER ACCOUNTS
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
                  filteredPartners.length
                }{" "}
                partners
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
                      style={
                        thStyle
                      }
                    >
                      PARTNER
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      PROFIT %
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      OPENING
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      ALLOCATED PROFIT
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      PAYMENTS
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      CURRENT BALANCE
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
                        colSpan={7}
                        style={
                          emptyStyle
                        }
                      >
                        Loading partners...
                      </td>
                    </tr>
                  ) : filteredPartners.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={
                          emptyStyle
                        }
                      >
                        No partners found.
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map(
                      (
                        partner,
                        index
                      ) => {
                        const balance =
                          getPartnerBalance(
                            partner.id
                          );

                        return (
                          <tr
                            key={
                              partner.id
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
                                  800,
                              }}
                            >
                              {
                                partner.partner_name
                              }
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  "#22d3ee",
                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                partner.profit_percentage
                              }
                              %
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              SAR{" "}
                              {money(
                                partner.opening_balance
                              )}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  "#86efac",
                              }}
                            >
                              SAR{" "}
                              {money(
                                getPartnerAllocatedProfit(
                                  partner.id
                                )
                              )}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  "#fbbf24",
                              }}
                            >
                              SAR{" "}
                              {money(
                                getPartnerPayments(
                                  partner.id
                                )
                              )}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  balance >=
                                  0
                                    ? "#c084fc"
                                    : "#fca5a5",
                                fontWeight:
                                  800,
                              }}
                            >
                              SAR{" "}
                              {money(
                                balance
                              )}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap: "5px",
                                  flexWrap:
                                    "wrap",
                                }}
                              >
                                <button
                                  onClick={() =>
                                    exportSinglePartnerPDF(
                                      partner
                                    )
                                  }
                                  style={{
                                    ...smallButtonStyle,
                                    backgroundColor:
                                      "#7f1d1d",
                                  }}
                                >
                                  PDF
                                </button>

                                <button
                                  onClick={() =>
                                    exportSinglePartnerExcel(
                                      partner
                                    )
                                  }
                                  style={{
                                    ...smallButtonStyle,
                                    backgroundColor:
                                      "#166534",
                                  }}
                                >
                                  Excel
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
        </>
      )}

      {/* ======================================================
          ALLOCATION TAB
      ====================================================== */}

      {activeTab ===
        "allocation" && (
        <>
          <div
            style={sectionStyle}
          >
            <h2
              style={{
                margin:
                  "0 0 15px 0",
                color: "#60a5fa",
                fontSize:
                  "16px",
              }}
            >
              AUTOMATIC MONTHLY PROFIT ALLOCATION
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr 1fr",
                gap: "11px",
              }}
            >
              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  ALLOCATION MONTH *
                </label>

                <input
                  type="month"
                  style={
                    inputStyle
                  }
                  value={
                    allocationForm.period_month
                  }
                  onChange={(e) => {
                    updateAllocationField(
                      "period_month",
                      e.target.value
                    );

                    setFinancialPeriod(
                      e.target.value
                    );
                  }}
                />
              </div>

              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  PERIOD START
                </label>

                <input
                  style={
                    inputStyle
                  }
                  value={
                    getPeriodFromMonth(
                      allocationForm.period_month
                    ).start
                  }
                  readOnly
                />
              </div>

              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  PERIOD END
                </label>

                <input
                  style={
                    inputStyle
                  }
                  value={
                    getPeriodFromMonth(
                      allocationForm.period_month
                    ).end
                  }
                  readOnly
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "12px",
                padding: "14px",
                backgroundColor:
                  "#0b1220",
                border:
                  "1px solid #263548",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    "10px",
                  marginBottom:
                    "5px",
                }}
              >
                ERP NET PROFIT FOR{" "}
                {getMonthName(
                  allocationForm.period_month
                )}
              </div>

              <div
                style={{
                  color:
                    netProfit >=
                    0
                      ? "#22c55e"
                      : "#ef4444",
                  fontSize:
                    "27px",
                  fontWeight:
                    800,
                }}
              >
                SAR{" "}
                {money(
                  netProfit
                )}
              </div>

              <div
                style={{
                  marginTop:
                    "10px",
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(5, minmax(0, 1fr))",
                  gap: "7px",
                }}
              >
                <MiniFinancialValue
                  title="Sales"
                  value={
                    salesTotal
                  }
                />

                <MiniFinancialValue
                  title="Returns"
                  value={
                    salesReturnsTotal
                  }
                />

                <MiniFinancialValue
                  title="Net Sales"
                  value={
                    netSales
                  }
                />

                <MiniFinancialValue
                  title="Purchases"
                  value={
                    purchasesTotal
                  }
                />

                <MiniFinancialValue
                  title="Expenses"
                  value={
                    expensesTotal
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor:
                  totalPartnerPercentage ===
                  100
                    ? "#052e16"
                    : "#450a0a",
                border:
                  totalPartnerPercentage ===
                  100
                    ? "1px solid #166534"
                    : "1px solid #991b1b",
                borderRadius:
                  "7px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "11px",
                  fontWeight:
                    700,
                  color:
                    totalPartnerPercentage ===
                    100
                      ? "#86efac"
                      : "#fca5a5",
                }}
              >
                TOTAL PARTNER PROFIT PERCENTAGE:{" "}
                {totalPartnerPercentage.toFixed(
                  2
                )}
                %
              </div>

              {totalPartnerPercentage !==
                100 && (
                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#fca5a5",
                    marginTop:
                      "4px",
                  }}
                >
                  Partner percentages must equal
                  100% before allocation.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop:
                  "12px",
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
                style={{
                  ...inputStyle,
                  height:
                    "60px",
                  padding:
                    "9px 10px",
                  resize:
                    "vertical",
                }}
                value={
                  allocationForm.notes
                }
                onChange={(e) =>
                  updateAllocationField(
                    "notes",
                    e.target.value
                  )
                }
                placeholder="Monthly allocation notes..."
              />
            </div>

            <div
              style={{
                marginTop:
                  "14px",
                padding:
                  "12px",
                backgroundColor:
                  "#0b1220",
                border:
                  "1px solid #263548",
                borderRadius:
                  "7px",
              }}
            >
              <div
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    "10px",
                  marginBottom:
                    "7px",
                }}
              >
                AUTOMATIC PARTNER DISTRIBUTION
              </div>

              {partners.map(
                (partner) => {
                  const amount =
                    netProfit *
                    (Number(
                      partner.profit_percentage
                    ) /
                      100);

                  return (
                    <div
                      key={
                        partner.id
                      }
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        padding:
                          "6px 0",
                        borderBottom:
                          "1px solid #1e293b",
                        fontSize:
                          "11px",
                      }}
                    >
                      <span>
                        {
                          partner.partner_name
                        }
                      </span>

                      <span
                        style={{
                          color:
                            "#22d3ee",
                        }}
                      >
                        {
                          partner.profit_percentage
                        }
                        %
                      </span>

                      <strong
                        style={{
                          color:
                            amount >=
                            0
                              ? "#86efac"
                              : "#fca5a5",
                        }}
                      >
                        SAR{" "}
                        {money(
                          amount
                        )}
                      </strong>
                    </div>
                  );
                }
              )}
            </div>

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                marginTop:
                  "14px",
              }}
            >
              <button
                onClick={
                  saveProfitAllocation
                }
                disabled={
                  saving ||
                  financialLoading ||
                  totalPartnerPercentage !==
                    100
                }
                style={{
                  ...buttonStyle,
                  padding:
                    "10px 25px",
                  background:
                    "linear-gradient(135deg, #059669, #16a34a)",
                  opacity:
                    saving ||
                    financialLoading ||
                    totalPartnerPercentage !==
                      100
                      ? 0.5
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : financialLoading
                  ? "Calculating ERP..."
                  : "Allocate ERP Profit"}
              </button>
            </div>
          </div>

          {/* ALLOCATION FILTER */}

          <div
            style={{
              ...sectionStyle,
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
            }}
          >
            <div>
              <label
                style={
                  labelStyle
                }
              >
                PARTNER
              </label>

              <select
                style={
                  inputStyle
                }
                value={
                  partnerFilter
                }
                onChange={(e) =>
                  setPartnerFilter(
                    e.target.value
                  )
                }
              >
                <option value="ALL">
                  All Partners
                </option>

                {partners.map(
                  (partner) => (
                    <option
                      key={
                        partner.id
                      }
                      value={
                        partner.id
                      }
                    >
                      {
                        partner.partner_name
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
                MONTH
              </label>

              <input
                type="month"
                style={
                  inputStyle
                }
                value={
                  monthFilter
                }
                onChange={(e) =>
                  setMonthFilter(
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          {/* ALLOCATION HISTORY */}

          <div
            style={sectionStyle}
          >
            <h2
              style={{
                margin:
                  "0 0 12px 0",
                color: "#60a5fa",
                fontSize:
                  "16px",
              }}
            >
              PROFIT ALLOCATION HISTORY
            </h2>

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
                  <tr>
                    <th
                      style={
                        thStyle
                      }
                    >
                      PERIOD
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      PARTNER
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      NET PROFIT
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      PROFIT %
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      ALLOCATED
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
                  {filteredAllocations.map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {formatDate(
                            item.period_start
                          )}{" "}
                          -{" "}
                          {formatDate(
                            item.period_end
                          )}
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
                          {getPartnerName(
                            item.partner_id
                          )}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          SAR{" "}
                          {money(
                            item.net_profit
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#22d3ee",
                          }}
                        >
                          {
                            item.profit_percentage
                          }
                          %
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              item.allocated_amount >=
                              0
                                ? "#86efac"
                                : "#fca5a5",
                            fontWeight:
                              800,
                          }}
                        >
                          SAR{" "}
                          {money(
                            item.allocated_amount
                          )}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              deleteAllocation(
                                item
                              )
                            }
                            disabled={
                              saving
                            }
                            style={{
                              ...smallButtonStyle,
                              backgroundColor:
                                "#dc2626",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredAllocations.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={
                          emptyStyle
                        }
                      >
                        No profit allocations
                        found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================
          PAYMENTS TAB
      ====================================================== */}

      {activeTab ===
        "payments" && (
        <>
          <div
            style={sectionStyle}
          >
            <h2
              style={{
                margin:
                  "0 0 15px 0",
                color: "#60a5fa",
                fontSize:
                  "16px",
              }}
            >
              RECORD PARTNER PAYMENT
            </h2>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr 1fr 1fr",
                gap: "11px",
              }}
            >
              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  PARTNER *
                </label>

                <select
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.partner_id
                  }
                  onChange={(e) =>
                    updatePaymentField(
                      "partner_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select Partner
                  </option>

                  {partners.map(
                    (partner) => (
                      <option
                        key={
                          partner.id
                        }
                        value={
                          partner.id
                        }
                      >
                        {
                          partner.partner_name
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
                  PAYMENT DATE *
                </label>

                <input
                  type="date"
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.payment_date
                  }
                  onChange={(e) =>
                    updatePaymentField(
                      "payment_date",
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
                  AMOUNT *
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.amount
                  }
                  placeholder="Payment amount"
                  onChange={(e) =>
                    updatePaymentField(
                      "amount",
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
                  PAYMENT METHOD *
                </label>

                <select
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.payment_method
                  }
                  onChange={(e) =>
                    updatePaymentField(
                      "payment_method",
                      e.target.value
                    )
                  }
                >
                  {PAYMENT_METHODS.map(
                    (method) => (
                      <option
                        key={
                          method
                        }
                        value={
                          method
                        }
                      >
                        {method}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "11px",
                marginTop:
                  "11px",
              }}
            >
              <div>
                <label
                  style={
                    labelStyle
                  }
                >
                  REFERENCE
                </label>

                <input
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.reference
                  }
                  placeholder="Transaction / cheque / reference"
                  onChange={(e) =>
                    updatePaymentField(
                      "reference",
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
                  REASON
                </label>

                <input
                  style={
                    inputStyle
                  }
                  value={
                    paymentForm.reason
                  }
                  placeholder="Reason for payment"
                  onChange={(e) =>
                    updatePaymentField(
                      "reason",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div
              style={{
                marginTop:
                  "11px",
              }}
            >
              <label
                style={
                  labelStyle
                }
              >
                NOTES
              </label>

              <input
                style={
                  inputStyle
                }
                value={
                  paymentForm.notes
                }
                placeholder="Payment notes..."
                onChange={(e) =>
                  updatePaymentField(
                    "notes",
                    e.target.value
                  )
                }
              />
            </div>

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "flex-end",
                marginTop:
                  "12px",
              }}
            >
              <button
                onClick={
                  savePayment
                }
                disabled={
                  saving
                }
                style={{
                  ...buttonStyle,
                  padding:
                    "9px 22px",
                  background:
                    "linear-gradient(135deg, #d97706, #ea580c)",
                  opacity:
                    saving
                      ? 0.6
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : "Record Payment"}
              </button>
            </div>
          </div>

          {/* PAYMENT FILTER */}

          <div
            style={{
              ...sectionStyle,
              display:
                "grid",
              gridTemplateColumns:
                "1fr",
            }}
          >
            <div>
              <label
                style={
                  labelStyle
                }
              >
                PARTNER
              </label>

              <select
                style={
                  inputStyle
                }
                value={
                  partnerFilter
                }
                onChange={(e) =>
                  setPartnerFilter(
                    e.target.value
                  )
                }
              >
                <option value="ALL">
                  All Partners
                </option>

                {partners.map(
                  (partner) => (
                    <option
                      key={
                        partner.id
                      }
                      value={
                        partner.id
                      }
                    >
                      {
                        partner.partner_name
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* PAYMENT HISTORY */}

          <div
            style={sectionStyle}
          >
            <h2
              style={{
                margin:
                  "0 0 12px 0",
                color: "#60a5fa",
                fontSize:
                  "16px",
              }}
            >
              PARTNER PAYMENT HISTORY
            </h2>

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
                  <tr>
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
                      PARTNER
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
                      METHOD
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      REFERENCE
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      REASON
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
                  {filteredPayments.map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td
                          style={
                            tdStyle
                          }
                        >
                          {formatDate(
                            payment.payment_date
                          )}
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
                          {getPartnerName(
                            payment.partner_id
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#fbbf24",
                            fontWeight:
                              800,
                          }}
                        >
                          SAR{" "}
                          {money(
                            payment.amount
                          )}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            payment.payment_method
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            payment.reference ||
                            "-"
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            payment.reason ||
                            "-"
                          }
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              deletePayment(
                                payment
                              )
                            }
                            disabled={
                              saving
                            }
                            style={{
                              ...smallButtonStyle,
                              backgroundColor:
                                "#dc2626",
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredPayments.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={
                          emptyStyle
                        }
                      >
                        No partner payments
                        found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   FINANCE CARD
============================================================ */

function FinanceCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor:
          "#0b1220",
        border:
          "1px solid #263548",
        borderLeft:
          `3px solid ${color}`,
        borderRadius:
          "7px",
        padding:
          "10px",
      }}
    >
      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "8px",
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
            "14px",
          fontWeight:
            800,
        }}
      >
        SAR {money(value)}
      </div>
    </div>
  );
}

/* ============================================================
   MINI FINANCIAL VALUE
============================================================ */

function MiniFinancialValue({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding:
          "7px",
        backgroundColor:
          "#111827",
        borderRadius:
          "5px",
      }}
    >
      <div
        style={{
          color:
            "#64748b",
          fontSize:
            "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color:
            "#cbd5e1",
          fontSize:
            "10px",
          fontWeight:
            700,
          marginTop:
            "2px",
        }}
      >
        SAR {money(value)}
      </div>
    </div>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  title,
  value,
  color,
  isMoney,
}: {
  title: string;
  value: number;
  color: string;
  isMoney?: boolean;
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
            "17px",
          fontWeight:
            800,
        }}
      >
        {isMoney
          ? `SAR ${money(value)}`
          : value.toLocaleString(
              "en-US"
            )}
      </div>
    </div>
  );
}

/* ============================================================
   TAB BUTTON
============================================================ */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border:
          active
            ? "1px solid #22d3ee"
            : "1px solid #334155",
        borderRadius:
          "6px",
        padding:
          "8px 14px",
        backgroundColor:
          active
            ? "#164e63"
            : "#111827",
        color:
          active
            ? "#67e8f9"
            : "#94a3b8",
        cursor:
          "pointer",
        fontWeight:
          700,
        fontSize:
          "11px",
      }}
    >
      {children}
    </button>
  );
}

/* ============================================================
   TABLE STYLES
============================================================ */

const thStyle: CSSProperties = {
  padding:
    "8px 7px",
  textAlign:
    "left",
  color:
    "#67e8f9",
  fontWeight:
    700,
  whiteSpace:
    "nowrap",
  borderBottom:
    "1px solid #263548",
};

const tdStyle: CSSProperties = {
  padding:
    "7px",
  color:
    "#cbd5e1",
  whiteSpace:
    "nowrap",
  borderBottom:
    "1px solid #1e293b",
};

const emptyStyle: CSSProperties = {
  padding:
    "25px",
  textAlign:
    "center",
  color:
    "#64748b",
};

const smallButtonStyle: CSSProperties = {
  border: "none",
  borderRadius:
    "4px",
  padding:
    "5px 8px",
  color:
    "#ffffff",
  cursor:
    "pointer",
  fontSize:
    "10px",
  fontWeight:
    700,
};

/* ============================================================
   EXPORT
============================================================ */

export default Partners;