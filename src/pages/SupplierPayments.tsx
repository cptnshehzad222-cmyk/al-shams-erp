import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";

type Supplier = {
  id: number;
  supplier_name: string;
  phone: string | null;
  opening_balance: number | null;
};

function SupplierPayments() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("Bank");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState(0);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (supplierId) {
      calculateSupplierBalance(Number(supplierId));
    } else {
      setSupplierBalance(0);
    }
  }, [supplierId, suppliers]);

  async function fetchSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select(
        "id, supplier_name, phone, opening_balance"
      )
      .order("supplier_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Supplier loading error:",
        error
      );

      setErrorMessage(error.message);
      return;
    }

    setSuppliers(data || []);
  }

  async function calculateSupplierBalance(
    id: number
  ) {
    const supplier = suppliers.find(
      (item) => item.id === id
    );

    const openingBalance = Number(
      supplier?.opening_balance || 0
    );

    const { data, error } = await supabase
      .from("supplier_transactions")
      .select("debit, credit")
      .eq("supplier_id", id);

    if (error) {
      console.error(
        "Balance loading error:",
        error
      );

      setSupplierBalance(openingBalance);
      return;
    }

    let balance = openingBalance;

    (data || []).forEach((transaction) => {
      const debit = Number(
        transaction.debit || 0
      );

      const credit = Number(
        transaction.credit || 0
      );

      balance += credit - debit;
    });

    setSupplierBalance(balance);
  }

  async function savePayment() {
    setSuccessMessage("");
    setErrorMessage("");

    if (!supplierId) {
      setErrorMessage(
        "Please select a supplier."
      );
      return;
    }

    const paymentAmount = Number(amount);

    if (
      !paymentAmount ||
      paymentAmount <= 0
    ) {
      setErrorMessage(
        "Please enter a valid payment amount."
      );
      return;
    }

    setLoading(true);

    try {
      const selectedSupplier = suppliers.find(
        (supplier) =>
          supplier.id === Number(supplierId)
      );

      if (!selectedSupplier) {
        throw new Error(
          "Supplier not found."
        );
      }

      if (
        paymentAmount >
        supplierBalance
      ) {
        const confirmOverpayment =
          window.confirm(
            `This payment is greater than the current supplier balance of ${formatAmount(
              supplierBalance
            )} SAR.\n\nDo you still want to continue?`
          );

        if (!confirmOverpayment) {
          setLoading(false);
          return;
        }
      }

      const transactionData = {
        supplier_id: Number(supplierId),
        transaction_date: paymentDate,

        transaction_type: "PAYMENT",

        reference_id: null,

        reference_type:
          "SUPPLIER_PAYMENT",

        description:
          description.trim() ||
          "Payment to Supplier",

        debit: paymentAmount,

        credit: 0,

        payment_method: paymentMethod,

        branch_id: null,

        notes: notes.trim() || null,

        item_id: null,

        quantity: 0,

        unit_price: 0,

        vat_percent: 0,

        total_amount: paymentAmount,
      };

      const { error } = await supabase
        .from("supplier_transactions")
        .insert(transactionData);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(
        `Payment of ${formatAmount(
          paymentAmount
        )} SAR recorded successfully for ${selectedSupplier.supplier_name}.`
      );

      await calculateSupplierBalance(
        Number(supplierId)
      );

      setAmount("");
      setDescription("");
      setNotes("");
    } catch (error) {
      console.error(
        "Supplier payment error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to record payment."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setSupplierId("");
    setAmount("");
    setDescription("");
    setNotes("");
    setPaymentMethod("Bank");

    setPaymentDate(
      new Date().toISOString().split("T")[0]
    );

    setSupplierBalance(0);
    setSuccessMessage("");
    setErrorMessage("");
  }

  function formatAmount(amount: number) {
    return Number(
      amount || 0
    ).toLocaleString("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const selectedSupplier = suppliers.find(
    (supplier) =>
      supplier.id === Number(supplierId)
  );

  const paymentAmount =
    Number(amount) || 0;

  const remainingBalance =
    supplierBalance - paymentAmount;

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            SUPPLIER PAYMENTS
          </h1>

          <p style={subtitleStyle}>
            Record payments made to suppliers
          </p>
        </div>

        <div style={countBadgeStyle}>
          {suppliers.length} Suppliers
        </div>
      </div>

      {successMessage && (
        <div style={successStyle}>
          ✓ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={errorStyle}>
          ✕ {errorMessage}
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          MAKE SUPPLIER PAYMENT
        </h2>

        <div style={formGridStyle}>
          <Field label="SUPPLIER">
            <select
              value={supplierId}
              onChange={(e) =>
                setSupplierId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Supplier
              </option>

              {suppliers.map(
                (supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {
                      supplier.supplier_name
                    }
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="PAYMENT DATE">
            <input
              type="date"
              value={paymentDate}
              onChange={(e) =>
                setPaymentDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="PAYMENT AMOUNT">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="PAYMENT METHOD">
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="Bank">
                Bank
              </option>

              <option value="Cash">
                Cash
              </option>
            </select>
          </Field>
        </div>

        <div style={formGridStyle}>
          <Field label="DESCRIPTION">
            <input
              type="text"
              placeholder="Payment description"
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="NOTES">
            <input
              type="text"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>
        </div>

        {selectedSupplier && (
          <div style={balancePanelStyle}>
            <div>
              <div style={balanceLabelStyle}>
                SUPPLIER
              </div>

              <div style={balanceNameStyle}>
                {
                  selectedSupplier.supplier_name
                }
              </div>
            </div>

            <div style={balanceBoxStyle}>
              <div
                style={
                  balanceSmallLabelStyle
                }
              >
                CURRENT BALANCE
              </div>

              <div
                style={{
                  ...balanceValueStyle,
                  color:
                    supplierBalance > 0
                      ? "#f59e0b"
                      : "#22c55e",
                }}
              >
                {formatAmount(
                  supplierBalance
                )}{" "}
                SAR
              </div>
            </div>

            <div style={balanceBoxStyle}>
              <div
                style={
                  balanceSmallLabelStyle
                }
              >
                AFTER PAYMENT
              </div>

              <div
                style={{
                  ...balanceValueStyle,
                  color:
                    remainingBalance > 0
                      ? "#f59e0b"
                      : "#22c55e",
                }}
              >
                {formatAmount(
                  remainingBalance
                )}{" "}
                SAR
              </div>
            </div>
          </div>
        )}

        <div style={buttonRowStyle}>
          <button
            onClick={clearForm}
            style={cancelButtonStyle}
          >
            CLEAR
          </button>

          <button
            onClick={savePayment}
            disabled={loading}
            style={{
              ...paymentButtonStyle,
              opacity: loading
                ? 0.6
                : 1,
            }}
          >
            {loading
              ? "RECORDING..."
              : "💳 RECORD PAYMENT"}
          </button>
        </div>
      </div>

      <div style={infoCardStyle}>
        <div
          style={{
            color: "#22d3ee",
            fontWeight: 800,
            fontSize: "13px",
            marginBottom: "8px",
          }}
        >
          PAYMENT INFORMATION
        </div>

        <div
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            lineHeight: 1.7,
          }}
        >
          Supplier payments are recorded
          separately from purchases. A supplier
          purchase increases the supplier balance,
          while a supplier payment decreases it.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "block",
        color: "#94a3b8",
        fontSize: "9px",
        fontWeight: 700,
      }}
    >
      {label}

      <div
        style={{
          marginTop: "5px",
        }}
      >
        {children}
      </div>
    </label>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100%",
  width: "100%",
  boxSizing: "border-box",
  padding: "16px",
  background:
    "linear-gradient(135deg, #07111f, #0f172a, #111827)",
  color: "#ffffff",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#22d3ee",
  fontSize: "24px",
  fontWeight: 800,
};

const subtitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#64748b",
  fontSize: "11px",
};

const countBadgeStyle: CSSProperties = {
  padding: "7px 12px",
  borderRadius: "6px",
  backgroundColor: "#0b1220",
  border: "1px solid #263548",
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: 700,
};

const cardStyle: CSSProperties = {
  backgroundColor: "#111827",
  border: "1px solid #263548",
  borderRadius: "9px",
  padding: "16px",
  marginBottom: "14px",
};

const infoCardStyle: CSSProperties = {
  backgroundColor: "#111827",
  border: "1px solid #263548",
  borderRadius: "9px",
  padding: "14px",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 14px",
  color: "#60a5fa",
  fontSize: "15px",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "12px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "40px",
  padding: "0 10px",
  boxSizing: "border-box",
  backgroundColor: "#0b1220",
  color: "#ffffff",
  border: "1px solid #334155",
  borderRadius: "6px",
  outline: "none",
  fontSize: "12px",
};

const balancePanelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.5fr 1fr 1fr",
  gap: "10px",
  marginTop: "14px",
  padding: "12px",
  backgroundColor: "#080f1c",
  border: "1px solid #263548",
  borderRadius: "8px",
  alignItems: "center",
};

const balanceLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 700,
};

const balanceNameStyle: CSSProperties = {
  color: "#22d3ee",
  fontSize: "15px",
  fontWeight: 800,
  marginTop: "4px",
};

const balanceBoxStyle: CSSProperties = {
  backgroundColor: "#0b1220",
  border: "1px solid #263548",
  borderRadius: "6px",
  padding: "9px",
  textAlign: "right",
};

const balanceSmallLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: "8px",
  fontWeight: 700,
  marginBottom: "4px",
};

const balanceValueStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 900,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "14px",
};

const cancelButtonStyle: CSSProperties = {
  border: "1px solid #475569",
  borderRadius: "7px",
  padding: "9px 16px",
  background: "#1e293b",
  color: "#cbd5e1",
  fontWeight: 700,
  cursor: "pointer",
};

const paymentButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: "7px",
  padding: "9px 18px",
  background:
    "linear-gradient(135deg, #22c55e, #059669)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const successStyle: CSSProperties = {
  padding: "11px 14px",
  marginBottom: "12px",
  borderRadius: "7px",
  backgroundColor: "#052e16",
  border: "1px solid #16a34a",
  color: "#86efac",
  fontSize: "11px",
  fontWeight: 700,
};

const errorStyle: CSSProperties = {
  padding: "11px 14px",
  marginBottom: "12px",
  borderRadius: "7px",
  backgroundColor: "#450a0a",
  border: "1px solid #dc2626",
  color: "#fca5a5",
  fontSize: "11px",
  fontWeight: 700,
};

export default SupplierPayments;