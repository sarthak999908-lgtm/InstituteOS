const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password, or this account does not exist yet.";
const EMAIL_NOT_CONFIRMED_MESSAGE = "Please confirm your email first. Check your inbox.";
const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a few minutes.";
const NETWORK_MESSAGE = "Cannot reach the server. Check your connection.";
const CONFIGURATION_MESSAGE = "App configuration problem. Contact the administrator.";

function errorCode(error) {
  return String(error?.code || error?.error_code || "").toLowerCase();
}

function errorMessage(error) {
  return String(error?.message || "").toLowerCase();
}

function isRateLimited(error) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return Number(error?.status) === 429
    || code === "over_email_send_rate_limit"
    || code.includes("rate_limit")
    || message.includes("rate limit")
    || message.includes("too many requests");
}

function isNetworkFailure(error) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return ["fetch_error", "network_error", "authretryablefetcherror"].includes(code)
    || (error?.name === "TypeError" && /fetch|network/.test(message))
    || /failed to fetch|fetch failed|network error|network request failed|connection refused|econn/.test(message);
}

function isConfigurationFailure(error) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return Number(error?.status) === 401
    || Number(error?.status) === 404
    || ["invalid_api_key", "invalid_supabase_url", "supabase_not_configured"].includes(code)
    || /invalid supabase url|invalid api key|api key is invalid/.test(message);
}

export function getAuthErrorMessage(error, fallback = "Unable to sign in. Please try again.") {
  const code = errorCode(error);
  const message = errorMessage(error);

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return EMAIL_NOT_CONFIRMED_MESSAGE;
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (isRateLimited(error)) return RATE_LIMIT_MESSAGE;
  if (isNetworkFailure(error)) return NETWORK_MESSAGE;
  if (isConfigurationFailure(error)) {
    // Log only non-secret diagnostics; never include the URL, anon key, or raw provider payload.
    console.warn("Supabase Auth configuration failure.", {
      status: Number(error?.status) || null,
      code: code || "unknown",
    });
    return CONFIGURATION_MESSAGE;
  }
  return fallback;
}

export function getSignInErrorMessage(error) {
  return getAuthErrorMessage(error);
}

export function getRegistrationErrorMessage(error) {
  if (isRateLimited(error) || isNetworkFailure(error) || isConfigurationFailure(error)) {
    return getAuthErrorMessage(error, "Unable to create the account right now. Please try again later.");
  }
  return "Unable to create the account right now. Please try again later.";
}

export function getRegistrationSuccessMessage(session) {
  if (session) {
    return "Account created. Ask your administrator to link your account to an institute before signing in.";
  }
  return "Check your inbox to confirm your email. After confirming, ask your administrator to link your account to an institute.";
}

export function getMembershipLookupErrorMessage() {
  return "We couldn’t verify your institute membership. Check your connection and try again.";
}

export function getSessionRefreshErrorMessage() {
  return "Your session could not be refreshed. Please sign in again.";
}

export function validateEmailAddress(email) {
  const value = String(email || "").trim();
  if (!value) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  return "";
}

export function validatePassword(password) {
  if (!String(password || "").trim()) return "Enter your password.";
  return "";
}

export async function runSingleFlight(lock, action) {
  if (lock.current) return false;
  lock.current = true;
  try {
    await action();
    return true;
  } finally {
    lock.current = false;
  }
}
