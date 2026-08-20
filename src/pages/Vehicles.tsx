import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";

type Driver = {
  id: number;
  driver_name: string;
  active?: boolean | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

type Vehicle = {
  id: number;
  vehicle_name: string;
  vehicle_number: string | null;
  plate_number: string | null;

  branch_id: string | null;
  driver_id: number | null;

  istimara_number: string | null;
  istimara_expiry: string | null;

  fahas_number: string | null;
  fahas_expiry: string | null;

  tasgheel_card_number: string | null;
  tasgheel_card_expiry: string | null;

  insurance_number: string | null;
  insurance_expiry: string | null;

  registration_details: string | null;
  notes: string | null;

  active: boolean | null;

  created_at: string | null;
  updated_at: string | null;
};

type VehicleForm = {
  vehicle_name: string;
  vehicle_number: string;
  plate_number: string;

  branch_id: string;
  driver_id: string;

  istimara_number: string;
  istimara_expiry: string;

  fahas_number: string;
  fahas_expiry: string;

  tasgheel_card_number: string;
  tasgheel_card_expiry: string;

  insurance_number: string;
  insurance_expiry: string;

  registration_details: string;
  notes: string;
};

type VehicleDocument = {
  id: number;
  vehicle_id: number;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
};

type ExpiryStatus =
  | "VALID"
  | "EXPIRING"
  | "EXPIRED"
  | "NOT SET";

const COMPANY_NAME_EN = "AL SHAMS AL GHAYABA TRD EST.";
const COMPANY_NAME_AR = "مؤسسة الشمس الغائبة للتجارة";

const emptyForm: VehicleForm = {
  vehicle_name: "",
  vehicle_number: "",
  plate_number: "",

  branch_id: "",
  driver_id: "",

  istimara_number: "",
  istimara_expiry: "",

  fahas_number: "",
  fahas_expiry: "",

  tasgheel_card_number: "",
  tasgheel_card_expiry: "",

  insurance_number: "",
  insurance_expiry: "",

  registration_details: "",
  notes: "",
};

function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [form, setForm] = useState<VehicleForm>({
    ...emptyForm,
  });

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] =
    useState("ALL");
  const [driverFilter, setDriverFilter] =
    useState("ALL");
  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [documentVehicle, setDocumentVehicle] =
    useState<Vehicle | null>(null);

  const [documents, setDocuments] =
    useState<VehicleDocument[]>([]);

  const [documentLoading, setDocumentLoading] =
    useState(false);

  const [uploadingDocument, setUploadingDocument] =
    useState(false);

  const [documentDescription, setDocumentDescription] =
    useState("");

  const [pdfLoading, setPdfLoading] =
    useState(false);

  /* ============================================================
     LOAD DATA
  ============================================================ */

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);

    try {
      const [
        vehiclesResult,
        driversResult,
        branchesResult,
      ] = await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .order("id", { ascending: false }),

        supabase
          .from("drivers")
          .select(
            "id, driver_name, active"
          )
          .eq("active", true)
          .order("driver_name", {
            ascending: true,
          }),

        supabase
          .from("branches")
          .select(
            "id, branch_name"
          )
          .order("branch_name", {
            ascending: true,
          }),
      ]);

      if (vehiclesResult.error) {
        throw new Error(
          `Vehicles: ${vehiclesResult.error.message}`
        );
      }

      if (driversResult.error) {
        throw new Error(
          `Drivers: ${driversResult.error.message}`
        );
      }

      if (branchesResult.error) {
        throw new Error(
          `Branches: ${branchesResult.error.message}`
        );
      }

      setVehicles(
        vehiclesResult.data || []
      );

      setDrivers(
        driversResult.data || []
      );

      setBranches(
        branchesResult.data || []
      );

      if (
        !form.branch_id &&
        branchesResult.data &&
        branchesResult.data.length === 1
      ) {
        setForm((previous) => ({
          ...previous,
          branch_id: String(
            branchesResult.data![0].id
          ),
        }));
      }
    } catch (error) {
      console.error(
        "Vehicle loading error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to load vehicle data."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     FORM
  ============================================================ */

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function clearForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      branch_id:
        branches.length === 1
          ? String(branches[0].id)
          : "",
    });
  }

  function validateForm() {
    if (!form.vehicle_name.trim()) {
      alert("Vehicle name is required.");
      return false;
    }

    if (!form.plate_number.trim()) {
      alert("Plate number is required.");
      return false;
    }

    if (!form.branch_id) {
      alert("Branch is required.");
      return false;
    }

    return true;
  }

  /* ============================================================
     SAVE VEHICLE
  ============================================================ */

  async function saveVehicle() {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const vehicleData = {
        vehicle_name:
          form.vehicle_name.trim(),

        vehicle_number:
          form.vehicle_number.trim() || null,

        plate_number:
          form.plate_number.trim() || null,

        branch_id:
          form.branch_id || null,

        driver_id: form.driver_id
          ? Number(form.driver_id)
          : null,

        istimara_number:
          form.istimara_number.trim() || null,

        istimara_expiry:
          form.istimara_expiry || null,

        fahas_number:
          form.fahas_number.trim() || null,

        fahas_expiry:
          form.fahas_expiry || null,

        tasgheel_card_number:
          form.tasgheel_card_number.trim() ||
          null,

        tasgheel_card_expiry:
          form.tasgheel_card_expiry || null,

        insurance_number:
          form.insurance_number.trim() || null,

        insurance_expiry:
          form.insurance_expiry || null,

        registration_details:
          form.registration_details.trim() ||
          null,

        notes:
          form.notes.trim() || null,
      };

      if (editingId !== null) {
        const { error } =
          await supabase
            .from("vehicles")
            .update(vehicleData)
            .eq("id", editingId);

        if (error) {
          throw new Error(
            `Unable to update vehicle: ${error.message}`
          );
        }

        alert(
          "Vehicle updated successfully."
        );
      } else {
        const { error } =
          await supabase
            .from("vehicles")
            .insert(vehicleData);

        if (error) {
          throw new Error(
            `Unable to create vehicle: ${error.message}`
          );
        }

        alert(
          "Vehicle added successfully."
        );
      }

      clearForm();
      await loadAllData();
    } catch (error) {
      console.error(
        "Save vehicle error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to save vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     EDIT VEHICLE
  ============================================================ */

  function editVehicle(
    vehicle: Vehicle
  ) {
    setEditingId(vehicle.id);

    setForm({
      vehicle_name:
        vehicle.vehicle_name || "",

      vehicle_number:
        vehicle.vehicle_number || "",

      plate_number:
        vehicle.plate_number || "",

      branch_id:
        vehicle.branch_id || "",

      driver_id:
        vehicle.driver_id !== null
          ? String(vehicle.driver_id)
          : "",

      istimara_number:
        vehicle.istimara_number || "",

      istimara_expiry:
        vehicle.istimara_expiry || "",

      fahas_number:
        vehicle.fahas_number || "",

      fahas_expiry:
        vehicle.fahas_expiry || "",

      tasgheel_card_number:
        vehicle.tasgheel_card_number ||
        "",

      tasgheel_card_expiry:
        vehicle.tasgheel_card_expiry ||
        "",

      insurance_number:
        vehicle.insurance_number || "",

      insurance_expiry:
        vehicle.insurance_expiry || "",

      registration_details:
        vehicle.registration_details ||
        "",

      notes:
        vehicle.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* ============================================================
     DELETE VEHICLE
  ============================================================ */

  async function deleteVehicle(
    vehicle: Vehicle
  ) {
    if (
      !window.confirm(
        `Delete vehicle "${vehicle.vehicle_name}"?`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("vehicles")
          .delete()
          .eq("id", vehicle.id);

      if (error) {
        throw new Error(
          `Unable to delete vehicle: ${error.message}`
        );
      }

      alert(
        "Vehicle deleted successfully."
      );

      await loadAllData();
    } catch (error) {
      console.error(
        "Delete vehicle error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     EXPIRY CALCULATIONS
  ============================================================ */

  function getDaysUntilExpiry(
    expiryDate: string | null
  ): number | null {
    if (!expiryDate) return null;

    const today = new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const expiry =
      new Date(
        `${expiryDate}T00:00:00`
      );

    const difference =
      expiry.getTime() -
      today.getTime();

    return Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );
  }

  function getExpiryStatus(
    expiryDate: string | null
  ): ExpiryStatus {
    const days =
      getDaysUntilExpiry(
        expiryDate
      );

    if (days === null) {
      return "NOT SET";
    }

    if (days < 0) {
      return "EXPIRED";
    }

    if (days <= 30) {
      return "EXPIRING";
    }

    return "VALID";
  }

  function getStatusForVehicle(
    vehicle: Vehicle
  ): ExpiryStatus {
    const statuses = [
      getExpiryStatus(
        vehicle.istimara_expiry
      ),

      getExpiryStatus(
        vehicle.fahas_expiry
      ),

      getExpiryStatus(
        vehicle.tasgheel_card_expiry
      ),

      getExpiryStatus(
        vehicle.insurance_expiry
      ),
    ];

    if (
      statuses.includes(
        "EXPIRED"
      )
    ) {
      return "EXPIRED";
    }

    if (
      statuses.includes(
        "EXPIRING"
      )
    ) {
      return "EXPIRING";
    }

    const hasAnyDate =
      statuses.some(
        (status) =>
          status !== "NOT SET"
      );

    if (!hasAnyDate) {
      return "NOT SET";
    }

    return "VALID";
  }

  function getExpiryLabel(
    expiryDate: string | null
  ) {
    const days =
      getDaysUntilExpiry(
        expiryDate
      );

    if (days === null) {
      return {
        text: "NOT SET",
        color: "#64748b",
        background: "#1e293b",
      };
    }

    if (days < 0) {
      return {
        text: `EXPIRED ${Math.abs(
          days
        )} DAYS`,
        color: "#fca5a5",
        background: "#7f1d1d",
      };
    }

    if (days === 0) {
      return {
        text: "EXPIRES TODAY",
        color: "#fca5a5",
        background: "#7f1d1d",
      };
    }

    if (days <= 30) {
      return {
        text: `${days} DAYS LEFT`,
        color: "#fde68a",
        background: "#78350f",
      };
    }

    return {
      text: `${days} DAYS LEFT`,
      color: "#86efac",
      background: "#14532d",
    };
  }

  /* ============================================================
     FILTERED VEHICLES
  ============================================================ */

  const filteredVehicles =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return vehicles.filter(
        (vehicle) => {
          const driver =
            drivers.find(
              (d) =>
                d.id ===
                vehicle.driver_id
            );

          const matchesSearch =
            !searchText ||
            vehicle.vehicle_name
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            vehicle.vehicle_number
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            vehicle.plate_number
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            driver?.driver_name
              ?.toLowerCase()
              .includes(
                searchText
              );

          const matchesBranch =
            branchFilter ===
              "ALL" ||
            vehicle.branch_id ===
              branchFilter;

          const matchesDriver =
            driverFilter ===
              "ALL" ||
            String(
              vehicle.driver_id
            ) ===
              driverFilter;

          const vehicleStatus =
            getStatusForVehicle(
              vehicle
            );

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            vehicleStatus ===
              statusFilter;

          return (
            matchesSearch &&
            matchesBranch &&
            matchesDriver &&
            matchesStatus
          );
        }
      );
    }, [
      vehicles,
      drivers,
      search,
      branchFilter,
      driverFilter,
      statusFilter,
    ]);

  /* ============================================================
     DASHBOARD COUNTS
  ============================================================ */

  const totalVehicles =
    vehicles.length;

  const expiredVehicles =
    vehicles.filter(
      (vehicle) =>
        getStatusForVehicle(
          vehicle
        ) === "EXPIRED"
    ).length;

  const expiringVehicles =
    vehicles.filter(
      (vehicle) =>
        getStatusForVehicle(
          vehicle
        ) === "EXPIRING"
    ).length;

  const validVehicles =
    vehicles.filter(
      (vehicle) =>
        getStatusForVehicle(
          vehicle
        ) === "VALID"
    ).length;

  /* ============================================================
     DOCUMENTS
  ============================================================ */

  async function openDocuments(
    vehicle: Vehicle
  ) {
    setDocumentVehicle(
      vehicle
    );

    await loadDocuments(
      vehicle.id
    );
  }

  async function loadDocuments(
    vehicleId: number
  ) {
    setDocumentLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "vehicle_documents"
        )
        .select("*")
        .eq(
          "vehicle_id",
          vehicleId
        )
        .order("id", {
          ascending: false,
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      setDocuments(
        data || []
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load vehicle documents."
      );
    } finally {
      setDocumentLoading(
        false
      );
    }
  }

  async function uploadDocument(
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (!documentVehicle)
      return;

    const file =
      event.target.files?.[0];

    if (!file) return;

    setUploadingDocument(
      true
    );

    try {
      const safeFileName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const filePath =
        `vehicles/${documentVehicle.id}/${Date.now()}-${safeFileName}`;

      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(
            "erp-vehicle-documents"
          )
          .upload(
            filePath,
            file,
            {
              cacheControl:
                "3600",
              upsert: false,
            }
          );

      if (uploadError) {
        throw new Error(
          `Upload failed: ${uploadError.message}`
        );
      }

      const {
        error: databaseError,
      } =
        await supabase
          .from(
            "vehicle_documents"
          )
          .insert({
            vehicle_id:
              documentVehicle.id,

            file_name:
              file.name,

            file_path:
              filePath,

            file_type:
              file.type ||
              null,

            file_size:
              file.size,

            description:
              documentDescription.trim() ||
              null,

            uploaded_by:
              "Admin",
          });

      if (databaseError) {
        await supabase.storage
          .from(
            "erp-vehicle-documents"
          )
          .remove([
            filePath,
          ]);

        throw new Error(
          `Unable to save document record: ${databaseError.message}`
        );
      }

      setDocumentDescription(
        ""
      );

      event.target.value =
        "";

      await loadDocuments(
        documentVehicle.id
      );

      alert(
        "Vehicle document uploaded successfully."
      );
    } catch (error) {
      console.error(
        "Vehicle document upload error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to upload document."
      );
    } finally {
      setUploadingDocument(
        false
      );
    }
  }

  async function viewDocument(
    document: VehicleDocument
  ) {
    try {
      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            "erp-vehicle-documents"
          )
          .createSignedUrl(
            document.file_path,
            60 * 60
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (
        !data?.signedUrl
      ) {
        throw new Error(
          "Unable to create document URL."
        );
      }

      window.open(
        data.signedUrl,
        "_blank"
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to open document."
      );
    }
  }

  async function deleteDocument(
    document: VehicleDocument
  ) {
    if (
      !window.confirm(
        `Delete document "${document.file_name}"?`
      )
    ) {
      return;
    }

    try {
      const {
        error: storageError,
      } =
        await supabase.storage
          .from(
            "erp-vehicle-documents"
          )
          .remove([
            document.file_path,
          ]);

      if (storageError) {
        throw new Error(
          `Storage: ${storageError.message}`
        );
      }

      const {
        error: databaseError,
      } =
        await supabase
          .from(
            "vehicle_documents"
          )
          .delete()
          .eq(
            "id",
            document.id
          );

      if (databaseError) {
        throw new Error(
          databaseError.message
        );
      }

      if (documentVehicle) {
        await loadDocuments(
          documentVehicle.id
        );
      }

      alert(
        "Vehicle document deleted successfully."
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete document."
      );
    }
  }

  /* ============================================================
     PDF HELPERS
  ============================================================ */

  function formatDate(
    date: string | null
  ) {
    if (!date) return "-";

    const parsed =
      new Date(
        `${date}T00:00:00`
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-GB"
    );
  }

  function getDriverName(
    vehicle: Vehicle
  ) {
    return (
      drivers.find(
        (driver) =>
          driver.id ===
          vehicle.driver_id
      )?.driver_name ||
      "Not Assigned"
    );
  }

  function getBranchName(
    vehicle: Vehicle
  ) {
    return (
      branches.find(
        (branch) =>
          branch.id ===
          vehicle.branch_id
      )?.branch_name ||
      "-"
    );
  }

  function pdfSafeText(
    value: string | null | undefined
  ) {
    if (!value) return "-";

    return String(value)
      .replace(/\r/g, "")
      .replace(/\n/g, " ");
  }

  function drawPdfHeader(
    doc: jsPDF,
    title: string
  ) {
    const pageWidth =
      doc.internal.pageSize
        .getWidth();

    doc.setFillColor(
      7,
      17,
      31
    );

    doc.rect(
      0,
      0,
      pageWidth,
      38,
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

    doc.setFontSize(17);

    doc.text(
      COMPANY_NAME_EN,
      15,
      14
    );

    doc.setFontSize(9);

    doc.setTextColor(
      148,
      163,
      184
    );

    doc.text(
      COMPANY_NAME_AR,
      15,
      21
    );

    doc.setTextColor(
      96,
      165,
      250
    );

    doc.setFontSize(12);

    doc.text(
      title,
      15,
      31
    );

    doc.setTextColor(
      148,
      163,
      184
    );

    doc.setFontSize(8);

    doc.text(
      `Generated: ${new Date().toLocaleString(
        "en-GB"
      )}`,
      pageWidth - 15,
      31,
      {
        align: "right",
      }
    );
  }

  function ensurePdfSpace(
    doc: jsPDF,
    y: number,
    requiredHeight: number
  ) {
    const pageHeight =
      doc.internal.pageSize
        .getHeight();

    if (
      y + requiredHeight >
      pageHeight - 18
    ) {
      doc.addPage();
      drawPdfHeader(
        doc,
        "VEHICLE REPORT"
      );
      return 47;
    }

    return y;
  }

  function drawPdfSectionTitle(
    doc: jsPDF,
    title: string,
    y: number
  ) {
    const pageWidth =
      doc.internal.pageSize
        .getWidth();

    y =
      ensurePdfSpace(
        doc,
        y,
        14
      );

    doc.setFillColor(
      15,
      23,
      42
    );

    doc.roundedRect(
      15,
      y,
      pageWidth - 30,
      9,
      2,
      2,
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

    doc.setFontSize(9);

    doc.text(
      title,
      19,
      y + 6
    );

    return y + 14;
  }

  function drawPdfField(
    doc: jsPDF,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number
  ) {
    doc.setTextColor(
      100,
      116,
      139
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(7);

    doc.text(
      label,
      x,
      y
    );

    const lines =
      doc.splitTextToSize(
        pdfSafeText(value),
        width
      );

    doc.setTextColor(
      226,
      232,
      240
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(8);

    doc.text(
      lines,
      x,
      y + 5
    );

    return Math.max(
      12,
      lines.length * 4 + 8
    );
  }

  function drawPdfStatus(
    doc: jsPDF,
    status: ExpiryStatus,
    x: number,
    y: number
  ) {
    let background: [
      number,
      number,
      number
    ];

    let textColor: [
      number,
      number,
      number
    ];

    if (
      status === "EXPIRED"
    ) {
      background = [
        127,
        29,
        29,
      ];

      textColor = [
        252,
        165,
        165,
      ];
    } else if (
      status === "EXPIRING"
    ) {
      background = [
        120,
        53,
        15,
      ];

      textColor = [
        253,
        230,
        138,
      ];
    } else if (
      status === "VALID"
    ) {
      background = [
        20,
        83,
        45,
      ];

      textColor = [
        134,
        239,
        172,
      ];
    } else {
      background = [
        30,
        41,
        59,
      ];

      textColor = [
        148,
        163,
        184,
      ];
    }

    doc.setFillColor(
      background[0],
      background[1],
      background[2]
    );

    doc.roundedRect(
      x,
      y - 5,
      28,
      7,
      1.5,
      1.5,
      "F"
    );

    doc.setTextColor(
      textColor[0],
      textColor[1],
      textColor[2]
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(6.5);

    doc.text(
      status,
      x + 2,
      y
    );
  }

  /* ============================================================
     SINGLE VEHICLE PDF
  ============================================================ */

  async function exportSingleVehiclePdf(
    vehicle: Vehicle
  ) {
    setPdfLoading(true);

    try {
      const doc =
        new jsPDF({
          orientation:
            "portrait",
          unit: "mm",
          format: "a4",
        });

      drawPdfHeader(
        doc,
        "VEHICLE / DAYNA REPORT"
      );

      const pageWidth =
        doc.internal.pageSize
          .getWidth();

      let y = 48;

      const vehicleStatus =
        getStatusForVehicle(
          vehicle
        );

      /* VEHICLE INFORMATION */

      y =
        drawPdfSectionTitle(
          doc,
          "VEHICLE INFORMATION",
          y
        );

      const colWidth =
        (pageWidth - 40) /
        2;

      let rowHeight = Math.max(
        drawPdfField(
          doc,
          "VEHICLE NAME",
          vehicle.vehicle_name,
          18,
          y,
          colWidth
        ),
        drawPdfField(
          doc,
          "VEHICLE NUMBER",
          vehicle.vehicle_number ||
            "-",
          18 + colWidth,
          y,
          colWidth
        )
      );

      y += rowHeight;

      rowHeight = Math.max(
        drawPdfField(
          doc,
          "PLATE NUMBER",
          vehicle.plate_number ||
            "-",
          18,
          y,
          colWidth
        ),
        drawPdfField(
          doc,
          "BRANCH",
          getBranchName(
            vehicle
          ),
          18 + colWidth,
          y,
          colWidth
        )
      );

      y += rowHeight;

      rowHeight = Math.max(
        drawPdfField(
          doc,
          "DRIVER",
          getDriverName(
            vehicle
          ),
          18,
          y,
          colWidth
        ),
        drawPdfField(
          doc,
          "OVERALL STATUS",
          vehicleStatus,
          18 + colWidth,
          y,
          colWidth
        )
      );

      y += rowHeight + 3;

      /* DOCUMENTS */

      y =
        drawPdfSectionTitle(
          doc,
          "DOCUMENTS & EXPIRY",
          y
        );

      const expiryRows = [
        {
          title: "ISTIMARA",
          number:
            vehicle.istimara_number ||
            "-",
          expiry:
            vehicle.istimara_expiry,
        },
        {
          title: "FAHAS",
          number:
            vehicle.fahas_number ||
            "-",
          expiry:
            vehicle.fahas_expiry,
        },
        {
          title: "CARD TASGHEEL",
          number:
            vehicle.tasgheel_card_number ||
            "-",
          expiry:
            vehicle.tasgheel_card_expiry,
        },
        {
          title: "INSURANCE",
          number:
            vehicle.insurance_number ||
            "-",
          expiry:
            vehicle.insurance_expiry,
        },
      ];

      expiryRows.forEach(
        (item) => {
          y =
            ensurePdfSpace(
              doc,
              y,
              18
            );

          doc.setDrawColor(
            38,
            53,
            72
          );

          doc.line(
            15,
            y + 12,
            pageWidth - 15,
            y + 12
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

          doc.setFontSize(8);

          doc.text(
            item.title,
            18,
            y
          );

          doc.setTextColor(
            203,
            213,
            225
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(8);

          doc.text(
            `Number: ${pdfSafeText(
              item.number
            )}`,
            18,
            y + 6
          );

          doc.text(
            `Expiry: ${formatDate(
              item.expiry
            )}`,
            92,
            y + 6
          );

          const status =
            getExpiryStatus(
              item.expiry
            );

          drawPdfStatus(
            doc,
            status,
            pageWidth - 48,
            y + 5
          );

          y += 16;
        }
      );

      /* REGISTRATION */

      y += 2;

      y =
        drawPdfSectionTitle(
          doc,
          "REGISTRATION DETAILS",
          y
        );

      y =
        ensurePdfSpace(
          doc,
          y,
          25
        );

      const registrationLines =
        doc.splitTextToSize(
          pdfSafeText(
            vehicle.registration_details
          ),
          pageWidth - 38
        );

      doc.setTextColor(
        203,
        213,
        225
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8);

      doc.text(
        registrationLines,
        18,
        y
      );

      y += Math.max(
        18,
        registrationLines.length *
          4 +
          8
      );

      /* NOTES */

      y =
        drawPdfSectionTitle(
          doc,
          "NOTES",
          y
        );

      y =
        ensurePdfSpace(
          doc,
          y,
          25
        );

      const noteLines =
        doc.splitTextToSize(
          pdfSafeText(
            vehicle.notes
          ),
          pageWidth - 38
        );

      doc.setTextColor(
        203,
        213,
        225
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(8);

      doc.text(
        noteLines,
        18,
        y
      );

      y += Math.max(
        18,
        noteLines.length *
          4 +
          8
      );

      /* ATTACHED DOCUMENTS */

      let vehicleDocuments: VehicleDocument[] =
        [];

      try {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "vehicle_documents"
            )
            .select("*")
            .eq(
              "vehicle_id",
              vehicle.id
            )
            .order("id", {
              ascending: false,
            });

        if (!error) {
          vehicleDocuments =
            data || [];
        }
      } catch {
        vehicleDocuments = [];
      }

      y =
        drawPdfSectionTitle(
          doc,
          "ATTACHED DOCUMENTS",
          y
        );

      if (
        vehicleDocuments.length ===
        0
      ) {
        y =
          ensurePdfSpace(
            doc,
            y,
            15
          );

        doc.setTextColor(
          100,
          116,
          139
        );

        doc.setFontSize(8);

        doc.text(
          "No documents attached.",
          18,
          y
        );

        y += 12;
      } else {
        vehicleDocuments.forEach(
          (
            document,
            index
          ) => {
            y =
              ensurePdfSpace(
                doc,
                y,
                15
              );

            doc.setTextColor(
              226,
              232,
              240
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(8);

            doc.text(
              `${index + 1}. ${pdfSafeText(
                document.file_name
              )}`,
              18,
              y
            );

            doc.setFont(
              "helvetica",
              "normal"
            );

            doc.setTextColor(
              100,
              116,
              139
            );

            doc.setFontSize(7);

            doc.text(
              pdfSafeText(
                document.description
              ),
              22,
              y + 5
            );

            y += 11;
          }
        );
      }

      /* FOOTER */

      addPdfFooters(doc);

      const safeName =
        vehicle.vehicle_name
          .replace(
            /[^a-zA-Z0-9-_]/g,
            "_"
          );

      doc.save(
        `Vehicle_${safeName}_${vehicle.plate_number || vehicle.id}.pdf`
      );
    } catch (error) {
      console.error(
        "Single vehicle PDF error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to export vehicle PDF."
      );
    } finally {
      setPdfLoading(false);
    }
  }

  /* ============================================================
     ALL VEHICLES PDF
  ============================================================ */

  async function exportAllVehiclesPdf() {
    if (
      filteredVehicles.length ===
      0
    ) {
      alert(
        "There are no vehicles to export."
      );

      return;
    }

    setPdfLoading(true);

    try {
      const doc =
        new jsPDF({
          orientation:
            "landscape",
          unit: "mm",
          format: "a4",
        });

      drawPdfHeader(
        doc,
        "VEHICLES / DAYNAS - ALL VEHICLES"
      );

      const pageWidth =
        doc.internal.pageSize
          .getWidth();

      const pageHeight =
        doc.internal.pageSize
          .getHeight();

      let y = 47;

      /* SUMMARY */

      doc.setFillColor(
        15,
        23,
        42
      );

      doc.roundedRect(
        15,
        y,
        pageWidth - 30,
        17,
        2,
        2,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(8);

      doc.setTextColor(
        34,
        211,
        238
      );

      doc.text(
        `TOTAL VEHICLES: ${filteredVehicles.length}`,
        20,
        y + 7
      );

      doc.setTextColor(
        134,
        239,
        172
      );

      doc.text(
        `VALID: ${
          filteredVehicles.filter(
            (v) =>
              getStatusForVehicle(
                v
              ) === "VALID"
          ).length
        }`,
        85,
        y + 7
      );

      doc.setTextColor(
        253,
        230,
        138
      );

      doc.text(
        `EXPIRING: ${
          filteredVehicles.filter(
            (v) =>
              getStatusForVehicle(
                v
              ) === "EXPIRING"
          ).length
        }`,
        135,
        y + 7
      );

      doc.setTextColor(
        252,
        165,
        165
      );

      doc.text(
        `EXPIRED: ${
          filteredVehicles.filter(
            (v) =>
              getStatusForVehicle(
                v
              ) === "EXPIRED"
          ).length
        }`,
        195,
        y + 7
      );

      doc.setTextColor(
        148,
        163,
        184
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `Filters: ${
          branchFilter === "ALL"
            ? "All Branches"
            : getBranchName(
                filteredVehicles[0]
              )
        }`,
        250,
        y + 7
      );

      y += 25;

      /* TABLE SETTINGS */

      const columns = [
        {
          title: "VEHICLE",
          width: 38,
        },
        {
          title: "PLATE",
          width: 25,
        },
        {
          title: "DRIVER",
          width: 35,
        },
        {
          title: "BRANCH",
          width: 35,
        },
        {
          title: "ISTIMARA",
          width: 32,
        },
        {
          title: "FAHAS",
          width: 32,
        },
        {
          title: "TASGHEEL",
          width: 32,
        },
        {
          title: "INSURANCE",
          width: 32,
        },
        {
          title: "STATUS",
          width: 28,
        },
      ];

      const tableX = 10;
      const tableWidth =
        columns.reduce(
          (sum, column) =>
            sum + column.width,
          0
        );

      function drawTableHeader(
        headerY: number
      ) {
        doc.setFillColor(
          11,
          18,
          32
        );

        doc.rect(
          tableX,
          headerY,
          tableWidth,
          10,
          "F"
        );

        let x =
          tableX;

        columns.forEach(
          (column) => {
            doc.setDrawColor(
              38,
              53,
              72
            );

            doc.rect(
              x,
              headerY,
              column.width,
              10
            );

            doc.setTextColor(
              103,
              232,
              249
            );

            doc.setFont(
              "helvetica",
              "bold"
            );

            doc.setFontSize(6.5);

            doc.text(
              column.title,
              x + 2,
              headerY + 6.5
            );

            x +=
              column.width;
          }
        );
      }

      drawTableHeader(y);

      y += 10;

      /* TABLE ROWS */

      for (
        let index = 0;
        index <
        filteredVehicles.length;
        index++
      ) {
        const vehicle =
          filteredVehicles[
            index
          ];

        const rowHeight = 15;

        if (
          y + rowHeight >
          pageHeight - 15
        ) {
          doc.addPage();

          drawPdfHeader(
            doc,
            "VEHICLES / DAYNAS - ALL VEHICLES"
          );

          y = 47;

          drawTableHeader(y);

          y += 10;
        }

        if (
          index % 2 ===
          0
        ) {
          doc.setFillColor(
            17,
            24,
            39
          );
        } else {
          doc.setFillColor(
            15,
            23,
            42
          );
        }

        doc.rect(
          tableX,
          y,
          tableWidth,
          rowHeight,
          "F"
        );

        let x =
          tableX;

        const status =
          getStatusForVehicle(
            vehicle
          );

        const rowValues = [
          `${vehicle.vehicle_name}${
            vehicle.vehicle_number
              ? ` (${vehicle.vehicle_number})`
              : ""
          }`,
          vehicle.plate_number ||
            "-",
          getDriverName(
            vehicle
          ),
          getBranchName(
            vehicle
          ),
          formatDate(
            vehicle.istimara_expiry
          ),
          formatDate(
            vehicle.fahas_expiry
          ),
          formatDate(
            vehicle.tasgheel_card_expiry
          ),
          formatDate(
            vehicle.insurance_expiry
          ),
          status,
        ];

        columns.forEach(
          (
            column,
            columnIndex
          ) => {
            doc.setDrawColor(
              38,
              53,
              72
            );

            doc.rect(
              x,
              y,
              column.width,
              rowHeight
            );

            if (
              columnIndex ===
              8
            ) {
              if (
                status ===
                "EXPIRED"
              ) {
                doc.setTextColor(
                  252,
                  165,
                  165
                );
              } else if (
                status ===
                "EXPIRING"
              ) {
                doc.setTextColor(
                  253,
                  230,
                  138
                );
              } else if (
                status ===
                "VALID"
              ) {
                doc.setTextColor(
                  134,
                  239,
                  172
                );
              } else {
                doc.setTextColor(
                  148,
                  163,
                  184
                );
              }
            } else if (
              columnIndex ===
              0
            ) {
              doc.setTextColor(
                255,
                255,
                255
              );
            } else if (
              columnIndex ===
              1
            ) {
              doc.setTextColor(
                34,
                211,
                238
              );
            } else {
              doc.setTextColor(
                203,
                213,
                225
              );
            }

            doc.setFont(
              "helvetica",
              columnIndex ===
                0 ||
                columnIndex ===
                  8
                ? "bold"
                : "normal"
            );

            doc.setFontSize(
              6.5
            );

            const text =
              pdfSafeText(
                rowValues[
                  columnIndex
                ]
              );

            const wrapped =
              doc.splitTextToSize(
                text,
                column.width - 4
              );

            doc.text(
              wrapped.slice(
                0,
                2
              ),
              x + 2,
              y + 6
            );

            x +=
              column.width;
          }
        );

        y += rowHeight;
      }

      addPdfFooters(doc);

      doc.save(
        `Vehicles_All_${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.pdf`
      );
    } catch (error) {
      console.error(
        "All vehicles PDF error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to export vehicles PDF."
      );
    } finally {
      setPdfLoading(false);
    }
  }

  /* ============================================================
     PDF FOOTER
  ============================================================ */

  function addPdfFooters(
    doc: jsPDF
  ) {
    const totalPages =
      doc.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page++
    ) {
      doc.setPage(page);

      const pageWidth =
        doc.internal.pageSize
          .getWidth();

      const pageHeight =
        doc.internal.pageSize
          .getHeight();

      doc.setDrawColor(
        38,
        53,
        72
      );

      doc.line(
        15,
        pageHeight - 12,
        pageWidth - 15,
        pageHeight - 12
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7);

      doc.setTextColor(
        100,
        116,
        139
      );

      doc.text(
        COMPANY_NAME_EN,
        15,
        pageHeight - 6
      );

      doc.text(
        `Page ${page} of ${totalPages}`,
        pageWidth - 15,
        pageHeight - 6,
        {
          align: "right",
        }
      );
    }
  }

  /* ============================================================
     STYLES
  ============================================================ */

  const inputStyle: CSSProperties =
    {
      width: "100%",
      height: "38px",
      padding: "0 10px",
      backgroundColor:
        "#0b1220",
      color: "#ffffff",
      border:
        "1px solid #334155",
      borderRadius: "6px",
      boxSizing:
        "border-box",
      fontSize: "12px",
      outline: "none",
    };

  const labelStyle: CSSProperties =
    {
      display: "block",
      marginBottom: "5px",
      color: "#94a3b8",
      fontSize: "10px",
      fontWeight: 700,
    };

  const thStyle: CSSProperties =
    {
      padding: "8px 7px",
      textAlign: "left",
      color: "#67e8f9",
      fontWeight: 700,
      whiteSpace:
        "nowrap",
      borderBottom:
        "1px solid #263548",
    };

  const tdStyle: CSSProperties =
    {
      padding: "7px",
      color: "#cbd5e1",
      whiteSpace:
        "nowrap",
      borderBottom:
        "1px solid #1e293b",
    };

  const emptyStyle: CSSProperties =
    {
      padding: "25px",
      textAlign: "center",
      color: "#64748b",
    };

  /* ============================================================
     RETURN
  ============================================================ */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "18px",
        boxSizing:
          "border-box",
        background:
          "linear-gradient(135deg, #07111f, #0f172a, #111827)",
        color: "#ffffff",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "15px",
          gap: "10px",
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
            VEHICLES / DAYNAS
          </h1>

          <div
            style={{
              marginTop: "3px",
              color: "#64748b",
              fontSize: "11px",
            }}
          >
            Vehicle Registration,
            Documents & Expiry
            Management
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
          }}
        >
          <button
            onClick={() =>
              exportAllVehiclesPdf()
            }
            disabled={
              pdfLoading ||
              filteredVehicles.length ===
                0
            }
            style={{
              border: "none",
              borderRadius: "6px",
              padding:
                "8px 12px",
              background:
                "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#ffffff",
              fontWeight: 700,
              cursor:
                pdfLoading
                  ? "not-allowed"
                  : "pointer",
              opacity:
                pdfLoading
                  ? 0.6
                  : 1,
              fontSize: "11px",
            }}
          >
            {pdfLoading
              ? "Generating..."
              : "📑 PDF All Vehicles"}
          </button>

          <button
            onClick={
              loadAllData
            }
            disabled={loading}
            style={{
              border: "none",
              borderRadius: "6px",
              padding:
                "8px 15px",
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              color: "#ffffff",
              fontWeight: 700,
              cursor:
                loading
                  ? "not-allowed"
                  : "pointer",
              opacity:
                loading
                  ? 0.6
                  : 1,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "10px",
          marginBottom:
            "14px",
        }}
      >
        <SummaryCard
          title="TOTAL VEHICLES"
          value={totalVehicles}
          color="#22d3ee"
        />

        <SummaryCard
          title="VALID"
          value={validVehicles}
          color="#22c55e"
        />

        <SummaryCard
          title="EXPIRING ≤ 30 DAYS"
          value={expiringVehicles}
          color="#f59e0b"
        />

        <SummaryCard
          title="EXPIRED"
          value={expiredVehicles}
          color="#ef4444"
        />
      </div>

      {/* FORM */}

      <div
        style={{
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
          marginBottom:
            "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "15px",
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
              ? "EDIT VEHICLE"
              : "ADD VEHICLE / DAYNA"}
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
                  "6px 12px",
                cursor:
                  "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* VEHICLE INFORMATION */}

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginBottom:
              "10px",
          }}
        >
          VEHICLE INFORMATION
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              VEHICLE NAME *
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.vehicle_name
              }
              placeholder="e.g. Dyna 01"
              onChange={(e) =>
                updateField(
                  "vehicle_name",
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
              VEHICLE NUMBER
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.vehicle_number
              }
              placeholder="e.g. D-001"
              onChange={(e) =>
                updateField(
                  "vehicle_number",
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
              PLATE NUMBER *
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.plate_number
              }
              placeholder="Plate number"
              onChange={(e) =>
                updateField(
                  "plate_number",
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
              BRANCH *
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.branch_id
              }
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
              style={
                labelStyle
              }
            >
              DRIVER
            </label>

            <select
              style={
                inputStyle
              }
              value={
                form.driver_id
              }
              onChange={(e) =>
                updateField(
                  "driver_id",
                  e.target.value
                )
              }
            >
              <option value="">
                No Driver Assigned
              </option>

              {drivers.map(
                (driver) => (
                  <option
                    key={
                      driver.id
                    }
                    value={
                      driver.id
                    }
                  >
                    {
                      driver.driver_name
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* DOCUMENTS */}

        <div
          style={{
            color: "#22d3ee",
            fontSize: "11px",
            fontWeight: 800,
            marginTop: "18px",
            marginBottom:
              "10px",
          }}
        >
          VEHICLE DOCUMENTS &
          EXPIRY
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "11px",
          }}
        >
          <div>
            <label
              style={
                labelStyle
              }
            >
              ISTIMARA NUMBER
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.istimara_number
              }
              placeholder="Istimara number"
              onChange={(e) =>
                updateField(
                  "istimara_number",
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
              ISTIMARA EXPIRY
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.istimara_expiry
              }
              onChange={(e) =>
                updateField(
                  "istimara_expiry",
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
              FAHAS NUMBER
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.fahas_number
              }
              placeholder="Fahas number"
              onChange={(e) =>
                updateField(
                  "fahas_number",
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
              FAHAS EXPIRY
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.fahas_expiry
              }
              onChange={(e) =>
                updateField(
                  "fahas_expiry",
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
              CARD TASGHEEL NUMBER
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.tasgheel_card_number
              }
              placeholder="Tasgheel card number"
              onChange={(e) =>
                updateField(
                  "tasgheel_card_number",
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
              CARD TASGHEEL EXPIRY
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.tasgheel_card_expiry
              }
              onChange={(e) =>
                updateField(
                  "tasgheel_card_expiry",
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
              INSURANCE NUMBER
            </label>

            <input
              style={
                inputStyle
              }
              value={
                form.insurance_number
              }
              placeholder="Insurance / policy number"
              onChange={(e) =>
                updateField(
                  "insurance_number",
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
              INSURANCE EXPIRY
            </label>

            <input
              type="date"
              style={
                inputStyle
              }
              value={
                form.insurance_expiry
              }
              onChange={(e) =>
                updateField(
                  "insurance_expiry",
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* REGISTRATION */}

        <div
          style={{
            marginTop: "15px",
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            REGISTRATION DETAILS
          </label>

          <textarea
            value={
              form.registration_details
            }
            placeholder="Registration details..."
            onChange={(e) =>
              updateField(
                "registration_details",
                e.target.value
              )
            }
            style={{
              ...inputStyle,
              height: "65px",
              padding:
                "9px 10px",
              resize:
                "vertical",
            }}
          />
        </div>

        {/* NOTES */}

        <div
          style={{
            marginTop: "12px",
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
            placeholder="Additional notes..."
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
              resize:
                "vertical",
            }}
          />
        </div>

        {/* BUTTONS */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "8px",
            marginTop: "15px",
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
                  "6px",
                padding:
                  "9px 18px",
                cursor:
                  "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            onClick={
              saveVehicle
            }
            disabled={
              saving
            }
            style={{
              background:
                "linear-gradient(135deg, #06b6d4, #2563eb)",
              color:
                "#ffffff",
              border:
                "none",
              borderRadius:
                "6px",
              padding:
                "9px 22px",
              fontWeight: 700,
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
            {saving
              ? "Saving..."
              : editingId !==
                null
              ? "Update Vehicle"
              : "Add Vehicle"}
          </button>
        </div>
      </div>

      {/* FILTERS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "2fr 1fr 1fr 1fr",
          gap: "10px",
          padding: "12px",
          marginBottom:
            "14px",
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius: "9px",
        }}
      >
        <div>
          <label
            style={
              labelStyle
            }
          >
            SEARCH
          </label>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Vehicle, plate, driver..."
            style={
              inputStyle
            }
          />
        </div>

        <div>
          <label
            style={
              labelStyle
            }
          >
            BRANCH
          </label>

          <select
            value={
              branchFilter
            }
            onChange={(e) =>
              setBranchFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
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
            style={
              labelStyle
            }
          >
            DRIVER
          </label>

          <select
            value={
              driverFilter
            }
            onChange={(e) =>
              setDriverFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Drivers
            </option>

            {drivers.map(
              (driver) => (
                <option
                  key={
                    driver.id
                  }
                  value={
                    driver.id
                  }
                >
                  {
                    driver.driver_name
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
            STATUS
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
            style={
              inputStyle
            }
          >
            <option value="ALL">
              All Statuses
            </option>

            <option value="VALID">
              Valid
            </option>

            <option value="EXPIRING">
              Expiring ≤ 30 Days
            </option>

            <option value="EXPIRED">
              Expired
            </option>

            <option value="NOT SET">
              Not Set
            </option>
          </select>
        </div>
      </div>

      {/* VEHICLE RECORDS */}

      <div
        style={{
          backgroundColor:
            "#111827",
          border:
            "1px solid #263548",
          borderRadius: "10px",
          padding: "17px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom:
              "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#60a5fa",
              fontSize: "16px",
            }}
          >
            VEHICLE RECORDS
          </h2>

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                color:
                  "#64748b",
                fontSize:
                  "10px",
              }}
            >
              {
                filteredVehicles.length
              }{" "}
              vehicles
            </span>
          </div>
        </div>

        <div
          style={{
            width: "100%",
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
                  VEHICLE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  PLATE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DRIVER
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  BRANCH
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  ISTIMARA
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  FAHAS
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  TASGHEEL
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  INSURANCE
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  STATUS
                </th>

                <th
                  style={
                    thStyle
                  }
                >
                  DOCUMENTS
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
                    colSpan={11}
                    style={
                      emptyStyle
                    }
                  >
                    Loading vehicles...
                  </td>
                </tr>
              ) : filteredVehicles.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={11}
                    style={
                      emptyStyle
                    }
                  >
                    No vehicles found.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(
                  (
                    vehicle,
                    index
                  ) => {
                    const driver =
                      drivers.find(
                        (d) =>
                          d.id ===
                          vehicle.driver_id
                      );

                    const branch =
                      branches.find(
                        (b) =>
                          b.id ===
                          vehicle.branch_id
                      );

                    const vehicleStatus =
                      getStatusForVehicle(
                        vehicle
                      );

                    const statusStyle =
                      vehicleStatus ===
                      "EXPIRED"
                        ? {
                            color:
                              "#fca5a5",
                            background:
                              "#7f1d1d",
                          }
                        : vehicleStatus ===
                          "EXPIRING"
                        ? {
                            color:
                              "#fde68a",
                            background:
                              "#78350f",
                          }
                        : vehicleStatus ===
                          "VALID"
                        ? {
                            color:
                              "#86efac",
                            background:
                              "#14532d",
                          }
                        : {
                            color:
                              "#94a3b8",
                            background:
                              "#1e293b",
                          };

                    return (
                      <tr
                        key={
                          vehicle.id
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
                            vehicle.vehicle_name
                          }

                          {vehicle.vehicle_number && (
                            <div
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  "9px",
                                marginTop:
                                  "2px",
                              }}
                            >
                              {
                                vehicle.vehicle_number
                              }
                            </div>
                          )}
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
                          {vehicle.plate_number ||
                            "-"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {driver?.driver_name ||
                            "Not Assigned"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {branch?.branch_name ||
                            "-"}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <ExpiryBadge
                            expiryDate={
                              vehicle.istimara_expiry
                            }
                            getExpiryLabel={
                              getExpiryLabel
                            }
                          />
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <ExpiryBadge
                            expiryDate={
                              vehicle.fahas_expiry
                            }
                            getExpiryLabel={
                              getExpiryLabel
                            }
                          />
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <ExpiryBadge
                            expiryDate={
                              vehicle.tasgheel_card_expiry
                            }
                            getExpiryLabel={
                              getExpiryLabel
                            }
                          />
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <ExpiryBadge
                            expiryDate={
                              vehicle.insurance_expiry
                            }
                            getExpiryLabel={
                              getExpiryLabel
                            }
                          />
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
                                "4px 7px",
                              borderRadius:
                                "5px",
                              fontSize:
                                "9px",
                              fontWeight:
                                800,
                              color:
                                statusStyle.color,
                              backgroundColor:
                                statusStyle.background,
                            }}
                          >
                            {
                              vehicleStatus
                            }
                          </span>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <button
                            onClick={() =>
                              openDocuments(
                                vehicle
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                "5px",
                              padding:
                                "5px 8px",
                              backgroundColor:
                                "#312e81",
                              color:
                                "#c4b5fd",
                              cursor:
                                "pointer",
                              fontSize:
                                "10px",
                              fontWeight:
                                800,
                            }}
                          >
                            📎 Documents
                          </button>
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
                                "5px",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <button
                              onClick={() =>
                                exportSingleVehiclePdf(
                                  vehicle
                                )
                              }
                              disabled={
                                pdfLoading
                              }
                              style={{
                                backgroundColor:
                                  "#7c3aed",
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
                              title="Export single vehicle PDF"
                            >
                              📄 PDF
                            </button>

                            <button
                              onClick={() =>
                                editVehicle(
                                  vehicle
                                )
                              }
                              disabled={
                                saving
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
                                deleteVehicle(
                                  vehicle
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
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT MODAL */}

      {documentVehicle && (
        <div
          style={
            modalOverlayStyle
          }
          onClick={() =>
            setDocumentVehicle(
              null
            )
          }
        >
          <div
            style={{
              ...modalStyle,
              maxWidth:
                "700px",
            }}
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
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
                  "15px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color:
                      "#c4b5fd",
                    fontSize:
                      "17px",
                  }}
                >
                  VEHICLE DOCUMENTS
                </h2>

                <div
                  style={{
                    color:
                      "#64748b",
                    fontSize:
                      "10px",
                    marginTop:
                      "3px",
                  }}
                >
                  {
                    documentVehicle.vehicle_name
                  }{" "}
                  | Plate:{" "}
                  {
                    documentVehicle.plate_number
                  }
                </div>
              </div>

              <button
                onClick={() =>
                  setDocumentVehicle(
                    null
                  )
                }
                style={
                  closeButtonStyle
                }
              >
                ×
              </button>
            </div>

            {/* UPLOAD */}

            <div
              style={{
                padding:
                  "12px",
                backgroundColor:
                  "#0b1220",
                border:
                  "1px solid #263548",
                borderRadius:
                  "7px",
                marginBottom:
                  "15px",
              }}
            >
              <div
                style={{
                  color:
                    "#22d3ee",
                  fontSize:
                    "11px",
                  fontWeight:
                    800,
                  marginBottom:
                    "8px",
                }}
              >
                ATTACH NEW DOCUMENT
              </div>

              <input
                style={{
                  ...inputStyle,
                  marginBottom:
                    "8px",
                  paddingTop:
                    "9px",
                }}
                type="file"
                onChange={
                  uploadDocument
                }
                disabled={
                  uploadingDocument
                }
              />

              <input
                style={
                  inputStyle
                }
                value={
                  documentDescription
                }
                placeholder="Document description (optional)"
                onChange={(e) =>
                  setDocumentDescription(
                    e.target.value
                  )
                }
              />

              {uploadingDocument && (
                <div
                  style={{
                    color:
                      "#f59e0b",
                    fontSize:
                      "10px",
                    marginTop:
                      "8px",
                  }}
                >
                  Uploading document...
                </div>
              )}
            </div>

            {/* DOCUMENT LIST */}

            <div>
              <div
                style={{
                  color:
                    "#94a3b8",
                  fontSize:
                    "10px",
                  fontWeight:
                    700,
                  marginBottom:
                    "8px",
                }}
              >
                ATTACHED DOCUMENTS
              </div>

              {documentLoading ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  Loading documents...
                </div>
              ) : documents.length ===
                0 ? (
                <div
                  style={{
                    ...emptyStyle,
                    border:
                      "1px solid #263548",
                    borderRadius:
                      "6px",
                  }}
                >
                  No documents attached.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: "7px",
                  }}
                >
                  {documents.map(
                    (
                      document
                    ) => (
                      <div
                        key={
                          document.id
                        }
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          padding:
                            "9px",
                          backgroundColor:
                            "#0f172a",
                          border:
                            "1px solid #263548",
                          borderRadius:
                            "6px",
                        }}
                      >
                        <div
                          style={{
                            minWidth:
                              0,
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#ffffff",
                              fontWeight:
                                700,
                              fontSize:
                                "11px",
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                            }}
                          >
                            📎{" "}
                            {
                              document.file_name
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
                            {
                              document.description ||
                              "No description"
                            }{" "}
                            •{" "}
                            {document.file_size
                              ? `${(
                                  document.file_size /
                                  1024
                                ).toFixed(
                                  1
                                )} KB`
                              : "Unknown size"}
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            gap:
                              "5px",
                            marginLeft:
                              "10px",
                          }}
                        >
                          <button
                            onClick={() =>
                              viewDocument(
                                document
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
                            View
                          </button>

                          <button
                            onClick={() =>
                              deleteDocument(
                                document
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
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   EXPIRY BADGE
================================================================ */

function ExpiryBadge({
  expiryDate,
  getExpiryLabel,
}: {
  expiryDate: string | null;

  getExpiryLabel: (
    expiryDate: string | null
  ) => {
    text: string;
    color: string;
    background: string;
  };
}) {
  const result =
    getExpiryLabel(
      expiryDate
    );

  return (
    <div>
      <div
        style={{
          fontSize: "9px",
          color: "#94a3b8",
          marginBottom:
            "3px",
        }}
      >
        {expiryDate || "-"}
      </div>

      <span
        style={{
          display:
            "inline-block",
          padding:
            "3px 5px",
          borderRadius:
            "4px",
          backgroundColor:
            result.background,
          color:
            result.color,
          fontSize:
            "8px",
          fontWeight:
            800,
        }}
      >
        {
          result.text
        }
      </span>
    </div>
  );
}

/* ================================================================
   SUMMARY CARD
================================================================ */

function SummaryCard({
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
            "18px",
          fontWeight:
            800,
        }}
      >
        {value.toLocaleString(
          "en-US"
        )}
      </div>
    </div>
  );
}

/* ================================================================
   MODAL STYLES
================================================================ */

const modalOverlayStyle: CSSProperties =
  {
    position:
      "fixed",
    inset: 0,
    backgroundColor:
      "rgba(0, 0, 0, 0.75)",
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    zIndex: 9999,
    padding:
      "20px",
  };

const modalStyle: CSSProperties =
  {
    width: "100%",
    maxWidth:
      "1000px",
    maxHeight:
      "90vh",
    overflowY:
      "auto",
    backgroundColor:
      "#111827",
    border:
      "1px solid #334155",
    borderRadius:
      "10px",
    padding:
      "18px",
    boxShadow:
      "0 25px 50px rgba(0,0,0,0.5)",
  };

const closeButtonStyle: CSSProperties =
  {
    width: "30px",
    height: "30px",
    border: "none",
    borderRadius:
      "6px",
    backgroundColor:
      "#374151",
    color:
      "#ffffff",
    fontSize:
      "20px",
    cursor:
      "pointer",
  };

export default Vehicles;