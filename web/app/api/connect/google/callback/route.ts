import { cookies } from "next/headers";
import { exchangeCode, googleUserEmail } from "../../../../lib/google";
import { saveGoogleConnector, googleConfigured } from "../../../../lib/connectors";
import { currentUserId } from "../../../../lib/user";
import { publicOrigin } from "../../../../lib/origin";

export const dynamic = "force-dynamic";

// OAuth callback for the Gmail/Calendar connector: verify state, exchange the code for tokens, label
// the connected account, and seal+store them against the current user. Redirects back to Settings.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);   // public host behind the proxy (not the internal bind addr)
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("lot_conn_state")?.value;
  jar.delete("lot_conn_state");

  const back = (msg: string) => Response.redirect(`${origin}/settings?connect=${encodeURIComponent(msg)}`);
  if (!googleConfigured()) return back("not-configured");
  if (url.searchParams.get("error")) return back("denied");
  if (!code || !state || !expected || state !== expected) return back("bad-state");

  try {
    const tokens = await exchangeCode({
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      code, redirectUri: `${origin}/api/connect/google/callback`,
    });
    const email = await googleUserEmail(tokens.access_token);
    await saveGoogleConnector(await currentUserId(), {
      accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresInSec: tokens.expires_in, email,
    });
    return back("connected");
  } catch (e) {
    return back(`error:${(e as Error).message}`.slice(0, 120));
  }
}
