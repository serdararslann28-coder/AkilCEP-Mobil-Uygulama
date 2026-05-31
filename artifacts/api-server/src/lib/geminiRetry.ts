/**
 * Retry wrapper for Gemini API calls.
 *
 * Gemini returns 429 / RESOURCE_EXHAUSTED when the free-tier quota is hit.
 * This module detects those errors, waits RETRY_DELAY_MS, and retries up to
 * MAX_RETRIES times before re-throwing.  Technical details stay server-side.
 */

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 10_000; // 10 seconds between attempts

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error looks like a Gemini 429 / quota-exceeded error.
 * The @google/genai SDK can surface this in several shapes.
 */
export function isRateLimited(err: unknown): boolean {
  if (err == null) return false;
  const e = err as Record<string, unknown>;

  // SDK may set a numeric .status or .httpStatus
  if (e["status"] === 429 || e["httpStatus"] === 429) return true;

  // Fall back to message inspection
  if (typeof e["message"] === "string") {
    const m = (e["message"] as string).toUpperCase();
    if (m.includes("429") || m.includes("RESOURCE_EXHAUSTED") || m.includes("QUOTA_EXCEEDED")) {
      return true;
    }
  }

  return false;
}

/**
 * Runs `fn` up to MAX_RETRIES times.
 * On 429: waits RETRY_DELAY_MS and retries.
 * On any other error: throws immediately.
 * If all retries are exhausted on 429: re-throws so callers can inspect.
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  onRetry: (attempt: number, delayMs: number) => void,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;

      if (isRateLimited(err) && attempt < MAX_RETRIES - 1) {
        onRetry(attempt + 1, RETRY_DELAY_MS);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // Non-429 error or final attempt — propagate immediately
      throw err;
    }
  }

  // Should only reach here if MAX_RETRIES === 0; safety valve
  throw lastErr;
}
