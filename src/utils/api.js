const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const apiFetch = async (path, options = {}) => {
  const { method = 'GET', body, isForm = false } = options;
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    let message = 'Erro ao comunicar com o servidor.';
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch (_) { /* ignore */ }
    const requestError = new Error(message);
    requestError.status = response.status;
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader) {
      const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(retryAfterSeconds)) {
        requestError.retryAfterMs = retryAfterSeconds * 1000;
      } else {
        const retryAfterDate = new Date(retryAfterHeader).getTime();
        if (!Number.isNaN(retryAfterDate)) {
          requestError.retryAfterMs = Math.max(0, retryAfterDate - Date.now());
        }
      }
    }
    throw requestError;
  }

  return response.json();
};

const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiFetchWithRetry = async (path, options = {}, retryOptions = {}) => {
  const {
    retries = 4,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    retryOnStatuses = [429, 503],
  } = retryOptions;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await apiFetch(path, options);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status);
      const shouldRetry = attempt < retries && retryOnStatuses.includes(status);
      if (!shouldRetry) throw error;

      const retryAfterMs = Number(error?.retryAfterMs);
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      const delay =
        Number.isFinite(retryAfterMs) && retryAfterMs > 0
          ? Math.min(maxDelayMs, retryAfterMs)
          : exponentialDelay + jitter;

      await waitFor(delay);
    }
  }

  throw lastError;
};
