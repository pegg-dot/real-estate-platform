/**
 * Migration planning — the pure half of scripts/apply-migrations.ts (unit-tested here; the runner
 * only does I/O). Migrations are plain SQL files in supabase/migrations, applied in filename order
 * and recorded in `schema_migrations` so the runner is idempotent: it runs on every container boot.
 *
 * Existing databases pre-date the tracking table (the old runner just applied every file and
 * errored on re-runs). Those are recognised by BASELINE_MARKER — the artifact of the newest
 * migration that existed when tracking was introduced. If the marker table exists and there is no
 * tracking table, every file up to and including the marker is recorded as applied ("baselined")
 * instead of re-run. Once a tracking table exists it is the only authority — no guessing.
 */
export const MIGRATIONS_DIR = "supabase/migrations";
export const TRACKING_TABLE = "schema_migrations";
export const BASELINE_MARKER = { file: "0031_action_log.sql", table: "action_log" } as const;

export interface MigrationState {
  /** every *.sql in MIGRATIONS_DIR (any order; the planner sorts) */
  files: string[];
  /** filenames recorded in TRACKING_TABLE ([] when the table is missing) */
  applied: string[];
  trackingTableExists: boolean;
  /** BASELINE_MARKER.table exists in the database */
  markerTableExists: boolean;
}

export interface MigrationPlan {
  /** record as applied WITHOUT running (pre-tracking database already carries them) */
  baseline: string[];
  /** run + record, in this order */
  apply: string[];
  /** recorded in the tracking table but missing from disk — reported, never silently ignored */
  orphaned: string[];
}

export function planMigrations(s: MigrationState): MigrationPlan {
  const files = [...s.files].filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(s.applied);
  const orphaned = s.applied.filter((f) => !files.includes(f)).sort();

  if (!s.trackingTableExists && s.markerTableExists) {
    const baseline = files.filter((f) => f <= BASELINE_MARKER.file);
    const apply = files.filter((f) => f > BASELINE_MARKER.file);
    return { baseline, apply, orphaned };
  }
  return { baseline: [], apply: files.filter((f) => !applied.has(f)), orphaned };
}
