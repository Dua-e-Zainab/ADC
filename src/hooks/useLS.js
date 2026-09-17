import { useState, useCallback } from "react";

export default function useLS(key, fallback) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const p = JSON.parse(raw);
      if (Array.isArray(fallback) && !Array.isArray(p)) return fallback;
      if (!Array.isArray(fallback) && typeof fallback === "object" && typeof p !== "object") return fallback;
      return p;
    } catch { return fallback; }
  });

  const set = useCallback(v => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }, [key]);

  return [val, set];
}