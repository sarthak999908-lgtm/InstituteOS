import { useState } from "react";
import { Check, Copy, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";

const pageStyle = {
  minHeight: "100vh",
  boxSizing: "border-box",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "var(--text-primary, #f8fafc)",
  background: "var(--bg-0, #090714)",
};

const cardStyle = {
  width: "min(100%, 520px)",
  boxSizing: "border-box",
  padding: 32,
  border: "1px solid var(--border, rgba(255,255,255,.14))",
  borderRadius: 16,
  background: "var(--surface, #171427)",
  boxShadow: "0 24px 80px rgba(0,0,0,.28)",
};

const buttonStyle = {
  minHeight: 42,
  padding: "9px 14px",
  border: "1px solid var(--border, rgba(255,255,255,.18))",
  borderRadius: 8,
  color: "inherit",
  background: "var(--surface-2, #211d34)",
  cursor: "pointer",
  font: "inherit",
};

export function SupabaseConfigurationScreen({ variables = [] }) {
  return (
    <main role="alert" aria-labelledby="supabase-config-title" style={pageStyle}>
      <section style={cardStyle}>
        <ShieldAlert size={28} aria-hidden="true" />
        <h1 id="supabase-config-title">Supabase is not configured</h1>
        <p>InstituteOS cannot open the sign-in screen until the configuration is corrected.</p>
        {variables.length > 0 && (
          <>
            <p>Check these environment variable names:</p>
            <ul>{variables.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
          </>
        )}
      </section>
    </main>
  );
}

export function AuthResolvingScreen({ message = "Verifying your institute access…" }) {
  return (
    <main role="status" aria-live="polite" style={pageStyle}>
      <section style={cardStyle}>
        <ShieldCheck size={28} aria-hidden="true" />
        <h1>InstituteOS</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export function MembershipCheckErrorScreen({ onRetry, onSignOut }) {
  return (
    <main role="alert" aria-labelledby="membership-error-title" style={pageStyle}>
      <section style={cardStyle}>
        <ShieldAlert size={28} aria-hidden="true" />
        <h1 id="membership-error-title">We couldn’t verify your institute access</h1>
        <p>Check your connection and try again. InstituteOS will not open institute data until access is verified.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" style={buttonStyle} onClick={onRetry}>Try again</button>
          <button type="button" style={buttonStyle} onClick={onSignOut}><LogOut size={15} /> Sign out</button>
        </div>
      </section>
    </main>
  );
}

export function UnlinkedInstituteScreen({ email, userId, onSignOut }) {
  const [copyStatus, setCopyStatus] = useState("");

  const copyUserId = async () => {
    if (!userId) {
      setCopyStatus("User ID is unavailable. Sign out and contact your administrator.");
      return;
    }
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable.");
      await navigator.clipboard.writeText(userId);
      setCopyStatus("User ID copied.");
    } catch {
      setCopyStatus("Clipboard access is unavailable. Select and copy the ID shown below.");
    }
  };

  return (
    <main role="status" aria-labelledby="unlinked-title" style={pageStyle}>
      <section style={cardStyle}>
        <ShieldAlert size={28} aria-hidden="true" />
        <h1 id="unlinked-title">Your account is not linked to an institute yet. Ask your administrator to link it.</h1>
        <p>Email: <strong>{email || "Unavailable"}</strong></p>
        <p>Your Auth user ID:</p>
        <code style={{ display: "block", overflowWrap: "anywhere", padding: 12, borderRadius: 8, background: "var(--surface-2, #211d34)" }}>
          {userId || "Unavailable"}
        </code>
        <p aria-live="polite">{copyStatus}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" style={buttonStyle} onClick={copyUserId} disabled={!userId}>
            {copyStatus === "User ID copied." ? <Check size={15} /> : <Copy size={15} />} Copy my user ID
          </button>
          <button type="button" style={buttonStyle} onClick={onSignOut}><LogOut size={15} /> Sign out</button>
        </div>
      </section>
    </main>
  );
}
