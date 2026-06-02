/**
 * Load the "current reading" of zoning rules for the radar (spec 006, Phase 3).
 *
 * Reads the SAME config/zoning/<market>.json that ingestion/zoning.py seeds zoning_rule
 * from — one source of truth. The radar diffs this against what's stored, so a no-op run
 * reports "no changes" and editing this file (flip a zone's by_room_legal, change a cap)
 * simulates an ordinance change that the radar turns into an alpha signal.
 */
import fs from "node:fs";
import path from "node:path";
import type { ZoneRule } from "./zoning.js";

interface RawZone { by_room_legal?: boolean; max_unrelated_occupants?: number | null }
interface RawZoningConfig {
  stability_flag?: string | null;
  default?: RawZone;
  zones?: Record<string, RawZone | string>;
}

/** Returns the current zone rules, or null if no config exists for the market. */
export function loadZoningRules(market: string): ZoneRule[] | null {
  const file = path.join("config", "zoning", `${market.toLowerCase()}.json`);
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, "utf8")) as RawZoningConfig;
  const stability = j.stability_flag ?? null;
  const rules: ZoneRule[] = [];

  // the citywide '*' default (matches the zoning_rule sentinel row)
  if (j.default) {
    rules.push({
      zoneCode: "*", byRoomLegal: j.default.by_room_legal === true,
      maxUnrelated: j.default.max_unrelated_occupants ?? null, stabilityFlag: stability,
    });
  }
  // explicit per-zone overrides ($comment keys skipped)
  for (const [zone, v] of Object.entries(j.zones ?? {})) {
    if (zone.startsWith("$") || typeof v !== "object") continue;
    rules.push({
      zoneCode: zone, byRoomLegal: v.by_room_legal === true,
      maxUnrelated: v.max_unrelated_occupants ?? null, stabilityFlag: stability,
    });
  }
  return rules;
}
