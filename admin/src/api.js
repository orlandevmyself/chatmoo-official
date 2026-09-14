// Thin REST client for the admin console. The server is the source of truth;
// this client only attaches the saved admin tokenchers, surfaces readable
// errors, and retries once on transient network hiccups.

const API_BASE = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

let adminToken = null;

export function loadSavedToken() {
  try {
    adminToken = localStorage.getItem('admin_token');
  } catch {
    adminToken = null;
  }
}

export function setAdminToken(token) {
  adminToken = token;
  try {
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
  } catch {
    /* ignore */
  }
}

export function getAdminToken() {
  return adminToken;
}

export function adminLogout() {
  setAdminToken(null);
}

export class AdminApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

const API_RETRY_DELAY_MS = 600;

function isNetworkFailure(e) {
  if (e instanceof TypeError) return true;
  return /Failed to fetch/i.test(String(e && e.message));
}

async function fetchWithRetry(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (!isNetworkFailure(e)) throw e;
    await new Promise((r) => setTimeout(r, API_RETRY_DELAY_MS));
    return fetch(url, init);
  }
}

function adminHeaders() {
  return {
    'content-type': 'application/json',
    ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}),
  };
}

function serverMessage(data, status) {
  if (data && typeof data.message === 'string') return data.message;
  if (data && Array.isArray(data.message)) return data.message.map(String).join('; ');
  if (data && typeof data.error === 'string') return data.error;
  return `Request failed (${status})`;
}

export async function adminApi(path, opts = {}) {
  const { method = 'GET', query = {}, body } = opts | {};
  let refetch = false;
  return makeRequest(path, { method, query, body, refetch });
}

async function makeRequest(path, opts) {
  const { method, query, body, refetch } = opts || {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${API_BASE}${path}${qs.toString() ? `?${qs.toString()}` : ''}`;

  let res;
  try {
    res = await fetchWithRetry(url, {
      method,
      credentials: 'include',
      headers: adminHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Cannot reach the server — is ChatMoo online?');
  }

  if (res.status === 401) {
    adminLogout();
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new AdminApiError(res.status, serverMessage(data, res.status));
  }
  return data;
}

// Block/Report API
export const blockReportApi = {
  getReports: (adminUserId, status, page, limit) =>
    adminApi('/block-report/admin/reports', {
      method: 'GET',
      query: { userId: adminUserId, status, page, limit },
    }),

  getReportsAboutUser: (adminUserId, reportedId) =>
    adminApi(`/block-report/admin/reports/${reportedId}`, {
      method: 'GET',
      query: { userId: adminUserId },
    }),

  updateReportStatus: (adminUserId, reportId, status) =>
    adminApi(`/block-report/admin/reports/${reportId}`, {
      method: 'PATCH',
      query: { userId: adminUserId },
      body: { status },
    }),
};
