// src/components/ui/Card.jsx
import { C } from "../../constants/color";

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.border}`,
      borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      overflow: "visible", ...style
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ step, title, sub, badge }) {
  return (
    <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
      {step && (
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: C.navy, color: "#fff",
          fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0
        }}>
          {step}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>{sub}</div>}
      </div>
      {badge}
    </div>
  );
}