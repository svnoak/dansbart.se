/**
 * Custom fetch wrapper that injects X-Trace-Id header on every request.
 * Used as an Orval mutator so all generated API calls include trace IDs.
 */
export const customFetch = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> => {
  const traceId = crypto.randomUUID();
  const headers = new Headers(init?.headers);
  headers.set('X-Trace-Id', traceId);

  const res = await fetch(input, { ...init, headers });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const body = [204, 205, 304].includes(res.status)
    ? null
    : await res.text();

  return (body ? JSON.parse(body) : {}) as T;
};
