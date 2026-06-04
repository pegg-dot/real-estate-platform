import { connectorStatuses, disconnectGoogle, googleConfigured } from "../../../lib/connectors";
import { currentUserId } from "../../../lib/user";

export const dynamic = "force-dynamic";

// Connection status for the Settings panel (never returns tokens) + a disconnect action.
export async function GET() {
  try {
    const statuses = await connectorStatuses(await currentUserId());
    return Response.json({ configured: googleConfigured(), connectors: statuses }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ configured: googleConfigured(), connectors: [], error: (e as Error).message }, { status: 200 });
  }
}

export async function DELETE() {
  try {
    await disconnectGoogle(await currentUserId());
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
