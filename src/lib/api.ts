import { IliasError } from "@/lib/ilias/errors";
import { requireSameOrigin } from "@/lib/ilias/session";

/** Every workspace API response is private to one browser session. */
export const noStore: HeadersInit = {
  "Cache-Control": "private, no-store",
};

/** Map a thrown error to a JSON response with the most specific status. */
export function errorResponse(
  error: unknown,
  fallback: { message: string; status: number },
) {
  return Response.json(
    { error: error instanceof Error ? error.message : fallback.message },
    {
      status: error instanceof IliasError ? error.status : fallback.status,
      headers: noStore,
    },
  );
}

/** Same-origin guard as a response, so handlers can return it directly. */
export function sameOriginFailure(request: Request): Response | null {
  try {
    requireSameOrigin(request);
    return null;
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers: noStore },
    );
  }
}
