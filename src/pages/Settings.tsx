import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { CSSProperties } from "react";

type SystemSetting = {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CompanyProfile = {
  id: number;
  company_name: string;
  company_name_ar: string | null;
  cr_number: string | null;
  vat_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VatSetting = {
  id: number;
  setting_name: string;
  setting_value: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type User = {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  branch_id: string | null;
  active: boolean | null;
  created_at: string | null;
};

type Role = {
  id: string;
  role_name: string;
  description: string | null;
};

function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "company" | "vat" | "users" | "system">("general");

  // General Settings
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [settingValue, setSettingValue] = useState("");

  // Company Profile
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    company_name_ar: "",
    cr_number: "",
    vat_number: "",
    address: "",
    phone: "",
    email: "",
  });

  // VAT Settings
  const [vatSettings, setVatSettings] = useState<VatSetting[]>([]);
  const [newVatRate, setNewVatRate] = useState({ name: "", value: "", description: "" });

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    full_name: "",
    role_id: "",
    branch_id: "",
  });

  // File input ref for logo
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    loadAllSettings();
  }, []);

  async function loadAllSettings() {
    setLoading(true);
    try {
      await Promise.all([
        loadSystemSettings(),
        loadCompanyProfile(),
        loadVatSettings(),
        loadUsers(),
        loadRoles(),
      ]);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSystemSettings() {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .order("setting_key");

    if (error) throw error;
    setSystemSettings(data || []);
  }

  async function loadCompanyProfile() {
    const { data, error } = await supabase
      .from("company_profile")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      setCompanyProfile(data);
      setCompanyForm({
        company_name: data.company_name || "",
        company_name_ar: data.company_name_ar || "",
        cr_number: data.cr_number || "",
        vat_number: data.vat_number || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
      });
    }
  }

  async function loadVatSettings() {
    const { data, error } = await supabase
      .from("vat_settings")
      .select("*")
      .order("setting_name");

    if (error) throw error;
    setVatSettings(data || []);
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("full_name");

    if (error) throw error;
    setUsers(data || []);
  }

  async function loadRoles() {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("role_name");

    if (error) throw error;
    setRoles(data || []);
  }

  // ============================================================
  // SYSTEM SETTINGS
  // ============================================================

  async function updateSystemSetting(key: string, value: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq("setting_key", key);

      if (error) throw error;
      await loadSystemSettings();
      setEditingSetting(null);
    } catch (error) {
      console.error("Error updating setting:", error);
      alert("Failed to update setting");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // COMPANY PROFILE
  // ============================================================

  async function updateCompanyProfile() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("company_profile")
        .update({
          ...companyForm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyProfile?.id);

      if (error) throw error;
      await loadCompanyProfile();
      alert("Company profile updated successfully!");
    } catch (error) {
      console.error("Error updating company profile:", error);
      alert("Failed to update company profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `company/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      await supabase
        .from("company_profile")
        .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", companyProfile?.id);

      await loadCompanyProfile();
      alert("Logo uploaded successfully!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert("Failed to upload logo");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ============================================================
  // VAT SETTINGS
  // ============================================================

  async function addVatSetting() {
    if (!newVatRate.name || !newVatRate.value) {
      alert("Please enter both name and value");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("vat_settings")
        .insert({
          setting_name: newVatRate.name,
          setting_value: newVatRate.value,
          description: newVatRate.description || null,
          is_active: true,
        });

      if (error) throw error;
      await loadVatSettings();
      setNewVatRate({ name: "", value: "", description: "" });
      alert("VAT setting added!");
    } catch (error) {
      console.error("Error adding VAT setting:", error);
      alert("Failed to add VAT setting");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVatStatus(id: number, currentStatus: boolean | null) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vat_settings")
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await loadVatSettings();
    } catch (error) {
      console.error("Error toggling VAT status:", error);
      alert("Failed to update VAT status");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVatSetting(id: number) {
    if (!window.confirm("Delete this VAT setting?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("vat_settings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await loadVatSettings();
    } catch (error) {
      console.error("Error deleting VAT setting:", error);
      alert("Failed to delete VAT setting");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // NEON STYLES
  // ============================================================

  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh",
      padding: "18px",
      boxSizing: "border-box",
      background: "#000000",
      color: "#ffffff",
    } as React.CSSProperties,

    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      flexWrap: "wrap",
      gap: "10px",
    } as React.CSSProperties,

    title: {
      margin: 0,
      color: "#22d3ee",
      fontSize: "28px",
      fontWeight: 900,
      textShadow: "0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.15)",
      letterSpacing: "2px",
      textTransform: "uppercase",
    } as React.CSSProperties,

    subtitle: {
      margin: "4px 0 0",
      color: "#67e8f9",
      fontSize: "13px",
      textShadow: "0 0 15px rgba(34,211,238,0.15)",
      opacity: 0.8,
      letterSpacing: "0.5px",
    } as React.CSSProperties,

    tabs: {
      display: "flex",
      gap: "8px",
      marginBottom: "20px",
      flexWrap: "wrap",
    } as React.CSSProperties,

    tab: (active: boolean) => ({
      padding: "10px 20px",
      borderRadius: "8px",
      border: active ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(34,211,238,0.08)",
      background: active ? "rgba(34,211,238,0.08)" : "rgba(17,24,39,0.4)",
      color: active ? "#67e8f9" : "#94a3b8",
      fontWeight: 700,
      fontSize: "12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      backdropFilter: "blur(10px)",
      boxShadow: active ? "0 0 20px rgba(34,211,238,0.05)" : "none",
    }),

    panel: {
      background: "linear-gradient(145deg, rgba(15,26,46,0.7), rgba(10,20,37,0.7))",
      border: "1px solid rgba(34,211,238,0.08)",
      borderRadius: "12px",
      padding: "20px",
      backdropFilter: "blur(10px)",
      boxShadow: "0 0 20px rgba(34,211,238,0.03), inset 0 0 30px rgba(34,211,238,0.01)",
    } as React.CSSProperties,

    sectionTitle: {
      margin: "0 0 16px 0",
      color: "#60a5fa",
      fontSize: "16px",
      fontWeight: 800,
      textShadow: "0 0 20px rgba(96,165,250,0.15)",
    } as React.CSSProperties,

    sectionSubtitle: {
      margin: "4px 0 12px 0",
      color: "#64748b",
      fontSize: "11px",
    } as React.CSSProperties,

    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "14px",
    } as React.CSSProperties,

    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "14px",
    } as React.CSSProperties,

    label: {
      display: "block",
      marginBottom: "5px",
      color: "#94a3b8",
      fontSize: "10px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    } as React.CSSProperties,

    input: {
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
    } as React.CSSProperties,

    textarea: {
      width: "100%",
      padding: "10px 12px",
      boxSizing: "border-box",
      background: "rgba(11,18,32,0.8)",
      color: "#ffffff",
      border: "1px solid rgba(34,211,238,0.15)",
      borderRadius: "6px",
      outline: "none",
      fontSize: "12px",
      minHeight: "80px",
      resize: "vertical",
      transition: "all 0.3s ease",
    } as React.CSSProperties,

    button: (color: string) => ({
      border: "none",
      borderRadius: "6px",
      padding: "8px 18px",
      background: `linear-gradient(135deg, rgba(${color},0.2), rgba(${color},0.1))`,
      color: `#${color}`,
      fontWeight: 700,
      fontSize: "11px",
      cursor: "pointer",
      border: `1px solid rgba(${color},0.2)`,
      transition: "all 0.3s ease",
    }),

    buttonPrimary: {
      border: "none",
      borderRadius: "6px",
      padding: "9px 20px",
      background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))",
      color: "#67e8f9",
      fontWeight: 700,
      fontSize: "12px",
      cursor: "pointer",
      border: "1px solid rgba(34,211,238,0.2)",
      transition: "all 0.3s ease",
    } as React.CSSProperties,

    buttonDanger: {
      border: "none",
      borderRadius: "6px",
      padding: "6px 12px",
      background: "rgba(239,68,68,0.1)",
      color: "#f87171",
      fontWeight: 700,
      fontSize: "10px",
      cursor: "pointer",
      border: "1px solid rgba(239,68,68,0.15)",
      transition: "all 0.3s ease",
    } as React.CSSProperties,

    buttonSuccess: {
      border: "none",
      borderRadius: "6px",
      padding: "6px 12px",
      background: "rgba(34,197,94,0.1)",
      color: "#86efac",
      fontWeight: 700,
      fontSize: "10px",
      cursor: "pointer",
      border: "1px solid rgba(34,197,94,0.15)",
      transition: "all 0.3s ease",
    } as React.CSSProperties,

    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "12px",
    } as React.CSSProperties,

    th: {
      padding: "10px 12px",
      textAlign: "left",
      color: "#67e8f9",
      fontWeight: 700,
      borderBottom: "1px solid rgba(34,211,238,0.06)",
      background: "rgba(11,18,32,0.4)",
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    } as React.CSSProperties,

    td: {
      padding: "10px 12px",
      color: "#cbd5e1",
      borderBottom: "1px solid rgba(34,211,238,0.04)",
      fontSize: "11px",
    } as React.CSSProperties,

    badge: (active: boolean) => ({
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "4px",
      fontSize: "9px",
      fontWeight: 700,
      background: active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: active ? "#86efac" : "#f87171",
      border: `1px solid ${active ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
    }),

    row: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "10px",
    } as React.CSSProperties,

    flex: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap",
    } as React.CSSProperties,

    modalOverlay: {
      position: "fixed" as const,
      inset: 0,
      background: "rgba(0, 0, 0, 0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
      backdropFilter: "blur(10px)",
    },

    modal: {
      width: "min(500px, 100%)",
      background: "linear-gradient(145deg, rgba(11,18,32,0.95), rgba(17,24,39,0.95))",
      border: "1px solid rgba(34,211,238,0.12)",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.03)",
      backdropFilter: "blur(20px)",
    } as React.CSSProperties,

    modalTitle: {
      margin: "0 0 16px 0",
      color: "#22d3ee",
      fontSize: "18px",
      fontWeight: 900,
      textShadow: "0 0 20px rgba(34,211,238,0.15)",
    } as React.CSSProperties,

    modalClose: {
      float: "right" as const,
      background: "rgba(30,41,59,0.4)",
      border: "1px solid rgba(34,211,238,0.1)",
      borderRadius: "6px",
      color: "#cbd5e1",
      width: "30px",
      height: "30px",
      cursor: "pointer",
      fontSize: "18px",
      transition: "all 0.3s ease",
    },
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>⚙️ SETTINGS</h1>
          <p style={styles.subtitle}>System configuration • Company profile • VAT • Users</p>
        </div>
        <button
          onClick={loadAllSettings}
          disabled={loading || saving}
          style={{
            ...styles.buttonPrimary,
            opacity: loading || saving ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
            e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {[
          { key: "general", label: "📋 General" },
          { key: "company", label: "🏢 Company" },
          { key: "vat", label: "🧾 VAT" },
          { key: "users", label: "👥 Users" },
          { key: "system", label: "⚙️ System" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={styles.tab(activeTab === tab.key)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                e.currentTarget.style.background = "rgba(34,211,238,0.03)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.08)";
                e.currentTarget.style.background = "rgba(17,24,39,0.4)";
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================
          GENERAL TAB
          ============================================================ */}
      {activeTab === "general" && (
        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>📋 General Settings</h2>
          <p style={styles.sectionSubtitle}>Manage system-wide settings and configurations</p>

          <div style={styles.grid2}>
            {systemSettings.map((setting) => (
              <div
                key={setting.setting_key}
                style={{
                  background: "rgba(11,18,32,0.4)",
                  border: "1px solid rgba(34,211,238,0.06)",
                  borderRadius: "8px",
                  padding: "14px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.06)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {setting.setting_key.replace(/_/g, " ")}
                    </div>
                    {setting.description && (
                      <div style={{ color: "#64748b", fontSize: "10px", marginTop: "3px" }}>
                        {setting.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {editingSetting === setting.setting_key ? (
                      <>
                        <input
                          type="text"
                          value={settingValue}
                          onChange={(e) => setSettingValue(e.target.value)}
                          style={{
                            ...styles.input,
                            width: "120px",
                            height: "32px",
                            fontSize: "11px",
                          }}
                          autoFocus
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                            e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateSystemSetting(setting.setting_key, settingValue);
                            }
                            if (e.key === "Escape") {
                              setEditingSetting(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => updateSystemSetting(setting.setting_key, settingValue)}
                          style={styles.buttonSuccess}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(34,197,94,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSetting(null)}
                          style={styles.buttonDanger}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ color: "#22d3ee", fontSize: "14px", fontWeight: 700 }}>
                          {setting.setting_value}
                        </div>
                        <button
                          onClick={() => {
                            setEditingSetting(setting.setting_key);
                            setSettingValue(setting.setting_value);
                          }}
                          style={styles.button("96,165,250")}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(96,165,250,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================
          COMPANY TAB
          ============================================================ */}
      {activeTab === "company" && (
        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>🏢 Company Profile</h2>
          <p style={styles.sectionSubtitle}>Manage your company information and branding</p>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Company Name (English)</label>
              <input
                type="text"
                value={companyForm.company_name}
                onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                style={styles.input}
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

            <div>
              <label style={styles.label}>Company Name (Arabic)</label>
              <input
                type="text"
                value={companyForm.company_name_ar}
                onChange={(e) => setCompanyForm({ ...companyForm, company_name_ar: e.target.value })}
                style={styles.input}
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

            <div>
              <label style={styles.label}>CR Number</label>
              <input
                type="text"
                value={companyForm.cr_number}
                onChange={(e) => setCompanyForm({ ...companyForm, cr_number: e.target.value })}
                style={styles.input}
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

            <div>
              <label style={styles.label}>VAT Number</label>
              <input
                type="text"
                value={companyForm.vat_number}
                onChange={(e) => setCompanyForm({ ...companyForm, vat_number: e.target.value })}
                style={styles.input}
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

            <div>
              <label style={styles.label}>Phone</label>
              <input
                type="text"
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                style={styles.input}
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

            <div>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                style={styles.input}
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
          </div>

          <div style={{ marginTop: "14px" }}>
            <label style={styles.label}>Address</label>
            <textarea
              value={companyForm.address}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              style={styles.textarea}
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

          <div style={{ ...styles.flex, marginTop: "14px" }}>
            <button
              onClick={updateCompanyProfile}
              disabled={saving}
              style={{
                ...styles.buttonPrimary,
                opacity: saving ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
              }}
            >
              {saving ? "Saving..." : "Save Company Profile"}
            </button>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={uploadLogo}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
                style={{
                  ...styles.button("34,211,238"),
                  opacity: saving ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Upload Logo
              </button>
              {companyProfile?.logo_url && (
                <span style={{ color: "#64748b", fontSize: "10px", marginLeft: "10px" }}>
                  ✓ Logo uploaded
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          VAT TAB
          ============================================================ */}
      {activeTab === "vat" && (
        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>🧾 VAT Settings</h2>
          <p style={styles.sectionSubtitle}>Manage VAT rates and configurations</p>

          <div style={{ ...styles.grid3, marginBottom: "16px" }}>
            <div>
              <label style={styles.label}>Rate Name</label>
              <input
                type="text"
                value={newVatRate.name}
                onChange={(e) => setNewVatRate({ ...newVatRate, name: e.target.value })}
                placeholder="e.g. Standard VAT"
                style={styles.input}
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
            <div>
              <label style={styles.label}>Rate Value (%)</label>
              <input
                type="number"
                step="0.01"
                value={newVatRate.value}
                onChange={(e) => setNewVatRate({ ...newVatRate, value: e.target.value })}
                placeholder="e.g. 15"
                style={styles.input}
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
            <div>
              <label style={styles.label}>Description</label>
              <input
                type="text"
                value={newVatRate.description}
                onChange={(e) => setNewVatRate({ ...newVatRate, description: e.target.value })}
                placeholder="Optional description"
                style={styles.input}
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
          </div>

          <button
            onClick={addVatSetting}
            disabled={saving}
            style={{
              ...styles.buttonPrimary,
              marginBottom: "16px",
              opacity: saving ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
            }}
          >
            + Add VAT Rate
          </button>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Rate</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vatSettings.map((setting) => (
                  <tr
                    key={setting.id}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(34,211,238,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={styles.td}>{setting.setting_name}</td>
                    <td style={styles.td}>{setting.setting_value}%</td>
                    <td style={styles.td}>{setting.description || "-"}</td>
                    <td style={styles.td}>
                      <span style={styles.badge(setting.is_active || false)}>
                        {setting.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button
                          onClick={() => toggleVatStatus(setting.id, setting.is_active)}
                          style={setting.is_active ? styles.buttonDanger : styles.buttonSuccess}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(34,197,94,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {setting.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteVatSetting(setting.id)}
                          style={styles.buttonDanger}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(239,68,68,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vatSettings.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                      No VAT settings found. Add your first VAT rate above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          USERS TAB
          ============================================================ */}
      {activeTab === "users" && (
        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>👥 User Management</h2>
          <p style={styles.sectionSubtitle}>Manage system users and roles</p>

          <button
            onClick={() => setShowUserModal(true)}
            style={{
              ...styles.buttonPrimary,
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
            }}
          >
            + Add User
          </button>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(34,211,238,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ ...styles.td, color: "#ffffff", fontWeight: 700 }}>
                      {user.full_name}
                    </td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>
                      {roles.find(r => r.id === user.role_id)?.role_name || "-"}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(user.active !== false)}>
                        {user.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          SYSTEM TAB
          ============================================================ */}
      {activeTab === "system" && (
        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>⚙️ System Information</h2>
          <p style={styles.sectionSubtitle}>System status and information</p>

          <div style={styles.grid2}>
            <div style={{
              background: "rgba(11,18,32,0.4)",
              border: "1px solid rgba(34,211,238,0.06)",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Database Status
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                <span style={{ color: "#4ade80", fontSize: "14px" }}>●</span>
                <span style={{ color: "#cbd5e1", fontSize: "14px", fontWeight: 700 }}>Connected</span>
              </div>
            </div>

            <div style={{
              background: "rgba(11,18,32,0.4)",
              border: "1px solid rgba(34,211,238,0.06)",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Users
              </div>
              <div style={{ color: "#22d3ee", fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>
                {users.length}
              </div>
            </div>

            <div style={{
              background: "rgba(11,18,32,0.4)",
              border: "1px solid rgba(34,211,238,0.06)",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Settings
              </div>
              <div style={{ color: "#22d3ee", fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>
                {systemSettings.length}
              </div>
            </div>

            <div style={{
              background: "rgba(11,18,32,0.4)",
              border: "1px solid rgba(34,211,238,0.06)",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                System Version
              </div>
              <div style={{ color: "#cbd5e1", fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
                v2.0.0
              </div>
            </div>
          </div>

          <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(11,18,32,0.3)", borderRadius: "8px", border: "1px solid rgba(34,211,238,0.06)" }}>
            <div style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Last Updated
            </div>
            <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
              {new Date().toLocaleString("en-GB")}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          ADD USER MODAL
          ============================================================ */}
      {showUserModal && (
        <div style={styles.modalOverlay} onClick={() => setShowUserModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setShowUserModal(false)}>
              ×
            </button>
            <h2 style={styles.modalTitle}>👤 Add New User</h2>

            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={styles.label}>Full Name *</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="John Doe"
                  style={styles.input}
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

              <div>
                <label style={styles.label}>Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="john@example.com"
                  style={styles.input}
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

              <div>
                <label style={styles.label}>Role</label>
                <select
                  value={userForm.role_id}
                  onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
                  style={styles.input}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.05)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.role_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowUserModal(false)}
                style={styles.buttonDanger}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 15px rgba(239,68,68,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Create user logic here
                  setShowUserModal(false);
                }}
                style={styles.buttonPrimary}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 30px rgba(34,211,238,0.15)";
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)";
                }}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;