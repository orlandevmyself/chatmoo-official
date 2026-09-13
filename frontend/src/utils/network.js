// Network / connectivity helpers shared across pages so "internet lost"
// failures are shown as friendly, recoverable messages instead of raw errors.

export const isOnline = () =>
  typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;

export const subscribeToOnline = (callback) => {
  if (typeof window === 'undefined') return () => {};
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export const isNetworkError = (error) => {
  if (!error) return false;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  if (error.message === 'Network Error' || /failed to fetch/i.test(error.message || '')) return true;
  return error.name === 'TypeError';
};

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  const serverMsg = error.response?.data?.message;
  if (serverMsg) return serverMsg;
  if (isNetworkError(error)) {
    return isOnline()
      ? "We can't reach the server right now. Check your connection and try again."
      : "You're offline. Reconnect to the internet to continue.";
  }
  if (error.response) return `Request failed (${error.response.status}). ${fallback}`;
  return fallback;
};