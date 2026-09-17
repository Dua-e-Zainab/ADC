// constants/icons.js
// Centralized icon mapping — replaces all emoji usage across the app.
// Import specific icons from here instead of typing emoji characters,
// so the whole app stays visually consistent.

import {
  CreditCard,      // was 💳 (PLASTIC)
  Mail,            // was 📬 (MAILER)
  MailOpen,        // was ✉️ (ENVELOPE)
  Truck,           // was 🚚 (transit / dispatch)
  CheckCircle2,    // was ✅ (success / delivered)
  AlertTriangle,   // was 🚨 (critical alert)
  AlertCircle,     // was ⚠️ (warning)
  BarChart3,       // was 📊 / 📈 (forecast / analytics)
  Calendar,        // was 📅 (date)
  Building2,       // was 🏙️ / 🌆 (site: KHI / LHE)
  Inbox,           // was 📭 (empty state)
  RefreshCw,       // was 🔄 (refresh / commit shift)
  Download,        // was ⬇ (export / download)
  Upload,          // was 📥 (import)
  Wrench,          // was 🔧 (hardware / consumables)
  Circle,          // was 🥈⬛⬜🔲 (ribbon color swatches)
  Package,         // was 📦 (orders / stock)
  Clock,           // was ⏰ / ⏳ (pending / waiting)
  FileSpreadsheet, // was 📋 (daily stock upload)
  Search,          // was ⌕ (search fields)
  X,               // was ✕ / × (close / clear / delete)
  Gem,             // was 💎 (CREDIT card type)
  ClipboardList,   // was 📝 (notes)
  DoorOpen,        // was 🚪 (sign out)
} from "lucide-react";

// Status colors stay as plain colored dots (already done in some places) —
// no emoji needed, just a small styled <div>:
export const StatusDot = ({ color, size = 8 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block" }} />
);

export const ICONS = {
  plastic: CreditCard,
  mailer: Mail,
  envelope: MailOpen,
  transit: Truck,
  success: CheckCircle2,
  critical: AlertTriangle,
  warning: AlertCircle,
  analytics: BarChart3,
  date: Calendar,
  site: Building2,
  empty: Inbox,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  hardware: Wrench,
  swatch: Circle,
  package: Package,
  pending: Clock,
  dailyStock: FileSpreadsheet,
  search: Search,
  close: X,
  credit: Gem,
  note: ClipboardList,
  signOut: DoorOpen,
};

export default ICONS;