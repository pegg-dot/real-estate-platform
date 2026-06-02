import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// Run the existing engine CLI scripts from the web UI so buttons replace commands. execFile
// (no shell) + a script allowlist + per-action arg builders (never raw client args) keep it safe.
const execFileAsync = promisify(execFile);   // execFile = NO shell; args are an array, never interpolated
const REPO = path.resolve(process.cwd(), "..");          // web/ -> repo root
const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
const ALLOWED = new Set(["sourcing.ts", "learn.ts", "rents.ts", "brief.ts", "thesis.ts", "deal.ts", "refresh-market.ts", "enrich.ts"]);

export async function runEngine(script: string, args: string[], timeoutMs = 120_000): Promise<string> {
  if (!ALLOWED.has(script)) throw new Error(`script not allowed: ${script}`);
  const { stdout } = await execFileAsync(TSX, [path.join("scripts", script), ...args], {
    cwd: REPO, env: process.env, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

// strict uuid (starts with a hex digit, so it can never be read as a flag)
const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const numStr = (n: unknown) => { const x = Number(n); if (!Number.isFinite(x)) throw new Error("bad number"); return String(x); };
// any user string crossing the argv boundary must NOT begin with '-' (argv flag-smuggling) and is length-bounded
const noFlag = (s: unknown, max: number, label: string): string => {
  if (typeof s !== "string" || s.length === 0 || s.length > max || /^-/.test(s)) {
    throw new Error(`${label}: required, must not begin with '-', and be ≤${max} chars`);
  }
  return s;
};

/** Map a UI action to a concrete (script, args) — the client never names a script directly. */
export function buildAction(action: string, p: Record<string, unknown>): { script: string; args: string[]; timeout?: number } {
  switch (action) {
    case "generate-leads":
      return { script: "sourcing.ts", args: ["--generate"] };
    case "draft-mailer":
      if (!isUuid(p.leadId)) throw new Error("draft-mailer needs a valid leadId");
      return { script: "sourcing.ts", args: ["--draft", String(p.leadId)] };
    case "record-inbound":
      if (!isUuid(p.leadId)) throw new Error("record-inbound needs a valid leadId");
      return { script: "sourcing.ts", args: ["--inbound", String(p.leadId), ...(p.optOut ? ["--optout"] : [])] };
    case "propose-retune":
      return { script: "learn.ts", args: ["--propose"] };
    case "apply-retune":
      return { script: "learn.ts", args: ["--apply"] };
    case "enrich-leads":
      return { script: "enrich.ts", args: ["--leads", String(Math.min(100, Math.max(1, Number(p.n) || 25)))], timeout: 180_000 };
    case "thesis-from":
      if (typeof p.prose !== "string" || !p.prose.trim()) throw new Error("describe your thesis first");
      return { script: "thesis.ts", args: ["--from", noFlag(p.prose.trim(), 4000, "thesis description")], timeout: 90_000 };
    case "track-deal":
      // apn must START alphanumeric (no leading '-') and contain only safe chars
      if (typeof p.apn !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(p.apn) || p.apn.length > 64) throw new Error("track-deal needs a valid apn");
      return { script: "deal.ts", args: ["--track", p.apn] };
    case "transition-deal":
      if (!isUuid(p.dealId)) throw new Error("transition-deal needs a valid dealId");
      if (p.pass) return { script: "deal.ts", args: ["--transition", String(p.dealId), "--pass", "--reason", "no_time"] };
      if (typeof p.toStage !== "string" || !/^[a-z_]+$/.test(p.toStage)) throw new Error("transition-deal needs a valid toStage");
      return { script: "deal.ts", args: ["--transition", String(p.dealId), "--to", p.toStage, ...(p.reason && /^[a-z_]+$/.test(String(p.reason)) ? ["--reason", String(p.reason)] : [])] };
    case "add-rent-comp":
      return { script: "rents.ts", args: ["--add", noFlag(String(p.address ?? "manual comp"), 200, "address"),
        "--lat", numStr(p.lat), "--lng", numStr(p.lng), "--beds", numStr(p.beds), "--rent", numStr(p.rent),
        ...(p.byroom ? ["--byroom"] : [])] };
    case "rentcast":
      return { script: "rents.ts", args: ["--rentcast", noFlag(String(p.address), 200, "address"),
        ...(p.beds ? ["--beds", numStr(p.beds)] : [])], timeout: 40_000 };
    case "thesis-activate":
      if (!Number.isInteger(Number(p.version))) throw new Error("thesis-activate needs an integer version");
      return { script: "thesis.ts", args: ["--activate", String(Number(p.version))] };
    case "full-dossier":  // refresh-market --dossier <apn>: the full cited dossier (no ingest/score)
      if (typeof p.apn !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(p.apn) || p.apn.length > 64) throw new Error("full-dossier needs a valid apn");
      return { script: "refresh-market.ts", args: ["--dossier", p.apn, "--market", "Charlottesville"], timeout: 40_000 };
    case "run-radar":     // refresh-market --radar: detect zoning changes (no ingest/score)
      return { script: "refresh-market.ts", args: ["--radar", "--market", "Charlottesville"], timeout: 40_000 };
    case "enrich-owner":  // derive the owner's situation + run any keyed vendor adapters
      if (typeof p.apn !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(p.apn) || p.apn.length > 64) throw new Error("enrich-owner needs a valid apn");
      return { script: "enrich.ts", args: ["--owner", p.apn], timeout: 40_000 };
    default:
      throw new Error(`unknown action: ${action}`);
  }
}
