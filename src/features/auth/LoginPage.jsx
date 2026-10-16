import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Users, GraduationCap, Wallet,
  Sparkles, ArrowRight, Bot, Mail, Lock, Eye, EyeOff,
  LogIn, UserPlus, AlertCircle, CheckCircle2, ChevronDown,
  Send, KeyRound, RefreshCw,
} from "lucide-react";
import GlassCard from "../../components/common/GlassCard.jsx";
import MagneticButton from "../../components/common/MagneticButton.jsx";
import { sound } from "../../lib/sound.js";
import MeshBackground from "../../components/layout/MeshBackground.jsx";
import {
  signInWithEmail,
  signUpWithEmail,
  sendMagicLink,
  verifyEmailOtp,
  supabaseEnabled,
} from "../../services/supabase.js";

const ROLES = [
  {
    value: "owner",
    title: "Owner",
    icon: ShieldCheck,
    accent: "#2563EB",
    glow: "rgba(37, 99, 235, 0.22)",
    badge: "Full Access",
    capability: "Institute-wide operations, financial governance, approvals & overrides",
    details: ["Manage all batches & staff", "Approve schedule & fee replans", "Access full Copilot audit logs"],
    demoEmail: "owner@demo.instituteos.app",
  },
  {
    value: "counselor",
    title: "Counselor",
    icon: Users,
    accent: "#0D9488",
    glow: "rgba(13, 148, 136, 0.22)",
    badge: "Admissions",
    capability: "Admissions, student directory, batch rosters & fee status summaries",
    details: ["Student inquiry intake", "Attendance monitoring", "Draft follow-up reminders"],
    demoEmail: "counselor@demo.instituteos.app",
  },
  {
    value: "trainer",
    title: "Trainer",
    icon: GraduationCap,
    accent: "#16A34A",
    glow: "rgba(22, 163, 74, 0.22)",
    badge: "Academics",
    capability: "Assigned batches, daily attendance registers & learner risk reports",
    details: ["Mark daily attendance", "View weekly clash-free schedule", "Confidential financial mask"],
    demoEmail: "trainer@demo.instituteos.app",
  },
  {
    value: "accounts",
    title: "Accounts",
    icon: Wallet,
    accent: "#F97316",
    glow: "rgba(249, 115, 22, 0.22)",
    badge: "Finance",
    capability: "Fee collections, instalment schedules & bank statement reconciliation",
    details: ["Track pending & overdue fees", "Import UPI/bank statements", "Payment candidate matching"],
    demoEmail: "accounts@demo.instituteos.app",
  },
];

// ─── Tiny field input component ───────────────────────────────────────────────
function AuthInput({ type = "text", placeholder, value, onChange, icon: Icon, rightSlot }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      {Icon && (
        <span style={{ paddingLeft: 12, color: "var(--text-muted)", display: "flex" }}>
          <Icon size={15} />
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={type === "password" ? "current-password" : "email"}
        style={{
          flex: 1,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: "13.5px",
          color: "var(--text-primary)",
          fontFamily: "inherit",
        }}
      />
      {rightSlot}
    </div>
  );
}

// ─── Role dropdown for sign-up ────────────────────────────────────────────────
function RoleSelect({ value, onChange }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 36px 10px 12px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          fontSize: "13.5px",
          fontFamily: "inherit",
          outline: "none",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.title}</option>
        ))}
      </select>
      <ChevronDown
        size={14}
        style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-muted)", pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage({ role, onRoleChange, onLogin }) {
  const [selectedRole, setSelectedRole] = useState(role);
  const [expandingRole, setExpandingRole] = useState(null);

  // Auth form state
  const [authTab, setAuthTab] = useState("demo"); // "demo" | "signin" | "signup" | "otp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupRole, setSignupRole] = useState("counselor");
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  // ── Demo mode handlers ──────────────────────────────────────────────────────
  const handleSelectRole = (r) => {
    sound.tick();
    setSelectedRole(r.value);
    onRoleChange(r.value);
  };

  const handleDemoLaunch = () => {
    sound.chime();
    setExpandingRole(selectedRole);
    setTimeout(() => onLogin(), 550);
  };

  const chosenRoleObj = ROLES.find((r) => r.value === selectedRole) || ROLES[0];

  // ── Real auth handlers ──────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!email || !password) { setAuthError("Please enter your email and password."); return; }
    setAuthLoading(true);
    setAuthError("");
    const { user, error } = await signInWithEmail(email, password);
    setAuthLoading(false);
    if (error) { setAuthError(error.message || "Sign in failed"); return; }
    const userRole = user?.role || user?.app_metadata?.role || ((email || "").toLowerCase().includes("owner") || (email || "").toLowerCase().includes("admin") ? "owner" : "counselor");
    onRoleChange(userRole);
    sound.chime();
    setExpandingRole(userRole);
    setTimeout(() => onLogin(user), 550);
  };

  const handleSignUp = async () => {
    if (!email || !password) { setAuthError("Email and password are required."); return; }
    if (password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthLoading(true);
    setAuthError("");
    const { user, error } = await signUpWithEmail(email, password, signupRole, name);
    setAuthLoading(false);
    if (error) { setAuthError(error.message || "Registration failed"); return; }
    const userRole = user?.role || user?.app_metadata?.role || signupRole;
    onRoleChange(userRole);
    sound.chime();
    setExpandingRole(userRole);
    setTimeout(() => onLogin(user), 550);
  };

  // ── Email OTP (Magic Link) handlers ─────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email) { setAuthError("Please enter your email address."); return; }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    const res = await sendMagicLink(email);
    setAuthLoading(false);
    if (res?.error) { setAuthError(res.error.message || "Could not send OTP"); return; }
    setOtpSent(true);
    setOtpEmail(email);
    sound.tick();
    const codeNotice = res?.otp ? ` (Verification code: ${res.otp})` : "";
    setAuthSuccess(`Magic link & OTP code sent to ${email}!${codeNotice} Enter the code below or click verify.`);
    if (res?.otp) setOtpCode(res.otp);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { setAuthError("Please enter the 6-digit code."); return; }
    setAuthLoading(true);
    setAuthError("");
    const { user, error } = await verifyEmailOtp(otpEmail, otpCode.trim());
    setAuthLoading(false);
    if (error) { setAuthError(error.message || "Verification failed"); return; }
    const userRole = user?.role || user?.app_metadata?.role || ((otpEmail || "").toLowerCase().includes("owner") || (otpEmail || "").toLowerCase().includes("admin") ? "owner" : "counselor");
    onRoleChange(userRole);
    sound.chime();
    setExpandingRole(userRole);
    setTimeout(() => onLogin(user), 550);
  };

  const handleResendOtp = async () => {
    setAuthLoading(true);
    setAuthError("");
    const res = await sendMagicLink(otpEmail);
    setAuthLoading(false);
    if (res?.error) { setAuthError(res.error.message); return; }
    sound.tick();
    const codeNotice = res?.otp ? ` (Code: ${res.otp})` : "";
    setAuthSuccess(`New code sent!${codeNotice} Check your inbox.`);
    if (res?.otp) setOtpCode(res.otp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (authTab === "signin") handleSignIn();
      else if (authTab === "signup") handleSignUp();
      else if (authTab === "otp" && !otpSent) handleSendOtp();
      else if (authTab === "otp" && otpSent) handleVerifyOtp();
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        overflow: "hidden",
      }}
    >
      <MeshBackground />

      {/* Screen expansion reveal */}
      <AnimatePresence>
        {expandingRole && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", inset: 0, zIndex: 99999,
              background: `radial-gradient(circle at center, ${chosenRoleObj.accent} 0%, var(--bg-0) 80%)`,
              display: "grid", placeItems: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1.05, opacity: 1 }}
              transition={{ duration: 0.35 }}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "26px", fontWeight: 700,
                color: "#ffffff", letterSpacing: "-0.02em",
                display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <Sparkles size={28} color="#ffffff" />
              Entering {(ROLES.find((r) => r.value === expandingRole) || ROLES[0]).title} Workspace…
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 1080, textAlign: "center" }}>

        {/* Brand Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "4px 14px", borderRadius: 20,
              background: "var(--accent-badge-bg)", border: "1px solid var(--border)",
              color: "var(--accent-primary)", fontSize: "11px",
              fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14,
            }}
          >
            <Sparkles size={13} />
            TechSummitTrainers · Operations Copilot
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(2rem, 3.2vw, 3rem)",
              fontWeight: 700, letterSpacing: "-0.03em",
              color: "var(--text-primary)", marginBottom: 8,
            }}
          >
            Welcome to InstituteOS
          </h1>
          <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.5 }}>
            Clear Sky reconfigures data permissions, SQL scopes, and administrative tools for your persona.
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div
          style={{
            display: "inline-flex", background: "var(--surface-2)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
            padding: 4, gap: 4, marginBottom: 28,
          }}
        >
          {[
            { id: "demo", label: "Demo Mode" },
            { id: "otp", label: "Email OTP" },
            { id: "signin", label: "Sign In" },
            { id: "signup", label: "Register" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { sound.tick(); setAuthTab(id); setAuthError(""); setAuthSuccess(""); if (id !== "otp") { setOtpSent(false); setOtpCode(""); } }}
              style={{
                padding: "7px 18px", borderRadius: "var(--radius-sm)",
                border: "none", cursor: "pointer",
                background: authTab === id ? "var(--surface)" : "transparent",
                boxShadow: authTab === id ? "var(--shadow-card)" : "none",
                color: authTab === id ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── DEMO MODE ──────────────────────────────────────────────── */}
          {authTab === "demo" && (
            <motion.div
              key="demo"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: 18, marginBottom: 28,
                }}
              >
                {ROLES.map((item) => {
                  const isSelected = selectedRole === item.value;
                  const Icon = item.icon;
                  return (
                    <GlassCard
                      key={item.value}
                      onClick={() => handleSelectRole(item)}
                      style={{
                        padding: 22, textAlign: "left", cursor: "pointer",
                        border: isSelected ? `2px solid ${item.accent}` : "1px solid var(--border)",
                        boxShadow: isSelected
                          ? `0 12px 30px -8px ${item.glow}, 0 0 0 1px ${item.accent}`
                          : "var(--shadow-card)",
                        background: "var(--surface)",
                        transform: isSelected ? "translateY(-3px)" : "none",
                        transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div
                          style={{
                            width: 42, height: 42, borderRadius: 10,
                            background: isSelected ? item.accent : "var(--surface-2)",
                            border: `1px solid ${isSelected ? item.accent : "var(--border)"}`,
                            display: "grid", placeItems: "center",
                            color: isSelected ? "#ffffff" : item.accent,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <span
                          style={{
                            fontSize: "10px", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.08em",
                            padding: "3px 8px", borderRadius: 12,
                            background: isSelected ? `${item.accent}1A` : "var(--surface-2)",
                            color: isSelected ? item.accent : "var(--text-muted)",
                          }}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "19px", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: 14, minHeight: 34 }}>
                        {item.capability}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {item.details.map((d, i) => (
                          <div key={i} style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: item.accent }} />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <MagneticButton
                  variant="primary"
                  onClick={handleDemoLaunch}
                  style={{ padding: "12px 34px", fontSize: "15px", borderRadius: "var(--radius-md)" }}
                >
                  Enter as {chosenRoleObj.title}
                  <ArrowRight size={16} />
                </MagneticButton>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "12px", color: "var(--text-muted)" }}>
                  <Bot size={14} color="var(--accent-primary)" />
                  <span>Role-scoped SQLite security policies are enforced on all queries and actions.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── EMAIL OTP (MAGIC LINK) ───────────────────────────────────── */}
          {authTab === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: 400, margin: "0 auto" }}
            >
              <GlassCard style={{ padding: 28, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-primary)", display: "grid", placeItems: "center" }}>
                    <Mail size={18} color="#fff" />
                  </div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {otpSent ? "Verify Code" : "Email Login"}
                  </h2>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 20 }}>
                  {otpSent
                    ? `We sent a magic link and 6-digit code to ${otpEmail}`
                    : "No password required — we'll send a login link to your email."
                  }
                </p>

                {!otpSent ? (
                  /* Step 1: Enter email */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                    <AuthInput
                      type="email"
                      placeholder="you@institute.app"
                      value={email}
                      onChange={setEmail}
                      icon={Mail}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "100%" }}>Quick email login:</span>
                      {[
                        { label: "Admin (Owner)", email: "admin@instituteos.app" },
                        { label: "Counselor", email: "counselor@demo.instituteos.app" },
                        { label: "Trainer", email: "trainer@demo.instituteos.app" },
                        { label: "Accounts", email: "accounts@demo.instituteos.app" },
                      ].map((item) => (
                        <button
                          key={item.email}
                          type="button"
                          onClick={() => { setEmail(item.email); sound.tick(); }}
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            color: "var(--accent-primary)",
                            cursor: "pointer",
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Step 2: Enter 6-digit OTP code */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                    <AuthInput
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(v) => setOtpCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                      icon={KeyRound}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "var(--text-muted)" }}>
                      <span>Didn't receive it?</span>
                      <button
                        onClick={handleResendOtp}
                        disabled={authLoading}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--accent-primary)", fontWeight: 600, fontSize: "12px",
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <RefreshCw size={11} /> Resend
                      </button>
                      <span>or check spam folder</span>
                    </div>
                  </div>
                )}

                {authError && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#B91C1C" }}>
                    <AlertCircle size={14} />
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#F0FDF4", border: "1px solid #86EFAC", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#15803D" }}>
                    <CheckCircle2 size={14} />
                    {authSuccess}
                  </div>
                )}

                <MagneticButton
                  variant="primary"
                  onClick={otpSent ? handleVerifyOtp : handleSendOtp}
                  style={{ width: "100%", marginTop: 18, padding: "11px", fontSize: "14px", justifyContent: "center", opacity: authLoading ? 0.7 : 1 }}
                >
                  {authLoading
                    ? (otpSent ? "Verifying…" : "Sending…")
                    : otpSent
                      ? <><KeyRound size={15} /> Verify & Sign In</>
                      : <><Send size={15} /> Send Magic Link</>
                  }
                </MagneticButton>

                {otpSent && (
                  <button
                    onClick={() => { setOtpSent(false); setOtpCode(""); setAuthError(""); setAuthSuccess(""); }}
                    style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px" }}
                  >
                    ← Use a different email
                  </button>
                )}

                <p style={{ textAlign: "center", marginTop: 14, fontSize: "12px", color: "var(--text-muted)" }}>
                  Prefer password?{" "}
                  <button onClick={() => { setAuthTab("signin"); setAuthError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontWeight: 600, fontSize: "12px" }}>
                    Sign In with password
                  </button>
                </p>
              </GlassCard>
            </motion.div>
          )}

          {/* ─── SIGN IN ─────────────────────────────────────────────────── */}
          {authTab === "signin" && (
            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: 400, margin: "0 auto" }}
            >
              <GlassCard style={{ padding: 28, textAlign: "left" }}>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Sign In
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 20 }}>
                  Use your institute account credentials.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                  <AuthInput
                    type="email"
                    placeholder="you@institute.app"
                    value={email}
                    onChange={setEmail}
                    icon={Mail}
                  />
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={setPassword}
                    icon={Lock}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        style={{ padding: "0 12px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", width: "100%" }}>Quick email login:</span>
                    {[
                      { label: "Admin (Owner)", email: "admin@instituteos.app" },
                      { label: "Counselor", email: "counselor@demo.instituteos.app" },
                      { label: "Trainer", email: "trainer@demo.instituteos.app" },
                      { label: "Accounts", email: "accounts@demo.instituteos.app" },
                    ].map((item) => (
                      <button
                        key={item.email}
                        type="button"
                        onClick={() => { setEmail(item.email); setPassword("admin123"); sound.tick(); }}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--accent-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {authError && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#B91C1C" }}>
                    <AlertCircle size={14} />
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#F0FDF4", border: "1px solid #86EFAC", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#15803D" }}>
                    <CheckCircle2 size={14} />
                    {authSuccess}
                  </div>
                )}

                <MagneticButton
                  variant="primary"
                  onClick={handleSignIn}
                  style={{ width: "100%", marginTop: 18, padding: "11px", fontSize: "14px", justifyContent: "center", opacity: authLoading ? 0.7 : 1 }}
                >
                  {authLoading ? "Signing in…" : <><LogIn size={15} /> Sign In</>}
                </MagneticButton>

                <p style={{ textAlign: "center", marginTop: 14, fontSize: "12px", color: "var(--text-muted)" }}>
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { setAuthTab("signup"); setAuthError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontWeight: 600, fontSize: "12px" }}>
                    Register
                  </button>
                </p>
              </GlassCard>
            </motion.div>
          )}

          {/* ─── SIGN UP ─────────────────────────────────────────────────── */}
          {authTab === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: 400, margin: "0 auto" }}
            >
              <GlassCard style={{ padding: 28, textAlign: "left" }}>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  Create Account
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 20 }}>
                  Register a new institute staff account.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                  <AuthInput
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={setName}
                    icon={Users}
                  />
                  <AuthInput
                    type="email"
                    placeholder="you@institute.app"
                    value={email}
                    onChange={setEmail}
                    icon={Mail}
                  />
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder="Password (min 6 chars)"
                    value={password}
                    onChange={setPassword}
                    icon={Lock}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPass((p) => !p)}
                        style={{ padding: "0 12px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                  <div>
                    <label style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: 5, display: "block" }}>Role</label>
                    <RoleSelect value={signupRole} onChange={setSignupRole} />
                  </div>
                </div>

                {authError && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#B91C1C" }}>
                    <AlertCircle size={14} />
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: "var(--radius-sm)", background: "#F0FDF4", border: "1px solid #86EFAC", display: "flex", alignItems: "center", gap: 8, fontSize: "12.5px", color: "#15803D" }}>
                    <CheckCircle2 size={14} />
                    {authSuccess}
                  </div>
                )}

                <MagneticButton
                  variant="primary"
                  onClick={handleSignUp}
                  style={{ width: "100%", marginTop: 18, padding: "11px", fontSize: "14px", justifyContent: "center", opacity: authLoading ? 0.7 : 1 }}
                >
                  {authLoading ? "Creating account…" : <><UserPlus size={15} /> Create Account</>}
                </MagneticButton>

                <p style={{ textAlign: "center", marginTop: 14, fontSize: "12px", color: "var(--text-muted)" }}>
                  Already registered?{" "}
                  <button onClick={() => { setAuthTab("signin"); setAuthError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary)", fontWeight: 600, fontSize: "12px" }}>
                    Sign In
                  </button>
                </p>
              </GlassCard>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}