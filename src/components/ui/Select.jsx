// src/components/ui/Select.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { C } from "../../constants/color";

export default function Select({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState("");
  const ref = useRef();

  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(q.toLowerCase())),
    [options, q]
  );

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQ(""); } }}
        style={{
          width: "100%", height: 42, border: `1.5px solid ${C.border}`, borderRadius: 8,
          padding: "0 32px 0 12px", background: disabled ? "#F7F8FC" : "#fff",
          textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
          color: value ? C.text : C.textFaint, fontSize: 13,
          display: "flex", alignItems: "center", opacity: disabled ? .5 : 1,
          transition: "border-color .15s", outline: "none"
        }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder || "— Select —"}
        </span>
        <span style={{ position: "absolute", right: 10, color: C.textFaint, pointerEvents: "none", fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: `1.5px solid ${C.blueBorder}`, borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,.12)", zIndex: 9999, overflow: "hidden"
        }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.textFaint }}>⌕</span>
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, width: "100%", color: C.text }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length
              ? filtered.map(opt => (
                <div key={opt}
                  onMouseDown={() => { onChange(opt); setOpen(false); setQ(""); }}
                  style={{
                    padding: "9px 12px", fontSize: 12,
                    fontWeight: opt === value ? 600 : 400, cursor: "pointer",
                    background: opt === value ? C.blueLight : "transparent",
                    color: opt === value ? C.blue : C.textMid,
                    transition: "background .1s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.blueLight}
                  onMouseLeave={e => e.currentTarget.style.background = opt === value ? C.blueLight : "transparent"}
                >
                  {opt}
                </div>
              ))
              : <div style={{ padding: 14, fontSize: 12, color: C.textFaint, textAlign: "center" }}>No results</div>
            }
          </div>
        </div>
      )}
    </div>
  );
}