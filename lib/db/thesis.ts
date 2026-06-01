/**
 * Versioned thesis store (spec 001). Each compile inserts a NEW version row (no silent
 * overwrite); at most one is active at a time (enforced by a partial unique index). The
 * scoring pipeline scores against the active thesis; swapping the active thesis re-ranks
 * the whole market.
 */
import type postgres from "postgres";

import type { Sql } from "./client.js";
import { validateThesis, type Thesis } from "../thesis/schema.js";

type Json = postgres.JSONValue;

/** Save a thesis as the next version. Returns the assigned version. */
export async function saveThesis(sql: Sql, thesis: Thesis, opts: { activate?: boolean } = {}):
  Promise<number> {
  const activate = opts.activate ?? true;
  // atomic: deactivate-then-insert in one transaction so the single-active invariant
  // (thesis_single_active_idx) can never be left at zero or two active rows
  return sql.begin(async (tx) => {
    const [row] = await tx<{ next: number }[]>`select coalesce(max(version),0)+1 as next from thesis`;
    const version = row!.next;
    const profile = { ...thesis, version };
    if (activate) await tx`update thesis set is_active = false where is_active`;
    await tx`insert into thesis (version, profile, is_active)
             values (${version}, ${tx.json(profile as Json)}, ${activate})`;
    return version;
  }) as Promise<number>;
}

/** The active thesis, or null if none has been saved yet. */
export async function loadActiveThesis(sql: Sql): Promise<Thesis | null> {
  const rows = await sql<{ profile: unknown }[]>`select profile from thesis where is_active limit 1`;
  return rows[0] ? validateThesis(rows[0].profile) : null;
}

export async function getThesis(sql: Sql, version: number): Promise<Thesis | null> {
  const rows = await sql<{ profile: unknown }[]>`select profile from thesis where version = ${version}`;
  return rows[0] ? validateThesis(rows[0].profile) : null;
}

export async function setActiveThesis(sql: Sql, version: number): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`update thesis set is_active = false where is_active`;
    await tx`update thesis set is_active = true where version = ${version}`;
  });
}

export async function listTheses(sql: Sql): Promise<
  { version: number; is_active: boolean; created_at: string; mode: string | null; primary: string | null }[]> {
  return sql`
    select version, is_active, created_at,
           profile->'meta'->>'intake_mode' as mode,
           profile->'goal'->>'primary'     as "primary"
    from thesis order by version desc`;
}
