// src/components/ui/Pill.jsx
import { C } from "../../constants/color";

export function Pill({ label, color, bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      color: color || C.blue, background: bg || C.blueLight,
      border: `1px solid ${border || C.blueBorder}`, letterSpacing: ".2px"
    }}>
      {label}
    </span>
  );
}

export function InvTypePill({ type }) {
  const MAP = {
    PLASTIC:  { c: C.blue,   bg: C.blueLight,   bd: C.blueBorder },
    MAILER:   { c: C.purple, bg: C.purpleLight,  bd: C.purpleBorder },
    ENVELOPE: { c: C.teal,   bg: C.tealLight,    bd: C.tealBorder },
  };
  const ICONS = { PLASTIC: "💳", MAILER: "📬", ENVELOPE: "✉️" };
  const m = MAP[type] || MAP.PLASTIC;
  return <Pill label={`${ICONS[type] || ""} ${type}`} color={m.c} bg={m.bg} border={m.bd} />;
}

export function SegPill({ seg }) {
  const MAP = {
    NTB:     { c: C.blue,   bg: C.blueLight,   bd: C.blueBorder },
    ETB:     { c: C.amber,  bg: C.amberLight,  bd: C.amberBorder },
    RENEWAL: { c: C.purple, bg: C.purpleLight,  bd: C.purpleBorder },
  };
  const m = MAP[seg] || MAP.ETB;
  return <Pill label={seg} color={m.c} bg={m.bg} border={m.bd} />;
}

export function SitePill({ site }) {
  const c  = site === "KHI" ? C.blue   : C.purple;
  const bg = site === "KHI" ? C.blueLight  : C.purpleLight;
  const bd = site === "KHI" ? C.blueBorder : C.purpleBorder;
  return <Pill label={site === "KHI" ? " KHI" : " LHE"} color={c} bg={bg} border={bd} />;
}