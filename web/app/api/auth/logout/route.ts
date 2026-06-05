import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/user";
import { publicOrigin } from "../../../lib/origin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(`${publicOrigin(req)}/login`, 303);
}
