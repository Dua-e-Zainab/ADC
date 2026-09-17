// src/components/ui/SegBtn.jsx
import { C } from "../../constants/color";

export default function SegBtn({ code, label, active, onSelect }) {
  const COLS = {
    NTB:     [C.blueLight,   C.blueBorder,   C.blue],
    ETB:     [C.amberLight,  C.amberBorder,  C.amber],
    RENEWAL: [C.purpleLight, C.purpleBorder, C.purple],
  };
  const [bg, bd, tc] = active === code ? COLS[code] : [C.surface, C.border, C.textMuted];

  return (
    <div
      onClick={() => onSelect(code)}
      style={{
        flex: 1, height: 64, borderRadius: 8, border: `1.5px solid ${bd}`,
        background: bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
        cursor: "pointer", transition: "all .15s"
      }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: tc }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: tc, letterSpacing: ".3px" }}>{code}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: tc, textTransform: "uppercase", letterSpacing: ".4px", opacity: .8 }}>{label}</div>
    </div>
  );
}