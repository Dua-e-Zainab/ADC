import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Save,
  RotateCcw,
  CreditCard,
  Loader2,
  Building2,
  Layers,
  Calendar,
  AlertCircle,
} from "lucide-react";

import { C } from "../../constants/color";
import { CAT, INVENTORY_TYPES } from "../../constants/catalog";
import { fmt, ckCatSite } from "../../utils/helper";
import {
  matchSubProduct,
  validateBalanceHeaders,
} from "../../utils/irisEngine";

import { Card } from "../ui/Card";
import { SitePill } from "../ui/Pill";
import SharedSyncBanner from "../layout/SharedSyncBanner";

import axios from "axios";

const API = "/api";

const SCHEME_COLS = {
  VISA: "#1A56DB",
  MASTERCARD: "#9E1B1B",
  PAYPAK: "#065F46",
  "UNION PAY": "#5B21B6",
  STANDARD: "#334155",
};

const EMPTY_RECORD = {
  value: 0,
  updatedAt: null,
  date: null,
  updatedBy: null,
};

/*
 * Normalize a balance record so comparisons are predictable.
 */
const normalizeRecord = (record) => ({
  value: Number(record?.value || 0),
  updatedAt: record?.updatedAt || null,
  date: record?.date || null,
  updatedBy: record?.updatedBy || null,
});

/*
 * Compare only the fields that matter for determining
 * whether the user's draft differs from the DB.
 *
 * updatedAt/date/updatedBy are deliberately ignored here
 * because those are generated when the user actually saves.
 */
const recordsEqual = (a, b) => {
  return Number(a?.value || 0) === Number(b?.value || 0);
};

export default function BalancesTab({
  closing,
  setClosing,
  toast,
  showAlert,
  entries,
  currentSite,
}) {
  /*
   * ============================================================
   * STATE
   * ============================================================
   */

  // `closing` = confirmed state from database
  // `local`   = editable draft / unsaved state
  const [local, setLocal] = useState({});

  const [importLoading, setImportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loadingClosing, setLoadingClosing] = useState(true);

  const [selInvType, setSelInvType] = useState("PLASTIC");

  const selImportSite = currentSite;

  const SITES = ["KHI", "LHE"];

  /*
   * ============================================================
   * FETCH SAVED BALANCES FROM DATABASE
   * ============================================================
   *
   * This is the ONLY initial source for the saved state.
   */
  const fetchClosing = useCallback(async () => {
    setLoadingClosing(true);

    try {
      const res = await axios.get(`${API}/closing-balances`);

      const dbData = res.data || {};

      setClosing(dbData);
      setLocal(dbData);
    } catch (err) {
      console.error(
        "Failed to fetch closing balances:",
        err.response?.data || err.message,
      );

      toast(
        "Failed to load closing balances: " +
          (err.response?.data?.error || err.message),
        "error",
      );
    } finally {
      setLoadingClosing(false);
    }
  }, [setClosing, toast]);

  useEffect(() => {
    fetchClosing();
  }, [fetchClosing]);

  /*
   * IMPORTANT:
   *
   * We intentionally DO NOT have:
   *
   * useEffect(() => {
   *   setLocal(closing);
   * }, [closing]);
   *
   * That pattern can destroy unsaved user changes whenever
   * the shared `closing` state changes elsewhere.
   *
   * `local` is the draft and remains independent until Save.
   */

  /*
   * ============================================================
   * UNSAVED CHANGES
   * ============================================================
   */

  const hasUnsavedChanges = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(closing || {}),
      ...Object.keys(local || {}),
    ]);

    for (const key of allKeys) {
      const saved = normalizeRecord(closing?.[key] || EMPTY_RECORD);
      const draft = normalizeRecord(local?.[key] || EMPTY_RECORD);

      if (!recordsEqual(saved, draft)) {
        return true;
      }
    }

    return false;
  }, [closing, local]);

  /*
   * Check whether a specific key belongs to the currently
   * selected site + inventory type.
   */
  const isCurrentScope = useCallback(
    (key) => {
      const parts = String(key).split("|");

      const sitePart = parts[0];
      const invPart = parts[1];

      return sitePart === currentSite && invPart === selInvType;
    },
    [currentSite, selInvType],
  );

  /*
   * ============================================================
   * MANUAL INPUT UPDATE
   * ============================================================
   *
   * IMPORTANT:
   * This changes ONLY `local`.
   *
   * No API call.
   * No database update.
   */
  const update = useCallback((key, value) => {
    const numericValue = Math.max(
      0,
      parseInt(String(value).replace(/,/g, ""), 10) || 0,
    );

    setLocal((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] || {}),
        value: numericValue,
      },
    }));
  }, []);

  /*
   * ============================================================
   * SAVE ALL
   * ============================================================
   *
   * THIS IS THE MAIN DATABASE WRITE.
   *
   * Nothing gets persisted until this function runs.
   */
  const saveAll = async () => {
    if (saveLoading) return;

    const records = [];

    /*
     * Compare draft against DB and only persist changed records
     * belonging to the currently selected site + inventory type.
     */
    Object.entries(local || {}).forEach(([key, draftRecord]) => {
      if (!isCurrentScope(key)) return;

      const savedRecord = closing?.[key] || EMPTY_RECORD;

      const draftValue = Number(draftRecord?.value || 0);
      const savedValue = Number(savedRecord?.value || 0);

      if (draftValue === savedValue) return;

      records.push({
        balanceKey: key,
        value: draftValue,
        entryDate: "manual",
        updatedBy: currentSite,
      });
    });

    if (records.length === 0) {
      toast("There are no changes to save.", "info");
      return;
    }

    setSaveLoading(true);

    try {
      await axios.post(`${API}/closing-balances/bulk`, {
        records,
      });

      /*
       * Build the new confirmed DB state locally after the
       * server successfully accepted the request.
       */
      const now = new Date().toISOString();
      const nextClosing = { ...(closing || {}) };

      records.forEach((record) => {
        nextClosing[record.balanceKey] = {
          ...(local[record.balanceKey] || {}),
          value: record.value,
          updatedAt: now,
          date: "manual",
          updatedBy: currentSite,
        };
      });

      /*
       * Now the draft and confirmed state become synchronized.
       */
      setClosing(nextClosing);
      setLocal((previous) => {
        const next = { ...previous };

        records.forEach((record) => {
          next[record.balanceKey] = {
            ...(next[record.balanceKey] || {}),
            value: record.value,
            updatedAt: now,
            date: "manual",
            updatedBy: currentSite,
          };
        });

        return next;
      });

      toast(
        `${records.length} ${currentSite} ${selInvType} balance${
          records.length === 1 ? "" : "s"
        } saved successfully.`,
        "success",
      );
    } catch (err) {
      console.error("Save failed:", err);

      toast(
        "Save failed: " + (err.response?.data?.error || err.message),
        "error",
      );
    } finally {
      setSaveLoading(false);
    }
  };

  /*
   * ============================================================
   * RESET ALL
   * ============================================================
   *
   * Reset intentionally writes to DB because Reset All means
   * "delete the saved balances".
   *
   * This is separate from normal editing/importing.
   */
  const resetAll = async () => {
    if (resetLoading) return;

    const confirmed = window.confirm(
      `Reset all ${selInvType} balances for ${currentSite} to zero?\n\n` +
        `This will remove the saved balances from the database.`,
    );

    if (!confirmed) return;

    setResetLoading(true);

    try {
      await axios.delete(
        `${API}/closing-balances?site=${encodeURIComponent(
          currentSite,
        )}&invType=${encodeURIComponent(selInvType)}`,
      );

      const nextClosing = { ...(closing || {}) };
      const nextLocal = { ...(local || {}) };

      Object.keys(nextClosing).forEach((key) => {
        if (isCurrentScope(key)) {
          delete nextClosing[key];
        }
      });

      Object.keys(nextLocal).forEach((key) => {
        if (isCurrentScope(key)) {
          delete nextLocal[key];
        }
      });

      setClosing(nextClosing);
      setLocal(nextLocal);

      toast(
        `${currentSite} ${selInvType} balances reset successfully.`,
        "info",
      );
    } catch (err) {
      console.error("Reset failed:", err);

      toast(
        "Reset failed: " + (err.response?.data?.error || err.message),
        "error",
      );
    } finally {
      setResetLoading(false);
    }
  };

  /*
   * ============================================================
   * IMPORT EXCEL
   * ============================================================
   *
   * CRITICAL:
   *
   * Import DOES NOT call the API.
   *
   * It only modifies `local`.
   *
   * The user must explicitly click Save All.
   */
  const handleImport = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!window.XLSX) {
      toast("XLSX library is not loaded.", "error");
      e.target.value = "";
      return;
    }

    setImportLoading(true);

    try {
      /*
       * ========================================================
       * HEADER VALIDATION
       * ========================================================
       */

      const validation = await validateBalanceHeaders(file);

      if (!validation.valid) {
        showAlert({
          type: "error",
          title: "Invalid Balance File",
          msg: `
            <div style="margin-bottom:8px;">
              The uploaded file is missing the following required columns:
            </div>

            <div style="
              background:#FEF2F2;
              border:1px solid #FECACA;
              border-radius:8px;
              padding:10px;
              color:#B91C1C;
              font-size:12px;
              line-height:1.7;
            ">
              ${validation.missing
                .map((column) => `<div>• <strong>${column}</strong></div>`)
                .join("")}
            </div>

            <div style="
              margin-top:10px;
              color:#64748B;
              font-size:11px;
            ">
              Required columns are:
              <br/>
              <strong>
                IRIS Product Descreption,
                Plastic Type,
                PAYMENT SCHEME,
                CLOSING BALANCE
              </strong>
            </div>
          `,
        });

        return;
      }

      /*
       * ========================================================
       * READ WORKBOOK
       * ========================================================
       */

      const buf = await file.arrayBuffer();

      const wb = window.XLSX.read(buf, {
        type: "array",
      });

      let importedRows = 0;
      let matchedRows = 0;

      /*
       * Start from the CURRENT DRAFT.
       *
       * This is important:
       *
       * Excel import should not wipe out other unsaved edits.
       */
      const newLocal = { ...(local || {}) };

      /*
       * Tracks keys modified by THIS import only.
       */
      const importedThisRun = new Set();

      /*
       * Track duplicate rows in the Excel file.
       */
      const importedTotals = {};

      /*
       * ========================================================
       * PROCESS SHEETS
       * ========================================================
       */

      wb.SheetNames.forEach((sheetName) => {
        const sheet = wb.Sheets[sheetName];

        const rows = window.XLSX.utils.sheet_to_json(sheet, {
          defval: "",
        });

        rows.forEach((row) => {
          importedRows++;

          /*
           * Normalize headers.
           *
           * Example:
           *
           * "Closing Balance"
           *      ↓
           * "CLOSING_BALANCE"
           */
          const normalizedRow = Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key.trim().toUpperCase().replace(/\s+/g, "_"),
              typeof value === "string" ? value.trim() : value,
            ]),
          );

          /*
           * Closing balance.
           */
          const rawValue = normalizedRow["CLOSING_BALANCE"] ?? 0;

          const value = parseInt(String(rawValue).replace(/,/g, ""), 10) || 0;

          /*
           * Product description.
           */
          const description = normalizedRow["IRIS_PRODUCT_DESCREPTION"] ?? "";

          const descriptionString = String(description).trim();

          if (!descriptionString) return;

          /*
           * Match Excel product to internal catalog.
           */
          const matched = matchSubProduct(descriptionString);

          if (!matched) return;

          matchedRows++;

          /*
           * Build the exact balance key used throughout
           * the application.
           */
          const key = ckCatSite(
            matched.cardType,
            matched.scheme,
            matched.plasticCategory,
            selInvType,
            selImportSite,
          );

          /*
           * Accumulate duplicate product rows from Excel.
           */
          if (!importedTotals[key]) {
            importedTotals[key] = 0;
          }

          importedTotals[key] += value;

          importedThisRun.add(key);
        });
      });

      /*
       * ========================================================
       * NO MATCHES
       * ========================================================
       */

      if (matchedRows === 0) {
        showAlert({
          type: "warn",
          title: "No Matching Records",
          msg: `
            The file contains the required columns, but no
            <strong>IRIS Product Descreption</strong> values
            could be matched to your product catalog.
          `,
        });

        return;
      }

      /*
       * ========================================================
       * APPLY IMPORT TO DRAFT ONLY
       * ========================================================
       *
       * IMPORTANT:
       *
       * There is NO:
       *
       *   axios.post(...)
       *
       * here.
       *
       * There is NO:
       *
       *   setClosing(newLocal)
       *
       * here.
       */

      Object.entries(importedTotals).forEach(([key, importedValue]) => {
        newLocal[key] = {
          ...(newLocal[key] || {}),
          value: importedValue,
          updatedAt: new Date().toISOString(),
          date: "import",
          updatedBy: selImportSite,
        };
      });

      /*
       * Update ONLY the draft.
       */
      setLocal(newLocal);

      /*
       * ========================================================
       * IMPORT RESULT
       * ========================================================
       */

      showAlert({
        type: "success",
        title: "Import Staged",
        msg: `
          <strong>${matchedRows} records</strong> were imported
          into the current draft for
          <strong>${selImportSite}</strong>.
          <br/><br/>
          <span style="color:#64748B;">
            The database has NOT been updated.
            Click <strong>Save All</strong> to permanently save
            these balances.
          </span>
        `,
      });

      toast(
        `${matchedRows} records imported. Click Save All to save them.`,
        "info",
      );
    } catch (err) {
      console.error("Import failed:", err);

      showAlert({
        type: "error",
        title: "Import Failed",
        msg:
          err.response?.data?.error ||
          err.message ||
          "Unable to import balance file.",
      });
    } finally {
      setImportLoading(false);

      /*
       * Allow the same file to be selected again.
       */
      e.target.value = "";
    }
  };

  /*
   * ============================================================
   * CONSUMPTION CALCULATIONS
   * ============================================================
   *
   * This is read-only data.
   *
   * It does NOT modify balances or database state.
   */
  const catConsumption = useMemo(() => {
    const agg = {};

    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const key = ckCatSite(
        entry.cardType,
        entry.scheme,
        entry.plasticCategory,
        entry.invType || "PLASTIC",
        entry.site || "KHI",
      );

      if (!agg[key]) {
        agg[key] = {
          NTB: 0,
          ETB: 0,
          RENEWAL: 0,
        };
      }

      if (entry.segment && agg[key][entry.segment] !== undefined) {
        agg[key][entry.segment] += Number(entry.totalConsumption || 0);
      }
    });

    return agg;
  }, [entries]);

  const curInv = CAT[selInvType] || {};

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div>
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
            }}
          >
            Closing Balances
          </h1>

          <p
            style={{
              fontSize: 12,
              color: C.textMuted,
              marginTop: 4,
            }}
          >
            KHI and LHE each maintain their own independent balance.
          </p>

          {/* UNSAVED INDICATOR */}

          {hasUnsavedChanges && (
            <div
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 9px",
                borderRadius: 6,
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
                color: "#C2410C",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <AlertCircle size={12} />
              Unsaved changes
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* CURRENT SITE */}

          <div
            style={{
              display: "flex",
              border: `1.5px solid ${C.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              style={{
                height: 38,
                padding: "0 14px",
                border: "none",
                background: C.blue,
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Building2 size={14} />
              {currentSite}
            </button>
          </div>

          {/* IMPORT */}

          <label
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              border: `1.5px solid ${C.blueBorder}`,
              background: C.blueLight,
              color: C.blue,
              fontSize: 12,
              fontWeight: 600,
              cursor: importLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: importLoading ? 0.7 : 1,
            }}
          >
            {importLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Download size={16} />
                Import for {selImportSite}
              </>
            )}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: "none" }}
              disabled={importLoading}
            />
          </label>
        </div>
      </div>

      <SharedSyncBanner currentSite={currentSite} />

      {/* ======================================================
          INVENTORY TYPE TABS
          ====================================================== */}

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {INVENTORY_TYPES.map((type) => {
          const COLS = {
            PLASTIC: [C.blueLight, C.blueBorder, C.blue],
            MAILER: [C.purpleLight, C.purpleBorder, C.purple],
            ENVELOPE: [C.tealLight, C.tealBorder, C.teal],
          };

          const [bg, bd, tc] =
            selInvType === type
              ? COLS[type]
              : [C.surface, C.border, C.textMuted];

          return (
            <button
              type="button"
              key={type}
              onClick={() => setSelInvType(type)}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 8,
                border: `1.5px solid ${bd}`,
                background: bg,
                color: tc,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Layers size={14} />
              {type}
            </button>
          );
        })}
      </div>

      {/* ======================================================
          LEDGER
          ====================================================== */}

      <Card>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
            }}
          >
            Ledger
            <span
              style={{
                fontSize: 11,
                color: C.textFaint,
                fontWeight: 400,
              }}
            >
              {" "}
              — separate balance per site, per plastic category
            </span>
          </div>

          {/* RESET */}

          <button
            type="button"
            onClick={resetAll}
            disabled={resetLoading || loadingClosing}
            style={{
              height: 30,
              padding: "0 12px",
              borderRadius: 8,
              border: `1.5px solid ${C.border}`,
              background: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor:
                resetLoading || loadingClosing ? "not-allowed" : "pointer",
              color: C.textMuted,
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: resetLoading || loadingClosing ? 0.6 : 1,
            }}
          >
            {resetLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RotateCcw size={13} />
            )}

            {resetLoading ? "Resetting..." : "Reset All"}
          </button>

          {/* SAVE */}

          <button
            type="button"
            onClick={saveAll}
            disabled={saveLoading || loadingClosing || !hasUnsavedChanges}
            style={{
              height: 30,
              padding: "0 12px",
              borderRadius: 8,
              border: "none",
              background: !hasUnsavedChanges ? "#94A3B8" : C.green,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor:
                saveLoading || loadingClosing || !hasUnsavedChanges
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: saveLoading || loadingClosing ? 0.7 : 1,
            }}
          >
            {saveLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}

            {saveLoading ? "Saving..." : "Save All"}
          </button>
        </div>

        {/* LOADING */}

        {loadingClosing ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: C.textMuted,
              fontSize: 12,
            }}
          >
            <Loader2
              size={20}
              className="animate-spin"
              style={{
                margin: "0 auto 8px",
              }}
            />
            Loading closing balances...
          </div>
        ) : (
          <>
            {/* ==================================================
                INVENTORY
                ================================================== */}

            {Object.entries(curInv).map(([ct, sm]) => (
              <div key={ct}>
                {/* CARD TYPE */}

                <div
                  style={{
                    padding: "10px 20px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    background: ct === "DEBIT" ? C.navy : C.red,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CreditCard size={14} />

                  {ct === "DEBIT" ? "DEBIT" : "CREDIT"}
                </div>

                {/* ==================================================
                      SCHEMES
                      ================================================== */}

                {Object.entries(sm).map(([sc, cm]) => (
                  <div key={sc}>
                    <div
                      style={{
                        padding: "8px 20px",
                        fontWeight: 700,
                        color: "rgba(255,255,255,.95)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        background: SCHEME_COLS[sc] || "#334155",
                      }}
                    >
                      {sc}
                    </div>

                    {/* ==================================================
                            CATEGORIES
                            ================================================== */}

                    {Object.entries(cm).map(([cat, subs]) => {
                      const khiKey = ckCatSite(ct, sc, cat, selInvType, "KHI");

                      const lheKey = ckCatSite(ct, sc, cat, selInvType, "LHE");

                      const khiConsumption = catConsumption[khiKey] || {};

                      const lheConsumption = catConsumption[lheKey] || {};

                      const cons = {
                        NTB:
                          Number(khiConsumption.NTB || 0) +
                          Number(lheConsumption.NTB || 0),

                        ETB:
                          Number(khiConsumption.ETB || 0) +
                          Number(lheConsumption.ETB || 0),

                        RENEWAL:
                          Number(khiConsumption.RENEWAL || 0) +
                          Number(lheConsumption.RENEWAL || 0),
                      };

                      return (
                        <div
                          key={cat}
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: "#fff",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                          }}
                        >
                          {/* LEFT SIDE */}

                          <div
                            style={{
                              padding: "14px 22px 12px 32px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: C.text,
                                marginBottom: 4,
                              }}
                            >
                              {cat}
                            </div>

                            {/* SUB PRODUCTS */}

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                                marginBottom: 8,
                              }}
                            >
                              {subs.map((sub) => (
                                <span
                                  key={sub}
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 500,
                                    color: C.textMuted,
                                    background: C.surface,
                                    border: `1px solid ${C.border}`,
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                  }}
                                >
                                  {sub}
                                </span>
                              ))}
                            </div>

                            {/* CONSUMPTION */}

                            <div
                              style={{
                                display: "flex",
                                gap: 5,
                                flexWrap: "wrap",
                              }}
                            >
                              {[
                                {
                                  s: "NTB",
                                  c: C.blue,
                                  bg: C.blueLight,
                                },
                                {
                                  s: "ETB",
                                  c: C.amber,
                                  bg: C.amberLight,
                                },
                                {
                                  s: "RENEWAL",
                                  c: C.purple,
                                  bg: C.purpleLight,
                                },
                              ].map(({ s, c, bg }) => (
                                <span
                                  key={s}
                                  style={{
                                    background: bg,
                                    color: c,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    fontSize: 9,
                                    fontWeight: 700,
                                  }}
                                >
                                  {s} {cons[s] > 0 ? fmt(cons[s]) : "—"}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* ==================================================
                                    CURRENT SITE BALANCE
                                    ================================================== */}

                          <div
                            style={{
                              padding: "14px 20px",
                              display: "flex",
                              gap: 14,
                              borderLeft: `1px solid ${C.border}`,
                              minWidth: 220,
                            }}
                          >
                            {SITES.filter((site) => site === currentSite).map(
                              (site) => {
                                const key = ckCatSite(
                                  ct,
                                  sc,
                                  cat,
                                  selInvType,
                                  site,
                                );

                                /*
                                 * IMPORTANT:
                                 *
                                 * Value displayed here comes
                                 * from LOCAL/DRAFT.
                                 *
                                 * That means:
                                 *
                                 * - manual typing appears immediately
                                 * - Excel import appears immediately
                                 * - DB is NOT changed
                                 */
                                const val = Number(local?.[key]?.value || 0);

                                /*
                                 * Last saved timestamp comes
                                 * from CLOSING, NOT LOCAL.
                                 *
                                 * Therefore an imported-but-unsaved
                                 * value does not pretend that it
                                 * has already been saved.
                                 */
                                const lastUpdated = closing?.[key]?.updatedAt;

                                const updatedBy = closing?.[key]?.updatedBy;

                                const isDirty = !recordsEqual(
                                  local?.[key],
                                  closing?.[key],
                                );

                                return (
                                  <div
                                    key={site}
                                    style={{
                                      flex: 1,
                                      minWidth: 180,
                                    }}
                                  >
                                    <label
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: C.textFaint,
                                        textTransform: "uppercase",
                                        letterSpacing: ".7px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginBottom: 5,
                                      }}
                                    >
                                      <SitePill site={site} />
                                      Closing
                                      {isDirty && (
                                        <span
                                          style={{
                                            color: "#C2410C",
                                            fontSize: 8,
                                            fontWeight: 800,
                                          }}
                                        >
                                          UNSAVED
                                        </span>
                                      )}
                                    </label>

                                    <input
                                      type="number"
                                      min={0}
                                      value={val}
                                      onChange={(event) =>
                                        update(key, event.target.value)
                                      }
                                      style={{
                                        height: 42,
                                        width: "100%",
                                        border: `1.5px solid ${
                                          isDirty
                                            ? "#F59E0B"
                                            : val > 0
                                              ? C.greenBorder
                                              : C.border
                                        }`,
                                        borderRadius: 8,
                                        padding: "0 12px",
                                        fontFamily: "'DM Mono',monospace",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: val > 0 ? C.green : C.text,
                                        background: isDirty
                                          ? "#FFFBEB"
                                          : val > 0
                                            ? C.greenLight
                                            : C.surface,
                                        textAlign: "right",
                                        outline: "none",
                                      }}
                                    />

                                    {/* LAST SAVED */}

                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: lastUpdated
                                          ? C.textFaint
                                          : C.border,
                                        marginTop: 4,
                                        textAlign: "right",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        gap: 4,
                                      }}
                                    >
                                      <Calendar size={10} />

                                      {lastUpdated
                                        ? `${new Date(
                                            lastUpdated,
                                          ).toLocaleDateString("en-GB")}${
                                            updatedBy ? " · " + updatedBy : ""
                                          }`
                                        : "Not saved"}
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
