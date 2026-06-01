/**
 * Postgres/Supabase client for the judgment layer. Reads the connection string from
 * SUPABASE_DB_URL (or DATABASE_URL / an explicit arg) — never hardcoded. This is the
 * connective tissue: the TS engines read the SAME database the Python ingestion writes.
 */
import postgres from "postgres";

export type Sql = postgres.Sql;

export function getSql(url?: string): Sql {
  const dsn = url ?? process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) {
    throw new Error("No database URL — set SUPABASE_DB_URL (or DATABASE_URL) before reading the DB.");
  }
  return postgres(dsn, { max: 4, idle_timeout: 10, prepare: false });
}
