"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useResource } from "../lib/useResource";
import Icon from "../components/Icon";
import AsyncState from "../components/AsyncState";
interface Conn { kind: string; status: string; email: string | null; updatedAt: string | null }
export default function Connectors() {
  const resource = useResource<{ configured: boolean; connectors: Conn[] }>("/api/connect/status");
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const callback = params.get("connect");
  const callbackMessage = callback === "connected" ? "Google connection returned successfully. Current account status is shown below." : callback === "denied" ? "Connection cancelled." : callback ? "The connection could not complete. Please try again." : null;
  async function disconnect() {
    if (busy || !confirm("Disconnect Google? LOT will no longer be able to send email or add events through this connection.")) return;
    setBusy(true); setNote(null);
    try { const response = await fetch("/api/connect/status", { method: "DELETE", signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error(); setNote("Google disconnected."); resource.reload(); }
    catch { setNote("The disconnect was not confirmed. Refresh the connection status before trying again."); }
    finally { setBusy(false); }
  }
  if (resource.loading) return <AsyncState loading title="Checking connected accounts" />;
  if (resource.error) return <AsyncState error title="Connection status unavailable" description={resource.error} retry={resource.reload} />;
  const google = resource.data?.connectors?.find(connection => connection.kind === "google");
  return <div className="connector-card">{(note || callbackMessage) && <p className="connector-note" role="status">{note || callbackMessage}</p>}<div className="connector-row"><span className="connector-mark" aria-hidden="true">G</span><div><h3>Google</h3><p>Gmail &amp; Calendar</p></div><span className={`pill ${google?.status === "connected" ? "ok" : ""}`}>{google?.status === "connected" ? "Connected" : resource.data?.configured ? "Not connected" : "Not configured"}</span></div><p>{!resource.data?.configured ? "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CONNECTOR_SECRET to the server environment to enable account connections." : google?.status === "connected" ? `Connected${google.email ? ` as ${google.email}` : ""}. Outgoing emails and calendar events use this account only after your approval.` : "Connect your own account to send approved owner emails and create approved calendar events."}</p>{resource.data?.configured && (google?.status === "connected" ? <button className="btn" onClick={disconnect} disabled={busy}>{busy ? "Disconnecting..." : "Disconnect account"}</button> : <a className="btn" href="/api/connect/google">Connect Google<Icon name="external" size={13} /></a>)}</div>;
}
