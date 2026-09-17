import { useState, useMemo, useEffect } from "react";
import { C } from "../../constants/color";
import { INVENTORY_TYPES } from "../../constants/catalog";
import { fmt, fmtDate } from "../../utils/helper";
import SharedSyncBanner from "../layout/SharedSyncBanner";
import {
  TrendingUp,
  ChevronDown,
  CreditCard,
  Mail,
  FileText,
  Layers,
  Trash2,
  RotateCcw,
  Search,
  MapPin
} from "lucide-react";
import axios from "axios";

const API = '/api';

export default function HistoryTab({ allEntries, setAllEntries, toast, transitRecords = [], currentSite }) {
  const [filterSite, setFilterSite] = useState("ALL");
  const [filterInvType, setFilterInvType] = useState("");
  const [filterCT, setFilterCT] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // FETCH & CHRONOLOGICALLY SORT FROM DB ON MOUNT
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/entries`);
        const data = await res.json();
        const normalized = data
          .map(e => ({
            id: e.id,
            date: typeof e.date === "string" ? e.date.slice(0, 10) : e.date,
            site: e.site,
            invType: e.inv_type || e.invType || "PLASTIC",
            cardType: e.card_type || e.cardType,
            scheme: e.scheme,
            plasticCategory: e.plastic_category || e.plasticCategory,
            subProduct: e.sub_product || e.subProduct,
            pageSize: e.page_size || e.pageSize,
            segment: e.segment,
            batchNumber: e.batch_number || e.batchNumber,
            openingBalance: Number(e.opening_balance ?? e.openingBalance ?? 0),
            receivedFromVendor: Number(e.received_from_vendor ?? e.receivedFromVendor ?? 0),
            totalConsumption: Number(e.batch_count ?? e.totalConsumption ?? 0),
            extraCount: Number(e.extra_count ?? e.extraCount ?? 0),
            damaged: Number(e.damaged ?? 0),
            movedToOtherSite: Number(e.moved_to_other_site ?? e.movedToOtherSite ?? 0),
            closingBalance: Number(e.closing_balance ?? e.closingBalance ?? 0),
            savedAt: e.saved_at || e.savedAt,
            sourceExcel: e.source_excel || e.sourceExcel,
          }))
          // Keep ascending chronological order internally for balance calculations
          .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.id - b.id);

        setAllEntries(normalized);
      } catch (err) {
        console.error("Failed to fetch entries:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [setAllEntries]);

  useEffect(() => {
    const close = () => setIsDropdownOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Filter and display in descending order for UI view
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return [...allEntries]
      .filter(e =>
        (filterSite === "ALL" || e.site === filterSite) &&
        (!filterInvType || e.invType === filterInvType) &&
        (!filterCT || e.cardType === filterCT) &&
        (!q || e.subProduct?.toLowerCase().includes(q) || e.scheme?.toLowerCase().includes(q) || e.plasticCategory?.toLowerCase().includes(q))
      )
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id);
  }, [allEntries, filterSite, filterInvType, filterCT, searchQ]);

  // Reset to page 1 whenever any filter changes, so we never get stuck on an
  // empty/out-of-range page after narrowing the result set.
  useEffect(() => {
    setPage(1);
  }, [filterSite, filterInvType, filterCT, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedEntries = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const productAnalytics = useMemo(() => {
    const products = {};
    allEntries.forEach(e => {
      const key = `${e.scheme}|${e.subProduct || e.plasticCategory}`;
      if (!products[key]) products[key] = { key, scheme: e.scheme, product: e.subProduct || e.plasticCategory || "Unknown Product", records: [] };
      products[key].records.push(e);
    });

    return Object.values(products).map(p => {
      const sorted = [...p.records].sort((a, b) => new Date(b.date) - new Date(a.date));
      const consumptions = sorted.map(r => Number(r.totalConsumption || 0));
      const getAvg = (l) => {
        const s = l ? sorted.slice(0, l) : sorted;
        return Math.round(s.reduce((acc, r) => acc + Number(r.totalConsumption || 0), 0) / Math.max(s.length, 1));
      };
      return { ...p, total: consumptions.reduce((a, b) => a + b, 0), avgAll: getAvg(), avg30: getAvg(30), avg90: getAvg(90), highest: Math.max(...consumptions, 0), lowest: consumptions.length ? Math.min(...consumptions) : 0 };
    }).sort((a, b) => a.product?.localeCompare(b.product));
  }, [allEntries]);

  useEffect(() => {
    if (productAnalytics.length && !selectedProduct) {
      setSelectedProduct(productAnalytics[0].key);
    } else if (!productAnalytics.length) {
      setSelectedProduct("");
    }
  }, [productAnalytics, selectedProduct]);

  const selectedAnalytics = productAnalytics.find(p => p.key === selectedProduct) || null;
  const filteredDropdownOptions = productAnalytics.filter(p => p.product.toLowerCase().includes(analyticsSearch.toLowerCase()) || p.scheme.toLowerCase().includes(analyticsSearch.toLowerCase()));

  const getBreakdown = (site) => {
    const siteRows = allEntries.filter(e => e.site === site);
    return {
      total: siteRows.length,
      plastic: siteRows.filter(e => (e.invType || "").toUpperCase() === "PLASTIC").length,
      mailer: siteRows.filter(e => (e.invType || "").toUpperCase() === "MAILER").length,
      envelope: siteRows.filter(e => (e.invType || "").toUpperCase() === "ENVELOPE").length,
    };
  };

  const khi = useMemo(() => getBreakdown("KHI"), [allEntries]);
  const lhe = useMemo(() => getBreakdown("LHE"), [allEntries]);

  const getMailerSum = (isLegal) => allEntries
    .filter(e => ["MAILER", "ENVELOPE"].includes(e.invType) && ((e.pageSize || "A4").toUpperCase() === "LEGAL") === isLegal)
    .reduce((s, e) => s + (Number(e.totalConsumption) || 0), 0);

  const a4Count = getMailerSum(false), legalCount = getMailerSum(true);

  const del = async (id) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await axios.delete(`${API}/entries/${id}`);
      setAllEntries(p => p.filter(e => e.id !== id));
      toast("Entry deleted successfully.", "info");
    } catch (err) {
      toast("Delete failed: " + (err.response?.data?.message || err.message), "error");
    }
  };

  const resetAll = async () => {
    const confirmed = window.confirm(
      `⚠️ WARNING: Are you sure you want to PERMANENTLY delete ALL entry records for ${currentSite}?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/entries`, { params: { site: currentSite } });
      setAllEntries(prev => prev.filter(e => e.site !== currentSite));
      setSelectedProduct("");
      setAnalyticsSearch("");
      toast(`Ledger history for ${currentSite} successfully cleared.`, "info");
    } catch (err) {
      console.error("Failed to reset ledger entries:", err);
      toast("Clear failed: " + (err.response?.data?.message || err.message), "error");
    }
  };

  const cardStyle = {
    background: "#FFFFFF",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.03)",
    border: "1px solid #F1F5F9",
  };

  return (
    <div style={{ padding: "24px 0", fontFamily: "'Inter', sans-serif", color: "#1E293B", backgroundColor: "#F8FAFC" }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
            Entry History
          </h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4, margin: 0 }}>
            Shared inventory ledger — <strong>{allEntries.length}</strong> total entries logged.
          </p>
        </div>
      </div>

      <SharedSyncBanner currentSite={currentSite} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Karachi (KHI) Entries", val: khi.total, icon: MapPin, iconColor: "#0D9488", bg: "#CCFBF1", subText: `Plastic: ${khi.plastic} | Mailers: ${khi.mailer}` },
          { label: "Lahore (LHE) Entries", val: lhe.total, icon: MapPin, iconColor: "#8B5CF6", bg: "#EDE9FE", subText: `Plastic: ${lhe.plastic} | Mailers: ${lhe.mailer}` },
          { label: "Combined Records", val: allEntries.length, icon: Layers, iconColor: "#3B82F6", bg: "#DBEAFE", subText: "Across all hubs" },
          { label: "A4 / Legal Mailers", val: `${fmt(a4Count)} / ${fmt(legalCount)}`, icon: FileText, iconColor: "#F59E0B", bg: "#FEF3C7", subText: "Total consumed" },
        ].map((item, idx) => {
          const IconComponent = item.icon;
          return (
            <div key={idx} style={{ ...cardStyle, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconComponent size={22} color={item.iconColor} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", display: "block" }}>{item.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: "1.2" }}>{item.val}</span>
                <span style={{ fontSize: 11, color: "#94A3B8", display: "block", marginTop: 2 }}>{item.subText}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} color="#3B82F6" />
              Consumption Analytics
            </h2>
            {selectedAnalytics && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#3B82F6", background: "#EFF6FF", padding: "4px 10px", borderRadius: 20 }}>
                Total Used: {fmt(selectedAnalytics.total)}
              </span>
            )}
          </div>

          <div style={{ position: "relative", marginBottom: 16 }} onClick={e => e.stopPropagation()}>
            <div
              style={{ height: 42, borderRadius: 10, border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", padding: "0 14px", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span style={{ fontWeight: 500, color: selectedAnalytics ? "#0F172A" : "#94A3B8" }}>
                {selectedAnalytics ? `${selectedAnalytics.product} (${selectedAnalytics.scheme})` : "Select Product..."}
              </span>
              <ChevronDown size={16} color="#64748B" />
            </div>

            {isDropdownOpen && (
              <div style={{ position: "absolute", top: 46, left: 0, right: 0, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, zIndex: 50, padding: 8, boxShadow: "0px 10px 25px rgba(0,0,0,0.08)" }}>
                <input
                  type="text"
                  placeholder="Search product..."
                  value={analyticsSearch}
                  onChange={e => setAnalyticsSearch(e.target.value)}
                  style={{ width: "100%", height: 36, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                  {filteredDropdownOptions.map(p => (
                    <div
                      key={p.key}
                      style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", background: selectedProduct === p.key ? "#F1F5F9" : "transparent" }}
                      onClick={() => { setSelectedProduct(p.key); setIsDropdownOpen(false); setAnalyticsSearch(""); }}
                    >
                      <span style={{ fontWeight: 600, color: "#1E293B" }}>{p.product}</span> <span style={{ color: "#64748B", fontSize: 12 }}>({p.scheme})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedAnalytics ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                ["Avg Consumption", "avgAll", "#2563EB", "#EFF6FF"],
                ["30-Day Avg", "avg30", "#16A34A", "#F0FDF4"],
                ["90-Day Avg", "avg90", "#9333EA", "#FAF5FF"],
                ["Highest Batch", "highest", "#DC2626", "#FEF2F2"],
                ["Lowest Batch", "lowest", "#D97706", "#FFFBEB"],
                ["Total Units", "total", "#0F172A", "#F8FAFC"]
              ].map(([lbl, key, col, bg]) => (
                <div key={lbl} style={{ background: bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${col}15` }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: col, marginTop: 4 }}>{fmt(selectedAnalytics[key])}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
              No product entries available for analytics.
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
              Hub Inventory Split
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Karachi (KHI)", khi, "#2563EB"],
                ["Lahore (LHE)", lhe, "#9333EA"]
              ].map(([loc, data, color]) => (
                <div key={loc} style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, border: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{loc}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, background: "#FFFFFF", padding: "2px 8px", borderRadius: 12, border: "1px solid #E2E8F0" }}>{data.total} entries</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11, color: "#475569" }}>
                    <div><CreditCard size={10} style={{ display: "inline", marginRight: 2 }} /> Plastic: <b>{data.plastic}</b></div>
                    <div><Mail size={10} style={{ display: "inline", marginRight: 2 }} /> Mailers: <b>{data.mailer}</b></div>
                    <div><FileText size={10} style={{ display: "inline", marginRight: 2 }} /> Env: <b>{data.envelope}</b></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={resetAll}
            style={{ marginTop: 16, width: "100%", height: 36, borderRadius: 8, border: "1px solid #FCA5A5", background: "#FEF2F2", fontSize: 12, fontWeight: 600, color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <RotateCcw size={14} /> Clear Ledger History
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", padding: 3, borderRadius: 10 }}>
          {[["ALL", "All Hubs"], ["KHI", "KHI"], ["LHE", "LHE"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterSite(v)}
              style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "none", background: filterSite === v ? "#FFFFFF" : "transparent", color: filterSite === v ? "#0F172A" : "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: filterSite === v ? "0px 2px 4px rgba(0,0,0,0.05)" : "none" }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ height: 20, width: 1, backgroundColor: "#CBD5E1", margin: "0 4px" }} />

        <select value={filterInvType} onChange={e => setFilterInvType(e.target.value)} style={{ height: 34, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontSize: 12, color: "#334155", background: "#FFFFFF", outline: "none" }}>
          <option value="">All Inventory Types</option>
          {INVENTORY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>

        <select value={filterCT} onChange={e => setFilterCT(e.target.value)} style={{ height: 34, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px", fontSize: 12, color: "#334155", background: "#FFFFFF", outline: "none" }}>
          <option value="">All Card Types</option>
          <option>DEBIT</option>
          <option>CREDIT</option>
        </select>

        <div style={{ flex: 1, position: "relative", minWidth: 180 }}>
          <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search product, scheme..."
            style={{ height: 34, width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 10px 0 32px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading history...</div>
        ) : !filtered.length ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            No transaction records match the selected filters.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {(() => {
                      const showMailerCols = filterInvType === "MAILER" || filterInvType === "ENVELOPE";
                      const showPlasticCols = filterInvType === "PLASTIC";
                      const productCols = showMailerCols
                        ? ["Plastic Category", "Page Size"]
                        : showPlasticCols
                          ? ["Sub Product"]
                          : ["Product / Category", "Page Size"];

                      return ["Site", "Date", "Type", "Card Type", "Scheme", ...productCols, "Segment", "Opening", "Received", "Consumed", "Extra", "Damaged", "Moved", "Transit", "Closing", ""].map((h, i) => (
                        <th key={i} style={{ padding: "12px 14px", color: "#64748B", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: i > 4 + productCols.length ? "right" : "left", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((e, i) => {
                    const tr = transitRecords.find(r => r.entryId === e.id);
                    return (
                      <tr key={`entry-${e.id}-${i}`} style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: "#FFFFFF" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, backgroundColor: e.site === "KHI" ? "#EFF6FF" : "#FAF5FF", color: e.site === "KHI" ? "#2563EB" : "#9333EA", border: `1px solid ${e.site === "KHI" ? "#BFDBFE" : "#E9D5FF"}` }}>
                            {e.site}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", color: "#64748B", whiteSpace: "nowrap", fontSize: 12 }}>
                          {fmtDate(e.date)}
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}>
                            {e.invType || "PLASTIC"}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, backgroundColor: e.cardType === "DEBIT" ? "#F0FDF4" : "#FEF2F2", color: e.cardType === "DEBIT" ? "#16A34A" : "#DC2626" }}>
                            {e.cardType}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A" }}>{e.scheme}</td>

                        {(() => {
                          const isMailerRow = e.invType === "MAILER" || e.invType === "ENVELOPE";
                          const showMailerCols = filterInvType === "MAILER" || filterInvType === "ENVELOPE";
                          const showPlasticCols = filterInvType === "PLASTIC";

                          if (showPlasticCols) {
                            return <td style={{ padding: "12px 14px", color: "#334155" }}>{e.subProduct || "—"}</td>;
                          }
                          if (showMailerCols) {
                            return (
                              <>
                                <td style={{ padding: "12px 14px", color: "#334155" }}>{e.plasticCategory || "—"}</td>
                                <td style={{ padding: "12px 14px" }}>
                                  {e.pageSize ? <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#CCFBF1", color: "#0D9488" }}>{e.pageSize}</span> : "—"}
                                </td>
                              </>
                            );
                          }
                          return (
                            <>
                              <td style={{ padding: "12px 14px", color: "#334155" }}>{isMailerRow ? (e.plasticCategory || "—") : (e.subProduct || "—")}</td>
                              <td style={{ padding: "12px 14px" }}>
                                {isMailerRow && e.pageSize ? <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#CCFBF1", color: "#0D9488" }}>{e.pageSize}</span> : "—"}
                              </td>
                            </>
                          );
                        })()}

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, color: "#475569" }}>{e.segment}</span>
                          {e.batchNumber && <div style={{ fontSize: 10, color: "#2563EB", fontWeight: 600 }}>#{e.batchNumber}</div>}
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#64748B" }}>{fmt(e.openingBalance)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#16A34A" }}>{fmt(e.receivedFromVendor)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#0F172A" }}>{fmt(e.totalConsumption)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#D97706" }}>{fmt(e.extraCount)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#DC2626" }}>{fmt(e.damaged)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", color: "#64748B" }}>{fmt(e.movedToOtherSite)}</td>

                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {tr ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: tr.status === "DELIVERED" ? "#DCFCE7" : "#FFEDD5", color: tr.status === "DELIVERED" ? "#15803D" : "#C2410C" }}>
                              {tr.status === "DELIVERED" ? "Delivered" : "In Transit"}
                            </span>
                          ) : "—"}
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: e.closingBalance < 0 ? "#DC2626" : "#0F172A" }}>
                          {fmt(e.closingBalance)}
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <button
                            onClick={() => del(e.id)}
                            style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer", padding: 4, borderRadius: 4 }}
                            title="Delete entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === 1 ? "#F1F5F9" : "#FFFFFF", color: page === 1 ? "#CBD5E1" : "#334155", fontSize: 12, fontWeight: 600, cursor: page === 1 ? "not-allowed" : "pointer" }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 12, color: "#64748B", fontFamily: "monospace" }}>Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === totalPages ? "#F1F5F9" : "#FFFFFF", color: page === totalPages ? "#CBD5E1" : "#334155", fontSize: 12, fontWeight: 600, cursor: page === totalPages ? "not-allowed" : "pointer" }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}