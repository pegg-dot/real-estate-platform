import { cookies } from "next/headers";
import { exchangeCode, googleUserEmail } from "../../../../lib/google";
import { authEnabled, isAllowed, SESSION_COOKIE } from "../../../../lib/user";
import { signSession } from "../../../../lib/session";
import { upsertAppUser } from "../../../../lib/appUser";
import { publicOrigin } from "../../../../lib/origin";

export const dynamic = "force-dynamic";
const SESSION_TTL = 60 * 60 * 24 * 14;   // 14 days

// Sign-in callback: verify state, exchange the code, read the verified email, enforce the allowlist,
// upsert the app_user, and mint the signed session cookie. Fail-closed on every error.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);   // public host behind the proxy (not the internal bind addr)
  const back = (q: string) => Response.redirect(`${origin}/login?e=${encodeURIComponent(q)}`);
  if (!authEnabled() || !process.env.AUTH_SECRET) return back("auth-off");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("lot_auth_state")?.value;
  jar.delete("lot_auth_state");
  if (url.searchParams.get("error")) return back("denied");
  if (!code || !state || !expected || state !== expected) return back("bad-state");

  try {
    const tokens = await exchangeCode({
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      code, redirectUri: `${origin}/api/auth/google/callback`,
    });
    const email = await googleUserEmail(tokens.access_token);
    if (!email) return back("no-email");
    if (!isAllowed(email)) return back("not-allowed");      // allowlist gate (you + your brother)

    const appUserId = await upsertAppUser(email, null);
    const token = signSession({ appUserId, email }, process.env.AUTH_SECRET!, SESSION_TTL);
    jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: SESSION_TTL });
    return Response.redirect(`${origin}/`);
  } catch (e) {
    return back(`error:${(e as Error).message}`.slice(0, 100));
  }
}
