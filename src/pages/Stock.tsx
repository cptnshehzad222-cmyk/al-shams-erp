import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = {
  id: number;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  opening_stock: number | null;
  branch_id: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type Movement = {
  id: number;
  date: string | null;
  item_id: number | null;
  branch_id: string | null;
  movement_type: string | null;
  quantity: number | null;
  quantity_in: number | null;
  quantity_out: number | null;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  transfer_id: string | null;
};

function Stock() {
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  const [loading, setLoading] = useState(false);

  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferItem, setTransferItem] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const [adjustmentBranch, setAdjustmentBranch] = useState("");
  const [adjustmentItem, setAdjustmentItem] = useState("");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"IN" | "OUT">("IN");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    await Promise.all([
      loadItems(),
      loadBranches(),
      loadMovements(),
    ]);

    setLoading(false);
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("item_name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

  async function loadBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_name")
      .eq("active", true)
      .order("branch_name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setBranches(data || []);
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMovements(data || []);
  }

  function getItemName(id: number | null) {
    if (!id) return "-";

    const item = items.find((x) => x.id === id);

    return item?.item_name || `Item #${id}`;
  }

  function getBranchName(id: string | null) {
    if (!id) return "-";

    const branch = branches.find((x) => x.id === id);

    return branch?.branch_name || "-";
  }

  /*
   * CURRENT STOCK
   *
   * Stock = Total IN - Total OUT
   */

  const stockData = useMemo(() => {
    const result: Record<
      string,
      {
        itemId: number;
        itemName: string;
        branchId: string;
        branchName: string;
        unit: string;
        quantityIn: number;
        quantityOut: number;
        balance: number;
      }
    > = {};

    movements.forEach((movement) => {
      if (!movement.item_id || !movement.branch_id) return;

      const key = `${movement.item_id}-${movement.branch_id}`;

      if (!result[key]) {
        const item = items.find(
          (x) => x.id === movement.item_id
        );

        result[key] = {
          itemId: movement.item_id,
          itemName: item?.item_name || "-",
          branchId: movement.branch_id,
          branchName: getBranchName(movement.branch_id),
          unit: item?.unit || "",
          quantityIn: 0,
          quantityOut: 0,
          balance: 0,
        };
      }

      const quantityIn = Number(
        movement.quantity_in || 0
      );

      const quantityOut = Number(
        movement.quantity_out || 0
      );

      /*
       * Compatibility with your existing movements.
       * If old records only have quantity,
       * PURCHASE/OPENING/TRANSFER IN are treated as IN.
       */

      let movementIn = quantityIn;
      let movementOut = quantityOut;

      if (
        movementIn === 0 &&
        movementOut === 0 &&
        Number(movement.quantity || 0) !== 0
      ) {
        const qty = Math.abs(
          Number(movement.quantity || 0)
        );

        const type =
          (movement.movement_type || "")
            .toUpperCase();

        if (
          type === "PURCHASE" ||
          type === "OPENING" ||
          type === "TRANSFER_IN" ||
          type === "ADJUSTMENT_IN"
        ) {
          movementIn = qty;
        } else {
          movementOut = qty;
        }
      }

      result[key].quantityIn += movementIn;
      result[key].quantityOut += movementOut;
      result[key].balance +=
        movementIn - movementOut;
    });

    return Object.values(result);
  }, [movements, items, branches]);

  const filteredStock = stockData.filter((stock) => {
    const matchesSearch =
      !search ||
      stock.itemName
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      stock.branchName
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesBranch =
      !selectedBranch ||
      stock.branchId === selectedBranch;

    const matchesItem =
      !selectedItem ||
      stock.itemId === Number(selectedItem);

    return (
      matchesSearch &&
      matchesBranch &&
      matchesItem
    );
  });

  const totalStock = filteredStock.reduce(
    (sum, stock) =>
      sum + Number(stock.balance || 0),
    0
  );

  const totalIn = filteredStock.reduce(
    (sum, stock) =>
      sum + Number(stock.quantityIn || 0),
    0
  );

  const totalOut = filteredStock.reduce(
    (sum, stock) =>
      sum + Number(stock.quantityOut || 0),
    0
  );

  /*
   * OPENING STOCK
   */

  async function addOpeningStock() {
    if (!adjustmentBranch) {
      alert("Please select branch.");
      return;
    }

    if (!adjustmentItem) {
      alert("Please select item.");
      return;
    }

    const qty = Number(adjustmentQuantity);

    if (qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("stock_movements")
        .insert({
          date: new Date()
            .toISOString()
            .split("T")[0],

          item_id: Number(adjustmentItem),

          branch_id: adjustmentBranch,

          movement_type: "OPENING",

          quantity: qty,

          quantity_in: qty,

          quantity_out: 0,

          unit_cost: 0,

          reference_type: "OPENING",

          notes:
            adjustmentNotes.trim() ||
            "Opening stock",
        });

      if (error) {
        throw new Error(error.message);
      }

      alert(
        "Opening stock added successfully."
      );

      clearAdjustment();

      await loadMovements();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to add opening stock."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * STOCK ADJUSTMENT
   */

  async function addAdjustment() {
    if (!adjustmentBranch) {
      alert("Please select branch.");
      return;
    }

    if (!adjustmentItem) {
      alert("Please select item.");
      return;
    }

    const qty = Number(adjustmentQuantity);

    if (qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setSaving(true);

    try {
      const quantityIn =
        adjustmentType === "IN"
          ? qty
          : 0;

      const quantityOut =
        adjustmentType === "OUT"
          ? qty
          : 0;

      const { error } = await supabase
        .from("stock_movements")
        .insert({
          date: new Date()
            .toISOString()
            .split("T")[0],

          item_id: Number(adjustmentItem),

          branch_id: adjustmentBranch,

          movement_type:
            adjustmentType === "IN"
              ? "ADJUSTMENT_IN"
              : "ADJUSTMENT_OUT",

          quantity: qty,

          quantity_in: quantityIn,

          quantity_out: quantityOut,

          unit_cost: 0,

          reference_type: "ADJUSTMENT",

          notes:
            adjustmentNotes.trim() ||
            "Stock adjustment",
        });

      if (error) {
        throw new Error(error.message);
      }

      alert(
        "Stock adjustment recorded successfully."
      );

      clearAdjustment();

      await loadMovements();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to record adjustment."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * TRANSFER
   */

  async function transferStock() {
    if (!transferFrom) {
      alert("Please select source branch.");
      return;
    }

    if (!transferTo) {
      alert("Please select destination branch.");
      return;
    }

    if (transferFrom === transferTo) {
      alert(
        "Source and destination branches cannot be the same."
      );
      return;
    }

    if (!transferItem) {
      alert("Please select item.");
      return;
    }

    const qty = Number(transferQuantity);

    if (qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const sourceStock =
      stockData.find(
        (stock) =>
          stock.itemId ===
            Number(transferItem) &&
          stock.branchId ===
            transferFrom
      );

    const available =
      sourceStock?.balance || 0;

    if (qty > available) {
      alert(
        `Insufficient stock.\nAvailable: ${available}\nRequested: ${qty}`
      );
      return;
    }

    setSaving(true);

    try {
      const transferId =
        crypto.randomUUID();

      const date = new Date()
        .toISOString()
        .split("T")[0];

      const { error } =
        await supabase
          .from("stock_movements")
          .insert([
            {
              date,

              item_id:
                Number(transferItem),

              branch_id:
                transferFrom,

              movement_type:
                "TRANSFER_OUT",

              quantity: qty,

              quantity_in: 0,

              quantity_out: qty,

              unit_cost: 0,

              reference_type:
                "TRANSFER",

              notes:
                transferNotes.trim() ||
                "Stock transfer",

              transfer_id:
                transferId,
            },

            {
              date,

              item_id:
                Number(transferItem),

              branch_id:
                transferTo,

              movement_type:
                "TRANSFER_IN",

              quantity: qty,

              quantity_in: qty,

              quantity_out: 0,

              unit_cost: 0,

              reference_type:
                "TRANSFER",

              notes:
                transferNotes.trim() ||
                "Stock transfer",

              transfer_id:
                transferId,
            },
          ]);

      if (error) {
        throw new Error(error.message);
      }

      alert(
        "Stock transferred successfully."
      );

      clearTransfer();

      await loadMovements();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to transfer stock."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearAdjustment() {
    setAdjustmentBranch("");
    setAdjustmentItem("");
    setAdjustmentQuantity("");
    setAdjustmentType("IN");
    setAdjustmentNotes("");
  }

  function clearTransfer() {
    setTransferFrom("");
    setTransferTo("");
    setTransferItem("");
    setTransferQuantity("");
    setTransferNotes("");
  }

  /*
   * MOVEMENT LEDGER
   */

  const filteredMovements =
    movements.filter((movement) => {
      const itemName = getItemName(
        movement.item_id
      );

      const branchName =
        getBranchName(
          movement.branch_id
        );

      const text =
        `${itemName} ${branchName} ${
          movement.movement_type || ""
        } ${
          movement.reference_type || ""
        }`.toLowerCase();

      return (
        !search ||
        text.includes(
          search.toLowerCase()
        )
      );
    });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "38px",
    padding: "0 10px",
    backgroundColor: "#111827",
    color: "#ffffff",
    border: "1px solid #334155",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "13px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    color: "#cbd5e1",
    fontSize: "11px",
    fontWeight: 600,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#111827",
    border: "1px solid #263548",
    borderRadius: "10px",
    padding: "15px",
  };

  const buttonStyle: React.CSSProperties = {
    background:
      "linear-gradient(135deg, #06b6d4, #2563eb)",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "9px 18px",
    fontWeight: 700,
    cursor: saving
      ? "not-allowed"
      : "pointer",
    fontSize: "12px",
    opacity: saving ? 0.6 : 1,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
        padding: "16px",
      }}
    >
      {/* HEADER */}

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
            }}
          >
            STOCK MANAGEMENT
          </h1>

          <div
            style={{
              color: "#64748b",
              fontSize: "11px",
              marginTop: "3px",
            }}
          >
            Inventory • Transfers • Adjustments • Ledger
          </div>
        </div>

        <div
          style={{
            background: "#0b1220",
            border: "1px solid #263548",
            borderRadius: "6px",
            padding: "7px 12px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {movements.length} Movements
        </div>
      </div>

      {/* SUMMARY */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "14px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            TOTAL STOCK IN
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#22d3ee",
              fontSize: "21px",
            }}
          >
            {totalIn}
          </strong>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            TOTAL STOCK OUT
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#f87171",
              fontSize: "21px",
            }}
          >
            {totalOut}
          </strong>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              color: "#64748b",
              fontSize: "10px",
            }}
          >
            CURRENT STOCK
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "5px",
              color: "#4ade80",
              fontSize: "21px",
            }}
          >
            {totalStock}
          </strong>
        </div>
      </div>

      {/* OPENING STOCK */}

      <div
        style={{
          ...cardStyle,
          marginBottom: "14px",
        }}
      >
        <h2
          style={{
            margin: "0 0 12px",
            color: "#60a5fa",
            fontSize: "16px",
          }}
        >
          OPENING STOCK / STOCK ADJUSTMENT
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>
              Branch
            </label>

            <select
              value={adjustmentBranch}
              onChange={(e) =>
                setAdjustmentBranch(
                  e.target.value
                )
              }
              style={inputStyle}
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

          <div>
            <label style={labelStyle}>
              Item
            </label>

            <select
              value={adjustmentItem}
              onChange={(e) =>
                setAdjustmentItem(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Item
              </option>

              {items.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Quantity
            </label>

            <input
              type="number"
              min="0"
              value={adjustmentQuantity}
              onChange={(e) =>
                setAdjustmentQuantity(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Adjustment Type
            </label>

            <select
              value={adjustmentType}
              onChange={(e) =>
                setAdjustmentType(
                  e.target.value as
                    | "IN"
                    | "OUT"
                )
              }
              style={inputStyle}
            >
              <option value="IN">
                Stock IN
              </option>

              <option value="OUT">
                Stock OUT
              </option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Notes
            </label>

            <input
              value={adjustmentNotes}
              onChange={(e) =>
                setAdjustmentNotes(
                  e.target.value
                )
              }
              placeholder="Reason"
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          <button
            onClick={addOpeningStock}
            disabled={saving}
            style={buttonStyle}
          >
            Add Opening Stock
          </button>

          <button
            onClick={addAdjustment}
            disabled={saving}
            style={{
              ...buttonStyle,
              background:
                "linear-gradient(135deg,#7c3aed,#2563eb)",
            }}
          >
            Save Adjustment
          </button>
        </div>
      </div>

      {/* TRANSFER */}

      <div
        style={{
          ...cardStyle,
          marginBottom: "14px",
        }}
      >
        <h2
          style={{
            margin: "0 0 12px",
            color: "#60a5fa",
            fontSize: "16px",
          }}
        >
          BRANCH STOCK TRANSFER
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>
              From Branch
            </label>

            <select
              value={transferFrom}
              onChange={(e) =>
                setTransferFrom(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Source
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

          <div>
            <label style={labelStyle}>
              To Branch
            </label>

            <select
              value={transferTo}
              onChange={(e) =>
                setTransferTo(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Destination
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

          <div>
            <label style={labelStyle}>
              Item
            </label>

            <select
              value={transferItem}
              onChange={(e) =>
                setTransferItem(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Select Item
              </option>

              {items.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Quantity
            </label>

            <input
              type="number"
              min="0"
              value={transferQuantity}
              onChange={(e) =>
                setTransferQuantity(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Notes
            </label>

            <input
              value={transferNotes}
              onChange={(e) =>
                setTransferNotes(
                  e.target.value
                )
              }
              placeholder="Optional"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={transferStock}
          disabled={saving}
          style={{
            ...buttonStyle,
            marginTop: "12px",
          }}
        >
          Transfer Stock
        </button>
      </div>

      {/* STOCK */}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            CURRENT STOCK
          </h2>

          <input
            placeholder="Search item / branch..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              ...inputStyle,
              width: "230px",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <select
            value={selectedBranch}
            onChange={(e) =>
              setSelectedBranch(
                e.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              All Branches
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

          <select
            value={selectedItem}
            onChange={(e) =>
              setSelectedItem(
                e.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              All Items
            </option>

            {items.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.item_name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
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
                {[
                  "Item",
                  "Branch",
                  "Unit",
                  "Total IN",
                  "Total OUT",
                  "CURRENT STOCK",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "8px",
                      textAlign: "left",
                      color: "#67e8f9",
                      borderBottom:
                        "1px solid #263548",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    No stock records found.
                  </td>
                </tr>
              ) : (
                filteredStock.map((stock) => (
                  <tr
                    key={`${stock.itemId}-${stock.branchId}`}
                  >
                    <td
                      style={{
                        padding: "7px",
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.itemName}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.branchName}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.unit}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#22d3ee",
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.quantityIn}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#f87171",
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.quantityOut}
                    </td>

                    <td
                      style={{
                        padding: "7px",
                        color: "#4ade80",
                        fontWeight: 700,
                        borderBottom:
                          "1px solid #1e293b",
                      }}
                    >
                      {stock.balance}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STOCK LEDGER */}

      <div
        style={{
          ...cardStyle,
          marginTop: "14px",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            color: "#60a5fa",
            fontSize: "16px",
          }}
        >
          STOCK MOVEMENT LEDGER
        </h2>

        <div
          style={{
            overflowX: "auto",
            border: "1px solid #263548",
            borderRadius: "6px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#0b1220",
                }}
              >
                {[
                  "Date",
                  "Item",
                  "Branch",
                  "Movement",
                  "IN",
                  "OUT",
                  "Reference",
                  "Notes",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "7px",
                      textAlign: "left",
                      color: "#67e8f9",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredMovements.map(
                (movement) => (
                  <tr key={movement.id}>
                    <td style={{ padding: "6px" }}>
                      {movement.date || "-"}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {getItemName(
                        movement.item_id
                      )}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {getBranchName(
                        movement.branch_id
                      )}
                    </td>

                    <td
                      style={{
                        padding: "6px",
                        color:
                          movement.movement_type?.includes(
                            "OUT"
                          )
                            ? "#f87171"
                            : "#22d3ee",
                      }}
                    >
                      {movement.movement_type ||
                        "-"}
                    </td>

                    <td
                      style={{
                        padding: "6px",
                        color: "#22d3ee",
                      }}
                    >
                      {Number(
                        movement.quantity_in || 0
                      )}
                    </td>

                    <td
                      style={{
                        padding: "6px",
                        color: "#f87171",
                      }}
                    >
                      {Number(
                        movement.quantity_out || 0
                      )}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {movement.reference_type ||
                        "-"}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {movement.notes || "-"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Stock;