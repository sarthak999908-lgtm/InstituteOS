import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Sparkles, Mail, Lock, Eye, EyeOff,
  LogIn, UserPlus, AlertCircle, CheckCircle2,
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
  signOut as supabaseSignOut,
  supabaseEnabled,
  supabaseConfigStatus,
  getAuthenticatedInstituteContext,
} from "../../services/supabase.js";
import {
  getAuthErrorMessage,
  getMembershipLookupErrorMessage,
  getRegistrationErrorMessage,
  getRegistrationSuccessMessage,
  getSignInErrorMessage,
  runSingleFlight,
  validateEmailAddress,
  validatePassword,
} from "./authErrors.js";
import { routeAuthorizedInstituteSession } from "./authFlow.js";
import { SupabaseConfigurationScreen } from "./AuthStateScreens.jsx";
import { canEnterLocalDemo, localDemoHref } from "../../lib/localDemo.js";

const ROLE_ACCENTS = { owner: "#2563EB", counselor: "#0D9488", trainer: "#16A34A", accounts: "#F97316" };
const OTP_SEND_FALLBACK = "Unable to send a sign-in email. New users should choose Register first; existing users can try again or ask an administrator to check email sign-in settings.";

// ─── Tiny field input component ───────────────────────────────────────────────
function AuthInput({ type = "text", placeholder, value, onChange, icon: Icon, rightSlot, name, autoComplete, error, id }) {
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
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete || (type === "password" ? "current-password" : type === "email" ? "email" : "off")}
        autoCapitalize={type === "email" ? "none" : undefined}
        spellCheck={type === "email" ? false : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
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

function InlineFieldError({ id, children }) {
  if (!children) return null;
  return <p id={id} role="alert" style={{ margin: "-5px 0 0 4px", color: "#B91C1C", fontSize: 12 }}>{children}</p>;
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage({ onRoleChange, onLogin, onUnlinkedAccount = () => {}, authNotice = "" }) {
  const [expandingRole, setExpandingRole] = useState(null);

  // Auth form state
  const [authTab, setAuthTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const registrationPendingRef = useRef(false);
  const expandingRoleTitle = expandingRole ? `${expandingRole[0].toUpperCase()}${expandingRole.slice(1)}` : "InstituteOS";
  const expandingRoleAccent = ROLE_ACCENTS[expandingRole] || ROLE_ACCENTS.owner;

  if (!supabaseConfigStatus.configured && !canEnterLocalDemo) {
    return <SupabaseConfigurationScreen variables={supabaseConfigStatus.issues} />;
  }

  // ── Real auth handlers ──────────────────────────────────────────────────────
  const validateFields = ({ includePassword = true } = {}) => {
    const next = { email: validateEmailAddress(email) };
    if (includePassword) next.password = validatePassword(password);
    if (includePassword && authTab === "signup" && password && password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }
    setFieldErrors(next);
    return Object.values(next).every((message) => !message);
  };

  const updateEmail = (value) => {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: "" }));
  };

  const updatePassword = (value) => {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: "" }));
  };

  const completeInstituteLogin = async (user) => {
    let instituteContext;
    try {
      instituteContext = await getAuthenticatedInstituteContext();
    } catch {
      setAuthError(getMembershipLookupErrorMessage());
      return false;
    }

    if (!user?.id) {
      setAuthError("Unable to verify the signed-in account. Please sign in again.");
      return false;
    }
    if (!instituteContext) {
      onUnlinkedAccount({ email: user.email || "", userId: user.id });
      return false;
    }

    const authorization = routeAuthorizedInstituteSession(user, instituteContext, {
      onRoleChange,
      onLogin: (sessionUser, userRole, context) => {
        setTimeout(() => onLogin(sessionUser, userRole, context), 550);
      },
    });
    if (!authorization) {
      onUnlinkedAccount({ email: user.email || "", userId: user.id });
      return false;
    }
    sound.chime();
    setExpandingRole(authorization.role);
    return true;
  };

  const handleSignIn = async () => {
    if (!validateFields()) return;
    if (!supabaseEnabled) { setAuthError("Supabase is not configured."); return; }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const { user, error } = await signInWithEmail(email.trim(), password);
      if (error) { setAuthError(getSignInErrorMessage(error)); return; }
      if (!user) { setAuthError("Unable to sign in. Please try again."); return; }
      await completeInstituteLogin(user);
    } catch (error) {
      setAuthError(getSignInErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (registrationPendingRef.current) return;
    if (!validateFields()) return;
    if (!supabaseEnabled) { setAuthError("Supabase is not configured."); return; }
    await runSingleFlight(registrationPendingRef, async () => {
      setAuthLoading(true);
      setAuthError("");
      setAuthSuccess("");
      try {
        const { user, session, error } = await signUpWithEmail(email.trim(), password, name.trim());
        if (error) { setAuthError(getRegistrationErrorMessage(error)); return; }
        if (!user) { setAuthError("Supabase did not return a new account. Please try again later."); return; }
        if (session) await supabaseSignOut();
        setAuthSuccess(getRegistrationSuccessMessage(session));
      } catch (error) {
        setAuthError(getRegistrationErrorMessage(error));
      } finally {
        setAuthLoading(false);
      }
    });
  };

  // ── Email OTP (Magic Link) handlers ─────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!validateFields({ includePassword: false })) return;
    if (!supabaseEnabled) { setAuthError("Supabase is not configured."); return; }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await sendMagicLink(email.trim());
      if (res?.error) { setAuthError(getAuthErrorMessage(res.error, OTP_SEND_FALLBACK)); return; }
      setOtpSent(true);
      setOtpEmail(email.trim());
      sound.tick();
      setAuthSuccess("Check your inbox for your sign-in link or verification code.");
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, OTP_SEND_FALLBACK));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) { setAuthError("Please enter the 6-digit code."); return; }
    setAuthLoading(true);
    setAuthError("");
    try {
      const { user, error } = await verifyEmailOtp(otpEmail, otpCode.trim());
      if (error) { setAuthError(getAuthErrorMessage(error, "Verification failed. Check the code and try again.")); return; }
      if (!user) { setAuthError("Unable to verify the sign-in code. Please try again."); return; }
      await completeInstituteLogin(user);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, "Verification failed. Check the code and try again."));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!supabaseEnabled) { setAuthError("Supabase is not configured."); return; }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await sendMagicLink(otpEmail);
      if (res?.error) { setAuthError(getAuthErrorMessage(res.error, OTP_SEND_FALLBACK)); return; }
      sound.tick();
      setAuthSuccess("A new sign-in link or verification code was sent. Check your inbox.");
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, OTP_SEND_FALLBACK));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !authLoading) {
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
              background: `radial-gradient(circle at center, ${expandingRoleAccent} 0%, var(--bg-0) 80%)`,
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
              Entering {expandingRoleTitle} Workspace…
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
            { id: "otp", label: "Email OTP" },
            { id: "signin", label: "Sign In" },
            { id: "signup", label: "Register" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => { sound.tick(); setAuthTab(id); setAuthError(""); setAuthSuccess(""); setFieldErrors({}); if (id !== "otp") { setOtpSent(false); setOtpCode(""); } }}
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

        {authNotice && (
          <div role="status" style={{ maxWidth: 400, margin: "-14px auto 16px", padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "#FFFBEB", border: "1px solid #FCD34D", color: "#92400E", fontSize: 12.5 }}>
            {authNotice}
          </div>
        )}

        <AnimatePresence mode="wait">

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
                    : "For existing accounts. New here? Choose Register first; OTP sign-in does not create accounts."
                  }
                </p>

                {!otpSent ? (
                  /* Step 1: Enter email */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                    <AuthInput
                      type="email"
                      placeholder="you@gmail.com"
                      value={email}
                      onChange={updateEmail}
                      name="email"
                      autoComplete="email"
                      id="otp-email"
                      error={fieldErrors.email}
                      icon={Mail}
                    />
                    <InlineFieldError id="otp-email-error">{fieldErrors.email}</InlineFieldError>
                  </div>
                ) : (
                  /* Step 2: Enter 6-digit OTP code */
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onKeyDown={handleKeyDown}>
                    <AuthInput
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(v) => setOtpCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                      name="one-time-code"
                      autoComplete="one-time-code"
                      id="otp-code"
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
                  disabled={authLoading}
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
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={updateEmail}
                    name="username"
                    autoComplete="username"
                    id="signin-email"
                    error={fieldErrors.email}
                    icon={Mail}
                  />
                  <InlineFieldError id="signin-email-error">{fieldErrors.email}</InlineFieldError>
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={updatePassword}
                    name="password"
                    autoComplete="current-password"
                    id="signin-password"
                    error={fieldErrors.password}
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
                  <InlineFieldError id="signin-password-error">{fieldErrors.password}</InlineFieldError>
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
                  disabled={authLoading}
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
                    name="name"
                    autoComplete="name"
                    id="signup-name"
                    icon={Users}
                  />
                  <AuthInput
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={updateEmail}
                    name="email"
                    autoComplete="email"
                    id="signup-email"
                    error={fieldErrors.email}
                    icon={Mail}
                  />
                  <InlineFieldError id="signup-email-error">{fieldErrors.email}</InlineFieldError>
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder="Password (min 6 chars)"
                    value={password}
                    onChange={updatePassword}
                    name="new-password"
                    autoComplete="new-password"
                    id="signup-password"
                    error={fieldErrors.password}
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
                  <InlineFieldError id="signup-password-error">{fieldErrors.password}</InlineFieldError>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>An administrator assigns staff roles after account creation.</p>
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
                  disabled={authLoading}
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
        {canEnterLocalDemo && (
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.88)", border: "1px solid var(--border)", textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", color: "var(--text-secondary)", fontSize: 13 }}>Try the app with fictional records. This local demo does not use Supabase or send backend requests.</p>
            <MagneticButton variant="secondary" onClick={() => window.location.assign(localDemoHref())} style={{ justifyContent: "center" }}>
              Open local demo
            </MagneticButton>
          </div>
        )}
      </div>
    </main>
  );
}
