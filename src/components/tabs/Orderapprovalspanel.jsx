import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { C } from "../../constants/color";
import { fmt, fmtDate } from "../../utils/helper";

const API = "/api/orders";
const POLL_MS = 15000; 

export default function OrderApprovalsPanel({ toast, onOrdersChanged }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
     const res = await axios.get(`${API}/pending-count`);
      setPendingCount(res.data.count || 0);
    } catch {
      // Silent — this is a background poll, not a user-initiated action.
    }
  }, []);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/pending`);
      setPending(res.data || []);
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to load pending orders", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchPending();
  }, [open, fetchPending]);

  const approve = async (key) => {
    try {
      await axios.put(`${API}/${encodeURIComponent(key)}/approve`);
      toast?.("Order approved", "success");
      setPending(p => p.filter(o => o.key !== key));
      setPendingCount(c => Math.max(0, c - 1));
      onOrdersChanged?.();
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to approve", "error");
    }
  };

  const reject = async (key) => {
    if (!window.confirm("Reject this order request?")) return;
    try {
      await axios.put(`${API}/${encodeURIComponent(key)}/reject`);
      toast?.("Order rejected", "info");
      setPending(p => p.filter(o => o.key !== key));
      setPendingCount(c => Math.max(0, c - 1));
      onOrdersChanged?.();
    } catch (err) {
      toast?.(err.response?.data?.error || "Failed to reject", "error");
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 20, left: 20, zIndex: 9997 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: pendingCount > 0 ? C.red : C.navy, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,.25)", position: "relative",
        }}
        title="Pending order approvals"
      >
        <Bell size={22} />
        {pendingCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10,
            background: "#fff", color: C.red, fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            border: `2px solid ${C.red}`,
          }}>
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: 62, left: 0, width: 340, maxHeight: 420,
          background: "#fff", borderRadius: 14, border: `1.5px solid ${C.redBorder}`,
          boxShadow: "0 8px 28px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ background: C.navy, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Pending Order Approvals</span>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", width: 22, height: 22, borderRadius: 6, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ padding: "8px 10px", overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Loading...</div>
            ) : !pending.length ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textMuted, fontSize: 12 }}>No pending approvals 🎉</div>
            ) : (
              pending.map(o => (
                <div key={o.key} style={{ background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{o.subProduct || o.plasticCategory}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    {o.scheme} · {o.site} · Qty: <strong>{fmt(o.qty || 0)}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                    Requested by <strong>{o.requestedBy || "unknown"}</strong>
                    {o.orderDate && <> · {fmtDate(o.orderDate)}</>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => approve(o.key)}
                      style={{ flex: 1, height: 28, borderRadius: 6, border: "none", background: C.green, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button
                      onClick={() => reject(o.key)}
                      style={{ flex: 1, height: 28, borderRadius: 6, border: `1px solid ${C.redBorder}`, background: "#fff", color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}