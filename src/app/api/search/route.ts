import { currentSession } from "@/lib/ilias/session";
import { errorResponse, noStore } from "@/lib/api";
import { searchDemo, searchRepository } from "@/lib/ilias/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 200)
    return Response.json(
      { error: "Enter between 2 and 200 characters to search." },
      { status: 400, headers: noStore },
    );
  try {
    if (url.searchParams.get("demo") === "1")
      return Response.json(
        { query, ...searchDemo(query), demo: true },
        { headers: noStore },
      );
    const session = await currentSession();
    if (session?.status !== "connected")
      return Response.json(
        { error: "Connect your account to search all your courses." },
        { status: 401, headers: noStore },
      );
    const result = await searchRepository(session, query);
    return Response.json(
      { query, ...result, demo: false },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error, {
      message: "ILIAS search failed.",
      status: 502,
    });
  }
}
