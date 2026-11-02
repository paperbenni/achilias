import type { Item } from "./types";

/** NDJSON may split anywhere, including inside a multibyte character. */
export async function readSearchStream(response: Response, signal: AbortSignal, publish: (items: Item[]) => void) {
  if (!response.ok || !response.body) throw new Error("Could not search nearby folders.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const consume = (line: string) => {
    if (!line.trim() || signal.aborted) return;
    const body = JSON.parse(line) as { items?: Item[]; error?: string };
    if (body.error) throw new Error(body.error);
    if (Array.isArray(body.items)) publish(body.items);
  };
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffered.indexOf("\n")) !== -1) {
        consume(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
      }
      if (done) { consume(buffered); break; }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
