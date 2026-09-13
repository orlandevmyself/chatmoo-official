const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

async function adminFetch(endpoint, adminUserId, options = {}) {
  const url = new URL(`${API_BASE}/admin${endpoint}`);
  url.searchParams.set('userId', adminUserId);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

export const adminApi = {
  getOverview: (adminUserId) =>
    adminFetch('/overview', adminUserId),

  getUsers: (adminUserId, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.banned !== undefined) query.set('banned', params.banned);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    return adminFetch(`/users?${query}`, adminUserId);
  },

  setUserRole: (adminUserId, userId, role) =>
    adminFetch(`/users/${userId}/role`, adminUserId, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  setUserBan: (adminUserId, userId, banned) =>
    adminFetch(`/users/${userId}/ban`, adminUserId, {
      method: 'PATCH',
      body: JSON.stringify({ banned }),
    }),

  getTransactions: (adminUserId, params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.method) query.set('method', params.method);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    return adminFetch(`/transactions?${query}`, adminUserId);
  },

  getConfig: (adminUserId) =>
    adminFetch('/config', adminUserId),

  updateConfig: (adminUserId, patch) =>
    adminFetch('/config', adminUserId, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  clearConfigKey: (adminUserId, key) =>
    adminFetch(`/config/${key}`, adminUserId, { method: 'DELETE' }),

  getGifts: (adminUserId) =>
    adminFetch('/gifts', adminUserId),

  createGift: (adminUserId, gift) =>
    adminFetch('/gifts', adminUserId, {
      method: 'POST',
      body: JSON.stringify(gift),
    }),

  updateGift: (adminUserId, key, patch) =>
    adminFetch(`/gifts/${key}`, adminUserId, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  setGiftEnabled: (adminUserId, key, enabled) =>
    adminFetch(`/gifts/${key}/enabled`, adminUserId, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
};
