import { C } from "../../constants/color";
import { SitePill } from "../ui/Pill";

export default function SharedSyncBanner({ currentSite }) {
  return (
    <div style={{
      background: `linear-gradient(90deg, ${C.navy} 0%, #1e3a5f 100%)`,
      borderRadius: 10, padding: "10px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 10,
      border: `1px solid ${C.navyLight}`
    }}>
     
      
      <SitePill site={currentSite} />
    </div>
  );
}