/** Peek at the PDF signature without buffering the document or losing bytes.
 * Never infer active inline content from a filename or an upstream MIME label. */
export async function peekPdf(body: ReadableStream<Uint8Array> | null) {
  if (!body) return { body: null, pdf: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let ended = false;
  try {
    while (size < 5) {
      const chunk = await reader.read();
      if (chunk.done) {
        ended = true;
        break;
      }
      if (chunk.value.byteLength) {
        chunks.push(chunk.value);
        size += chunk.value.byteLength;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    throw error;
  }
  const prefix = new Uint8Array(5);
  let offset = 0;
  for (const chunk of chunks) {
    const bytes = chunk.subarray(0, 5 - offset);
    prefix.set(bytes, offset);
    offset += bytes.byteLength;
    if (offset === 5) break;
  }
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
        return;
      }
      if (ended) {
        reader.releaseLock();
        controller.close();
        return;
      }
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          ended = true;
          reader.releaseLock();
          controller.close();
        } else controller.enqueue(chunk.value);
      } catch (error) {
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        reader.releaseLock();
      }
    },
  });
  return {
    body: stream,
    pdf: size >= 5 && String.fromCharCode(...prefix) === "%PDF-",
  };
}
