import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

type Customer = {
  id: number;
  customer_name: string;
  phone: string | null;
  active: boolean | null;
  party_type: string | null;
};

type CustomerPayment = {
  id: number;
  created_at: string | null;
  payment_date: string;
  customer_id: number;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  branch_id: string | null;
  payment_number: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type PaymentForm = {
  payment_date: string;
  customer_id: string;
  amount: string;
  payment_method: string;
  reference_number: string;
  branch_id: string;
  notes: string;
};

const emptyForm: PaymentForm = {
  payment_date: new Date().toISOString().split("T")[0],
  customer_id: "",
  amount: "",
  payment_method: "CASH",
  reference_number: "",
  branch_id: "",
  notes: "",
};

function CustomerPayments() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [form, setForm] = useState<PaymentForm>({
    ...emptyForm,
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] =
    useState(false);

  const [generatingReceiptId, setGeneratingReceiptId] =
    useState<number | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchPayments();
    fetchBranches();
  }, []);

  /*
   * =========================================================
   * FETCH CUSTOMERS
   * =========================================================
   */

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, customer_name, phone, active, party_type"
      )
      .eq("active", true)
      .in("party_type", ["CUSTOMER", "BOTH"])
      .order("customer_name", {
        ascending: true,
      });

    if (error) {
      console.error(error);

      alert(
        "Unable to load customers.\n\n" +
          error.message
      );

      return;
    }

    setCustomers(data || []);
  }

  /*
   * =========================================================
   * FETCH PAYMENTS
   * =========================================================
   */

  async function fetchPayments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_payments")
      .select("*")
      .order("id", {
        ascending: false,
      });

    setLoading(false);

    if (error) {
      console.error(error);

      alert(
        "Unable to load customer payments.\n\n" +
          error.message
      );

      return;
    }

    setPayments(data || []);
  }

  /*
   * =========================================================
   * FETCH BRANCHES
   * =========================================================
   */

  async function fetchBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_name")
      .order("branch_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Unable to load branches:",
        error.message
      );

      setBranches([]);

      return;
    }

    setBranches(data || []);
  }

  /*
   * =========================================================
   * UPDATE FORM
   * =========================================================
   */

  function updateField(
    field: keyof PaymentForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /*
   * =========================================================
   * SELECT CUSTOMER
   * =========================================================
   */

  function selectCustomer(customer: Customer) {
    updateField(
      "customer_id",
      String(customer.id)
    );

    setCustomerSearch(customer.customer_name);

    setShowCustomerDropdown(false);
  }

  /*
   * =========================================================
   * GET CUSTOMER NAME
   * =========================================================
   */

  function getCustomerName(
    customerId: number | string | null
  ) {
    if (
      customerId === null ||
      customerId === undefined ||
      customerId === ""
    ) {
      return "-";
    }

    const customer = customers.find(
      (item) =>
        item.id === Number(customerId)
    );

    return (
      customer?.customer_name ||
      "Unknown Customer"
    );
  }

  /*
   * =========================================================
   * GET CUSTOMER PHONE
   * =========================================================
   */

  function getCustomerPhone(
    customerId: number | string | null
  ) {
    if (
      customerId === null ||
      customerId === undefined ||
      customerId === ""
    ) {
      return "";
    }

    const customer = customers.find(
      (item) =>
        item.id === Number(customerId)
    );

    return customer?.phone || "";
  }

  /*
   * =========================================================
   * GET BRANCH NAME
   * =========================================================
   */

  function getBranchName(
    branchId: string | null
  ) {
    if (!branchId) {
      return "-";
    }

    const branch = branches.find(
      (item) => item.id === branchId
    );

    return branch?.branch_name || branchId;
  }

  /*
   * =========================================================
   * VALIDATE FORM
   * =========================================================
   */

  function validateForm() {
    if (!form.customer_id) {
      alert("Please select a customer.");
      return false;
    }

    const amount = Number(form.amount);

    if (
      form.amount.trim() === "" ||
      Number.isNaN(amount)
    ) {
      alert("Please enter a valid payment amount.");
      return false;
    }

    if (amount <= 0) {
      alert(
        "Payment amount must be greater than zero."
      );

      return false;
    }

    if (!form.payment_date) {
      alert("Payment date is required.");
      return false;
    }

    if (!form.payment_method) {
      alert("Please select payment method.");
      return false;
    }

    return true;
  }

  /*
   * =========================================================
   * SAVE PAYMENT
   * =========================================================
   */

  async function savePayment() {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const paymentData = {
      payment_date: form.payment_date,

      customer_id: Number(
        form.customer_id
      ),

      amount: Number(
        Number(form.amount).toFixed(2)
      ),

      payment_method:
        form.payment_method,

      reference_number:
        form.reference_number.trim() ||
        null,

      branch_id:
        form.branch_id || null,

      notes:
        form.notes.trim() || null,
    };

    let error = null;

    if (editingId !== null) {
      const result = await supabase
        .from("customer_payments")
        .update(paymentData)
        .eq("id", editingId);

      error = result.error;
    } else {
      const result = await supabase
        .from("customer_payments")
        .insert(paymentData);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);

      alert(
        "Unable to save customer payment.\n\n" +
          error.message
      );

      return;
    }

    alert(
      editingId !== null
        ? "Customer payment updated successfully."
        : "Customer payment recorded successfully."
    );

    clearForm();

    await fetchPayments();
  }

  /*
   * =========================================================
   * EDIT PAYMENT
   * =========================================================
   */

  function editPayment(
    payment: CustomerPayment
  ) {
    setEditingId(payment.id);

    setForm({
      payment_date:
        payment.payment_date ||
        new Date()
          .toISOString()
          .split("T")[0],

      customer_id:
        String(payment.customer_id),

      amount:
        payment.amount !== null &&
        payment.amount !== undefined
          ? String(payment.amount)
          : "",

      payment_method:
        payment.payment_method ||
        "CASH",

      reference_number:
        payment.reference_number ||
        "",

      branch_id:
        payment.branch_id || "",

      notes:
        payment.notes || "",
    });

    const customer = customers.find(
      (item) =>
        item.id ===
        Number(payment.customer_id)
    );

    setCustomerSearch(
      customer?.customer_name || ""
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
   * =========================================================
   * DELETE PAYMENT
   * =========================================================
   */

  async function deletePayment(
    payment: CustomerPayment
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete payment ${
          payment.payment_number ||
          "#" + payment.id
        }?\n\n` +
          `Customer: ${getCustomerName(
            payment.customer_id
          )}\n` +
          `Amount: SAR ${Number(
            payment.amount || 0
          ).toFixed(2)}`
      );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("customer_payments")
      .delete()
      .eq("id", payment.id);

    if (error) {
      console.error(error);

      alert(
        "Unable to delete payment.\n\n" +
          error.message
      );

      return;
    }

    alert(
      "Customer payment deleted successfully."
    );

    if (editingId === payment.id) {
      clearForm();
    }

    await fetchPayments();
  }

  /*
   * =========================================================
   * CLEAR FORM
   * =========================================================
   */

  function clearForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setCustomerSearch("");

    setShowCustomerDropdown(false);
  }

  /*
   * =========================================================
   * FILTER CUSTOMERS
   * =========================================================
   */

  const filteredCustomerOptions =
    useMemo(() => {
      const text =
        customerSearch
          .trim()
          .toLowerCase();

      if (!text) {
        return customers.slice(0, 20);
      }

      return customers
        .filter((customer) => {
          return (
            customer.customer_name
              ?.toLowerCase()
              .includes(text) ||
            customer.phone
              ?.toLowerCase()
              .includes(text)
          );
        })
        .slice(0, 20);
    }, [customers, customerSearch]);

  /*
   * =========================================================
   * FILTER PAYMENTS
   * =========================================================
   */

  const filteredPayments =
    useMemo(() => {
      const text =
        search.trim().toLowerCase();

      if (!text) {
        return payments;
      }

      return payments.filter(
        (payment) => {
          const customerName =
            getCustomerName(
              payment.customer_id
            ).toLowerCase();

          const paymentNumber =
            (
              payment.payment_number ||
              ""
            ).toLowerCase();

          const method =
            (
              payment.payment_method ||
              ""
            ).toLowerCase();

          const reference =
            (
              payment.reference_number ||
              ""
            ).toLowerCase();

          return (
            customerName.includes(text) ||
            paymentNumber.includes(text) ||
            method.includes(text) ||
            reference.includes(text)
          );
        }
      );
    }, [payments, search, customers]);

  /*
   * =========================================================
   * TOTAL PAYMENT AMOUNT
   * =========================================================
   */

  const totalPaymentAmount =
    useMemo(() => {
      return filteredPayments.reduce(
        (total, payment) =>
          total +
          Number(payment.amount || 0),
        0
      );
    }, [filteredPayments]);

  /*
   * =========================================================
   * CASH TOTAL
   * =========================================================
   */

  const cashTotal =
    useMemo(() => {
      return filteredPayments
        .filter(
          (payment) =>
            payment.payment_method ===
            "CASH"
        )
        .reduce(
          (total, payment) =>
            total +
            Number(payment.amount || 0),
          0
        );
    }, [filteredPayments]);

  /*
   * =========================================================
   * BANK TOTAL
   * =========================================================
   */

  const bankTotal =
    useMemo(() => {
      return filteredPayments
        .filter(
          (payment) =>
            payment.payment_method ===
            "BANK"
        )
        .reduce(
          (total, payment) =>
            total +
            Number(payment.amount || 0),
          0
        );
    }, [filteredPayments]);

  /*
   * =========================================================
   * NUMBER TO WORDS
   * =========================================================
   */

  function numberToWords(
    amount: number
  ): string {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    function convertHundreds(
      value: number
    ): string {
      let result = "";

      if (value >= 100) {
        result +=
          ones[Math.floor(value / 100)] +
          " Hundred";

        value %= 100;

        if (value > 0) {
          result += " ";
        }
      }

      if (value >= 20) {
        result +=
          tens[Math.floor(value / 10)];

        value %= 10;

        if (value > 0) {
          result +=
            " " + ones[value];
        }
      } else if (value > 0) {
        result += ones[value];
      }

      return result;
    }

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return "Zero Saudi Riyals Only";
    }

    const rounded =
      Math.round(amount * 100) / 100;

    const whole =
      Math.floor(rounded);

    const halalas =
      Math.round(
        (rounded - whole) * 100
      );

    if (whole === 0 && halalas === 0) {
      return "Zero Saudi Riyals Only";
    }

    let result = "";

    if (whole >= 1000000000) {
      const billions =
        Math.floor(
          whole / 1000000000
        );

      result +=
        convertHundreds(billions) +
        " Billion";

      const remainder =
        whole % 1000000000;

      if (remainder > 0) {
        result += " ";
      }
    }

    const millionPart =
      Math.floor(
        (whole % 1000000000) /
          1000000
      );

    if (millionPart > 0) {
      result +=
        convertHundreds(millionPart) +
        " Million";

      const remainder =
        whole % 1000000;

      if (remainder > 0) {
        result += " ";
      }
    }

    const thousandPart =
      Math.floor(
        (whole % 1000000) /
          1000
      );

    if (thousandPart > 0) {
      result +=
        convertHundreds(thousandPart) +
        " Thousand";

      const remainder =
        whole % 1000;

      if (remainder > 0) {
        result += " ";
      }
    }

    const hundredPart =
      whole % 1000;

    if (hundredPart > 0) {
      result +=
        convertHundreds(hundredPart);
    }

    result =
      result.trim() ||
      "Zero";

    result +=
      " Saudi Riyal";

    if (whole !== 1) {
      result += "s";
    }

    if (halalas > 0) {
      result +=
        " and " +
        convertHundreds(halalas) +
        " Halala";

      if (halalas !== 1) {
        result += "s";
      }
    }

    result += " Only";

    return result;
  }

  /*
   * =========================================================
   * GENERATE CUSTOMER PAYMENT RECEIPT
   * =========================================================
   */

  async function generateReceipt(
    payment: CustomerPayment
  ) {
    try {
      setGeneratingReceiptId(payment.id);

      const customerName =
        getCustomerName(
          payment.customer_id
        );

      const customerPhone =
        getCustomerPhone(
          payment.customer_id
        );

      const branchName =
        getBranchName(
          payment.branch_id
        );

      const amount = Number(
        payment.amount || 0
      );

      const paymentNumber =
        payment.payment_number ||
        `CP-${payment.id}`;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const left = 18;
      const right = 18;
      const contentWidth =
        pageWidth - left - right;

      /*
       * -------------------------------------------------------
       * HEADER
       * -------------------------------------------------------
       */

      doc.setFillColor(
        7,
        17,
        31
      );

      doc.rect(
        0,
        0,
        pageWidth,
        42,
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

      doc.setFontSize(19);

      doc.text(
        "AL SHAMS AL GHAYABA TRD EST.",
        left,
        17
      );

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.setFontSize(11);

      doc.text(
        "CUSTOMER PAYMENT RECEIPT",
        left,
        27
      );

      doc.setTextColor(
        148,
        163,
        184
      );

      doc.setFontSize(8);

      doc.text(
        "Official Customer Receipt",
        left,
        34
      );

      /*
       * -------------------------------------------------------
       * RECEIPT NUMBER / DATE
       * -------------------------------------------------------
       */

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.setFontSize(9);

      doc.text(
        "Receipt No.",
        pageWidth - right - 52,
        15
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setTextColor(
        34,
        211,
        238
      );

      doc.text(
        paymentNumber,
        pageWidth - right,
        15,
        {
          align: "right",
        }
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setTextColor(
        148,
        163,
        184
      );

      doc.text(
        "Date",
        pageWidth - right - 52,
        24
      );

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.text(
        payment.payment_date ||
          "-",
        pageWidth - right,
        24,
        {
          align: "right",
        }
      );

      /*
       * -------------------------------------------------------
       * RECEIVED FROM
       * -------------------------------------------------------
       */

      let y = 55;

      doc.setTextColor(
        15,
        23,
        42
      );

      doc.setFillColor(
        241,
        245,
        249
      );

      doc.roundedRect(
        left,
        y,
        contentWidth,
        30,
        2,
        2,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.setTextColor(
        71,
        85,
        105
      );

      doc.text(
        "RECEIVED FROM",
        left + 7,
        y + 8
      );

      doc.setFontSize(14);

      doc.setTextColor(
        15,
        23,
        42
      );

      doc.text(
        customerName,
        left + 7,
        y + 18
      );

      if (customerPhone) {
        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          100,
          116,
          139
        );

        doc.text(
          customerPhone,
          left + 7,
          y + 25
        );
      }

      y += 40;

      /*
       * -------------------------------------------------------
       * PAYMENT DETAILS TITLE
       * -------------------------------------------------------
       */

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        8,
        145,
        178
      );

      doc.text(
        "PAYMENT DETAILS",
        left,
        y
      );

      y += 7;

      /*
       * -------------------------------------------------------
       * PAYMENT DETAILS BOX
       * -------------------------------------------------------
       */

      const boxHeight = 62;

      doc.setDrawColor(
        203,
        213,
        225
      );

      doc.setLineWidth(0.35);

      doc.roundedRect(
        left,
        y,
        contentWidth,
        boxHeight,
        2,
        2,
        "S"
      );

      const columnWidth =
        contentWidth / 2;

      doc.line(
        left + columnWidth,
        y,
        left + columnWidth,
        y + boxHeight
      );

      const rowHeight =
        boxHeight / 4;

      for (let i = 1; i < 4; i++) {
        doc.line(
          left,
          y + rowHeight * i,
          left + contentWidth,
          y + rowHeight * i
        );
      }

      function drawDetail(
        label: string,
        value: string,
        x: number,
        row: number
      ) {
        const rowY =
          y +
          rowHeight * row;

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(7.5);

        doc.setTextColor(
          100,
          116,
          139
        );

        doc.text(
          label,
          x + 6,
          rowY + 7
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(9);

        doc.setTextColor(
          15,
          23,
          42
        );

        doc.text(
          value || "-",
          x + 6,
          rowY + 14
        );
      }

      drawDetail(
        "PAYMENT NUMBER",
        paymentNumber,
        left,
        0
      );

      drawDetail(
        "PAYMENT DATE",
        payment.payment_date ||
          "-",
        left + columnWidth,
        0
      );

      drawDetail(
        "PAYMENT METHOD",
        payment.payment_method ||
          "-",
        left,
        1
      );

      drawDetail(
        "REFERENCE NUMBER",
        payment.reference_number ||
          "-",
        left + columnWidth,
        1
      );

      drawDetail(
        "BRANCH",
        branchName,
        left,
        2
      );

      drawDetail(
        "CUSTOMER ID",
        String(payment.customer_id),
        left + columnWidth,
        2
      );

      drawDetail(
        "STATUS",
        "RECEIVED",
        left,
        3
      );

      drawDetail(
        "CURRENCY",
        "Saudi Riyal (SAR)",
        left + columnWidth,
        3
      );

      y += boxHeight + 14;

      /*
       * -------------------------------------------------------
       * AMOUNT SECTION
       * -------------------------------------------------------
       */

      doc.setFillColor(
        8,
        47,
        73
      );

      doc.roundedRect(
        left,
        y,
        contentWidth,
        35,
        2,
        2,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(9);

      doc.setTextColor(
        103,
        232,
        249
      );

      doc.text(
        "AMOUNT RECEIVED",
        left + 7,
        y + 10
      );

      doc.setFontSize(21);

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.text(
        `SAR ${amount.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}`,
        pageWidth - right - 7,
        y + 14,
        {
          align: "right",
        }
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7.5);

      doc.setTextColor(
        186,
        230,
        253
      );

      const amountWords =
        numberToWords(amount);

      const wrappedAmountWords =
        doc.splitTextToSize(
          amountWords,
          contentWidth - 14
        );

      doc.text(
        wrappedAmountWords,
        left + 7,
        y + 23
      );

      y += 45;

      /*
       * -------------------------------------------------------
       * NOTES
       * -------------------------------------------------------
       */

      if (
        payment.notes &&
        payment.notes.trim()
      ) {
        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(9);

        doc.setTextColor(
          8,
          145,
          178
        );

        doc.text(
          "NOTES",
          left,
          y
        );

        y += 5;

        doc.setFillColor(
          248,
          250,
          252
        );

        const noteLines =
          doc.splitTextToSize(
            payment.notes,
            contentWidth - 14
          );

        const noteHeight =
          Math.max(
            20,
            noteLines.length * 4.5 +
              10
          );

        doc.roundedRect(
          left,
          y,
          contentWidth,
          noteHeight,
          2,
          2,
          "F"
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          51,
          65,
          85
        );

        doc.text(
          noteLines,
          left + 7,
          y + 8
        );

        y += noteHeight + 12;
      }

      /*
       * -------------------------------------------------------
       * SIGNATURE SECTION
       * -------------------------------------------------------
       */

      const signatureY =
        Math.min(
          y + 10,
          pageHeight - 55
        );

      doc.setDrawColor(
        148,
        163,
        184
      );

      doc.setLineWidth(0.3);

      doc.line(
        left,
        signatureY + 17,
        left + 55,
        signatureY + 17
      );

      doc.line(
        pageWidth - right - 55,
        signatureY + 17,
        pageWidth - right,
        signatureY + 17
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        100,
        116,
        139
      );

      doc.text(
        "Received By",
        left,
        signatureY + 23
      );

      doc.text(
        "Customer Signature",
        pageWidth - right - 55,
        signatureY + 23
      );

      /*
       * -------------------------------------------------------
       * FOOTER
       * -------------------------------------------------------
       */

      doc.setFillColor(
        7,
        17,
        31
      );

      doc.rect(
        0,
        pageHeight - 20,
        pageWidth,
        20,
        "F"
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);

      doc.setTextColor(
        148,
        163,
        184
      );

      doc.text(
        "This is a computer-generated customer payment receipt.",
        pageWidth / 2,
        pageHeight - 12,
        {
          align: "center",
        }
      );

      doc.setTextColor(
        34,
        211,
        238
      );

      doc.text(
        "AL SHAMS ERP",
        pageWidth / 2,
        pageHeight - 7,
        {
          align: "center",
        }
      );

      /*
       * -------------------------------------------------------
       * SAVE PDF
       * -------------------------------------------------------
       */

      const safeCustomerName =
        customerName
          .replace(
            /[^a-zA-Z0-9-_ ]/g,
            ""
          )
          .trim()
          .replace(/\s+/g, "_") ||
        "Customer";

      const fileName =
        `Customer_Payment_Receipt_${paymentNumber}_${safeCustomerName}.pdf`;

      doc.save(fileName);
    } catch (error) {
      console.error(
        "Receipt generation error:",
        error
      );

      alert(
        "Unable to generate customer payment receipt.\n\n" +
          "Please check the browser console for details."
      );
    } finally {
      setGeneratingReceiptId(null);
    }
  }

  /*
   * =========================================================
   * STYLES
   * =========================================================
   */

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "39px",
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

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

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
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
          gap: "15px",
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
            CUSTOMER PAYMENTS
          </h1>

          <div
            style={{
              marginTop: "4px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Customer Receipts & Payment Management
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "7px",
            padding: "8px 14px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {payments.length} Payments
        </div>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, #111827, #0f2538)",
            border:
              "1px solid #164e63",
            borderRadius: "9px",
            padding: "14px",
          }}
        >
          <div
            style={{
              color: "#67e8f9",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            TOTAL RECEIVED
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 800,
            }}
          >
            SAR{" "}
            {totalPaymentAmount.toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#111827",
            border:
              "1px solid #263548",
            borderRadius: "9px",
            padding: "14px",
          }}
        >
          <div
            style={{
              color: "#4ade80",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            CASH RECEIVED
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 800,
            }}
          >
            SAR{" "}
            {cashTotal.toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#111827",
            border:
              "1px solid #263548",
            borderRadius: "9px",
            padding: "14px",
          }}
        >
          <div
            style={{
              color: "#60a5fa",
              fontSize: "10px",
              fontWeight: 700,
            }}
          >
            BANK RECEIVED
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#ffffff",
              fontSize: "20px",
              fontWeight: 800,
            }}
          >
            SAR{" "}
            {bankTotal.toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          PAYMENT FORM
      ===================================================== */}

      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#60a5fa",
                fontSize: "16px",
              }}
            >
              {editingId !== null
                ? "EDIT CUSTOMER PAYMENT"
                : "RECEIVE CUSTOMER PAYMENT"}
            </h2>

            <div
              style={{
                marginTop: "3px",
                color: "#64748b",
                fontSize: "10px",
              }}
            >
              Record money received from a customer
            </div>
          </div>

          {editingId !== null && (
            <button
              onClick={clearForm}
              style={{
                backgroundColor: "#374151",
                color: "#ffffff",
                border: "none",
                borderRadius: "5px",
                padding: "7px 13px",
                cursor: "pointer",
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginBottom: "10px",
          }}
        >
          PAYMENT INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          {/* CUSTOMER */}

          <div
            style={{
              position: "relative",
            }}
          >
            <label style={labelStyle}>
              CUSTOMER *
            </label>

            <input
              type="text"
              style={inputStyle}
              value={customerSearch}
              placeholder="Search customer..."
              onFocus={() =>
                setShowCustomerDropdown(
                  true
                )
              }
              onChange={(e) => {
                setCustomerSearch(
                  e.target.value
                );

                updateField(
                  "customer_id",
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
                  position: "absolute",
                  top: "64px",
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  maxHeight: "230px",
                  overflowY: "auto",
                  backgroundColor: "#0b1220",
                  border:
                    "1px solid #334155",
                  borderRadius: "6px",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                {filteredCustomerOptions.length ===
                0 ? (
                  <div
                    style={{
                      padding: "12px",
                      color: "#64748b",
                      fontSize: "11px",
                    }}
                  >
                    No customers found
                  </div>
                ) : (
                  filteredCustomerOptions.map(
                    (customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() =>
                          selectCustomer(
                            customer
                          )
                        }
                        style={{
                          width: "100%",
                          padding:
                            "9px 10px",
                          backgroundColor:
                            "transparent",
                          color: "#ffffff",
                          border: "none",
                          borderBottom:
                            "1px solid #1e293b",
                          textAlign:
                            "left",
                          cursor:
                            "pointer",
                          fontSize:
                            "11px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          {
                            customer.customer_name
                          }
                        </div>

                        {customer.phone && (
                          <div
                            style={{
                              marginTop:
                                "2px",
                              color:
                                "#64748b",
                              fontSize:
                                "9px",
                            }}
                          >
                            {
                              customer.phone
                            }
                          </div>
                        )}
                      </button>
                    )
                  )
                )}
              </div>
            )}
          </div>

          {/* DATE */}

          <div>
            <label style={labelStyle}>
              PAYMENT DATE *
            </label>

            <input
              type="date"
              style={inputStyle}
              value={form.payment_date}
              onChange={(e) =>
                updateField(
                  "payment_date",
                  e.target.value
                )
              }
            />
          </div>

          {/* AMOUNT */}

          <div>
            <label style={labelStyle}>
              AMOUNT (SAR) *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              style={{
                ...inputStyle,
                border:
                  "1px solid #0891b2",
                fontWeight: 700,
              }}
              value={form.amount}
              placeholder="0.00"
              onChange={(e) =>
                updateField(
                  "amount",
                  e.target.value
                )
              }
            />
          </div>

          {/* METHOD */}

          <div>
            <label style={labelStyle}>
              PAYMENT METHOD *
            </label>

            <select
              style={inputStyle}
              value={form.payment_method}
              onChange={(e) =>
                updateField(
                  "payment_method",
                  e.target.value
                )
              }
            >
              <option value="CASH">
                CASH
              </option>

              <option value="BANK">
                BANK
              </option>
            </select>
          </div>

          {/* REFERENCE */}

          <div>
            <label style={labelStyle}>
              REFERENCE NUMBER
            </label>

            <input
              type="text"
              style={inputStyle}
              value={
                form.reference_number
              }
              placeholder="Receipt / bank reference"
              onChange={(e) =>
                updateField(
                  "reference_number",
                  e.target.value
                )
              }
            />
          </div>

          {/* BRANCH */}

          <div>
            <label style={labelStyle}>
              BRANCH
            </label>

            <select
              style={inputStyle}
              value={form.branch_id}
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

              {branches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* PAYMENT NUMBER */}

          <div>
            <label style={labelStyle}>
              PAYMENT NUMBER
            </label>

            <div
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                color: "#22d3ee",
                fontWeight: 700,
              }}
            >
              {editingId !== null
                ? payments.find(
                    (payment) =>
                      payment.id ===
                      editingId
                  )?.payment_number ||
                  "Existing Payment"
                : "AUTO GENERATED"}
            </div>
          </div>

          {/* SELECTED CUSTOMER */}

          <div>
            <label style={labelStyle}>
              SELECTED CUSTOMER
            </label>

            <div
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                color: form.customer_id
                  ? "#4ade80"
                  : "#64748b",
              }}
            >
              {form.customer_id
                ? getCustomerName(
                    form.customer_id
                  )
                : "No customer selected"}
            </div>
          </div>

          {/* NOTES */}

          <div
            style={{
              gridColumn: "span 4",
            }}
          >
            <label style={labelStyle}>
              NOTES
            </label>

            <textarea
              value={form.notes}
              placeholder="Optional payment notes..."
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
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* BUTTONS */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "15px",
          }}
        >
          <button
            onClick={clearForm}
            type="button"
            style={{
              backgroundColor: "#374151",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 18px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>

          <button
            onClick={savePayment}
            disabled={saving}
            type="button"
            style={{
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 22px",
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
              : editingId !== null
              ? "Update Payment"
              : "Receive Payment"}
          </button>
        </div>
      </div>

      {/* =====================================================
          PAYMENT HISTORY
      ===================================================== */}

      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            gap: "10px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#60a5fa",
                fontSize: "16px",
              }}
            >
              CUSTOMER PAYMENT HISTORY
            </h2>

            <div
              style={{
                marginTop: "3px",
                color: "#64748b",
                fontSize: "10px",
              }}
            >
              All customer receipts recorded in the system
            </div>
          </div>

          <input
            type="text"
            value={search}
            placeholder="Search customer, payment no., reference..."
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              ...inputStyle,
              width: "310px",
            }}
          />
        </div>

        <div
          style={{
            width: "100%",
            overflowX: "auto",
            border:
              "1px solid #263548",
            borderRadius: "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor:
                    "#0b1220",
                }}
              >
                <th style={thStyle}>
                  PAYMENT NO.
                </th>

                <th style={thStyle}>
                  DATE
                </th>

                <th style={thStyle}>
                  CUSTOMER
                </th>

                <th style={thStyle}>
                  AMOUNT
                </th>

                <th style={thStyle}>
                  METHOD
                </th>

                <th style={thStyle}>
                  REFERENCE
                </th>

                <th style={thStyle}>
                  BRANCH
                </th>

                <th style={thStyle}>
                  NOTES
                </th>

                <th style={thStyle}>
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    style={
                      emptyStyle
                    }
                  >
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={
                      emptyStyle
                    }
                  >
                    No customer payments found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(
                  (payment) => (
                    <tr
                      key={
                        payment.id
                      }
                    >
                      {/* PAYMENT NUMBER */}

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#22d3ee",
                          fontWeight: 700,
                        }}
                      >
                        {payment.payment_number ||
                          `#${payment.id}`}
                      </td>

                      {/* DATE */}

                      <td style={tdStyle}>
                        {payment.payment_date ||
                          "-"}
                      </td>

                      {/* CUSTOMER */}

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#ffffff",
                          fontWeight: 700,
                        }}
                      >
                        {getCustomerName(
                          payment.customer_id
                        )}
                      </td>

                      {/* AMOUNT */}

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#4ade80",
                          fontWeight: 800,
                        }}
                      >
                        SAR{" "}
                        {Number(
                          payment.amount ||
                            0
                        ).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      {/* METHOD */}

                      <td style={tdStyle}>
                        <span
                          style={{
                            display:
                              "inline-block",
                            padding:
                              "3px 8px",
                            borderRadius:
                              "4px",
                            backgroundColor:
                              payment.payment_method ===
                              "BANK"
                                ? "#2563eb20"
                                : "#16a34a20",
                            color:
                              payment.payment_method ===
                              "BANK"
                                ? "#60a5fa"
                                : "#4ade80",
                            fontWeight: 700,
                            fontSize:
                              "9px",
                          }}
                        >
                          {payment.payment_method ||
                            "-"}
                        </span>
                      </td>

                      {/* REFERENCE */}

                      <td style={tdStyle}>
                        {payment.reference_number ||
                          "-"}
                      </td>

                      {/* BRANCH */}

                      <td style={tdStyle}>
                        {getBranchName(
                          payment.branch_id
                        )}
                      </td>

                      {/* NOTES */}

                      <td
                        style={{
                          ...tdStyle,
                          maxWidth:
                            "200px",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                        }}
                      >
                        {payment.notes ||
                          "-"}
                      </td>

                      {/* ACTIONS */}

                      <td style={tdStyle}>
                        <div
                          style={{
                            display:
                              "flex",
                            gap: "5px",
                            alignItems:
                              "center",
                          }}
                        >
                          {/* EDIT */}

                          <button
                            type="button"
                            onClick={() =>
                              editPayment(
                                payment
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
                            Edit
                          </button>

                          {/* RECEIPT */}

                          <button
                            type="button"
                            onClick={() =>
                              generateReceipt(
                                payment
                              )
                            }
                            disabled={
                              generatingReceiptId ===
                              payment.id
                            }
                            style={{
                              background:
                                "linear-gradient(135deg, #0891b2, #0e7490)",
                              color:
                                "#ffffff",
                              border:
                                "none",
                              borderRadius:
                                "4px",
                              padding:
                                "5px 9px",
                              cursor:
                                generatingReceiptId ===
                                payment.id
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize:
                                "10px",
                              fontWeight: 700,
                              opacity:
                                generatingReceiptId ===
                                payment.id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {generatingReceiptId ===
                            payment.id
                              ? "PDF..."
                              : "Receipt"}
                          </button>

                          {/* DELETE */}

                          <button
                            type="button"
                            onClick={() =>
                              deletePayment(
                                payment
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
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>

            {/* FOOTER TOTAL */}

            {filteredPayments.length >
              0 && (
              <tfoot>
                <tr
                  style={{
                    backgroundColor:
                      "#0b1220",
                  }}
                >
                  <td
                    colSpan={3}
                    style={{
                      ...tdStyle,
                      color:
                        "#67e8f9",
                      fontWeight: 800,
                      textAlign:
                        "right",
                    }}
                  >
                    TOTAL:
                  </td>

                  <td
                    style={{
                      ...tdStyle,
                      color:
                        "#4ade80",
                      fontWeight: 900,
                    }}
                  >
                    SAR{" "}
                    {totalPaymentAmount.toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </td>

                  <td
                    colSpan={5}
                    style={tdStyle}
                  />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* =====================================================
          ACCOUNTING NOTICE
      ===================================================== */}

      <div
        style={{
          marginTop: "12px",
          padding: "11px 14px",
          backgroundColor:
            "#082f49",
          border:
            "1px solid #155e75",
          borderRadius: "7px",
          color: "#bae6fd",
          fontSize: "10px",
          lineHeight: 1.6,
        }}
      >
        <strong>
          ACCOUNTING CONNECTION:
        </strong>{" "}
        Customer payments recorded here will
        be connected automatically to the
        customer's account and Main Account
        when the ERP accounting layer is
        completed. No duplicate manual Main
        Account entry is required.
      </div>
    </div>
  );
}

/*
 * ===========================================================
 * TABLE STYLES
 * ===========================================================
 */

const thStyle: React.CSSProperties = {
  padding: "8px 7px",
  textAlign: "left",
  color: "#67e8f9",
  fontWeight: 700,
  whiteSpace: "nowrap",
  borderBottom:
    "1px solid #263548",
};

const tdStyle: React.CSSProperties = {
  padding: "7px",
  color: "#cbd5e1",
  whiteSpace: "nowrap",
  borderBottom:
    "1px solid #1e293b",
};

const emptyStyle: React.CSSProperties = {
  padding: "25px",
  textAlign: "center",
  color: "#64748b",
};

export default CustomerPayments;