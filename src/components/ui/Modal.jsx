// src/components/ui/Modal.jsx
import { C } from "../../constants/color";

const ICONS  = { success: "✅", error: "❌", info: "ℹ️", warn: "⚠️", transit: "🚚", delivered: "✅" };
const COLORS = { success: C.green, error: C.red, info: C.blue, warn: C.amber, transit: C.orange, delivered: C.green };

export default function Modal({ modal, onClose }) {
  if (!modal) return null;
  const c = COLORS[modal.type] || C.blue;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.6)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
    >
      <div style={{ background: "#fff", borderRadius: 20, width: 440, boxShadow: "0 32px 80px rgba(0,0,0,.3)", overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div style={{ padding: "32px 32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${c}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: `2px solid ${c}30` }}>
            {ICONS[modal.type] || "ℹ️"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, textAlign: "center" }}>{modal.title}</div>
        </div>
        <div
          style={{ padding: "0 32px 24px", fontSize: 13, color: C.textMid, textAlign: "center", lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: modal.msg }}
        />
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", justifyContent: "center", gap: 10, borderRadius: "0 0 20px 20px" }}>
          {(modal.buttons || [{ label: "OK", type: "primary" }]).map((btn, i) => (
            <button key={i}
              onClick={() => { btn.onClick?.(); onClose(); }}
              style={{
                height: 40, padding: "0 24px", borderRadius: 8,
                border: btn.type === "secondary" ? `1.5px solid ${C.border}` : "none",
                background: btn.type === "secondary" ? "#fff" : btn.color || C.navy,
                color: btn.type === "secondary" ? C.textMuted : "#fff",
                fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "opacity .15s"
              }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}