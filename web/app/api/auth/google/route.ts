import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { googleLoginUrl } from "../../../lib/google";
import { authEnabled } from "../../../lib/user";

export const dynamic = "force-dynamic";

// Start "Sign in with Google" (identity scope only). Random state cookie guards the callback.
// Only meaningful when AUTH_ENABLED + the Google client env are set.
export async function GET(req: Request) {
  if (!authEnabled()) return Response.json({ error: "auth is disabled" }, { status: 400 });
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) {
    return Response.json({ error: "auth isn't configured — set GOOGLE_CLIENT_ID/SECRET and AUTH_SECRET." }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("lot_auth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return Response.redirect(googleLoginUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!, redirectUri: `${origin}/api/auth/google/callback`, state,
  }));
}
