/**
 * Network failure identification helper.
 * Detects aborts, AuthRetryableFetchError, fetch network failures, and 5xx server errors.
 */
export const isNetworkFailure = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  if (err.name === 'AbortError' || msg.includes('aborted')) return true;
  if (err.name === 'AuthRetryableFetchError' || Boolean(err.__isAuthRetryableFetchError)) return true;
  if (msg.includes('network request failed') || msg.includes('timeout') || msg.includes('timed out')) return true;
  const status = err.status ?? err.statusCode ?? (err.code !== undefined ? Number(err.code) : undefined);
  return status === 0 || (typeof status === 'number' && status >= 500 && status < 600);
};

/**
 * Wraps a promise with a timeout timer that is guaranteed to be cleared via finally
 * when the wrapped promise settles, avoiding leaked lingering timers or closures.
 *
 * @param promise The promise or promise-like to execute.
 * @param ms Timeout in milliseconds.
 * @param fallbackOrErrorMessage Optional fallback value to resolve on timeout, or error message/Error to reject with.
 */
export async function withTimeout<T, F = T>(
  promise: PromiseLike<T>,
  ms: number,
  fallbackOrErrorMessage?: string | Error | F
): Promise<T | F> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T | F>((resolve, reject) => {
    timerId = setTimeout(() => {
      if (
        fallbackOrErrorMessage !== undefined &&
        typeof fallbackOrErrorMessage !== 'string' &&
        !(fallbackOrErrorMessage instanceof Error)
      ) {
        resolve(fallbackOrErrorMessage);
      } else {
        const err =
          fallbackOrErrorMessage instanceof Error
            ? fallbackOrErrorMessage
            : new Error(typeof fallbackOrErrorMessage === 'string' ? fallbackOrErrorMessage : 'Operation timed out');
        reject(err);
      }
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}
