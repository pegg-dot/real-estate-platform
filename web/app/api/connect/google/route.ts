import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { googleAuthUrl } from "../../../lib/google";
import { googleConfigured } from "../../../lib/connectors";

export const dynamic = "force-dynamic";

// Start the Gmail/Calendar connector OAuth (gmail.send + calendar.events). A random state cookie
// (httpOnly) defends the callback against CSRF. Only live when the Google client env is configured.
export async function GET(req: Request) {
  if (!googleConfigured()) {
    return Response.json({ error: "Google connector isn't configured yet — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CONNECTOR_SECRET." }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("lot_conn_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return Response.redirect(googleAuthUrl({
    clientId: process.env.GOOGLE_CLIENT_ID!, redirectUri: `${origin}/api/connect/google/callback`, state,
  }));
}
