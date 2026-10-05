import { useState } from "react";
import axios from "axios";
import {
  User, Lock, Eye, EyeOff, ArrowLeft, ArrowRight,
  Building2, Landmark, ShieldCheck, AlertCircle,
  Loader2, CheckCircle2
} from "lucide-react";
import ublLogo from "../../assets/ubl logo.png";

const SITES = {
  KHI: { city: "Karachi", icon: Building2 },
  LHE: { city: "Lahore", icon: Landmark }
};

const css = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "radial-gradient(circle at 85% 15%, #ECF3FB 0%, #F4F7FA 60%, #E9F0F8 100%)", fontFamily: "'Inter', sans-serif", color: "#18324B", overflow: "hidden" },
  header: { height: 72, padding: "0 36px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0" },
  brand: { display: "flex", alignItems: "center", gap: 14 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  main: { flex: 1, width: "min(1100px, calc(100% - 40px))", margin: "auto", display: "grid", gridTemplateColumns: "1fr 450px", alignItems: "center", gap: 50, padding: "40px 0" },
  hero: { maxWidth: 500 },
  heroLogo: { width: 100, height: 100, padding: 10, marginBottom: 28, background: "#fff", border: "1px solid #DCE5ED", borderRadius: 18, objectFit: "contain", boxShadow: "0 12px 32px rgba(0,96,189,.10)" },
  eyebrow: { color: "#0060BD", fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { margin: "12px 0 16px", fontSize: 48, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-1.2px", color: "#16344F" },
  blue: { display: "block", color: "#0060BD" },
  desc: { maxWidth: 460, color: "#526478", fontSize: 16, lineHeight: 1.65, marginBottom: 28 },
  features: { display: "flex", gap: 24, color: "#475569", fontSize: 13.5, fontWeight: 600, flexWrap: "wrap" },
  feature: { display: "flex", alignItems: "center", gap: 8 },
  card: { padding: "42px 38px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 20, boxShadow: "0 20px 40px -15px rgba(15,35,60,.08),0 1px 3px rgba(0,0,0,.02)" },
  small: { display: "block", color: "#0060BD", fontSize: 12, fontWeight: 800, letterSpacing: 1.4, marginBottom: 6 },
  h2: { margin: "0 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-.6px", color: "#0F2942" },
  muted: { margin: "0 0 28px", color: "#526478", fontSize: 14.5, lineHeight: 1.5 },
  input: { height: 52, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", marginTop: 8, border: "1.5px solid #CBD5E1", borderRadius: 12, background: "#FAFCFE" },
  field: { width: "100%", border: 0, outline: 0, background: "transparent", fontFamily: "'Inter', sans-serif", fontSize: 15, color: "#18324B" },
  label: { display: "block", marginTop: 18, color: "#475569", fontSize: 11.5, fontWeight: 800, letterSpacing: 1 },
  site: { height: 84, padding: "0 22px", display: "flex", alignItems: "center", gap: 18, width: "100%", textAlign: "left", cursor: "pointer", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 16, transition: ".2s" },
  icon: { width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "#F1F5F9", color: "#475569", borderRadius: 14, flexShrink: 0 },
  primary: { width: "100%", height: 54, marginTop: 24, border: 0, borderRadius: 14, background: "linear-gradient(135deg,#0068D6,#004FA8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 22px rgba(0,96,189,.24)" }
};

// Extracted outside to prevent input re-creation/focus loss on render
const FormInput = ({ isPassword, value, disabled, showPass, setShowPass, onChange }) => (
  <div className="input" style={css.input}>
    {isPassword ? <Lock size={19} color="#64748B" /> : <User size={19} color="#64748B" />}
    <input
      style={css.field}
      type={isPassword && !showPass ? "password" : "text"}
      value={value}
      disabled={disabled}
      placeholder={isPassword ? "Enter your password" : "Enter your username"}
      onChange={onChange}
    />
    {isPassword && (
      <button type="button" onClick={() => setShowPass(v => !v)} className="eye">
        {showPass ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    )}
  </div>
);

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1);
  const [site, setSite] = useState("KHI");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [form, setForm] = useState({ user: "", pass: "", err: "" });

  const selected = SITES[site];
  const SelectedIcon = selected.icon;

  const changeStep = next => {
    setAnimatingOut(true);
    setTimeout(() => {
      setStep(next);
      setAnimatingOut(false);
    }, 220);
  };

  const update = (key, value) => setForm(f => ({ ...f, [key]: value, err: "" }));

  const login = async e => {
    e.preventDefault();
    if (loading) return;

    const username = form.user.trim();
    const password = form.pass.trim();

    if (!username || !password) {
      return update("err", "Please enter your username and password.");
    }

    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/login", { username, password });
      onLogin(data.user);
    } catch (err) {
      setForm(f => ({
        ...f,
        pass: "",
        err: err.response?.data?.error || "Invalid credentials. Please try again."
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={css.page}>
      <header style={css.header}>
        <div style={css.brand}>
          <img src={ublLogo} alt="UBL" style={css.logo} />
          <div>
            <b style={{ fontSize: 13.5, fontWeight: 800 }}>UNITED BANK LIMITED</b>
            <div style={{ fontSize: 11, color: "#64748B" }}></div>
          </div>
        </div>
        <span className="secure">
          <ShieldCheck size={18} color="#0060BD" /> 
        </span>
      </header>

      <main style={css.main} className="main">
        <section style={css.hero} className="hero">
          <img src={ublLogo} alt="UBL" style={css.heroLogo} className="hero-logo" />
          <div style={css.eyebrow} className="hero-eyebrow">ALTERNATE DELIVERY CHANNEL (ADC)</div>
          <h1 style={css.title} className="hero-title">
            Plastic Inventory <span style={css.blue} className="hero-blue">Management System</span>
          </h1>
          <p style={css.desc} className="hero-desc">
            Centralized inventory management and operational tracking for UBL plastic card operations.
          </p>
          <div style={css.features} className="hero-features">
            {[[ShieldCheck, "Secure Access"], [Building2, "Multi-Site"], [Lock, "Audited"]].map(([Icon, text]) => (
              <span key={text} style={css.feature}>
                <Icon size={18} color="#0060BD" /> {text}
              </span>
            ))}
          </div>
        </section>

        <section style={css.card} className="card">
          {step === 1 ? (
            <div className={animatingOut ? "out-left" : "in-right"}>
              <span style={css.small}>ACCESS PORTAL</span>
              <h2 style={css.h2}>Select Operational Site</h2>
              <p style={css.muted}>Choose the location you are authorized to access.</p>
              <div className="sites">
                {Object.entries(SITES).map(([key, item]) => {
                  const Icon = item.icon;
                  const active = site === key;
                  return (
                    <button
                      key={key}
                      className={`site-btn ${active ? "active" : ""}`}
                      style={css.site}
                      onClick={() => { setSite(key); changeStep(2); }}
                    >
                      <span className="site-icon" style={{ ...css.icon, ...(active ? { background: "#0060BD", color: "#fff" } : {}) }}>
                        <Icon size={24} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <b style={{ display: "block", fontSize: 17, color: "#0F2942" }}>{item.city}</b>
                        <small style={{ color: "#64748B", fontSize: 13 }}>{item.region}</small>
                      </span>
                      {active ? (
                        <span className="check"><CheckCircle2 size={20} /></span>
                      ) : (
                        <span className="site-arrow"><span>{key}</span><ArrowRight size={18} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={animatingOut ? "out-right" : "in-left"}>
              <button onClick={() => changeStep(1)} className="back">
                <ArrowLeft size={16} /> Back to Site Selection
              </button>

              <div className="selected-site">
                <span style={{ ...css.icon, width: 42, height: 42, background: "#0060BD", color: "#fff" }}>
                  <SelectedIcon size={20} />
                </span>
                <span style={{ flex: 1 }}>
                  <small>AUTHORIZED SITE</small>
                  <b>{selected.city} Operations Hub</b>
                </span>
                <span className="tag">{site}</span>
              </div>

              <span style={css.small}>SECURE SIGN-IN</span>
              <h2 style={css.h2}>Welcome Back</h2>
              <p style={css.muted}>Enter your credentials to access the portal.</p>

              <form onSubmit={login}>
                <label style={css.label}>USERNAME</label>
                <FormInput
                  value={form.user}
                  disabled={loading}
                  onChange={e => update("user", e.target.value)}
                />

                <label style={css.label}>PASSWORD</label>
                <FormInput
                  isPassword
                  value={form.pass}
                  disabled={loading}
                  showPass={showPass}
                  setShowPass={setShowPass}
                  onChange={e => update("pass", e.target.value)}
                />

                {form.err && (
                  <div className="error"><AlertCircle size={18} />{form.err}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{ ...css.primary, opacity: loading ? 0.8 : 1 }}
                  className="primary"
                >
                  {loading ? (
                    <><Loader2 size={20} className="spin" /> Authenticating...</>
                  ) : (
                    <><Lock size={17} /> Sign in to Core IMS <ArrowRight size={18} /></>
                  )}
                </button>
              </form>

              <div className="security">
                <ShieldCheck size={15} color="#0060BD" /> Encrypted Session • Internal Access Only
              </div>
            </div>
          )}
        </section>
      </main>

      <footer style={{ paddingLeft: "15px" }}>
        UNITED BANK LIMITED • Core Inventory Management System • © 2026
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .hero { animation: heroIn .8s cubic-bezier(.16,1,.3,1) both; }
        .hero-logo { animation: logoIn .7s .05s cubic-bezier(.16,1,.3,1) both; }
        .hero-eyebrow { animation: textIn .5s .15s cubic-bezier(.16,1,.3,1) both; }
        .hero-title { animation: titleIn .7s .25s cubic-bezier(.16,1,.3,1) both; }
        .hero-blue { animation: revealBlue .8s .38s cubic-bezier(.16,1,.3,1) both; }
        .hero-desc { animation: textIn .55s .52s cubic-bezier(.16,1,.3,1) both; }
        .hero-features { animation: textIn .55s .62s cubic-bezier(.16,1,.3,1) both; }
        .card { animation: cardIn .7s .2s cubic-bezier(.16,1,.3,1) both; }

        @keyframes heroIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes logoIn { from { opacity: 0; transform: translateY(18px) scale(.88); } to { opacity: 1; transform: none; } }
        @keyframes textIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes titleIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes revealBlue { from { opacity: 0; transform: translateY(20px); clip-path: inset(0 100% 0 0); } to { opacity: 1; transform: none; clip-path: inset(0); } }
        @keyframes cardIn { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }

        .sites { display: flex; flex-direction: column; gap: 18px; }
        .site-btn:hover { border-color: #0060BD !important; background: #F8FAFC !important; transform: translateY(-1px); box-shadow: 0 7px 18px rgba(0,96,189,.08); }
        .site-icon { transition: .2s; }
        .check { width: 28px; height: 28px; border-radius: 50%; display: flex; alignItems: center; justifyContent: center; background: #0060BD; color: #fff; animation: pop .25s cubic-bezier(.175,.885,.32,1.275); }
        .site-arrow { display: flex; alignItems: center; gap: 10px; color: #94A3B8; }
        .site-arrow span, .tag { padding: 5px 12px; border-radius: 8px; background: #F1F5F9; color: #475569; font-size: 12px; font-weight: 700; }

        .selected-site { display: flex; alignItems: center; gap: 14px; margin-bottom: 24px; padding: 14px 18px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; }
        .selected-site small { display: block; color: #64748B; font-size: 10px; font-weight: 700; letter-spacing: .6px; margin-bottom: 3px; }
        .selected-site b { color: #0F2942; font-size: 14.5px; }

        .back, .eye { border: 0; background: none; cursor: pointer; color: #64748B; }
        .back { display: flex; gap: 6px; alignItems: center; padding: 0; margin-bottom: 20px; font-size: 13px; font-weight: 600; }
        .back:hover { color: #0060BD; }

        .primary { transition: .2s; }
        .primary:hover:not(:disabled) { background: linear-gradient(135deg,#0072EC,#0059C1) !important; box-shadow: 0 10px 24px rgba(0,96,189,.35); transform: translateY(-1px); }

        .input { transition: .2s; }
        .input:focus-within { border-color: #0060BD !important; background: #fff !important; box-shadow: 0 0 0 3.5px rgba(0,96,189,.12); }

        .error { display: flex; gap: 10px; alignItems: center; margin-top: 16px; padding: 14px; color: #991B1B; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 12px; font-size: 13px; }
        .security { margin-top: 24px; padding-top: 18px; border-top: 1px solid #F1F5F9; display: flex; alignItems: center; justifyContent: center; color: #94A3B8; font-size: 11.5px; }

        .spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .in-right { animation: inRight .3s cubic-bezier(.16,1,.3,1); }
        .in-left { animation: inLeft .3s cubic-bezier(.16,1,.3,1); }
        .out-left { animation: outLeft .22s ease forwards; }
        .out-right { animation: outRight .22s ease forwards; }

        @keyframes inRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
        @keyframes inLeft { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: none; } }
        @keyframes outLeft { to { opacity: 0; transform: translateX(-16px); } }
        @keyframes outRight { to { opacity: 0; transform: translateX(16px); } }

        @media (max-width: 850px) {
          .main { grid-template-columns: 1fr !important; gap: 36px !important; max-width: 650px; padding: 30px 0 !important; }
        }

        @media (max-width: 600px) {
          .main { width: calc(100% - 28px) !important; padding: 25px 0 !important; gap: 28px !important; }
          header { height: 64px !important; padding: 0 18px !important; }
          .secure { display: none !important; }
          .hero { text-align: center; }
          .hero-logo { width: 78px !important; height: 78px !important; margin-bottom: 22px !important; }
          .hero-title { font-size: 34px !important; }
          .hero-desc { font-size: 14px !important; margin-left: auto; margin-right: auto; }
          .hero-features { justify-content: center; gap: 15px !important; font-size: 12px !important; }
          .card { padding: 28px 22px !important; border-radius: 17px !important; }
          footer { padding: 15px 10px; font-size: 9.5px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
        }
      `}</style>
    </div>
  );
}