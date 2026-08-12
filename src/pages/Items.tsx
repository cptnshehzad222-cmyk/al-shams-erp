import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = {
  id: number;
  created_at: string;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  opening_stock: number | null;
  sales_price: number | null;
  branch_id: string | null;
  item_type: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
  location: string | null;
  phone: string | null;
  active: boolean | null;
};

type ItemForm = {
  item_name: string;
  category: string;
  unit: string;
  opening_stock: string;
  branch_id: string;
  sales_price: string;
  item_type: string;
};

function Items() {
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ItemForm>({
    item_name: "",
    category: "",
    unit: "PCS",
    opening_stock: "",
    branch_id: "",
    sales_price: "",
    item_type: "Both",
  });

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    await Promise.all([
      fetchBranches(),
      fetchItems(),
    ]);

    setLoading(false);
  }

  // ============================================================
  // FETCH BRANCHES
  // ============================================================

  async function fetchBranches() {
    const { data, error } = await supabase
      .from("branches")
      .select(
        "id, branch_name, location, phone, active"
      )
      .eq("active", true)
      .order("branch_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Branch loading error:",
        error.message
      );
      return;
    }

    setBranches(data || []);
  }

  // ============================================================
  // FETCH ITEMS
  // ============================================================

  async function fetchItems() {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("item_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Item loading error:",
        error.message
      );
      return;
    }

    setItems(data || []);
  }

  // ============================================================
  // UPDATE FORM
  // ============================================================

  function updateForm(
    field: keyof ItemForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  function validateForm() {
    const name = form.item_name.trim();

    if (!name) {
      alert("Please enter item name.");
      return false;
    }

    if (!form.category.trim()) {
      alert("Please select or enter item category.");
      return false;
    }

    if (!form.unit.trim()) {
      alert("Please enter item unit.");
      return false;
    }

    if (!form.branch_id) {
      alert("Please select branch.");
      return false;
    }

    const openingStock =
      Number(form.opening_stock);

    if (
      form.opening_stock !== "" &&
      (!Number.isFinite(openingStock) ||
        openingStock < 0)
    ) {
      alert(
        "Please enter a valid opening stock."
      );
      return false;
    }

    const salesPrice =
      Number(form.sales_price);

    if (
      form.sales_price !== "" &&
      (!Number.isFinite(salesPrice) ||
        salesPrice < 0)
    ) {
      alert(
        "Please enter a valid sales price."
      );
      return false;
    }

    return true;
  }

  // ============================================================
  // CHECK DUPLICATE ITEM
  // ============================================================

  function isDuplicateItem() {
    const normalizedName =
      form.item_name
        .trim()
        .toLowerCase();

    return items.some((item) => {
      if (
        editingId !== null &&
        item.id === editingId
      ) {
        return false;
      }

      return (
        (item.item_name || "")
          .trim()
          .toLowerCase() ===
        normalizedName
      );
    });
  }

  // ============================================================
  // SAVE ITEM
  // ============================================================

  async function saveItem() {
    if (!validateForm()) {
      return;
    }

    if (isDuplicateItem()) {
      alert(
        "An item with this name already exists. Please use the existing item instead of creating a duplicate."
      );
      return;
    }

    setSaving(true);

    const openingStock =
      form.opening_stock === ""
        ? 0
        : Number(form.opening_stock);

    const salesPrice =
      form.sales_price === ""
        ? 0
        : Number(form.sales_price);

    const itemData = {
      item_name:
        form.item_name.trim(),

      category:
        form.category.trim(),

      unit:
        form.unit.trim(),

      opening_stock:
        openingStock,

      branch_id:
        form.branch_id,

      sales_price:
        salesPrice,

      item_type:
        form.item_type,
    };

    try {
      // ========================================================
      // UPDATE
      // ========================================================

      if (editingId !== null) {
        const { error } = await supabase
          .from("items")
          .update(itemData)
          .eq("id", editingId);

        if (error) {
          throw new Error(
            error.message
          );
        }

        alert(
          "Item updated successfully."
        );
      }

      // ========================================================
      // INSERT
      // ========================================================

      else {
        const { error } = await supabase
          .from("items")
          .insert(itemData);

        if (error) {
          throw new Error(
            error.message
          );
        }

        alert(
          "Item added successfully."
        );
      }

      clearForm();
      await fetchItems();
    } catch (error) {
      console.error(
        "Save item error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save item."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // EDIT ITEM
  // ============================================================

  function editItem(item: Item) {
    setEditingId(item.id);

    setForm({
      item_name:
        item.item_name || "",

      category:
        item.category || "",

      unit:
        item.unit || "PCS",

      opening_stock:
        item.opening_stock !== null
          ? String(item.opening_stock)
          : "",

      branch_id:
        item.branch_id || "",

      sales_price:
        item.sales_price !== null
          ? String(item.sales_price)
          : "",

      item_type:
        item.item_type || "Both",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ============================================================
  // DELETE ITEM
  // ============================================================

  async function deleteItem(id: number) {
    const item = items.find(
      (currentItem) =>
        currentItem.id === id
    );

    if (!item) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${item.item_name}"?\n\nThe system will first check whether this item is already used in purchases, sales, or stock movements.`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      // ========================================================
      // CHECK PURCHASE HISTORY
      // ========================================================

      const {
        data: purchaseRecords,
        error: purchaseError,
      } = await supabase
        .from("purchases")
        .select("id")
        .eq("item_id", id)
        .limit(1);

      if (purchaseError) {
        throw new Error(
          purchaseError.message
        );
      }

      // ========================================================
      // CHECK SALES HISTORY
      // ========================================================

      const {
        data: salesRecords,
        error: salesError,
      } = await supabase
        .from("sales")
        .select("id")
        .eq("item_id", id)
        .limit(1);

      if (salesError) {
        throw new Error(
          salesError.message
        );
      }

      // ========================================================
      // CHECK STOCK MOVEMENT HISTORY
      // ========================================================

      const {
        data: stockRecords,
        error: stockError,
      } = await supabase
        .from("stock_movements")
        .select("id")
        .eq("item_id", id)
        .limit(1);

      if (stockError) {
        throw new Error(
          stockError.message
        );
      }

      // ========================================================
      // DO NOT DELETE HISTORICAL ITEMS
      // ========================================================

      if (
        (purchaseRecords &&
          purchaseRecords.length > 0) ||
        (salesRecords &&
          salesRecords.length > 0) ||
        (stockRecords &&
          stockRecords.length > 0)
      ) {
        alert(
          "This item already has transaction or stock history, so it cannot be deleted safely.\n\nKeep the item because its historical records are important for your ERP."
        );

        return;
      }

      // ========================================================
      // DELETE NEW UNUSED ITEM
      // ========================================================

      const { error } =
        await supabase
          .from("items")
          .delete()
          .eq("id", id);

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (editingId === id) {
        clearForm();
      }

      await fetchItems();

      alert(
        "Unused item deleted successfully."
      );
    } catch (error) {
      console.error(
        "Delete item error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete item."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // CLEAR FORM
  // ============================================================

  function clearForm() {
    setEditingId(null);

    setForm({
      item_name: "",
      category: "",
      unit: "PCS",
      opening_stock: "",
      branch_id: "",
      sales_price: "",
      item_type: "Both",
    });
  }

  // ============================================================
  // BRANCH NAME
  // ============================================================

  function getBranchName(
    branchId: string | null
  ) {
    if (!branchId) {
      return "-";
    }

    const branch =
      branches.find(
        (currentBranch) =>
          currentBranch.id ===
          branchId
      );

    return branch
      ? branch.branch_name
      : "-";
  }

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredItems =
    useMemo(() => {
      const text =
        search
          .trim()
          .toLowerCase();

      if (!text) {
        return items;
      }

      return items.filter(
        (item) => {
          const itemName =
            (
              item.item_name ||
              ""
            ).toLowerCase();

          const category =
            (
              item.category ||
              ""
            ).toLowerCase();

          const unit =
            (
              item.unit ||
              ""
            ).toLowerCase();

          const itemType =
            (
              item.item_type ||
              ""
            ).toLowerCase();

          const branch =
            getBranchName(
              item.branch_id
            ).toLowerCase();

          return (
            itemName.includes(text) ||
            category.includes(text) ||
            unit.includes(text) ||
            itemType.includes(text) ||
            branch.includes(text)
          );
        }
      );
    }, [
      items,
      search,
      branches,
    ]);

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalItems =
    items.length;

  const totalOpeningStock =
    items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.opening_stock || 0
        ),
      0
    );

  const activePurchaseItems =
    items.filter((item) => {
      const type =
        (
          item.item_type ||
          ""
        )
          .trim()
          .toLowerCase();

      return (
        type === "purchase" ||
        type === "both" ||
        type === ""
      );
    }).length;

  const activeSalesItems =
    items.filter((item) => {
      const type =
        (
          item.item_type ||
          ""
        )
          .trim()
          .toLowerCase();

      return (
        type === "sale" ||
        type === "sales" ||
        type === "both" ||
        type === ""
      );
    }).length;

  // ============================================================
  // STYLES
  // ============================================================

  const pageStyle: React.CSSProperties =
    {
      width: "100%",
      minHeight: "100vh",
      background:
        "linear-gradient(135deg, #07111f 0%, #0f172a 50%, #111827 100%)",
      color: "#ffffff",
      padding: "18px",
      boxSizing: "border-box",
    };

  const cardStyle:
    React.CSSProperties = {
      backgroundColor:
        "#111827",
      border:
        "1px solid #263548",
      borderRadius: "10px",
      padding: "17px",
      boxSizing: "border-box",
    };

  const inputStyle:
    React.CSSProperties = {
      width: "100%",
      height: "39px",
      padding: "0 10px",
      backgroundColor:
        "#0b1220",
      color: "#ffffff",
      border:
        "1px solid #334155",
      borderRadius: "6px",
      boxSizing: "border-box",
      fontSize: "12px",
      outline: "none",
    };

  const labelStyle:
    React.CSSProperties = {
      display: "block",
      marginBottom: "5px",
      color: "#cbd5e1",
      fontSize: "11px",
      fontWeight: 600,
    };

  const summaryCardStyle:
    React.CSSProperties = {
      flex: "1 1 180px",
      backgroundColor:
        "#0b1220",
      border:
        "1px solid #263548",
      borderRadius: "8px",
      padding: "12px",
    };

  const thStyle:
    React.CSSProperties = {
      padding: "9px 8px",
      textAlign: "left",
      color: "#67e8f9",
      fontWeight: 700,
      whiteSpace: "nowrap",
      borderBottom:
        "1px solid #263548",
    };

  const tdStyle:
    React.CSSProperties = {
      padding: "8px",
      color: "#cbd5e1",
      whiteSpace: "nowrap",
      borderBottom:
        "1px solid #1e293b",
    };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div style={pageStyle}>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#22d3ee",
              fontSize: "25px",
              letterSpacing:
                "0.8px",
              fontWeight: 800,
            }}
          >
            ITEMS
          </h1>

          <div
            style={{
              color: "#64748b",
              fontSize: "11px",
              marginTop: "3px",
            }}
          >
            Item & Stock Master
          </div>
        </div>

        <div
          style={{
            backgroundColor:
              "#0b1220",
            border:
              "1px solid #263548",
            borderRadius: "7px",
            padding:
              "8px 13px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          {items.length} Items
        </div>
      </div>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        <div
          style={summaryCardStyle}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            TOTAL ITEMS
          </div>

          <div
            style={{
              color: "#22d3ee",
              fontSize: "22px",
              fontWeight: 800,
              marginTop: "4px",
            }}
          >
            {totalItems}
          </div>
        </div>

        <div
          style={summaryCardStyle}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            OPENING STOCK
          </div>

          <div
            style={{
              color: "#4ade80",
              fontSize: "22px",
              fontWeight: 800,
              marginTop: "4px",
            }}
          >
            {totalOpeningStock.toLocaleString()}
          </div>
        </div>

        <div
          style={summaryCardStyle}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            PURCHASE ITEMS
          </div>

          <div
            style={{
              color: "#60a5fa",
              fontSize: "22px",
              fontWeight: 800,
              marginTop: "4px",
            }}
          >
            {activePurchaseItems}
          </div>
        </div>

        <div
          style={summaryCardStyle}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: "9px",
              fontWeight: 700,
            }}
          >
            SALES ITEMS
          </div>

          <div
            style={{
              color: "#fbbf24",
              fontSize: "22px",
              fontWeight: 800,
              marginTop: "4px",
            }}
          >
            {activeSalesItems}
          </div>
        </div>
      </div>

      {/* ======================================================
          ITEM FORM
      ====================================================== */}

      <div
        style={{
          ...cardStyle,
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
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
                ? "EDIT ITEM"
                : "ADD NEW ITEM"}
            </h2>

            <div
              style={{
                color: "#64748b",
                fontSize: "10px",
                marginTop: "3px",
              }}
            >
              Manage products and
              opening stock
            </div>
          </div>

          {editingId !== null && (
            <button
              onClick={
                clearForm
              }
              style={{
                backgroundColor:
                  "#374151",
                color: "#ffffff",
                border: "none",
                borderRadius: "5px",
                padding:
                  "7px 12px",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          {/* ITEM NAME */}

          <div>
            <label
              style={labelStyle}
            >
              Item Name *
            </label>

            <input
              style={inputStyle}
              placeholder="e.g. Close Top Drum"
              value={
                form.item_name
              }
              onChange={(e) =>
                updateForm(
                  "item_name",
                  e.target.value
                )
              }
            />
          </div>

          {/* CATEGORY */}

          <div>
            <label
              style={labelStyle}
            >
              Category *
            </label>

            <select
              style={inputStyle}
              value={
                form.category
              }
              onChange={(e) =>
                updateForm(
                  "category",
                  e.target.value
                )
              }
            >
              <option value="">
                Select Category
              </option>

              <option value="Drums">
                Drums
              </option>

              <option value="Plastic">
                Plastic
              </option>

              <option value="Scrap">
                Scrap
              </option>

              <option value="SATAL">
                SATAL
              </option>

              <option value="IBC">
                IBC
              </option>

              <option value="Cap Seals">
                Cap Seals
              </option>

              <option value="Makena">
                Makena
              </option>

              <option value="Paint">
                Paint
              </option>

              <option value="Other">
                Other
              </option>
            </select>
          </div>

          {/* UNIT */}

          <div>
            <label
              style={labelStyle}
            >
              Unit *
            </label>

            <select
              style={inputStyle}
              value={
                form.unit
              }
              onChange={(e) =>
                updateForm(
                  "unit",
                  e.target.value
                )
              }
            >
              <option value="PCS">
                PCS
              </option>

              <option value="LTR">
                LTR
              </option>

              <option value="KG">
                KG
              </option>

              <option value="SET">
                SET
              </option>

              <option value="BOX">
                BOX
              </option>

              <option value="OTHER">
                OTHER
              </option>
            </select>
          </div>

          {/* ITEM TYPE */}

          <div>
            <label
              style={labelStyle}
            >
              Item Type *
            </label>

            <select
              style={inputStyle}
              value={
                form.item_type
              }
              onChange={(e) =>
                updateForm(
                  "item_type",
                  e.target.value
                )
              }
            >
              <option value="Both">
                Purchase & Sale
              </option>

              <option value="Purchase">
                Purchase Only
              </option>

              <option value="Sale">
                Sale Only
              </option>
            </select>
          </div>

          {/* OPENING STOCK */}

          <div>
            <label
              style={labelStyle}
            >
              Opening Stock
            </label>

            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={
                form.opening_stock
              }
              onChange={(e) =>
                updateForm(
                  "opening_stock",
                  e.target.value
                )
              }
            />
          </div>

          {/* BRANCH */}

          <div>
            <label
              style={labelStyle}
            >
              Branch *
            </label>

            <select
              style={inputStyle}
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

          {/* SALES PRICE */}

          <div>
            <label
              style={labelStyle}
            >
              Default Sales Price
            </label>

            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00 SAR"
              value={
                form.sales_price
              }
              onChange={(e) =>
                updateForm(
                  "sales_price",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* STOCK LOGIC NOTE */}

        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            backgroundColor:
              "#0b1220",
            border:
              "1px solid #263548",
            borderRadius: "7px",
            color: "#94a3b8",
            fontSize: "10px",
            lineHeight: 1.6,
          }}
        >
          <strong
            style={{
              color: "#67e8f9",
            }}
          >
            Stock rule:
          </strong>{" "}
          Thinner and Oil empty
          drums will ultimately
          feed into the{" "}
          <strong
            style={{
              color: "#4ade80",
            }}
          >
            Close Top
          </strong>{" "}
          stock category, while
          Open Top remains a
          separate stock category.
        </div>

        {/* SAVE BUTTON */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            marginTop: "14px",
          }}
        >
          <button
            onClick={
              saveItem
            }
            disabled={saving}
            style={{
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding:
                "9px 24px",
              fontWeight: 700,
              fontSize: "12px",
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
              ? "Update Item"
              : "Add Item"}
          </button>
        </div>
      </div>

      {/* ======================================================
          ITEM RECORDS
      ====================================================== */}

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
            flexWrap: "wrap",
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
              ITEM RECORDS
            </h2>

            <div
              style={{
                color: "#64748b",
                fontSize: "10px",
                marginTop: "3px",
              }}
            >
              Search and manage
              existing items
            </div>
          </div>

          <input
            style={{
              ...inputStyle,
              width: "240px",
            }}
            placeholder="Search item, category, branch..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        {/* TABLE */}

        <div
          style={{
            width: "100%",
            overflowX: "auto",
            border:
              "1px solid #263548",
            borderRadius: "7px",
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
                  Item
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Category
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Unit
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Type
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Opening Stock
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Sales Price
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Branch
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding:
                        "25px",
                      textAlign:
                        "center",
                      color:
                        "#64748b",
                    }}
                  >
                    Loading items...
                  </td>
                </tr>
              ) : filteredItems.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding:
                        "25px",
                      textAlign:
                        "center",
                      color:
                        "#64748b",
                    }}
                  >
                    No items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map(
                  (item, index) => (
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
                        {index + 1}
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
                        {
                          item.item_name ||
                          "-"
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.category ||
                          "-"
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.unit ||
                          "-"
                        }
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
                              "3px 7px",
                            borderRadius:
                              "4px",
                            backgroundColor:
                              "#172554",
                            color:
                              "#93c5fd",
                            fontSize:
                              "10px",
                          }}
                        >
                          {
                            item.item_type ||
                            "Both"
                          }
                        </span>
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color:
                            "#22d3ee",
                          fontWeight:
                            700,
                        }}
                      >
                        {Number(
                          item.opening_stock ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {Number(
                          item.sales_price ||
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
                        {getBranchName(
                          item.branch_id
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
                          }}
                        >
                          <button
                            onClick={() =>
                              editItem(
                                item
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
                              fontSize:
                                "10px",
                              cursor:
                                "pointer",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              deleteItem(
                                item.id
                              )
                            }
                            disabled={
                              saving
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
                              fontSize:
                                "10px",
                              cursor:
                                saving
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                saving
                                  ? 0.6
                                  : 1,
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

        {/* FOOTER */}

        <div
          style={{
            marginTop: "10px",
            color: "#64748b",
            fontSize: "10px",
          }}
        >
          Showing{" "}
          <strong
            style={{
              color: "#cbd5e1",
            }}
          >
            {filteredItems.length}
          </strong>{" "}
          of{" "}
          <strong
            style={{
              color: "#cbd5e1",
            }}
          >
            {items.length}
          </strong>{" "}
          items
        </div>
      </div>
    </div>
  );
}

export default Items;