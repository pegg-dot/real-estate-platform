import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

// "Update everything" — pull fresh county data + distress, re-score the market, run scout + radar.
// Heavy (minutes), so fire it DETACHED and return immediately. Fixed args, no shell, no user input.
export async function POST() {
  const REPO = path.resolve(process.cwd(), "..");
  const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
  const child = spawn(TSX, ["scripts/refresh-market.ts", "--market", "Charlottesville",
    "--distress", "--no-history", "--limit", "20000"], {
    cwd: REPO, env: process.env, detached: true, stdio: "ignore",
  });
  child.unref();
  return Response.json({ ok: true, message: "Updating: pulling fresh county data + distress, re-scoring, running scout + radar (this takes several minutes in the background). Refresh the pages when it's done." });
}
