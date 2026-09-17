import React, { useState, useMemo, useCallback } from "react";
import { C } from "../../constants/color";
import { fmt, fmtDate,ckCatSite } from "../../utils/helper";
import { Card, CardHeader } from "../ui/Card";
import { InvTypePill } from "../ui/Pill";
import SharedSyncBanner from "../layout/SharedSyncBanner";
import { downloadStyledExcel, downloadStyledPDF } from "../../utils/exportUtils";

function SubProductIssuanceTable({ entries, totals }) {
  const map = {};
  entries.forEach(e => {
    const k = `${e.invType || "PLASTIC"}|||${e.plasticCategory}|||${e.subProduct}|||${e.scheme}`;
    if (!map[k]) map[k] = { invType: e.invType || "PLASTIC", plasticCategory: e.plasticCategory, subProduct: e.subProduct, scheme: e.scheme, batchCount: 0, extraCount: 0, total: 0, _firstDate: null, _lastDate: null, opening: 0, closing: 0 };
    if (!map[k]._firstDate || e.date < map[k]._firstDate) { map[k]._firstDate = e.date; map[k].opening = Number(e.openingBalance) || 0; }
    if (!map[k]._lastDate || e.date > map[k]._lastDate) { map[k]._lastDate = e.date; map[k].closing = Number(e.closingBalance) || 0; }
    map[k].batchCount += Number(e.totalConsumption) || 0;
    map[k].extraCount += Number(e.extraCount) || 0;
  });
  Object.values(map).forEach(r => { r.total = r.batchCount + r.extraCount; });

  const catMap = {};
  Object.values(map).forEach(r => {
    if (!catMap[r.plasticCategory]) catMap[r.plasticCategory] = [];
    catMap[r.plasticCategory].push(r);
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: C.navy }}>
            {["Type", "Category", "Sub Product", "Scheme", "Batch Count", "Extra Count", "Total"].map((h, i) => (
              <th key={i} style={{ padding: "9px 12px", color: "rgba(255,255,255,.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: i > 3 ? "right" : "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(catMap).map(([cat, rows]) => (
            <React.Fragment key={cat}>
              <tr style={{ background: "#334155" }}>
                <td colSpan={7} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                  📁 {cat} — {fmt(rows.reduce((s, r) => s + r.total, 0))} total
                </td>
              </tr>
              {rows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "#fff" : C.surface }}>
                  <td style={{ padding: "8px 12px" }}><InvTypePill type={row.invType} /></td>
                  <td style={{ padding: "8px 12px", fontSize: 11, color: C.textMid }}>{row.plasticCategory}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: C.text }}>{row.subProduct || "—"}</td>
                  <td style={{ padding: "8px 12px", fontSize: 10, color: C.textMuted }}>{row.scheme}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.batchCount > 0 ? C.blue : C.border }}>{row.batchCount > 0 ? fmt(row.batchCount) : "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.extraCount > 0 ? C.purple : C.border }}>{row.extraCount > 0 ? fmt(row.extraCount) : "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.text, background: C.greenLight }}>{fmt(row.total)}</td>
                </tr>
              ))}
              <tr style={{ background: C.surface, borderTop: `1px solid ${C.borderStrong}` }}>
                <td colSpan={4} style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, color: C.text }}>↳ {cat} subtotal</td>
                <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: C.blue }}>{fmt(rows.reduce((s, r) => s + r.batchCount, 0))}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: C.purple }}>{fmt(rows.reduce((s, r) => s + r.extraCount, 0))}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: C.green, background: C.greenLight }}>{fmt(rows.reduce((s, r) => s + r.total, 0))}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: C.navy }}>
            <td colSpan={4} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#fff" }}>GRAND TOTAL</td>
            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#60A5FA" }}>{fmt(totals.batchCount)}</td>
            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#A78BFA" }}>{fmt(totals.extraCount)}</td>
            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#34D399" }}>{fmt(totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const FormField = ({ label, children, width }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: width }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);
const StatBox = ({ label, value, color }) => (
  <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px" }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: C.textFaint, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "monospace", marginTop: 3 }}>{fmt(value)}</div>
  </div>
);
const BaseTable = ({ headers, rightAlignIndex, children }) => (
  <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr style={{ background: C.navy }}>
          {headers.map((h, i) => (
            <th key={i} style={{ padding: "9px 12px", color: "rgba(255,255,255,.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: i > rightAlignIndex ? "right" : "left" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export default function ReportsTab({ entries, dailyRows, currentSite,closing }) {
  const [fCT, setFCT] = useState("");
  const [fSeg, setFSeg] = useState("");
  const [fInv, setFInv] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fBatch, setFBatch] = useState("");
  const [fSite, setFSite] = useState("ALL");

  const [issuanceType, setIssuanceType] = useState("DEBIT");
  const [issuancePeriod, setIssuancePeriod] = useState("monthly");
  const [issuanceMonth, setIssuanceMonth] = useState("");
  const [issuanceDate, setIssuanceDate] = useState("");
  const [issuanceBatch, setIssuanceBatch] = useState("");
  const [issuanceCat, setIssuanceCat] = useState("");
  const [issuanceView, setIssuanceView] = useState("category");
  const [issuanceSubProduct, setIssuanceSubProduct] = useState("");
  const [issuancePageSize, setIssuancePageSize] = useState("A4");

  const [returnType, setReturnType] = useState("DEBIT");
  const [returnPeriod, setReturnPeriod] = useState("monthly");
  const [returnMonth, setReturnMonth] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnCat, setReturnCat] = useState("");

  const [reportMonth, setReportMonth] = useState("");
  const [reportSub, setReportSub] = useState("");
  const [reportPlasticCat, setReportPlasticCat] = useState("");
  const [reportBatch, setReportBatch] = useState("");
  const [reportSegment, setReportSegment] = useState("");
  const [reportInvType, setReportInvType] = useState("PLASTIC");
  const [activeReport, setActiveReport] = useState("issuance");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeCat, setRangeCat] = useState("");

const reportEntries = useMemo(() => {
    return entries.filter(e => 
      e.invType === reportInvType && 
      (!currentSite || currentSite === "ALL" || e.site === currentSite)
    );
  }, [entries, reportInvType, currentSite]);  const monthlyPlasticCats = useMemo(() => [...new Set(reportEntries.map(e => e.plasticCategory).filter(Boolean))].sort(), [reportEntries]);
  const monthlyBatches = useMemo(() => [...new Set(reportEntries.map(e => e.ntbBatch).filter(Boolean))].sort(), [reportEntries]);
  const monthlySegments = useMemo(() => [...new Set(reportEntries.map(e => e.segment).filter(Boolean))].sort(), [reportEntries]);
  const subs = useMemo(() => [...new Set(
    reportEntries.filter(e => !reportPlasticCat || e.plasticCategory === reportPlasticCat).map(e => e.subProduct).filter(Boolean)
  )].sort(), [reportEntries, reportPlasticCat]);

  const fil = useMemo(() => reportEntries.filter(e =>
    (fSite === "ALL" || e.site === fSite) &&
    (!fCT || e.cardType === fCT) &&
    (!fSeg || e.segment === fSeg) &&
    (!fInv || e.invType === fInv) &&
    (!fBatch || e.batchNumber === fBatch) &&
    (!fFrom || e.date >= fFrom) &&
    (!fTo || e.date <= fTo)
  ), [reportEntries, fSite, fCT, fSeg, fInv, fBatch, fFrom, fTo]);

  const totalCons = fil.reduce((s, e) => s + (e.totalConsumption || 0), 0);
  const totalDmg = fil.reduce((s, e) => s + (e.damaged || 0), 0);
  const totalMov = fil.reduce((s, e) => s + (e.movedToOtherSite || 0), 0);

  /* ── Monthly ── */
  /* ── Monthly ── */
const monthlyData = useMemo(() => {
  if (!reportMonth) return [];
  const [year, month] = reportMonth.split("-"), byKey = {};

  reportEntries
    .filter(e => {
      const [y, m] = (e.date || "").split("-");
      return y === year && m === month &&
        (!reportSub || e.subProduct === reportSub) &&
        (!reportPlasticCat || e.plasticCategory === reportPlasticCat) &&
        (!reportBatch || e.batchNumber === reportBatch) &&
        (!reportSegment || e.segment === reportSegment);
    })
    .forEach(e => {
      const k = `${e.date}|||${e.plasticCategory || ""}|||${e.subProduct || ""}`;
      
      if (!byKey[k]) {
        // Pehli entry milne par Object initialize karein (Pehla opening balance yahan set hoga)
        byKey[k] = { 
          date: e.date, 
          plasticCategory: e.plasticCategory || "—", 
          subProduct: e.subProduct || "—", 
          opening: e.openingBalance || 0, // Sirf Pehli entry ka Opening
          received: 0, 
          consumed: 0, 
          damaged: 0, 
          moved: 0, 
          closing: e.closingBalance || 0  // Initial Closing
        };
      }

      // Movement totals hamesha sum hongay
      byKey[k].received += e.receivedFromVendor || 0;
      byKey[k].consumed += e.totalConsumption || 0;
      byKey[k].damaged += e.damaged || 0;
      byKey[k].moved += e.movedToOtherSite || 0;

      // Closing balance hamesha Aakhri (latest) entry ka overwrite hoga
      byKey[k].closing = e.closingBalance || 0; 
    });

  return Object.values(byKey).sort((a, b) => 
    a.date.localeCompare(b.date) || 
    a.plasticCategory.localeCompare(b.plasticCategory) || 
    a.subProduct.localeCompare(b.subProduct)
  );
}, [reportEntries, reportMonth, reportSub, reportPlasticCat, reportBatch, reportSegment]);
  const downloadMonthlyCSV = useCallback(() => {
    downloadStyledExcel({
      title: "Monthly Report",
      headers: ["Date", "Plastic Type", "Sub Product", "Opening", "Received", "Consumed", "Damaged", "Moved", "Closing"],
      rows: monthlyData.map(r => [fmtDate(r.date), r.plasticCategory, r.subProduct, r.opening, r.received, r.consumed, r.damaged, r.moved, r.closing]),
      filename: `Monthly_Report_${reportMonth || "All"}.xls`,
    });
  }, [monthlyData, reportMonth]);

  const downloadMonthlyPDF = useCallback(() => {
    downloadStyledPDF({
      title: `Monthly Report — ${reportMonth || "All"}`,
      headers: ["Date", "Plastic Type", "Sub Product", "Opening", "Received", "Consumed", "Damaged", "Moved", "Closing"],
      rows: monthlyData.map(r => [fmtDate(r.date), r.plasticCategory, r.subProduct, fmt(r.opening), fmt(r.received), fmt(r.consumed), fmt(r.damaged), fmt(r.moved), fmt(r.closing)]),
      filename: `Monthly_Report_${reportMonth || "All"}.pdf`,
      footerRow: ["TOTAL", "", "", "—", fmt(monthlyData.reduce((s, r) => s + r.received, 0)), fmt(monthlyData.reduce((s, r) => s + r.consumed, 0)), fmt(monthlyData.reduce((s, r) => s + r.damaged, 0)), fmt(monthlyData.reduce((s, r) => s + r.moved, 0)), "—"],
      numericFromIndex: 3,
    });
  }, [monthlyData, reportMonth]);

/* ── Range ── */
/* ── Range Data Fix ── */
const rangeData = useMemo(() => {
  const from = rangeFrom || null;
  const to = rangeTo || null;

  // 1. Filter entries by category first
  const filteredEntries = reportEntries.filter((e) => {
    if (rangeCat && e.plasticCategory !== rangeCat) return false;
    return true;
  });

  // 2. Group fine-grained lines and collect their matching entries in one pass O(N)
  const fineMap = {};

  filteredEntries.forEach((e) => {
    const fk =
      `${e.invType || "PLASTIC"}|||` +
      `${e.cardType || ""}|||` +
      `${e.scheme || ""}|||` +
      `${e.plasticCategory || ""}|||` +
      `${e.subProduct || ""}|||` +
      `${e.segment || ""}`;

    if (!fineMap[fk]) {
      fineMap[fk] = {
        plasticCategory: e.plasticCategory,
        cardType: e.cardType,
        scheme: e.scheme,
        invType: e.invType || "PLASTIC",
        entries: [], // Store raw matching entries directly
      };
    }

    fineMap[fk].entries.push(e);
  });

  // 3. Process calculations for each fine line
  const calculatedFineLines = Object.values(fineMap).map((group) => {
    // Sort entries chronologically safely
    const sorted = [...group.entries].sort(
      (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
    );

    /*
     * ----------------------------------------------------
     * 1. FIND OPENING BEFORE THE REPORT RANGE
     * ----------------------------------------------------
     */
    let opening = 0;
    const beforeRange = sorted.filter(
      (e) => !from || (e.date || "") < from
    );

    if (beforeRange.length > 0) {
      // Last record prior to 'from' date becomes baseline opening
      const lastBeforeRange = beforeRange[beforeRange.length - 1];
      opening = Number(lastBeforeRange.closingBalance) || 0;
    } else if (sorted.length > 0) {
      // First ledger entry's opening balance as fallback
      opening = Number(sorted[0].openingBalance) || 0;
    }

    /*
     * ----------------------------------------------------
     * 2. CALCULATE MOVEMENTS INSIDE RANGE
     * ----------------------------------------------------
     */
    const inRange = sorted.filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });

    let received = 0;
    let consumed = 0;
    let damaged = 0;
    let moved = 0;

    inRange.forEach((e) => {
      received += Number(e.receivedFromVendor) || 0;
      consumed += Number(e.totalConsumption) || 0;
      damaged += Number(e.damaged) || 0;
      moved += Number(e.movedToOtherSite) || 0;
    });

    /*
     * ----------------------------------------------------
     * 3. CALCULATE CLOSING
     * ----------------------------------------------------
     */
    const closing = opening + received - consumed - damaged - moved;

    return {
      plasticCategory: group.plasticCategory,
      cardType: group.cardType,
      opening,
      received,
      consumed,
      damaged,
      moved,
      closing,
    };
  });

  /*
   * ----------------------------------------------------
   * 4. ROLL UP FINE LINES TO CATEGORY LEVEL
   * ----------------------------------------------------
   */
  const catMap = {};

  calculatedFineLines.forEach((line) => {
    const key = `${line.plasticCategory || ""}|||${line.cardType || ""}`;

    if (!catMap[key]) {
      catMap[key] = {
        plasticCategory: line.plasticCategory,
        cardType: line.cardType,
        opening: 0,
        received: 0,
        consumed: 0,
        damaged: 0,
        moved: 0,
        closing: 0,
      };
    }

    catMap[key].opening += line.opening;
    catMap[key].received += line.received;
    catMap[key].consumed += line.consumed;
    catMap[key].damaged += line.damaged;
    catMap[key].moved += line.moved;
    catMap[key].closing += line.closing;
  });

  return Object.values(catMap).sort(
    (a, b) =>
      (a.cardType || "").localeCompare(b.cardType || "") ||
      (a.plasticCategory || "").localeCompare(b.plasticCategory || "")
  );
}, [reportEntries, rangeFrom, rangeTo, rangeCat]);



  const rangeTotals = useMemo(() =>
  rangeData.reduce(
    (t, r) => ({
      opening: t.opening + r.opening,
      received: t.received + r.received,
      consumed: t.consumed + r.consumed,
      damaged: t.damaged + r.damaged,
      closing: t.closing + r.closing,
    }),
    {
      opening: 0,
      received: 0,
      consumed: 0,
      damaged: 0,
      closing: 0,
    }
  ),
  [rangeData]
);

  const downloadRangeCSV = useCallback(() => {
    downloadStyledExcel({
      title: `Range Report — DEBIT + CREDIT (${rangeFrom || "Start"} to ${rangeTo || "End"})`,
      headers: [
  "Code",
  "Product",
  "Opening",
  "Stock Received",
  "Consumption",
  "Damaged",
  "Closing"
],
      rows: rangeData.map(r => [
  r.cardType,
  r.plasticCategory,
  r.opening,
  r.received,
  r.consumed,
  r.damaged,
  r.closing
]),

footerRow: [
  "",
  "TOTAL",
  rangeTotals.opening,
  rangeTotals.received,
  rangeTotals.consumed,
  rangeTotals.damaged,
  rangeTotals.closing
],
      filename: `Range_Report_${rangeFrom || "Start"}_to_${rangeTo || "End"}.xls`,
    });
  }, [rangeData, rangeTotals, rangeFrom, rangeTo]);

  const downloadRangePDF = useCallback(() => {
    downloadStyledPDF({
      title: `Range Report — ${rangeFrom || "Start"} to ${rangeTo || "End"}`,
      headers: [
  "Code",
  "Product",
  "Opening",
  "Stock Received",
  "Consumption",
  "Damaged",
  "Closing"
],
      rows: rangeData.map(r => [
  r.cardType,
  r.plasticCategory,
  fmt(r.opening),
  fmt(r.received),
  fmt(r.consumed),
  fmt(r.damaged),
  fmt(r.closing)
]),

footerRow: [
  "",
  "TOTAL",
  fmt(rangeTotals.opening),
  fmt(rangeTotals.received),
  fmt(rangeTotals.consumed),
  fmt(rangeTotals.damaged),
  fmt(rangeTotals.closing)
],
      filename: `Range_Report_${rangeFrom || "Start"}_${rangeTo || "End"}.pdf`,
      numericFromIndex: 2,
    });
  }, [rangeData, rangeTotals, rangeFrom, rangeTo]);

  const rangePlasticCats = useMemo(() => [...new Set(reportEntries.map(e => e.plasticCategory).filter(Boolean))].sort(), [reportEntries]);

  const issuanceEntries = useMemo(() => {
    return reportEntries.filter((e) => {
        if (e.cardType !== issuanceType) return false;
        if (issuanceBatch && e.batchNumber !== issuanceBatch) return false;
        if (issuanceCat && e.plasticCategory !== issuanceCat) return false;
        if (issuanceSubProduct && e.subProduct !== issuanceSubProduct) return false;

        const entryDate = (e.date || "").slice(0, 10);

        if (issuancePeriod === "daily" && issuanceDate) {
            return entryDate === issuanceDate;
        }

        if (issuancePeriod === "monthly" && issuanceMonth) {
            return entryDate.startsWith(issuanceMonth);
        }

        return true;
    });
}, [
    reportEntries,
    issuanceType,
    issuancePeriod,
    issuanceMonth,
    issuanceDate,
    issuanceBatch,
    issuanceCat,
    issuanceSubProduct,
]);
// console.log(reportEntries[0]);

  // NEW — two-stage: fine-grained ledger key first, then roll up into category totals
const issuanceGrouped = useMemo(() => {
  const fineMap = {};

  // IMPORTANT: chronological order
  const sortedEntries = [...issuanceEntries].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  sortedEntries.forEach(e => {
    const fk = `${e.invType || "PLASTIC"}|||${e.cardType}|||${e.scheme}|||${e.plasticCategory}|||${e.subProduct}|||${e.segment}`;

    const r = fineMap[fk] = fineMap[fk] || {
      invType: e.invType || "PLASTIC",
      cardType: e.cardType,
      scheme: e.scheme,
      plasticCategory: e.plasticCategory,

      opening: 0,
      received: 0,
      batchCount: 0,
      damaged: 0,
      moved: 0,
      extraCount: 0,
      closing: 0,

      _firstDate: null,
      _lastDate: null,
    };

    // First historical opening
    if (r._firstDate === null) {
      r._firstDate = e.date;
      r.opening = Number(e.openingBalance) || 0;
    }

    r._lastDate = e.date;

    r.received += Number(e.receivedFromVendor) || 0;
    r.batchCount += Number(e.totalConsumption) || 0;
    r.damaged += Number(e.damaged) || 0;
    r.moved += Number(e.movedToOtherSite) || 0;
    r.extraCount += Number(e.extraCount) || 0;
  });

  // Closing
  // Closing — hamesha formula se, live ledger se kabhi nahi. Yeh report
// period-specific hai, is liye har baar consistent calculate hona chahiye,
// chahe usi din ki 1 entry ho ya 5.
Object.values(fineMap).forEach(line => {
  line.closing =
    line.opening +
    line.received -
    line.batchCount -
    line.damaged -
    line.moved;
  // extraCount ko closing se mat nikaalo — wo separate column hai jo
  // "Total" mein already add hota hai; agar business logic mein extraCount
  // bhi stock se nikalna hai to bata dena, phir yeha add karenge.
});
  // Category totals
  const catMap = {};

  Object.values(fineMap).forEach(line => {
    const ck = `${line.invType}|||${line.plasticCategory}`;

    const r = catMap[ck] = catMap[ck] || {
      invType: line.invType,
      plasticCategory: line.plasticCategory,

      opening: 0,
      received: 0,
      batchCount: 0,
      damaged: 0,
      moved: 0,
      extraCount: 0,
      total: 0,
      closing: 0,
    };

    r.opening += line.opening;
    r.received += line.received;
    r.batchCount += line.batchCount;
    r.damaged += line.damaged;
    r.moved += line.moved;
    r.extraCount += line.extraCount;
    r.closing += line.closing;
  });

  Object.values(catMap).forEach(r => {
    r.total = r.batchCount + r.extraCount;
  });

  return catMap;
}, [issuanceEntries, closing, currentSite]);

  const issuanceTotals = useMemo(() => {
  const t = Object.values(issuanceGrouped).reduce(
    (s, r) => ({
      opening: s.opening + r.opening,
      received: s.received + r.received,
      batchCount: s.batchCount + r.batchCount,
      damaged: s.damaged + r.damaged,
      moved: s.moved + r.moved,
      extraCount: s.extraCount + r.extraCount,
      closing: s.closing + r.closing,
    }),
    {
      opening: 0,
      received: 0,
      batchCount: 0,
      damaged: 0,
      moved: 0,
      extraCount: 0,
      closing: 0,
    }
  );

  t.total = t.batchCount + t.extraCount;

  return t;
}, [issuanceGrouped]);

  const issuanceCats = useMemo(() => [...new Set(reportEntries.filter(e => e.cardType === issuanceType).map(e => e.plasticCategory).filter(Boolean))].sort(), [reportEntries, issuanceType]);

  const downloadIssuanceCSV = useCallback(() => {
    const pLabel = issuancePeriod === "daily" ? issuanceDate : issuanceMonth;
    const dataRows = Object.values(issuanceGrouped).sort((a, b) => (a.plasticCategory || "").localeCompare(b.plasticCategory || ""));
    downloadStyledExcel({
      title: `Debit Card Issuance Request — ${currentSite} — Batch: ${issuanceBatch || "ALL"} — ${pLabel || "All"}`,
     headers: [
  "S.No",
  "Plastic Type",
  "Opening",
  "Stock Received",
  "Batch Count",
  "Damaged",
  "Moved",
  "Extra Count",
  "Total",
  "Closing"
],
rows: dataRows.map((r, i) => [
  i + 1,
  r.plasticCategory,
  r.opening,
  r.received,
  r.batchCount,
  r.damaged,
  r.moved,
  r.extraCount,
  r.total,
  r.closing
]),
footerRow: [
  "",
  "GRAND TOTAL",
  issuanceTotals.opening,
  issuanceTotals.received,
  issuanceTotals.batchCount,
  issuanceTotals.damaged,
  issuanceTotals.moved,
  issuanceTotals.extraCount,
  issuanceTotals.total,
  issuanceTotals.closing
],
      filename: `Issuance_${issuanceType}_${pLabel || "All"}.xls`,
    });
  }, [issuanceGrouped, issuanceTotals, issuanceType, issuancePeriod, issuanceMonth, issuanceDate, issuanceBatch, currentSite]);

  const downloadIssuancePDF = useCallback(() => {
    const pLabel = issuancePeriod === "daily" ? issuanceDate : issuanceMonth;
    const stuffingLabel = issuancePageSize === "LEGAL" ? "MANUAL STUFFING — LEGAL PAGE" : "AUTOSTUFFING — A4";
    const dataRows = Object.values(issuanceGrouped).sort((a, b) => (a.plasticCategory || "").localeCompare(b.plasticCategory || ""));
    downloadStyledPDF({
      title: `Issuance Report — ${issuanceType} | ${currentSite} | ${pLabel || "All"} | ${stuffingLabel}`,
      headers: [
  "S.No",
  "Plastic Type",
  "Opening",
  "Stock Received",
  "Batch Count",
  "Damaged",
  "Moved",
  "Extra Count",
  "Total",
  "Closing"
],

rows: dataRows.map((r, i) => [
  i + 1,
  r.plasticCategory,
  fmt(r.opening),
  fmt(r.received),
  fmt(r.batchCount),
  fmt(r.damaged),
  fmt(r.moved),
  fmt(r.extraCount),
  fmt(r.total),
  fmt(r.closing)
]),

footerRow: [
  "",
  "GRAND TOTAL",
  fmt(issuanceTotals.opening),
  fmt(issuanceTotals.received),
  fmt(issuanceTotals.batchCount),
  fmt(issuanceTotals.damaged),
  fmt(issuanceTotals.moved),
  fmt(issuanceTotals.extraCount),
  fmt(issuanceTotals.total),
  fmt(issuanceTotals.closing)
],
      numericFromIndex: 2,
    });
  }, [issuanceGrouped, issuanceTotals, issuanceType, issuancePeriod, issuanceMonth, issuanceDate, currentSite, issuancePageSize]);

  /* ── Return ── */
  const returnEntries = useMemo(() => reportEntries.filter(e => {
    if (e.cardType !== returnType || (returnCat && e.plasticCategory !== returnCat)) return false;
    if (returnPeriod === "daily" && returnDate) return e.date === returnDate;
    if (returnPeriod === "monthly" && returnMonth) {
      const [y, m] = returnMonth.split("-"), [ey, em] = (e.date || "").split("-");
      return y === ey && m === em;
    }
    return true;
  }), [reportEntries, returnType, returnPeriod, returnMonth, returnDate, returnCat]);

  const returnGrouped = useMemo(() => {
    const map = {}, catMap = {};
    returnEntries.forEach(e => {
      const k = `${e.plasticCategory}|||${e.subProduct}|||${e.scheme}`;
      const r = map[k] = map[k] || { plasticCategory: e.plasticCategory, subProduct: e.subProduct, scheme: e.scheme, batchCount: 0, extraCount: 0, totalIssuance: 0, damaged: 0, extraReturn: 0, opening: 0, closing: 0, _firstDate: null, _lastDate: null };
      if (!r._firstDate || e.date < r._firstDate) { r._firstDate = e.date; r.opening = Number(e.openingBalance) || 0; }
      if (!r._lastDate || e.date > r._lastDate) { r._lastDate = e.date; r.closing = Number(e.closingBalance) || 0; }
      const bc = Number(e.totalConsumption) || 0, ec = Number(e.extraCount) || 0;
      r.batchCount += bc; r.extraCount += ec; r.totalIssuance += bc + ec; r.damaged += Number(e.damaged) || 0;
    });
    Object.values(map).forEach(r => {
      r.extraReturn = Math.abs(r.extraCount - r.damaged);
      (catMap[r.plasticCategory] = catMap[r.plasticCategory] || []).push(r);
    });
    return catMap;
  }, [returnEntries]);

  const returnTotals = useMemo(() => {
    const t = { batchCount: 0, extraCount: 0, totalIssuance: 0, damaged: 0, extraReturn: 0 };
    Object.values(returnGrouped).flat().forEach(r => {
      t.batchCount += r.batchCount; t.extraCount += r.extraCount; t.totalIssuance += r.totalIssuance; t.damaged += r.damaged;
    });
    t.extraReturn = Math.abs(t.extraCount - t.damaged);
    return t;
  }, [returnGrouped]);

  const returnByPlastic = useMemo(() => {
    const map = {};
    Object.values(returnGrouped).flat().forEach(r => {
      const k = r.plasticCategory;
      if (!map[k]) map[k] = { extraReturn: 0 };
      map[k].extraReturn += r.extraReturn || 0;
    });
    return map;
  }, [returnGrouped]);

  const auditData = useMemo(() => {
    const map = {};
    fil.forEach(e => {
      const k = e.plasticCategory;
      if (!map[k]) map[k] = { plasticCategory: k, opening: 0, batchCount: 0, issuanceBatch: 0, extraCount: 0, damaged: 0, _firstDate: null };
      const r = map[k];
      if (!r._firstDate || e.date < r._firstDate) { r._firstDate = e.date; r.opening = Number(e.openingBalance) || 0; }
      const bc = Number(e.batchCount ?? e.totalConsumption) || 0;
      r.batchCount += bc; r.issuanceBatch += bc;
      r.extraCount += Number(e.extraCount) || 0;
      r.damaged += Number(e.damaged) || 0;
    });
    return Object.values(map).sort((a, b) => (a.plasticCategory || "").localeCompare(b.plasticCategory || ""));
  }, [fil]);

  /* ── Daily Audit Export Logics ── */
  const downloadAuditCSV = useCallback(() => {
    const dataRows = auditData.map(row => {
      const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
      const totalReturnIssuance = returnExtra;
      const totalStatusProduction = row.opening + row.batchCount;
      const totalIssuanceCard = row.issuanceBatch + row.extraCount;
      const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
      const totalPlasticConsumption = row.damaged + totalPlasticProduction;
      const closingProductionStatus = totalStatusProduction - totalPlasticProduction;
      return [
        row.plasticCategory, row.opening, row.batchCount, totalStatusProduction,
        row.issuanceBatch, row.extraCount, totalIssuanceCard,
        0, returnExtra, totalReturnIssuance,
        row.damaged, totalPlasticProduction, totalPlasticConsumption, closingProductionStatus
      ];
    });

    const totals = auditData.reduce((t, row) => {
      const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
      const totalStatusProduction = row.opening + row.batchCount;
      const totalIssuanceCard = row.issuanceBatch + row.extraCount;
      const totalReturnIssuance = returnExtra;
      const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
      const totalPlasticConsumption = row.damaged + totalPlasticProduction;
      const closingProductionStatus = totalStatusProduction - totalPlasticProduction;
      return {
        opening: t.opening + row.opening, batchCount: t.batchCount + row.batchCount,
        totalStatusProduction: t.totalStatusProduction + totalStatusProduction,
        issuanceBatch: t.issuanceBatch + row.issuanceBatch, extraCount: t.extraCount + row.extraCount,
        totalIssuanceCard: t.totalIssuanceCard + totalIssuanceCard, returnExtra: t.returnExtra + returnExtra,
        totalReturnIssuance: t.totalReturnIssuance + totalReturnIssuance, damaged: t.damaged + row.damaged,
        totalPlasticProduction: t.totalPlasticProduction + totalPlasticProduction,
        totalPlasticConsumption: t.totalPlasticConsumption + totalPlasticConsumption,
        closingProductionStatus: t.closingProductionStatus + closingProductionStatus,
      };
    }, { opening: 0, batchCount: 0, totalStatusProduction: 0, issuanceBatch: 0, extraCount: 0, totalIssuanceCard: 0, returnExtra: 0, totalReturnIssuance: 0, damaged: 0, totalPlasticProduction: 0, totalPlasticConsumption: 0, closingProductionStatus: 0 });

    downloadStyledExcel({
      title: `Daily Audit Report — Site: ${fSite} — ${currentSite}`,
      headers: [
        "Plastic Type", "Opening Plastic Production Status", "Daily Production Status", "Total Status for Production",
        "Issuance Card from Vault", "Extra Issuance Card from Vault", "Total Issuance Card",
        "Daily Return Issuance", "Return Extra Issuance", "Total Return Issuance",
        "Physical Damaged Cards", "Total Plastic Production", "Total Plastic Consumption", "Closing Production Status"
      ],
      rows: dataRows,
      footerRow: [
        "TOTAL", totals.opening, totals.batchCount, totals.totalStatusProduction,
        totals.issuanceBatch, totals.extraCount, totals.totalIssuanceCard,
        0, totals.returnExtra, totals.totalReturnIssuance,
        totals.damaged, totals.totalPlasticProduction, totals.totalPlasticConsumption, totals.closingProductionStatus
      ],
      filename: `Daily_Audit_Report_${fFrom || "Start"}_to_${fTo || "End"}.xls`,
    });
  }, [auditData, returnByPlastic, fSite, currentSite, fFrom, fTo]);

  const downloadAuditPDF = useCallback(() => {
    const dataRows = auditData.map(row => {
      const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
      const totalReturnIssuance = returnExtra;
      const totalStatusProduction = row.opening + row.batchCount;
      const totalIssuanceCard = row.issuanceBatch + row.extraCount;
      const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
      const totalPlasticConsumption = row.damaged + totalPlasticProduction;
      const closingProductionStatus = totalStatusProduction - totalPlasticProduction;
      return [
        row.plasticCategory, fmt(row.opening), fmt(row.batchCount), fmt(totalStatusProduction),
        fmt(row.issuanceBatch), fmt(row.extraCount), fmt(totalIssuanceCard),
        "—", fmt(returnExtra), fmt(totalReturnIssuance),
        row.damaged > 0 ? fmt(row.damaged) : "—", fmt(totalPlasticProduction), fmt(totalPlasticConsumption), fmt(closingProductionStatus)
      ];
    });

    const totals = auditData.reduce((t, row) => {
      const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
      const totalStatusProduction = row.opening + row.batchCount;
      const totalIssuanceCard = row.issuanceBatch + row.extraCount;
      const totalReturnIssuance = returnExtra;
      const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
      const totalPlasticConsumption = row.damaged + totalPlasticProduction;
      const closingProductionStatus = totalStatusProduction - totalPlasticProduction;
      return {
        opening: t.opening + row.opening, batchCount: t.batchCount + row.batchCount,
        totalStatusProduction: t.totalStatusProduction + totalStatusProduction,
        issuanceBatch: t.issuanceBatch + row.issuanceBatch, extraCount: t.extraCount + row.extraCount,
        totalIssuanceCard: t.totalIssuanceCard + totalIssuanceCard, returnExtra: t.returnExtra + returnExtra,
        totalReturnIssuance: t.totalReturnIssuance + totalReturnIssuance, damaged: t.damaged + row.damaged,
        totalPlasticProduction: t.totalPlasticProduction + totalPlasticProduction,
        totalPlasticConsumption: t.totalPlasticConsumption + totalPlasticConsumption,
        closingProductionStatus: t.closingProductionStatus + closingProductionStatus,
      };
    }, { opening: 0, batchCount: 0, totalStatusProduction: 0, issuanceBatch: 0, extraCount: 0, totalIssuanceCard: 0, returnExtra: 0, totalReturnIssuance: 0, damaged: 0, totalPlasticProduction: 0, totalPlasticConsumption: 0, closingProductionStatus: 0 });

    downloadStyledPDF({
      title: `Daily Audit Report — Site: ${fSite} | ${currentSite}`,
      headers: [
        "Plastic Type", "Opening Prod", "Daily Prod", "Total Prod Status",
        "Vault Issuance", "Extra Vault Issuance", "Total Issuance",
        "Daily Ret Issuance", "Ret Extra Issuance", "Total Ret Issuance",
        "Phys Damaged", "Total Plastic Prod", "Total Plastic Cons", "Closing Prod Status"
      ],
      rows: dataRows,
      footerRow: [
        "TOTAL", fmt(totals.opening), fmt(totals.batchCount), fmt(totals.totalStatusProduction),
        fmt(totals.issuanceBatch), fmt(totals.extraCount), fmt(totals.totalIssuanceCard),
        "—", fmt(totals.returnExtra), fmt(totals.totalReturnIssuance),
        fmt(totals.damaged), fmt(totals.totalPlasticProduction), fmt(totals.totalPlasticConsumption), fmt(totals.closingProductionStatus)
      ],
      filename: `Daily_Audit_Report_${fFrom || "Start"}_to_${fTo || "End"}.pdf`,
      numericFromIndex: 1,
    });
  }, [auditData, returnByPlastic, fSite, currentSite, fFrom, fTo]);

  const returnCats = useMemo(() =>
    [...new Set(reportEntries.filter(e => e.cardType === returnType && e.plasticCategory).map(e => e.plasticCategory))].sort(), [reportEntries, returnType]
  );

  const downloadReturnCSV = useCallback(() => {
    const periodLabel = returnPeriod === "daily" ? returnDate : returnMonth;
    const dataRows = Object.values(returnGrouped).flat();
    downloadStyledExcel({
      title: `Debit Card Return Report — ${returnType} — ${currentSite} — ${periodLabel || "All"}`,
      headers: ["S.No", "Plastic Type", "Sub Product", "Scheme", "Batch Count", "Extra Count", "Total Issuance", "Damaged", "Extra Return"],
      rows: dataRows.map((r, i) => [i + 1, r.plasticCategory, r.subProduct, r.scheme, r.batchCount, r.extraCount, r.totalIssuance, r.damaged, r.extraReturn]),
      footerRow: ["", "GRAND TOTAL", "", "", returnTotals.batchCount, returnTotals.extraCount, returnTotals.totalIssuance, returnTotals.damaged, returnTotals.extraReturn],
      filename: `Return_${returnType}_${periodLabel || "All"}.xls`,
    });
  }, [returnGrouped, returnTotals, returnType, returnPeriod, returnMonth, returnDate, currentSite]);

  const downloadReturnPDF = useCallback(() => {
    const pLabel = returnPeriod === "daily" ? returnDate : returnMonth;
    const dataRows = Object.values(returnGrouped).flat();
    downloadStyledPDF({
      title: `Return Report — ${returnType} | ${currentSite} | ${pLabel || "All"}`,
      headers: ["S.No", "Plastic Type", "Sub Product", "Scheme", "Batch Count", "Extra Count", "Total Issuance", "Damaged", "Extra Return"],
      rows: dataRows.map((r, i) => [i + 1, r.plasticCategory, r.subProduct || "—", r.scheme, fmt(r.batchCount), fmt(r.extraCount), fmt(r.totalIssuance), fmt(r.damaged), fmt(r.extraReturn)]),
      footerRow: ["", "GRAND TOTAL", "", "", fmt(returnTotals.batchCount), fmt(returnTotals.extraCount), fmt(returnTotals.totalIssuance), fmt(returnTotals.damaged), fmt(returnTotals.extraReturn)],
      filename: `Return_${returnType}_${pLabel || "All"}.pdf`,
      numericFromIndex: 4,
    });
  }, [returnGrouped, returnTotals, returnType, returnPeriod, returnMonth, returnDate, currentSite]);

  /* ── Render ── */
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Reports</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Select a report type to view.</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        {[
          ["issuance", "💳 Issuance"],
          ["return", "↩️ Return"],
          ["monthly", "📅 Monthly"],
          ["audit", "🔍 Daily Audit"],
          ["range", "📊 Range Report"],
        ].map(([v, l]) => (
          <div key={v} onClick={() => setActiveReport(v)} style={{
            padding: "10px 22px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
            background: activeReport === v ? C.navy : "#fff",
            color: activeReport === v ? "#fff" : C.textMid,
            border: `2px solid ${activeReport === v ? C.navy : C.border}`,
            transition: "all .15s",
            boxShadow: activeReport === v ? "0 2px 8px rgba(0,0,0,.15)" : "none"
          }}>{l}</div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["PLASTIC", "💳 Plastic"], ["MAILER", "📬 Mailer"], ["ENVELOPE", "✉️ Envelope"]].map(([v, l]) => (
          <div key={v} onClick={() => setReportInvType(v)} style={{
            padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: reportInvType === v ? C.blue : "#fff",
            color: reportInvType === v ? "#fff" : C.textMid,
            border: `1.5px solid ${reportInvType === v ? C.blue : C.border}`,
            transition: "all .15s"
          }}>{l}</div>
        ))}
      </div>

      <SharedSyncBanner currentSite={currentSite} />

      {activeReport === "issuance" && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>Issuance Report — {issuanceType}</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Opening · Batch Count · Extra Count · Total · Closing</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={downloadIssuanceCSV} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ CSV</button>
              <button onClick={downloadIssuancePDF} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ PDF</button>
            </div>
          </div>

          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", background: C.surface }}>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
              {["DEBIT", "CREDIT"].map(t => (
                <div key={t} onClick={() => setIssuanceType(t)} style={{ height: 34, padding: "0 16px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 12, fontWeight: 600, background: issuanceType === t ? (t === "DEBIT" ? C.blue : C.red) : "#fff", color: issuanceType === t ? "#fff" : (t === "DEBIT" ? C.blue : C.red) }}>{t === "DEBIT" ? "💳" : "💎"} {t}</div>
              ))}
            </div>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
              {[["monthly", "Monthly"], ["daily", "Daily"]].map(([v, l]) => (
                <div key={v} onClick={() => setIssuancePeriod(v)} style={{ height: 34, padding: "0 14px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 12, fontWeight: 600, background: issuancePeriod === v ? C.navy : "#fff", color: issuancePeriod === v ? "#fff" : C.textMid }}>{l}</div>
              ))}
            </div>
            <input type={issuancePeriod === "monthly" ? "month" : "date"} value={issuancePeriod === "monthly" ? issuanceMonth : issuanceDate} onChange={e => issuancePeriod === "monthly" ? setIssuanceMonth(e.target.value) : setIssuanceDate(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} />
            <select value={issuanceCat} onChange={e => setIssuanceCat(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", minWidth: 160 }}>
              <option value="">All Categories</option>
              {issuanceCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
              {[["category", "📁 Category"], ["subproduct", "🔖 Sub Product"]].map(([v, l]) => (
                <div key={v} onClick={() => setIssuanceView(v)} style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 11, fontWeight: 600, background: issuanceView === v ? C.navy : "#fff", color: issuanceView === v ? "#fff" : C.textMid }}>{l}</div>
              ))}
            </div>
            {issuanceCat && reportEntries.find(e => e.plasticCategory === issuanceCat && e.invType === "MAILER") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, textTransform: "uppercase" }}>Page Size</label>
                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
                  {[["A4", "A4"], ["LEGAL", "Legal"]].map(([v, l]) => (
                    <div key={v} onClick={() => setIssuancePageSize(v)} style={{ height: 34, padding: "0 14px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 11, fontWeight: 600, background: issuancePageSize === v ? C.navy : "#fff", color: issuancePageSize === v ? "#fff" : C.textMid, transition: "all .15s" }}>{l}</div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => { setIssuanceBatch(""); setIssuanceMonth(""); setIssuanceDate(""); setIssuanceCat(""); setIssuancePageSize("A4"); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.textMuted }}>Clear</button>
          </div>

          <div style={{
  display: "grid",
  gridTemplateColumns: "repeat(8,1fr)",
  gap: 10,
  padding: "14px 20px",
  borderBottom: `1px solid ${C.border}`,
  background: C.surfaceAlt
}}>
  {[
    ["Opening", issuanceTotals.opening, C.textMid],
    ["Received", issuanceTotals.received, C.green],
    ["Batch Count", issuanceTotals.batchCount, C.blue],
    ["Damaged", issuanceTotals.damaged, C.red],
    ["Moved", issuanceTotals.moved, C.orange],
    ["Extra Count", issuanceTotals.extraCount, C.purple],
    ["Grand Total", issuanceTotals.total, C.navy],
    ["Closing", issuanceTotals.closing, C.textMid],
  ].map(([l, v, c]) => (
    <StatBox key={l} label={l} value={v} color={c} />
  ))}
</div>
          {!Object.keys(issuanceGrouped).length ? (
            <div style={{ padding: 36, textAlign: "center", color: C.textFaint, fontSize: 13 }}>No entries for selected period.</div>
          ) : issuanceView === "category" ? (
            <BaseTable
          headers={[
            "Inv Type",
            "Plastic Category",
            "Opening",
            "Stock Received",
            "Batch Count",
            "Damaged",
            "Moved",
            "Extra Count",
            "Total",
            "Closing"
          ]}
          rightAlignIndex={1}
        >
              {Object.values(issuanceGrouped).sort((a, b) => (a.plasticCategory || "").localeCompare(b.plasticCategory || "")).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "#fff" : C.surface }}>
                  <td style={{ padding: "8px 12px" }}><InvTypePill type={row.invType} /></td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: C.text }}>{row.plasticCategory}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: C.textMid }}>{fmt(row.opening)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: C.green }}>{row.received > 0 ? fmt(row.received) : "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.batchCount > 0 ? C.blue : C.border }}>{row.batchCount > 0 ? fmt(row.batchCount) : "—"}</td>
                  <td style={{
  padding: "8px 12px",
  textAlign: "right",
  fontFamily: "monospace",
  color: row.damaged > 0 ? C.red : C.border
}}>
  {row.damaged > 0 ? fmt(row.damaged) : "—"}
</td>

<td style={{
  padding: "8px 12px",
  textAlign: "right",
  fontFamily: "monospace",
  fontWeight: 600,
  color: row.moved > 0 ? C.orange : C.border
}}>
  {row.moved > 0 ? fmt(row.moved) : "—"}
</td>

<td style={{
  padding: "8px 12px",
  textAlign: "right",
  fontFamily: "monospace",
  fontWeight: 600,
  color: row.extraCount > 0 ? C.purple : C.border
}}>
  {row.extraCount > 0 ? fmt(row.extraCount) : "—"}
</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.text, background: C.greenLight }}>{fmt(row.total)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: C.textMid }}>{fmt(row.closing)}</td>
                </tr>
              ))}
              <tr style={{ background: C.navy, color: "#fff", fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: "10px 12px" }}>GRAND TOTAL — {Object.keys(issuanceGrouped).length} categories</td>
{["opening", "received", "batchCount", "damaged", "moved", "extraCount", "total", "closing"].map((k, i) => (                  <td key={k} style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: i === 1 || i === 5 ? "#34D399" : i === 2 ? "#60A5FA" : i === 3 ? "#F87171" : i === 4 ? "#A78BFA" : "#fff" }}>{fmt(issuanceTotals[k])}</td>
                ))}
              </tr>
            </BaseTable>
          ) : <SubProductIssuanceTable entries={issuanceEntries} totals={issuanceTotals} />}
        </Card>
      )}

      {activeReport === "return" && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>Return Report — {returnType}</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Batch Count · Extra Count · Total Issuance · Damaged · Extra Return</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={downloadReturnCSV} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ CSV</button>
              <button onClick={downloadReturnPDF} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ PDF</button>
            </div>
          </div>

          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", background: C.surface }}>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
              {["DEBIT", "CREDIT"].map(t => (
                <div key={t} onClick={() => setReturnType(t)} style={{ height: 34, padding: "0 16px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 12, fontWeight: 600, background: returnType === t ? (t === "DEBIT" ? C.blue : C.red) : "#fff", color: returnType === t ? "#fff" : (t === "DEBIT" ? C.blue : C.red), transition: "all .15s" }}>{t === "DEBIT" ? "💳" : "💎"} {t}</div>
              ))}
            </div>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
              {[["monthly", "Monthly"], ["daily", "Daily"]].map(([v, l]) => (
                <div key={v} onClick={() => setReturnPeriod(v)} style={{ height: 34, padding: "0 14px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 12, fontWeight: 600, background: returnPeriod === v ? C.navy : "#fff", color: returnPeriod === v ? "#fff" : C.textMid, transition: "all .15s" }}>{l}</div>
              ))}
            </div>
            {returnPeriod === "monthly"
              ? <input type="month" value={returnMonth} onChange={e => setReturnMonth(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} />
              : <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} />
            }
            <select value={returnCat} onChange={e => setReturnCat(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", minWidth: 160 }}>
              <option value="">All Categories</option>
              {returnCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => { setReturnMonth(""); setReturnDate(""); setReturnCat(""); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.textMuted }}>Clear</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
            {[["Batch Count", returnTotals.batchCount, C.blue], ["Extra Count", returnTotals.extraCount, C.purple], ["Total Issuance", returnTotals.totalIssuance, C.text], ["Damaged", returnTotals.damaged, C.red], ["Extra Return", returnTotals.extraReturn, C.green]].map(([l, v, c]) => (
              <StatBox key={l} label={l} value={v} color={c} />
            ))}
          </div>

          {!Object.keys(returnGrouped).length
            ? <div style={{ padding: "36px", textAlign: "center", color: C.textFaint, fontSize: 13 }}>No entries for selected period.</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.navy }}>
                      {["Category", "Sub Product", "Scheme", "Batch Count", "Extra Count", "Total Issuance", "Damaged", "Extra Return"].map((h, i) => (
                        <th key={i} style={{ padding: "9px 12px", color: "rgba(255,255,255,.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: i > 2 ? "right" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(returnGrouped).map(([cat, rows]) => (
                      <React.Fragment key={cat}>
                        <tr style={{ background: "#334155" }}>
                          <td colSpan={8} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#fff" }}>📁 {cat}</td>
                        </tr>
                        {rows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "#fff" : C.surface }}>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: C.textMid }}>{row.plasticCategory}</td>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: C.text }}>{row.subProduct || "—"}</td>
                            <td style={{ padding: "8px 12px", fontSize: 10, color: C.textMuted }}>{row.scheme}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.batchCount > 0 ? C.blue : C.border }}>{row.batchCount > 0 ? fmt(row.batchCount) : "—"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.extraCount > 0 ? C.purple : C.border }}>{row.extraCount > 0 ? fmt(row.extraCount) : "—"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: C.text }}>{fmt(row.totalIssuance)}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: row.damaged > 0 ? C.red : C.border }}>{row.damaged > 0 ? fmt(row.damaged) : "—"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.green, background: C.greenLight }}>{fmt(row.extraReturn)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.navy }}>
                      <td colSpan={3} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#fff" }}>GRAND TOTAL</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#60A5FA" }}>{fmt(returnTotals.batchCount)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#A78BFA" }}>{fmt(returnTotals.extraCount)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#FFF" }}>{fmt(returnTotals.totalIssuance)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#F87171" }}>{fmt(returnTotals.damaged)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#34D399" }}>{fmt(returnTotals.extraReturn)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          }
        </Card>
      )}

      {activeReport === "monthly" && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>📅 Monthly Report</div>
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Day-by-day breakdown — shared data</div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
              <FormField label="Month"><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} /></FormField>
              {[
                ["Plastic Type", reportPlasticCat, e => { setReportPlasticCat(e.target.value); setReportSub(""); }, monthlyPlasticCats, "— All Types —", 150],
                ["Sub Product", reportSub, e => setReportSub(e.target.value), subs, "— All Sub Products —", 180],
                ["Batch", reportBatch, e => setReportBatch(e.target.value), monthlyBatches, "— All Batches —", 130],
                ["Segment", reportSegment, e => setReportSegment(e.target.value), monthlySegments, "— All Segments —", 130]
              ].map(([l, val, change, opts, ph, w]) => (
                <FormField key={l} label={l} width={w}>
                  <select value={val} onChange={change} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }}>
                    <option value="">{ph}</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
              ))}
              <div style={{ display: "flex", gap: 6 }}>
                {reportMonth && monthlyData.length > 0 && (
                  <>
                    <button onClick={downloadMonthlyCSV} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ CSV</button>
                    <button onClick={downloadMonthlyPDF} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ PDF</button>
                  </>
                )}
                <button onClick={() => { setReportPlasticCat(""); setReportSub(""); setReportBatch(""); setReportSegment(""); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.textMuted }}>Reset Filters</button>
              </div>
            </div>

            {!reportMonth || monthlyData.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: C.textFaint, fontSize: 13, background: C.surface, borderRadius: 10 }}>{!reportMonth ? "Please select a target month to view the data timeline." : "No entries match this filter profile."}</div>
            ) : (
              <BaseTable headers={["Date", "Plastic Type", "Sub Product", "Opening", "Received", "Consumed", "Damaged", "Moved", "Closing"]} rightAlignIndex={2}>
                {monthlyData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : C.surface, fontSize: 11 }}>
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", color: C.text, fontWeight: 600 }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "9px 12px", color: C.textMid }}>{r.plasticCategory}</td>
                    <td style={{ padding: "9px 12px", color: C.textMuted }}>{r.subProduct}</td>
                    {[r.opening, r.received, r.consumed, r.damaged, r.moved, r.closing].map((v, j) => (
                      <td key={j} style={{ padding: "9px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: j === 1 ? C.green : j === 5 && v < 0 ? C.red : C.text }}>{fmt(v)}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: C.surface, borderTop: `2px solid ${C.borderStrong}`, fontWeight: 700 }}>
                  <td style={{ padding: "9px 12px" }}>TOTAL</td>
                  <td colSpan={2} style={{ padding: "9px 12px", color: C.textFaint }}>—</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: C.textFaint }}>—</td>
                  {["received", "consumed", "damaged", "moved"].map(k => (
                    <td key={k} style={{ padding: "9px 12px", textAlign: "right", fontFamily: "monospace", color: C.text }}>{fmt(monthlyData.reduce((s, r) => s + r[k], 0))}</td>
                  ))}
                  <td style={{ padding: "9px 12px", textAlign: "right", color: C.textFaint }}>—</td>
                </tr>
              </BaseTable>
            )}
          </div>
        </Card>
      )}

      {activeReport === "audit" && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.amber }}>🔍 Daily Audit Report</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Production · Issuance · Return · Damage · Closing</div>
            </div>
            {auditData.length > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={downloadAuditCSV} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ CSV</button>
                <button onClick={downloadAuditPDF} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ PDF</button>
              </div>
            )}
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
              {[["Total Consumed", totalCons, C.red], ["Total Damaged", totalDmg, C.amber], ["Total Moved", totalMov, C.orange]].map(([l, v, c]) => (
                <StatBox key={l} label={l} value={v} color={c} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.border}` }}>
                {[["ALL", "Both"], ["KHI", "🏙️ KHI"], ["LHE", "🌆 LHE"]].map(([v, l]) => (
                  <div key={v} onClick={() => setFSite(v)} style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", cursor: "pointer", fontSize: 11, fontWeight: 600, background: fSite === v ? C.navy : "#fff", color: fSite === v ? "#fff" : C.textMid }}>{l}</div>
                ))}
              </div>
              {[["Card Type", fCT, setFCT, ["", "DEBIT", "CREDIT"], ["All", "DEBIT", "CREDIT"]], ["Segment", fSeg, setFSeg, ["", "NTB", "ETB", "RENEWAL"], ["All", "NTB", "ETB", "RENEWAL"]], ["Inv Type", fInv, setFInv, ["", "PLASTIC", "MAILER", "ENVELOPE"], ["All", "PLASTIC", "MAILER", "ENVELOPE"]]].map(([lbl, v, s, opts, labels]) => (
                <FormField key={lbl} label={lbl}>
                  <select value={v} onChange={e => s(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }}>
                    {labels.map((l, i) => <option key={i} value={opts[i]}>{l}</option>)}
                  </select>
                </FormField>
              ))}
              {[["From", fFrom, setFFrom], ["To", fTo, setFTo]].map(([lbl, v, s]) => (
                <FormField key={lbl} label={lbl}><input type="date" value={v} onChange={e => s(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} /></FormField>
              ))}
              <button onClick={() => { setFCT(""); setFSeg(""); setFInv(""); setFBatch(""); setFFrom(""); setFTo(""); setFSite("ALL"); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.textMuted }}>Clear</button>
            </div>

            {auditData.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textFaint, fontSize: 13, background: C.surface, borderRadius: 10 }}>No entries match the selected filters.</div>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: C.navy }}>
                      {[
                        "Plastic Type", "Opening Plastic Production Status", "Daily Production Status", "Total Status for Production",
                        "Issuance Card from Vault", "Extra Issuance Card from Vault", "Total Issuance Card",
                        "Daily Return Issuance", "Return Extra Issuance", "Total Return Issuance",
                        "Physical Damaged Cards", "Total Plastic Production", "Total Plastic Consumption", "Closing Production Status",
                      ].map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", color: "rgba(255,255,255,.75)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", textAlign: i > 0 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.map((row, idx) => {
                      const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
                      const totalReturnIssuance = returnExtra;
                      const totalStatusProduction = row.opening + row.batchCount;
                      const totalIssuanceCard = row.issuanceBatch + row.extraCount;
                      const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
                      const totalPlasticConsumption = row.damaged + totalPlasticProduction;
                      const closingProductionStatus = totalStatusProduction - totalPlasticProduction;

                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "#fff" : C.surface }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{row.plasticCategory}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.textMid }}>{fmt(row.opening)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.blue }}>{fmt(row.batchCount)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.navy }}>{fmt(totalStatusProduction)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.blue }}>{fmt(row.issuanceBatch)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.purple }}>{fmt(row.extraCount)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.text, background: C.greenLight }}>{fmt(totalIssuanceCard)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.textFaint }}>—</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.green }}>{fmt(returnExtra)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.green }}>{fmt(totalReturnIssuance)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: row.damaged > 0 ? C.red : C.border }}>{row.damaged > 0 ? fmt(row.damaged) : "—"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.text }}>{fmt(totalPlasticProduction)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: C.amber }}>{fmt(totalPlasticConsumption)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.navy, background: C.greenLight }}>{fmt(closingProductionStatus)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.navy }}>
                      {(() => {
                        const totals = auditData.reduce((t, row) => {
                          const returnExtra = returnByPlastic[row.plasticCategory]?.extraReturn || 0;
                          const totalStatusProduction = row.opening + row.batchCount;
                          const totalIssuanceCard = row.issuanceBatch + row.extraCount;
                          const totalReturnIssuance = returnExtra;
                          const totalPlasticProduction = totalStatusProduction - totalIssuanceCard - totalReturnIssuance - row.damaged;
                          const totalPlasticConsumption = row.damaged + totalPlasticProduction;
                          const closingProductionStatus = totalStatusProduction - totalPlasticProduction;
                          return {
                            opening: t.opening + row.opening, batchCount: t.batchCount + row.batchCount,
                            totalStatusProduction: t.totalStatusProduction + totalStatusProduction,
                            issuanceBatch: t.issuanceBatch + row.issuanceBatch, extraCount: t.extraCount + row.extraCount,
                            totalIssuanceCard: t.totalIssuanceCard + totalIssuanceCard, returnExtra: t.returnExtra + returnExtra,
                            totalReturnIssuance: t.totalReturnIssuance + totalReturnIssuance, damaged: t.damaged + row.damaged,
                            totalPlasticProduction: t.totalPlasticProduction + totalPlasticProduction,
                            totalPlasticConsumption: t.totalPlasticConsumption + totalPlasticConsumption,
                            closingProductionStatus: t.closingProductionStatus + closingProductionStatus,
                          };
                        }, { opening: 0, batchCount: 0, totalStatusProduction: 0, issuanceBatch: 0, extraCount: 0, totalIssuanceCard: 0, returnExtra: 0, totalReturnIssuance: 0, damaged: 0, totalPlasticProduction: 0, totalPlasticConsumption: 0, closingProductionStatus: 0 });

                        return [
                          <td key="label" style={{ padding: "10px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>TOTAL</td>,
                          ...[totals.opening, totals.batchCount, totals.totalStatusProduction, totals.issuanceBatch, totals.extraCount, totals.totalIssuanceCard, 0, totals.returnExtra, totals.totalReturnIssuance, totals.damaged, totals.totalPlasticProduction, totals.totalPlasticConsumption, totals.closingProductionStatus].map((v, i) => (
                            <td key={i} style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: i === 6 ? "rgba(255,255,255,.4)" : "#fff" }}>{i === 6 ? "—" : fmt(v)}</td>
                          ))
                        ];
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeReport === "range" && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.purple }}>📊 Range Report — KHI + LHR (All Sites)</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>Opening · Stock Received · Consumption · Closing — DEBIT + CREDIT</div>
            </div>
            {rangeData.length > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={downloadRangeCSV} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ CSV</button>
                <button onClick={downloadRangePDF} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: C.red, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ PDF</button>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", background: C.surface }}>
            {[["From", rangeFrom, setRangeFrom], ["To", rangeTo, setRangeTo]].map(([lbl, v, s]) => (
              <div key={lbl} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, textTransform: "uppercase" }}>{lbl}</label>
                <input type="date" value={v} onChange={e => s(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none" }} />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: C.textFaint, textTransform: "uppercase" }}>Plastic Type</label>
              <select value={rangeCat} onChange={e => setRangeCat(e.target.value)} style={{ height: 34, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", minWidth: 180 }}>
                <option value="">— All Types —</option>
                {rangePlasticCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={() => { setRangeFrom(""); setRangeTo(""); setRangeCat(""); }} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.textMuted, alignSelf: "flex-end" }}>Clear</button>
          </div>

          {rangeData.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
              {[["Opening", rangeTotals.opening, C.textMid], ["Stock Received", rangeTotals.received, C.green], ["Consumption", rangeTotals.consumed, C.red], ["Closing", rangeTotals.closing, C.navy]].map(([l, v, c]) => (
                <StatBox key={l} label={l} value={v} color={c} />
              ))}
            </div>
          )}

          {!rangeFrom && !rangeTo
            ? <div style={{ padding: 36, textAlign: "center", color: C.textFaint, fontSize: 13, background: C.surface }}>Select a date range to generate the report.</div>
            : rangeData.length === 0
              ? <div style={{ padding: 36, textAlign: "center", color: C.textFaint, fontSize: 13 }}>No entries found for selected range.</div>
              : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.navy }}>
                        {["Code", "Product", "Opening", "Stock Received", "Consumption", "Closing"].map((h, i) => (
                          <th key={i} style={{ padding: "9px 12px", color: "rgba(255,255,255,.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: i > 1 ? "right" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groups = {};
                        rangeData.forEach(r => { if (!groups[r.cardType]) groups[r.cardType] = []; groups[r.cardType].push(r); });
                        return Object.entries(groups).map(([ct, rows]) => (
                          <React.Fragment key={ct}>
                            <tr style={{ background: "#334155" }}>
                              <td colSpan={6} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                                {ct === "DEBIT" ? "💳" : "💎"} {ct} CARDS
                              </td>
                            </tr>
                            {rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? "#fff" : C.surface }}>
                                <td style={{ padding: "8px 12px", fontSize: 10, color: C.textMuted }}>{row.cardType}</td>
                                <td style={{ padding: "8px 12px", fontWeight: 600, color: C.text }}>{row.plasticCategory}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: C.textMid }}>{fmt(row.opening)}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: row.received > 0 ? C.green : C.border }}>{row.received > 0 ? fmt(row.received) : "—"}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: C.red }}>{fmt(row.consumed)}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.navy, background: C.greenLight }}>{fmt(row.closing)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: C.surface, borderTop: `1px solid ${C.borderStrong}` }}>
                              <td colSpan={2} style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, color: C.text }}>↳ {ct} subtotal</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.textMid }}>{fmt(rows.reduce((s, r) => s + r.opening, 0))}</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.green }}>{fmt(rows.reduce((s, r) => s + r.received, 0))}</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.red }}>{fmt(rows.reduce((s, r) => s + r.consumed, 0))}</td>
                              <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: C.navy, background: C.greenLight }}>{fmt(rows.reduce((s, r) => s + r.closing, 0))}</td>
                            </tr>
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: C.navy }}>
                        <td colSpan={2} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#fff" }}>TOTAL — {rangeData.length} products</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#fff" }}>{fmt(rangeTotals.opening)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#34D399" }}>{fmt(rangeTotals.received)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "#F87171" }}>{fmt(rangeTotals.consumed)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#34D399" }}>{fmt(rangeTotals.closing)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
          }
        </Card>
      )}
    </div>
  );
}
