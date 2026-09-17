import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { C } from "../../constants/color";
import { CAT, INVENTORY_TYPES, VENDORS } from "../../constants/catalog";
import { today, fmt, fmtDate, ckCatSite } from "../../utils/helper";
import { parseIrisExcel, parseDailyStockExcel } from "../../utils/irisEngine";
import useLS from "../../hooks/useLS";
import { Card, CardHeader } from "../ui/Card";
import { Pill, SegPill } from "../ui/Pill";
import Field from "../ui/Field";
import Select from "../ui/Select";
import NumInput from "../ui/NumInput";
import SegBtn from "../ui/SegBtn";
import SharedSyncBanner from "../layout/SharedSyncBanner";

import { ICONS } from "../../constants/icons";
import axios from "axios";

const API = "/api";

/* =========================================================
   MEMOIZED COMPONENTS FOR VM PERFORMANCE
========================================================= */

// 1. Memoized Modal to prevent re-rendering during state changes in parent
const TransitModal = memo(function TransitModal({
  qty,
  subProduct,
  scheme,
  segment,
  onConfirm,
  onCancel,
}) {
  const [note, setNote] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,22,40,.6)",
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <Card
        style={{
          width: 460,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: C.orange,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(255,255,255,.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🚚
          </div>

          <ICONS.transit size={18} strokeWidth={1.5} color="#fff" />

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Move to Lahore
            </div>

            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,.7)",
                marginTop: 2,
              }}
            >
              KHI → LHE Transfer
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <div
            style={{
              background: C.orangeLight,
              border: `1.5px solid ${C.orangeBorder}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {[
                ["Sub Product", subProduct],
                ["Scheme", scheme],
                ["Segment", segment],
                ["Quantity", fmt(qty) + " units"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: 9,
                      color: C.orange,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      marginTop: 2,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Transit Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Courier AWB#12345"
              style={{
                height: 42,
                width: "100%",
                border: `1.5px solid ${C.border}`,
                borderRadius: 8,
                padding: "0 12px",
                fontSize: 13,
                outline: "none",
              }}
            />
          </Field>
        </div>

        <div
          style={{
            padding: "14px 24px",
            borderTop: `1px solid ${C.border}`,
            background: C.surface,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: 8,
              border: `1.5px solid ${C.border}`,
              background: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              color: C.textMuted,
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(note)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ICONS.transit size={13} strokeWidth={1.5} />
            Confirm Transfer
          </button>
        </div>
      </Card>
    </div>
  );
});

// 2. Memoized Single Table Row to prevent full table re-renders on selection
const DailyRowItem = memo(function DailyRowItem({
  row,
  idx,
  isSel,
  isMatch,
  onApply,
}) {
  return (
    <tr
      onClick={() => onApply(row)}
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: isSel
          ? C.purpleLight
          : isMatch
          ? C.greenLight
          : idx % 2 === 0
          ? "#fff"
          : C.surface,
        cursor: "pointer",
        outline: isSel
          ? `2px solid ${C.purple}`
          : isMatch
          ? `1.5px solid ${C.greenBorder}`
          : "none",
        outlineOffset: -2,
      }}
    >
      <td
        style={{
          padding: "8px 12px",
          fontWeight: isSel ? 600 : 400,
          color: C.text,
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.irisDesc}
      >
        {isSel && (
          <ICONS.success
            size={12}
            strokeWidth={1.5}
            color={C.purple}
            style={{ marginRight: 4 }}
          />
        )}
        {row.irisDesc}
      </td>

      <td style={{ padding: "8px 12px" }}>
        <SegPill seg={row.segment} />
      </td>

      <td
        style={{
          padding: "8px 12px",
          color: C.blue,
          fontWeight: 600,
          fontSize: 10,
        }}
      >
        {row.batchNumber || "—"}
      </td>

      {[
        [row.stockReceived, C.green],
        [row.batchCount, C.blue],
        [row.extraCount, C.purple],
        [row.damaged, C.amber],
        [row.transferred, C.orange],
      ].map(([value, color], i) => (
        <td
          key={i}
          style={{
            padding: "8px 12px",
            textAlign: "right",
            fontWeight: 600,
            color: value > 0 ? color : C.border,
            fontSize: 11,
          }}
        >
          {value > 0 ? Number(value).toLocaleString() : "—"}
        </td>
      ))}

      <td style={{ padding: "8px 12px" }}>
        <Pill
          label={row.matched ? " Matched" : "No match"}
          color={row.matched ? C.green : C.red}
          bg={row.matched ? C.greenLight : C.redLight}
          border={row.matched ? C.greenBorder : C.redBorder}
        />
      </td>

      <td style={{ padding: "8px 12px" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApply(row);
          }}
          style={{
            height: 24,
            padding: "0 10px",
            borderRadius: 6,
            border: "none",
            background: isSel ? C.purple : C.purpleLight,
            color: isSel ? "#fff" : C.purple,
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isSel ? "✓ Applied" : "Apply"}
        </button>
      </td>
    </tr>
  );
});

/* =========================================================
   ENTRY TAB MAIN COMPONENT
========================================================= */

export default function EntryTab({
  entries,
  setEntries,
  closing,
  setClosing,
  toast,
  showAlert,
  transitRecords,
  setTransitRecords,
  currentSite,
  setOrders,
  irisRecords,
  setIrisRecords,
  irisFiles,
  setIrisFiles,
  dailyRows,
  setDailyRows,
  dailyFileName,
  setDailyFileName,
}) {
  const [date, setDate] = useState(today());
  const [invType, setInvType] = useLS("ei_invType", "PLASTIC");

  const [ct, setCt] = useLS("ei_ct", "");
  const [sc, setSc] = useLS("ei_sc", "");
  const [cat, setCat] = useLS("ei_cat", "");

  const [sub, setSub] = useState("");
  const [seg, setSeg] = useState("");
  const [batchNumber, setBatchNumber] = useState("");

  const [vendors, setVendors] = useState([{ id: 1, name: "", qty: 0 }]);

  const [cons, setCons] = useState(0);
  const [dmg, setDmg] = useState(0);
  const [mov, setMov] = useState(0);
  const [extraCount, setExtraCount] = useState(0);

  const [pageSize, setPageSize] = useState("");

  const [showTransit, setShowTransit] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);

  const [irisLoading, setIrisLoading] = useState(false);
  const [consFromIris, setConsFromIris] = useState(false);
  const [irisMatches, setIrisMatches] = useState([]);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [selDailyRow, setSelDailyRow] = useState(null);

  const [bulkSaving, setBulkSaving] = useState(false);

  const curCat = CAT[invType] || {};

  const schemes = useMemo(
    () => (ct ? Object.keys(curCat[ct] || {}) : []),
    [ct, curCat]
  );

  const cats = useMemo(
    () => (sc ? Object.keys((curCat[ct] || {})[sc] || {}) : []),
    [sc, ct, curCat]
  );

  const subs = useMemo(
    () => (cat ? ((curCat[ct] || {})[sc] || {})[cat] || [] : []),
    [cat, sc, ct, curCat]
  );

  /* =========================================================
     OPENING BALANCE
  ========================================================= */

  const obRec = useMemo(() => {
    if (!ct || !sc || !cat) return null;
    const siteKey = ckCatSite(ct, sc, cat, invType, currentSite);
    return closing[siteKey] || null;
  }, [ct, sc, cat, invType, closing, currentSite]);

  const ob = useMemo(() => (obRec ? Math.max(0, obRec.value) : 0), [obRec]);

  /* =========================================================
     CALCULATIONS (MEMOIZED)
  ========================================================= */

  const totalRecv = useMemo(() => {
    return vendors.reduce(
      (sum, vendor) => sum + (parseInt(vendor.qty, 10) || 0),
      0
    );
  }, [vendors]);

  const movVal = useMemo(() => parseInt(mov, 10) || 0, [mov]);

  const cl = useMemo(() => {
    return (
      ob +
      totalRecv -
      (parseInt(cons, 10) || 0) -
      (parseInt(dmg, 10) || 0) -
      movVal
    );
  }, [ob, totalRecv, cons, dmg, movVal]);

  /* =========================================================
     HANDLERS & HANDLER OPTIMIZATIONS FOR VM PERFORMANCE
  ========================================================= */

  // Optimized Vendor inputs to avoid recreating dynamic objects on every keystroke
  const handleVendorNameChange = useCallback((index, name) => {
    setVendors((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, name } : row
      )
    );
  }, []);

  const handleVendorQtyChange = useCallback((index, value) => {
    setVendors((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, qty: value } : row
      )
    );
  }, []);

  const handleRemoveVendor = useCallback((index) => {
    setVendors((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const handleAddVendor = useCallback(() => {
    setVendors((prev) => [...prev, { id: Date.now(), name: "", qty: 0 }]);
  }, []);

  // Optimized Daily Row Selection
  const applyDailyRow = useCallback(
    (row) => {
      if (row.cardType) setCt(row.cardType);
      if (row.scheme) setSc(row.scheme);
      if (row.plasticCategory) setCat(row.plasticCategory);
      if (row.subProduct) setSub(row.subProduct);

      setSelDailyRow(row);
      setVendors([{ id: Date.now(), name: "", qty: row.stockReceived || 0 }]);
      setCons(row.batchCount || 0);
      setConsFromIris((row.batchCount || 0) > 0);
      setExtraCount(row.extraCount || 0);
      setDmg(row.damaged || 0);
      setMov(row.transferred || 0);

      if (row.segment) setSeg(row.segment);
      if (row.batchNumber) setBatchNumber(row.batchNumber);

      toast(`Filled from: "${row.irisDesc}"`, "success");
    },
    [setCt, setSc, setCat, setSub, toast]
  );

  /* =========================================================
     IRIS AUTO-FILL
  ========================================================= */

  useEffect(() => {
    if (!sub || !Object.keys(irisRecords || {}).length) {
      setIrisMatches([]);
      return;
    }

    const matches = Object.values(irisRecords).filter(
      (record) => record.subProduct === sub.toUpperCase()
    );

    setIrisMatches(matches);

    if (matches.length > 0) {
      const total = matches.reduce(
        (sum, record) => sum + (Number(record.count) || 0),
        0
      );

      if (total > 0) {
        setCons(total);
        setConsFromIris(true);
      }

      const batches = [
        ...new Set(
          matches
            .filter((record) => record.batchNumber)
            .map((record) => record.batchNumber)
        ),
      ];

      if (batches.length === 1) {
        setBatchNumber(batches[0]);
        setSeg("NTB");
      }
    } else {
      setConsFromIris(false);
    }
  }, [sub, irisRecords]);

  /* =========================================================
     DAILY ROW AUTO-FILL
  ========================================================= */

  useEffect(() => {
    if (!sub || dailyRows.length === 0 || selDailyRow) return;

    const matches = dailyRows.filter((row) => row.subProduct === sub);
    if (matches.length !== 1) return;

    applyDailyRow(matches[0]);
  }, [sub, dailyRows, selDailyRow, applyDailyRow]);

  /* =========================================================
     NORMALIZERS & BATCH OPTIONS
  ========================================================= */

  const normalizeEntry = useCallback((e) => {
    return {
      id: e.id,
      date: e.date,
      site: e.site,
      invType: e.inv_type,
      cardType: e.card_type,
      scheme: e.scheme,
      plasticCategory: e.plastic_category,
      subProduct: e.sub_product,
      pageSize: e.page_size,
      segment: e.segment,
      batchNumber: e.batch_number,
      openingBalance: e.opening_balance,
      receivedFromVendor: e.received_from_vendor,
      totalConsumption: e.batch_count,
      extraCount: e.extra_count,
      damaged: e.damaged,
      movedToOtherSite: e.moved_to_other_site,
      closingBalance: e.closing_balance,
      savedAt: e.saved_at,
      sourceExcel: e.source_excel,
    };
  }, []);

  const irisBatchOptions = useMemo(() => {
    const detected = [
      ...new Set(
        Object.values(irisRecords || {})
          .filter((r) => r.ntbBatch)
          .map((r) => r.ntbBatch)
      ),
    ];

    const defaults = [
      "NTB Batch 1",
      "NTB Batch 2",
      "NTB Batch 3",
      "NTB Batch 4",
      "NTB Batch 5",
    ];

    return [...new Set([...defaults, ...detected])].sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || 0, 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || 0, 10);
      return na - nb;
    });
  }, [irisRecords]);

  const etbBatchOptions = useMemo(() => {
    return [
      "ETB Batch 1",
      "ETB Batch 2",
      "ETB Batch 3",
      "ETB Batch 4",
      "ETB Batch 5",
    ];
  }, []);

  /* =========================================================
     RESET
  ========================================================= */

  const reset = useCallback(() => {
    setCt("");
    setSc("");
    setCat("");
    setSub("");
    setSeg("");
    setBatchNumber("");
    setVendors([{ id: 1, name: "", qty: 0 }]);
    setCons(0);
    setDmg(0);
    setMov(0);
    setExtraCount(0);
    setPageSize("");
    setConsFromIris(false);
    setIrisMatches([]);
    setSelDailyRow(null);
  }, [setCt, setSc, setCat]);

  /* =========================================================
     FILE UPLOADS (NON-BLOCKING ASYNC HANDLERS)
  ========================================================= */

  const handleIrisUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIrisLoading(true);

    // Yield control to UI main thread so VM renders loading state immediately
    await new Promise((r) => setTimeout(r, 10));

    try {
      const { records } = await parseIrisExcel(file, irisRecords);
      const total = Object.keys(records).length;
      const matched = Object.values(records).filter((r) => r.matched).length;

      setIrisRecords(records);
      setIrisFiles((prev) => [...prev.filter((f) => f !== file.name), file.name]);

      if (sub) {
        const m2 = Object.values(records).filter(
          (r) => r.subProduct === sub.toUpperCase()
        );
        setIrisMatches(m2);

        if (m2.length > 0) {
          const t2 = m2.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
          if (t2 > 0) {
            setCons(t2);
            setConsFromIris(true);
          }
        }
      }

      const batches = [
        ...new Set(
          Object.values(records)
            .filter((r) => r.ntbBatch)
            .map((r) => r.ntbBatch)
        ),
      ].sort();

      showAlert({
        type: "success",
        title: "IRIS Excel Loaded",
        msg: `<strong>${file.name}</strong><br/>Mapped: <strong>${matched}/${total}</strong>${
          batches.length > 0
            ? `<br/>Batches: <strong>${batches.join(", ")}</strong>`
            : ""
        }`,
      });

      toast(`${file.name} loaded — ${matched}/${total} mapped.`, "success");
    } catch (err) {
      showAlert({
        type: "error",
        title: "Import Failed",
        msg: err.message,
      });
    } finally {
      setIrisLoading(false);
      e.target.value = "";
    }
  };

  const handleDailyUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDailyLoading(true);

    // Yield control to UI main thread for slow VMs
    await new Promise((r) => setTimeout(r, 10));

    try {
      const rows = await parseDailyStockExcel(file);

      if (!rows.length) {
        showAlert({
          type: "warn",
          title: "No Rows Found",
          msg: `No data in <strong>${file.name}</strong>.`,
        });
        return;
      }

      setDailyRows((prev) => {
        const map = new Map(prev.map((r) => [r.irisDesc.toUpperCase(), r]));
        rows.forEach((r) => map.set(r.irisDesc.toUpperCase(), r));
        return Array.from(map.values());
      });

      setDailyFileName((prev) => {
        const names = prev ? prev.split(", ").filter(Boolean) : [];
        if (!names.includes(file.name)) names.push(file.name);
        return names.join(", ");
      });

      setSelDailyRow(null);

      const matchedCount = rows.filter((r) => r.matched).length;

      showAlert({
        type: "success",
        title: "Daily Stock Loaded",
        msg: `<strong>${file.name}</strong><br/><strong>${rows.length} rows</strong> · <strong>${matchedCount} matched</strong>`,
      });

      toast(`${rows.length} rows loaded.`, "success");
    } catch (err) {
      showAlert({
        type: "error",
        title: "Import Failed",
        msg: err.message,
      });
    } finally {
      setDailyLoading(false);
      e.target.value = "";
    }
  };

  /* =========================================================
     SAVE ACTIONS
  ========================================================= */

  const performSave = async (entry, transitNote) => {
    try {
      if (entry.closingBalance < 0) {
        const proceed = window.confirm(
          `Warning: this entry would produce a NEGATIVE closing balance (${entry.closingBalance}) for ${
            entry.subProduct || entry.plasticCategory
          }.\n\nThis usually means more was consumed/moved than what's actually in stock. Proceed anyway?`
        );
        if (!proceed) return;
      }

      const res = await axios.post(`${API}/entries`, entry);
      if (!res.data.success) return;

      const savedEntry = { ...entry, id: res.data.entryId };

      setEntries((prev) => [...(prev || []), savedEntry]);
      toast("Saved to DB successfully!", "success");

      const catKey = ckCatSite(
        entry.cardType,
        entry.scheme,
        entry.plasticCategory,
        entry.invType,
        currentSite
      );

      setClosing((prev) => ({
        ...prev,
        [catKey]: {
          value: entry.closingBalance,
          updatedAt: new Date().toISOString(),
          date: entry.date,
          updatedBy: currentSite,
        },
      }));

      await axios.post(`${API}/closing-balances`, {
        balanceKey: catKey,
        value: entry.closingBalance,
        entryDate: entry.date,
        updatedBy: currentSite,
      });

      if (entry.movedToOtherSite > 0 && transitNote !== null) {
        try {
          const trRes = await axios.post(`${API}/transit-records`, {
            entryId: savedEntry.id,
            fromSite: currentSite,
            toSite: currentSite === "KHI" ? "LHE" : "KHI",
            date: entry.date,
            quantity: entry.movedToOtherSite,
            note: transitNote,
            status: "IN_TRANSIT",
          });

          setTransitRecords((prev) => [
            ...(prev || []),
            {
              id: trRes.data.id,
              entryId: savedEntry.id,
              fromSite: currentSite,
              toSite: currentSite === "KHI" ? "LHE" : "KHI",
              date: entry.date,
              invType: entry.invType,
              cardType: entry.cardType,
              scheme: entry.scheme,
              plasticCategory: entry.plasticCategory,
              subProduct: entry.subProduct,
              segment: entry.segment,
              quantity: entry.movedToOtherSite,
              note: transitNote,
              status: "IN_TRANSIT",
              createdAt: trRes.data.createdAt,
              deliveredAt: null,
            },
          ]);
        } catch (err) {
          console.error(
            "Failed to save transit record:",
            err.response?.data || err.message
          );
        }

        showAlert({
          type: "transit",
          title: "Dispatched to Lahore 🚚",
          msg: `<strong>${fmt(entry.movedToOtherSite)} units</strong> of <strong>${
            entry.subProduct || entry.plasticCategory
          }</strong> — In Transit.`,
          buttons: [{ label: "OK", type: "primary", color: C.orange }],
        });

        toast(`${fmt(entry.movedToOtherSite)} units dispatched.`, "transit");
      } else {
        toast(
          `Saved · Closing: ${fmt(entry.closingBalance)} units.`,
          entry.closingBalance < 0 ? "warn" : "success"
        );
      }

      reset();
    } catch (err) {
      showAlert({
        type: "error",
        title: "Backend Error",
        msg: err.response?.data?.message || err.message,
      });
    }
  };

  const save = async () => {
    if (!date) return showAlert({ type: "error", title: "Missing Date" });
    if (invType === "PLASTIC" && !sub) {
      return showAlert({ type: "error", title: "Missing Sub Product" });
    }
    if (invType === "MAILER" && !pageSize) {
      return showAlert({
        type: "error",
        title: "Missing Page Size",
        msg: "Please select A4 or Legal.",
      });
    }

    const entry = {
      date,
      invType,
      cardType: ct,
      scheme: sc,
      plasticCategory: cat,
      subProduct: invType === "PLASTIC" ? sub : null,
      pageSize: invType === "MAILER" ? pageSize : null,
      segment: seg,
      batchNumber: seg === "NTB" || seg === "ETB" ? batchNumber : null,
      openingBalance: ob,
      receivedFromVendor: totalRecv,
      vendors: vendors.filter((v) => Number(v.qty) > 0),
      batchCount: Number(cons) || 0,
      totalConsumption: Number(cons) || 0,
      extraCount: Number(extraCount) || 0,
      damaged: Number(dmg) || 0,
      movedToOtherSite: Number(mov) || 0,
      closingBalance: cl,
      site: currentSite,
      savedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    };

    if (entry.movedToOtherSite > 0) {
      setPendingEntry(entry);
      setShowTransit(true);
      return;
    }

    await performSave(entry, null);
  };

  const bulkSave = useCallback(async () => {
    const matched = dailyRows.filter(
      (row) =>
        row.matched &&
        row.subProduct &&
        row.cardType &&
        row.scheme &&
        row.plasticCategory
    );

    if (!matched.length) {
      showAlert({
        type: "warn",
        title: "No Matched Rows",
        msg: "No rows matched.",
      });
      return;
    }

    if (bulkSaving) return;
    setBulkSaving(true);

    const groupedRows = {};

    matched.forEach((row) => {
      const segR = row.segment || "ETB";
      const key = `${row.cardType}|${row.scheme}|${row.plasticCategory}|${row.subProduct}|${segR}`;

      if (!groupedRows[key]) {
        groupedRows[key] = {
          cardType: row.cardType,
          scheme: row.scheme,
          plasticCategory: row.plasticCategory,
          subProduct: row.subProduct,
          pageSize: row.pageSize || null,
          segment: segR,
          batchNumber: row.batchNumber || null,
          stockReceived: Number(row.stockReceived) || 0,
          batchCount: Number(row.batchCount) || 0,
          extraCount: Number(row.extraCount) || 0,
          damaged: Number(row.damaged) || 0,
          transferred: Number(row.transferred) || 0,
          sourceExcel: dailyFileName,
        };
      } else {
        groupedRows[key].stockReceived += Number(row.stockReceived) || 0;
        groupedRows[key].batchCount += Number(row.batchCount) || 0;
        groupedRows[key].extraCount += Number(row.extraCount) || 0;
        groupedRows[key].damaged += Number(row.damaged) || 0;
        groupedRows[key].transferred += Number(row.transferred) || 0;
      }
    });

    try {
      const res = await axios.post(`${API}/entries/bulk`, {
        date,
        site: currentSite,
        invType,
        rows: Object.values(groupedRows),
      });

      if (!res.data.success) {
        showAlert({
          type: "error",
          title: "Bulk Save Failed",
          msg: res.data.message || "Unknown error.",
        });
        return;
      }

      const {
        saved,
        merged,
        skipped,
        closingBalances,
        transitRecords: newTransits,
        entries: newEntries,
      } = res.data;

      setClosing((prev) => {
        const next = { ...prev };
        Object.entries(closingBalances || {}).forEach(([key, value]) => {
          next[key] = {
            value,
            updatedAt: new Date().toISOString(),
            date,
            updatedBy: currentSite,
          };
        });
        return next;
      });

      if (newTransits && newTransits.length) {
        setTransitRecords((prev) => [
          ...(prev || []),
          ...newTransits.map((t) => ({
            ...t,
            createdAt: t.createdAt || new Date().toISOString(),
            deliveredAt: t.deliveredAt || null,
          })),
        ]);
      }

      if (Array.isArray(newEntries) && newEntries.length) {
        const normalized = newEntries.map(normalizeEntry);
        setEntries((prev) => {
          const existing = prev || [];
          const existingIds = new Set(existing.map((e) => e.id));
          const additions = normalized.filter((e) => !existingIds.has(e.id));
          return [...existing, ...additions];
        });
      }

      showAlert({
        type: "success",
        title: "Bulk Save Complete",
        msg: `<strong>${saved} new entries</strong> saved.<br/><strong>${merged} entries</strong> merged into existing.${
          skipped > 0 ? `<br/>${skipped} skipped.` : ""
        }`,
      });

      toast(`${saved} saved, ${merged} merged.`, "success");
    } catch (err) {
      console.error("Bulk save failed:", err.response?.data || err.message);
      showAlert({
        type: "error",
        title: "Backend Error",
        msg: err.response?.data?.message || err.message,
      });
    } finally {
      setBulkSaving(false);
      setDailyRows([]);
      setDailyFileName("");
      setSelDailyRow(null);
    }
  }, [
    dailyRows,
    date,
    currentSite,
    dailyFileName,
    invType,
    bulkSaving,
    setClosing,
    setTransitRecords,
    setEntries,
    normalizeEntry,
    showAlert,
    toast,
    setDailyRows,
    setDailyFileName,
  ]);

  /* =========================================================
     ICONS & MODAL CONFIRMS
  ========================================================= */

  const INV_ICONS = {
    PLASTIC: ICONS.plastic,
    MAILER: ICONS.mailer,
    ENVELOPE: ICONS.envelope,
  };

  const CARD_TYPE_ICONS = {
    DEBIT: ICONS.plastic,
    CREDIT: ICONS.credit,
  };

  const UploadIcon = ICONS.dailyStock;

  const handleTransitConfirm = useCallback(
    (note) => {
      setShowTransit(false);
      performSave(pendingEntry, note);
      setPendingEntry(null);
    },
    [pendingEntry]
  );

  const handleTransitCancel = useCallback(() => {
    setShowTransit(false);
    setPendingEntry(null);
  }, []);

  return (
    <div>
      {/* TRANSIT MODAL */}
      {showTransit && pendingEntry && (
        <TransitModal
          qty={pendingEntry.movedToOtherSite}
          subProduct={pendingEntry.subProduct}
          scheme={pendingEntry.scheme}
          segment={pendingEntry.segment}
          onConfirm={handleTransitConfirm}
          onCancel={handleTransitCancel}
        />
      )}

      {/* PAGE HEADER */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>
            New Daily Entry
          </h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            Record daily inventory movements — Plastic, Mailer & Envelope.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <label
            style={{
              height: 48,
              padding: "0 22px 0 8px",
              borderRadius: 12,
              border: `1.5px solid ${
                dailyRows.length > 0 ? C.purpleBorder : C.border
              }`,
              background:
                dailyRows.length > 0
                  ? `linear-gradient(135deg, ${C.purple} 0%, #7C3AED 100%)`
                  : "#fff",
              color: dailyRows.length > 0 ? "#fff" : C.textMid,
              fontSize: 13,
              fontWeight: 700,
              cursor: dailyLoading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow:
                dailyRows.length > 0
                  ? "0 4px 14px rgba(139,92,246,.35)"
                  : "0 1px 3px rgba(0,0,0,.06)",
              transition: "all .2s ease",
              opacity: dailyLoading ? 0.7 : 1,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background:
                  dailyRows.length > 0
                    ? "rgba(255,255,255,.2)"
                    : C.purpleLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              <UploadIcon
                size={16}
                strokeWidth={1.5}
                color={dailyRows.length > 0 ? "#fff" : C.purple}
              />
            </span>

            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                lineHeight: 1.2,
              }}
            >
              <span>{dailyLoading ? "Reading file…" : "Upload Daily Stock"}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color:
                    dailyRows.length > 0
                      ? "rgba(255,255,255,.8)"
                      : C.textFaint,
                }}
              >
                {dailyRows.length > 0
                  ? `${dailyRows.length} rows loaded`
                  : "Excel / CSV"}
              </span>
            </span>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleDailyUpload}
              style={{ display: "none" }}
              disabled={dailyLoading}
            />
          </label>

          {dailyFileName &&
            dailyFileName
              .split(", ")
              .filter(Boolean)
              .map((fileName) => (
                <div
                  key={fileName}
                  style={{
                    fontSize: 11,
                    color: C.purple,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: C.purpleLight,
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: `1px solid ${C.purpleBorder}`,
                  }}
                >
                  <span
                    style={{
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fileName}
                  </span>

                  <span
                    onClick={() => {
                      setDailyRows([]);
                      setDailyFileName((prev) =>
                        prev
                          .split(", ")
                          .filter((n) => n !== fileName)
                          .join(", ")
                      );
                    }}
                    style={{
                      cursor: "pointer",
                      color: C.red,
                      fontWeight: 700,
                    }}
                  >
                    ✕
                  </span>
                </div>
              ))}
        </div>
      </div>

      <SharedSyncBanner currentSite={currentSite} />

      {/* DAILY STOCK TABLE (MEMOIZED ROWS) */}
      {dailyRows.length > 0 && (
        <Card style={{ marginBottom: 20, border: `1.5px solid ${C.purpleBorder}` }}>
          <div
            style={{
              padding: "12px 18px",
              background: C.purpleLight,
              borderBottom: `1px solid ${C.purpleBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.purple }}>
                Daily Stock — {dailyRows.length} rows ·{" "}
                {dailyRows.filter((r) => r.matched).length} matched
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.purple,
                  marginTop: 2,
                  opacity: 0.7,
                }}
              >
                {sub
                  ? selDailyRow
                    ? `Filled from: "${selDailyRow.irisDesc}"`
                    : "Click a row to fill"
                  : "Select sub-product to auto-fill"}
              </div>
            </div>

            <button
              onClick={() =>
                showAlert({
                  type: "info",
                  title: "Bulk Save?",
                  msg: `Save <strong>${
                    dailyRows.filter((r) => r.matched).length
                  } matched rows</strong> to shared history?`,
                  buttons: [
                    { label: "Cancel", type: "secondary" },
                    {
                      label: "Save All",
                      type: "primary",
                      color: C.purple,
                      onClick: bulkSave,
                    },
                  ],
                })
              }
              disabled={bulkSaving}
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: 8,
                border: "none",
                background: bulkSaving ? C.border : C.purple,
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: bulkSaving ? "not-allowed" : "pointer",
              }}
            >
              {bulkSaving ? "Saving..." : "Bulk Save"}
            </button>
          </div>

          <div
            style={{
              overflowX: "auto",
              maxHeight: 260,
              overflowY: "auto",
              willChange: "transform",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: C.purpleLight,
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {[
                    "IRIS Description",
                    "Seg",
                    "NTB Batch",
                    "Stock Rcvd",
                    "Batch Count",
                    "Extra",
                    "Dmg",
                    "Transfer",
                    "Match",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "8px 12px",
                        textAlign: i >= 3 && i <= 7 ? "right" : "left",
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.purple,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        borderBottom: `1px solid ${C.purpleBorder}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {dailyRows.map((row, idx) => {
                  const isSel = selDailyRow?.rowIndex === row.rowIndex;
                  const isMatch = !!(sub && row.subProduct === sub);

                  return (
                    <DailyRowItem
                      key={row.rowIndex || idx}
                      row={row}
                      idx={idx}
                      isSel={isSel}
                      isMatch={isMatch}
                      onApply={applyDailyRow}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* STEP 1 */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader
          step="1"
          title="Date, Inventory Type & Product Selection"
          sub="Date · Inventory Type · Card Type · Scheme · Category · Sub Product · Segment"
        />

        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Field label="Entry Date" req>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  height: 42,
                  width: "100%",
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "0 12px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </Field>

            <Field label="Inventory Type" req>
              <div style={{ display: "flex", gap: 8 }}>
                {INVENTORY_TYPES.map((type) => {
                  const COLS = {
                    PLASTIC: [C.blueLight, C.blueBorder, C.blue],
                    MAILER: [C.purpleLight, C.purpleBorder, C.purple],
                    ENVELOPE: [C.tealLight, C.tealBorder, C.teal],
                  };

                  const [bg, bd, tc] =
                    invType === type
                      ? COLS[type]
                      : [C.surface, C.border, C.textMuted];

                  const Icon = INV_ICONS[type];

                  return (
                    <div
                      key={type}
                      onClick={() => {
                        setInvType(type);
                        setCt("");
                        setSc("");
                        setCat("");
                        setSub("");
                      }}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        border: `1.5px solid ${bd}`,
                        background: bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        color: tc,
                        transition: "all .15s",
                      }}
                    >
                      <Icon size={13} />
                      {type}
                    </div>
                  );
                })}
              </div>
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Field label="Card Type" req>
              <div style={{ display: "flex", gap: 8 }}>
                {["DEBIT", "CREDIT"].map((type) => {
                  const selected = ct === type;
                  const typeColor = type === "DEBIT" ? C.blue : C.red;
                  const Icon = CARD_TYPE_ICONS[type];

                  return (
                    <div
                      key={type}
                      onClick={() => {
                        setCt(type);
                        setSc("");
                        setCat("");
                        setSub("");
                        setSeg("");
                      }}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        border: `1.5px solid ${
                          selected ? `${typeColor}80` : C.border
                        }`,
                        background: selected ? `${typeColor}15` : C.surface,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color: selected ? typeColor : C.textMuted,
                        transition: "all .15s",
                      }}
                    >
                      <Icon size={13} strokeWidth={1.5} />
                      {type}
                    </div>
                  );
                })}
              </div>
            </Field>

            <Field label="Scheme" req>
              <Select
                value={sc}
                onChange={(value) => {
                  setSc(value);
                  setCat("");
                  setSub("");
                }}
                options={schemes}
                placeholder="— Select Card Type first —"
                disabled={!ct}
              />
            </Field>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Field label="Plastic Category" req>
              <Select
                value={cat}
                onChange={(value) => {
                  setCat(value);
                  setSub("");
                }}
                options={cats}
                placeholder="— Select Scheme first —"
                disabled={!sc}
              />
            </Field>

            {invType === "PLASTIC" && (
              <Field label="Sub Product" req>
                <Select
                  value={sub}
                  onChange={(value) => {
                    setSub(value);
                    setSelDailyRow(null);
                  }}
                  options={subs}
                  placeholder="— Select Category first —"
                  disabled={!cat}
                />
              </Field>
            )}

            {invType === "MAILER" && (
              <Field label="Page Size" req hint="e.g. A4, Legal">
                <Select
                  value={pageSize}
                  onChange={setPageSize}
                  options={["A4", "Legal"]}
                  placeholder="— Select Page Size —"
                />
              </Field>
            )}
          </div>

          <Field label="Segment Type" req>
            <div style={{ display: "flex", gap: 8 }}>
              <SegBtn
                code="NTB"
                label="New To Bank"
                active={seg}
                onSelect={setSeg}
              />
              <SegBtn
                code="ETB"
                label="Existing To Bank"
                active={seg}
                onSelect={setSeg}
              />
              <SegBtn
                code="RENEWAL"
                label="Renewal"
                active={seg}
                onSelect={setSeg}
              />
            </div>
          </Field>

          {(seg === "NTB" || seg === "ETB") && (
            <div style={{ marginTop: 14 }}>
              <Field label={`${seg} Batch Number`} req>
                <Select
                  value={batchNumber}
                  onChange={setBatchNumber}
                  options={seg === "NTB" ? irisBatchOptions : etbBatchOptions}
                  placeholder={`— Select ${seg} Batch —`}
                />
              </Field>
            </div>
          )}

          {sub && irisFiles.length > 0 && irisMatches.length > 0 && (
            <div
              style={{
                marginTop: 16,
                background: C.greenLight,
                border: `1.5px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.green,
                  textTransform: "uppercase",
                  letterSpacing: ".7px",
                  marginBottom: 8,
                }}
              >
                IRIS Matched — {sub}
              </div>

              {irisMatches.map((record, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#fff",
                    borderRadius: 7,
                    padding: "7px 10px",
                    marginBottom: 6,
                    border: `1px solid ${C.greenBorder}`,
                  }}
                >
                  <SegPill seg={record.segment} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: C.textMid,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={record.irisDesc}
                  >
                    {record.irisDesc}
                  </span>

                  {record.batchNumber && (
                    <Pill
                      label={record.batchNumber}
                      color={C.blue}
                      bg={C.blueLight}
                      border={C.blueBorder}
                    />
                  )}

                  <span
                    style={{
                      fontWeight: 700,
                      color: C.green,
                      fontFamily: "monospace",
                      fontSize: 13,
                    }}
                  >
                    {fmt(record.count)}
                  </span>
                </div>
              ))}

              <div
                style={{
                  fontSize: 11,
                  color: C.green,
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <span>Total → auto-filled below</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                >
                  {fmt(irisMatches.reduce((sum, r) => sum + r.count, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* STEP 2 — OPENING BALANCE */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader
          step="2"
          title="Opening Balance"
          sub="Auto-loaded from Shared Closing Balances ledger (KHI + LHE)"
        />

        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <Field
              label="Opening Balance"
              hint="Read-only — auto-filled from shared ledger"
              hintType="info"
            >
              <NumInput val={ob} onChange={() => {}} readOnly />
            </Field>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: `1.5px solid ${
                  obRec && ob > 0 ? C.blueBorder : C.amberBorder
                }`,
                background: obRec && ob > 0 ? C.blueLight : C.amberLight,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.blue,
                  textTransform: "uppercase",
                  letterSpacing: ".8px",
                  marginBottom: 4,
                }}
              >
                Shared Ledger Source
              </div>

              <div
                style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}
              >
                {!ct || !sc || !cat
                  ? "Select product to load balance"
                  : invType !== "PLASTIC" && !cat
                  ? "Select category to load balance"
                  : invType === "PLASTIC" && !sub
                  ? "Select sub product to load balance"
                  : obRec && ob > 0
                  ? (
                    <>
                      Previous closing:{" "}
                      <strong style={{ color: C.green }}>
                        {fmt(ob)} units
                      </strong>
                      <br />
                      <span style={{ color: C.textFaint, fontSize: 10 }}>
                        From:{" "}
                        {obRec.date && obRec.date !== "manual"
                          ? fmtDate(obRec.date)
                          : obRec.date === "manual"
                          ? "manual entry"
                          : "import"}
                        {obRec.updatedBy && (
                          <span style={{ color: C.blue, fontWeight: 600 }}>
                            {" "}
                            · by {obRec.updatedBy}
                          </span>
                        )}
                      </span>
                    </>
                  )
                  : (
                    <span style={{ color: C.amber }}>
                      No prior balance found — starts at 0.
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* STEP 3 — VENDORS */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader step="3" title="Received from Vendor" />

        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 36px",
              gap: 8,
              marginBottom: 6,
            }}
          >
            {["Vendor", "Qty", ""].map((label) => (
              <div
                key={label}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.textFaint,
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {vendors.map((vendor, index) => (
            <div
              key={vendor.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 36px",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Select
                value={vendor.name}
                onChange={(name) => handleVendorNameChange(index, name)}
                options={VENDORS}
                placeholder="— Select Vendor —"
              />

              <input
                type="number"
                value={vendor.qty}
                min={0}
                onChange={(e) => handleVendorQtyChange(index, e.target.value)}
                style={{
                  height: 42,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "0 12px",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "right",
                  outline: "none",
                }}
              />

              <button
                onClick={() => handleRemoveVendor(index)}
                style={{
                  height: 42,
                  borderRadius: 8,
                  border: `1.5px solid ${C.redBorder}`,
                  background: C.redLight,
                  color: C.red,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={handleAddVendor}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 8,
              border: `1.5px dashed ${C.blueBorder}`,
              background: C.blueLight,
              color: C.blue,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            ＋ Add Vendor
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.textFaint,
                textTransform: "uppercase",
              }}
            >
              Total Received
            </span>

            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: C.green,
                fontFamily: "monospace",
              }}
            >
              {fmt(totalRecv)}
            </span>
          </div>
        </div>
      </Card>

      {/* STEP 4 — CONSUMPTION */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader
          step="4"
          title="Consumption & Deductions"
          badge={
            consFromIris && irisFiles.length > 0 ? (
              <Pill
                label="Auto-filled"
                color={C.green}
                bg={C.greenLight}
                border={C.greenBorder}
              />
            ) : null
          }
        />

        <div
          style={{
            padding: 24,
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 16,
          }}
        >
          <Field
            label="Batch Count (Production)"
            req
            hint={
              consFromIris ? "Auto-filled — editable" : "Cards issued / consumed"
            }
            hintType={consFromIris ? "success" : "info"}
          >
            <NumInput
              val={cons}
              onChange={(value) => {
                setCons(value);
                setConsFromIris(false);
              }}
              highlight={!!consFromIris}
            />
          </Field>

          <Field label="Extra Count" hint="Additional units from Excel">
            <NumInput
              val={extraCount}
              onChange={setExtraCount}
              highlight={!!(selDailyRow && selDailyRow.extraCount > 0)}
            />
          </Field>

          <Field label="Damaged" hint="Cards written off">
            <NumInput
              val={dmg}
              onChange={setDmg}
              highlight={!!(selDailyRow && selDailyRow.damaged > 0)}
            />
          </Field>

          <Field
            label="Move to Lahore"
            hint={
              movVal > 0
                ? "⚠ Triggers KHI→LHE transit"
                : "Triggers LHE transfer on save"
            }
            hintType={movVal > 0 ? "transit" : "info"}
          >
            <div style={{ position: "relative" }}>
              <NumInput
                val={mov}
                onChange={setMov}
                highlight={!!(selDailyRow && selDailyRow.transferred > 0)}
              />

              {movVal > 0 && (
                <div
                  style={{
                    position: "absolute",
                    right: -3,
                    top: -3,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: C.orange,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                  }}
                >
                  🚚
                </div>
              )}
            </div>
          </Field>
        </div>

        {movVal > 0 && (
          <div
            style={{
              margin: "0 24px 20px",
              background: C.orangeLight,
              border: `1.5px solid ${C.orangeBorder}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <ICONS.transit size={16} strokeWidth={1.5} color={C.orange} />
            <div style={{ fontSize: 12, fontWeight: 500, color: C.orange }}>
              Transit to Lahore will be created on save. When LHE marks
              delivered, shared balance auto-updates.
            </div>
          </div>
        )}
      </Card>

      {/* CLOSING BALANCE */}
      <div
        style={{
          background: C.navy,
          borderRadius: 14,
          padding: "22px 28px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 20,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#60A5FA",
              textTransform: "uppercase",
              letterSpacing: ".8px",
              marginBottom: 6,
            }}
          >
            Closing Balance → Saved to Shared Ledger
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#475569",
              marginBottom: 10,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            Opening + Received − Consumed − Damaged − Moved
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "monospace",
            }}
          >
            {[
              [fmt(ob), "#60A5FA"],
              ["+"],
              [fmt(totalRecv), "#34D399"],
              ["−"],
              [fmt(parseInt(cons, 10) || 0), "#F87171"],
              ["−"],
              [fmt(parseInt(dmg, 10) || 0), "#F87171"],
              ["−"],
              [fmt(movVal), "#F87171"],
              ["="],
              [fmt(cl), cl < 0 ? "#FCA5A5" : "#fff"],
            ].map((item, index) =>
              typeof item === "string" ? (
                <span key={index} style={{ color: "#475569" }}>
                  {item}
                </span>
              ) : (
                <span key={index} style={{ color: item[1] }}>
                  {item[0]}
                </span>
              )
            )}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 2,
            }}
          >
            Result
          </div>

          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: cl < 0 ? "#FCA5A5" : "#fff",
              lineHeight: 1,
              fontFamily: "monospace",
            }}
          >
            {fmt(cl)}
          </div>

          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            units
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          onClick={reset}
          style={{
            height: 40,
            padding: "0 18px",
            borderRadius: 8,
            border: `1.5px solid ${C.border}`,
            background: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            color: C.textMuted,
          }}
        >
          Reset
        </button>

        <button
          onClick={save}
          style={{
            height: 40,
            padding: "0 20px",
            borderRadius: 8,
            border: "none",
            background: movVal > 0 ? C.orange : C.navy,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {movVal > 0 ? "🚚 Save & Create Transit" : "✓ Save Entry"}
        </button>
      </div>
    </div>
  );
}