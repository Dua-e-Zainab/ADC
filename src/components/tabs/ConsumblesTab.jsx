import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  Siren,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Clock,
  Disc,
  Layers,
  Cpu,
  RotateCcw,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { C } from "../../constants/color";
import { Card } from "../ui/Card";
import { downloadStyledExcel, downloadStyledPDF } from "../../utils/exportUtils";

import axios from "axios";
const API = '/api';
const SITE_ID_TO_CODE = { 1: "KHI", 2: "LHE" };
const CODE_TO_SITE_ID = { KHI: 1, LHE: 2 };
const VALID_CODES = new Set(["KHI", "LHE"]);

function resolveSiteCode(siteId) {
  if (siteId === null || siteId === undefined) return null;
  const asString = String(siteId).trim().toUpperCase();
  if (VALID_CODES.has(asString)) return asString;
  return SITE_ID_TO_CODE[Number(siteId)] || null;
}

// The DB (consumables_stock / consumables_daily_snapshot) stores site_id as an INT.
// Every API call below must send that numeric id, even if the parent handed us the
// string code — so resolve to the code first, then back to the canonical numeric id.
function resolveNumericSiteId(siteId) {
  const code = resolveSiteCode(siteId);
  return code ? CODE_TO_SITE_ID[code] : null;
}

const CONSUMABLES = [
  { id: "silver_front", desc: "Silver Ribbon — Front Module (1.5\")", yield: 14500, usd: 1470, group: "silver" },
  { id: "silver_back", desc: "Silver Ribbon — Back Module (1.75\")", yield: 12500, usd: 1470, group: "silver" },
  { id: "black_front", desc: "Black Ribbon — Front Module (1.5\")", yield: 14500, usd: 795, group: "black" },
  { id: "black_back", desc: "Black Ribbon — Back Module (1.75\")", yield: 12500, usd: 795, group: "black" },
  { id: "white_front", desc: "White Ribbon — Front Module (1.5\")", yield: 14500, usd: 865, group: "white" },
  { id: "white_back", desc: "White Ribbon — Back Module (1.75\")", yield: 12500, usd: 865, group: "white" },
  { id: "indent_front", desc: "White Ribbon Front Module — Indent Group", yield: 14500, usd: 865, group: "indent" },
  { id: "indent_back", desc: "Black Indent Ribbon — Back Module", yield: 9000, usd: 52, group: "indent" },
  { id: "cure_lamp", desc: "Cure Lamp", yield: 1000000, usd: 9480, group: "core" },
  { id: "cleaning_tape", desc: "Cleaning Tape MX-2100", yield: 23000, usd: 95, group: "core" },
  { id: "cleaning_roller", desc: "Cleaning Roller", yield: 100000, usd: 88, group: "core" },
  { id: "printhead", desc: "Printhead 600dpi", yield: 1300000, usd: 3650, group: "core" },
  { id: "stickers", desc: "Stickers Card Affixing MXD", yield: 15200, usd: 195, group: "core" },
  { id: "sealing_fluid", desc: "Envelope Sealing Wetter Fluid 8-Liter", yield: 60000, usd: 190, group: "core" },
  { id: "toner", desc: "Printer Toner", yield: 70000, usd: 580, group: "core" },
  { id: "drum_fuser", desc: "Printer Drum/Fuser/Maintenance Kit", yield: 300000, usd: 2750, group: "core" },
];

const GROUPS = [
  {
    id: "silver",
    label: "Silver Ribbon — All Credit Cards (Platinum CC)",
    cats: ["PLATINUM", "CREDIT CARD", "CC", "GOLD CREDIT", "CLASSIC CC", "PLATIN"],
    ribbons: [{ id: "silver_front", label: "Front" }, { id: "silver_back", label: "Back" }],
    items: ["silver_front", "silver_back"]
  },
  {
    id: "black",
    label: "Black Ribbon — Master Classic / Visa Classic",
    cats: ["MASTER CLASSIC", "VISA CLASSIC", "VISA SILVER"],
    ribbons: [{ id: "black_front", label: "Front" }, { id: "black_back", label: "Back" }],
    items: ["black_front", "black_back"]
  },
  {
    id: "white",
    label: "White Ribbon — Paypak Ameen / Visa Infinite / Freelancer / Premium Plus",
    cats: [
      "PAYPAK AMEEN",
      "VISA AMEEN FREELANCER",
      "VISA AMEEN INFINITE",
      "VISA AMEEN PREMIUM PLUS",
      "VISA FREELANCER",
      "VISA INFINITE",
      "VISA PREMIUM PLUS",
      "VISA GOLD"
    ],
    ribbons: [{ id: "white_front", label: "Front" }, { id: "white_back", label: "Back" }],
    items: ["white_front", "white_back"]
  },
  {
    id: "indent",
    label: "White Front + Black Indent — Paypak Conventional/Omni / UPI / Women",
    cats: [
      "PAYPAK CONVENTIONAL",
      "PAYPAK OMNI",
      "UPI CLASSIC",
      "VISA AMEEN WOMEN",
      "VISA UAE CLASSIC",
      "VISA UAE PAYROLL",
      "VISA UAE SIGNATURE PLATINUM"
    ],
    ribbons: [{ id: "indent_front", label: "White Front" }, { id: "indent_back", label: "Black Indent Back" }],
    items: ["indent_front", "indent_back"]
  },
];

const CORE_GROUP = { id: "core", label: "Constant Overhead — Shared Across All Groups", items: ["cure_lamp", "cleaning_tape", "cleaning_roller", "printhead", "stickers", "sealing_fluid", "toner", "drum_fuser"] };
const HEADERS = ["Item", "Yield/Unit", "Opening", "Consumed (To Date)", "Closing", "Status"];

const defaultOpeningStock = () => Object.fromEntries(CONSUMABLES.map(i => [i.id, 5.0]));

export default function ConsumablesTab({ entries, siteId }) {
  const siteCode = resolveSiteCode(siteId);
  const numericSiteId = resolveNumericSiteId(siteId);

  // Filter entries down to this site only — entries.site is a string code (KHI/LHE),
  // siteId prop is numeric (1/2), so we go through the map above rather than comparing directly.
  const siteEntries = useMemo(
    () => (siteCode ? entries.filter(e => e.site === siteCode) : []),
    [entries, siteCode]
  );

  const [openingStock, setOpeningStock] = useState(defaultOpeningStock());
  const [baseDate, setBaseDate] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [snapshots, setSnapshots] = useState({});

  const normalizeDate = (d) => (typeof d === "string" ? d.slice(0, 10) : d);

  // Load selectedDate from localStorage per-site (keyed on the resolved siteCode,
  // not the raw prop, since the raw prop's type/format may vary by caller).
  useEffect(() => {
    if (!siteCode) return;
    const saved = localStorage.getItem(`automated_selected_date_${siteCode}`);
    setSelectedDate(saved || null);
  }, [siteCode]);

  // Fetch opening stock — depends on numericSiteId (not the raw prop) since that's
  // the resolved value we can trust matches the DB's site_id column, regardless of
  // whether the parent passes "LHE" or 2.
  useEffect(() => {
    if (!numericSiteId) return;
    const fetchStock = async () => {
      try {
        const res = await axios.get(`${API}/consumables-stock`, {
          params: { siteId: numericSiteId }
        });
        if (Object.keys(res.data).length) {
          const values = {};
          let commonBaseDate = null;
          Object.entries(res.data).forEach(([itemId, rec]) => {
            values[itemId] = rec.value;
            if (rec.baseDate) commonBaseDate = rec.baseDate;
          });
          setOpeningStock({ ...defaultOpeningStock(), ...values });
          setBaseDate(commonBaseDate);
        } else {
          setOpeningStock(defaultOpeningStock());
          setBaseDate(null);
        }
      } catch (err) {
        console.error("Failed to fetch consumables stock:", err.message);
      }
      setLoaded(true);
    };
    fetchStock();
  }, [numericSiteId]);

  // Fetch snapshots — fixed to actually call the /snapshots endpoint
  // (previously called `${API}/consumables-stock`, the opening-stock endpoint,
  // so res.data was an object, not an array, and .forEach would have thrown /
  // silently done nothing useful). Also now keyed on numericSiteId.
  useEffect(() => {
    if (!numericSiteId) return;
    const fetchSnapshots = async () => {
      try {
        const res = await axios.get(`${API}/consumables-stock/snapshots`, {
          params: { siteId: numericSiteId }
        });
        const byDate = {};
        (res.data || []).forEach(row => {
          const d = row.snapshot_date?.slice ? row.snapshot_date.slice(0, 10) : row.snapshot_date;
          if (!byDate[d]) byDate[d] = {};
          byDate[d][row.item_id] = {
            opening: row.opening_value,
            consumed: row.consumed_value,
            closing: row.closing_value,
          };
        });
        setSnapshots(byDate);
      } catch (err) {
        console.error("Failed to fetch consumables snapshots:", err.message);
      }
    };
    fetchSnapshots();
  }, [numericSiteId]);

  const stateMatrix = useMemo(() => {
    if (!siteEntries?.length) {
      return {
        date: "No Activity", runs: {}, cumulativeRuns: {}, avgRuns: {}, triggers: [], ribbonStatus: {}, hwStatus: {},
        closingStock: openingStock, consumedStock: {}, tapeAlert: false, requiredTapeRolls: 0, hardwareAlerts: []
      };
    }

    const normalizedEntries = siteEntries.map(e => ({ ...e, date: normalizeDate(e.date) }));
    const sortedDates = [...new Set(normalizedEntries.map(e => e.date))].sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const lastDate = selectedDate || latestDate;

    const daySnapshot = snapshots[lastDate];
    const effectiveBaseDate = baseDate || sortedDates[0];

    const dayEntries = normalizedEntries.filter(e => e.date === lastDate);
    const cumulativeEntries = normalizedEntries.filter(e => e.date <= lastDate);
    const baseCumulativeEntries = normalizedEntries.filter(e => e.date >= effectiveBaseDate && e.date <= lastDate);

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const uniqueDays = Math.max([...new Set(normalizedEntries.filter(e => e.date >= cutoff).map(e => e.date))].length, 1);
    const recentEntries = normalizedEntries.filter(e => e.date >= cutoff);
    const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const uniqueDays60 = Math.max([...new Set(normalizedEntries.filter(e => e.date >= cutoff60).map(e => e.date))].length, 1);
    const recentEntries60 = normalizedEntries.filter(e => e.date >= cutoff60);
    const grandTotalAllTime = normalizedEntries.reduce(
      (total, e) => total + (Number(e.totalConsumption) || 0),
      0
    );

    const runs = {};
    const cumulativeRuns = {};
    const avgRuns = {};
    const ribbonStatus = {};

    const computedClosing = { ...openingStock };
    const computedConsumed = {};
    const triggers = [];
    const hardwareAlerts = [];

    let grandTotalToday = 0;
    let grandTotalCumulative = 0;
    let grandTotalAvg = 0;

    GROUPS.forEach(g => {
      const match = e => g.cats.some(c => (e.plasticCategory || "").toUpperCase().includes(c.toUpperCase()));

      const todayVol = dayEntries.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0);
      const totalCumulativeVol = cumulativeEntries.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0);
      const baseCumulativeVol = baseCumulativeEntries.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0);
      const avgDaily = recentEntries.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0) / uniqueDays;
      const avgDaily60 = recentEntries60.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0) / uniqueDays60;
      runs[g.id] = todayVol;
      cumulativeRuns[g.id] = totalCumulativeVol;
      avgRuns[g.id] = avgDaily;
      grandTotalToday += todayVol;
      grandTotalCumulative += baseCumulativeVol;
      grandTotalAvg += avgDaily;

      g.ribbons.forEach(rb => {
        const item = CONSUMABLES.find(i => i.id === rb.id);
        if (!item) return;

        const snap = daySnapshot?.[rb.id];
        const initialRolls = snap ? Number(snap.opening) : (openingStock[rb.id] || 0);
        const rollsConsumedCumulative = snap ? Number(snap.consumed) : (baseCumulativeVol / item.yield);
        const currentRemainingRolls = snap ? Number(snap.closing) : Math.max(0, initialRolls - rollsConsumedCumulative);

        computedClosing[rb.id] = currentRemainingRolls;
        computedConsumed[rb.id] = rollsConsumedCumulative;

        const cardsLeft = currentRemainingRolls * item.yield;
        const daysLeft = avgDaily > 0 ? cardsLeft / avgDaily : null;

        const rollsNeededFor60Days = avgDaily60 > 0 ? (avgDaily60 * 60) / item.yield : 0;
        const coverageRatio = rollsNeededFor60Days > 0 ? currentRemainingRolls / rollsNeededFor60Days : (currentRemainingRolls > 0 ? 1 : 0);

        ribbonStatus[rb.id] = {
          label: rb.label, group: g.label, opening: initialRolls,
          consumed: rollsConsumedCumulative, closing: currentRemainingRolls, cardsLeft, daysLeft,
          ribbonsNeededFor30Days: avgDaily > 0 ? Math.ceil((avgDaily * 30) / item.yield) : 0,
          coverageRatio,
          // STABLE if remaining rolls cover >= 60 days (2 months) at the recent 60-day average
          // daily production rate; CRITICAL otherwise. Binary — no separate warning tier.
          critical: coverageRatio < 1,
          warning: false,
        };
      });
    });

    runs["core"] = grandTotalToday;
    cumulativeRuns["core"] = cumulativeEntries.reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0);
    avgRuns["core"] = grandTotalAvg;

    const grandTotalAvg60 = GROUPS.reduce((sum, g) => {
      const match = e => g.cats.some(c => (e.plasticCategory || "").toUpperCase().includes(c.toUpperCase()));
      return sum + recentEntries60.filter(match).reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0) / uniqueDays60;
    }, 0);
    const hwStatus = {};
    CORE_GROUP.items.forEach(itemId => {
      const item = CONSUMABLES.find(i => i.id === itemId);
      if (!item) return;

      const snap = daySnapshot?.[itemId];
      const initialUnits = snap ? Number(snap.opening) : (openingStock[itemId] || 0);
      const unitsConsumedCumulative = snap ? Number(snap.consumed) : (grandTotalCumulative / item.yield);
      const currentRemainingUnits = snap ? Number(snap.closing) : Math.max(0, initialUnits - unitsConsumedCumulative);

      computedClosing[itemId] = currentRemainingUnits;
      computedConsumed[itemId] = unitsConsumedCumulative;

      const dailyUse = grandTotalAvg / item.yield;
      const daysLeft = dailyUse > 0 ? currentRemainingUnits / dailyUse : null;
      const cardsLeftOnCurrentPiece = (currentRemainingUnits - Math.floor(currentRemainingUnits)) * item.yield;
      const dailyUse60 = grandTotalAvg60 / item.yield;
      const unitsNeededFor60Days = dailyUse60 > 0 ? dailyUse60 * 60 : 0;
      const coverageRatio60 = unitsNeededFor60Days > 0 ? currentRemainingUnits / unitsNeededFor60Days : (currentRemainingUnits > 0 ? 1 : 0);

      // Same rule as ribbons: STABLE if on-hand units cover >= 60 days (2 months) at the
      // recent 60-day average daily wear rate; CRITICAL otherwise.
      hwStatus[itemId] = { coverageRatio: coverageRatio60, critical: coverageRatio60 < 1 };

      if ((currentRemainingUnits > 0 && currentRemainingUnits < 0.1) || (grandTotalToday >= item.yield * 0.90)) {
        hardwareAlerts.push({ id: itemId, desc: item.desc, remainingUnits: currentRemainingUnits, cardsLeftOnCurrentPiece: Math.max(0, cardsLeftOnCurrentPiece) });
      }
      if (daysLeft !== null && daysLeft <= 7) {
        triggers.push({
          id: itemId, desc: item.desc, opening: initialUnits, consumed: unitsConsumedCumulative,
          closing: currentRemainingUnits, daysLeft, dailyUse, needed30: dailyUse > 0 ? Math.ceil(dailyUse * 30) : 0,
          critical: coverageRatio60 < 0.5,
          warning: coverageRatio60 >= 0.5 && coverageRatio60 < 1,
        });
      }
    });

    return {
      date: lastDate,
      runs,
      cumulativeRuns,
      avgRuns,
      totalProduced: grandTotalAllTime,
      triggers,
      ribbonStatus,
      hwStatus,
      closingStock: computedClosing,
      consumedStock: computedConsumed,
      tapeAlert: grandTotalToday >= 23000,
      requiredTapeRolls: Math.max(1, Math.floor(grandTotalToday / 23000)),
      hardwareAlerts,
      hasSnapshot: !!daySnapshot,
    };
  }, [siteEntries, openingStock, selectedDate, baseDate, snapshots]);

  const consumablesExportRows = useMemo(() => {
    const rows = [];
    GROUPS.forEach(g => {
      g.items.forEach(itemId => {
        const item = CONSUMABLES.find(i => i.id === itemId);
        if (!item) return;
        rows.push([
          item.desc,
          item.yield.toLocaleString(),
          Number(openingStock[itemId] || 0).toFixed(2),
          (stateMatrix.consumedStock[itemId] || 0).toFixed(2),
          (stateMatrix.closingStock[itemId] || 0).toFixed(2),
          stateMatrix.ribbonStatus[itemId]?.critical ? "CRITICAL" : "STABLE"
        ]);
      });
    });
    CORE_GROUP.items.forEach(itemId => {
      const item = CONSUMABLES.find(i => i.id === itemId);
      if (!item) return;
      const isExhausting = stateMatrix.hardwareAlerts?.some(a => a.id === itemId);
      const isCritical = isExhausting || stateMatrix.hwStatus?.[itemId]?.critical;
      rows.push([
        item.desc,
        item.yield.toLocaleString(),
        Number(openingStock[itemId] || 0).toFixed(2),
        (stateMatrix.consumedStock[itemId] || 0).toFixed(3),
        (stateMatrix.closingStock[itemId] || 0).toFixed(2),
        isExhausting ? "EXHAUSTING" : isCritical ? "CRITICAL" : "STABLE"
      ]);
    });
    return rows;
  }, [stateMatrix, openingStock]);

  const downloadCSV = useCallback(() => {
    downloadStyledExcel({ title: `Consumables Report — ${siteCode || ""}`, headers: HEADERS, rows: consumablesExportRows, filename: `Consumables_Report_${siteCode || "Site"}_${stateMatrix.date}.xls` });
  }, [consumablesExportRows, stateMatrix.date, siteCode]);

  const downloadPDF = useCallback(() => {
    downloadStyledPDF({ title: `Consumables Report — ${siteCode || ""} — ${stateMatrix.date}`, headers: HEADERS, rows: consumablesExportRows, filename: `Consumables_Report_${siteCode || "Site"}_${stateMatrix.date}.pdf`, numericFromIndex: 1 });
  }, [consumablesExportRows, stateMatrix.date, siteCode]);

  const handleOpeningChange = async (id, val) => {
    const numVal = Math.max(0, Number(val) || 0);
    const updated = { ...openingStock, [id]: numVal };
    setOpeningStock(updated);
    const newBase = selectedDate || stateMatrix.date;
    setBaseDate(newBase);
    const closingVal = stateMatrix.closingStock[id] || 0;
    try {
      await axios.post(`${API}/consumables-stock`, {
        siteId: numericSiteId,
        itemId: id,
        value: numVal,
        closingValue: closingVal,
        baseDate: newBase,
        updatedBy: "manual",
      });
    } catch (err) {
      console.error("Failed to persist consumable stock:", err.message);
    }
  };

  const commitShift = async () => {
    if (!window.confirm(`Save snapshot for ${siteCode} — ${stateMatrix.date} and reset baseline?`)) return;

    const allItemIds = [...GROUPS.flatMap(g => g.ribbons.map(r => r.id)), ...CORE_GROUP.items];
    const items = allItemIds.map(itemId => {
      const opening = openingStock[itemId] || 0;
      const closing = stateMatrix.closingStock[itemId] || 0;
      return { itemId, opening, consumed: opening - closing, closing };
    });

    try {
      await axios.post(`${API}/consumables-stock/snapshots`, {
        siteId: numericSiteId,
        date: stateMatrix.date,
        items,
      });
      setSnapshots(prev => ({
        ...prev,
        [stateMatrix.date]: Object.fromEntries(items.map(it => [it.itemId, { opening: it.opening, consumed: it.consumed, closing: it.closing }])),
      }));

      const newStock = stateMatrix.closingStock;
      setOpeningStock(newStock);
      setBaseDate(stateMatrix.date);
      // Note: removed the duplicate second POST to /snapshots that was here before —
      // it was firing the exact same request twice on every commit.
      alert("Snapshot saved and baseline reset successfully!");
    } catch (err) {
      alert("Failed to save snapshot: " + err.message);
    }
  };

  const summaryCards = useMemo(() => {
    const getAgg = (ids) => {
      let rem = 0, days = 99;
      ids.forEach(id => {
        const rs = stateMatrix.ribbonStatus[id];
        if (rs) {
          rem += rs.closing;
          if (rs.daysLeft !== null && rs.daysLeft < days) days = rs.daysLeft;
        }
      });
      return { rem, days: days === 99 ? 0 : days };
    };
    return {
      silver: getAgg(["silver_front", "silver_back"]),
      black: getAgg(["black_front", "black_back"]),
      white: getAgg(["white_front", "white_back", "indent_front", "indent_back"])
    };
  }, [stateMatrix.ribbonStatus]);

  if (!siteCode) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
        No valid site selected. Expected siteId 1/"KHI" or 2/"LHE".
      </div>
    );
  }

  return (
    <div style={{ padding: 20, backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {(stateMatrix.tapeAlert || stateMatrix.hardwareAlerts.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {stateMatrix.tapeAlert && (
            <div style={{ background: "#fff7ed", border: "1px solid #ffedd5", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <AlertTriangle size={20} color="#9a3412" />
              <div style={{ fontSize: 13, color: "#9a3412", fontWeight: 500 }}>
                <b>Cleaning Tape Milestone:</b> System output reached <b>{(stateMatrix.runs["core"] || 0).toLocaleString()} cards</b>. Requires ~<b>{stateMatrix.requiredTapeRolls} full cycle replacements</b>.
              </div>
            </div>
          )}
          {stateMatrix.hardwareAlerts.map(a => (
            <div key={a.id} style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <Siren size={20} color="#991b1b" />
              <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 500 }}>
                <b>Core Yield Warning:</b> <b>{a.desc}</b> has ~<b style={{ fontFamily: "monospace" }}>{Math.round(a.cardsLeftOnCurrentPiece).toLocaleString()} cards</b> left before replacement. (On-Hand: {a.remainingUnits.toFixed(2)} Units).
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${C.border || "#e2e8f0"}`, borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Consumables Management — {siteCode}</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Track ribbon usage, remaining stock and automatic burn forecasting.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={commitShift} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Refresh Shift Cycle
          </button>
          <button onClick={downloadCSV} style={{ background: "#16a34a", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button onClick={downloadPDF} style={{ background: "#dc2626", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> PDF
          </button>
          <div style={{ background: "#f1f5f9", padding: "8px 16px", borderRadius: 8, textAlign: "right" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Batch Running Date</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a", fontFamily: "monospace" }}>{stateMatrix.date}</div>
          </div>
        </div>
      </div>

      <div style={{ background: "#f1f5f9", padding: "8px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={16} color="#1e3a8a" />
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Viewing Date</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a", fontFamily: "monospace" }}>{stateMatrix.date}</div>
          </div>
        </div>
        <input
          type="date"
          value={selectedDate || stateMatrix.date}
          onChange={e => {
            setSelectedDate(e.target.value);
            localStorage.setItem(`automated_selected_date_${siteCode}`, e.target.value);
          }}
          style={{ height: 32, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", fontSize: 12, fontFamily: "monospace" }}
        />
        {selectedDate && (
          <button onClick={() => {
            setSelectedDate(null);
            localStorage.removeItem(`automated_selected_date_${siteCode}`);
          }} style={{ height: 32, padding: "0 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <RotateCcw size={12} /> Latest
          </button>
        )}
        {stateMatrix.hasSnapshot ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "4px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={12} /> Recorded snapshot
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", padding: "4px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} /> Estimated (no snapshot saved)
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { title: "WHITE RIBBONS", status: "Good", bg: "#dcfce7", color: "#16a34a", val: summaryCards.white },
          { title: "BLACK RIBBONS", status: "Low", bg: "#fef9c3", color: "#ca8a04", val: summaryCards.black },
          { title: "SILVER RIBBONS", status: "Critical", bg: "#fee2e2", color: "#dc2626", val: summaryCards.silver }
        ].map((c, i) => (
          <div key={i} style={{ background: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Disc size={14} color="#64748b" /> {c.title}
              </span>
              <span style={{ color: c.color, background: c.bg, padding: "2px 8px", borderRadius: 20 }}>{c.status}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}><span style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{c.val.rem.toFixed(2)}</span> <span style={{ color: "#64748b", fontSize: 14 }}>Rolls</span></div>
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 14, paddingTop: 10, fontSize: 12, color: "#64748b" }}>Forecast Cycle: <b>{c.val.days.toFixed(1)} Days</b> remaining</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 20, marginBottom: 24 }}>
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={16} color="#2563eb" /> Total Production to Date <span style={{ fontWeight: 400, color: "#64748b" }}>(Auto Fetched)</span>
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "White Cards", val: (stateMatrix.cumulativeRuns["white"] || 0) + (stateMatrix.cumulativeRuns["indent"] || 0), color: "#2563eb" },
              { label: "Black Cards", val: stateMatrix.cumulativeRuns["black"] || 0, color: "#0f172a" },
              { label: "Silver Cards", val: stateMatrix.cumulativeRuns["silver"] || 0, color: "#dc2626" }
            ].map((p, i) => (
              <div key={i} style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: p.color }}>{p.val.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Opening Stock Configuration</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {GROUPS.flatMap(g => g.ribbons).map(rb => (
              <div key={rb.id} style={{ display: "flex", flexDirection: "column", background: "#f1f5f9", padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{rb.id.split('_')[0].toUpperCase()} ({rb.label})</span>
                <input type="number" step="0.01" value={openingStock[rb.id] || 0} onChange={e => handleOpeningChange(rb.id, e.target.value)} style={{ width: 85, border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 4px", fontSize: 12, fontWeight: 700, marginTop: 4, fontFamily: "monospace", textAlign: "right" }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 8 }}>
        <Disc size={18} color="#2563eb" /> Live Ribbon Dynamic Computations
      </h2>
      {GROUPS.map(g => {
        const cumVol = stateMatrix.cumulativeRuns[g.id] || 0;
        return (
          <Card key={g.id} style={{ marginBottom: 20, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <div style={{ background: "#1e293b", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{g.label}</span>
              <span style={{ fontSize: 12, color: "#93c5fd" }}>Total Production to Date: <b style={{ color: "#fff", fontFamily: "monospace" }}>{cumVol.toLocaleString()} Cards</b></span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 16px", color: "#475569" }}>Consumable Specs</th>
                  <th style={{ padding: "12px 16px", color: "#475569", textAlign: "right" }}>Standard Yield / Roll</th>
                  <th style={{ padding: "12px 16px", color: "#475569", textAlign: "center", background: "#f1f5f9" }}>Opening On-Hand</th>
                  <th style={{ padding: "12px 16px", color: "#dc2626", textAlign: "right" }}>Auto Consumed (To Date)</th>
                  <th style={{ padding: "12px 16px", color: "#16a34a", textAlign: "right", fontWeight: 700 }}>Auto Closing Balance</th>
                  <th style={{ padding: "12px 16px", color: "#475569", textAlign: "center" }}>Run Status</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((itemId, idx) => {
                  const item = CONSUMABLES.find(i => i.id === itemId);
                  if (!item) return null;
                  const rs = stateMatrix.ribbonStatus[itemId];
                  return (
                    <tr key={itemId} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#2563eb" }}>{item.desc}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>{item.yield.toLocaleString()}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", background: "#f8fafc", fontWeight: 700, fontFamily: "monospace" }}>{Number(openingStock[itemId] || 0).toFixed(2)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>-{(stateMatrix.consumedStock[itemId] || 0).toFixed(4)}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#16a34a" }}>{(stateMatrix.closingStock[itemId] || 0).toFixed(4)} Rolls</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: rs?.critical ? "#fee2e2" : rs?.warning ? "#fef9c3" : "#dcfce7",
                          color: rs?.critical ? "#b91c1c" : rs?.warning ? "#a16207" : "#15803d",
                          display: "inline-flex", alignItems: "center", gap: 4
                        }}>
                          {rs?.critical ? <ShieldAlert size={12} /> : rs?.warning ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                          {rs?.critical ? "CRITICAL" : rs?.warning ? "WARNING" : "STABLE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}

      <Card style={{ overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <div style={{ background: "#475569", padding: "12px 16px", display: "flex", justifyContent: "space-between", color: "#fff", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={16} color="#94a3b8" /> {CORE_GROUP.label}
          </span>
          <span style={{ fontSize: 12 }}>
            Total Facility Output:{" "}
            <b style={{ fontFamily: "monospace" }}>
              {(stateMatrix.totalProduced || 0).toLocaleString()} Cards Total
            </b>
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px", color: "#475569" }}>Hardware Item Spec</th>
              <th style={{ padding: "12px 16px", color: "#475569", textAlign: "right" }}>Standard Life Limit</th>
              <th style={{ padding: "12px 16px", color: "#475569", textAlign: "center", background: "#f1f5f9" }}>Opening Stock Unit</th>
              <th style={{ padding: "12px 16px", color: "#dc2626", textAlign: "right" }}>Total Wear Count (To Date)</th>
              <th style={{ padding: "12px 16px", color: "#16a34a", textAlign: "right", fontWeight: 700 }}>Auto Remaining Capacity</th>
              <th style={{ padding: "12px 16px", color: "#475569", textAlign: "center" }}>Warning Alert</th>
            </tr>
          </thead>
          <tbody>
            {CORE_GROUP.items.map((itemId, idx) => {
              const item = CONSUMABLES.find(i => i.id === itemId);
              if (!item) return null;
              const isItemExhausting = stateMatrix.hardwareAlerts?.some(a => a.id === itemId);
              const hs = stateMatrix.hwStatus?.[itemId];
              const isCritical = isItemExhausting || hs?.critical;
              const consumedTotal = stateMatrix.consumedStock[itemId] || 0;

              return (
                <tr key={itemId} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#475569" }}>{item.desc}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>{item.yield.toLocaleString()}</td>
                  <td style={{ padding: "8px 16px", textAlign: "center", background: "#f8fafc" }}>
                    <input type="number" step="0.01" value={openingStock[itemId] || 0} onChange={e => handleOpeningChange(itemId, e.target.value)} style={{ width: 80, textAlign: "right", fontFamily: "monospace", fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: 4, padding: "2px 4px" }} />
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>-{consumedTotal > 0 ? consumedTotal.toFixed(3) : "0.000"}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: isCritical ? "#dc2626" : "#16a34a" }}>{(stateMatrix.closingStock[itemId] || 0).toFixed(4)} Units</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: isCritical ? "#fee2e2" : "#dcfce7", color: isCritical ? "#b91c1c" : "#15803d", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {isCritical ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                      {isItemExhausting ? "EXHAUSTING" : isCritical ? "CRITICAL" : "STABLE"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}