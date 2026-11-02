/** A body exceeded the number of bytes we are willing to buffer in memory. */
export class PayloadTooLargeError extends Error {
  constructor(public readonly limit: number) {
    super(`The payload is larger than the ${limit}-byte limit.`);
  }
}

/**
 * Read a request or response body to a UTF-8 string, refusing to buffer more
 * than `limit` decompressed bytes. A missing body reads as empty; callers that
 * require one must reject before calling.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null | undefined,
  limit: number,
): Promise<string> {
  const reader = body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new PayloadTooLargeError(limit);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
