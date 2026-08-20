import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

type DashboardData = {
  totalSalesQty: number;
  totalSalesAmount: number;
  totalPurchaseQty: number;
  totalPurchaseAmount: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalItems: number;
  totalVehicles: number;
  totalEmployees: number;
  totalPartners: number;
  totalExpenses: number;
  totalExpensesAmount: number;
  totalDrivers: number;
  totalBranches: number;
  pendingInvoices: number;
  lowStockItems: number;
  todaySales: number;
  todaySalesAmount: number;
  monthSales: number;
  monthSalesAmount: number;
  monthPurchases: number;
  monthPurchasesAmount: number;
  monthExpenses: number;
  monthExpensesAmount: number;
  monthProfit: number;
  totalProfit: number;
};

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DashboardData>({
    totalSalesQty: 0,
    totalSalesAmount: 0,
    totalPurchaseQty: 0,
    totalPurchaseAmount: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    totalItems: 0,
    totalVehicles: 0,
    totalEmployees: 0,
    totalPartners: 0,
    totalExpenses: 0,
    totalExpensesAmount: 0,
    totalDrivers: 0,
    totalBranches: 0,
    pendingInvoices: 0,
    lowStockItems: 0,
    todaySales: 0,
    todaySalesAmount: 0,
    monthSales: 0,
    monthSalesAmount: 0,
    monthPurchases: 0,
    monthPurchasesAmount: 0,
    monthExpenses: 0,
    monthExpensesAmount: 0,
    monthProfit: 0,
    totalProfit: 0,
  });

  // ============================================================
  // STARFIELD ANIMATION
  // ============================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationId: number;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", resize);
    resize();

    // Star properties
    const stars: {
      x: number;
      y: number;
      radius: number;
      speed: number;
      brightness: number;
      twinkleSpeed: number;
    }[] = [];

    // Create stars
    const starCount = 300;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        brightness: Math.random() * 0.6 + 0.4,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
      });
    }

    // Create shooting stars
    const shootingStars: {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      active: boolean;
      life: number;
      maxLife: number;
    }[] = [];

    for (let i = 0; i < 5; i++) {
      shootingStars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.5,
        length: Math.random() * 80 + 40,
        speed: Math.random() * 4 + 2,
        angle: Math.random() * 0.5 + 0.2,
        active: false,
        life: 0,
        maxLife: Math.random() * 100 + 50,
      });
    }

    let time = 0;

    function drawStars() {
      ctx.clearRect(0, 0, width, height);

      // Pure black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw nebula glow (very subtle on black)
      const nebula1 = ctx.createRadialGradient(
        width * 0.2,
        height * 0.3,
        0,
        width * 0.2,
        height * 0.3,
        width * 0.5
      );
      nebula1.addColorStop(0, "rgba(34, 211, 238, 0.03)");
      nebula1.addColorStop(0.5, "rgba(168, 85, 247, 0.02)");
      nebula1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(
        width * 0.8,
        height * 0.7,
        0,
        width * 0.8,
        height * 0.7,
        width * 0.4
      );
      nebula2.addColorStop(0, "rgba(74, 222, 128, 0.02)");
      nebula2.addColorStop(0.5, "rgba(34, 211, 238, 0.015)");
      nebula2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Draw stars
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed) * 0.3 + 0.7;
        const alpha = star.brightness * twinkle;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        // Glow for brighter stars
        if (star.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2);
          const glow = ctx.createRadialGradient(
            star.x,
            star.y,
            0,
            star.x,
            star.y,
            star.radius * 3
          );
          glow.addColorStop(0, `rgba(200, 230, 255, ${alpha * 0.12})`);
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Move stars slowly
        star.x -= star.speed * 0.1;
        if (star.x < 0) {
          star.x = width;
          star.y = Math.random() * height;
        }
      });

      // Draw shooting stars
      shootingStars.forEach((shootingStar) => {
        if (!shootingStar.active) {
          if (Math.random() < 0.003) {
            shootingStar.active = true;
            shootingStar.x = Math.random() * width * 0.8 + width * 0.1;
            shootingStar.y = Math.random() * height * 0.3;
            shootingStar.life = 0;
            shootingStar.angle = Math.random() * 0.4 + 0.1;
            shootingStar.length = Math.random() * 80 + 40;
            shootingStar.speed = Math.random() * 6 + 3;
          }
          return;
        }

        shootingStar.life++;

        const progress = shootingStar.life / shootingStar.maxLife;
        if (progress > 1) {
          shootingStar.active = false;
          return;
        }

        const alpha = 1 - progress;
        const x = shootingStar.x + shootingStar.life * shootingStar.speed * Math.cos(shootingStar.angle);
        const y = shootingStar.y + shootingStar.life * shootingStar.speed * Math.sin(shootingStar.angle);

        const gradient = ctx.createLinearGradient(
          x,
          y,
          x - shootingStar.length * Math.cos(shootingStar.angle),
          y - shootingStar.length * Math.sin(shootingStar.angle)
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(200, 230, 255, ${alpha * 0.6})`);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x - shootingStar.length * Math.cos(shootingStar.angle),
          y - shootingStar.length * Math.sin(shootingStar.angle)
        );
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shooting star glow
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.fill();
      });

      time++;
      animationId = requestAnimationFrame(drawStars);
    }

    drawStars();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().split("T")[0];

      const [
        salesResult,
        purchasesResult,
        customersResult,
        suppliersResult,
        itemsResult,
        vehiclesResult,
        employeesResult,
        partnersResult,
        expensesResult,
        driversResult,
        branchesResult,
        invoicesResult,
      ] = await Promise.all([
        supabase.from("sales").select("*"),
        supabase.from("purchases").select("*"),
        supabase.from("customers").select("id", { count: "exact" }),
        supabase.from("suppliers").select("id", { count: "exact" }),
        supabase.from("items").select("id, current_stock, min_stock_level", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact" }),
        supabase.from("employees").select("id", { count: "exact" }),
        supabase.from("partners").select("id", { count: "exact" }),
        supabase.from("expenses").select("*"),
        supabase.from("drivers").select("id", { count: "exact" }),
        supabase.from("branches").select("id", { count: "exact" }),
        supabase.from("sales").select("id").eq("invoice_status", "PENDING"),
      ]);

      const salesData = salesResult.data || [];
      const purchasesData = purchasesResult.data || [];
      const expensesData = expensesResult.data || [];

      const totalSalesQty = salesData.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const totalSalesAmount = salesData.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const totalPurchaseQty = purchasesData.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const totalPurchaseAmount = purchasesData.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const totalExpensesAmount = expensesData.reduce((sum, e) => sum + (e.total_amount || 0), 0);

      const todaySales = salesData.filter(s => s.sales_date === today);
      const todaySalesQty = todaySales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const todaySalesAmount = todaySales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

      const monthSales = salesData.filter(s => s.sales_date >= monthStartStr);
      const monthPurchases = purchasesData.filter(p => p.purchase_date >= monthStartStr);
      const monthExpenses = expensesData.filter(e => e.expense_date >= monthStartStr);

      const monthSalesQty = monthSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const monthSalesAmount = monthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const monthPurchasesQty = monthPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const monthPurchasesAmount = monthPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const monthExpensesAmount = monthExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0);

      const lowStockItems = (itemsResult.data || []).filter(
        item => (item.current_stock || 0) <= (item.min_stock_level || 0)
      ).length;

      setData({
        totalSalesQty,
        totalSalesAmount,
        totalPurchaseQty,
        totalPurchaseAmount,
        totalCustomers: customersResult.count || 0,
        totalSuppliers: suppliersResult.count || 0,
        totalItems: itemsResult.count || 0,
        totalVehicles: vehiclesResult.count || 0,
        totalEmployees: employeesResult.count || 0,
        totalPartners: partnersResult.count || 0,
        totalExpenses: expensesData.length,
        totalExpensesAmount,
        totalDrivers: driversResult.count || 0,
        totalBranches: branchesResult.count || 0,
        pendingInvoices: invoicesResult.data?.length || 0,
        lowStockItems,
        todaySales: todaySalesQty,
        todaySalesAmount,
        monthSales: monthSalesQty,
        monthSalesAmount,
        monthPurchases: monthPurchasesQty,
        monthPurchasesAmount,
        monthExpenses: monthExpenses.length,
        monthExpensesAmount,
        monthProfit: monthSalesAmount - monthPurchasesAmount - monthExpensesAmount,
        totalProfit: totalSalesAmount - totalPurchaseAmount - totalExpensesAmount,
      });

    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  const navigateTo = (path: string) => {
    navigate(path);
  };

  // ============================================================
  // NEON STYLES - COMPLETELY FIXED
  // ============================================================

  const styles = {
    page: {
      width: "100%",
      minHeight: "100vh",
      padding: "18px",
      boxSizing: "border-box",
      position: "relative",
      color: "#ffffff",
      overflow: "hidden",
      background: "#000000",
    } as React.CSSProperties,

    canvas: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 0,
    } as React.CSSProperties,

    content: {
      position: "relative",
      zIndex: 1,
    } as React.CSSProperties,

    header: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "25px",
      padding: "10px 0",
      textAlign: "center",
    } as React.CSSProperties,

    title: {
      margin: 0,
      color: "#22d3ee",
      fontSize: "42px",
      fontWeight: 900,
      textShadow: "0 0 30px rgba(34,211,238,0.5), 0 0 60px rgba(34,211,238,0.2), 0 0 120px rgba(34,211,238,0.1)",
      letterSpacing: "3px",
      textTransform: "uppercase",
    } as React.CSSProperties,

    titleGlow: {
      color: "#67e8f9",
      fontSize: "14px",
      margin: "6px 0 0 0",
      textShadow: "0 0 20px rgba(34,211,238,0.2)",
      opacity: 0.7,
      letterSpacing: "2px",
    } as React.CSSProperties,

    refreshBtn: {
      position: "absolute",
      top: "20px",
      right: "20px",
      background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(37,99,235,0.15))",
      color: "#67e8f9",
      border: "1px solid rgba(34,211,238,0.25)",
      borderRadius: "8px",
      padding: "8px 18px",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "11px",
      opacity: loading ? 0.6 : 1,
      boxShadow: "0 0 20px rgba(34,211,238,0.08), 0 0 40px rgba(34,211,238,0.03)",
      transition: "all 0.3s ease",
      backdropFilter: "blur(10px)",
      zIndex: 2,
    } as React.CSSProperties,

    row1: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
      marginBottom: "16px",
    } as React.CSSProperties,

    row2: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
      marginBottom: "16px",
    } as React.CSSProperties,

    row3: {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: "12px",
      marginBottom: "16px",
    } as React.CSSProperties,

    row4: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "14px",
      marginBottom: "16px",
    } as React.CSSProperties,

    row5: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "14px",
      marginBottom: "16px",
    } as React.CSSProperties,

    card: (color: string, glowColor: string) => ({
      background: `linear-gradient(145deg, rgba(15,26,46,0.7), rgba(10,20,37,0.7))`,
      border: `1px solid ${color}30`,
      borderRadius: "12px",
      padding: "16px 18px",
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative",
      overflow: "hidden",
      boxShadow: `0 0 20px ${glowColor}10, inset 0 0 30px ${glowColor}03`,
      backdropFilter: "blur(10px)",
    }) as React.CSSProperties,

    cardGlow: (color: string) => ({
      position: "absolute",
      top: "-50%",
      left: "-50%",
      width: "200%",
      height: "200%",
      background: `radial-gradient(circle at 30% 30%, ${color}08, transparent 60%)`,
      pointerEvents: "none",
      animation: "pulseGlow 4s ease-in-out infinite",
    }) as React.CSSProperties,

    cardIcon: {
      fontSize: "26px",
      marginBottom: "6px",
      position: "relative",
      zIndex: 1,
      filter: "drop-shadow(0 0 10px rgba(34,211,238,0.2))",
    } as React.CSSProperties,

    cardTitle: {
      color: "#94a3b8",
      fontSize: "10px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1px",
      margin: "0 0 4px 0",
      position: "relative",
      zIndex: 1,
    } as React.CSSProperties,

    cardValue: (color: string) => ({
      fontSize: "22px",
      fontWeight: 800,
      margin: 0,
      color: color,
      textShadow: `0 0 30px ${color}30, 0 0 60px ${color}15`,
      position: "relative",
      zIndex: 1,
    }) as React.CSSProperties,

    cardSub: {
      color: "#64748b",
      fontSize: "10px",
      marginTop: "4px",
      position: "relative",
      zIndex: 1,
      opacity: 0.7,
    } as React.CSSProperties,

    quickCard: (color: string, glowColor: string) => ({
      background: `linear-gradient(145deg, rgba(10,20,37,0.6), rgba(5,11,20,0.6))`,
      border: `1px solid ${color}20`,
      borderRadius: "10px",
      padding: "12px 14px",
      textAlign: "center",
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: `0 0 15px ${glowColor}05`,
      backdropFilter: "blur(10px)",
    }) as React.CSSProperties,

    quickLabel: {
      color: "#94a3b8",
      fontSize: "9px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.8px",
      display: "block",
      opacity: 0.7,
    } as React.CSSProperties,

    quickValue: (color: string) => ({
      fontSize: "18px",
      fontWeight: 800,
      display: "block",
      margin: "4px 0",
      color: color,
      textShadow: `0 0 20px ${color}20`,
    }) as React.CSSProperties,

    quickSub: {
      color: "#64748b",
      fontSize: "9px",
      display: "block",
      opacity: 0.6,
    } as React.CSSProperties,

    alertCard: (color: string, glowColor: string) => ({
      background: `linear-gradient(145deg, rgba(15,26,46,0.7), rgba(10,20,37,0.7))`,
      border: `1px solid ${color}30`,
      borderRadius: "10px",
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: `0 0 20px ${glowColor}10`,
      backdropFilter: "blur(10px)",
    }) as React.CSSProperties,

    alertIcon: {
      fontSize: "24px",
      animation: "pulse 2s ease-in-out infinite",
      filter: "drop-shadow(0 0 10px rgba(34,211,238,0.2))",
    } as React.CSSProperties,

    alertTitle: {
      color: "#ffffff",
      fontSize: "13px",
      fontWeight: 700,
      textShadow: "0 0 10px rgba(255,255,255,0.1)",
    } as React.CSSProperties,

    alertMessage: {
      color: "#94a3b8",
      fontSize: "11px",
      marginTop: "2px",
      opacity: 0.8,
    } as React.CSSProperties,

    loadingText: {
      textAlign: "center",
      color: "#64748b",
      padding: "60px",
      fontSize: "16px",
      textShadow: "0 0 20px rgba(34,211,238,0.1)",
    } as React.CSSProperties,

    sectionTitle: {
      margin: "0 0 12px 0",
      color: "#60a5fa",
      fontSize: "15px",
      fontWeight: 700,
      textShadow: "0 0 30px rgba(96,165,250,0.15), 0 0 60px rgba(96,165,250,0.05)",
      letterSpacing: "1px",
    } as React.CSSProperties,
  };

  // Inject keyframes
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulseGlow {
        0%, 100% { opacity: 0.3; transform: scale(1) rotate(0deg); }
        50% { opacity: 0.7; transform: scale(1.2) rotate(180deg); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.1); }
      }
      @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Helper component for Neon Card
  const NeonCard = ({ children, color, glowColor, onClick }: any) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        style={{
          ...styles.card(color, glowColor),
          transform: isHovered ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
          boxShadow: isHovered
            ? `0 0 40px ${glowColor}25, 0 0 80px ${glowColor}10, inset 0 0 30px ${glowColor}05`
            : `0 0 20px ${glowColor}10, inset 0 0 30px ${glowColor}03`,
          borderColor: isHovered ? color : `${color}30`,
        }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={styles.cardGlow(color)} />
        {children}
      </div>
    );
  };

  const NeonQuickCard = ({ children, color, glowColor, onClick }: any) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div
        style={{
          ...styles.quickCard(color, glowColor),
          transform: isHovered ? "translateY(-3px) scale(1.03)" : "translateY(0) scale(1)",
          boxShadow: isHovered
            ? `0 0 30px ${glowColor}20, 0 0 60px ${glowColor}08`
            : `0 0 15px ${glowColor}05`,
          borderColor: isHovered ? color : `${color}20`,
        }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
    );
  };

  return (
    <div style={styles.page}>
      {/* Galaxy Starfield Canvas */}
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Content */}
      <div style={styles.content}>
        {/* HEADER - CENTERED */}
        <div style={styles.header}>
          <h1 style={styles.title}>✦ AL SHAMS ERP</h1>
          <p style={styles.titleGlow}>Complete business overview • {new Date().toLocaleDateString("en-GB")}</p>
        </div>

        {/* Refresh Button - Positioned at top right */}
        <button
          onClick={loadDashboardData}
          disabled={loading}
          style={styles.refreshBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 40px rgba(34,211,238,0.3), 0 0 80px rgba(34,211,238,0.1)";
            e.currentTarget.style.borderColor = "rgba(34,211,238,0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px rgba(34,211,238,0.08), 0 0 40px rgba(34,211,238,0.03)";
            e.currentTarget.style.borderColor = "rgba(34,211,238,0.25)";
          }}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>

        {loading ? (
          <div style={styles.loadingText}>Loading dashboard data...</div>
        ) : (
          <>
            {/* ROW 1: MAIN FINANCIAL CARDS */}
            <div style={styles.row1}>
              <NeonCard color="#22d3ee" glowColor="rgba(34,211,238," onClick={() => navigateTo("/sales")}>
                <div style={styles.cardIcon}>💰</div>
                <h3 style={styles.cardTitle}>Total Sales Qty</h3>
                <p style={styles.cardValue("#22d3ee")}>{data.totalSalesQty.toLocaleString()}</p>
                <p style={styles.cardSub}>Today: {data.todaySales} | Month: {data.monthSales}</p>
              </NeonCard>

              <NeonCard color="#4ade80" glowColor="rgba(74,222,128," onClick={() => navigateTo("/sales")}>
                <div style={styles.cardIcon}>📈</div>
                <h3 style={styles.cardTitle}>Total Sales Amount</h3>
                <p style={styles.cardValue("#4ade80")}>SAR {data.totalSalesAmount.toFixed(2)}</p>
                <p style={styles.cardSub}>Today: SAR {data.todaySalesAmount.toFixed(2)}</p>
              </NeonCard>

              <NeonCard color="#f59e0b" glowColor="rgba(245,158,11," onClick={() => navigateTo("/purchases")}>
                <div style={styles.cardIcon}>📦</div>
                <h3 style={styles.cardTitle}>Total Purchase Qty</h3>
                <p style={styles.cardValue("#f59e0b")}>{data.totalPurchaseQty.toLocaleString()}</p>
                <p style={styles.cardSub}>Month: {data.monthPurchases}</p>
              </NeonCard>

              <NeonCard color="#f87171" glowColor="rgba(248,113,113," onClick={() => navigateTo("/purchases")}>
                <div style={styles.cardIcon}>💳</div>
                <h3 style={styles.cardTitle}>Total Purchase Amount</h3>
                <p style={styles.cardValue("#f87171")}>SAR {data.totalPurchaseAmount.toFixed(2)}</p>
                <p style={styles.cardSub}>Month: SAR {data.monthPurchasesAmount.toFixed(2)}</p>
              </NeonCard>
            </div>

            {/* ROW 2: BUSINESS OVERVIEW */}
            <div style={styles.row2}>
              <NeonCard color="#22c55e" glowColor="rgba(34,197,94," onClick={() => navigateTo("/reports")}>
                <div style={styles.cardIcon}>🏆</div>
                <h3 style={styles.cardTitle}>Total Profit</h3>
                <p style={styles.cardValue(data.totalProfit >= 0 ? "#22c55e" : "#ef4444")}>
                  {data.totalProfit >= 0 ? "+" : ""}{data.totalProfit.toFixed(2)} SAR
                </p>
                <p style={styles.cardSub}>Month: {data.monthProfit >= 0 ? "+" : ""}{data.monthProfit.toFixed(2)} SAR</p>
              </NeonCard>

              <NeonCard color="#f472b6" glowColor="rgba(244,114,182," onClick={() => navigateTo("/expenses")}>
                <div style={styles.cardIcon}>💸</div>
                <h3 style={styles.cardTitle}>Total Expenses</h3>
                <p style={styles.cardValue("#f472b6")}>{data.totalExpenses}</p>
                <p style={styles.cardSub}>Amount: SAR {data.totalExpensesAmount.toFixed(2)}</p>
              </NeonCard>

              <NeonCard color="#c084fc" glowColor="rgba(192,132,252," onClick={() => navigateTo("/customers")}>
                <div style={styles.cardIcon}>👥</div>
                <h3 style={styles.cardTitle}>Customers</h3>
                <p style={styles.cardValue("#c084fc")}>{data.totalCustomers}</p>
                <p style={styles.cardSub}>Active customers</p>
              </NeonCard>

              <NeonCard color="#fb923c" glowColor="rgba(251,146,60," onClick={() => navigateTo("/suppliers")}>
                <div style={styles.cardIcon}>🏭</div>
                <h3 style={styles.cardTitle}>Suppliers</h3>
                <p style={styles.cardValue("#fb923c")}>{data.totalSuppliers}</p>
                <p style={styles.cardSub}>Active suppliers</p>
              </NeonCard>
            </div>

            {/* ROW 3: QUICK STATS */}
            <div style={styles.row3}>
              <NeonQuickCard color="#22d3ee" glowColor="rgba(34,211,238," onClick={() => navigateTo("/items")}>
                <span style={styles.quickLabel}>📦 Items</span>
                <span style={styles.quickValue("#22d3ee")}>{data.totalItems}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>

              <NeonQuickCard color="#f472b6" glowColor="rgba(244,114,182," onClick={() => navigateTo("/vehicles")}>
                <span style={styles.quickLabel}>🚗 Vehicles</span>
                <span style={styles.quickValue("#f472b6")}>{data.totalVehicles}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>

              <NeonQuickCard color="#a78bfa" glowColor="rgba(167,139,250," onClick={() => navigateTo("/employees")}>
                <span style={styles.quickLabel}>👔 Employees</span>
                <span style={styles.quickValue("#a78bfa")}>{data.totalEmployees}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>

              <NeonQuickCard color="#34d399" glowColor="rgba(52,211,153," onClick={() => navigateTo("/partners")}>
                <span style={styles.quickLabel}>🤝 Partners</span>
                <span style={styles.quickValue("#34d399")}>{data.totalPartners}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>

              <NeonQuickCard color="#fb923c" glowColor="rgba(251,146,60," onClick={() => navigateTo("/drivers")}>
                <span style={styles.quickLabel}>🚚 Drivers</span>
                <span style={styles.quickValue("#fb923c")}>{data.totalDrivers}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>

              <NeonQuickCard color="#e879f9" glowColor="rgba(232,121,249," onClick={() => navigateTo("/branches")}>
                <span style={styles.quickLabel}>🏢 Branches</span>
                <span style={styles.quickValue("#e879f9")}>{data.totalBranches}</span>
                <span style={styles.quickSub}>Click to view</span>
              </NeonQuickCard>
            </div>

            {/* ROW 4: ALERTS */}
            {(data.lowStockItems > 0 || data.pendingInvoices > 0) && (
              <div style={styles.row4}>
                {data.lowStockItems > 0 && (
                  <div
                    style={styles.alertCard("#f59e0b", "rgba(245,158,11,")}
                    onClick={() => navigateTo("/items")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 0 40px rgba(245,158,11,0.25), 0 0 80px rgba(245,158,11,0.08)";
                      e.currentTarget.style.borderColor = "#f59e0b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 0 20px rgba(245,158,11,0.1)";
                      e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)";
                    }}
                  >
                    <span style={styles.alertIcon}>⚠️</span>
                    <div>
                      <div style={styles.alertTitle}>Low Stock Alert</div>
                      <div style={styles.alertMessage}>{data.lowStockItems} item(s) running low on stock</div>
                    </div>
                  </div>
                )}

                {data.pendingInvoices > 0 && (
                  <div
                    style={styles.alertCard("#ef4444", "rgba(239,68,68,")}
                    onClick={() => navigateTo("/sales")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 0 40px rgba(239,68,68,0.25), 0 0 80px rgba(239,68,68,0.08)";
                      e.currentTarget.style.borderColor = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,0.1)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                    }}
                  >
                    <span style={styles.alertIcon}>📄</span>
                    <div>
                      <div style={styles.alertTitle}>Pending Invoices</div>
                      <div style={styles.alertMessage}>{data.pendingInvoices} invoice(s) need attention</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ROW 5: MONTHLY PERFORMANCE */}
            <div style={styles.row5}>
              <NeonCard color="#22d3ee" glowColor="rgba(34,211,238," onClick={() => navigateTo("/sales")}>
                <div style={styles.cardIcon}>📈</div>
                <h3 style={styles.cardTitle}>Month Sales</h3>
                <p style={styles.cardValue("#22d3ee")}>{data.monthSales}</p>
                <p style={styles.cardSub}>SAR {data.monthSalesAmount.toFixed(2)}</p>
              </NeonCard>

              <NeonCard color="#f59e0b" glowColor="rgba(245,158,11," onClick={() => navigateTo("/purchases")}>
                <div style={styles.cardIcon}>📦</div>
                <h3 style={styles.cardTitle}>Month Purchases</h3>
                <p style={styles.cardValue("#f59e0b")}>{data.monthPurchases}</p>
                <p style={styles.cardSub}>SAR {data.monthPurchasesAmount.toFixed(2)}</p>
              </NeonCard>

              <NeonCard color="#f87171" glowColor="rgba(248,113,113," onClick={() => navigateTo("/expenses")}>
                <div style={styles.cardIcon}>💸</div>
                <h3 style={styles.cardTitle}>Month Expenses</h3>
                <p style={styles.cardValue("#f87171")}>{data.monthExpenses}</p>
                <p style={styles.cardSub}>SAR {data.monthExpensesAmount.toFixed(2)}</p>
              </NeonCard>

              <NeonCard color={data.monthProfit >= 0 ? "#4ade80" : "#ef4444"} glowColor={data.monthProfit >= 0 ? "rgba(74,222,128," : "rgba(239,68,68,"} onClick={() => navigateTo("/reports")}>
                <div style={styles.cardIcon}>🏆</div>
                <h3 style={styles.cardTitle}>Month Profit</h3>
                <p style={styles.cardValue(data.monthProfit >= 0 ? "#4ade80" : "#ef4444")}>
                  {data.monthProfit >= 0 ? "+" : ""}{data.monthProfit.toFixed(2)} SAR
                </p>
                <p style={styles.cardSub}>{data.monthSales} Sales • {data.monthPurchases} Purchases</p>
              </NeonCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;