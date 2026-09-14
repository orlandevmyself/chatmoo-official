import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const blockReportApi = {
  // Block a user
  blockUser: (userId, blockedId, reason) =>
    axios.post(`${API_URL}/block-report/block`, { blockedId, reason }, {
      params: { userId },
    }),

  // Unblock a user
  unblockUser: (userId, blockedId) =>
    axios.delete(`${API_URL}/block-report/block/${blockedId}`, {
      params: { userId },
    }),

  // Get list of blocked users
  getBlockedUsers: (userId) =>
    axios.get(`${API_URL}/block-report/blocked-users`, {
      params: { userId },
    }),

  // Check if a user is blocked
  isUserBlocked: (blockerId, blockedId) =>
    axios.get(`${API_URL}/block-report/is-blocked`, {
      params: { blockerId, blockedId },
    }),

  // Report a user
  reportUser: (userId, reportedId, reason, description) =>
    axios.post(`${API_URL}/block-report/report`,
      { reportedId, reason, description },
      { params: { userId } }
    ),

  // Get my reports
  getMyReports: (userId) =>
    axios.get(`${API_URL}/block-report/my-reports`, {
      params: { userId },
    }),

  // Admin: Get all reports
  getReports: (adminUserId, status, page, limit) =>
    axios.get(`${API_URL}/block-report/admin/reports`, {
      params: { userId: adminUserId, status, page, limit },
    }),

  // Admin: Get reports about a specific user
  getReportsAboutUser: (adminUserId, reportedId) =>
    axios.get(`${API_URL}/block-report/admin/reports/${reportedId}`, {
      params: { userId: adminUserId },
    }),

  // Admin: Update report status
  updateReportStatus: (adminUserId, reportId, status) =>
    axios.patch(`${API_URL}/block-report/admin/reports/${reportId}`,
      { status },
      { params: { userId: adminUserId } }
    ),
};
