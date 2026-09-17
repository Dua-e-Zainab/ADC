import { LEAD_TIME, SAFETY_BUF, ALERT_DAYS, FORECAST_H, REORDER_PT } from '../constants/config';
import { ckCatSite, today, addDays, daysBetween } from './helper';

export function wma(vals) {
  if (!vals.length) return 0;
  let ws = 0, vs = 0;
  vals.forEach((v, i) => { const w = i + 1; vs += v * w; ws += w; });
  return ws === 0 ? 0 : vs / ws;
}

export function buildForecast(entries, closing, orders={}, siteFilter=null) {
  const todayStr = today();
  const groups = {};


  // If a site filter is active, only use that site's entries for consumption averages
  const scopedEntries = siteFilter ? entries.filter(e => e.site === siteFilter) : entries;
  
  scopedEntries.forEach(e => {
    const k = `${e.invType || "PLASTIC"}||${e.cardType}||${e.scheme}||${e.plasticCategory}||${e.subProduct}||${e.segment}`;
    if (!groups[k]) groups[k] = {
      invType: e.invType || "PLASTIC",
      cardType: e.cardType,
      scheme: e.scheme,
      plasticCategory: e.plasticCategory,
      subProduct: e.subProduct,
      segment: e.segment,
      entries: []
    };
    groups[k].entries.push(e);
  });

  const results = [];

  Object.entries(groups).forEach(([, g]) => {
    const sorted = [...g.entries].sort((a, b) => a.date?.localeCompare(b.date));
    const cons = sorted.map(e => e.totalConsumption || 0);
    const a90 = wma(cons.slice(-90));
    const a30 = wma(cons.slice(-30));
    const a7  = wma(cons.slice(-7));
    const primary = a30 > 0 ? a30 : a90 > 0 ? a90 : 0;

    const khiKey = ckCatSite(g.cardType, g.scheme, g.plasticCategory, g.invType || "PLASTIC", "KHI");
    const lheKey = ckCatSite(g.cardType, g.scheme, g.plasticCategory, g.invType || "PLASTIC", "LHE");
    const khiVal = closing[khiKey] ? Math.max(0, closing[khiKey].value) : 0;
    const lheVal = closing[lheKey] ? Math.max(0, closing[lheKey].value) : 0;

    // ✅ stock reflects only the selected site if a filter is active, else combined
    const baseStock = siteFilter === "KHI" ? khiVal : siteFilter === "LHE" ? lheVal : khiVal + lheVal;

    const receivedOrder=orders&&Object.values(orders).find(o=>o.key===`${g.invType}|${g.cardType}|${g.scheme}|${g.plasticCategory}|${g.subProduct}|${g.segment}`&&o.received&&!o.countedIn);
    const stock=baseStock+(receivedOrder?Number(receivedOrder.qty)||0:0);

    if (primary === 0 && stock === 0) return;

    const daysLeft         = primary > 0 ? Math.floor(stock / primary) : 9999;
    const stockoutDate     = primary > 0 ? addDays(todayStr, daysLeft) : null;
    const reorderDate      = stockoutDate ? addDays(stockoutDate, -LEAD_TIME) : null;
    const daysUntilReorder = reorderDate ? daysBetween(todayStr, reorderDate) : 9999;
    const recOrder         = Math.max(0, Math.round((SAFETY_BUF + LEAD_TIME) * primary) - stock);

    let status = "HEALTHY";
    if (daysLeft <= 30)           status = "CRITICAL";
    else if (daysLeft <= ALERT_DAYS)  status = "WARNING";
    else if (daysLeft <= REORDER_PT)  status = "REORDER";

    results.push({
      key: `${g.invType}|${g.cardType}|${g.scheme}|${g.plasticCategory}|${g.subProduct}|${g.segment}`,
      invType: g.invType, cardType: g.cardType, scheme: g.scheme,
      plasticCategory: g.plasticCategory, subProduct: g.subProduct, segment: g.segment,
      stock, khiStock: khiVal, lheStock: lheVal,
      avgD30: +a30.toFixed(1), avgD90: +a90.toFixed(1), avgD7: +a7.toFixed(1),
      primary: +primary.toFixed(1),
      daysLeft: daysLeft === 9999 ? null : daysLeft,
      weeksOfCover: primary > 0 ? (stock / primary / 7).toFixed(1) : "∞",
      stockoutDate, reorderDate,
      daysUntilReorder: daysUntilReorder === 9999 ? null : daysUntilReorder,
      f30: Math.round(primary * 30), f60: Math.round(primary * 60), f90: Math.round(primary * FORECAST_H),
      recOrder, status, pts: sorted.length
    });
  });

  const ORD = { CRITICAL: 0, WARNING: 1, REORDER: 2, HEALTHY: 3 };
  return results.sort((a, b) => (ORD[a.status] - ORD[b.status]) || ((a.daysLeft ?? 9999) - (b.daysLeft ?? 9999)));
}