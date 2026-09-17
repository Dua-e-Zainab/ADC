import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import apiClient from "./utils/apiClient";

import { C } from "./constants/color";
import { today, fmt } from "./utils/helper";
import { buildForecast } from "./utils/forecast";
import useToast from "./hooks/useToast";

import Modal from "./components/ui/Modal";
import Toast from "./components/ui/Toast";
import { SitePill } from "./components/ui/Pill";
import Sidebar from "./components/layout/Sidebar";
import Login from "./components/layout/Login";

import EntryTab from "./components/tabs/EntryTab";
import BalancesTab from "./components/tabs/BalancesTab";
import HistoryTab from "./components/tabs/HistoryTab";
import TransitTab from "./components/tabs/TransitTab";
import ReportsTab from "./components/tabs/ReportsTab";
import ForecastTab from "./components/tabs/ForecastTab";
import ConsumablesTab from "./components/tabs/ConsumblesTab";
import CertificateTab from "./components/tabs/CertificatesTab";
import axios from "axios";

// Reusable Layout Styles
const styles = {
  container: { display: "flex", minHeight: "100vh", background: C.surface, fontFamily: "'DM Sans', sans-serif" },
  mainWrapper: { marginLeft: 240, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" },
  header: {
    height: 52, background: "#fff", borderBottom: `1px solid ${C.border}`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 24px", position: "sticky", top: 0, zIndex: 100
  },
  headerFlex: { display: "flex", alignItems: "center", gap: 8 },
  badge: {
    display: "flex", alignItems: "center", gap: 5, padding: "3px 10px",
    borderRadius: 20, background: "rgba(52,211,153,.1)", border: "1px solid rgba(52,211,153,.3)"
  },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#34D399" },
  dateBadge: { fontSize: 11, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, padding: "4px 12px", borderRadius: 20 },
  loadingBanner: { marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: C.blueLight, border: `1px solid ${C.blueBorder}`, color: C.blue, fontSize: 11, fontWeight: 600 },
  authChecking: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: C.textMuted, fontSize: 14 }
};

export default function App() {
  const [currentSite, setCurrentSite] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("entry");
  const [modal, setModal] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [toasts, toast] = useToast();

  // Application Data States
  const [allEntries, setAllEntries] = useState([]);
  const [closing, setClosing] = useState({});
  const [transitRecords, setTransitRecords] = useState([]);
  const [orders, setOrders] = useState({});

  // Local / Imported Data States
  const [irisRecords, setIrisRecords] = useState({});
  const [irisFiles, setIrisFiles] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyFileName, setDailyFileName] = useState("");

  const loadingRef = useRef(false);
  const loadedSiteRef = useRef(null);
  const prevPending = useRef(null);
  const lheAlerted = useRef(false);

  const showAlert = useCallback((cfg) => setModal(cfg), []);

  // Centralized State Reset
  const resetAppData = useCallback(() => {
    setCurrentSite(null);
    setTab("entry");
    setAllEntries([]);
    setClosing({});
    setTransitRecords([]);
    setOrders({});
    loadedSiteRef.current = null;
  }, []);

  // Normalizer Helpers
  const normalizeEntry = useCallback((e) => ({
    id: e.id, date: e.date, site: e.site, invType: e.inv_type, cardType: e.card_type,
    scheme: e.scheme, plasticCategory: e.plastic_category, subProduct: e.sub_product,
    pageSize: e.page_size, segment: e.segment, batchNumber: e.batch_number,
    openingBalance: e.opening_balance, receivedFromVendor: e.received_from_vendor,
    totalConsumption: e.batch_count, extraCount: e.extra_count, damaged: e.damaged,
    movedToOtherSite: e.moved_to_other_site, closingBalance: e.closing_balance,
    savedAt: e.saved_at, sourceExcel: e.source_excel,
  }), []);

  const normalizeTransit = useCallback((r) => ({
    id: r.id, entryId: r.entry_id ?? r.entryId, fromSite: r.from_site ?? r.fromSite,
    toSite: r.to_site ?? r.toSite, date: r.date, invType: r.inv_type ?? r.invType,
    cardType: r.card_type ?? r.cardType, scheme: r.scheme, plasticCategory: r.plastic_category ?? r.plasticCategory,
    subProduct: r.sub_product ?? r.subProduct, segment: r.segment, quantity: r.quantity,
    note: r.note, status: r.status, createdAt: r.created_at ?? r.createdAt, deliveredAt: r.delivered_at ?? r.deliveredAt ?? null,
  }), []);

  // Server Fetching
  const loadSharedData = useCallback(async (site, force = false) => {
    if (!site || (!force && loadedSiteRef.current === site) || loadingRef.current) return;

    loadingRef.current = true;
    setLoadingData(true);

    try {
      const [entriesRes, closingRes, transitRes, ordersRes] = await Promise.all([
       axios.get("/entries"),
       axios.get("/closing-balances"),
        axios.get("/transit-records"),
        axios.get("/orders"),
      ]);

      const entriesData = Array.isArray(entriesRes.data) ? entriesRes.data.map(normalizeEntry) : [];
      let closingData = {};

      if (Array.isArray(closingRes.data)) {
        closingRes.data.forEach((r) => {
          const key = r.balance_key ?? r.balanceKey;
          if (key) {
            closingData[key] = {
              value: Number(r.value) || 0,
              updatedAt: r.updated_at ?? r.updatedAt ?? null,
              date: r.entry_date ?? r.entryDate ?? null,
              updatedBy: r.updated_by ?? r.updatedBy ?? null,
            };
          }
        });
      } else if (closingRes.data && typeof closingRes.data === "object") {
        closingData = closingRes.data;
      }

      setAllEntries(entriesData);
      setClosing(closingData);
      setTransitRecords(Array.isArray(transitRes.data) ? transitRes.data.map(normalizeTransit) : []);
      setOrders(ordersRes.data || {});
      loadedSiteRef.current = site;
    } catch (err) {
      console.error("Failed to load shared application data:", err.response?.data || err.message);
      showAlert({
        type: "error", title: "Unable to Load Data",
        msg: "The shared inventory data could not be loaded. Please check the server connection and try again.",
      });
    } finally {
      loadingRef.current = false;
      setLoadingData(false);
    }
  }, [normalizeEntry, normalizeTransit, showAlert]);

  // Check for an existing server session on load (page refresh, revisit, etc.)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await axios.get("/auth/me");
        const site = res.data.user.site;
        setCurrentSite(site);
        await loadSharedData(site, true);
      } catch {
        setCurrentSite(null);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event Handlers
  const handleLogin = useCallback(async (site) => {
    setCurrentSite(site);
    setTab("entry");
    await loadSharedData(site, true);
  }, [loadSharedData]);

  const handleSiteChange = useCallback((site) => {
    setCurrentSite(site);
    setTab("entry");
    setAllEntries([]);
    setClosing({});
    setTransitRecords([]);
    setOrders({});
    loadedSiteRef.current = null;
    loadSharedData(site, true);
  }, [loadSharedData]);

  const signOut = useCallback(() => {
    showAlert({
      type: "warn", title: "Sign Out?",
      msg: "You will be signed out. All data is saved in the shared ledger.",
      buttons: [
        { label: "Cancel", type: "secondary" },
        {
          label: "🚪 Sign Out", type: "primary", color: C.red,
          onClick: async () => {
            try {
              await apiClient.post("/auth/logout");
            } catch (err) {
              console.error("Logout request failed:", err.message);
            }
            resetAppData();
          },
        },
      ],
    });
  }, [showAlert, resetAppData]);

  useEffect(() => {
  const checkSession = async () => {
    try {
      const res = await axios.get("/api/auth/me");
      const site = res.data.user.site;
      setCurrentSite(site);
      await loadSharedData(site, true);
    } catch {
      setCurrentSite(null);
    }
  };
  checkSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    if (currentSite && loadedSiteRef.current !== currentSite) loadSharedData(currentSite);
  }, [currentSite, loadSharedData]);

  // Derived Values
  const pendingTransit = useMemo(() => transitRecords.filter(r => r.toSite === "LHE" && r.status === "IN_TRANSIT").length, [transitRecords]);
  const criticalCount = useMemo(() => buildForecast(allEntries, closing, orders).filter(r => r.status === "CRITICAL").length, [allEntries, closing, orders]);

  // LHE Transit Notifications Effect
  useEffect(() => {
    if (!currentSite || currentSite !== "LHE") {
      lheAlerted.current = false;
      prevPending.current = null;
      return;
    }

    if (prevPending.current === null) {
      prevPending.current = pendingTransit;
      if (pendingTransit > 0 && !lheAlerted.current) {
        lheAlerted.current = true;
        const recs = transitRecords.filter(r => r.toSite === "LHE" && r.status === "IN_TRANSIT");
        showAlert({
          type: "transit", title: "Stock In Transit!",
          msg: `<strong>${recs.length} shipment${recs.length > 1 ? "s" : ""}</strong> from Karachi are <strong>In Transit</strong>.<br/>Marking delivered will auto-update the shared balance.`,
          buttons: [
            { label: "View Transit", type: "primary", color: C.orange, onClick: () => setTab("transit") },
            { label: "Dismiss", type: "secondary" },
          ],
        });
      }
      return;
    }

    if (pendingTransit > prevPending.current) {
      const newest = [...transitRecords.filter(r => r.toSite === "LHE" && r.status === "IN_TRANSIT")]
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];

      if (newest) {
        showAlert({
          type: "transit", title: "New Shipment!",
          msg: `<strong>${fmt(newest.quantity)} units</strong> of <strong>${newest.subProduct}</strong> dispatched from Karachi.`,
          buttons: [
            { label: "View", type: "primary", color: C.orange, onClick: () => setTab("transit") },
            { label: "OK", type: "secondary" },
          ],
        });
        toast(`New: ${fmt(newest.quantity)} units of ${newest.subProduct}`, "transit");
      }
    }
    prevPending.current = pendingTransit;
  }, [pendingTransit, currentSite, transitRecords, showAlert, toast]);

  // Excel Export Handler
  const exportXL = useCallback(() => {
    if (!window.XLSX) return toast("XLSX not loaded.", "error");

    const wb = window.XLSX.utils.book_new();

    const addSheet = (headers, rows, sheetName) => {
      const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(
      ["SITE", "DATE", "INV TYPE", "CARD TYPE", "SCHEME", "CATEGORY", "SUB PRODUCT", "PAGE SIZE", "SEGMENT", "BATCH NUMBER", "OPENING", "RECEIVED", "CONSUMPTION", "EXTRA", "DAMAGED", "MOVED", "CLOSING"],
      [...allEntries].sort((a, b) => a.date.localeCompare(b.date)).map(e => [
        e.site, e.date, e.invType || "PLASTIC", e.cardType, e.scheme, e.plasticCategory, e.subProduct || "—",
        e.pageSize || "—", e.segment, e.batchNumber || "", e.openingBalance, e.receivedFromVendor,
        e.totalConsumption, e.extraCount || 0, e.damaged, e.movedToOtherSite, e.closingBalance
      ]),
      "Entries"
    );

    addSheet(
      ["FROM", "TO", "DATE", "INV TYPE", "SCHEME", "SUB PRODUCT", "QTY", "STATUS", "NOTE"],
      transitRecords.map(r => [r.fromSite, r.toSite, r.date, r.invType || "PLASTIC", r.scheme, r.subProduct, r.quantity, r.status, r.note || ""]),
      "Transit"
    );

    addSheet(
      ["KEY", "VALUE", "UPDATED BY", "DATE", "UPDATED AT"],
      Object.entries(closing).map(([k, v]) => [k, v?.value || 0, v?.updatedBy || "", v?.date || "", v?.updatedAt || ""]),
      "Closing Balances"
    );

    window.XLSX.writeFile(wb, `UBL_CardStock_Shared_${today()}.xlsx`);
    toast("Exported successfully.", "success");
  }, [allEntries, transitRecords, closing, toast]);

  if (checkingSession) {
    return <div style={styles.authChecking}>Checking session…</div>;
  }

  if (!currentSite) return <Login onLogin={handleLogin} />;

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  // Active Tab Mapping Component
  const renderActiveTab = () => {
    const tabProps = {
      entry: { setOrders, orders, entries: allEntries, setEntries: setAllEntries, closing, setClosing, toast, showAlert, transitRecords, setTransitRecords, currentSite, irisRecords, setIrisRecords, irisFiles, setIrisFiles, dailyRows, setDailyRows, dailyFileName, setDailyFileName },
      balances: { closing, setClosing, toast, showAlert, entries: allEntries, currentSite },
      history: { allEntries, setAllEntries, toast, transitRecords, currentSite },
      transit: { currentSite, transitRecords, setTransitRecords, toast, showAlert, closing, setClosing, allEntries, setAllEntries },
      reports: { entries: allEntries, dailyRows, currentSite ,closing},
      forecast: { entries: allEntries, closing, currentSite, orders, setOrders },
      consumables: { entries: allEntries, siteId: currentSite },
      certificate: { entries: allEntries, currentSite },
    };

    const TabComponents = {
      entry: EntryTab,
      balances: BalancesTab,
      history: HistoryTab,
      transit: TransitTab,
      reports: ReportsTab,
      forecast: ForecastTab,
      consumables: ConsumablesTab,
      certificate: CertificateTab,
    };

    const ActiveComponent = TabComponents[tab];
    return ActiveComponent ? <ActiveComponent {...tabProps[tab]} /> : null;
  };

  return (
    <>
      <Modal modal={modal} onClose={() => setModal(null)} />

      <div style={styles.container}>
        <Sidebar
          site={currentSite} tab={tab} setTab={setTab}
          pendingTransit={pendingTransit} criticalCount={criticalCount}
          irisFiles={irisFiles} dailyRows={dailyRows}
          onSwitchSite={() => showAlert({
            type: "info", title: "Switch Site?",
            msg: "You'll be returned to the login screen. All data is shared.",
            buttons: [
              { label: "Cancel", type: "secondary" },
              { label: "Switch", type: "primary", onClick: resetAppData },
            ],
          })}
          onExport={exportXL} onSignOut={signOut}
        />

        <div style={styles.mainWrapper}>
          <header style={styles.header}>
            <div style={styles.headerFlex}>
              <span style={{ fontSize: 14, color: C.textFaint }}>UBL CardStock</span>
              <span style={{ color: C.border }}>›</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textMid }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </span>
            </div>

            <div style={styles.headerFlex}>
              <div style={styles.badge}>
                <div style={styles.dot} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>Shared Ledger</span>
              </div>
              <SitePill site={currentSite} />
              <span style={styles.dateBadge}>{dateStr}</span>
            </div>
          </header>

          <main style={{ flex: 1, padding: "24px 28px 56px" }}>
            {loadingData && <div style={styles.loadingBanner}>Loading shared inventory data…</div>}
            {renderActiveTab()}
          </main>
        </div>

        <Toast toasts={toasts} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.borderStrong}; border-radius: 3px; }
      `}</style>
    </>
  );
}