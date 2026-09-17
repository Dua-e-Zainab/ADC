
import { CAT } from '../constants/catalog';

function buildSubProductIndex() {
  const idx = {};
  // Process PLASTIC last so it always wins over MAILER/ENVELOPE
  // for sub-products that appear in multiple invTypes
  const ORDER = ["ENVELOPE", "MAILER", "PLASTIC"];
  for (const invType of ORDER) {
    const cardTypes = CAT[invType];
    if (!cardTypes) continue;
    for (const [ct, sm] of Object.entries(cardTypes))
      for (const [sc, cm] of Object.entries(sm))
        for (const [cat, subs] of Object.entries(cm))
          subs.forEach(sub => {
            idx[sub.toUpperCase()] = { invType, cardType: ct, scheme: sc, plasticCategory: cat };
          });
  }
  return idx;
}

const SUB_IDX = buildSubProductIndex();

export function matchSubProduct(desc) {
  const nd = desc.toUpperCase().replace(/\s+/g, " ").trim();
  let best = null, bestLen = 0;
  for (const sub of Object.keys(SUB_IDX)) {
    if (nd.includes(sub) || sub.includes(nd)) {
      if (sub.length > bestLen) { best = sub; bestLen = sub.length; }
    }
  }
  if (!best) {
    const dWords = new Set(nd.split(" "));
    let topScore = 0, topSub = null;
    for (const sub of Object.keys(SUB_IDX)) {
      const sWords = sub.split(" ");
      const hits = sWords.filter(w => w.length > 2 && dWords.has(w)).length;
      const score = hits / sWords.length;
      if (score > topScore) { topScore = score; topSub = sub; }
    }
    if (topScore >= 0.5) best = topSub;
  }
  return best ? { subProduct: best, ...SUB_IDX[best] } : null;
}

export function inferSegment(desc) {
  const u = desc.toUpperCase();
  if (u.includes("NTB"))                           return "NTB";
  if (u.includes("RENEWAL"))                       return "RENEWAL";
  if (u.includes("SUPP") || u.includes("SUPPLEMENTARY")) return "ETB";
  if (u.includes("PRIMARY") || u.includes("PRI")) return "NTB";
  return "ETB";
}

export async function parseIrisExcel(file, existingRecords = {}) {
  if (!window.XLSX) throw new Error("SheetJS not loaded.");
  const buf = await file.arrayBuffer();
  const wb  = window.XLSX.read(buf, { type: "array" });
  const result    = { ...existingRecords };
  const unmatched = [];

  wb.SheetNames.forEach(sn => {
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
    rows.forEach(row => {
      const r = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), v])
      );
      const irisCode = (r["iris_product_code"] || r["product_code"] || r["code"] || "").toString().trim();
      const irisDesc = (r["iris_product_descreption"] || r["iris_product_description"] || r["description"] || r["product_description"] || "").toString().trim();
      const count    = parseInt(r["count"] || r["qty"] || r["quantity"] || r["card_count"] || 0) || 0;
      if (!irisDesc) return;

      const rawBatch = (r["batch"] || r["ntb_batch"] || r["batch_no"] || "").toString().trim();
      let ntbBatch = null;
      if (rawBatch) {
        const m = rawBatch.match(/\d+/);
        if (m) ntbBatch = `NTB Batch ${m[0]}`;
      } else {
        const m = irisDesc.toUpperCase().match(/BATCH[\s\-#]*(\d+)|NTB[\s\-]*(\d+)\b|\bB(\d)\b/);
        if (m) { const n = m[1] || m[2] || m[3]; ntbBatch = `NTB Batch ${n}`; }
      }

      const segment = inferSegment(irisDesc);
      const matched = matchSubProduct(irisDesc);
      const key     = irisDesc.toUpperCase().replace(/\s+/g, " ").trim();

      result[key] = {
        irisCode, irisDesc, count, segment,
        ntbBatch:       segment === "NTB" ? ntbBatch : null,
        subProduct:     matched?.subProduct    || null,
        cardType:       matched?.cardType      || null,
        scheme:         matched?.scheme        || null,
        plasticCategory:matched?.plasticCategory || null,
        matched:        !!matched,
        sourceFile:     file.name,
      };
      if (!matched) unmatched.push(irisDesc);
    });
  });

  return { records: result, unmatched };
}

export async function parseDailyStockExcel(file) {
  if (!window.XLSX) throw new Error("SheetJS not loaded.");

  const parseNumber = v => {
    if (typeof v === "number") return v;
    const c = String(v || "").replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
    const n = Number(c);
    return isNaN(n) ? 0 : n;
  };

  const normalizeKey = s =>
    String(s || "").trim().toUpperCase()
      .replace(/[\s\/\-\.]+/g, "_")
      .replace(/[()]/g, "")
      .replace(/__+/g, "_")
      .trim();

  const FIELD_MAP = {
    IRIS_PRODUCT_DESCREPTION:   "irisDesc",
    IRIS_PRODUCT_DESCRIPTION:   "irisDesc",
    PRODUCT_NAME:               "irisDesc",
    DESCRIPTION:                "irisDesc",
    IRIS_PRODUCT_CODE:          "irisCode",
    PRODUCT_CODE:               "irisCode",
    IRIS_PRODUCT_NAME:          "IRISProductName",
    BATCH_COUNT:                "batchCount",
    NTB_BATCH:                  "rawBatch",
    BATCH_NO:                   "rawBatch",
    BATCH_NUMBER:                "rawBatch",
    BATCH:                      "rawBatch",
    STOCK_RECEIVED_FROM_VENDOR: "stockReceived",
    STOCK_RECEIVED:             "stockReceived",
    RECEIVED:                   "stockReceived",
    EXTRA_COUNT:                "extraCount",
    TOTAL:                      "total",
    DAMAGED:                    "damaged",
    TRANSFER:                   "transferred",
    TRANSFER_TO_LHR_ISL:        "transferred",
    LHR:                        "lhr",
    ISB:                        "isb",
    BUSINESS_TEST:              "businessTest",
    SCHEME:                     "scheme",
    PAYMENT_SCHEME:             "scheme",
    PAGE_SIZE:                  "pageSize",
    PAGESIZE:                   "pageSize",
    PAGE:                       "pageSize",
    };

  const buf = await file.arrayBuffer();
  const wb  = window.XLSX.read(buf, { type: "array", cellDates: true, cellFormula: true, cellText: false });
  const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
  if (!rows.length) throw new Error("No rows found.");

  return rows.map((row, rowIndex) => {
    const rec = {};
    Object.entries(row).forEach(([key, value]) => {
      const nk = normalizeKey(key);
      const mf = FIELD_MAP[nk];
      if (!mf) return;
      if (mf === "lhr" || mf === "isb") {
        rec.transferred = (parseNumber(rec.transferred) || 0) + parseNumber(value);
      } else {
        rec[mf] = value;
      }
    });

    const irisDesc = String(rec.irisDesc || "").trim();
    if (!irisDesc) return null;

    const matched = matchSubProduct(irisDesc);

// const rb = String(rec.rawBatch || "").trim(); // rec.ntbBatch is mapped from NTB_BATCH/BATCH_NO columns
// if (rb) {
//   const m = rb.match(/\d+/);
//   const num = m ? m[0] : null;
//   if (num) {
//     if (segment === "NTB")     batchNumber = `NTB Batch ${num}`;
//     else if (segment === "ETB") batchNumber = `ETB Batch ${num}`;
//     else                        batchNumber = `RENEWAL Batch ${num}`;
//   } else {
//     batchNumber = rb; // use as-is if no number found
//   }
// } else {
//   // fallback: try to extract from irisDesc
//   const m = irisDesc.toUpperCase().match(/BATCH[\s\-#]*(\d+)/);
//   if (m) {
//     const num = m[1];
//     if (segment === "NTB")      batchNumber = `NTB Batch ${num}`;
//     else if (segment === "ETB") batchNumber = `ETB Batch ${num}`;
//     else                        batchNumber = `RENEWAL Batch ${num}`;
//   }
// }

 // STEP 1 — infer segment from description (lowest priority fallback)
let segment = inferSegment(irisDesc);

// STEP 2 — Excel SEGMENT column overrides description inference
const sr = String(rec.segment || "").toUpperCase().trim();
if      (sr.includes("NTB")) segment = "NTB";
else if (sr.includes("REN")) segment = "RENEWAL";
else if (sr.includes("ETB")) segment = "ETB";

// STEP 3 — raw batch text can also tell us segment (overrides ETB default only)
const rb = String(rec.rawBatch || "").trim();
const rbUp = rb.toUpperCase();
if (rb) {
  if (rbUp.includes("NTB"))                            segment = "NTB";
  else if (rbUp.includes("REN"))                       segment = "RENEWAL";
  else if (rbUp.includes("ETB"))                       segment = "ETB";
  // if batch has no prefix (e.g. just "1" or "Batch 1"), keep segment as-is
}

// STEP 4 — build batchNumber using final resolved segment
let batchNumber = null;
if (rb) {
  const m = rb.match(/\d+/);
  const num = m ? m[0] : null;
  if (num) {
    if      (segment === "NTB")     batchNumber = `NTB Batch ${num}`;
    else if (segment === "ETB")     batchNumber = `ETB Batch ${num}`;
    else if (segment === "RENEWAL") batchNumber = `RENEWAL Batch ${num}`;
  } else {
    batchNumber = rb; // use as-is if already a full string like "NTB Batch 1"
  }
} else {
  // fallback: try extracting batch number from irisDesc
  const m = irisDesc.toUpperCase().match(/BATCH[\s\-#]*(\d+)/);
  if (m) {
    const num = m[1];
    if      (segment === "NTB")     batchNumber = `NTB Batch ${num}`;
    else if (segment === "ETB")     batchNumber = `ETB Batch ${num}`;
    else if (segment === "RENEWAL") batchNumber = `RENEWAL Batch ${num}`;
  }
}
    return {
      rowIndex,
      irisDesc,
      irisCode:       String(rec.irisCode || "").trim(),
      segment,
      batchNumber, 
      scheme:         String(rec.scheme || matched?.scheme || "").trim(),
      stockReceived:  parseNumber(rec.stockReceived),
      batchCount:     parseNumber(rec.batchCount),
      extraCount:     parseNumber(rec.extraCount),
      total:          parseNumber(rec.total),
      damaged:        parseNumber(rec.damaged),
      transferred:    parseNumber(rec.transferred),
      subProduct:     matched?.subProduct      || null,
      cardType:       matched?.cardType        || null,
      plasticCategory:matched?.plasticCategory || null,
      pageSize:       String(rec.pageSize || "").trim() || null,
      matched:        !!matched,
    };
  }).filter(Boolean);
}