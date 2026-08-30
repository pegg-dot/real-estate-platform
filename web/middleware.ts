/**
 * Auth gate (spec 026 Phase 2). When AUTH_ENABLED, every request must carry a valid signed session
 * cookie or it's redirected to /login (API routes get a 401). The session HMAC is verified here at
 * the edge with Web Crypto (the route handlers re-resolve it with node crypto). When AUTH_ENABLED is
 * unset the middleware is a no-op, so single-user behavior is completely unchanged.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lot_session";
// paths that must stay open so a signed-out user can actually sign in
const OPEN = ["/login", "/api/auth/", "/api/connect/google/callback", "/api/health"];

async function validSession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot), sig = token.slice(dot + 1);
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (expected.length !== sig.length || expected !== sig) return false;
    const p = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return !!p.exp && p.exp >= Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function middleware(req: NextRequest) {
  if (process.env.AUTH_ENABLED !== "true") return NextResponse.next();   // flag off → single-user, no gate

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (await validSession(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET ?? "")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login"; url.search = "";
  return NextResponse.redirect(url);
}

// run on everything except Next internals + static assets (so both pages and APIs are gated)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
