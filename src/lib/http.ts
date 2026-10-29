export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** fetch + JSON with a hard timeout that also honours the caller's signal. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new HttpError(response.status, url);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Serialises calls so consecutive requests start at least `minIntervalMs`
 * apart. Enough for the public APIs used here (Jikan: 3 req/s).
 */
export class RateLimiter {
  private next = 0;

  constructor(private readonly minIntervalMs: number) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const startAt = Math.max(now, this.next);
    this.next = startAt + this.minIntervalMs;
    if (startAt > now) await new Promise((r) => setTimeout(r, startAt - now));
    return task();
  }
}
