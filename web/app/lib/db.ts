import postgres from "postgres";

// the UI reads the SAME live Supabase the engine writes (deal_genome view, lead, deal tables).
let _sql: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!url) throw new Error("SUPABASE_DB_URL not set (source the repo .env before `next dev`)");
    _sql = postgres(url, { prepare: false, max: 4 });
  }
  return _sql;
}

export const MARKET = process.env.LOT_MARKET || "Charlottesville";
