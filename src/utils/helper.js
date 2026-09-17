
export const today = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
export const ckp = (ct, sc, cat, sub, invType="PLASTIC") => `${invType}|${ct}|${sc}|${cat}|${sub}`;
export const ckCat = (ct, sc, cat, invType="PLASTIC") => `${invType}|${ct}|${sc}|${cat}`;
export const ckCatSite = (ct, sc, cat, invType, site) => `${site}|${invType}|${ct}|${sc}|${cat}`;
export const fmt = n => Number(n||0).toLocaleString();
export const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.slice(0, 10).split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day}-${months[parseInt(month, 10) - 1]}-${year}`;
};
export const fmtTime = iso => { try { return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };
export const addDays = (ds,n) => {
    const d = new Date(ds);
    d.setDate(d.getDate()+n);
    return d.toISOString().split("T")[0];
};export const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);
export const norm = s => s.toUpperCase().replace(/\s+/g," ").trim();