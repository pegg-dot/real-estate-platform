/**
 * Public origin behind a reverse proxy (Railway / Render / Vercel). `new URL(req.url).origin`
 * reflects the container's INTERNAL bind address (e.g. http://0.0.0.0:8080), so OAuth redirect_uris
 * built from it are wrong and Google rejects them. Prefer, in order: an explicit PUBLIC_BASE_URL,
 * the forwarded-host headers the proxy sets, then req.url as a local-dev fallback.
 */
export function publicOrigin(req: Request): string {
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (env) return env;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;   // local dev (no proxy headers)
}
