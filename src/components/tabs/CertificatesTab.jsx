import { useState, useMemo, useCallback, useEffect } from "react";
import { 
  CreditCard, 
  Gem, 
  Building2, 
  AlertCircle, 
  Download, 
  Inbox 
} from "lucide-react";
import { C } from "../../constants/color";
import { fmt } from "../../utils/helper";
import { Card, CardHeader } from "../ui/Card";
import Field from "../ui/Field";
import NPC from "../../assets/NPC.png";

// Inline Status Dot Helper
const StatusDot = ({ color, size = 8 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block" }} />
);

export default function CertificatesTab({ 
  entries = [], 
  currentSite = "KHI", 
  isLoading = false, 
  error = null 
}) {
  // Main State Scopes
  const [cardType, setCardType] = useState("CREDIT");
  const [site, setSite] = useState(() => (currentSite ? String(currentSite).trim().toUpperCase() : "KHI"));
  const [dates, setDates] = useState({ cert: "", from: "", to: "" });
  const [signs, setSigns] = useState({ officer: "", supervisor: "", custA: "", custB: "" });

  // Sync site state with incoming prop updates
  useEffect(() => {
    if (currentSite) {
      setSite(String(currentSite).trim().toUpperCase());
    }
  }, [currentSite]);

  // Event Handlers
  const handleCardTypeChange = (type) => setCardType(type);
  const handleSiteChange = (selectedSite) => setSite(selectedSite);
  const handleDateChange = (field, value) => setDates((prev) => ({ ...prev, [field]: value }));
  const handleSignatoryChange = (key, value) => setSigns((prev) => ({ ...prev, [key]: value }));

  const inputStyle = {
    height: 42,
    width: "100%",
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 13,
    color: C.text,
    outline: "none",
    transition: "border-color 0.2s ease"
  };

  const fields = [
    { key: "officer", label: "Production Officer" },
    { key: "supervisor", label: "Production Supervisor" },
    { key: "custA", label: 'Vault Custodian "A"' },
    { key: "custB", label: 'Vault Custodian "B"' }
  ];

  // Aggregation Engine
  const damagedRows = useMemo(() => {
    if (!Array.isArray(entries) || isLoading) return [];

    const map = {};
    const activeSite = (site || "").trim().toUpperCase();

    entries
      .filter((e) => {
        if (!e) return false;

        const entryCardType = String(e.cardType || "").trim().toUpperCase();
        const entrySite = String(e.site || "").trim().toUpperCase();
        const damagedQty = Number(e.damaged) || 0;

        const isSiteMatch =
          entrySite === activeSite ||
          (activeSite === "LHR" && entrySite === "LHE") ||
          (activeSite === "LHE" && entrySite === "LHR");

        return (
          entryCardType === cardType &&
          isSiteMatch &&
          damagedQty > 0 &&
          (!dates.from || e.date >= dates.from) &&
          (!dates.to || e.date <= dates.to)
        );
      })
      .forEach((e) => {
        const category = e.plasticCategory || "Uncategorized";
        map[category] = (map[category] || 0) + Number(e.damaged);
      });

    return Object.entries(map)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [entries, cardType, site, dates, isLoading]);

  const total = useMemo(() => damagedRows.reduce((s, r) => s + r.count, 0), [damagedRows]);
  const label = `${cardType === "CREDIT" ? "Credit" : "Debit"} Card Cut & Filed`;

  // Print Handling
  const handlePrintCertificate = useCallback(() => {
    const dStr = dates.cert
      ? new Date(dates.cert).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
      : "________________";

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Destruction Certificate - ${site}</title>
          <style>
            @media print { 
              @page { margin: 25mm 20mm; size: A4; } 
              body { -webkit-print-color-adjust: exact; } 
            }
            body { font-family: 'Times New Roman', serif; padding: 20px; color: #111; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 15px; margin-bottom: 40px; }
            h1 { text-align: center; font-size: 24px; text-transform: uppercase; margin: 0; }
            h2 { text-align: center; font-size: 16px; font-style: italic; font-weight: normal; margin: 5px 0 35px; }
            table { border-collapse: collapse; margin: 30px auto; width: 100%; font-size: 14px; }
            th, td { border: 1px solid #111; padding: 10px 12px; }
            th { background: #f5f5f5; text-transform: uppercase; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 80px; row-gap: 60px; margin-top: 70px; font-size: 14px; text-align: center; }
            .line { border-top: 1px solid #222; padding-top: 6px; font-weight: bold; min-height: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${NPC}" style="height:42px; object-fit:contain;" alt="Logo" />
            <div style="text-align:right; font-weight:bold; font-size:12px;">LOCATION SCOPE: ${site}</div>
          </div>
          <h1>Destruction Certificate</h1>
          <h2>Cards Damaged During Production (${site})</h2>
          <table style="margin-bottom:30px; border:none;">
            <tr style="border:none;">
              <td style="border:none;"><strong>Date:</strong> ${dStr}</td>
              <td style="border:none;"><strong>Site:</strong> ${site}</td>
              <td style="border:none; text-align:right;"><strong>Category:</strong> <u>${label}</u></td>
            </tr>
          </table>
          <div style="font-size:15px; text-indent:30px; text-align:justify; margin-bottom:20px;">
            This is to certify that a total of <strong>${total}</strong> damaged card(s) detailed below for site <strong>${site}</strong> have been completely destroyed and disposed of as per official compliance protocols.
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align:left">Plastic Sub-Category Name</th>
                <th style="width:30%">Damaged Count</th>
              </tr>
            </thead>
            <tbody>
              ${damagedRows
                .map(
                  (r) => `
                <tr>
                  <td>${r.category}</td>
                  <td style="text-align:center; font-weight:600">${fmt(r.count)}</td>
                </tr>`
                )
                .join("")}
              <tr style="font-weight:bold; background:#fafafa">
                <td style="border-top:2px solid #111">GRAND TOTAL (${site})</td>
                <td style="text-align:center; border-top:2px solid #111">${fmt(total)}</td>
              </tr>
            </tbody>
          </table>
          <div class="grid">
            ${fields
              .map(
                (f) => `
              <div>
                <div class="line">${signs[f.key] || "&nbsp;"}</div>
                <div style="font-size:13px; color:#333;">${f.label}</div>
              </div>`
              )
              .join("")}
          </div>
        </body>
      </html>
    `);

    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [damagedRows, total, dates, label, signs, site, fields]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text }}>Destruction Certificates</h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Review site damaged inventory aggregations and print official compliance destruction slips.
          </p>
        </div>
        <div
          style={{
            padding: "6px 16px",
            borderRadius: 20,
            background: `${C.navy}10`,
            border: `1.5px solid ${C.navy}`,
            color: C.navy,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Building2 size={14} />
          ACTIVE SITE: {site}
        </div>
      </div>

      {/* Network / Async Error Alert */}
      {error && (
        <div
          style={{
            padding: "14px 20px",
            marginBottom: 24,
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <AlertCircle size={18} color="#991b1b" />
          <span><strong>VM Data Fetch Error:</strong> {typeof error === "string" ? error : error.message || "Failed to load site entries."}</span>
        </div>
      )}

      {/* Step 1: Configuration Form */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <CardHeader step="1" title="Certificate Parameters" sub={`Define parameters and signatories for ${site}`} />
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Card Type Selection */}
            <Field label="Card Type Classification" req>
              <div style={{ display: "flex", gap: 10 }}>
                {["DEBIT", "CREDIT"].map((t) => {
                  const active = cardType === t;
                  const activeColor = t === "DEBIT" ? C.blue : C.red;
                  const IconComponent = t === "DEBIT" ? CreditCard : Gem;

                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => handleCardTypeChange(t)}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        border: `1.5px solid ${active ? activeColor : C.border}`,
                        background: active ? `${activeColor}10` : C.surface,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? activeColor : C.textMuted
                      }}
                    >
                      <IconComponent size={16} />
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Site Scope Toggle */}
            <Field label="Facility Location" req>
              <div style={{ display: "flex", gap: 10 }}>
                {["KHI", "LHR"].map((s) => {
                  const active = site === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => handleSiteChange(s)}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        border: `1.5px solid ${active ? C.navy : C.border}`,
                        background: active ? `${C.navy}10` : C.surface,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? C.navy : C.textMuted
                      }}
                    >
                      <StatusDot color={active ? C.navy : "#94a3b8"} size={8} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Certificate Date */}
            <Field label="Certificate Issue Date">
              <input
                type="date"
                value={dates.cert}
                onChange={(e) => handleDateChange("cert", e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Activity Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            {["from", "to"].map((k) => (
              <Field key={k} label={`Activity ${k === "from" ? "Start" : "End"} Date (${k === "from" ? "From" : "To"})`}>
                <input
                  type="date"
                  value={dates[k]}
                  onChange={(e) => handleDateChange(k, e.target.value)}
                  style={inputStyle}
                />
              </Field>
            ))}
          </div>

          {/* Signatories */}
          <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16, textTransform: "uppercase" }}>
              Authorized Signatories
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, rowGap: 16 }}>
              {fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    value={signs[f.key]}
                    onChange={(e) => handleSignatoryChange(f.key, e.target.value)}
                    placeholder="Full Name"
                    style={inputStyle}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Step 2: Data Matrix / Loading Skeletons */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <CardHeader
          step="2"
          title="Damaged Card Preview Matrix"
          sub={`${cardType} Category Breakdowns — ${site} Facility (${damagedRows.length} Categories)`}
        />
        <div style={{ padding: 24 }}>
          {isLoading ? (
            /* Loading Skeleton View */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  style={{
                    height: 40,
                    borderRadius: 6,
                    background: "#e2e8f0",
                    animation: "pulse 1.5s infinite"
                  }}
                />
              ))}
            </div>
          ) : !damagedRows.length ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                color: C.textMuted,
                fontSize: 13,
                background: C.surface,
                borderRadius: 8,
                border: `1px dashed ${C.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8
              }}
            >
              <Inbox size={28} color={C.textMuted} />
              <div>No damaged records found matching parameters for site <strong>{site}</strong>.</div>
            </div>
          ) : (
            <div style={{ overflow: "hidden", borderRadius: 8, border: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.navy || "#1e293b", color: "#fff" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                      Plastic Sub-Category Name
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, textTransform: "uppercase", width: "25%" }}>
                      Damaged Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {damagedRows.map((r, i) => (
                    <tr
                      key={r.category}
                      style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : C.surface }}
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500 }}>{r.category}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        {fmt(r.count)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f8fafc", borderTop: `2px solid ${C.navy || "#1e293b"}`, fontWeight: 700 }}>
                    <td style={{ padding: "14px 16px" }}>AGGREGATE TOTAL QUANTITY ({site})</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", fontSize: 14 }}>
                      {fmt(total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Action Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 40 }}>
        <button
          type="button"
          onClick={handlePrintCertificate}
          disabled={!damagedRows.length || isLoading}
          style={{
            height: 46,
            padding: "0 28px",
            borderRadius: 8,
            border: "none",
            background: damagedRows.length && !isLoading ? C.navy || "#1e293b" : C.border,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: damagedRows.length && !isLoading ? "pointer" : "not-allowed",
            transition: "background-color 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Download size={16} />
          Generate & Print Destruction Slips ({site})
        </button>
      </div>
    </div>
  );
}