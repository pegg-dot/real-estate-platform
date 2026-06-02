import { sql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql()<Array<{ version: number; mode: string | null; primary: string | null; is_active: boolean }>>`
    select version,
           profile->'meta'->>'intake_mode' as mode,
           profile->'goal'->>'primary' as primary,
           is_active
    from thesis order by version desc`;
  return Response.json({ theses: rows });
}
