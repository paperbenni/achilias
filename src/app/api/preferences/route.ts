import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/ilias/workspace-context";
import { READ_ONLY_COOKIE } from "@/lib/ilias/session";
import { isHttpsOrigin } from "@/lib/ilias/origin";
import { noStore, sameOriginFailure } from "@/lib/api";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const originFailure = sameOriginFailure(request);
  if (originFailure) return originFailure;
  const { session, workspace } = await getWorkspaceContext();
  if (session?.status !== "connected")
    return Response.json({ error: "Sign in to change this preference." }, { status: 401, headers: noStore });
  if (request.headers.get("x-achilias-connection") !== workspace.storageKey)
    return Response.json({ error: "Your connection changed. Refresh before changing preferences." }, { status: 409, headers: noStore });
  const body = await request.json().catch(() => null);
  if (typeof body?.readOnly !== "boolean")
    return Response.json({ error: "Read-only mode must be true or false." }, { status: 400, headers: noStore });
  (await cookies()).set(READ_ONLY_COOKIE, String(body.readOnly), {
    httpOnly: true, sameSite: "strict", secure: isHttpsOrigin(),
    path: "/", maxAge: 365 * 24 * 60 * 60,
  });
  revalidatePath("/", "layout");
  return Response.json({ readOnly: body.readOnly }, { headers: noStore });
}
