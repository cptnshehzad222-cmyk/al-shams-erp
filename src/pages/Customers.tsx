import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Customer = {
  id: number;
  created_at: string | null;

  customer_name: string;
  phone: string | null;
  vat_number: string | null;
  address: string | null;

  opening_balance: number | null;
  create_at: string | null;

  customer_type: string | null;
  email: string | null;
  cr_number: string | null;

  building_number: string | null;
  additional_address_number: string | null;
  street_name: string | null;
  district: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;

  other_id_type: string | null;
  other_id_number: string | null;

  credit_limit: number | null;
  payment_terms: string | null;

  active: boolean | null;
  notes: string | null;

  /*
   * CUSTOMER
   * SUPPLIER
   * BOTH
   */
  party_type: string | null;
};

type CustomerForm = {
  customer_name: string;

  /*
   * CUSTOMER
   * SUPPLIER
   * BOTH
   */
  party_type: string;

  customer_type: string;

  phone: string;
  email: string;

  vat_number: string;
  cr_number: string;

  building_number: string;
  additional_address_number: string;
  street_name: string;
  district: string;
  city: string;
  postal_code: string;
  country: string;

  other_id_type: string;
  other_id_number: string;

  opening_balance: string;
  credit_limit: string;
  payment_terms: string;

  active: boolean;
  notes: string;
};

const emptyForm: CustomerForm = {
  customer_name: "",

  party_type: "CUSTOMER",

  customer_type: "BUSINESS",

  phone: "",
  email: "",

  vat_number: "",
  cr_number: "",

  building_number: "",
  additional_address_number: "",
  street_name: "",
  district: "",
  city: "",
  postal_code: "",
  country: "Saudi Arabia",

  other_id_type: "",
  other_id_number: "",

  opening_balance: "",
  credit_limit: "",

  payment_terms: "CASH",

  active: true,
  notes: "",
};

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [form, setForm] = useState<CustomerForm>({
    ...emptyForm,
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  /*
   * =========================================================
   * FETCH CUSTOMERS
   * =========================================================
   */

  async function fetchCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("id", {
        ascending: false,
      });

    setLoading(false);

    if (error) {
      console.error(error);

      alert(error.message);

      return;
    }

    setCustomers(data || []);
  }

  /*
   * =========================================================
   * UPDATE FORM FIELD
   * =========================================================
   */

  function updateField(
    field: keyof CustomerForm,
    value: string | boolean
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /*
   * =========================================================
   * VALIDATE FORM
   * =========================================================
   */

  function validateForm() {
    /*
     * CUSTOMER NAME
     */

    if (!form.customer_name.trim()) {
      alert("Customer / Supplier name is required.");

      return false;
    }

    /*
     * PARTY TYPE
     */

    if (!form.party_type) {
      alert(
        "Please select whether this party is a Customer, Supplier or Both."
      );

      return false;
    }

    /*
     * CUSTOMER TYPE
     */

    if (!form.customer_type) {
      alert("Customer type is required.");

      return false;
    }

    /*
     * PHONE
     */

    if (!form.phone.trim()) {
      alert("Phone number is required.");

      return false;
    }

    /*
     * EMAIL
     */

    if (!form.email.trim()) {
      alert("Email address is required.");

      return false;
    }

    if (!form.email.includes("@")) {
      alert("Please enter a valid email address.");

      return false;
    }

    /*
     * VAT NUMBER
     */

    const vatNumber = form.vat_number.trim();

    if (!vatNumber) {
      alert("VAT number is required.");

      return false;
    }

    if (!/^\d{15}$/.test(vatNumber)) {
      alert(
        "VAT number must contain exactly 15 digits."
      );

      return false;
    }

    /*
     * CR NUMBER
     */

    if (
      form.customer_type === "BUSINESS" &&
      !form.cr_number.trim()
    ) {
      alert(
        "Commercial Registration (CR) number is required for business customers."
      );

      return false;
    }

    /*
     * NATIONAL ADDRESS
     */

    if (!form.building_number.trim()) {
      alert("Building number is required.");

      return false;
    }

    if (!form.street_name.trim()) {
      alert("Street name is required.");

      return false;
    }

    if (!form.district.trim()) {
      alert("District is required.");

      return false;
    }

    if (!form.city.trim()) {
      alert("City is required.");

      return false;
    }

    if (!form.postal_code.trim()) {
      alert("Postal code is required.");

      return false;
    }

    if (!/^\d{5}$/.test(form.postal_code.trim())) {
      alert(
        "Postal code must contain exactly 5 digits."
      );

      return false;
    }

    if (!form.additional_address_number.trim()) {
      alert(
        "Additional address number is required."
      );

      return false;
    }

    /*
     * COUNTRY
     */

    if (!form.country.trim()) {
      alert("Country is required.");

      return false;
    }

    /*
     * OPENING BALANCE
     */

    const openingBalance =
      form.opening_balance.trim() === ""
        ? 0
        : Number(form.opening_balance);

    if (Number.isNaN(openingBalance)) {
      alert(
        "Opening balance must be a valid number."
      );

      return false;
    }

    /*
     * CREDIT LIMIT
     */

    const creditLimit =
      form.credit_limit.trim() === ""
        ? 0
        : Number(form.credit_limit);

    if (Number.isNaN(creditLimit)) {
      alert(
        "Credit limit must be a valid number."
      );

      return false;
    }

    if (creditLimit < 0) {
      alert(
        "Credit limit cannot be negative."
      );

      return false;
    }

    return true;
  }

  /*
   * =========================================================
   * SAVE CUSTOMER / SUPPLIER / BOTH
   * =========================================================
   */

  async function saveCustomer() {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const openingBalance =
      form.opening_balance.trim() === ""
        ? 0
        : Number(form.opening_balance);

    const creditLimit =
      form.credit_limit.trim() === ""
        ? 0
        : Number(form.credit_limit);

    /*
     * IMPORTANT
     *
     * party_type determines the role:
     *
     * CUSTOMER
     * SUPPLIER
     * BOTH
     */

    const customerData = {
      customer_name:
        form.customer_name.trim(),

      party_type:
        form.party_type,

      phone:
        form.phone.trim(),

      vat_number:
        form.vat_number.trim(),

      address:
        [
          form.building_number.trim(),
          form.street_name.trim(),
          form.district.trim(),
          form.city.trim(),
          form.postal_code.trim(),
          form.country.trim(),
        ]
          .filter(Boolean)
          .join(", "),

      opening_balance:
        openingBalance,

      customer_type:
        form.customer_type,

      email:
        form.email.trim(),

      cr_number:
        form.cr_number.trim() || null,

      building_number:
        form.building_number.trim(),

      additional_address_number:
        form.additional_address_number.trim(),

      street_name:
        form.street_name.trim(),

      district:
        form.district.trim(),

      city:
        form.city.trim(),

      postal_code:
        form.postal_code.trim(),

      country:
        form.country.trim(),

      other_id_type:
        form.other_id_type.trim() || null,

      other_id_number:
        form.other_id_number.trim() || null,

      credit_limit:
        creditLimit,

      payment_terms:
        form.payment_terms,

      active:
        form.active,

      notes:
        form.notes.trim() || null,
    };

    let error = null;

    /*
     * UPDATE
     */

    if (editingId !== null) {
      const result = await supabase
        .from("customers")
        .update(customerData)
        .eq("id", editingId);

      error = result.error;
    }

    /*
     * INSERT
     */

    else {
      const result = await supabase
        .from("customers")
        .insert(customerData);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error(error);

      alert(error.message);

      return;
    }

    alert(
      editingId !== null
        ? "Customer / Supplier updated successfully."
        : "Customer / Supplier added successfully."
    );

    clearForm();

    await fetchCustomers();
  }

  /*
   * =========================================================
   * EDIT
   * =========================================================
   */

  function editCustomer(customer: Customer) {
    setEditingId(customer.id);

    setForm({
      customer_name:
        customer.customer_name || "",

      party_type:
        customer.party_type || "CUSTOMER",

      customer_type:
        customer.customer_type || "BUSINESS",

      phone:
        customer.phone || "",

      email:
        customer.email || "",

      vat_number:
        customer.vat_number || "",

      cr_number:
        customer.cr_number || "",

      building_number:
        customer.building_number || "",

      additional_address_number:
        customer.additional_address_number || "",

      street_name:
        customer.street_name || "",

      district:
        customer.district || "",

      city:
        customer.city || "",

      postal_code:
        customer.postal_code || "",

      country:
        customer.country || "Saudi Arabia",

      other_id_type:
        customer.other_id_type || "",

      other_id_number:
        customer.other_id_number || "",

      opening_balance:
        customer.opening_balance !== null
          ? String(customer.opening_balance)
          : "",

      credit_limit:
        customer.credit_limit !== null
          ? String(customer.credit_limit)
          : "",

      payment_terms:
        customer.payment_terms || "CASH",

      active:
        customer.active !== false,

      notes:
        customer.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
   * =========================================================
   * DELETE
   * =========================================================
   */

  async function deleteCustomer(id: number) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this customer / supplier?"
      );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);

      return;
    }

    alert(
      "Customer / Supplier deleted successfully."
    );

    await fetchCustomers();
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
  }

  /*
   * =========================================================
   * SEARCH
   * =========================================================
   */

  const filteredCustomers =
    customers.filter((customer) => {
      const text =
        search.trim().toLowerCase();

      if (!text) {
        return true;
      }

      return (
        customer.customer_name
          ?.toLowerCase()
          .includes(text) ||

        customer.phone
          ?.toLowerCase()
          .includes(text) ||

        customer.vat_number
          ?.toLowerCase()
          .includes(text) ||

        customer.cr_number
          ?.toLowerCase()
          .includes(text) ||

        customer.city
          ?.toLowerCase()
          .includes(text) ||

        customer.party_type
          ?.toLowerCase()
          .includes(text)
      );
    });

  /*
   * =========================================================
   * STYLES
   * =========================================================
   */

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
            CUSTOMERS & SUPPLIERS
          </h1>

          <div
            style={{
              marginTop: "3px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Customer & Supplier Management
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "6px",
            padding: "7px 12px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {customers.length} Records
        </div>
      </div>

      {/* =====================================================
          CUSTOMER / SUPPLIER FORM
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
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            {editingId !== null
              ? "EDIT RECORD"
              : "ADD CUSTOMER / SUPPLIER"}
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

        {/* ===================================================
            BASIC INFORMATION
        =================================================== */}

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginBottom: "10px",
          }}
        >
          BASIC INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          {/* NAME */}

          <div>
            <label style={labelStyle}>
              NAME *
            </label>

            <input
              style={inputStyle}
              value={form.customer_name}
              placeholder="Legal customer / supplier name"
              onChange={(e) =>
                updateField(
                  "customer_name",
                  e.target.value
                )
              }
            />
          </div>

          {/* PARTY TYPE */}

          <div>
            <label style={labelStyle}>
              PARTY TYPE *
            </label>

            <select
              style={{
                ...inputStyle,
                border:
                  form.party_type === "BOTH"
                    ? "1px solid #22d3ee"
                    : "1px solid #334155",
              }}
              value={form.party_type}
              onChange={(e) =>
                updateField(
                  "party_type",
                  e.target.value
                )
              }
            >
              <option value="CUSTOMER">
                Customer
              </option>

              <option value="SUPPLIER">
                Supplier
              </option>

              <option value="BOTH">
                Both - Customer & Supplier
              </option>
            </select>
          </div>

          {/* CUSTOMER TYPE */}

          <div>
            <label style={labelStyle}>
              TYPE *
            </label>

            <select
              style={inputStyle}
              value={form.customer_type}
              onChange={(e) =>
                updateField(
                  "customer_type",
                  e.target.value
                )
              }
            >
              <option value="BUSINESS">
                Business
              </option>

              <option value="INDIVIDUAL">
                Individual
              </option>
            </select>
          </div>

          {/* PHONE */}

          <div>
            <label style={labelStyle}>
              PHONE *
            </label>

            <input
              style={inputStyle}
              value={form.phone}
              placeholder="05XXXXXXXX"
              onChange={(e) =>
                updateField(
                  "phone",
                  e.target.value
                )
              }
            />
          </div>

          {/* EMAIL */}

          <div>
            <label style={labelStyle}>
              EMAIL *
            </label>

            <input
              type="email"
              style={inputStyle}
              value={form.email}
              placeholder="customer@email.com"
              onChange={(e) =>
                updateField(
                  "email",
                  e.target.value
                )
              }
            />
          </div>

          {/* VAT */}

          <div>
            <label style={labelStyle}>
              VAT NUMBER *
            </label>

            <input
              style={inputStyle}
              value={form.vat_number}
              placeholder="15 digit VAT number"
              maxLength={15}
              onChange={(e) =>
                updateField(
                  "vat_number",
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
            />
          </div>

          {/* CR */}

          <div>
            <label style={labelStyle}>
              CR NUMBER *
            </label>

            <input
              style={inputStyle}
              value={form.cr_number}
              placeholder="Commercial Registration"
              onChange={(e) =>
                updateField(
                  "cr_number",
                  e.target.value
                )
              }
            />
          </div>

          {/* OTHER ID TYPE */}

          <div>
            <label style={labelStyle}>
              OTHER ID TYPE
            </label>

            <input
              style={inputStyle}
              value={form.other_id_type}
              placeholder="Optional"
              onChange={(e) =>
                updateField(
                  "other_id_type",
                  e.target.value
                )
              }
            />
          </div>

          {/* OTHER ID NUMBER */}

          <div>
            <label style={labelStyle}>
              OTHER ID NUMBER
            </label>

            <input
              style={inputStyle}
              value={form.other_id_number}
              placeholder="Optional"
              onChange={(e) =>
                updateField(
                  "other_id_number",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* ===================================================
            NATIONAL ADDRESS
        =================================================== */}

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginTop: "18px",
            marginBottom: "10px",
          }}
        >
          NATIONAL ADDRESS
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          {/* BUILDING */}

          <div>
            <label style={labelStyle}>
              BUILDING NUMBER *
            </label>

            <input
              style={inputStyle}
              value={form.building_number}
              placeholder="1234"
              onChange={(e) =>
                updateField(
                  "building_number",
                  e.target.value
                )
              }
            />
          </div>

          {/* ADDITIONAL */}

          <div>
            <label style={labelStyle}>
              ADDITIONAL ADDRESS NUMBER *
            </label>

            <input
              style={inputStyle}
              value={
                form.additional_address_number
              }
              placeholder="1234"
              onChange={(e) =>
                updateField(
                  "additional_address_number",
                  e.target.value
                )
              }
            />
          </div>

          {/* STREET */}

          <div>
            <label style={labelStyle}>
              STREET NAME *
            </label>

            <input
              style={inputStyle}
              value={form.street_name}
              placeholder="Street name"
              onChange={(e) =>
                updateField(
                  "street_name",
                  e.target.value
                )
              }
            />
          </div>

          {/* DISTRICT */}

          <div>
            <label style={labelStyle}>
              DISTRICT *
            </label>

            <input
              style={inputStyle}
              value={form.district}
              placeholder="District"
              onChange={(e) =>
                updateField(
                  "district",
                  e.target.value
                )
              }
            />
          </div>

          {/* CITY */}

          <div>
            <label style={labelStyle}>
              CITY *
            </label>

            <input
              style={inputStyle}
              value={form.city}
              placeholder="Riyadh"
              onChange={(e) =>
                updateField(
                  "city",
                  e.target.value
                )
              }
            />
          </div>

          {/* POSTAL */}

          <div>
            <label style={labelStyle}>
              POSTAL CODE *
            </label>

            <input
              style={inputStyle}
              value={form.postal_code}
              placeholder="12345"
              maxLength={5}
              onChange={(e) =>
                updateField(
                  "postal_code",
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
            />
          </div>

          {/* COUNTRY */}

          <div>
            <label style={labelStyle}>
              COUNTRY *
            </label>

            <input
              style={inputStyle}
              value={form.country}
              onChange={(e) =>
                updateField(
                  "country",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* ===================================================
            ACCOUNTING
        =================================================== */}

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginTop: "18px",
            marginBottom: "10px",
          }}
        >
          ACCOUNTING INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          {/* OPENING BALANCE */}

          <div>
            <label style={labelStyle}>
              OPENING BALANCE
            </label>

            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={form.opening_balance}
              placeholder="0.00"
              onChange={(e) =>
                updateField(
                  "opening_balance",
                  e.target.value
                )
              }
            />
          </div>

          {/* CREDIT LIMIT */}

          <div>
            <label style={labelStyle}>
              CREDIT LIMIT
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
              value={form.credit_limit}
              placeholder="0.00"
              onChange={(e) =>
                updateField(
                  "credit_limit",
                  e.target.value
                )
              }
            />
          </div>

          {/* PAYMENT TERMS */}

          <div>
            <label style={labelStyle}>
              PAYMENT TERMS
            </label>

            <select
              style={inputStyle}
              value={form.payment_terms}
              onChange={(e) =>
                updateField(
                  "payment_terms",
                  e.target.value
                )
              }
            >
              <option value="CASH">
                Cash
              </option>

              <option value="7 DAYS">
                7 Days
              </option>

              <option value="15 DAYS">
                15 Days
              </option>

              <option value="30 DAYS">
                30 Days
              </option>

              <option value="60 DAYS">
                60 Days
              </option>

              <option value="90 DAYS">
                90 Days
              </option>
            </select>
          </div>

          {/* STATUS */}

          <div>
            <label style={labelStyle}>
              STATUS
            </label>

            <select
              style={inputStyle}
              value={
                form.active
                  ? "ACTIVE"
                  : "INACTIVE"
              }
              onChange={(e) =>
                updateField(
                  "active",
                  e.target.value ===
                    "ACTIVE"
                )
              }
            >
              <option value="ACTIVE">
                Active
              </option>

              <option value="INACTIVE">
                Inactive
              </option>
            </select>
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
                padding: "9px 10px",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* ===================================================
            BUTTONS
        =================================================== */}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "15px",
          }}
        >
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
            onClick={saveCustomer}
            disabled={saving}
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
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? "Saving..."
              : editingId !== null
              ? "Update Record"
              : "Add Record"}
          </button>
        </div>
      </div>

      {/* =====================================================
          RECORDS
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
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            CUSTOMER / SUPPLIER RECORDS
          </h2>

          <input
            type="text"
            value={search}
            placeholder="Search name, phone, VAT, CR..."
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              ...inputStyle,
              width: "280px",
            }}
          />
        </div>

        <div
          style={{
            width: "100%",
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
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#0b1220",
                }}
              >
                <th style={thStyle}>
                  NAME
                </th>

                <th style={thStyle}>
                  ROLE
                </th>

                <th style={thStyle}>
                  TYPE
                </th>

                <th style={thStyle}>
                  PHONE
                </th>

                <th style={thStyle}>
                  VAT NUMBER
                </th>

                <th style={thStyle}>
                  CR NUMBER
                </th>

                <th style={thStyle}>
                  CITY
                </th>

                <th style={thStyle}>
                  PAYMENT
                </th>

                <th style={thStyle}>
                  CREDIT LIMIT
                </th>

                <th style={thStyle}>
                  STATUS
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
                    colSpan={11}
                    style={emptyStyle}
                  >
                    Loading records...
                  </td>
                </tr>
              ) : filteredCustomers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={emptyStyle}
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(
                  (customer) => (
                    <tr key={customer.id}>
                      {/* NAME */}

                      <td style={tdStyle}>
                        <span
                          style={{
                            color: "#ffffff",
                            fontWeight: 700,
                          }}
                        >
                          {
                            customer.customer_name
                          }
                        </span>
                      </td>

                      {/* ROLE */}

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
                              customer.party_type ===
                              "BOTH"
                                ? "#0891b220"
                                : customer.party_type ===
                                  "SUPPLIER"
                                ? "#a855f720"
                                : "#2563eb20",
                            color:
                              customer.party_type ===
                              "BOTH"
                                ? "#22d3ee"
                                : customer.party_type ===
                                  "SUPPLIER"
                                ? "#c084fc"
                                : "#60a5fa",
                            fontWeight: 700,
                            fontSize: "9px",
                          }}
                        >
                          {customer.party_type ||
                            "CUSTOMER"}
                        </span>
                      </td>

                      {/* TYPE */}

                      <td style={tdStyle}>
                        {customer.customer_type ||
                          "-"}
                      </td>

                      {/* PHONE */}

                      <td style={tdStyle}>
                        {customer.phone ||
                          "-"}
                      </td>

                      {/* VAT */}

                      <td
                        style={{
                          ...tdStyle,
                          color: "#22d3ee",
                        }}
                      >
                        {customer.vat_number ||
                          "-"}
                      </td>

                      {/* CR */}

                      <td style={tdStyle}>
                        {customer.cr_number ||
                          "-"}
                      </td>

                      {/* CITY */}

                      <td style={tdStyle}>
                        {customer.city ||
                          "-"}
                      </td>

                      {/* PAYMENT */}

                      <td style={tdStyle}>
                        {customer.payment_terms ||
                          "-"}
                      </td>

                      {/* CREDIT */}

                      <td style={tdStyle}>
                        {Number(
                          customer.credit_limit ||
                            0
                        ).toFixed(2)}{" "}
                        SAR
                      </td>

                      {/* STATUS */}

                      <td style={tdStyle}>
                        <span
                          style={{
                            color:
                              customer.active
                                ? "#4ade80"
                                : "#f87171",
                            fontWeight: 700,
                          }}
                        >
                          {customer.active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "5px",
                          }}
                        >
                          <button
                            onClick={() =>
                              editCustomer(
                                customer
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
                              deleteCustomer(
                                customer.id
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

export default Customers;