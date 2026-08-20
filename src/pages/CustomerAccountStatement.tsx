import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

/*
==========================================================
 COMPANY INFORMATION
==========================================================
 Replace only the values below with your actual company
 information.
==========================================================
*/

const COMPANY_NAME = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";

const COMPANY_CR_NO = "CR NO: __________________";
const COMPANY_VAT_NO = "VAT NO: __________________";

const COMPANY_ADDRESS =
  "Riyadh, Kingdom of Saudi Arabia";

const COMPANY_PHONE =
  "Tel: __________________";

const COMPANY_EMAIL =
  "Email: __________________";

/*
==========================================================
 TYPES
==========================================================
*/

type Customer = {
  id: number;
  customer_name: string;
  phone: string | null;
  active: boolean | null;
  party_type: string | null;
};

type Sale = {
  id: number;
  created_at: string | null;
  sales_date: string;
  delivery_note_no: string | null;
  customer_name: string | null;
  item_id: number | null;
  driver_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_percent: number | null;
  total_amount: number | null;
  payment_type: string | null;
  notes: string | null;
  branch_id: string | null;
  sales_description: string | null;
  description: string | null;
  invoice_status: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  erp_invoice_number: string | null;
  erp_invoice_date: string | null;
  erp_invoice_status: string | null;
};

type CustomerPayment = {
  id: number;
  created_at: string | null;
  payment_date: string;
  customer_id: number;
  amount: number | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  branch_id: string | null;
  payment_number: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};



type TabType = "statement" | "balances";

/*
==========================================================
 COMPONENT
==========================================================
*/

function CustomerAccountStatement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] =
    useState<CustomerPayment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState<TabType>("statement");

  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");

  const [customerSearch, setCustomerSearch] =
    useState("");

  const [statementFromDate, setStatementFromDate] =
    useState("");

  const [statementToDate, setStatementToDate] =
    useState("");

  const [statementBranch, setStatementBranch] =
    useState("");

  const [balanceSearch, setBalanceSearch] =
    useState("");

  const [balanceStatus, setBalanceStatus] =
    useState("ALL");

  const [balanceBranch, setBalanceBranch] =
    useState("");

  const [balanceAsOfDate, setBalanceAsOfDate] =
    useState(
      new Date().toISOString().split("T")[0]
    );

  const [showCustomerDropdown, setShowCustomerDropdown] =
    useState(false);

  /*
  ==========================================================
  LOAD DATA
  ==========================================================
  */

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);

    try {
      const [
        customersResult,
        salesResult,
        paymentsResult,
        branchesResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, customer_name, phone, active, party_type"
          )
          .order("customer_name", {
            ascending: true,
          }),

        supabase
          .from("sales")
          .select("*")
          .order("sales_date", {
            ascending: true,
          }),

        supabase
          .from("customer_payments")
          .select("*")
          .order("payment_date", {
            ascending: true,
          }),

        supabase
          .from("branches")
          .select("id, branch_name")
          .order("branch_name", {
            ascending: true,
          }),
      ]);

      if (customersResult.error) {
        throw new Error(
          `Customers: ${customersResult.error.message}`
        );
      }

      if (salesResult.error) {
        throw new Error(
          `Sales: ${salesResult.error.message}`
        );
      }

      if (paymentsResult.error) {
        throw new Error(
          `Customer Payments: ${paymentsResult.error.message}`
        );
      }

      if (branchesResult.error) {
        console.error(
          "Branches:",
          branchesResult.error.message
        );
      }

      setCustomers(customersResult.data || []);
      setSales(salesResult.data || []);
      setPayments(paymentsResult.data || []);
      setBranches(branchesResult.data || []);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load customer account data."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  ==========================================================
  GENERAL HELPERS
  ==========================================================
  */

  function normalizeCustomerName(
    value: string | null | undefined
  ) {
    return (value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  

  function getBranchName(
    branchId: string | null | undefined
  ) {
    if (!branchId) {
      return "-";
    }

    return (
      branches.find(
        (branch) => branch.id === branchId
      )?.branch_name || branchId
    );
  }

  function formatMoney(value: number) {
    return `SAR ${Number(value || 0).toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  function formatDate(
    value: string | null | undefined
  ) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-GB");
  }

  function getSelectedCustomer() {
    if (!selectedCustomerId) {
      return null;
    }

    return (
      customers.find(
        (customer) =>
          customer.id ===
          Number(selectedCustomerId)
      ) || null
    );
  }

  /*
  ==========================================================
  CUSTOMER SEARCH
  ==========================================================
  */

  const customerOptions = useMemo(() => {
    const search = customerSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return customers
        .filter(
          (customer) =>
            customer.active !== false
        )
        .slice(0, 25);
    }

    return customers
      .filter((customer) => {
        const name =
          customer.customer_name?.toLowerCase() ||
          "";

        const phone =
          customer.phone?.toLowerCase() || "";

        return (
          name.includes(search) ||
          phone.includes(search)
        );
      })
      .slice(0, 25);
  }, [customers, customerSearch]);

  function selectCustomer(customer: Customer) {
    setSelectedCustomerId(
      String(customer.id)
    );

    setCustomerSearch(
      customer.customer_name
    );

    setShowCustomerDropdown(false);
  }

  /*
  ==========================================================
  SELECTED CUSTOMER SALES
  ==========================================================
  */

  const selectedCustomerSales = useMemo(() => {
    const customer =
      getSelectedCustomer();

    if (!customer) {
      return [];
    }

    const selectedName =
      normalizeCustomerName(
        customer.customer_name
      );

    return sales.filter(
      (sale) =>
        normalizeCustomerName(
          sale.customer_name
        ) === selectedName
    );
  }, [
    sales,
    selectedCustomerId,
    customers,
  ]);

  /*
  ==========================================================
  SELECTED CUSTOMER PAYMENTS
  ==========================================================
  */

  const selectedCustomerPayments =
    useMemo(() => {
      if (!selectedCustomerId) {
        return [];
      }

      return payments.filter(
        (payment) =>
          Number(payment.customer_id) ===
          Number(selectedCustomerId)
      );
    }, [payments, selectedCustomerId]);

  /*
  ==========================================================
  STATEMENT ROWS
  ==========================================================
  */

  const statementRows = useMemo(() => {
    const rows: Array<{
      date: string;
      type: "SALE" | "PAYMENT";
      reference: string;
      description: string;
      debit: number;
      credit: number;
      branch: string;
      id: number;
      vatPercent?: number;
      quantity?: number;
      paymentMethod?: string;
      deliveryNote?: string;
    }> = [];

    selectedCustomerSales.forEach(
      (sale) => {
        const date = sale.sales_date;

        if (
          statementFromDate &&
          date < statementFromDate
        ) {
          return;
        }

        if (
          statementToDate &&
          date > statementToDate
        ) {
          return;
        }

        if (
          statementBranch &&
          sale.branch_id !== statementBranch
        ) {
          return;
        }

        const reference =
          sale.erp_invoice_number ||
          sale.invoice_number ||
          (sale.delivery_note_no
            ? `DN-${sale.delivery_note_no}`
            : `SALE-${sale.id}`);

        const description =
          sale.sales_description ||
          sale.description ||
          "Customer Sale";

        rows.push({
          date,
          type: "SALE",
          reference,
          description,
          debit: Number(
            sale.total_amount || 0
          ),
          credit: 0,
          branch: getBranchName(
            sale.branch_id
          ),
          id: sale.id,
          vatPercent:
            Number(
              sale.vat_percent || 0
            ),
          quantity:
            Number(
              sale.quantity || 0
            ),
          deliveryNote:
            sale.delivery_note_no ||
            undefined,
        });
      }
    );

    selectedCustomerPayments.forEach(
      (payment) => {
        const date = payment.payment_date;

        if (
          statementFromDate &&
          date < statementFromDate
        ) {
          return;
        }

        if (
          statementToDate &&
          date > statementToDate
        ) {
          return;
        }

        if (
          statementBranch &&
          payment.branch_id !==
            statementBranch
        ) {
          return;
        }

        rows.push({
          date,
          type: "PAYMENT",
          reference:
            payment.payment_number ||
            payment.reference_number ||
            `PAY-${payment.id}`,
          description:
            payment.notes ||
            "Customer Payment",
          debit: 0,
          credit: Number(
            payment.amount || 0
          ),
          branch: getBranchName(
            payment.branch_id
          ),
          id: payment.id,
          paymentMethod:
            payment.payment_method ||
            "-",
        });
      }
    );

    rows.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(
          b.date
        );
      }

      if (a.type === b.type) {
        return a.id - b.id;
      }

      return a.type === "SALE" ? -1 : 1;
    });

    let runningBalance = 0;

    return rows.map((row) => {
      runningBalance +=
        row.debit - row.credit;

      return {
        ...row,
        balance: runningBalance,
      };
    });
  }, [
    selectedCustomerSales,
    selectedCustomerPayments,
    statementFromDate,
    statementToDate,
    statementBranch,
    branches,
  ]);

  /*
  ==========================================================
  STATEMENT TOTALS
  ==========================================================
  */

  const statementTotalSales =
    useMemo(
      () =>
        statementRows.reduce(
          (total, row) =>
            total + row.debit,
          0
        ),
      [statementRows]
    );

  const statementTotalPayments =
    useMemo(
      () =>
        statementRows.reduce(
          (total, row) =>
            total + row.credit,
          0
        ),
      [statementRows]
    );

  const statementClosingBalance =
    statementTotalSales -
    statementTotalPayments;

  /*
  ==========================================================
  OPENING BALANCE
  ==========================================================
  */

  const openingBalance = useMemo(() => {
    const customer =
      getSelectedCustomer();

    if (!customer || !statementFromDate) {
      return 0;
    }

    const customerName =
      normalizeCustomerName(
        customer.customer_name
      );

    let balance = 0;

    sales.forEach((sale) => {
      if (
        normalizeCustomerName(
          sale.customer_name
        ) !== customerName
      ) {
        return;
      }

      if (
        sale.sales_date >=
        statementFromDate
      ) {
        return;
      }

      if (
        statementBranch &&
        sale.branch_id !== statementBranch
      ) {
        return;
      }

      balance += Number(
        sale.total_amount || 0
      );
    });

    payments.forEach((payment) => {
      if (
        Number(payment.customer_id) !==
        Number(customer.id)
      ) {
        return;
      }

      if (
        payment.payment_date >=
        statementFromDate
      ) {
        return;
      }

      if (
        statementBranch &&
        payment.branch_id !==
          statementBranch
      ) {
        return;
      }

      balance -= Number(
        payment.amount || 0
      );
    });

    return balance;
  }, [
    statementFromDate,
    statementBranch,
    selectedCustomerId,
    customers,
    sales,
    payments,
  ]);

  const finalStatementBalance =
    openingBalance +
    statementClosingBalance;

  /*
  ==========================================================
  CUSTOMER BALANCES
  ==========================================================
  */

  const customerBalances =
    useMemo(() => {
      const asOfDate =
        balanceAsOfDate ||
        new Date()
          .toISOString()
          .split("T")[0];

      return customers
        .filter(
          (customer) =>
            customer.active !== false
        )
        .map((customer) => {
          const customerName =
            normalizeCustomerName(
              customer.customer_name
            );

          const customerSales =
            sales.filter((sale) => {
              if (
                normalizeCustomerName(
                  sale.customer_name
                ) !== customerName
              ) {
                return false;
              }

              if (
                sale.sales_date >
                asOfDate
              ) {
                return false;
              }

              if (
                balanceBranch &&
                sale.branch_id !==
                  balanceBranch
              ) {
                return false;
              }

              return true;
            });

          const customerPayments =
            payments.filter((payment) => {
              if (
                Number(
                  payment.customer_id
                ) !== Number(customer.id)
              ) {
                return false;
              }

              if (
                payment.payment_date >
                asOfDate
              ) {
                return false;
              }

              if (
                balanceBranch &&
                payment.branch_id !==
                  balanceBranch
              ) {
                return false;
              }

              return true;
            });

          const totalSales =
            customerSales.reduce(
              (total, sale) =>
                total +
                Number(
                  sale.total_amount || 0
                ),
              0
            );

          const totalPayments =
            customerPayments.reduce(
              (total, payment) =>
                total +
                Number(
                  payment.amount || 0
                ),
              0
            );

          const balance =
            totalSales -
            totalPayments;

          let status:
            | "DUE"
            | "PAID"
            | "ADVANCE";

          if (balance > 0.009) {
            status = "DUE";
          } else if (
            balance < -0.009
          ) {
            status = "ADVANCE";
          } else {
            status = "PAID";
          }

          return {
            customer,
            totalSales,
            totalPayments,
            balance,
            status,
          };
        });
    }, [
      customers,
      sales,
      payments,
      balanceAsOfDate,
      balanceBranch,
    ]);

  const filteredCustomerBalances =
    useMemo(() => {
      const search =
        balanceSearch
          .trim()
          .toLowerCase();

      return customerBalances
        .filter((item) => {
          if (!search) {
            return true;
          }

          return (
            item.customer.customer_name
              .toLowerCase()
              .includes(search) ||
            (
              item.customer.phone ||
              ""
            )
              .toLowerCase()
              .includes(search)
          );
        })
        .filter((item) => {
          if (
            balanceStatus === "ALL"
          ) {
            return true;
          }

          return (
            item.status ===
            balanceStatus
          );
        })
        .sort(
          (a, b) =>
            b.balance - a.balance
        );
    }, [
      customerBalances,
      balanceSearch,
      balanceStatus,
    ]);

  const allCustomerSales =
    useMemo(
      () =>
        filteredCustomerBalances.reduce(
          (total, item) =>
            total + item.totalSales,
          0
        ),
      [filteredCustomerBalances]
    );

  const allCustomerPayments =
    useMemo(
      () =>
        filteredCustomerBalances.reduce(
          (total, item) =>
            total + item.totalPayments,
          0
        ),
      [filteredCustomerBalances]
    );

  const allCustomerDue =
    useMemo(
      () =>
        filteredCustomerBalances.reduce(
          (total, item) =>
            total +
            Math.max(
              item.balance,
              0
            ),
          0
        ),
      [filteredCustomerBalances]
    );

  /*
  ==========================================================
  PDF HELPERS
  ==========================================================
  */

  function pdfText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    options?: {
      size?: number;
      bold?: boolean;
      align?:
        | "left"
        | "center"
        | "right";
      color?: [number, number, number];
    }
  ) {
    doc.setFontSize(
      options?.size || 8
    );

    doc.setFont(
      "helvetica",
      options?.bold
        ? "bold"
        : "normal"
    );

    if (options?.color) {
      doc.setTextColor(
        options.color[0],
        options.color[1],
        options.color[2]
      );
    }

    doc.text(
      text || "",
      x,
      y,
      {
        align:
          options?.align || "left",
      }
    );
  }

  function moneyPdf(
    doc: jsPDF,
    value: number,
    x: number,
    y: number,
    options?: {
      bold?: boolean;
      color?: [number, number, number];
      size?: number;
    }
  ) {
    pdfText(
      doc,
      Number(value || 0).toLocaleString(
        "en-US",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      ),
      x,
      y,
      {
        size: options?.size || 7,
        bold: options?.bold,
        color:
          options?.color,
        align: "right",
      }
    );
  }

  function pdfHeader(
    doc: jsPDF,
    title: string,
    statementNo: string
  ) {
    const pageWidth =
      doc.internal.pageSize.getWidth();

    /*
    Main company header
    */

    doc.setFillColor(
      20,
      31,
      48
    );

    doc.rect(
      0,
      0,
      pageWidth,
      35,
      "F"
    );

    /*
    Company accent
    */

    doc.setFillColor(
      18,
      135,
      170
    );

    doc.rect(
      0,
      0,
      5,
      35,
      "F"
    );

    pdfText(
      doc,
      COMPANY_NAME,
      13,
      10,
      {
        size: 14,
        bold: true,
        color: [
          255,
          255,
          255,
        ],
      }
    );

    pdfText(
      doc,
      COMPANY_NAME_AR,
      pageWidth - 13,
      10,
      {
        size: 10,
        bold: true,
        color: [
          255,
          255,
          255,
        ],
        align: "right",
      }
    );

    pdfText(
      doc,
      COMPANY_ADDRESS,
      13,
      17,
      {
        size: 7,
        color: [
          203,
          213,
          225,
        ],
      }
    );

    pdfText(
      doc,
      `${COMPANY_PHONE}   |   ${COMPANY_EMAIL}`,
      13,
      23,
      {
        size: 6.5,
        color: [
          148,
          163,
          184,
        ],
      }
    );

    pdfText(
      doc,
      `${COMPANY_CR_NO}    |    ${COMPANY_VAT_NO}`,
      pageWidth - 13,
      23,
      {
        size: 6.5,
        color: [
          148,
          163,
          184,
        ],
        align: "right",
      }
    );

    pdfText(
      doc,
      title,
      pageWidth - 13,
      31,
      {
        size: 9,
        bold: true,
        color: [
          103,
          232,
          249,
        ],
        align: "right",
      }
    );

    pdfText(
      doc,
      `Statement No: ${statementNo}`,
      13,
      31,
      {
        size: 7,
        bold: true,
        color: [
          203,
          213,
          225,
        ],
      }
    );
  }

  function pdfFooter(
    doc: jsPDF
  ) {
    const pageCount =
      doc.getNumberOfPages();

    const pageWidth =
      doc.internal.pageSize.getWidth();

    const pageHeight =
      doc.internal.pageSize.getHeight();

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      doc.setPage(page);

      doc.setDrawColor(
        203,
        213,
        225
      );

      doc.line(
        10,
        pageHeight - 14,
        pageWidth - 10,
        pageHeight - 14
      );

      pdfText(
        doc,
        `${COMPANY_NAME} | Customer Account Statement`,
        10,
        pageHeight - 8,
        {
          size: 6,
          color: [
            100,
            116,
            139,
          ],
        }
      );

      pdfText(
        doc,
        `Page ${page} of ${pageCount}`,
        pageWidth - 10,
        pageHeight - 8,
        {
          size: 6,
          color: [
            100,
            116,
            139,
          ],
          align: "right",
        }
      );
    }
  }

  function drawStatementTableHeader(
    doc: jsPDF,
    y: number
  ) {
    doc.setFillColor(
      31,
      48,
      67
    );

    doc.rect(
      10,
      y,
      277,
      10,
      "F"
    );

    const headers = [
      ["DATE", 12],
      ["TYPE", 35],
      ["REFERENCE", 57],
      ["DESCRIPTION", 98],
      ["DEBIT", 184],
      ["CREDIT", 216],
      ["BALANCE", 247],
    ];

    headers.forEach(
      ([label, x]) => {
        pdfText(
          doc,
          String(label),
          Number(x),
          y + 6.5,
          {
            size: 6.5,
            bold: true,
            color: [
              255,
              255,
              255,
            ],
          }
        );
      }
    );
  }

  /*
  ==========================================================
  CUSTOMER STATEMENT PDF
  ==========================================================
  */

  function exportCustomerStatementPDF() {
    const customer =
      getSelectedCustomer();

    if (!customer) {
      alert(
        "Please select a customer first."
      );
      return;
    }

    if (
      statementRows.length === 0
    ) {
      alert(
        "There are no transactions to export for this customer."
      );
      return;
    }

    const doc =
      new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

    const statementNo =
      `CAS-${new Date().getFullYear()}-${String(
        customer.id
      ).padStart(5, "0")}`;

    pdfHeader(
      doc,
      "CUSTOMER ACCOUNT STATEMENT",
      statementNo
    );

    let y = 43;

    /*
    CUSTOMER INFORMATION BOX
    */

    doc.setFillColor(
      248,
      250,
      252
    );

    doc.setDrawColor(
      203,
      213,
      225
    );

    doc.roundedRect(
      10,
      y,
      277,
      30,
      2,
      2,
      "FD"
    );

    pdfText(
      doc,
      "CUSTOMER INFORMATION",
      14,
      y + 7,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    pdfText(
      doc,
      customer.customer_name,
      14,
      y + 15,
      {
        size: 11,
        bold: true,
        color: [
          15,
          23,
          42,
        ],
      }
    );

    pdfText(
      doc,
      `Phone: ${
        customer.phone || "-"
      }`,
      14,
      y + 22,
      {
        size: 7,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfText(
      doc,
      `Party Type: ${
        customer.party_type || "Customer"
      }`,
      75,
      y + 22,
      {
        size: 7,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfText(
      doc,
      "STATEMENT PERIOD",
      145,
      y + 7,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    pdfText(
      doc,
      `${formatDate(
        statementFromDate
      )}  -  ${formatDate(
        statementToDate
      )}`,
      145,
      y + 16,
      {
        size: 9,
        bold: true,
        color: [
          15,
          23,
          42,
        ],
      }
    );

    pdfText(
      doc,
      `Branch: ${
        statementBranch
          ? getBranchName(
              statementBranch
            )
          : "All Branches"
      }`,
      145,
      y + 23,
      {
        size: 7,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfText(
      doc,
      "ACCOUNT STATUS",
      225,
      y + 7,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    const status =
      finalStatementBalance > 0.009
        ? "AMOUNT DUE"
        : finalStatementBalance <
          -0.009
        ? "CUSTOMER ADVANCE"
        : "SETTLED";

    pdfText(
      doc,
      status,
      225,
      y + 16,
      {
        size: 10,
        bold: true,
        color:
          finalStatementBalance >
          0.009
            ? [185, 28, 28]
            : finalStatementBalance <
              -0.009
            ? [37, 99, 235]
            : [22, 101, 52],
      }
    );

    moneyPdf(
      doc,
      Math.abs(
        finalStatementBalance
      ),
      275,
      y + 24,
      {
        size: 9,
        bold: true,
        color:
          finalStatementBalance >
          0.009
            ? [185, 28, 28]
            : finalStatementBalance <
              -0.009
            ? [37, 99, 235]
            : [22, 101, 52],
      }
    );

    y += 38;

    /*
    OPENING BALANCE
    */

    doc.setFillColor(
      241,
      245,
      249
    );

    doc.rect(
      10,
      y,
      277,
      13,
      "F"
    );

    pdfText(
      doc,
      "OPENING BALANCE",
      14,
      y + 8,
      {
        size: 7,
        bold: true,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    moneyPdf(
      doc,
      openingBalance,
      70,
      y + 8,
      {
        size: 8,
        bold: true,
      }
    );

    pdfText(
      doc,
      "PERIOD SALES",
      100,
      y + 8,
      {
        size: 7,
        bold: true,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    moneyPdf(
      doc,
      statementTotalSales,
      155,
      y + 8,
      {
        size: 8,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    pdfText(
      doc,
      "PAYMENTS RECEIVED",
      180,
      y + 8,
      {
        size: 7,
        bold: true,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    moneyPdf(
      doc,
      statementTotalPayments,
      235,
      y + 8,
      {
        size: 8,
        bold: true,
        color: [
          22,
          101,
          52,
        ],
      }
    );

    pdfText(
      doc,
      "CLOSING",
      247,
      y + 8,
      {
        size: 7,
        bold: true,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    moneyPdf(
      doc,
      finalStatementBalance,
      285,
      y + 8,
      {
        size: 8,
        bold: true,
      }
    );

    y += 19;

    /*
    TRANSACTION TABLE
    */

    drawStatementTableHeader(
      doc,
      y
    );

    y += 15;

    statementRows.forEach(
      (row, index) => {
        if (y > 185) {
          doc.addPage(
            "landscape"
          );

          pdfHeader(
            doc,
            "CUSTOMER ACCOUNT STATEMENT",
            statementNo
          );

          y = 43;

          pdfText(
            doc,
            customer.customer_name,
            10,
            y,
            {
              size: 9,
              bold: true,
              color: [
                31,
                78,
                121,
              ],
            }
          );

          y += 7;

          drawStatementTableHeader(
            doc,
            y
          );

          y += 15;
        }

        if (index % 2 === 0) {
          doc.setFillColor(
            248,
            250,
            252
          );

          doc.rect(
            10,
            y - 5,
            277,
            8,
            "F"
          );
        }

        pdfText(
          doc,
          formatDate(row.date),
          12,
          y,
          {
            size: 6.3,
          }
        );

        pdfText(
          doc,
          row.type === "SALE"
            ? "INVOICE"
            : "RECEIPT",
          35,
          y,
          {
            size: 6.2,
            bold: true,
            color:
              row.type === "SALE"
                ? [185, 28, 28]
                : [22, 101, 52],
          }
        );

        pdfText(
          doc,
          row.reference.substring(
            0,
            22
          ),
          57,
          y,
          {
            size: 6.2,
            bold: true,
            color: [
              31,
              78,
              121,
            ],
          }
        );

        const description =
          row.type ===
          "PAYMENT" &&
          row.paymentMethod
            ? `${row.description} (${row.paymentMethod})`
            : row.description;

        pdfText(
          doc,
          description.substring(
            0,
            42
          ),
          98,
          y,
          {
            size: 6.2,
          }
        );

        moneyPdf(
          doc,
          row.debit,
          201,
          y,
          {
            size: 6.2,
            color:
              row.debit > 0
                ? [185, 28, 28]
                : [100, 116, 139],
          }
        );

        moneyPdf(
          doc,
          row.credit,
          233,
          y,
          {
            size: 6.2,
            color:
              row.credit > 0
                ? [22, 101, 52]
                : [100, 116, 139],
          }
        );

        moneyPdf(
          doc,
          row.balance,
          285,
          y,
          {
            size: 6.5,
            bold: true,
            color:
              row.balance > 0
                ? [185, 28, 28]
                : [22, 101, 52],
          }
        );

        y += 8;
      }
    );

    /*
    TOTALS
    */

    y += 3;

    if (y > 175) {
      doc.addPage(
        "landscape"
      );

      pdfHeader(
        doc,
        "CUSTOMER ACCOUNT STATEMENT",
        statementNo
      );

      y = 45;
    }

    doc.setDrawColor(
      148,
      163,
      184
    );

    doc.line(
      165,
      y,
      287,
      y
    );

    y += 8;

    pdfText(
      doc,
      "PERIOD SALES / DEBIT",
      165,
      y,
      {
        size: 7,
        bold: true,
      }
    );

    moneyPdf(
      doc,
      statementTotalSales,
      285,
      y,
      {
        size: 7.5,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    y += 7;

    pdfText(
      doc,
      "PAYMENTS / CREDIT",
      165,
      y,
      {
        size: 7,
        bold: true,
      }
    );

    moneyPdf(
      doc,
      statementTotalPayments,
      285,
      y,
      {
        size: 7.5,
        bold: true,
        color: [
          22,
          101,
          52,
        ],
      }
    );

    y += 7;

    pdfText(
      doc,
      "OPENING BALANCE",
      165,
      y,
      {
        size: 7,
        bold: true,
      }
    );

    moneyPdf(
      doc,
      openingBalance,
      285,
      y,
      {
        size: 7.5,
        bold: true,
      }
    );

    y += 9;

    doc.setFillColor(
      finalStatementBalance >
      0
        ? 254
        : 240,
      finalStatementBalance >
      0
        ? 242
        : 253,
      finalStatementBalance >
      0
        ? 242
        : 244
    );

    doc.roundedRect(
      160,
      y - 5,
      127,
      18,
      2,
      2,
      "F"
    );

    pdfText(
      doc,
      status,
      165,
      y + 2,
      {
        size: 7,
        bold: true,
        color:
          finalStatementBalance >
          0.009
            ? [185, 28, 28]
            : finalStatementBalance <
              -0.009
            ? [37, 99, 235]
            : [22, 101, 52],
      }
    );

    moneyPdf(
      doc,
      Math.abs(
        finalStatementBalance
      ),
      282,
      y + 3,
      {
        size: 10,
        bold: true,
        color:
          finalStatementBalance >
          0.009
            ? [185, 28, 28]
            : finalStatementBalance <
              -0.009
            ? [37, 99, 235]
            : [22, 101, 52],
      }
    );

    /*
    TERMS / SIGNATURES
    */

    y += 27;

    pdfText(
      doc,
      "ACCOUNT NOTES",
      10,
      y,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    pdfText(
      doc,
      "This statement is generated from the accounting records maintained in AL SHAMS ERP.",
      10,
      y + 7,
      {
        size: 6.5,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfText(
      doc,
      "Please review the statement and notify the company of any discrepancy.",
      10,
      y + 14,
      {
        size: 6.5,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfText(
      doc,
      "CUSTOMER ACKNOWLEDGEMENT",
      120,
      y,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    pdfText(
      doc,
      "Customer Signature",
      120,
      y + 17,
      {
        size: 6.5,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    doc.line(
      120,
      y + 19,
      178,
      y + 19
    );

    pdfText(
      doc,
      "Date",
      185,
      y + 17,
      {
        size: 6.5,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    doc.line(
      197,
      y + 19,
      230,
      y + 19
    );

    pdfText(
      doc,
      "AUTHORIZED BY",
      240,
      y,
      {
        size: 7,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    doc.line(
      240,
      y + 19,
      285,
      y + 19
    );

    pdfText(
      doc,
      "Authorized Signature",
      240,
      y + 24,
      {
        size: 6,
        color: [
          71,
          85,
          105,
        ],
      }
    );

    pdfFooter(doc);

    doc.save(
      `Customer-Statement-${customer.customer_name
        .replace(
          /[^a-zA-Z0-9\u0600-\u06FF]+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        )}.pdf`
    );
  }

  /*
  ==========================================================
  ALL CUSTOMER BALANCES PDF
  ==========================================================
  */

  function exportAllCustomersPDF() {
    if (
      filteredCustomerBalances.length ===
      0
    ) {
      alert(
        "There are no customers to export."
      );
      return;
    }

    const doc =
      new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

    const reportNo =
      `AR-${new Date().getFullYear()}-${String(
        Date.now()
      ).slice(-6)}`;

    pdfHeader(
      doc,
      "CUSTOMER RECEIVABLES REPORT",
      reportNo
    );

    let y = 43;

    /*
    REPORT SUMMARY
    */

    doc.setFillColor(
      248,
      250,
      252
    );

    doc.setDrawColor(
      203,
      213,
      225
    );

    doc.roundedRect(
      10,
      y,
      277,
      27,
      2,
      2,
      "FD"
    );

    pdfText(
      doc,
      "ACCOUNTS RECEIVABLE",
      15,
      y + 8,
      {
        size: 8,
        bold: true,
        color: [
          31,
          78,
          121,
        ],
      }
    );

    pdfText(
      doc,
      `As of ${formatDate(
        balanceAsOfDate
      )}`,
      15,
      y + 16,
      {
        size: 8,
        bold: true,
      }
    );

    pdfText(
      doc,
      "CUSTOMERS",
      95,
      y + 8,
      {
        size: 6.5,
        bold: true,
        color: [
          100,
          116,
          139,
        ],
      }
    );

    pdfText(
      doc,
      String(
        filteredCustomerBalances.length
      ),
      95,
      y + 17,
      {
        size: 11,
        bold: true,
      }
    );

    pdfText(
      doc,
      "TOTAL SALES",
      140,
      y + 8,
      {
        size: 6.5,
        bold: true,
        color: [
          100,
          116,
          139,
        ],
      }
    );

    moneyPdf(
      doc,
      allCustomerSales,
      190,
      y + 17,
      {
        size: 9,
        bold: true,
      }
    );

    pdfText(
      doc,
      "TOTAL RECEIVED",
      205,
      y + 8,
      {
        size: 6.5,
        bold: true,
        color: [
          100,
          116,
          139,
        ],
      }
    );

    moneyPdf(
      doc,
      allCustomerPayments,
      245,
      y + 17,
      {
        size: 9,
        bold: true,
        color: [
          22,
          101,
          52,
        ],
      }
    );

    pdfText(
      doc,
      "TOTAL DUE",
      255,
      y + 8,
      {
        size: 6.5,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    moneyPdf(
      doc,
      allCustomerDue,
      285,
      y + 17,
      {
        size: 9,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    y += 35;

    /*
    TABLE
    */

    function drawBalanceHeader(
      tableY: number
    ) {
      doc.setFillColor(
        31,
        48,
        67
      );

      doc.rect(
        10,
        tableY,
        277,
        11,
        "F"
      );

      const headers = [
        ["#", 13],
        ["CUSTOMER", 25],
        ["PHONE", 93],
        ["TOTAL SALES", 145],
        ["PAYMENTS", 180],
        ["BALANCE", 218],
        ["STATUS", 260],
      ];

      headers.forEach(
        ([label, x]) => {
          pdfText(
            doc,
            String(label),
            Number(x),
            tableY + 7,
            {
              size: 6.5,
              bold: true,
              color: [
                255,
                255,
                255,
              ],
            }
          );
        }
      );
    }

    drawBalanceHeader(y);

    y += 16;

    filteredCustomerBalances.forEach(
      (item, index) => {
        if (y > 185) {
          doc.addPage(
            "landscape"
          );

          pdfHeader(
            doc,
            "CUSTOMER RECEIVABLES REPORT",
            reportNo
          );

          y = 43;

          drawBalanceHeader(y);

          y += 16;
        }

        if (index % 2 === 0) {
          doc.setFillColor(
            248,
            250,
            252
          );

          doc.rect(
            10,
            y - 5,
            277,
            9,
            "F"
          );
        }

        pdfText(
          doc,
          String(index + 1),
          13,
          y,
          {
            size: 6.5,
          }
        );

        pdfText(
          doc,
          item.customer.customer_name.substring(
            0,
            34
          ),
          25,
          y,
          {
            size: 6.5,
            bold: true,
          }
        );

        pdfText(
          doc,
          (
            item.customer.phone ||
            "-"
          ).substring(0, 18),
          93,
          y,
          {
            size: 6.5,
          }
        );

        moneyPdf(
          doc,
          item.totalSales,
          170,
          y,
          {
            size: 6.5,
          }
        );

        moneyPdf(
          doc,
          item.totalPayments,
          205,
          y,
          {
            size: 6.5,
            color: [
              22,
              101,
              52,
            ],
          }
        );

        moneyPdf(
          doc,
          Math.abs(
            item.balance
          ),
          245,
          y,
          {
            size: 6.5,
            bold: true,
            color:
              item.balance > 0
                ? [185, 28, 28]
                : item.balance < 0
                ? [37, 99, 235]
                : [22, 101, 52],
          }
        );

        pdfText(
          doc,
          item.status,
          260,
          y,
          {
            size: 6.5,
            bold: true,
            color:
              item.status ===
              "DUE"
                ? [185, 28, 28]
                : item.status ===
                  "ADVANCE"
                ? [37, 99, 235]
                : [22, 101, 52],
          }
        );

        y += 9;
      }
    );

    y += 5;

    if (y > 180) {
      doc.addPage(
        "landscape"
      );

      pdfHeader(
        doc,
        "CUSTOMER RECEIVABLES REPORT",
        reportNo
      );

      y = 45;
    }

    doc.setDrawColor(
      148,
      163,
      184
    );

    doc.line(
      140,
      y,
      287,
      y
    );

    y += 8;

    pdfText(
      doc,
      "TOTAL SALES",
      160,
      y,
      {
        size: 7,
        bold: true,
      }
    );

    moneyPdf(
      doc,
      allCustomerSales,
      220,
      y,
      {
        size: 7.5,
        bold: true,
      }
    );

    y += 7;

    pdfText(
      doc,
      "TOTAL PAYMENTS",
      160,
      y,
      {
        size: 7,
        bold: true,
      }
    );

    moneyPdf(
      doc,
      allCustomerPayments,
      220,
      y,
      {
        size: 7.5,
        bold: true,
        color: [
          22,
          101,
          52,
        ],
      }
    );

    y += 8;

    doc.setFillColor(
      254,
      242,
      242
    );

    doc.roundedRect(
      145,
      y - 5,
      142,
      14,
      2,
      2,
      "F"
    );

    pdfText(
      doc,
      "TOTAL CUSTOMER DUES",
      152,
      y + 3,
      {
        size: 8,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    moneyPdf(
      doc,
      allCustomerDue,
      282,
      y + 3,
      {
        size: 8.5,
        bold: true,
        color: [
          185,
          28,
          28,
        ],
      }
    );

    pdfFooter(doc);

    doc.save(
      `Customer-Receivables-${balanceAsOfDate}.pdf`
    );
  }

  /*
  ==========================================================
  UI STYLES
  ==========================================================
  */

  const inputStyle: CSSProperties = {
    width: "100%",
    height: "40px",
    padding: "0 12px",
    boxSizing: "border-box",
    backgroundColor: "#0b1220",
    color: "#ffffff",
    border:
      "1px solid #334155",
    borderRadius: "7px",
    outline: "none",
    fontSize: "11px",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    marginBottom: "6px",
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.04em",
  };

  const thStyle: CSSProperties = {
    padding: "11px 9px",
    textAlign: "left",
    color: "#67e8f9",
    fontWeight: 800,
    whiteSpace: "nowrap",
    borderBottom:
      "1px solid #263548",
    fontSize: "10px",
  };

  const tdStyle: CSSProperties = {
    padding: "9px",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    borderBottom:
      "1px solid #1e293b",
    fontSize: "11px",
  };

  /*
  ==========================================================
  RENDER
  ==========================================================
  */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "20px",
        boxSizing: "border-box",
        background:
          "linear-gradient(135deg,#050b14,#0b1220,#111827)",
        color: "#ffffff",
      }}
    >
      {/* PAGE HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "18px",
          gap: "15px",
        }}
      >
        <div>
          <div
            style={{
              color: "#67e8f9",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing:
                "0.12em",
              marginBottom: "5px",
            }}
          >
            ACCOUNTS RECEIVABLE
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "27px",
              fontWeight: 900,
              color: "#ffffff",
            }}
          >
            CUSTOMER ACCOUNTS
          </h1>

          <div
            style={{
              marginTop: "5px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Customer statements,
            receivables and
            outstanding balances
          </div>
        </div>

        <button
          type="button"
          onClick={fetchAllData}
          disabled={loading}
          style={{
            height: "40px",
            padding: "0 18px",
            background:
              "linear-gradient(135deg,#0891b2,#2563eb)",
            color: "#ffffff",
            border: "none",
            borderRadius: "7px",
            cursor: loading
              ? "not-allowed"
              : "pointer",
            fontWeight: 800,
            fontSize: "11px",
          }}
        >
          {loading
            ? "LOADING..."
            : "↻ REFRESH DATA"}
        </button>
      </div>

      {/* TABS */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setActiveTab(
              "statement"
            )
          }
          style={{
            padding:
              "11px 20px",
            borderRadius: "7px",
            border:
              activeTab ===
              "statement"
                ? "1px solid #22d3ee"
                : "1px solid #334155",
            background:
              activeTab ===
              "statement"
                ? "#123b4a"
                : "#111827",
            color:
              activeTab ===
              "statement"
                ? "#67e8f9"
                : "#94a3b8",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: "10px",
          }}
        >
          📄 CUSTOMER STATEMENT
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab(
              "balances"
            )
          }
          style={{
            padding:
              "11px 20px",
            borderRadius: "7px",
            border:
              activeTab ===
              "balances"
                ? "1px solid #22d3ee"
                : "1px solid #334155",
            background:
              activeTab ===
              "balances"
                ? "#123b4a"
                : "#111827",
            color:
              activeTab ===
              "balances"
                ? "#67e8f9"
                : "#94a3b8",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: "10px",
          }}
        >
          📊 CUSTOMER RECEIVABLES
        </button>
      </div>

      {/* ====================================================
          CUSTOMER STATEMENT
      ==================================================== */}

      {activeTab === "statement" && (
        <>
          <div
            style={{
              background:
                "linear-gradient(135deg,#0d1726,#111827)",
              border:
                "1px solid #263548",
              borderRadius: "10px",
              padding: "17px",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "2fr 1fr 1fr 1fr auto",
                gap: "10px",
                alignItems: "end",
              }}
            >
              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <label
                  style={labelStyle}
                >
                  CUSTOMER *
                </label>

                <input
                  type="text"
                  value={
                    customerSearch
                  }
                  placeholder="Search customer by name or phone..."
                  style={inputStyle}
                  onFocus={() =>
                    setShowCustomerDropdown(
                      true
                    )
                  }
                  onChange={(e) => {
                    setCustomerSearch(
                      e.target.value
                    );

                    setSelectedCustomerId(
                      ""
                    );

                    setShowCustomerDropdown(
                      true
                    );
                  }}
                />

                {showCustomerDropdown && (
                  <div
                    style={{
                      position:
                        "absolute",
                      top: "67px",
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      maxHeight:
                        "240px",
                      overflowY:
                        "auto",
                      backgroundColor:
                        "#0b1220",
                      border:
                        "1px solid #334155",
                      borderRadius:
                        "7px",
                      boxShadow:
                        "0 20px 50px rgba(0,0,0,.55)",
                    }}
                  >
                    {customerOptions.length ===
                    0 ? (
                      <div
                        style={{
                          padding:
                            "14px",
                          color:
                            "#64748b",
                          fontSize:
                            "11px",
                        }}
                      >
                        No customers found
                      </div>
                    ) : (
                      customerOptions.map(
                        (
                          customer
                        ) => (
                          <button
                            key={
                              customer.id
                            }
                            type="button"
                            onClick={() =>
                              selectCustomer(
                                customer
                              )
                            }
                            style={{
                              width:
                                "100%",
                              padding:
                                "10px 12px",
                              background:
                                "transparent",
                              color:
                                "#ffffff",
                              border:
                                "none",
                              borderBottom:
                                "1px solid #1e293b",
                              textAlign:
                                "left",
                              cursor:
                                "pointer",
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  800,
                                fontSize:
                                  "11px",
                              }}
                            >
                              {
                                customer.customer_name
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
                              {customer.phone ||
                                "No phone"}
                              {" • "}
                              {customer.party_type ||
                                "Customer"}
                            </div>
                          </button>
                        )
                      )
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  FROM DATE
                </label>

                <input
                  type="date"
                  value={
                    statementFromDate
                  }
                  onChange={(e) =>
                    setStatementFromDate(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  TO DATE
                </label>

                <input
                  type="date"
                  value={
                    statementToDate
                  }
                  onChange={(e) =>
                    setStatementToDate(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  BRANCH
                </label>

                <select
                  value={
                    statementBranch
                  }
                  onChange={(e) =>
                    setStatementBranch(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
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

              <button
                type="button"
                onClick={
                  exportCustomerStatementPDF
                }
                disabled={
                  !selectedCustomerId
                }
                style={{
                  height: "40px",
                  padding:
                    "0 16px",
                  background:
                    !selectedCustomerId
                      ? "#374151"
                      : "linear-gradient(135deg,#dc2626,#991b1b)",
                  color:
                    "#ffffff",
                  border:
                    "none",
                  borderRadius:
                    "7px",
                  cursor:
                    !selectedCustomerId
                      ? "not-allowed"
                      : "pointer",
                  fontWeight:
                    800,
                  fontSize:
                    "10px",
                  whiteSpace:
                    "nowrap",
                }}
              >
                📄 EXPORT STATEMENT
              </button>
            </div>
          </div>

          {selectedCustomerId && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4,minmax(0,1fr))",
                gap: "12px",
                marginBottom:
                  "15px",
              }}
            >
              <div
                style={{
                  background:
                    "#111827",
                  border:
                    "1px solid #263548",
                  borderRadius:
                    "9px",
                  padding:
                    "14px",
                }}
              >
                <div
                  style={{
                    color:
                      "#94a3b8",
                    fontSize:
                      "9px",
                    fontWeight:
                      800,
                  }}
                >
                  OPENING BALANCE
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    fontSize:
                      "19px",
                    fontWeight:
                      900,
                  }}
                >
                  {formatMoney(
                    openingBalance
                  )}
                </div>
              </div>

              <div
                style={{
                  background:
                    "#111827",
                  border:
                    "1px solid #263548",
                  borderRadius:
                    "9px",
                  padding:
                    "14px",
                }}
              >
                <div
                  style={{
                    color:
                      "#f87171",
                    fontSize:
                      "9px",
                    fontWeight:
                      800,
                  }}
                >
                  PERIOD SALES
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    fontSize:
                      "19px",
                    fontWeight:
                      900,
                  }}
                >
                  {formatMoney(
                    statementTotalSales
                  )}
                </div>
              </div>

              <div
                style={{
                  background:
                    "#111827",
                  border:
                    "1px solid #263548",
                  borderRadius:
                    "9px",
                  padding:
                    "14px",
                }}
              >
                <div
                  style={{
                    color:
                      "#4ade80",
                    fontSize:
                      "9px",
                    fontWeight:
                      800,
                  }}
                >
                  PAYMENTS RECEIVED
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    fontSize:
                      "19px",
                    fontWeight:
                      900,
                  }}
                >
                  {formatMoney(
                    statementTotalPayments
                  )}
                </div>
              </div>

              <div
                style={{
                  background:
                    finalStatementBalance >
                    0
                      ? "linear-gradient(135deg,#3b1111,#111827)"
                      : "linear-gradient(135deg,#0d3320,#111827)",
                  border:
                    finalStatementBalance >
                    0
                      ? "1px solid #7f1d1d"
                      : "1px solid #166534",
                  borderRadius:
                    "9px",
                  padding:
                    "14px",
                }}
              >
                <div
                  style={{
                    color:
                      finalStatementBalance >
                      0
                        ? "#fca5a5"
                        : "#86efac",
                    fontSize:
                      "9px",
                    fontWeight:
                      800,
                  }}
                >
                  {finalStatementBalance >
                  0
                    ? "AMOUNT DUE"
                    : finalStatementBalance <
                      0
                    ? "CUSTOMER ADVANCE"
                    : "SETTLED"}
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    color:
                      finalStatementBalance >
                      0
                        ? "#f87171"
                        : "#4ade80",
                    fontSize:
                      "19px",
                    fontWeight:
                      900,
                  }}
                >
                  {formatMoney(
                    Math.abs(
                      finalStatementBalance
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              backgroundColor:
                "#111827",
              border:
                "1px solid #263548",
              borderRadius:
                "10px",
              padding:
                "17px",
            }}
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
                  "14px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      900,
                  }}
                >
                  CUSTOMER ACCOUNT STATEMENT
                </h2>

                <div
                  style={{
                    marginTop:
                      "4px",
                    color:
                      "#64748b",
                    fontSize:
                      "10px",
                  }}
                >
                  Detailed debit and credit
                  transaction history
                </div>
              </div>

              {selectedCustomerId && (
                <div
                  style={{
                    color:
                      "#67e8f9",
                    fontSize:
                      "10px",
                    fontWeight:
                      800,
                  }}
                >
                  {
                    getSelectedCustomer()
                      ?.customer_name
                  }
                </div>
              )}
            </div>

            {!selectedCustomerId ? (
              <div
                style={{
                  padding:
                    "60px 20px",
                  textAlign:
                    "center",
                  color:
                    "#64748b",
                  fontSize:
                    "12px",
                }}
              >
                Select a customer above to
                view the complete account
                statement.
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                  border:
                    "1px solid #263548",
                  borderRadius:
                    "7px",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",
                    borderCollapse:
                      "collapse",
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
                        TYPE
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
                        DESCRIPTION
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        DEBIT
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        CREDIT
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        BALANCE
                      </th>

                      <th
                        style={
                          thStyle
                        }
                      >
                        BRANCH
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {statementRows.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            8
                          }
                          style={{
                            padding:
                              "35px",
                            textAlign:
                              "center",
                            color:
                              "#64748b",
                          }}
                        >
                          No transactions found
                          for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      statementRows.map(
                        (
                          row,
                          index
                        ) => (
                          <tr
                            key={`${row.type}-${row.id}-${index}`}
                          >
                            <td
                              style={
                                tdStyle
                              }
                            >
                              {formatDate(
                                row.date
                              )}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  row.type ===
                                  "SALE"
                                    ? "#f87171"
                                    : "#4ade80",
                                fontWeight:
                                  800,
                              }}
                            >
                              {row.type ===
                              "SALE"
                                ? "INVOICE"
                                : "RECEIPT"}
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
                                row.reference
                              }
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {
                                row.description
                              }
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  "#f87171",
                                fontWeight:
                                  700,
                              }}
                            >
                              {row.debit >
                              0
                                ? formatMoney(
                                    row.debit
                                  )
                                : "-"}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  "#4ade80",
                                fontWeight:
                                  700,
                              }}
                            >
                              {row.credit >
                              0
                                ? formatMoney(
                                    row.credit
                                  )
                                : "-"}
                            </td>

                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  row.balance >
                                  0
                                    ? "#f87171"
                                    : "#4ade80",
                                fontWeight:
                                  900,
                              }}
                            >
                              {formatMoney(
                                row.balance
                              )}
                            </td>

                            <td
                              style={
                                tdStyle
                              }
                            >
                              {
                                row.branch
                              }
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>

                  {statementRows.length >
                    0 && (
                    <tfoot>
                      <tr
                        style={{
                          background:
                            "#0b1220",
                        }}
                      >
                        <td
                          colSpan={
                            4
                          }
                          style={{
                            ...tdStyle,
                            textAlign:
                              "right",
                            color:
                              "#67e8f9",
                            fontWeight:
                              900,
                          }}
                        >
                          PERIOD TOTAL
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#f87171",
                            fontWeight:
                              900,
                          }}
                        >
                          {formatMoney(
                            statementTotalSales
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              "#4ade80",
                            fontWeight:
                              900,
                          }}
                        >
                          {formatMoney(
                            statementTotalPayments
                          )}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            color:
                              finalStatementBalance >
                              0
                                ? "#f87171"
                                : "#4ade80",
                            fontWeight:
                              900,
                          }}
                        >
                          {formatMoney(
                            statementClosingBalance
                          )}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ====================================================
          ALL CUSTOMERS BALANCE
      ==================================================== */}

      {activeTab === "balances" && (
        <>
          <div
            style={{
              background:
                "linear-gradient(135deg,#0d1726,#111827)",
              border:
                "1px solid #263548",
              borderRadius:
                "10px",
              padding:
                "17px",
              marginBottom:
                "15px",
            }}
          >
            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "2fr 1fr 1fr 1fr auto",
                gap: "10px",
                alignItems:
                  "end",
              }}
            >
              <div>
                <label
                  style={labelStyle}
                >
                  SEARCH CUSTOMER
                </label>

                <input
                  type="text"
                  value={
                    balanceSearch
                  }
                  placeholder="Search by customer name or phone..."
                  onChange={(e) =>
                    setBalanceSearch(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  STATUS
                </label>

                <select
                  value={
                    balanceStatus
                  }
                  onChange={(e) =>
                    setBalanceStatus(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="ALL">
                    ALL
                  </option>

                  <option value="DUE">
                    DUE
                  </option>

                  <option value="PAID">
                    PAID
                  </option>

                  <option value="ADVANCE">
                    ADVANCE
                  </option>
                </select>
              </div>

              <div>
                <label
                  style={labelStyle}
                >
                  BRANCH
                </label>

                <select
                  value={
                    balanceBranch
                  }
                  onChange={(e) =>
                    setBalanceBranch(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
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

              <div>
                <label
                  style={labelStyle}
                >
                  AS OF DATE
                </label>

                <input
                  type="date"
                  value={
                    balanceAsOfDate
                  }
                  onChange={(e) =>
                    setBalanceAsOfDate(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <button
                type="button"
                onClick={
                  exportAllCustomersPDF
                }
                style={{
                  height:
                    "40px",
                  padding:
                    "0 16px",
                  background:
                    "linear-gradient(135deg,#dc2626,#991b1b)",
                  color:
                    "#ffffff",
                  border:
                    "none",
                  borderRadius:
                    "7px",
                  cursor:
                    "pointer",
                  fontWeight:
                    800,
                  fontSize:
                    "10px",
                  whiteSpace:
                    "nowrap",
                }}
              >
                📄 EXPORT REPORT
              </button>
            </div>
          </div>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(4,minmax(0,1fr))",
              gap: "12px",
              marginBottom:
                "15px",
            }}
          >
            <div
              style={{
                background:
                  "#111827",
                border:
                  "1px solid #263548",
                borderRadius:
                  "9px",
                padding:
                  "14px",
              }}
            >
              <div
                style={{
                  color:
                    "#67e8f9",
                  fontSize:
                    "9px",
                  fontWeight:
                    800,
                }}
              >
                ACTIVE CUSTOMERS
              </div>

              <div
                style={{
                  marginTop:
                    "6px",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                {
                  filteredCustomerBalances.length
                }
              </div>
            </div>

            <div
              style={{
                background:
                  "#111827",
                border:
                  "1px solid #263548",
                borderRadius:
                  "9px",
                padding:
                  "14px",
              }}
            >
              <div
                style={{
                  color:
                    "#f87171",
                  fontSize:
                    "9px",
                  fontWeight:
                    800,
                }}
              >
                TOTAL SALES
              </div>

              <div
                style={{
                  marginTop:
                    "6px",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                {formatMoney(
                  allCustomerSales
                )}
              </div>
            </div>

            <div
              style={{
                background:
                  "#111827",
                border:
                  "1px solid #263548",
                borderRadius:
                  "9px",
                padding:
                  "14px",
              }}
            >
              <div
                style={{
                  color:
                    "#4ade80",
                  fontSize:
                    "9px",
                  fontWeight:
                    800,
                }}
              >
                TOTAL RECEIVED
              </div>

              <div
                style={{
                  marginTop:
                    "6px",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                {formatMoney(
                  allCustomerPayments
                )}
              </div>
            </div>

            <div
              style={{
                background:
                  "linear-gradient(135deg,#3f1212,#111827)",
                border:
                  "1px solid #7f1d1d",
                borderRadius:
                  "9px",
                padding:
                  "14px",
              }}
            >
              <div
                style={{
                  color:
                    "#fca5a5",
                  fontSize:
                    "9px",
                  fontWeight:
                    800,
                }}
              >
                TOTAL RECEIVABLE
              </div>

              <div
                style={{
                  marginTop:
                    "6px",
                  color:
                    "#f87171",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                {formatMoney(
                  allCustomerDue
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor:
                "#111827",
              border:
                "1px solid #263548",
              borderRadius:
                "10px",
              padding:
                "17px",
            }}
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
                  "13px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color:
                      "#ffffff",
                    fontSize:
                      "16px",
                    fontWeight:
                      900,
                  }}
                >
                  CUSTOMER RECEIVABLES
                </h2>

                <div
                  style={{
                    marginTop:
                      "4px",
                    color:
                      "#64748b",
                    fontSize:
                      "10px",
                  }}
                >
                  Outstanding balances as
                  of{" "}
                  {formatDate(
                    balanceAsOfDate
                  )}
                </div>
              </div>

              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "10px",
                }}
              >
                {
                  filteredCustomerBalances.length
                }{" "}
                customers
              </div>
            </div>

            <div
              style={{
                width:
                  "100%",
                overflowX:
                  "auto",
                border:
                  "1px solid #263548",
                borderRadius:
                  "7px",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
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
                      #
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
                      PHONE
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      TOTAL SALES
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      TOTAL PAYMENTS
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      BALANCE / DUE
                    </th>

                    <th
                      style={
                        thStyle
                      }
                    >
                      STATUS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomerBalances.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={
                          7
                        }
                        style={{
                          padding:
                            "35px",
                          textAlign:
                            "center",
                          color:
                            "#64748b",
                        }}
                      >
                        No customers found.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerBalances.map(
                      (
                        item,
                        index
                      ) => (
                        <tr
                          key={
                            item.customer.id
                          }
                        >
                          <td
                            style={
                              tdStyle
                            }
                          >
                            {index +
                              1}
                          </td>

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
                              item
                                .customer
                                .customer_name
                            }
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            {
                              item
                                .customer
                                .phone ||
                              "-"
                            }
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              color:
                                "#f87171",
                              fontWeight:
                                700,
                            }}
                          >
                            {formatMoney(
                              item.totalSales
                            )}
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              color:
                                "#4ade80",
                              fontWeight:
                                700,
                            }}
                          >
                            {formatMoney(
                              item.totalPayments
                            )}
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              color:
                                item.balance >
                                0
                                  ? "#f87171"
                                  : item.balance <
                                    0
                                  ? "#60a5fa"
                                  : "#4ade80",
                              fontWeight:
                                900,
                            }}
                          >
                            {formatMoney(
                              Math.abs(
                                item.balance
                              )
                            )}

                            {item.balance <
                              0 &&
                              " ADVANCE"}
                          </td>

                          <td
                            style={
                              tdStyle
                            }
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "4px 9px",
                                borderRadius:
                                  "5px",
                                fontSize:
                                  "9px",
                                fontWeight:
                                  800,
                                backgroundColor:
                                  item.status ===
                                  "DUE"
                                    ? "#7f1d1d"
                                    : item.status ===
                                      "ADVANCE"
                                    ? "#1e3a8a"
                                    : "#14532d",
                                color:
                                  item.status ===
                                  "DUE"
                                    ? "#fca5a5"
                                    : item.status ===
                                      "ADVANCE"
                                    ? "#93c5fd"
                                    : "#86efac",
                              }}
                            >
                              {
                                item.status
                              }
                            </span>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>

                {filteredCustomerBalances.length >
                  0 && (
                  <tfoot>
                    <tr
                      style={{
                        backgroundColor:
                          "#0b1220",
                      }}
                    >
                      <td
                        colSpan={
                          3
                        }
                        style={{
                          ...tdStyle,
                          textAlign:
                            "right",
                          color:
                            "#67e8f9",
                          fontWeight:
                            900,
                        }}
                      >
                        TOTAL
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#f87171",
                          fontWeight:
                            900,
                        }}
                      >
                        {formatMoney(
                          allCustomerSales
                        )}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#4ade80",
                          fontWeight:
                            900,
                        }}
                      >
                        {formatMoney(
                          allCustomerPayments
                        )}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#f87171",
                          fontWeight:
                            900,
                        }}
                      >
                        {formatMoney(
                          allCustomerDue
                        )}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        DUE
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div
            style={{
              marginTop:
                "12px",
              padding:
                "12px 14px",
              backgroundColor:
                "#082f49",
              border:
                "1px solid #155e75",
              borderRadius:
                "7px",
              color:
                "#bae6fd",
              fontSize:
                "10px",
              lineHeight:
                1.6,
            }}
          >
            <strong>
              ACCOUNTING PRINCIPLE:
            </strong>{" "}
            Customer invoices/sales are recorded
            as debit transactions. Customer
            receipts are recorded as credit
            transactions. A positive balance
            represents an amount receivable from
            the customer. A negative balance
            represents an advance received from
            the customer.
          </div>
        </>
      )}
    </div>
  );
}

export default CustomerAccountStatement;