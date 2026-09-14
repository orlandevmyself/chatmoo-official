const API_BASE = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

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

  cleanup: (adminUserId) =>
    adminFetch('/cleanup', adminUserId, { method: 'POST' }),

  resetAllData: (adminUserId) =>
    adminFetch('/reset-all-data', adminUserId, { method: 'POST' }),

  reseedData: (adminUserId) =>
    adminFetch('/reseed-data', adminUserId, { method: 'POST' }),

  getWalletStats: (adminUserId) =>
    adminFetch('/wallet/stats', adminUserId),

  withdrawAdminIncome: (adminUserId, amountMinor, method, destination) =>
    adminFetch('/wallet/withdraw', adminUserId, {
      method: 'POST',
      body: JSON.stringify({ amountMinor, method, destination }),
    }),

  // Loud Speaker
  getLoudSpeakerStats: (adminUserId) =>
    adminFetch('/loud-speaker/stats', adminUserId),

  getLoudSpeakerCampaigns: (adminUserId, params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.scope) query.set('scope', params.scope);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    return adminFetch(`/loud-speaker/campaigns?${query}`, adminUserId);
  },

  getLoudSpeakerCampaignDetails: (adminUserId, campaignId) =>
    adminFetch(`/loud-speaker/campaigns/${campaignId}`, adminUserId),

  getLoudSpeakerConfig: (adminUserId) =>
    adminFetch('/loud-speaker/config', adminUserId),

  updateLoudSpeakerConfig: (adminUserId, config) =>
    adminFetch('/loud-speaker/config', adminUserId, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  cancelLoudSpeakerCampaign: (adminUserId, campaignId, reason) =>
    adminFetch(`/loud-speaker/campaigns/${campaignId}/cancel`, adminUserId, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Vouchers
  getVouchers: (adminUserId, params = {}) => {
    const query = new URLSearchParams();
    if (params.active !== undefined) query.set('active', params.active);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    return adminFetch(`/vouchers?${query}`, adminUserId);
  },

  createVoucher: (adminUserId, data) =>
    adminFetch('/vouchers', adminUserId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVoucherDetail: (adminUserId, voucherId) =>
    adminFetch(`/vouchers/${voucherId}`, adminUserId),

  updateVoucher: (adminUserId, voucherId, data) =>
    adminFetch(`/vouchers/${voucherId}`, adminUserId, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
