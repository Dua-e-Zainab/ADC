// src/components/ui/Field.jsx
import { C } from "../../constants/color";

export default function Field({ label, req, hint, hintType, children }) {
  const hc = { info: C.blue, transit: C.orange, success: C.green };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".7px" }}>
        {label}{req && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: hc[hintType] || C.textFaint }}>{hint}</span>}
    </div>
  );
}