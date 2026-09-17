// src/components/ui/Toast.jsx
import { C } from "../../constants/color";

const TCLR   = { success: C.green,  error: C.red,      info: C.blue,      warn: C.amber,      transit: C.orange };
const TBCLR  = { success: C.greenLight, error: C.redLight, info: C.blueLight, warn: C.amberLight, transit: C.orangeLight };
const TICONS = { success: "✓", error: "✕", info: "i", warn: "!", transit: "→" };

export default function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderRadius: 10, fontSize: 13, fontWeight: 500, minWidth: 280, maxWidth: 380,
          background: TBCLR[t.type] || C.blueLight,
          color: TCLR[t.type] || C.blue,
          border: `1px solid ${TCLR[t.type] || C.blue}33`,
          boxShadow: "0 4px 20px rgba(0,0,0,.1)", pointerEvents: "auto", animation: "slideIn .25s ease"
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: "50%",
            background: TCLR[t.type] || C.blue, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, flexShrink: 0
          }}>
            {TICONS[t.type] || "i"}
          </span>
          <span style={{ flex: 1 }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}