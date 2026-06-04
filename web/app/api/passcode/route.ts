import { sql } from "../../lib/db";
import { hashPasscode, verifyPasscode } from "../../lib/passcode";

export const dynamic = "force-dynamic";

const KEY = "command_passcode";

async function getHash(): Promise<string | null> {
  const [r] = await sql()<Array<{ value: string }>>`select value from app_secret where key = ${KEY}`;
  return r?.value ?? null;
}

// GET → is a command passcode configured?
export async function GET() {
  return Response.json({ set: (await getHash()) != null }, { headers: { "cache-control": "no-store" } });
}

// POST {action:"set"|"verify", passcode, current?}
export async function POST(req: Request) {
  let b: { action?: string; passcode?: string; current?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const passcode = String(b.passcode ?? "");

  if (b.action === "verify") {
    const stored = await getHash();
    return Response.json({ ok: stored != null && verifyPasscode(passcode, stored) });
  }

  if (b.action === "set") {
    if (passcode.length < 4) return Response.json({ ok: false, error: "passcode must be at least 4 characters" }, { status: 400 });
    const stored = await getHash();
    if (stored && !verifyPasscode(String(b.current ?? ""), stored)) {
      return Response.json({ ok: false, error: "current passcode is wrong" }, { status: 401 });
    }
    await sql()`insert into app_secret (key, value, updated_at) values (${KEY}, ${hashPasscode(passcode)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "unknown action" }, { status: 400 });
}
