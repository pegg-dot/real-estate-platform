import { authEnabled, currentSession } from "../../lib/user";

export const dynamic = "force-dynamic";

// Who the current request is (for the top-nav identity chip). When auth is off there's no session —
// the app is single-user, so the chip stays hidden. Never returns anything sensitive.
export async function GET() {
  const session = authEnabled() ? await currentSession() : null;
  return Response.json({ authEnabled: authEnabled(), email: session?.email ?? null }, { headers: { "cache-control": "no-store" } });
}
