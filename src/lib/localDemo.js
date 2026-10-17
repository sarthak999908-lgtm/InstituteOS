const developmentBuild = typeof import.meta.env !== "undefined" && import.meta.env.DEV === true;

export function shouldEnableLocalDemo({ development = false, search = "" } = {}) {
  return development && new URLSearchParams(search).get("demo") === "local";
}

export const localDemoMode = shouldEnableLocalDemo({
  development: developmentBuild,
  search: typeof window === "undefined" ? "" : window.location.search,
});

export const canEnterLocalDemo = developmentBuild;

export const localDemoUser = Object.freeze({
  id: "USR-OWNER",
  email: "demo@instituteos.invalid",
  user_metadata: Object.freeze({ name: "Local Demo Owner" }),
});

export function appStorageKey(key, demoMode = localDemoMode) {
  return demoMode ? `instituteos_local_demo:${key}` : key;
}

export function localDemoHref() {
  if (typeof window === "undefined") return "?demo=local";
  const url = new URL(window.location.href);
  url.searchParams.set("demo", "local");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function appHrefWithoutLocalDemo() {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  return `${url.pathname}${url.search}${url.hash}`;
}
