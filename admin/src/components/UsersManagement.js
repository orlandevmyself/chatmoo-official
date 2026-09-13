import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { Search, Shield, Ban, AlertCircle } from 'lucide-react';

function UsersManagement({ adminUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ role: '', banned: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async (searchVal = '', pageNum = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers(adminUserId, {
        search: searchVal || undefined,
        role: filters.role || undefined,
        banned: filters.banned ? filters.banned === 'true' : undefined,
        page: pageNum,
        limit: 25,
      });
      setUsers(data.items);
      setTotalPages(Math.ceil(data.total / data.limit));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(search, page);
  }, [filters, page]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => fetchUsers(val, 1), 300);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminApi.setUserRole(adminUserId, userId, newRole);
      fetchUsers(search, page);
    } catch (err) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  const handleBanChange = async (userId, shouldBan) => {
    if (shouldBan && !window.confirm('Ban this user? They will not be able to access the platform.')) {
      return;
    }
    try {
      await adminApi.setUserBan(adminUserId, userId, shouldBan);
      fetchUsers(search, page);
    } catch (err) {
      alert(`Failed to update ban status: ${err.message}`);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">User Management</h1>
        <p className="text-gray-600 mt-2">View and manage user accounts</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or username"
                value={search}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={filters.role}
              onChange={(e) => {
                setFilters({ ...filters, role: e.target.value });
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            >
              <option value="">All</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="guest">Guest</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.banned}
              onChange={(e) => {
                setFilters({ ...filters, banned: e.target.value });
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            >
              <option value="">All</option>
              <option value="false">Active</option>
              <option value="true">Banned</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr className="text-left font-semibold text-gray-700">
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Country</th>
                    <th className="pb-3">Profile</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-4">{user.email}</td>
                      <td className="py-4">{user.name || '-'}</td>
                      <td className="py-4">{user.country || '-'}</td>
                      <td className="py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          user.profileComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {user.profileComplete ? 'Complete' : 'Incomplete'}
                        </span>
                      </td>
                      <td className="py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-2 focus:ring-coral focus:border-transparent"
                        >
                          <option value="admin">Admin</option>
                          <option value="user">User</option>
                          <option value="guest">Guest</option>
                        </select>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleBanChange(user.id, !user.banned)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition ${
                            user.banned
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          <Ban size={14} />
                          {user.banned ? 'Unban' : 'Ban'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end mt-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default UsersManagement;
