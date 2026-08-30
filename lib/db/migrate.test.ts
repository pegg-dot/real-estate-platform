import { describe, it, expect } from "vitest";
import { planMigrations, BASELINE_MARKER, TRACKING_TABLE } from "./migrate.js";

const FILES = [
  "0001_core_schema.sql", "0002_score_and_genome.sql", "0030_outreach_event_scoping.sql",
  "0031_action_log.sql", "0032_future.sql",
];

describe("migration planner (idempotent runner)", () => {
  it("fresh database → apply everything in order, baseline nothing", () => {
    const p = planMigrations({ files: [...FILES].reverse(), applied: [], trackingTableExists: false, markerTableExists: false });
    expect(p.baseline).toEqual([]);
    expect(p.apply).toEqual(FILES);   // sorted even if the caller passed them unsorted
  });

  it("pre-tracking database that already carries the marker → baseline through the marker, apply the rest", () => {
    // Nate's Supabase: all 31 applied by the old runner, no schema_migrations table yet, action_log exists.
    const p = planMigrations({ files: FILES, applied: [], trackingTableExists: false, markerTableExists: true });
    expect(p.baseline).toEqual(["0001_core_schema.sql", "0002_score_and_genome.sql", "0030_outreach_event_scoping.sql", "0031_action_log.sql"]);
    expect(p.apply).toEqual(["0032_future.sql"]);
  });

  it("tracked database → apply only the files not yet recorded (tracking is authoritative, marker ignored)", () => {
    const p = planMigrations({
      files: FILES, applied: ["0001_core_schema.sql", "0002_score_and_genome.sql"],
      trackingTableExists: true, markerTableExists: true,
    });
    expect(p.baseline).toEqual([]);
    expect(p.apply).toEqual(["0030_outreach_event_scoping.sql", "0031_action_log.sql", "0032_future.sql"]);
  });

  it("fully tracked → nothing to do (safe to run on every boot)", () => {
    const p = planMigrations({ files: FILES, applied: FILES, trackingTableExists: true, markerTableExists: true });
    expect(p.apply).toEqual([]);
    expect(p.baseline).toEqual([]);
  });

  it("reports recorded files that no longer exist on disk (never silently ignores drift)", () => {
    const p = planMigrations({ files: FILES, applied: [...FILES, "0099_deleted.sql"], trackingTableExists: true, markerTableExists: true });
    expect(p.orphaned).toEqual(["0099_deleted.sql"]);
  });

  it("a tracking table with zero rows is NOT a fresh database if the marker exists — it still baselines", () => {
    // e.g. someone created the table by hand; the marker proves the old runner already ran through 0031
    const p = planMigrations({ files: FILES, applied: [], trackingTableExists: true, markerTableExists: true });
    expect(p.baseline).toEqual([]);            // tracking authoritative → no baseline …
    expect(p.apply).toEqual(FILES);            // … so it would re-apply 0001 and FAIL LOUDLY rather than guess
  });

  it("exposes the constants the runner and the health probe share", () => {
    expect(TRACKING_TABLE).toBe("schema_migrations");
    expect(BASELINE_MARKER).toEqual({ file: "0031_action_log.sql", table: "action_log" });
  });
});
