import { useState, useCallback } from "react";
import axios from "axios";
import {
  User, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, ArrowRight,
  Building2, Landmark, ShieldCheck, CheckCircle2, ChevronRight, Sparkles, Loader2
} from "lucide-react";
import ublLogo from "../../assets/ubl logo.png";

const SITE_CFG = {
  KHI: {
    city: "Karachi",
    tag: "",
    primary: "#1D4ED8",
    gradient: "linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%)",
    accentLight: "#EFF6FF",
    border: "#BFDBFE",
    shadow: "rgba(29, 78, 216, 0.25)",
    icon: Building2
  },
  LHE: {
    city: "Lahore",
    tag: "",
    primary: "#7C3AED",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
    accentLight: "#F5F3FF",
    border: "#DDD6FE",
    shadow: "rgba(124, 58, 237, 0.25)",
    icon: Landmark
  }
};

const FormInput = ({ label, icon: Icon, error, endAction, disabled, ...props }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {Icon && (
          <Icon
            size={18}
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              color: error ? "#EF4444" : focused ? "#1D4ED8" : "#94A3B8",
              transition: "color 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          />
        )}
        <input
          {...props}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", height: 48, padding: endAction ? "0 44px 0 46px" : "0 16px 0 46px",
            borderRadius: 24,
            border: `1.5px solid ${error ? "#EF4444" : focused ? "#1D4ED8" : "#E2E8F0"}`,
            fontSize: 14, color: "#0F172A", outline: "none",
            background: focused ? "#FFFFFF" : "#F8FAFC", fontWeight: 500,
            boxShadow: focused ? "0 0 0 4px rgba(29, 78, 216, 0.12)" : "none",
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            boxSizing: "border-box"
          }}
        />
        {endAction}
      </div>
    </div>
  );
};

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [form, setForm] = useState({
    user: "",
    pass: "",
    showPass: false,
    err: "",
  });

  const cfg = SITE_CFG[sel] || SITE_CFG.KHI;

  const updateForm = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val, err: "" }));
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isAuthenticating) return;

    const cleanUser = form.user.trim();
    const cleanPass = form.pass.trim();

    if (!cleanUser || !cleanPass) {
      return setForm(f => ({ ...f, err: "Please fill out all authentication fields." }));
    }

    setIsAuthenticating(true);

    try {
      const res = await axios.post("/api/auth/login", {
        username: cleanUser,
        password: cleanPass,
      });

      // Use the site tied to the authenticated account from the server,
      // not just the card the user happened to click on step 1.
      onLogin(res.data.user.site);
    } catch (err) {
      setForm(f => ({
        ...f,
        pass: "",
        err: err.response?.data?.error || "Invalid credentials. Please verify and retry.",
      }));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)", display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <header style={{ padding: "20px 32px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#1E40AF", background: "#EFF6FF", padding: "8px 16px", borderRadius: 30, fontWeight: 600, border: "1px solid #BFDBFE", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <ShieldCheck size={16} /> Encrypted Session
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ width: "100%", maxWidth: step === 1 ? 520 : 880, background: "#FFFFFF", borderRadius: 32, padding: 32, boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.12)", border: "1px solid #E2E8F0", transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}>

          {step === 1 ? (
            <div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 110, height: 110, borderRadius: 28, background: "#FFFFFF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 10px 25px -5px rgba(29, 78, 216, 0.15)", padding: 12 }}>
                  <img src={ublLogo} alt="UBL" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.5px" }}>UBL CardStock</h1>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A" }}>Select Location Node</h2>
                <div style={{ background: "#EFF6FF", padding: "4px 10px", borderRadius: 16, fontSize: 11, fontWeight: 700, color: "#1E40AF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles size={12} /> Live
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
                {Object.entries(SITE_CFG).map(([key, site]) => {
                  const Icon = site.icon;
                  const active = sel === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setSel(key)}
                      style={{
                        padding: 18, borderRadius: 24,
                        background: active ? site.gradient : "#F8FAFC",
                        color: active ? "#FFFFFF" : "#0F172A",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                        border: `1.5px solid ${active ? "transparent" : "#E2E8F0"}`,
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: active ? `0 12px 24px -6px ${site.shadow}` : "none",
                        transform: active ? "translateY(-2px)" : "translateY(0)"
                      }}
                    >
                      <div style={{
                        width: 46, height: 46, borderRadius: 16,
                        background: active ? "rgba(255, 255, 255, 0.2)" : site.accentLight,
                        color: active ? "#FFFFFF" : site.primary,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.25s ease"
                      }}>
                        <Icon size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 15, display: "block", fontWeight: 700, color: active ? "#FFFFFF" : "#0F172A" }}>
                          {site.city}
                        </strong>
                        <span style={{ fontSize: 12, opacity: active ? 0.9 : 0.75, color: active ? "#FFFFFF" : "#475569" }}>{site.tag}  {key}</span>
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: active ? "rgba(255, 255, 255, 0.2)" : "#E2E8F0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.25s ease"
                      }}>
                        <ChevronRight size={16} color={active ? "#FFFFFF" : "#64748B"} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                disabled={!sel}
                onClick={() => setStep(2)}
                style={{
                  width: "100%", height: 52, borderRadius: 26, border: "none",
                  background: sel ? cfg.gradient : "#E2E8F0",
                  color: sel ? "#FFFFFF" : "#64748B",
                  fontSize: 15, fontWeight: 700, cursor: sel ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  boxShadow: sel ? `0 8px 20px -4px ${cfg.shadow}` : "none",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: sel ? "scale(1)" : "scale(0.99)"
                }}
              >
                Proceed to Terminal <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 20, minHeight: 460 }}>
              <div style={{ background: cfg.gradient, borderRadius: 24, padding: 28, color: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: `0 12px 24px -6px ${cfg.shadow}`, transition: "all 0.35s ease" }}>
                <div>
                  <button
                    type="button"
                    onClick={() => { setStep(1); updateForm("err", ""); }}
                    style={{
                      background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
                      color: "#FFFFFF", padding: "8px 16px", borderRadius: 20,
                      cursor: "pointer", fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 32,
                      backdropFilter: "blur(4px)", transition: "all 0.25s ease"
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1px", opacity: 0.9, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    {cfg.tag}
                  </span>
                  <h3 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.5px" }}>{cfg.city} </h3>
                  <p style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.6, margin: 0 }}>
                    Enter authorized credentials to proceed to the {cfg.city} terminal.
                  </p>
                </div>

                <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", padding: 16, borderRadius: 20, backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Shared Ledger Synchronization", "Real-Time Stock Audit Logs", "Multi-Branch Access Control"].map(text => (
                    <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 500 }}>
                      <CheckCircle2 size={16} style={{ color: "#BFDBFE" }} /> {text}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAuth} style={{ background: "#FAFAFA", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center", border: "1px solid #F1F5F9" }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#0F172A" }}>
                  Authenticate
                </h3>
                <p style={{ fontSize: 12, color: "#475569", margin: "0 0 18px" }}>
                  Enter credentials for this terminal.
                </p>

                <FormInput
                  label="Username"
                  icon={User}
                  error={form.err}
                  disabled={isAuthenticating}
                  value={form.user}
                  onChange={e => updateForm("user", e.target.value)}
                  placeholder="Enter your username"
                />

                <FormInput
                  label="Password"
                  icon={Lock}
                  error={form.err}
                  disabled={isAuthenticating}
                  type={form.showPass ? "text" : "password"}
                  value={form.pass}
                  onChange={e => updateForm("pass", e.target.value)}
                  placeholder="••••••••"
                  endAction={
                    <button
                      type="button"
                      onClick={() => updateForm("showPass", !form.showPass)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B", transition: "color 0.2s ease" }}
                    >
                      {form.showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {form.err && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 16, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={16} /> {form.err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  style={{
                    width: "100%", height: 48, borderRadius: 24, border: "none",
                    background: cfg.gradient, color: "#FFFFFF", fontSize: 14, fontWeight: 700,
                    cursor: isAuthenticating ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 6, boxShadow: `0 8px 20px -4px ${cfg.shadow}`, transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    opacity: isAuthenticating ? 0.8 : 1
                  }}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Access Terminal <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>
      </main>

      <footer style={{ padding: "16px 0 24px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: "#475569", background: "#FFFFFF", padding: "6px 18px", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.02)", fontWeight: 500, border: "1px solid #E2E8F0" }}>
          United Bank Limited © 2026 Core IMS
        </span>
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}