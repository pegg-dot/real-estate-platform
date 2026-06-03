/**
 * Read-only SQL boundary for the agent (spec 022). The agent can answer "anything the database
 * holds" via a query_db tool, but it must NEVER be able to write. This is the single guard: accept
 * only a single SELECT/CTE statement, reject any write keyword anywhere, and cap the row count.
 * Defense-in-depth: the agent should ALSO run against a read-only DB role, and the executor adds a
 * statement timeout — this function is the syntactic gate.
 */
export type PrepareResult = { ok: true; sql: string } | { ok: false; reason: string };

// write/DDL/permission keywords — rejected as a whole word anywhere in the statement.
// `into` blocks SELECT ... INTO (a SELECT that CREATES a table — a write); lock/prepare/execute/
// refresh/security close the other write/side-effect forms. Defense-in-depth: queryDb should also
// run on a read-only Postgres role so a syntactic gap can't reach a write at the DB boundary.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|comment|copy|call|do|vacuum|analyze|reindex|cluster|listen|notify|set|reset|into|lock|prepare|execute|refresh|security)\b/i;

export function prepareReadQuery(raw: string, maxRows = 200): PrepareResult {
  let s = (raw ?? "").trim().replace(/;+\s*$/, ""); // strip a single trailing semicolon
  if (!s) return { ok: false, reason: "empty query" };
  if (s.includes(";")) return { ok: false, reason: "multiple statements are not allowed" };
  if (!/^(select|with)\b/i.test(s)) return { ok: false, reason: "only SELECT / WITH (read) queries are allowed" };
  if (FORBIDDEN.test(s)) return { ok: false, reason: "write/DDL keywords are not allowed in a read query" };

  // enforce a row cap: cap an existing LIMIT, else append one
  const m = s.match(/\blimit\s+(\d+)\b/i);
  if (m) {
    const n = Math.min(Number(m[1]), maxRows);
    s = s.replace(/\blimit\s+\d+\b/i, `limit ${n}`);
  } else {
    s = `${s} limit ${maxRows}`;
  }
  return { ok: true, sql: s };
}
