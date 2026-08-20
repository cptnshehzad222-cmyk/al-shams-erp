// Staff.tsx - Complete Professional Staff & Salary Management System
// Monthly report: modal fixed with borders, PDF in landscape with no overlap

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/* =========================================================
   TYPES
========================================================= */

type EmployeeType = "Labour" | "Driver" | "Staff" | "Manager";
type TransactionType = "Opening Balance" | "Salary" | "Payment" | "Advance" | "Adjustment";
type LeaveType = "Annual" | "Sick" | "Emergency" | "Hajj" | "Unpaid" | "Other";

type StaffMember = {
  id: number;
  employee_code: string | null;
  name: string;
  employee_type: EmployeeType;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  branch: string | null;
  joining_date: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transportation_allowance: number | null;
  food_allowance: number | null;
  other_allowance: number | null;
  active: boolean;
  notes: string | null;
  current_balance: number | null;
  balance_status: string | null;
  created_at: string;
};

type Transaction = {
  id: number;
  staff_id: number;
  transaction_date: string;
  transaction_type: TransactionType;
  description: string | null;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
};

type LeaveRecord = {
  id: number;
  staff_id: number;
  leave_start_date: string;
  leave_end_date: string;
  leave_days: number;
  leave_type: LeaveType | null;
  deduction_amount: number | null;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
};

type MonthlyStatement = {
  monthKey: string;
  monthName: string;
  openingBalance: number;
  salaryEarned: number;
  leaveDeduction: number;
  payments: number;
  advances: number;
  closingBalance: number;
  leaveDays: number;
};

type EmployeeReport = {
  employee: StaffMember;
  statements: MonthlyStatement[];
  totalSalary: number;
  totalLeaveDeduction: number;
  totalPayments: number;
  totalAdvances: number;
  finalBalance: number;
  totalLeaves: number;
  paymentTransactions: Transaction[];
  leaveRecords: LeaveRecord[];
};

/* =========================================================
   CONSTANTS
========================================================= */

const BRANCHES = ["AL SHIFA", "AD DILLAM", "MOHAMMADIA", "EXIT 9 NUMBER"];
const EMPLOYEE_TYPES: EmployeeType[] = ["Labour", "Driver", "Staff", "Manager"];
const LEAVE_TYPES: LeaveType[] = ["Annual", "Sick", "Emergency", "Hajj", "Unpaid", "Other"];
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Salary Card"];
const TRANSACTION_TYPES: TransactionType[] = ["Salary", "Payment", "Advance", "Adjustment"];

/* =========================================================
   HELPERS
========================================================= */

const todayISO = () => new Date().toISOString().split("T")[0];

const parseDate = (value: string) => {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    const date = parseDate(value);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const formatDateFull = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    const date = parseDate(value);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

const formatCurrency = (value: number) => {
  if (!value || isNaN(value)) return "SAR 0.00";
  return `SAR ${value.toLocaleString("en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatShortCurrency = (value: number) => {
  if (!value || isNaN(value)) return "SAR 0";
  return `SAR ${value.toLocaleString("en-SA", {
    maximumFractionDigits: 0,
  })}`;
};

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const daysInMonth = (date: Date) => endOfMonth(date).getDate();
const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1);

const getMonthStart = (year: number, month: number) => new Date(year, month - 1, 1);
const getMonthEnd = (year: number, month: number) => new Date(year, month, 0);

/* =========================================================
   SALARY CALCULATION ENGINE
========================================================= */

function calculateTotalSalary(member: StaffMember): number {
  return Number(member.basic_salary || 0) +
         Number(member.housing_allowance || 0) +
         Number(member.transportation_allowance || 0) +
         Number(member.food_allowance || 0) +
         Number(member.other_allowance || 0);
}

function buildEmployeeReport(
  member: StaffMember,
  transactions: Transaction[],
  leaves: LeaveRecord[],
  startDate: Date,
  endDate: Date
): EmployeeReport {
  const totalSalary = calculateTotalSalary(member);
  const statements: MonthlyStatement[] = [];

  const openingTransactions = transactions.filter(t => 
    parseDate(t.transaction_date) < startDate
  );
  let openingBalance = openingTransactions.reduce((sum, t) => sum + t.amount, 0);

  const rangeTransactions = transactions.filter(t => {
    const date = parseDate(t.transaction_date);
    return date >= startDate && date <= endDate;
  });

  const rangeLeaves = leaves.filter(l => {
    const start = parseDate(l.leave_start_date);
    const end = parseDate(l.leave_end_date || l.leave_start_date);
    return start <= endDate && end >= startDate;
  });

  const monthMap = new Map<string, MonthlyStatement>();
  let cursor = startOfMonth(startDate);
  while (cursor <= endOfMonth(endDate)) {
    const key = monthKey(cursor);
    monthMap.set(key, {
      monthKey: key,
      monthName: monthLabel(cursor),
      openingBalance: 0,
      salaryEarned: 0,
      leaveDeduction: 0,
      payments: 0,
      advances: 0,
      closingBalance: 0,
      leaveDays: 0,
    });
    cursor = addMonths(cursor, 1);
  }

  const joinDate = member.joining_date ? parseDate(member.joining_date) : null;

  monthMap.forEach((statement, monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const daysInMonthVal = monthEnd.getDate();

    let daysWorked = daysInMonthVal;

    if (joinDate && joinDate > monthStart && joinDate <= monthEnd) {
      daysWorked = monthEnd.getDate() - joinDate.getDate() + 1;
    }
    if (joinDate && joinDate > monthEnd) {
      daysWorked = 0;
    }

    const dailySalary = totalSalary / daysInMonthVal;
    const computedSalary = dailySalary * daysWorked;
    statement.salaryEarned = computedSalary;
  });

  rangeTransactions.forEach(t => {
    const month = monthKey(parseDate(t.transaction_date));
    const statement = monthMap.get(month);
    if (!statement) return;

    if (t.transaction_type === "Payment") {
      statement.payments += Math.abs(t.amount);
    } else if (t.transaction_type === "Advance") {
      statement.advances += Math.abs(t.amount);
    }
  });

  rangeLeaves.forEach(l => {
    const start = parseDate(l.leave_start_date);
    const end = parseDate(l.leave_end_date || l.leave_start_date);
    let cursorDate = new Date(start);
    while (cursorDate <= end) {
      const month = monthKey(cursorDate);
      const statement = monthMap.get(month);
      if (statement) {
        const daysInMonthVal = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0).getDate();
        const dailySalary = totalSalary / daysInMonthVal;
        statement.leaveDeduction += dailySalary;
        statement.leaveDays += 1;
      }
      cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate() + 1);
    }
  });

  let runningBalance = openingBalance;
  monthMap.forEach((statement) => {
    statement.openingBalance = runningBalance;
    const netChange = statement.salaryEarned - statement.leaveDeduction - statement.payments - statement.advances;
    statement.closingBalance = runningBalance + netChange;
    runningBalance = statement.closingBalance;
  });

  let totalSal = 0, totalLeaveDed = 0, totalPay = 0, totalAdv = 0, totalLeaveDays = 0;
  monthMap.forEach(statement => {
    totalSal += statement.salaryEarned;
    totalLeaveDed += statement.leaveDeduction;
    totalPay += statement.payments;
    totalAdv += statement.advances;
    totalLeaveDays += statement.leaveDays;
  });

  const sortedStatements = Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const paymentTransactions = rangeTransactions.filter(t => 
    t.transaction_type === "Payment" || t.transaction_type === "Advance"
  ).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  return {
    employee: member,
    statements: sortedStatements,
    totalSalary: totalSal,
    totalLeaveDeduction: totalLeaveDed,
    totalPayments: totalPay,
    totalAdvances: totalAdv,
    finalBalance: sortedStatements.length > 0 ? sortedStatements[sortedStatements.length - 1].closingBalance : openingBalance,
    totalLeaves: totalLeaveDays,
    paymentTransactions,
    leaveRecords: rangeLeaves,
  };
}

/* =========================================================
   STATS CARD COMPONENT
========================================================= */

const StatsCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) => (
  <div style={{
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    borderRadius: "12px",
    padding: "18px 20px",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }}>
    <div>
      <div style={{ fontSize: "13px", color: "#aaa", fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>{value}</div>
    </div>
    <div style={{ fontSize: "28px", opacity: 0.8 }}>{icon}</div>
  </div>
);

/* =========================================================
   MAIN STAFF COMPONENT
========================================================= */

function Staff() {
  // =========================================================
  // STATE
  // =========================================================

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [view, setView] = useState<"table" | "cards">("table");

  const [reportStartDate, setReportStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [reportEndDate, setReportEndDate] = useState(todayISO());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Quick Payment Entry
  const [paymentEmployee, setPaymentEmployee] = useState<StaffMember | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    transaction_type: "Payment" as TransactionType,
    transaction_date: todayISO(),
    description: "",
    payment_method: "Cash",
    reference_no: "",
  });

  // Quick Leave Entry
  const [leaveEmployee, setLeaveEmployee] = useState<StaffMember | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leave_start_date: todayISO(),
    leave_end_date: todayISO(),
    leave_type: "Annual" as LeaveType,
    reason: "",
  });

  // Report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportEmployee, setReportEmployee] = useState<StaffMember | null>(null);
  const [reportData, setReportData] = useState<EmployeeReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Monthly report
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [monthlyReportMonth, setMonthlyReportMonth] = useState(getCurrentMonthKey());
  const [monthlyReportData, setMonthlyReportData] = useState<any[]>([]);
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);

  const [formData, setFormData] = useState({
    employee_code: "",
    name: "",
    employee_type: "Labour" as EmployeeType,
    phone: "",
    email: "",
    nationality: "",
    branch: "",
    joining_date: todayISO(),
    basic_salary: "",
    housing_allowance: "",
    transportation_allowance: "",
    food_allowance: "",
    other_allowance: "",
    opening_balance: "",
    notes: "",
    active: true,
  });

  // =========================================================
  // HELPER FUNCTIONS
  // =========================================================

  function getCurrentMonthKey() {
    const now = new Date();
    return monthKey(now);
  }

  function getStatusColor(balance: number | null) {
    if (!balance) return "#888";
    if (balance > 0) return "#00ff9d";
    if (balance < 0) return "#ff4f70";
    return "#888";
  }

  function getTypeColor(type: EmployeeType) {
    switch (type) {
      case "Manager": return "#bf7fff";
      case "Staff": return "#00d9ff";
      case "Driver": return "#ffd700";
      case "Labour": return "#ff6b6b";
      default: return "#888";
    }
  }

  // =========================================================
  // FETCH STAFF
  // =========================================================

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff_current_balances")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setStaff(data || []);
    } catch (error) {
      console.error(error);
      showNotification("Unable to load staff data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // =========================================================
  // NOTIFICATION
  // =========================================================

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // =========================================================
  // FORM HANDLING
  // =========================================================

  const resetForm = () => {
    setFormData({
      employee_code: "",
      name: "",
      employee_type: "Labour",
      phone: "",
      email: "",
      nationality: "",
      branch: "",
      joining_date: todayISO(),
      basic_salary: "",
      housing_allowance: "",
      transportation_allowance: "",
      food_allowance: "",
      other_allowance: "",
      opening_balance: "",
      notes: "",
      active: true,
    });
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = async (member: StaffMember) => {
    setEditingId(member.id);

    const { data: openingData } = await supabase
      .from("staff_transactions")
      .select("amount")
      .eq("staff_id", member.id)
      .eq("transaction_type", "Opening Balance")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    setFormData({
      employee_code: member.employee_code || "",
      name: member.name,
      employee_type: member.employee_type,
      phone: member.phone || "",
      email: member.email || "",
      nationality: member.nationality || "",
      branch: member.branch || "",
      joining_date: member.joining_date || todayISO(),
      basic_salary: String(member.basic_salary || ""),
      housing_allowance: String(member.housing_allowance || ""),
      transportation_allowance: String(member.transportation_allowance || ""),
      food_allowance: String(member.food_allowance || ""),
      other_allowance: String(member.other_allowance || ""),
      opening_balance: openingData?.amount ? String(openingData.amount) : "",
      notes: member.notes || "",
      active: member.active,
    });

    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showNotification("Employee name is required", "error");
      return;
    }

    if (!formData.joining_date) {
      showNotification("Joining date is required", "error");
      return;
    }

    const basicSalary = Number(formData.basic_salary || 0);
    if (isNaN(basicSalary) || basicSalary < 0) {
      showNotification("Enter a valid basic salary", "error");
      return;
    }

    setFormLoading(true);

    try {
      const staffData = {
        employee_code: formData.employee_code.trim() || null,
        name: formData.name.trim(),
        employee_type: formData.employee_type,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        nationality: formData.nationality.trim() || null,
        branch: formData.branch || null,
        joining_date: formData.joining_date,
        basic_salary: Number(formData.basic_salary || 0),
        housing_allowance: Number(formData.housing_allowance || 0),
        transportation_allowance: Number(formData.transportation_allowance || 0),
        food_allowance: Number(formData.food_allowance || 0),
        other_allowance: Number(formData.other_allowance || 0),
        active: formData.active,
        notes: formData.notes.trim() || null,
      };

      if (editingId === null) {
        const { data: newStaff, error } = await supabase
          .from("staff")
          .insert(staffData)
          .select()
          .single();

        if (error) throw error;

        const openingBalance = Number(formData.opening_balance || 0);
        if (newStaff && !isNaN(openingBalance) && openingBalance !== 0) {
          const { error: balanceError } = await supabase
            .from("staff_transactions")
            .insert({
              staff_id: newStaff.id,
              transaction_date: formData.joining_date,
              transaction_type: "Opening Balance",
              description: "Opening Balance",
              amount: openingBalance,
            });

          if (balanceError) {
            await supabase.from("staff").delete().eq("id", newStaff.id);
            throw new Error("Opening balance could not be saved");
          }
        }

        showNotification("Staff member added successfully", "success");
      } else {
        const { error: updateError } = await supabase
          .from("staff")
          .update(staffData)
          .eq("id", editingId);

        if (updateError) throw updateError;

        const openingBalance = Number(formData.opening_balance || 0);
        const { data: existingOpening } = await supabase
          .from("staff_transactions")
          .select("id")
          .eq("staff_id", editingId)
          .eq("transaction_type", "Opening Balance")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (existingOpening) {
          if (openingBalance === 0) {
            await supabase.from("staff_transactions").delete().eq("id", existingOpening.id);
          } else {
            await supabase
              .from("staff_transactions")
              .update({ amount: openingBalance, transaction_date: formData.joining_date })
              .eq("id", existingOpening.id);
          }
        } else if (openingBalance !== 0) {
          await supabase.from("staff_transactions").insert({
            staff_id: editingId,
            transaction_date: formData.joining_date,
            transaction_type: "Opening Balance",
            description: "Opening Balance",
            amount: openingBalance,
          });
        }

        showNotification("Staff member updated successfully", "success");
      }

      resetForm();
      setShowForm(false);
      await fetchStaff();
    } catch (error: any) {
      console.error(error);
      showNotification(error.message || "Something went wrong", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const deleteStaff = async (member: StaffMember) => {
    if (!window.confirm(`Delete ${member.name}?\n\nThis will delete all linked data.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("staff").delete().eq("id", member.id);
      if (error) throw error;
      await fetchStaff();
      showNotification("Staff member deleted", "success");
    } catch (error: any) {
      showNotification(error.message || "Unable to delete", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // QUICK PAYMENT ENTRY
  // =========================================================

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEmployee) {
      showNotification("Please select an employee", "error");
      return;
    }

    const amount = Number(paymentForm.amount);
    if (isNaN(amount) || amount === 0) {
      showNotification("Enter a valid amount", "error");
      return;
    }

    let finalAmount = amount;
    if (paymentForm.transaction_type === "Payment" || 
        paymentForm.transaction_type === "Advance") {
      finalAmount = -Math.abs(amount);
    } else {
      finalAmount = Math.abs(amount);
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("staff_transactions")
        .insert({
          staff_id: paymentEmployee.id,
          transaction_date: paymentForm.transaction_date,
          transaction_type: paymentForm.transaction_type,
          description: paymentForm.description || `${paymentForm.transaction_type} - ${paymentEmployee.name}`,
          amount: finalAmount,
          payment_method: paymentForm.payment_method,
          reference_no: paymentForm.reference_no || null,
        });

      if (error) throw error;

      showNotification(`${paymentForm.transaction_type} of ${formatCurrency(amount)} added for ${paymentEmployee.name}`, "success");
      
      setPaymentForm({
        amount: "",
        transaction_type: "Payment",
        transaction_date: todayISO(),
        description: "",
        payment_method: "Cash",
        reference_no: "",
      });
      
      await fetchStaff();
    } catch (error: any) {
      showNotification(error.message || "Unable to add transaction", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // QUICK LEAVE ENTRY
  // =========================================================

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmployee) {
      showNotification("Please select an employee", "error");
      return;
    }

    const start = parseDate(leaveForm.leave_start_date);
    const end = parseDate(leaveForm.leave_end_date);
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days <= 0) {
      showNotification("End date must be after start date", "error");
      return;
    }

    const totalSalary = calculateTotalSalary(leaveEmployee);
    const dailySalary = totalSalary / daysInMonth(start);
    const deductionAmount = dailySalary * days;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("staff_leaves")
        .insert({
          staff_id: leaveEmployee.id,
          leave_start_date: leaveForm.leave_start_date,
          leave_end_date: leaveForm.leave_end_date,
          leave_days: days,
          leave_type: leaveForm.leave_type,
          deduction_amount: deductionAmount,
          reason: leaveForm.reason,
        });

      if (error) throw error;

      const { error: txError } = await supabase
        .from("staff_transactions")
        .insert({
          staff_id: leaveEmployee.id,
          transaction_date: leaveForm.leave_start_date,
          transaction_type: "Adjustment",
          description: `Leave deduction - ${leaveForm.leave_type} (${days} days)`,
          amount: -deductionAmount,
        });

      if (txError) throw txError;

      showNotification(`${days} day(s) leave recorded for ${leaveEmployee.name} (Deduction: ${formatCurrency(deductionAmount)})`, "success");
      
      setLeaveForm({
        leave_start_date: todayISO(),
        leave_end_date: todayISO(),
        leave_type: "Annual",
        reason: "",
      });
      
      await fetchStaff();
    } catch (error: any) {
      showNotification(error.message || "Unable to record leave", "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // INDIVIDUAL REPORT
  // =========================================================

  const openEmployeeReport = async (member: StaffMember) => {
    setReportEmployee(member);
    setReportLoading(true);
    setShowReportModal(true);

    try {
      const start = parseDate(reportStartDate);
      const end = parseDate(reportEndDate);

      const { data: transactions } = await supabase
        .from("staff_transactions")
        .select("*")
        .eq("staff_id", member.id)
        .order("transaction_date", { ascending: true });

      const { data: leaves } = await supabase
        .from("staff_leaves")
        .select("*")
        .eq("staff_id", member.id)
        .order("leave_start_date", { ascending: true });

      const report = buildEmployeeReport(
        member,
        transactions || [],
        leaves || [],
        start,
        end
      );

      setReportData(report);
    } catch (error: any) {
      showNotification(error.message || "Unable to generate report", "error");
    } finally {
      setReportLoading(false);
    }
  };

  // =========================================================
  // MONTHLY REPORT
  // =========================================================

  const generateMonthlyReport = async () => {
    setMonthlyReportLoading(true);
    setShowMonthlyReport(true);

    try {
      const [year, month] = monthlyReportMonth.split("-").map(Number);
      const start = getMonthStart(year, month);
      const end = getMonthEnd(year, month);

      const monthStartStr = start.toISOString().split("T")[0];
      const monthEndStr = end.toISOString().split("T")[0];

      const reportData: any[] = [];

      for (const member of staff) {
        const { data: transactions } = await supabase
          .from("staff_transactions")
          .select("*")
          .eq("staff_id", member.id)
          .gte("transaction_date", monthStartStr)
          .lte("transaction_date", monthEndStr);

        const { data: leaves } = await supabase
          .from("staff_leaves")
          .select("*")
          .eq("staff_id", member.id)
          .gte("leave_start_date", monthStartStr)
          .lte("leave_end_date", monthEndStr);

        const totalSalary = calculateTotalSalary(member);
        const monthlyTransactions = transactions || [];
        const monthlyLeaves = leaves || [];

        let salaryEarned = 0;
        let leaveDeduction = 0;
        let payments = 0;
        let advances = 0;
        let leaveDays = 0;

        // Compute salary earned for this month automatically
        const joinDate = member.joining_date ? parseDate(member.joining_date) : null;
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const daysInMonthVal = monthEnd.getDate();
        let daysWorked = daysInMonthVal;

        if (joinDate && joinDate > monthStart && joinDate <= monthEnd) {
          daysWorked = monthEnd.getDate() - joinDate.getDate() + 1;
        } else if (joinDate && joinDate > monthEnd) {
          daysWorked = 0;
        }

        const dailySalary = totalSalary / daysInMonthVal;
        salaryEarned = dailySalary * daysWorked;

        monthlyTransactions.forEach(t => {
          if (t.transaction_type === "Payment") payments += Math.abs(t.amount);
          else if (t.transaction_type === "Advance") advances += Math.abs(t.amount);
        });

        monthlyLeaves.forEach(l => {
          const startDate = parseDate(l.leave_start_date);
          const endDate = parseDate(l.leave_end_date || l.leave_start_date);
          const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          leaveDays += days;
          const dailySalaryLeave = totalSalary / daysInMonthVal;
          leaveDeduction += dailySalaryLeave * days;
        });

        reportData.push({
          employee_code: member.employee_code || "-",
          name: member.name,
          type: member.employee_type,
          branch: member.branch || "-",
          total_salary: totalSalary,
          salary_earned: salaryEarned,
          leave_days: leaveDays,
          leave_deduction: leaveDeduction,
          payments: payments,
          advances: advances,
          net_amount: salaryEarned - leaveDeduction - payments - advances,
          current_balance: member.current_balance || 0,
        });
      }

      setMonthlyReportData(reportData);
    } catch (error: any) {
      showNotification(error.message || "Unable to generate monthly report", "error");
    } finally {
      setMonthlyReportLoading(false);
    }
  };

  // =========================================================
  // PDF EXPORT FUNCTIONS
  // =========================================================

  const exportIndividualReportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF("p", "mm", "a4");
    const emp = reportData.employee;
    const balance = reportData.finalBalance; // Use computed final balance
    const pageWidth = 210;
    const margin = 18;
    let y = 18;

    // HEADER
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 60, 120);
    doc.text("AL SHAMS ERP", margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    doc.text("EMPLOYEE SALARY STATEMENT", margin, y);
    y += 5;

    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // SECTION 1: EMPLOYEE DETAILS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 60, 120);
    doc.text("1. EMPLOYEE DETAILS", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(margin, y - 2, pageWidth - (margin * 2), 34, 3, 3, "FD");
    
    const col1 = margin + 8;
    const col2 = margin + 78;
    const col3 = margin + 140;
    let rowY = y + 6;

    doc.setTextColor(80, 80, 80);
    doc.text(`Name:`, col1, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.name}`, col1 + 30, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Code:`, col2, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.employee_code || "-"}`, col2 + 24, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Type:`, col3, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.employee_type}`, col3 + 22, rowY);
    rowY += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Branch:`, col1, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.branch || "-"}`, col1 + 30, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Joining Date:`, col2, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatDateFull(emp.joining_date)}`, col2 + 42, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Status:`, col3, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.active ? "Active" : "Inactive"}`, col3 + 24, rowY);
    rowY += 8;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Phone:`, col1, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.phone || "-"}`, col1 + 30, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Email:`, col2, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.email || "-"}`, col2 + 24, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Nationality:`, col3, rowY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${emp.nationality || "-"}`, col3 + 38, rowY);

    y = rowY + 14;

    // SECTION 2: PAYMENTS RECEIVED
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 60, 120);
    doc.text("2. PAYMENTS RECEIVED", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${formatDateFull(reportStartDate)} to ${formatDateFull(reportEndDate)}`, margin + 5, y);
    y += 6;

    if (reportData.paymentTransactions.length > 0) {
      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { 
          fontSize: 8, 
          textColor: [50, 50, 50],
          cellPadding: 3.5,
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
        },
        headStyles: { 
          fillColor: [20, 60, 120], 
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "left",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        head: [["Date", "Type", "Description", "Amount (SAR)", "Method", "Reference"]],
        body: reportData.paymentTransactions.map(t => [
          formatDateFull(t.transaction_date),
          t.transaction_type,
          t.description || "-",
          Math.abs(t.amount).toFixed(2),
          t.payment_method || "-",
          t.reference_no || "-",
        ]),
        foot: [[
          "",
          "",
          { content: "TOTAL PAYMENTS:", styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          { content: (reportData.totalPayments + reportData.totalAdvances).toFixed(2), styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          "",
          "",
        ]],
        footStyles: {
          fillColor: [240, 242, 245],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8,
        },
      });
      y = (doc as any).lastAutoTable?.finalY + 10 || y + 40;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("No payments received in this period.", margin + 5, y);
      y += 10;
    }

    // SECTION 3: MONTHLY SALARY BREAKDOWN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 60, 120);
    doc.text("3. MONTHLY SALARY BREAKDOWN", margin, y);
    y += 6;

    if (reportData.statements.length > 0) {
      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { 
          fontSize: 7.5, 
          textColor: [50, 50, 50],
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
        },
        headStyles: { 
          fillColor: [20, 60, 120], 
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "right",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
        head: [["Month", "Opening", "Salary", "Leave Ded.", "Payments", "Advances", "Closing"]],
        body: reportData.statements.map(s => [
          s.monthName,
          s.openingBalance.toFixed(2),
          s.salaryEarned.toFixed(2),
          s.leaveDeduction.toFixed(2),
          s.payments.toFixed(2),
          s.advances.toFixed(2),
          s.closingBalance.toFixed(2),
        ]),
        foot: [[
          { content: "TOTAL", styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          "",
          { content: reportData.totalSalary.toFixed(2), styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          { content: reportData.totalLeaveDeduction.toFixed(2), styles: { fontStyle: "bold", textColor: [200, 50, 50] } },
          { content: reportData.totalPayments.toFixed(2), styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          { content: reportData.totalAdvances.toFixed(2), styles: { fontStyle: "bold", textColor: [180, 120, 20] } },
          { content: reportData.finalBalance.toFixed(2), styles: { fontStyle: "bold", textColor: [0, 120, 60] } },
        ]],
        footStyles: {
          fillColor: [240, 242, 245],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7.5,
        },
      });
      y = (doc as any).lastAutoTable?.finalY + 10 || y + 40;
    }

    // SECTION 4: LEAVE RECORDS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 60, 120);
    doc.text("4. LEAVE RECORDS", margin, y);
    y += 6;

    if (reportData.leaveRecords.length > 0) {
      autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { 
          fontSize: 7.5, 
          textColor: [50, 50, 50],
          cellPadding: 3,
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
        },
        headStyles: { 
          fillColor: [20, 60, 120], 
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "left" },
          2: { halign: "center" },
          3: { halign: "left" },
          4: { halign: "right" },
          5: { halign: "left" },
        },
        head: [["Start Date", "End Date", "Days", "Type", "Deduction (SAR)", "Reason"]],
        body: reportData.leaveRecords.map(l => [
          formatDateFull(l.leave_start_date),
          formatDateFull(l.leave_end_date),
          String(l.leave_days),
          l.leave_type || "-",
          (Number(l.deduction_amount || 0)).toFixed(2),
          l.reason || "-",
        ]),
        foot: [[
          "",
          "",
          { content: `Total: ${reportData.totalLeaves} days`, styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
          "",
          { content: reportData.totalLeaveDeduction.toFixed(2), styles: { fontStyle: "bold", textColor: [200, 50, 50] } },
          "",
        ]],
        footStyles: {
          fillColor: [240, 242, 245],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7.5,
        },
      });
      y = (doc as any).lastAutoTable?.finalY + 10 || y + 40;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("No leave records found in this period.", margin + 5, y);
      y += 10;
    }

    // SECTION 5: FINAL BALANCE
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 60, 120);
    doc.text("5. FINAL BALANCE", margin, y);
    y += 8;

    const balanceColor = balance > 0 ? [0, 150, 80] : balance < 0 ? [200, 50, 50] : [100, 100, 100];
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y - 2, pageWidth - (margin * 2), 26, 3, 3, "FD");

    const balanceText = balance > 0 ? "COMPANY OWES EMPLOYEE" : 
                        balance < 0 ? "EMPLOYEE OWES COMPANY" : "BALANCE SETTLED";
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Status: ${balanceText}`, margin + 10, y + 9);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
    doc.text(`${balance > 0 ? "+" : ""}${balance.toFixed(2)} SAR`, pageWidth - margin - 10, y + 9, { align: "right" });

    y = y + 32;

    // SECTION 6: SIGNATURES
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    y += 6;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    
    const sigWidth = (pageWidth - (margin * 2) - 30) / 3;
    const sigY = y;
    
    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.5);
    doc.line(margin, sigY, margin + sigWidth, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Accountant", margin + (sigWidth / 2), sigY + 5, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Signature & Date", margin + (sigWidth / 2), sigY + 10, { align: "center" });
    
    const sigX2 = margin + sigWidth + 15;
    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.5);
    doc.line(sigX2, sigY, sigX2 + sigWidth, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Manager", sigX2 + (sigWidth / 2), sigY + 5, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Signature & Date", sigX2 + (sigWidth / 2), sigY + 10, { align: "center" });
    
    const sigX3 = sigX2 + sigWidth + 15;
    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(0.5);
    doc.line(sigX3, sigY, sigX3 + sigWidth, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Receiver", sigX3 + (sigWidth / 2), sigY + 5, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Signature & Date", sigX3 + (sigWidth / 2), sigY + 10, { align: "center" });

    y = sigY + 22;

    // FOOTER
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${formatDateFull(todayISO())}`, margin, y);
    doc.text(`Period: ${formatDateFull(reportStartDate)} to ${formatDateFull(reportEndDate)}`, margin + 75, y);
    doc.setTextColor(20, 60, 120);
    doc.setFont("helvetica", "bold");
    doc.text("AL SHAMS ERP", pageWidth - margin, y, { align: "right" });

    doc.save(`${emp.name}-Salary-Statement.pdf`);
  };

  // =========================================================
  // UPDATED: Monthly Report PDF - landscape, wider columns, text wrap
  // =========================================================
  const exportMonthlyReportPDF = () => {
    if (!monthlyReportData.length) return;

    // Use landscape for more width
    const doc = new jsPDF("l", "mm", "a4");
    const monthName = monthLabel(parseDate(`${monthlyReportMonth}-01`));
    const pageWidth = 297; // landscape width
    const margin = 18;
    let y = 18;

    // HEADER
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 60, 120);
    doc.text("AL SHAMS ERP", margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    doc.text(`MONTHLY SALARY REPORT - ${monthName}`, margin, y);
    y += 5;

    doc.setDrawColor(20, 60, 120);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // SUMMARY STATS
    const totalSal = monthlyReportData.reduce((s, r) => s + (r.salary_earned || 0), 0);
    const totalDed = monthlyReportData.reduce((s, r) => s + (r.leave_deduction || 0), 0);
    const totalPay = monthlyReportData.reduce((s, r) => s + (r.payments || 0), 0);
    const totalAdv = monthlyReportData.reduce((s, r) => s + (r.advances || 0), 0);
    const totalNet = monthlyReportData.reduce((s, r) => s + (r.net_amount || 0), 0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${formatDateFull(todayISO())}`, margin, y);
    doc.text(`Employees: ${monthlyReportData.length}`, pageWidth - margin - 40, y);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y - 2, pageWidth - (margin * 2), 24, 3, 3, "FD");

    const summaryY = y + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);

    const colW = (pageWidth - (margin * 2) - 20) / 5;
    let cx = margin + 8;

    doc.text("Total Salary:", cx, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 60, 120);
    doc.text(`${totalSal.toFixed(2)} SAR`, cx + 32, summaryY);

    cx += colW;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Deduction:", cx, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 50, 50);
    doc.text(`${totalDed.toFixed(2)} SAR`, cx + 30, summaryY);

    cx += colW;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Payments:", cx, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 60, 120);
    doc.text(`${totalPay.toFixed(2)} SAR`, cx + 30, summaryY);

    cx += colW;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Advances:", cx, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 120, 20);
    doc.text(`${totalAdv.toFixed(2)} SAR`, cx + 30, summaryY);

    cx += colW;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("Net Total:", cx, summaryY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 120, 60);
    doc.text(`${totalNet.toFixed(2)} SAR`, cx + 26, summaryY);

    y = summaryY + 20;

    // MAIN TABLE with wider columns and text wrapping
    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: {
        fontSize: 7,
        textColor: [50, 50, 50],
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        overflow: "linebreak", // allow text to wrap
      },
      headStyles: {
        fillColor: [20, 60, 120],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: {
        0: { cellWidth: 25 },  // Code
        1: { cellWidth: 45 },  // Employee (wider)
        2: { cellWidth: 25 },  // Type
        3: { cellWidth: 35 },  // Branch (wider)
        4: { cellWidth: 30 },  // Salary Earned
        5: { cellWidth: 20 },  // Leave Days
        6: { cellWidth: 30 },  // Leave Ded.
        7: { cellWidth: 30 },  // Payments
        8: { cellWidth: 30 },  // Advances
        9: { cellWidth: 30 },  // Net
        10: { cellWidth: 30 }, // Balance
      },
      head: [["Code", "Employee", "Type", "Branch", "Salary Earned", "Leave Days", "Leave Ded.", "Payments", "Advances", "Net", "Balance"]],
      body: monthlyReportData.map(r => [
        r.employee_code,
        r.name,
        r.type,
        r.branch,
        (r.salary_earned || 0).toFixed(2),
        String(r.leave_days || 0),
        (r.leave_deduction || 0).toFixed(2),
        (r.payments || 0).toFixed(2),
        (r.advances || 0).toFixed(2),
        (r.net_amount || 0).toFixed(2),
        (r.current_balance || 0).toFixed(2),
      ]),
      foot: [[
        { content: "TOTAL", styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
        "",
        "",
        "",
        { content: totalSal.toFixed(2), styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
        "",
        { content: totalDed.toFixed(2), styles: { fontStyle: "bold", textColor: [200, 50, 50] } },
        { content: totalPay.toFixed(2), styles: { fontStyle: "bold", textColor: [20, 60, 120] } },
        { content: totalAdv.toFixed(2), styles: { fontStyle: "bold", textColor: [180, 120, 20] } },
        { content: totalNet.toFixed(2), styles: { fontStyle: "bold", textColor: [0, 120, 60] } },
        "",
      ]],
      footStyles: {
        fillColor: [240, 242, 245],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 7,
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || y + 40;

    // SIGNATURES (position adjusted for landscape)
    const sigY2 = finalY + 12;
    if (sigY2 < 200) { // more space in landscape
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);

      const sigWidth2 = (pageWidth - (margin * 2) - 30) / 3;

      doc.setDrawColor(20, 60, 120);
      doc.setLineWidth(0.5);
      doc.line(margin, sigY2, margin + sigWidth2, sigY2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text("Accountant", margin + (sigWidth2 / 2), sigY2 + 5, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text("Signature & Date", margin + (sigWidth2 / 2), sigY2 + 10, { align: "center" });

      const sigX2_2 = margin + sigWidth2 + 15;
      doc.setDrawColor(20, 60, 120);
      doc.setLineWidth(0.5);
      doc.line(sigX2_2, sigY2, sigX2_2 + sigWidth2, sigY2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text("Manager", sigX2_2 + (sigWidth2 / 2), sigY2 + 5, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text("Signature & Date", sigX2_2 + (sigWidth2 / 2), sigY2 + 10, { align: "center" });

      const sigX3_2 = sigX2_2 + sigWidth2 + 15;
      doc.setDrawColor(20, 60, 120);
      doc.setLineWidth(0.5);
      doc.line(sigX3_2, sigY2, sigX3_2 + sigWidth2, sigY2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text("Receiver", sigX3_2 + (sigWidth2 / 2), sigY2 + 5, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text("Signature & Date", sigX3_2 + (sigWidth2 / 2), sigY2 + 10, { align: "center" });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("AL SHAMS ERP - Official Monthly Salary Report", margin, 200);

    doc.save(`Monthly-Salary-Report-${monthlyReportMonth}.pdf`);
  };

  const exportMonthlyReportExcel = () => {
    if (!monthlyReportData.length) return;

    const workbook = XLSX.utils.book_new();
    const data = monthlyReportData.map(r => ({
      "Employee Code": r.employee_code,
      "Employee": r.name,
      "Type": r.type,
      "Branch": r.branch,
      "Salary Earned": r.salary_earned || 0,
      "Leave Days": r.leave_days || 0,
      "Leave Deduction": r.leave_deduction || 0,
      "Payments": r.payments || 0,
      "Advances": r.advances || 0,
      "Net Amount": r.net_amount || 0,
      "Current Balance": r.current_balance || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Report");
    XLSX.writeFile(workbook, `Monthly-Salary-Report-${monthlyReportMonth}.xlsx`);
  };

  // =========================================================
  // FILTERING & SORTING
  // =========================================================

  const filteredStaff = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let filtered = staff.filter((member) => {
      const matchesSearch =
        !search ||
        member.name.toLowerCase().includes(search) ||
        (member.employee_code || "").toLowerCase().includes(search) ||
        (member.phone || "").includes(search) ||
        (member.email || "").toLowerCase().includes(search);

      const matchesType = selectedType === "All" || member.employee_type === selectedType;
      const matchesBranch = selectedBranch === "All" || member.branch === selectedBranch;
      const matchesStatus = selectedStatus === "All" ||
        (selectedStatus === "Active" && member.active) ||
        (selectedStatus === "Inactive" && !member.active);

      return matchesSearch && matchesType && matchesBranch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof StaffMember] || "";
      let bVal: any = b[sortBy as keyof StaffMember] || "";

      if (sortBy === "basic_salary" || sortBy === "current_balance") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [staff, searchTerm, selectedType, selectedBranch, selectedStatus, sortBy, sortOrder]);

  // =========================================================
  // DASHBOARD STATS
  // =========================================================

  const dashboardStats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.active).length;
    const companyOwes = staff.reduce((sum, s) => sum + Math.max(0, Number(s.current_balance || 0)), 0);
    const employeeOwes = staff.reduce((sum, s) => sum + Math.max(0, -Number(s.current_balance || 0)), 0);
    const totalMonthlyCost = staff.reduce((sum, s) => sum + calculateTotalSalary(s), 0);

    const deptMap = new Map<string, number>();
    staff.forEach((s) => {
      deptMap.set(s.employee_type, (deptMap.get(s.employee_type) || 0) + 1);
    });
    const departments = Array.from(deptMap.entries()).map(([name, count]) => ({ name, count }));

    return {
      total,
      active,
      companyOwes,
      employeeOwes,
      totalMonthlyCost,
      departments,
    };
  }, [staff]);

  // =========================================================
  // TOGGLE SORT
  // =========================================================

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // =========================================================
  // RENDER UI
  // =========================================================

  return (
    <div style={styles.page}>
      {/* Notification */}
      {notification && (
        <div style={{
          ...styles.notification,
          background: notification.type === "success" ? "#00ff9d20" :
            notification.type === "error" ? "#ff4f7020" : "#00d9ff20",
          borderColor: notification.type === "success" ? "#00ff9d" :
            notification.type === "error" ? "#ff4f70" : "#00d9ff",
        }}>
          <span style={{ color: notification.type === "success" ? "#00ff9d" :
            notification.type === "error" ? "#ff4f70" : "#00d9ff" }}>
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} style={styles.notificationClose}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>AL SHAMS ERP</div>
          <h1 style={styles.title}>STAFF & SALARY MANAGEMENT</h1>
          <p style={styles.subtitle}>Employees • Quick Payments • Leave Entry • Reports</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => { setShowMonthlyReport(true); generateMonthlyReport(); }} style={styles.buttonPrimary}>
            📊 Monthly Report
          </button>
          <button onClick={openAddForm} style={styles.buttonAdd}>
            + ADD STAFF
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div style={styles.statsGrid}>
        <StatsCard title="Total" value={dashboardStats.total} icon="👥" color="#00d9ff" />
        <StatsCard title="Active" value={dashboardStats.active} icon="✅" color="#00ff9d" />
        <StatsCard title="Monthly Cost" value={formatShortCurrency(dashboardStats.totalMonthlyCost)} icon="💰" color="#bf7fff" />
        <StatsCard title="Company Owes" value={formatShortCurrency(dashboardStats.companyOwes)} icon="📈" color="#00ff9d" />
        <StatsCard title="Staff Owes" value={formatShortCurrency(dashboardStats.employeeOwes)} icon="📉" color="#ff4f70" />
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        {/* Quick Payment */}
        <div style={styles.quickActionCard}>
          <div style={styles.quickActionHeader}>
            <span style={styles.quickActionIcon}>💰</span>
            <span style={styles.quickActionTitle}>Quick Payment</span>
            <span style={styles.quickActionBadge}>Instant</span>
          </div>
          <form onSubmit={handlePaymentSubmit} style={styles.quickActionForm}>
            <div style={styles.quickFormRow}>
              <div style={styles.quickFormGroup}>
                <select
                  value={paymentEmployee?.id || ""}
                  onChange={(e) => {
                    const emp = staff.find(s => s.id === Number(e.target.value));
                    setPaymentEmployee(emp || null);
                  }}
                  style={styles.inputSmall}
                  required
                >
                  <option value="">Select Employee</option>
                  {staff.filter(s => s.active).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.quickFormGroup}>
                <select
                  value={paymentForm.transaction_type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_type: e.target.value as TransactionType })}
                  style={styles.inputSmall}
                >
                  {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={styles.quickFormGroup}>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="Amount"
                  style={styles.inputSmall}
                  required
                />
              </div>
              <div style={styles.quickFormGroup}>
                <input
                  type="date"
                  value={paymentForm.transaction_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transaction_date: e.target.value })}
                  style={styles.inputSmall}
                />
              </div>
              <div style={styles.quickFormGroup}>
                <button type="submit" disabled={loading} style={styles.buttonPaymentSmall}>
                  {loading ? "..." : "Add"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Quick Leave */}
        <div style={styles.quickActionCard}>
          <div style={styles.quickActionHeader}>
            <span style={styles.quickActionIcon}>🏖️</span>
            <span style={styles.quickActionTitle}>Quick Leave</span>
            <span style={styles.quickActionBadge}>Auto Deduct</span>
          </div>
          <form onSubmit={handleLeaveSubmit} style={styles.quickActionForm}>
            <div style={styles.quickFormRow}>
              <div style={styles.quickFormGroup}>
                <select
                  value={leaveEmployee?.id || ""}
                  onChange={(e) => {
                    const emp = staff.find(s => s.id === Number(e.target.value));
                    setLeaveEmployee(emp || null);
                  }}
                  style={styles.inputSmall}
                  required
                >
                  <option value="">Select Employee</option>
                  {staff.filter(s => s.active).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.quickFormGroup}>
                <input
                  type="date"
                  value={leaveForm.leave_start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_start_date: e.target.value })}
                  style={styles.inputSmall}
                />
              </div>
              <div style={styles.quickFormGroup}>
                <input
                  type="date"
                  value={leaveForm.leave_end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_end_date: e.target.value })}
                  style={styles.inputSmall}
                />
              </div>
              <div style={styles.quickFormGroup}>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as LeaveType })}
                  style={styles.inputSmall}
                >
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={styles.quickFormGroup}>
                <button type="submit" disabled={loading} style={styles.buttonLeaveSmall}>
                  {loading ? "..." : "Add Leave"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <input
            type="text"
            placeholder="Search by name, code, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="All">All Types</option>
            {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="All">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setView("table")}
            style={{ ...styles.viewButton, background: view === "table" ? "#00d9ff" : "transparent" }}
          >
            📋 Table
          </button>
          <button
            onClick={() => setView("cards")}
            style={{ ...styles.viewButton, background: view === "cards" ? "#00d9ff" : "transparent" }}
          >
            🃏 Cards
          </button>
        </div>
      </div>

      {/* Staff List */}
      {loading ? (
        <div style={styles.loading}>Loading staff...</div>
      ) : filteredStaff.length === 0 ? (
        <div style={styles.emptyState}>No staff members found.</div>
      ) : view === "table" ? (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th onClick={() => toggleSort("employee_code")} style={styles.th}>Code {sortBy === "employee_code" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th onClick={() => toggleSort("name")} style={styles.th}>Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th onClick={() => toggleSort("employee_type")} style={styles.th}>Type {sortBy === "employee_type" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th onClick={() => toggleSort("branch")} style={styles.th}>Branch {sortBy === "branch" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th onClick={() => toggleSort("basic_salary")} style={styles.th}>Basic Salary {sortBy === "basic_salary" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th onClick={() => toggleSort("current_balance")} style={styles.th}>Balance {sortBy === "current_balance" && (sortOrder === "asc" ? "↑" : "↓")}</th>
                <th>Status</th>
                <th style={styles.thActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(member => (
                <tr key={member.id} style={styles.tr}>
                  <td style={styles.td}>{member.employee_code || "-"}</td>
                  <td style={styles.td}><strong>{member.name}</strong></td>
                  <td style={styles.td}>
                    <span style={{ ...styles.typeBadge, background: getTypeColor(member.employee_type) }}>
                      {member.employee_type}
                    </span>
                  </td>
                  <td style={styles.td}>{member.branch || "-"}</td>
                  <td style={styles.td}>{formatCurrency(Number(member.basic_salary || 0))}</td>
                  <td style={styles.td}>
                    <span style={{ color: getStatusColor(member.current_balance) }}>
                      {formatCurrency(Number(member.current_balance || 0))}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, background: member.active ? "#00ff9d30" : "#ff4f7030", color: member.active ? "#00ff9d" : "#ff4f70" }}>
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actionButtons}>
                      <button onClick={() => openEditForm(member)} style={styles.actionEdit}>✏️</button>
                      <button onClick={() => openEmployeeReport(member)} style={styles.actionReport}>📄</button>
                      <button onClick={() => deleteStaff(member)} style={styles.actionDelete}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {filteredStaff.map(member => (
            <div key={member.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardName}>{member.name}</div>
                <span style={{ ...styles.typeBadge, background: getTypeColor(member.employee_type) }}>
                  {member.employee_type}
                </span>
              </div>
              <div style={styles.cardBody}>
                <div><span style={styles.cardLabel}>Code:</span> {member.employee_code || "-"}</div>
                <div><span style={styles.cardLabel}>Branch:</span> {member.branch || "-"}</div>
                <div><span style={styles.cardLabel}>Salary:</span> {formatCurrency(Number(member.basic_salary || 0))}</div>
                <div><span style={styles.cardLabel}>Balance:</span> <span style={{ color: getStatusColor(member.current_balance) }}>{formatCurrency(Number(member.current_balance || 0))}</span></div>
                <div><span style={styles.cardLabel}>Status:</span> <span style={{ color: member.active ? "#00ff9d" : "#ff4f70" }}>{member.active ? "Active" : "Inactive"}</span></div>
              </div>
              <div style={styles.cardActions}>
                <button onClick={() => openEditForm(member)} style={styles.actionEdit}>✏️ Edit</button>
                <button onClick={() => openEmployeeReport(member)} style={styles.actionReport}>📄 Report</button>
                <button onClick={() => deleteStaff(member)} style={styles.actionDelete}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================
          ADD/EDIT STAFF MODAL
      ========================================================= */}
      {showForm && (
        <div style={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>{editingId ? "Edit Staff" : "Add New Staff"}</h2>
              <button onClick={() => setShowForm(false)} style={styles.modalClose}>×</button>
            </div>
            <form onSubmit={handleFormSubmit} style={styles.form}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label>Employee Code</label>
                  <input type="text" value={formData.employee_code} onChange={(e) => setFormData({...formData, employee_code: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Full Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label>Employee Type</label>
                  <select value={formData.employee_type} onChange={(e) => setFormData({...formData, employee_type: e.target.value as EmployeeType})} style={styles.input}>
                    {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label>Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Nationality</label>
                  <input type="text" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Branch</label>
                  <select value={formData.branch} onChange={(e) => setFormData({...formData, branch: e.target.value})} style={styles.input}>
                    <option value="">Select Branch</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label>Joining Date</label>
                  <input type="date" value={formData.joining_date} onChange={(e) => setFormData({...formData, joining_date: e.target.value})} style={styles.input} required />
                </div>
                <div style={styles.formGroup}>
                  <label>Basic Salary</label>
                  <input type="number" step="0.01" value={formData.basic_salary} onChange={(e) => setFormData({...formData, basic_salary: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Housing Allowance</label>
                  <input type="number" step="0.01" value={formData.housing_allowance} onChange={(e) => setFormData({...formData, housing_allowance: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Transportation Allowance</label>
                  <input type="number" step="0.01" value={formData.transportation_allowance} onChange={(e) => setFormData({...formData, transportation_allowance: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Food Allowance</label>
                  <input type="number" step="0.01" value={formData.food_allowance} onChange={(e) => setFormData({...formData, food_allowance: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Other Allowance</label>
                  <input type="number" step="0.01" value={formData.other_allowance} onChange={(e) => setFormData({...formData, other_allowance: e.target.value})} style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label>Opening Balance</label>
                  <input type="number" step="0.01" value={formData.opening_balance} onChange={(e) => setFormData({...formData, opening_balance: e.target.value})} style={styles.input} placeholder="Initial balance (if any)" />
                </div>
                <div style={styles.formGroup}>
                  <label>Notes</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={styles.textarea} rows={3} />
                </div>
                <div style={styles.formGroup}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({...formData, active: e.target.checked})} />
                    Active
                  </label>
                </div>
              </div>
              <div style={styles.formActions}>
                <button type="button" onClick={() => setShowForm(false)} style={styles.buttonCancel}>Cancel</button>
                <button type="submit" disabled={formLoading} style={styles.buttonSubmit}>
                  {formLoading ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          INDIVIDUAL REPORT MODAL
      ========================================================= */}
      {showReportModal && (
        <div style={styles.modalOverlay} onClick={() => setShowReportModal(false)}>
          <div style={{ ...styles.modal, maxWidth: "900px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Salary Report: {reportEmployee?.name}</h2>
              <button onClick={() => setShowReportModal(false)} style={styles.modalClose}>×</button>
            </div>
            {reportLoading ? (
              <div style={styles.loading}>Generating report...</div>
            ) : reportData ? (
              <div>
                <div style={styles.reportFilters}>
                  <div style={styles.filterGroup}>
                    <label>From:</label>
                    <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} style={styles.inputSmall} />
                  </div>
                  <div style={styles.filterGroup}>
                    <label>To:</label>
                    <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} style={styles.inputSmall} />
                  </div>
                  <button onClick={exportIndividualReportPDF} style={styles.buttonPrimary}>📄 Export PDF</button>
                </div>

                <div style={styles.reportSummary}>
                  <div><strong>Total Salary:</strong> {formatCurrency(reportData.totalSalary)}</div>
                  <div><strong>Leave Deduction:</strong> {formatCurrency(reportData.totalLeaveDeduction)}</div>
                  <div><strong>Payments:</strong> {formatCurrency(reportData.totalPayments)}</div>
                  <div><strong>Advances:</strong> {formatCurrency(reportData.totalAdvances)}</div>
                  <div><strong>Final Balance:</strong> <span style={{ color: getStatusColor(reportData.finalBalance) }}>{formatCurrency(reportData.finalBalance)}</span></div>
                  <div><strong>Total Leaves:</strong> {reportData.totalLeaves} days</div>
                </div>

                <div style={styles.reportTableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Opening</th>
                        <th>Salary</th>
                        <th>Leave Ded.</th>
                        <th>Payments</th>
                        <th>Advances</th>
                        <th>Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.statements.map(s => (
                        <tr key={s.monthKey}>
                          <td>{s.monthName}</td>
                          <td>{formatCurrency(s.openingBalance)}</td>
                          <td>{formatCurrency(s.salaryEarned)}</td>
                          <td style={{ color: "#ff4f70" }}>{formatCurrency(s.leaveDeduction)}</td>
                          <td>{formatCurrency(s.payments)}</td>
                          <td style={{ color: "#ffd700" }}>{formatCurrency(s.advances)}</td>
                          <td style={{ color: getStatusColor(s.closingBalance) }}>{formatCurrency(s.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={styles.emptyState}>No data available.</div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MONTHLY REPORT MODAL - FIXED TABLE WITH BORDERS
      ========================================================= */}
      {showMonthlyReport && (
        <div style={styles.modalOverlay} onClick={() => setShowMonthlyReport(false)}>
          <div style={{ ...styles.modal, maxWidth: "1100px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Monthly Salary Report</h2>
              <button onClick={() => setShowMonthlyReport(false)} style={styles.modalClose}>×</button>
            </div>
            <div style={styles.reportFilters}>
              <div style={styles.filterGroup}>
                <label>Month:</label>
                <input type="month" value={monthlyReportMonth} onChange={(e) => setMonthlyReportMonth(e.target.value)} style={styles.inputSmall} />
              </div>
              <button onClick={generateMonthlyReport} style={styles.buttonPrimary}>🔄 Refresh</button>
              <button onClick={exportMonthlyReportPDF} style={styles.buttonPrimary}>📄 Export PDF</button>
              <button onClick={exportMonthlyReportExcel} style={styles.buttonPrimary}>📊 Export Excel</button>
            </div>
            {monthlyReportLoading ? (
              <div style={styles.loading}>Generating monthly report...</div>
            ) : monthlyReportData.length === 0 ? (
              <div style={styles.emptyState}>No data for this month.</div>
            ) : (
              <div style={{ ...styles.reportTableWrapper, border: "1px solid #2d333b", borderRadius: "8px" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  minWidth: "1200px",
                  fontSize: "13px",
                }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: "70px", minWidth: "70px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "left", backgroundColor: "#1c2333" }}>Code</th>
                      <th style={{ ...styles.th, width: "130px", minWidth: "130px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "left", backgroundColor: "#1c2333" }}>Employee</th>
                      <th style={{ ...styles.th, width: "80px", minWidth: "80px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "left", backgroundColor: "#1c2333" }}>Type</th>
                      <th style={{ ...styles.th, width: "100px", minWidth: "100px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "left", backgroundColor: "#1c2333" }}>Branch</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Salary Earned</th>
                      <th style={{ ...styles.th, width: "80px", minWidth: "80px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "center", backgroundColor: "#1c2333" }}>Leave Days</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Leave Ded.</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Payments</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Advances</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Net</th>
                      <th style={{ ...styles.th, width: "120px", minWidth: "120px", border: "1px solid #2d333b", padding: "8px 6px", textAlign: "right", backgroundColor: "#1c2333" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReportData.map((r, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)" }}>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", wordBreak: "break-word", overflowWrap: "break-word" }}>{r.employee_code}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", wordBreak: "break-word", overflowWrap: "break-word" }}><strong>{r.name}</strong></td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px" }}>{r.type}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", wordBreak: "break-word", overflowWrap: "break-word" }}>{r.branch}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right" }}>{formatCurrency(r.salary_earned)}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "center" }}>{r.leave_days}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right", color: "#ff4f70" }}>{formatCurrency(r.leave_deduction)}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right" }}>{formatCurrency(r.payments)}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right", color: "#ffd700" }}>{formatCurrency(r.advances)}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right", color: getStatusColor(r.net_amount) }}>{formatCurrency(r.net_amount)}</td>
                        <td style={{ ...styles.td, border: "1px solid #2d333b", padding: "6px 6px", textAlign: "right", color: getStatusColor(r.current_balance) }}>{formatCurrency(r.current_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    padding: "24px",
    background: "#0d1117",
    color: "#e6edf3",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  notification: {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "14px 24px",
    borderRadius: "8px",
    border: "1px solid",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backdropFilter: "blur(12px)",
    background: "rgba(13,17,23,0.9)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },
  notificationClose: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: "20px",
    cursor: "pointer",
    padding: "0 4px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    flexWrap: "wrap",
    gap: "16px",
  },
  brand: {
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "1.5px",
    color: "#00d9ff",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    margin: "4px 0 0",
    background: "linear-gradient(135deg, #fff 0%, #8b949e 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: "14px",
    color: "#8b949e",
    margin: "4px 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  buttonPrimary: {
    background: "#00d9ff",
    color: "#0d1117",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
    boxShadow: "0 0 20px #00d9ff40",
  },
  buttonAdd: {
    background: "#bf7fff",
    color: "#0d1117",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
    boxShadow: "0 0 20px #bf7fff40",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  quickActions: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "24px",
  },
  quickActionCard: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: "12px",
    padding: "16px 20px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  quickActionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  quickActionIcon: {
    fontSize: "20px",
  },
  quickActionTitle: {
    fontWeight: "600",
    fontSize: "15px",
  },
  quickActionBadge: {
    fontSize: "11px",
    padding: "2px 10px",
    borderRadius: "20px",
    background: "rgba(0,217,255,0.15)",
    color: "#00d9ff",
    fontWeight: "500",
  },
  quickActionForm: {
    width: "100%",
  },
  quickFormRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  quickFormGroup: {
    flex: "1 1 120px",
    minWidth: "100px",
  },
  inputSmall: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e6edf3",
    fontSize: "13px",
    outline: "none",
    transition: "border 0.2s",
  },
  buttonPaymentSmall: {
    background: "#00ff9d",
    color: "#0d1117",
    border: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    width: "100%",
  },
  buttonLeaveSmall: {
    background: "#ffd700",
    color: "#0d1117",
    border: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    width: "100%",
  },
  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  filterGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  searchInput: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#e6edf3",
    fontSize: "14px",
    minWidth: "220px",
    outline: "none",
  },
  filterSelect: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#e6edf3",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
  },
  viewToggle: {
    display: "flex",
    gap: "6px",
  },
  viewButton: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "13px",
    transition: "all 0.2s",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontWeight: "600",
    color: "#8b949e",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  thActions: {
    textAlign: "center",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontWeight: "600",
    color: "#8b949e",
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },
  td: {
    padding: "10px 16px",
    verticalAlign: "middle",
  },
  typeBadge: {
    padding: "3px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    display: "inline-block",
    color: "#0d1117",
  },
  statusBadge: {
    padding: "3px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    display: "inline-block",
  },
  actionButtons: {
    display: "flex",
    gap: "6px",
    justifyContent: "center",
  },
  actionEdit: {
    background: "rgba(0,217,255,0.15)",
    border: "none",
    padding: "4px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#00d9ff",
  },
  actionReport: {
    background: "rgba(191,127,255,0.15)",
    border: "none",
    padding: "4px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#bf7fff",
  },
  actionDelete: {
    background: "rgba(255,79,112,0.15)",
    border: "none",
    padding: "4px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#ff4f70",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  cardName: {
    fontSize: "16px",
    fontWeight: "600",
  },
  cardBody: {
    fontSize: "13px",
    lineHeight: "1.8",
    color: "#b1bac4",
  },
  cardLabel: {
    color: "#8b949e",
    marginRight: "4px",
  },
  cardActions: {
    marginTop: "12px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  loading: {
    textAlign: "center",
    padding: "40px",
    color: "#8b949e",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#8b949e",
    fontSize: "16px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "#1c2333",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: "24px",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  modalClose: {
    background: "none",
    border: "none",
    color: "#8b949e",
    fontSize: "24px",
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "14px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  input: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#e6edf3",
    fontSize: "14px",
    outline: "none",
  },
  textarea: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#e6edf3",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "8px",
  },
  buttonCancel: {
    background: "rgba(255,255,255,0.06)",
    color: "#e6edf3",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "8px 20px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  buttonSubmit: {
    background: "#00d9ff",
    color: "#0d1117",
    border: "none",
    padding: "8px 24px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  reportFilters: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },
  reportSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    background: "rgba(255,255,255,0.03)",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "16px",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  reportTableWrapper: {
    overflowX: "auto",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.05)",
    maxHeight: "400px",
    overflowY: "auto",
  },
};

export default Staff;