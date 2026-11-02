import { noStore, errorResponse } from "@/lib/api";
import { currentSession } from "@/lib/ilias/session";
import { containerKey } from "@/lib/ilias/search-index";
import { discoverNearby } from "@/lib/ilias/nearby-search";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const session = await currentSession();
  if (session?.status !== "connected")
    return Response.json({ error: "Connect your account to search nearby folders." }, { status: 401, headers: noStore });
  const roots = new URL(request.url).searchParams.getAll("root");
  if (roots.length > 4 || roots.some((root) => !containerKey(root)))
    return Response.json({ error: "Invalid search locations." }, { status: 400, headers: noStore });
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(output) {
      const send = (value: unknown) => {
        if (!signal.aborted) output.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      };
      try {
        await discoverNearby(session, roots, signal, (items) => send({ items }));
      } catch (error) {
        const response = errorResponse(error, { message: "Nearby folder search failed.", status: 502 });
        send(await response.json());
      } finally {
        if (!signal.aborted) output.close();
      }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { ...noStore, "Content-Type": "application/x-ndjson", "X-Accel-Buffering": "no" } });
}
