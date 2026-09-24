/**
 * Network failure identification helper.
 * Detects aborts, AuthRetryableFetchError, fetch network failures, and 5xx server errors.
 */
export const isNetworkFailure = (error: any): boolean => {
  if (!error) return false;
  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (error.name === 'AbortError' || msg.includes('aborted')) return true;
  if (error.name === 'AuthRetryableFetchError' || error.__isAuthRetryableFetchError) return true;
  if (error.name === 'TypeError' && msg.includes('network request failed')) return true;
  const status = error.status ?? error.statusCode ?? (error.code !== undefined ? Number(error.code) : undefined);
  return status === 0 || (typeof status === 'number' && status >= 500 && status < 600);
};
