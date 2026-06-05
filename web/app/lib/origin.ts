/**
 * Public origin behind a reverse proxy (Railway / Render / Vercel). `new URL(req.url).origin`
 * reflects the container's INTERNAL bind address (e.g. http://0.0.0.0:8080), so OAuth redirect_uris
 * built from it are wrong and Google rejects them. Prefer, in order: an explicit PUBLIC_BASE_URL,
 * the forwarded-host headers the proxy sets, then req.url as a local-dev fallback.
 */
export function publicOrigin(req: Request): string {
  // 1) Explicit, trusted source. Set PUBLIC_BASE_URL in production so we NEVER trust client headers
  //    for redirect targets (host-header injection -> open redirect).
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (env) return env;

  // 2) Fallback to the proxy's forwarded host. Guard it: restrict the scheme to http/https literals
  //    (never echo an arbitrary x-forwarded-proto), and — when ALLOWED_HOSTS is configured — reject
  //    any host not on the allowlist so a spoofed header can't redirect a victim off-site.
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const allow = (process.env.ALLOWED_HOSTS ?? "")
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes(host.toLowerCase())) {
      throw new Error("untrusted host"); // fail closed rather than emit an attacker-controlled redirect
    }
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim() === "http" ? "http" : "https";
    return `${proto}://${host}`;
  }

  // 3) Local dev (no proxy headers).
  return new URL(req.url).origin;
}
