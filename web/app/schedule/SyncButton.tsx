"use client";
/* Push one scheduled event to the connected user's Google Calendar (calendar.events). Gated: needs
   a connected Google account; otherwise it tells you to connect in Settings. */
import { useState } from "react";

export default function SyncButton({ id, synced }: { id: string; synced: boolean }) {
  const [done, setDone] = useState(synced);
  const [busy, setBusy] = useState(false);
  async function sync() {
    if (busy || done) return;
    setBusy(true);
    const r = await fetch("/api/schedule/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: "network error" }));
    setBusy(false);
    if (r.ok) setDone(true);
    else alert(`⚠️ ${r.error}`);
  }
  return (
    <button className="btn btn-sm" onClick={sync} disabled={busy || done}>
      {done ? "✓ on Calendar" : busy ? "Syncing…" : "Add to Calendar"}
    </button>
  );
}
