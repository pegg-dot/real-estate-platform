"use client";
/* Client-side context store for the chat context-feed (spec 024 Phase 3). Holds the parcels/leads
   the user has attached via "＋ Add to chat", persisted in localStorage so the selection survives
   navigation between pages and lands in the /chat composer's context tray. */
export interface CtxEntity { type: "parcel" | "lead"; id: string; label: string }
const KEY = "lot_chat_context";
const listeners = new Set<() => void>();

function read(): CtxEntity[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as CtxEntity[]; } catch { return []; }
}
function write(v: CtxEntity[]) {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(v));
  listeners.forEach((l) => l());
}

export const getContext = (): CtxEntity[] => read();

export function addContext(e: CtxEntity): void {
  const cur = read();
  if (cur.some((x) => x.type === e.type && x.id === e.id)) return;   // de-dupe
  write([...cur, e].slice(-8));                                       // cap at 8 attachments
}
export const removeContext = (type: string, id: string): void => write(read().filter((x) => !(x.type === type && x.id === id)));
export const clearContext = (): void => write([]);

/** subscribe to changes (same-tab via the listener set, cross-tab via the storage event). */
export function subscribeContext(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); if (typeof window !== "undefined") window.removeEventListener("storage", onStorage); };
}
