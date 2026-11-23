export class RequestBodyError extends Error {
  constructor(public status: number) { super('Invalid request body'); }
}

// Count bytes while reading; Content-Length is only an early rejection hint.
export async function readJsonObject(req: Request, maxBytes: number): Promise<Record<string, any>> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new RequestBodyError(413);
  const reader = req.body?.getReader();
  if (!reader) throw new RequestBodyError(400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RequestBodyError(413);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestBodyError(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestBodyError(400);
  return body;
}
