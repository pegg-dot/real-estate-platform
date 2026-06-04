import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(`${new URL(req.url).origin}/login`, 303);
}
