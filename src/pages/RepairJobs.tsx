import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";

/* =========================================================
   TYPES
========================================================= */

type Customer = {
  id: number;
  customer_name: string;
};

type RepairJob = {
  id: number;
  invoice_number: string | null;
  customer_id: number | null;
  repair_date: string | null;

  drum_name: string | null;
  drum_category: string | null;

  quantity: number | null;
  repair_type: string | null;

  price_per_drum: number | null;
  subtotal: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  total_amount: number | null;

  payment_status: string | null;
  reminder_status: string | null;

  notes: string | null;

  created_at: string | null;
};

type RepairForm = {
  customer_id: string;
  repair_date: string;

  drum_name: string;
  drum_category: string;

  quantity: string;

  repair_type: string;

  price_per_drum: string;

  payment_status: string;

  reminder_status: string;

  notes: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const VAT_RATE = 15;

const emptyForm: RepairForm = {
  customer_id: "",

  repair_date: new Date()
    .toISOString()
    .split("T")[0],

  drum_name: "",
  drum_category: "",

  quantity: "1",

  repair_type: "",

  price_per_drum: "",

  payment_status: "UNPAID",

  reminder_status: "PENDING",

  notes: "",
};

/* =========================================================
   COMPONENT
========================================================= */

function RepairJobs() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [repairJobs, setRepairJobs] = useState<RepairJob[]>([]);

  const [form, setForm] = useState<RepairForm>({
    ...emptyForm,
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [dateFrom, setDateFrom] = useState("");

  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    fetchCustomers();
    fetchRepairJobs();
  }, []);

  /* =======================================================
     FETCH CUSTOMERS
  ======================================================= */

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_name")
      .order("customer_name", {
        ascending: true,
      });

    if (error) {
      console.error(error);

      alert(
        "Unable to load customers: " +
          error.message
      );

      return;
    }

    setCustomers(data || []);
  }

  /* =======================================================
     FETCH REPAIR JOBS
  ======================================================= */

  async function fetchRepairJobs() {
    setLoading(true);

    const { data, error } = await supabase
      .from("repair_jobs")
      .select("*")
      .order("id", {
        ascending: false,
      });

    setLoading(false);

    if (error) {
      console.error(error);

      alert(
        "Unable to load repair jobs: " +
          error.message
      );

      return;
    }

    setRepairJobs(data || []);
  }

  /* =======================================================
     UPDATE FORM
  ======================================================= */

  function updateField(
    field: keyof RepairForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const quantity =
    Number(form.quantity) || 0;

  const pricePerDrum =
    Number(form.price_per_drum) || 0;

  const subtotal =
    quantity * pricePerDrum;

  const vatAmount =
    subtotal * (VAT_RATE / 100);

  const totalAmount =
    subtotal + vatAmount;

  /* =======================================================
     CUSTOMER NAME
  ======================================================= */

  function getCustomerName(
    customerId: number | null
  ) {
    if (!customerId) {
      return "-";
    }

    const customer = customers.find(
      (item) =>
        item.id === customerId
    );

    return (
      customer?.customer_name ||
      "-"
    );
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateForm() {
    if (!form.customer_id) {
      alert("Please select a customer.");
      return false;
    }

    if (!form.repair_date) {
      alert("Repair date is required.");
      return false;
    }

    if (!form.drum_name.trim()) {
      alert("Drum name is required.");
      return false;
    }

    if (!form.drum_category.trim()) {
      alert("Drum category is required.");
      return false;
    }

    if (!form.repair_type.trim()) {
      alert("Repair type is required.");
      return false;
    }

    if (
      !form.quantity ||
      Number(form.quantity) <= 0
    ) {
      alert(
        "Repair quantity must be greater than zero."
      );

      return false;
    }

    if (
      !form.price_per_drum ||
      Number(form.price_per_drum) < 0
    ) {
      alert(
        "Repair price per drum cannot be negative."
      );

      return false;
    }

    return true;
  }

  /* =======================================================
     GENERATE INVOICE NUMBER
  ======================================================= */

  async function generateInvoiceNumber() {
    const year =
      new Date().getFullYear();

    const prefix = `REP-${year}-`;

    const { data, error } =
      await supabase
        .from("repair_jobs")
        .select("invoice_number")
        .like(
          "invoice_number",
          `${prefix}%`
        )
        .order("id", {
          ascending: false,
        })
        .limit(1);

    if (error) {
      console.error(error);

      return (
        prefix +
        Date.now()
      );
    }

    let nextNumber = 1;

    if (
      data &&
      data.length > 0 &&
      data[0].invoice_number
    ) {
      const lastNumber = Number(
        data[0].invoice_number.replace(
          prefix,
          ""
        )
      );

      if (!Number.isNaN(lastNumber)) {
        nextNumber =
          lastNumber + 1;
      }
    }

    return (
      prefix +
      String(nextNumber).padStart(
        5,
        "0"
      )
    );
  }

  /* =======================================================
     SAVE REPAIR JOB
  ======================================================= */

  async function saveRepairJob() {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    let invoiceNumber:
      | string
      | null = null;

    if (editingId === null) {
      invoiceNumber =
        await generateInvoiceNumber();
    }

    const repairData = {
      customer_id:
        Number(form.customer_id),

      repair_date:
        form.repair_date,

      drum_name:
        form.drum_name.trim(),

      drum_category:
        form.drum_category.trim(),

      quantity:
        Number(form.quantity),

      repair_type:
        form.repair_type.trim(),

      price_per_drum:
        Number(form.price_per_drum),

      subtotal:
        subtotal,

      vat_rate:
        VAT_RATE,

      vat_amount:
        vatAmount,

      total_amount:
        totalAmount,

      payment_status:
        form.payment_status,

      reminder_status:
        form.reminder_status,

      notes:
        form.notes.trim() || null,

      ...(editingId === null
        ? {
            invoice_number:
              invoiceNumber,
          }
        : {}),
    };

    let error = null;

    /* UPDATE */

    if (editingId !== null) {
      const result =
        await supabase
          .from("repair_jobs")
          .update(repairData)
          .eq("id", editingId);

      error = result.error;
    }

    /* INSERT */

    else {
      const result =
        await supabase
          .from("repair_jobs")
          .insert(repairData);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);

      alert(
        "Unable to save repair job: " +
          error.message
      );

      return;
    }

    alert(
      editingId !== null
        ? "Repair job updated successfully."
        : "Repair job saved successfully."
    );

    clearForm();

    await fetchRepairJobs();
  }

  /* =======================================================
     EDIT REPAIR
  ======================================================= */

  function editRepairJob(
    repair: RepairJob
  ) {
    setEditingId(repair.id);

    setForm({
      customer_id:
        repair.customer_id
          ? String(
              repair.customer_id
            )
          : "",

      repair_date:
        repair.repair_date ||
        new Date()
          .toISOString()
          .split("T")[0],

      drum_name:
        repair.drum_name || "",

      drum_category:
        repair.drum_category || "",

      quantity:
        repair.quantity !== null
          ? String(
              repair.quantity
            )
          : "1",

      repair_type:
        repair.repair_type || "",

      price_per_drum:
        repair.price_per_drum !==
        null
          ? String(
              repair.price_per_drum
            )
          : "",

      payment_status:
        repair.payment_status ||
        "UNPAID",

      reminder_status:
        repair.reminder_status ||
        "PENDING",

      notes:
        repair.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =======================================================
     DELETE REPAIR
  ======================================================= */

  async function deleteRepairJob(
    id: number
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this repair job?"
      );

    if (!confirmed) {
      return;
    }

    const { error } =
      await supabase
        .from("repair_jobs")
        .delete()
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      "Repair job deleted successfully."
    );

    await fetchRepairJobs();
  }

  /* =======================================================
     CLEAR FORM
  ======================================================= */

  function clearForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });
  }

  /* =======================================================
     FILTER REPAIR JOBS
  ======================================================= */

  const filteredRepairJobs =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      return repairJobs.filter(
        (repair) => {
          const customerName =
            getCustomerName(
              repair.customer_id
            );

          const searchable = [
            repair.invoice_number,
            customerName,
            repair.drum_name,
            repair.drum_category,
            repair.repair_type,
            repair.payment_status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (
            text &&
            !searchable.includes(text)
          ) {
            return false;
          }

          if (
            dateFrom &&
            repair.repair_date &&
            repair.repair_date <
              dateFrom
          ) {
            return false;
          }

          if (
            dateTo &&
            repair.repair_date &&
            repair.repair_date >
              dateTo
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      repairJobs,
      search,
      dateFrom,
      dateTo,
      customers,
    ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const totalRepairQuantity =
    filteredRepairJobs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.quantity || 0
        ),
      0
    );

  const totalSubtotal =
    filteredRepairJobs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.subtotal || 0
        ),
      0
    );

  const totalVat =
    filteredRepairJobs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.vat_amount || 0
        ),
      0
    );

  const totalRevenue =
    filteredRepairJobs.reduce(
      (sum, repair) =>
        sum +
        Number(
          repair.total_amount || 0
        ),
      0
    );

  /* =======================================================
     PDF INVOICE
  ======================================================= */

  function generateInvoice(
    repair: RepairJob
  ) {
    const doc =
      new jsPDF();

    const customerName =
      getCustomerName(
        repair.customer_id
      );

    /* -----------------------------------------------------
       PAGE BACKGROUND
    ----------------------------------------------------- */

    doc.setFillColor(
      7,
      17,
      31
    );

    doc.rect(
      0,
      0,
      210,
      297,
      "F"
    );

    /* -----------------------------------------------------
       HEADER
    ----------------------------------------------------- */

    doc.setTextColor(
      34,
      211,
      238
    );

    doc.setFontSize(21);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "AL SHAMS AL GHAYABA TRD EST.",
      105,
      23,
      {
        align: "center",
      }
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFontSize(15);

    doc.text(
      "REPAIR INVOICE",
      105,
      35,
      {
        align: "center",
      }
    );

    /* -----------------------------------------------------
       COMPANY DETAILS LINE
    ----------------------------------------------------- */

    doc.setDrawColor(
      34,
      211,
      238
    );

    doc.line(
      20,
      42,
      190,
      42
    );

    /* -----------------------------------------------------
       INVOICE INFORMATION
    ----------------------------------------------------- */

    doc.setFontSize(9);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      203,
      213,
      225
    );

    doc.text(
      `Invoice No: ${
        repair.invoice_number ||
        "-"
      }`,
      20,
      54
    );

    doc.text(
      `Date: ${
        repair.repair_date ||
        "-"
      }`,
      20,
      62
    );

    doc.text(
      `Customer: ${customerName}`,
      20,
      70
    );

    doc.text(
      `Payment: ${
        repair.payment_status ||
        "UNPAID"
      }`,
      140,
      54
    );

    /* -----------------------------------------------------
       TABLE
    ----------------------------------------------------- */

    doc.setFillColor(
      30,
      41,
      59
    );

    doc.rect(
      15,
      82,
      180,
      12,
      "F"
    );

    doc.setTextColor(
      103,
      232,
      249
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "DRUM",
      20,
      90
    );

    doc.text(
      "CATEGORY",
      57,
      90
    );

    doc.text(
      "REPAIR TYPE",
      93,
      90
    );

    doc.text(
      "QTY",
      137,
      90
    );

    doc.text(
      "PRICE",
      151,
      90
    );

    doc.text(
      "TOTAL",
      177,
      90
    );

    /* -----------------------------------------------------
       TABLE ROW
    ----------------------------------------------------- */

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.text(
      repair.drum_name ||
        "-",
      20,
      104
    );

    doc.text(
      repair.drum_category ||
        "-",
      57,
      104
    );

    doc.text(
      repair.repair_type ||
        "-",
      93,
      104
    );

    doc.text(
      String(
        repair.quantity || 0
      ),
      137,
      104
    );

    doc.text(
      `${Number(
        repair.price_per_drum ||
          0
      ).toFixed(2)}`,
      151,
      104
    );

    doc.text(
      `${Number(
        repair.subtotal || 0
      ).toFixed(2)}`,
      177,
      104
    );

    /* -----------------------------------------------------
       TOTAL SECTION
    ----------------------------------------------------- */

    doc.setDrawColor(
      71,
      85,
      105
    );

    doc.line(
      15,
      116,
      195,
      116
    );

    doc.setTextColor(
      203,
      213,
      225
    );

    doc.setFontSize(9);

    doc.text(
      "Subtotal:",
      135,
      132
    );

    doc.text(
      `${Number(
        repair.subtotal || 0
      ).toFixed(2)} SAR`,
      174,
      132
    );

    doc.text(
      `VAT (${VAT_RATE}%):`,
      135,
      142
    );

    doc.text(
      `${Number(
        repair.vat_amount || 0
      ).toFixed(2)} SAR`,
      174,
      142
    );

    doc.setTextColor(
      34,
      211,
      238
    );

    doc.setFontSize(12);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "TOTAL:",
      135,
      156
    );

    doc.text(
      `${Number(
        repair.total_amount ||
          0
      ).toFixed(2)} SAR`,
      174,
      156
    );

    /* -----------------------------------------------------
       PAYMENT / REMINDER
    ----------------------------------------------------- */

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setTextColor(
      203,
      213,
      225
    );

    doc.setFontSize(9);

    doc.text(
      `Payment Status: ${
        repair.payment_status ||
        "UNPAID"
      }`,
      20,
      132
    );

    doc.text(
      `Reminder Status: ${
        repair.reminder_status ||
        "PENDING"
      }`,
      20,
      142
    );

    /* -----------------------------------------------------
       NOTES
    ----------------------------------------------------- */

    if (repair.notes) {
      doc.setTextColor(
        148,
        163,
        184
      );

      doc.setFontSize(9);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "Notes:",
        20,
        170
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      const lines =
        doc.splitTextToSize(
          repair.notes,
          170
        );

      doc.text(
        lines,
        20,
        179
      );
    }

    /* -----------------------------------------------------
       PROFESSIONAL FOOTER
    ----------------------------------------------------- */

    doc.setDrawColor(
      51,
      65,
      85
    );

    doc.line(
      20,
      258,
      190,
      258
    );

    doc.setTextColor(
      148,
      163,
      184
    );

    doc.setFontSize(8);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "Thank you for your business.",
      105,
      270,
      {
        align: "center",
      }
    );

    doc.text(
      "All prices are in Saudi Riyals. VAT is charged at 15%.",
      105,
      278,
      {
        align: "center",
      }
    );

    doc.text(
      "This invoice is issued for drum repair services.",
      105,
      286,
      {
        align: "center",
      }
    );

    /* -----------------------------------------------------
       SAVE
    ----------------------------------------------------- */

    doc.save(
      `${
        repair.invoice_number ||
        "Repair-Invoice"
      }.pdf`
    );
  }

  /* =======================================================
     STYLES
  ======================================================= */

  const inputStyle: React.CSSProperties =
    {
      width: "100%",
      height: "34px",

      padding:
        "0 8px",

      backgroundColor:
        "#0b1220",

      color: "#ffffff",

      border:
        "1px solid #334155",

      borderRadius:
        "5px",

      boxSizing:
        "border-box",

      fontSize: "11px",

      outline: "none",

      minWidth: 0,
    };

  const labelStyle: React.CSSProperties =
    {
      display: "block",

      marginBottom:
        "4px",

      color:
        "#94a3b8",

      fontSize: "9px",

      fontWeight: 700,
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",

        padding:
          "12px",

        boxSizing:
          "border-box",

        background:
          "linear-gradient(135deg,#07111f,#0f172a,#111827)",

        color: "#ffffff",

        overflowX:
          "hidden",
      }}
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          marginBottom:
            "10px",

          gap: "10px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,

              color:
                "#22d3ee",

              fontSize:
                "21px",

              fontWeight: 800,

              lineHeight: 1.1,
            }}
          >
            REPAIR JOBS
          </h1>

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
            Customer Drum Repair
            Management
          </div>
        </div>

        <div
          style={{
            backgroundColor:
              "#0b1220",

            border:
              "1px solid #263548",

            borderRadius:
              "5px",

            padding:
              "6px 10px",

            color:
              "#94a3b8",

            fontSize:
              "10px",

            whiteSpace:
              "nowrap",
          }}
        >
          {repairJobs.length} Jobs
        </div>
      </div>

      {/* =================================================
          FORM
      ================================================= */}

      <div
        style={{
          backgroundColor:
            "#111827",

          border:
            "1px solid #263548",

          borderRadius:
            "8px",

          padding:
            "12px",

          marginBottom:
            "10px",

          width: "100%",

          boxSizing:
            "border-box",
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
              "10px",
          }}
        >
          <h2
            style={{
              margin: 0,

              color:
                "#60a5fa",

              fontSize:
                "14px",
            }}
          >
            {editingId !== null
              ? "EDIT REPAIR JOB"
              : "NEW REPAIR JOB"}
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
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* =================================================
            REPAIR INFORMATION
        ================================================= */}

        <div
          style={{
            color:
              "#22d3ee",

            fontSize:
              "10px",

            fontWeight:
              800,

            marginBottom:
              "7px",
          }}
        >
          REPAIR INFORMATION
        </div>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4,minmax(0,1fr))",

            gap: "8px",

            width:
              "100%",
          }}
        >
          {/* CUSTOMER */}

          <div
            style={{
              minWidth: 0,
            }}
          >
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
                form.customer_id
              }
              onChange={(e) =>
                updateField(
                  "customer_id",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Customer
              </option>

              {customers.map(
                (
                  customer
                ) => (
                  <option
                    key={
                      customer.id
                    }
                    value={
                      customer.id
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

          {/* DATE */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              REPAIR DATE *
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.repair_date
              }
              onChange={(e) =>
                updateField(
                  "repair_date",
                  e.target.value
                )
              }
            />
          </div>

          {/* DRUM NAME */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              DRUM NAME *
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.drum_name
              }
              placeholder="e.g. Oil Drum"
              onChange={(e) =>
                updateField(
                  "drum_name",
                  e.target.value
                )
              }
            />
          </div>

          {/* CATEGORY */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              DRUM CATEGORY *
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.drum_category
              }
              placeholder="Close Top / Open Top"
              onChange={(e) =>
                updateField(
                  "drum_category",
                  e.target.value
                )
              }
            />
          </div>

          {/* QUANTITY */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              REPAIR QUANTITY *
            </label>

            <input
              type="number"
              min="1"
              step="1"
              style={
                inputStyle
              }
              value={
                form.quantity
              }
              onChange={(e) =>
                updateField(
                  "quantity",
                  e.target.value
                )
              }
            />
          </div>

          {/* REPAIR TYPE */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              REPAIR TYPE *
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.repair_type
              }
              onChange={(e) =>
                updateField(
                  "repair_type",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Repair Type
              </option>

              <option value="DENT REPAIR">
                Dent Repair
              </option>

              <option value="LEAK REPAIR">
                Leak Repair
              </option>

              <option value="WELDING">
                Welding
              </option>

              <option value="PAINTING">
                Painting
              </option>

              <option value="CLEANING">
                Cleaning
              </option>

              <option value="LID REPAIR">
                Lid Repair
              </option>

              <option value="RING REPAIR">
                Ring Repair
              </option>

              <option value="GENERAL REPAIR">
                General Repair
              </option>

              <option value="OTHER">
                Other
              </option>
            </select>
          </div>

          {/* PRICE */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              PRICE / DRUM (SAR) *
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              style={
                inputStyle
              }
              value={
                form.price_per_drum
              }
              placeholder="0.00"
              onChange={(e) =>
                updateField(
                  "price_per_drum",
                  e.target.value
                )
              }
            />
          </div>

          {/* PAYMENT */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              PAYMENT STATUS
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.payment_status
              }
              onChange={(e) =>
                updateField(
                  "payment_status",
                  e.target.value
                )
              }
            >
              <option value="UNPAID">
                Unpaid
              </option>

              <option value="PARTIAL">
                Partially Paid
              </option>

              <option value="PAID">
                Paid
              </option>
            </select>
          </div>

          {/* REMINDER */}

          <div
            style={{
              minWidth: 0,
            }}
          >
            <label
              style={
                labelStyle
              }
            >
              REMINDER
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.reminder_status
              }
              onChange={(e) =>
                updateField(
                  "reminder_status",
                  e.target.value
                )
              }
            >
              <option value="PENDING">
                Pending
              </option>

              <option value="REMINDER_SENT">
                Reminder Sent
              </option>

              <option value="COMPLETED">
                Completed
              </option>
            </select>
          </div>
        </div>

        {/* =================================================
            CALCULATION
        ================================================= */}

        <div
          style={{
            marginTop:
              "10px",

            display:
              "grid",

            gridTemplateColumns:
              "repeat(4,minmax(0,1fr))",

            gap: "8px",
          }}
        >
          <CalculationCard
            title="SUBTOTAL"
            value={`${subtotal.toFixed(
              2
            )} SAR`}
          />

          <CalculationCard
            title={`VAT ${VAT_RATE}%`}
            value={`${vatAmount.toFixed(
              2
            )} SAR`}
            valueColor="#facc15"
          />

          <CalculationCard
            title="TOTAL"
            value={`${totalAmount.toFixed(
              2
            )} SAR`}
            valueColor="#22d3ee"
          />

          <CalculationCard
            title="REPAIR DRUMS"
            value={String(
              quantity
            )}
            valueColor="#ffffff"
          />
        </div>

        {/* =================================================
            NOTES
        ================================================= */}

        <div
          style={{
            marginTop:
              "9px",
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
            placeholder="Optional repair notes"
            onChange={(e) =>
              updateField(
                "notes",
                e.target.value
              )
            }
            style={{
              ...inputStyle,

              height:
                "48px",

              padding:
                "7px 8px",

              resize:
                "vertical",
            }}
          />
        </div>

        {/* =================================================
            BUTTONS
        ================================================= */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "flex-end",

            gap: "7px",

            marginTop:
              "10px",
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

                border:
                  "none",

                borderRadius:
                  "5px",

                padding:
                  "7px 15px",

                cursor:
                  "pointer",

                fontSize:
                  "10px",
              }}
            >
              Cancel
            </button>
          )}

          <button
            onClick={
              saveRepairJob
            }
            disabled={
              saving
            }
            style={{
              background:
                "linear-gradient(135deg,#06b6d4,#2563eb)",

              color:
                "#ffffff",

              border:
                "none",

              borderRadius:
                "5px",

              padding:
                "7px 18px",

              fontWeight:
                700,

              cursor:
                saving
                  ? "not-allowed"
                  : "pointer",

              opacity:
                saving
                  ? 0.6
                  : 1,

              fontSize:
                "10px",
            }}
          >
            {saving
              ? "Saving..."
              : editingId !==
                null
              ? "Update Repair"
              : "Save Repair Job"}
          </button>
        </div>
      </div>

      {/* ===================================================
          SUMMARY CARDS
      =================================================== */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(4,minmax(0,1fr))",

          gap: "8px",

          marginBottom:
            "10px",
        }}
      >
        <SummaryCard
          title="TOTAL REPAIR DRUMS"
          value={String(
            totalRepairQuantity
          )}
          suffix="DRUMS"
        />

        <SummaryCard
          title="SUBTOTAL"
          value={totalSubtotal.toFixed(
            2
          )}
          suffix="SAR"
        />

        <SummaryCard
          title="VAT"
          value={totalVat.toFixed(
            2
          )}
          suffix="SAR"
        />

        <SummaryCard
          title="TOTAL REPAIR REVENUE"
          value={totalRevenue.toFixed(
            2
          )}
          suffix="SAR"
        />
      </div>

      {/* ===================================================
          RECORDS
      =================================================== */}

      <div
        style={{
          backgroundColor:
            "#111827",

          border:
            "1px solid #263548",

          borderRadius:
            "8px",

          padding:
            "12px",

          width: "100%",

          boxSizing:
            "border-box",
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
              "9px",

            gap: "8px",

            flexWrap:
              "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,

              color:
                "#60a5fa",

              fontSize:
                "14px",
            }}
          >
            REPAIR JOB RECORDS
          </h2>

          <div
            style={{
              display:
                "flex",

              gap: "6px",

              flexWrap:
                "wrap",

              maxWidth:
                "100%",
            }}
          >
            <input
              type="text"
              value={
                search
              }
              placeholder="Search..."
              onChange={(e) =>
                setSearch(
                  e.target
                    .value
                )
              }
              style={{
                ...inputStyle,

                width:
                  "190px",
              }}
            />

            <input
              type="date"
              value={
                dateFrom
              }
              onChange={(e) =>
                setDateFrom(
                  e.target
                    .value
                )
              }
              style={{
                ...inputStyle,

                width:
                  "125px",
              }}
            />

            <input
              type="date"
              value={
                dateTo
              }
              onChange={(e) =>
                setDateTo(
                  e.target
                    .value
                )
              }
              style={{
                ...inputStyle,

                width:
                  "125px",
              }}
            />

            {(search ||
              dateFrom ||
              dateTo) && (
              <button
                onClick={() => {
                  setSearch(
                    ""
                  );

                  setDateFrom(
                    ""
                  );

                  setDateTo(
                    ""
                  );
                }}
                style={{
                  backgroundColor:
                    "#374151",

                  color:
                    "#ffffff",

                  border:
                    "none",

                  borderRadius:
                    "5px",

                  padding:
                    "0 10px",

                  cursor:
                    "pointer",

                  fontSize:
                    "10px",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div
          style={{
            width:
              "100%",

            overflowX:
              "auto",

            border:
              "1px solid #263548",

            borderRadius:
              "5px",

            WebkitOverflowScrolling:
              "touch",
          }}
        >
          <table
            style={{
              width:
                "max-content",

              minWidth:
                "100%",

              borderCollapse:
                "collapse",

              fontSize:
                "10px",
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
                  INVOICE
                </th>

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
                  CUSTOMER
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DRUM
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  CATEGORY
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  REPAIR TYPE
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
                  PRICE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  VAT
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
                  PAYMENT
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  REMINDER
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
                    colSpan={
                      13
                    }
                    style={
                      emptyStyle
                    }
                  >
                    Loading repair
                    jobs...
                  </td>
                </tr>
              ) : filteredRepairJobs.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={
                      13
                    }
                    style={
                      emptyStyle
                    }
                  >
                    No repair jobs
                    found.
                  </td>
                </tr>
              ) : (
                filteredRepairJobs.map(
                  (
                    repair
                  ) => (
                    <tr
                      key={
                        repair.id
                      }
                    >
                      <td
                        style={{
                          ...tdStyle,

                          color:
                            "#22d3ee",

                          fontWeight:
                            700,
                        }}
                      >
                        {repair.invoice_number ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {repair.repair_date ||
                          "-"}
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
                        {getCustomerName(
                          repair.customer_id
                        )}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {repair.drum_name ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {repair.drum_category ||
                          "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {repair.repair_type ||
                          "-"}
                      </td>

                      <td
                        style={{
                          ...tdStyle,

                          color:
                            "#facc15",

                          fontWeight:
                            700,
                        }}
                      >
                        {Number(
                          repair.quantity ||
                            0
                        )}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {Number(
                          repair.price_per_drum ||
                            0
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
                        {Number(
                          repair.vat_amount ||
                            0
                        ).toFixed(
                          2
                        )}{" "}
                        SAR
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
                        {Number(
                          repair.total_amount ||
                            0
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
                        <StatusBadge
                          text={
                            repair.payment_status ||
                            "UNPAID"
                          }
                          type="payment"
                        />
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <StatusBadge
                          text={
                            repair.reminder_status ||
                            "PENDING"
                          }
                          type="reminder"
                        />
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

                            gap:
                              "4px",
                          }}
                        >
                          <button
                            onClick={() =>
                              generateInvoice(
                                repair
                              )
                            }
                            style={{
                              backgroundColor:
                                "#0891b2",

                              color:
                                "#ffffff",

                              border:
                                "none",

                              borderRadius:
                                "4px",

                              padding:
                                "4px 7px",

                              cursor:
                                "pointer",

                              fontSize:
                                "9px",
                            }}
                          >
                            Invoice
                          </button>

                          <button
                            onClick={() =>
                              editRepairJob(
                                repair
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
                                "4px 7px",

                              cursor:
                                "pointer",

                              fontSize:
                                "9px",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deleteRepairJob(
                                repair.id
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
                                "4px 7px",

                              cursor:
                                "pointer",

                              fontSize:
                                "9px",
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
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CALCULATION CARD
========================================================= */

function CalculationCard({
  title,
  value,
  valueColor = "#ffffff",
}: {
  title: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background:
          "#0b1220",

        border:
          "1px solid #263548",

        borderRadius:
          "6px",

        padding:
          "8px",

        minWidth: 0,
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
        }}
      >
        {title}
      </div>

      <div
        style={{
          color:
            valueColor,

          fontSize:
            "15px",

          fontWeight:
            800,

          marginTop:
            "3px",

          whiteSpace:
            "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  suffix,
}: {
  title: string;
  value: string;
  suffix: string;
}) {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg,#111827,#0b1220)",

        border:
          "1px solid #263548",

        borderRadius:
          "6px",

        padding:
          "9px",

        minWidth: 0,

        boxShadow:
          "0 0 12px rgba(34,211,238,.06)",
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

          whiteSpace:
            "nowrap",

          overflow:
            "hidden",

          textOverflow:
            "ellipsis",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color:
            "#22d3ee",

          fontSize:
            "17px",

          fontWeight:
            800,

          marginTop:
            "3px",

          whiteSpace:
            "nowrap",
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
            "1px",
        }}
      >
        {suffix}
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  text,
  type,
}: {
  text: string;
  type:
    | "payment"
    | "reminder";
}) {
  let color =
    "#facc15";

  if (
    type === "payment" &&
    text === "PAID"
  ) {
    color =
      "#4ade80";
  }

  if (
    type === "payment" &&
    text === "UNPAID"
  ) {
    color =
      "#f87171";
  }

  if (
    type === "payment" &&
    text === "PARTIAL"
  ) {
    color =
      "#facc15";
  }

  if (
    type === "reminder" &&
    text === "COMPLETED"
  ) {
    color =
      "#4ade80";
  }

  if (
    type === "reminder" &&
    text === "REMINDER_SENT"
  ) {
    color =
      "#60a5fa";
  }

  if (
    type === "reminder" &&
    text === "PENDING"
  ) {
    color =
      "#facc15";
  }

  return (
    <span
      style={{
        display:
          "inline-block",

        padding:
          "2px 6px",

        borderRadius:
          "4px",

        backgroundColor:
          `${color}20`,

        color,

        fontWeight:
          700,

        fontSize:
          "7px",

        whiteSpace:
          "nowrap",
      }}
    >
      {text.replace(
        "_",
        " "
      )}
    </span>
  );
}

/* =========================================================
   TABLE STYLES
========================================================= */

const thStyle:
  React.CSSProperties = {
    padding:
      "6px 6px",

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

const tdStyle:
  React.CSSProperties = {
    padding:
      "6px",

    color:
      "#cbd5e1",

    whiteSpace:
      "nowrap",

    borderBottom:
      "1px solid #1e293b",
  };

const emptyStyle:
  React.CSSProperties = {
    padding:
      "22px",

    textAlign:
      "center",

    color:
      "#64748b",
  };

export default RepairJobs;