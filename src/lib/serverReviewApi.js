// Same-origin review transport. The local default stays on its dedicated
// loopback proxy; production Studio opts into the authenticated PHP API path.
export function createServerReviewApi(fetcher = globalThis.fetch, endpoint = '/review-api/index.php') {
  let csrfToken = '';
  async function request(action, body, params = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrfToken; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(`${endpoint}?${new URLSearchParams({ action, ...params })}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
      });
      if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Local review server unavailable. Check that the local API is running.');
      const payload = await response.json();
      if (!response.ok) {
        const error = new Error(payload.error || 'The server request failed.'); error.status = response.status;
        if (response.status === 401) csrfToken = '';
        throw error;
      }
      if (payload.csrfToken) csrfToken = payload.csrfToken;
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The local server timed out. Refresh to check whether your last change was saved before trying again.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  return {
    session: () => request('session'),
    login: (email, password) => request('login', { email, password }),
    logout: async () => { await request('logout', {}); csrfToken = ''; },
    list: before => request('review-drafts', undefined, before ? { before } : {}),
    get: id => request('review-draft', undefined, { id }),
    attachment: id => request('review-attachment', undefined, { id }),
    change: (id, expectedVersion, command) => request('review-change', { ...command, id, expectedVersion }),
  };
}
export const serverReviewApi = createServerReviewApi();
export const productionReviewApi = createServerReviewApi(globalThis.fetch, '/api/index.php');
