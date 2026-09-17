import React, { useState, useMemo, useCallback, useEffect } from "react";
import axios from "axios";
import { C } from "../../constants/color";
import { INVENTORY_TYPES } from "../../constants/catalog";
import { ALERT_DAYS } from "../../constants/config";
import { fmt, fmtDate, addDays, today } from "../../utils/helper";
import { buildForecast } from "../../utils/forecast";
import { Card } from "../ui/Card";
import { Pill, InvTypePill, SegPill } from "../ui/Pill";
import SharedSyncBanner from "../layout/SharedSyncBanner";
import { downloadStyledExcel, downloadStyledPDF } from "../../utils/exportUtils";

const SCFG = {
  CRITICAL: { label: "Critical", color: C.red, bg: C.redLight, border: C.redBorder, icon: "🔴", desc: "<30 days" },
  WARNING: { label: "Warning", color: C.amber, bg: C.amberLight, border: C.amberBorder, icon: "🟡", desc: `<${ALERT_DAYS} days` },
  REORDER: { label: "Reorder", color: C.blue, bg: C.blueLight, border: C.blueBorder, icon: "🔵", desc: "PO needed" },
  HEALTHY: { label: "Healthy", color: C.green, bg: C.greenLight, border: C.greenBorder, icon: "🟢", desc: "Stock OK" },
};

const btnBase = { height: 34, padding: "0 16px", borderRadius: 8, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const inlineFlex = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const labelStyle = { fontSize: 9, fontWeight: 700, color: C.blue, textTransform: "uppercase" };

export default function ForecastTab({ entries = [], closing, currentSite, orders = {}, setOrders }) {
  const [filter, setFilter] = useState("ALL");
  const [ctF, setCtF] = useState("");
  const [invF, setInvF] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(""); // Format: "YYYY-MM"
  const [search, setSearch] = useState("");
  const [openOrder, setOpenOrder] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [siteView, setSiteView] = useState("ALL"); // "ALL" | "KHI" | "LHE"
  const API = '/api/orders';
  const todayStr = today();
  const safeOrders = useMemo(() => orders || {}, [orders]);

  // Extract unique YYYY-MM months from raw entries for the dropdown
  const availableMonths = useMemo(() => {
    if (!entries || !entries.length) return [];
    const monthsSet = new Set();
    entries.forEach((e) => {
      const dateVal = e.date || e.createdAt || e.entryDate;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          monthsSet.add(d.toISOString().slice(0, 7)); // "YYYY-MM"
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [entries]);

  // Helper to display clean month names (e.g., "2026-08" -> "Aug 2026")
  const formatMonthLabel = useCallback((ym) => {
    if (!ym) return "";
    const [year, month] = ym.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  }, []);

  // Build baseline forecast using complete dataset
  const forecast = useMemo(
    () => buildForecast(entries, closing, safeOrders, siteView === "ALL" ? null : siteView),
    [entries, closing, safeOrders, siteView]
  );

  const activeAlerts = useMemo(() =>
    forecast.filter(r => {
      const ord = safeOrders[r.key];
      return (r.status === "CRITICAL" || r.status === "WARNING") && !(ord?.placedAt || ord?.received);
    }), [forecast, safeOrders]
  );

  const recentlyOrdered = useMemo(() =>
    forecast.filter(r => {
      const ord = safeOrders[r.key];
      return ord?.placedAt && !ord.received && ["CRITICAL", "WARNING", "REORDER"].includes(r.status);
    }), [forecast, safeOrders]
  );

  useEffect(() => {
    if (activeAlerts.length > 0) setShowAlertModal(true);
  }, [activeAlerts.length]);

  // Dynamic headers appending month-wise Days Left columns
  const forecastHeaders = useMemo(() => {
    const baseHeaders = [
      "Product", "Scheme", "Category", "Type", "Segment", "Stock", "Days Left/ Months (Total)",
      "Avg/Day", "Stockout Date", "Reorder By", "Recommended Order Qty", "Ordered Qty", "Order Date", "Status"
    ];

    if (selectedMonth) {
      return [...baseHeaders, `Days Left / Months (${formatMonthLabel(selectedMonth)})`];
    }

    const monthHeaders = availableMonths.map((ym) => `Days Left / Months (${formatMonthLabel(ym)})`);
    return [...baseHeaders, ...monthHeaders];
  }, [availableMonths, selectedMonth, formatMonthLabel]);

  // Filter UI cards
  const filtered = useMemo(() =>
    forecast.filter((r) => {
      const isPlaced = safeOrders[r.key]?.placedAt && !safeOrders[r.key]?.received;
      if (filter !== "ALL" && (isPlaced ? "HEALTHY" : r.status) !== filter) return false;
      if (ctF && r.cardType !== ctF) return false;
      if (invF && r.invType !== invF) return false;

      if (selectedMonth) {
        const hasEntryInMonth = entries.some((e) => {
          const eKey = `${e.subProduct || e.plasticCategory}_${e.scheme}_${e.invType}`;
          const dateVal = e.date || e.createdAt || e.entryDate;
          if (!dateVal) return false;
          const ym = new Date(dateVal).toISOString().slice(0, 7);
          return (eKey === r.key || e.subProduct === r.subProduct) && ym === selectedMonth;
        });

        const stockoutInMonth = r.stockoutDate && r.stockoutDate.slice(0, 7) === selectedMonth;
        const reorderInMonth = r.reorderDate && r.reorderDate.slice(0, 7) === selectedMonth;

        if (!hasEntryInMonth && !stockoutInMonth && !reorderInMonth) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return r.subProduct?.toLowerCase().includes(q) || r.scheme?.toLowerCase().includes(q);
      }
      return true;
    }), [forecast, filter, ctF, invF, selectedMonth, search, safeOrders, entries]
  );

  // Dynamic row builder calculating month-wise days left based on daily burn rate of that month
  // Dynamic row builder calculating month-wise days left based on daily burn rate of that month
const forecastExportRows = useMemo(() => {
  const getMonthlyDaysLeft = (rowKey, subProd, stockVal, yearMonth) => {
    const monthEntries = entries.filter((e) => {
      const eKey = `${e.subProduct || e.plasticCategory}_${e.scheme}_${e.invType}`;
      const dateVal = e.date || e.createdAt || e.entryDate;
      if (!dateVal) return false;
      const ym = new Date(dateVal).toISOString().slice(0, 7);
      return (eKey === rowKey || e.subProduct === subProd) && ym === yearMonth;
    });

    if (!monthEntries.length) return "—";

    const totalIssued = monthEntries.reduce(
      (sum, e) => sum + (Number(e.issued) || Number(e.qty) || Number(e.consumed) || 0),
      0
    );

    const [year, month] = yearMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const avgDailyBurn = totalIssued / daysInMonth;

    if (avgDailyBurn <= 0) return "∞";

    const days = Math.round(stockVal / avgDailyBurn);
    const months = (days / 30).toFixed(1);
    return `${days} (${months} months)`; // Formatted output
  };

  return filtered.map((r) => {
    const ord = safeOrders[r.key] || {};

    // Formats total Days Left into "X (Y months)"
    const totalDaysLeftFormatted =
      r.daysLeft != null ? `${r.daysLeft} (${(r.daysLeft / 30).toFixed(1)} months)` : "∞";

    const baseRow = [
      r.subProduct || r.plasticCategory,
      r.scheme,
      r.plasticCategory,
      r.invType,
      r.segment,
      fmt(r.stock),
      totalDaysLeftFormatted, // Updated value
      r.avgD30 || r.avgD90 || "—",
      r.stockoutDate ? fmtDate(r.stockoutDate) : "Safe",
      r.reorderDate ? fmtDate(r.reorderDate) : "OK",
      r.recOrder > 0 ? fmt(r.recOrder) : "—",
      ord.qty ? fmt(ord.qty) : "—",
      ord.orderDate ? fmtDate(ord.orderDate) : "—",
      SCFG[r.status]?.label || r.status,
    ];

    const monthsToCalculate = selectedMonth ? [selectedMonth] : availableMonths;
    const monthlyDaysLeftValues = monthsToCalculate.map((ym) =>
      getMonthlyDaysLeft(r.key, r.subProduct, r.stock, ym)
    );

    return [...baseRow, ...monthlyDaysLeftValues];
  });
}, [filtered, safeOrders, entries, selectedMonth, availableMonths]);

  const exportSuffix = selectedMonth ? `_${selectedMonth}` : `_${todayStr}`;

  const downloadForecastCSV = useCallback(() => {
    const title = selectedMonth ? `Forecast Report (${formatMonthLabel(selectedMonth)})` : "Forecast Report";
    downloadStyledExcel({ title, headers: forecastHeaders, rows: forecastExportRows, filename: `Forecast_Report${exportSuffix}.xlsx` });
  }, [forecastHeaders, forecastExportRows, selectedMonth, formatMonthLabel, exportSuffix]);

  const downloadForecastPDF = useCallback(() => {
    const title = selectedMonth ? `Forecast Report — ${formatMonthLabel(selectedMonth)}` : `Forecast Report — ${todayStr}`;
    downloadStyledPDF({ title, headers: forecastHeaders, rows: forecastExportRows, filename: `Forecast_Report${exportSuffix}.pdf`, numericFromIndex: 5 });
  }, [forecastHeaders, forecastExportRows, selectedMonth, formatMonthLabel, todayStr, exportSuffix]);

  const counts = useMemo(() => {
    const tally = { CRITICAL: 0, WARNING: 0, REORDER: 0, HEALTHY: 0 };
    forecast.forEach((r) => {
      const isPlaced = safeOrders[r.key]?.placedAt && !safeOrders[r.key]?.received;
      isPlaced ? tally.HEALTHY++ : tally[r.status] !== undefined && tally[r.status]++;
    });
    return tally;
  }, [forecast, safeOrders]);

  const saveOrder = useCallback(async (r) => {
    const get = f => document.getElementById(`ord-${r.key}-${f}`)?.value || "";

    const newOrder = {
      key: r.key,
      subProduct: r.subProduct,
      plasticCategory: r.plasticCategory,
      invType: r.invType,
      cardType: r.cardType,
      scheme: r.scheme,
      segment: r.segment,
      site: currentSite,
      batch: get("batch"),
      qty: parseInt(get("qty")) || 0,
      orderDate: get("orderDate"),
      placedAt: new Date().toISOString(),
      received: false,
    };

    try {
      await axios.post("/api/orders", newOrder);
      setOrders?.(p => ({ ...p, [r.key]: newOrder }));
      setOpenOrder(null);
    } catch (err) {
      console.error("Order save failed:", err.response?.data || err.message);
      alert(err.response?.data?.error || "Failed to save order");
    }
  }, [setOrders, currentSite]);

  const markReceived = useCallback(async (key) => {
    const existing = safeOrders[key];
    if (!existing) return;

    const updated = {
      ...existing,
      received: true,
      receivedAt: new Date().toISOString()
    };

    try {
      await axios.post(API, { ...updated, key });
      setOrders?.(p => ({ ...p, [key]: updated }));
    } catch (err) {
      console.error("Mark received failed:", err.message);
    }
  }, [safeOrders, setOrders]);

  const clearOrder = useCallback(async (key) => {
    try {
      await axios.delete(`${API}/${key}`);
      setOrders?.(p => { const n = { ...p }; delete n[key]; return n; });
    } catch (err) {
      console.error("Order clear failed:", err.message);
    }
  }, [setOrders]);

  const AlertModal = () => {
    if (!showAlertModal || (!activeAlerts.length && !recentlyOrdered.length)) return null;
    return (
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999, width: 300, maxHeight: 420,
        background: "#fff", borderRadius: 14, border: `1.5px solid ${C.redBorder}`,
        boxShadow: "0 8px 28px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ background: C.red, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🚨</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{activeAlerts.length} need ordering</span>
          </div>
          <button onClick={() => setShowAlertModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", width: 20, height: 20, borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
        <div style={{ padding: "8px 10px", overflowY: "auto", flex: 1 }}>
          {activeAlerts.map(r => {
            const scfg = SCFG[r.status];
            return (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, background: scfg.bg, border: `1px solid ${scfg.border}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>{scfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subProduct || r.plasticCategory}</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>Days left: <strong>{r.daysLeft ?? "∞"}</strong></div>
                </div>
              </div>
            );
          })}
          {recentlyOrdered.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", margin: "10px 0 6px", letterSpacing: ".5px" }}>Already Ordered</div>
              {recentlyOrdered.map(r => {
                const ord = safeOrders[r.key];
                const daysSince = ord?.placedAt ? Math.floor((Date.now() - new Date(ord.placedAt)) / 86400000) : 0;
                return (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                    <span style={{ fontSize: 12 }}>✅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subProduct || r.plasticCategory}</div>
                      <div style={{ fontSize: 9, color: C.textMuted }}>Ordered {daysSince === 0 ? "today" : `${daysSince}d ago`} · Qty: <strong>{fmt(ord?.qty || 0)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  if (!entries.length) {
    return (
      <div>
        <AlertModal />
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Forecasting</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", border: `1.5px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              {["ALL", "KHI", "LHE"].map(s => (
                <button key={s} onClick={() => setSiteView(s)}
                  style={{ height: 34, padding: "0 14px", border: "none", background: siteView === s ? C.blue : "#fff", color: siteView === s ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {s === "ALL" ? "Both Sites" : s}
                </button>
              ))}
            </div>
            <button onClick={downloadForecastCSV} style={{ ...btnBase, background: C.green }}>⬇ CSV</button>
            <button onClick={downloadForecastPDF} style={{ ...btnBase, background: C.red }}>⬇ PDF</button>
          </div>
        </div>
        <SharedSyncBanner currentSite={currentSite} />
        {Object.entries(safeOrders).filter(([, o]) => o.placedAt && !o.received).map(([key, o]) => {
          const daysSince = o.placedAt ? Math.floor((Date.now() - new Date(o.placedAt)) / 86400000) : 0;
          return (
            <div key={key} style={{ background: C.amberLight, border: `1.5px solid ${C.amberBorder}`, borderRadius: 10, padding: "10px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16 }}>⏰</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>{o.subProduct || o.plasticCategory}</div>
                <div style={{ fontSize: 11, color: C.textMid }}>Order placed {daysSince}d ago · Batch: <strong>{o.batch || "—"}</strong> · Qty: <strong>{fmt(o.qty || 0)}</strong></div>
              </div>
              <button onClick={() => markReceived(key)} style={{ ...btnBase, height: 30, background: C.green }}>✅ Mark Received</button>
              <button onClick={() => clearOrder(key)} style={{ ...btnBase, height: 30, background: "#fff", color: C.amber, border: `1px solid ${C.amberBorder}` }}>✕</button>
            </div>
          );
        })}
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: C.navy, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 16, boxShadow: "0 8px 32px rgba(10,22,40,.2)" }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textMid, marginBottom: 8 }}>No Forecast Data Yet</div>
          <div style={{ fontSize: 13, color: C.textFaint }}>Start recording daily entries — 7+ days of data needed for accurate predictions.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AlertModal />
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Forecasting</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Lead: 84d · Safety buffer: 180d · Alert threshold: {ALERT_DAYS}d</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", border: `1.5px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {["ALL", "KHI", "LHE"].map(s => (
              <button key={s} onClick={() => setSiteView(s)}
                style={{ height: 34, padding: "0 14px", border: "none", background: siteView === s ? C.blue : "#fff", color: siteView === s ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {s === "ALL" ? "Both Sites" : s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={downloadForecastCSV} style={{ ...btnBase, background: C.green }}>⬇ CSV</button>
            <button onClick={downloadForecastPDF} style={{ ...btnBase, background: C.red }}>⬇ PDF</button>
          </div>
          {[
            ["⏱ Lead Time", "84 days", C.blueLight, C.blue],
            ["🛡 Safety Buffer", "180 days", C.greenLight, C.green],
            ["🔔 Alert At", `${ALERT_DAYS} days`, C.amberLight, C.amber],
            ["📦 Reorder Pt", "264 days", C.redLight, C.red],
          ].map(([l, v, bg, c]) => (
            <div key={l} style={{ background: bg, border: `1px solid ${c}30`, borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: c, fontWeight: 600 }}>{l}</span>
              <span style={{ fontSize: 10, color: c, fontWeight: 800, fontFamily: "monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <SharedSyncBanner currentSite={currentSite} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {Object.entries(SCFG).map(([status, cfg]) => {
          const active = filter === status;
          return (
            <div key={status} onClick={() => setFilter(active ? "ALL" : status)} style={{ background: active ? cfg.bg : "#fff", border: `1.5px solid ${active ? cfg.border : C.border}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all .2s", boxShadow: active ? `0 0 0 3px ${cfg.border}40, 0 4px 16px ${cfg.border}30` : "0 1px 4px rgba(0,0,0,.04)", transform: active ? "translateY(-1px)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: cfg.color, fontFamily: "monospace", lineHeight: 1, marginBottom: 6 }}>{counts[status]}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
              <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>{cfg.desc}</div>
            </div>
          );
        })}
      </div>

      {counts.CRITICAL > 0 && (
        <div style={{ background: `linear-gradient(90deg, ${C.redLight} 0%, #fff5f5 100%)`, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", boxShadow: `0 2px 12px ${C.red}18` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🚨</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{counts.CRITICAL} product{counts.CRITICAL > 1 ? "s" : ""} will run out within 30 days</div>
            <div style={{ fontSize: 11, color: C.red, opacity: 0.7, marginTop: 2 }}>Immediate reorder required to avoid production stoppage</div>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div style={{ ...inlineFlex, marginBottom: 16, padding: "12px 16px", background: "#fff", borderRadius: 12, border: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.textFaint, marginRight: 4 }}>Filter:</span>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.textFaint, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or scheme…" style={{ height: 34, width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 12px 0 28px", fontSize: 12, outline: "none", background: C.surface }} />
        </div>
        
        {/* Month Filter Dropdown */}
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", background: selectedMonth ? C.blueLight : "#fff", color: selectedMonth ? C.blue : C.text }}>
          <option value="">All Months</option>
          {availableMonths.map((ym) => (
            <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
          ))}
        </select>

        <select value={ctF} onChange={(e) => setCtF(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", background: ctF ? C.blueLight : "#fff", color: ctF ? C.blue : C.text }}>
          <option value="">All Card Types</option>
          <option>DEBIT</option>
          <option>CREDIT</option>
        </select>
        <select value={invF} onChange={(e) => setInvF(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", background: invF ? C.blueLight : "#fff", color: invF ? C.blue : C.text }}>
          <option value="">All Inv Types</option>
          {INVENTORY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {(search || ctF || invF || selectedMonth || filter !== "ALL") && (
          <button onClick={() => { setSearch(""); setCtF(""); setInvF(""); setSelectedMonth(""); setFilter("ALL"); }} style={{ ...btnBase, height: 34, background: "#fff", border: `1.5px solid ${C.border}`, color: C.textMuted }}>✕ Clear</button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.textFaint, fontFamily: "monospace" }}>{filtered.length} / {forecast.length}</span>
      </div>

      {!filtered.length ? (
        <div style={{ padding: "48px", textAlign: "center", background: "#fff", borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 13, color: C.textFaint }}>No products match your filters.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => {
            const scfg = SCFG[r.status];
            const urgent = r.daysUntilReorder !== null && r.daysUntilReorder <= 0;
            const soon = r.daysUntilReorder !== null && r.daysUntilReorder > 0 && r.daysUntilReorder <= 30;
            const ord = safeOrders[r.key] || {};
            const isPlaced = !!ord.placedAt && !ord.received;

            return (
              <div key={r.key} style={{ background: "#fff", border: `1.5px solid ${r.status !== "HEALTHY" ? scfg.border : C.border}`, borderRadius: 16, boxShadow: r.status === "CRITICAL" ? `0 2px 16px ${C.red}18` : r.status === "WARNING" ? `0 2px 12px ${C.amber}12` : "0 1px 4px rgba(0,0,0,.04)", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: r.status !== "HEALTHY" ? `linear-gradient(90deg, ${scfg.bg} 0%, #fff 100%)` : C.surface, borderBottom: `1px solid ${r.status !== "HEALTHY" ? scfg.border : C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: scfg.color, boxShadow: `0 0 8px ${scfg.color}80`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.subProduct}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, ...inlineFlex }}>
                        <span>{r.scheme}</span><span style={{ color: C.border }}>·</span>
                        <span>{r.plasticCategory}</span><span style={{ color: C.border }}>·</span>
                        <SegPill seg={r.segment} />
                        <InvTypePill type={r.invType} />
                      </div>
                    </div>
                  </div>
                  <Pill label={`${scfg.icon} ${scfg.label}`} color={scfg.color} bg={scfg.bg} border={scfg.border} />
                </div>

                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 12 }}>
                    {[
                      ["Stock", fmt(r.stock), C.text, null],
                      ["Days Left", r.daysLeft ?? "∞", r.daysLeft !== null && r.daysLeft <= 30 ? C.red : r.daysLeft !== null && r.daysLeft <= ALERT_DAYS ? C.amber : C.green, null],
                      [
                        "Stock Coverage",
                        r.daysLeft == null
                          ? "∞"
                          : `${(r.daysLeft / 30).toFixed(1)} mo (${r.daysLeft} days)`,
                        r.daysLeft !== null && r.daysLeft <= 30
                          ? C.red
                          : r.daysLeft !== null && r.daysLeft <= ALERT_DAYS
                            ? C.amber
                            : C.green,
                        null
                      ],
                      ["Stockout", r.stockoutDate ? fmtDate(r.stockoutDate) : "Safe", r.stockoutDate && r.stockoutDate <= addDays(todayStr, 90) ? C.red : C.textMid, null],
                      [urgent ? "Order NOW" : "Reorder By", r.reorderDate ? fmtDate(r.reorderDate) : "OK", urgent ? C.red : soon ? C.amber : C.textMid, urgent],
                      ["Order Qty", r.recOrder > 0 ? fmt(r.recOrder) : "—", r.recOrder > 0 ? C.blue : C.textFaint, null],
                    ].map(([l, v, c, flash]) => (
                      <div key={l} style={{ background: flash ? `${C.red}10` : C.surface, borderRadius: 10, padding: "9px 10px", border: `1px solid ${flash ? C.redBorder : "transparent"}` }}>
                        <div style={{ fontSize: 9, color: C.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>{l}</div>
                        <div style={{ fontSize: l === "Days Left" ? 22 : 12, fontWeight: 800, color: c, fontFamily: "monospace", lineHeight: 1.1 }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {(r.status === "CRITICAL" || r.status === "WARNING" || r.status === "REORDER") && (() => {
                    if (isPlaced) return (
                      <div style={{ background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, ...inlineFlex }}>
                        <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✅ Order placed {ord.placedAt ? Math.floor((Date.now() - new Date(ord.placedAt)) / 86400000) : 0}d ago</span>
                        <span style={{ fontSize: 11, color: C.textMid }}>
                          Batch: <strong>{ord.batch || "—"}</strong> · Qty: <strong>{fmt(ord.qty || 0)}</strong>
                          {ord.orderDate && <> · Ordered: <strong>{fmtDate(ord.orderDate)}</strong></>}
                        </span>
                        <button onClick={() => markReceived(r.key)} style={{ ...btnBase, height: 26, background: C.green, marginLeft: "auto" }}>✅ Received</button>
                        <button onClick={() => clearOrder(r.key)} style={{ ...btnBase, height: 26, background: "#fff", color: C.green, border: `1px solid ${C.greenBorder}` }}>✕ Clear</button>
                      </div>
                    );
                    if (openOrder === r.key) return (
                      <div style={{ background: C.blueLight, border: `1px solid ${C.blueBorder}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {[
                          ["Batch No.", "batch", "text", "e.g. NTB Batch 3", 140],
                          ["Qty Ordered", "qty", "number", "0", 90],
                          ["Order Date", "orderDate", "date", "", 130],
                        ].map(([lbl, field, type, ph, w]) => (
                          <div key={field} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={labelStyle}>{lbl}</label>
                            <input type={type} placeholder={ph} defaultValue={field === "orderDate" ? today() : ""} id={`ord-${r.key}-${field}`} style={{ height: 32, border: `1.5px solid ${C.blueBorder}`, borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none", width: w }} />
                          </div>
                        ))}
                        <button onClick={() => saveOrder(r)} style={{ ...btnBase, height: 32, background: C.blue }}>💾 Save</button>
                        <button onClick={() => setOpenOrder(null)} style={{ ...btnBase, height: 32, background: "#fff", color: C.blue, border: `1px solid ${C.blueBorder}` }}>Cancel</button>
                      </div>
                    );
                    return (
                      <button onClick={() => setOpenOrder(r.key)} style={{ ...btnBase, height: 28, background: C.blueLight, color: C.blue, border: `1.5px solid ${C.blueBorder}`, marginBottom: 10 }}>Log Order</button>
                    );
                  })()}

                  <div style={{ background: C.surface, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>📈 Forecast Consumption — 30 / 60 / 90 days</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {[["30 days", r.f30, "#3B82F6"], ["60 days", r.f60, "#8B5CF6"], ["90 days", r.f90, "#EC4899"]].map(([label, val, color]) => {
                        const pct = r.stock > 0 ? Math.min(100, Math.round((val / r.stock) * 100)) : 100;
                        return (
                          <div key={label}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{label}</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: color, fontFamily: "monospace" }}>{fmt(val)}</span>
                            </div>
                            <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 3, display: "flex", justifyContent: "space-between" }}>
                              <span>{pct}% of stock</span>
                              {pct >= 100 && <span style={{ color: C.red, fontWeight: 700 }}>⚠ Exceeds stock</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}