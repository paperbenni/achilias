import { currentSession } from "@/lib/ilias/session";
import { IliasError } from "@/lib/ilias/client";
import {
  searchDemo,
  searchRepository,
  searchResultLimit,
} from "@/lib/ilias/search";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 200)
    return Response.json(
      { error: "Enter between 2 and 200 characters to search." },
      { status: 400, headers },
    );
  const demo = url.searchParams.get("demo") === "1";
  try {
    if (demo) {
      const result = searchDemo(query);
      return Response.json(
        { query, ...result, demo: true },
        { headers },
      );
    }
    const session = await currentSession();
    if (session?.status !== "connected")
      return Response.json(
        { error: "Connect your account to search all your courses." },
        { status: 401, headers },
      );
    const result = await searchRepository(session, query);
    return Response.json(
      {
        query,
        results: result.results.slice(0, searchResultLimit),
        sourceUrl: result.sourceUrl,
        hasMore: result.hasMore || result.results.length > searchResultLimit,
        demo: false,
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "ILIAS search failed.",
      },
      {
        status: error instanceof IliasError ? error.status : 502,
        headers,
      },
    );
  }
}
