import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

// Re-scoring the whole market takes minutes, so fire it DETACHED and return immediately. The
// map reflects the active thesis once it finishes (refresh in a few minutes). execFile-style
// spawn with a fixed arg array — no shell, no user input.
export async function POST() {
  const REPO = path.resolve(process.cwd(), "..");
  const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
  const child = spawn(TSX, ["scripts/thesis.ts", "--rescore"], {
    cwd: REPO, env: process.env, detached: true, stdio: "ignore",
  });
  child.unref();
  return Response.json({ ok: true, message: "Re-scoring the market in the background (~3–5 min). Refresh the Map when it's done." });
}
