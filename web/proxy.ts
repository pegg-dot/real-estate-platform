/**
 * Auth gate. When AUTH_ENABLED, every request must carry a valid signed session cookie or it is
 * redirected to /login (API routes receive 401). When AUTH_ENABLED is unset, the proxy is a no-op
 * so the default single-user localhost experience stays unchanged.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lot_session";
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

export async function proxy(req: NextRequest) {
  if (process.env.AUTH_ENABLED !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (await validSession(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET ?? "")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
