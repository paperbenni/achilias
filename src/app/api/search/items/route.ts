import { errorResponse, noStore } from "@/lib/api";
import { demoPage } from "@/lib/ilias/demo";
import { loadMemberships } from "@/lib/ilias/memberships";
import { indexedSearchItems } from "@/lib/ilias/search-index";
import { currentSession } from "@/lib/ilias/session";

export const runtime = "nodejs";

/** Enrolled courses and groups, independent of dashboard favorites or history. */
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("demo") === "1") {
      const page = demoPage();
      return Response.json(
        { items: page.items, hasMore: page.hasMore },
        { headers: noStore },
      );
    }
    const session = await currentSession();
    if (session?.status !== "connected")
      return Response.json(
        { error: "Connect your account to load your courses." },
        { status: 401, headers: noStore },
      );
    const memberships = await loadMemberships(session);
    return Response.json(
      { ...memberships, discovered: await indexedSearchItems(session.id) },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error, {
      message: "Could not load your courses.",
      status: 502,
    });
  }
}
