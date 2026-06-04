/**
 * app_user resolution (spec 026 Phase 2). Maps a verified Google identity (email) to our app_user
 * row, creating it on first sign-in. Returns the app_user id we scope all per-user data to.
 */
import { sql } from "./db";

export async function upsertAppUser(email: string, name: string | null): Promise<string> {
  const e = email.trim().toLowerCase();
  const [row] = await sql()<Array<{ id: string }>>`
    insert into app_user (email, name) values (${e}, ${name})
    on conflict (email) do update set name = coalesce(excluded.name, app_user.name)
    returning id`;
  return row.id;
}
