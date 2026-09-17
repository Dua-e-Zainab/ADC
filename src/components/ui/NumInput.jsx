// src/components/ui/NumInput.jsx
import { C } from "../../constants/color";

export default function NumInput({ val, onChange, readOnly, highlight }) {
  return (
    <input
      type="number" value={val} min={0}
      readOnly={readOnly}
      onChange={e => !readOnly && onChange(e.target.value)}
      style={{
        height: 42, width: "100%",
        border: `1.5px solid ${readOnly ? C.blueBorder : highlight ? C.greenBorder : C.border}`,
        borderRadius: 8, padding: "0 12px",
        fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600,
        color: readOnly ? C.blue : highlight ? C.green : C.text,
        background: readOnly ? C.blueLight : highlight ? C.greenLight : "#fff",
        textAlign: "right", outline: "none", transition: "border-color .15s"
      }}
    />
  );
}