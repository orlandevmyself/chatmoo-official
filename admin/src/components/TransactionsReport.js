import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { Search, Download, AlertCircle } from 'lucide-react';

function TransactionsReport({ adminUserId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ type: '', status: '', method: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = async (pageNum = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getTransactions(adminUserId, {
        type: filters.type || undefined,
        status: filters.status || undefined,
        method: filters.method || undefined,
        search: search || undefined,
        page: pageNum,
        limit: 25,
      });
      setTransactions(data.items);
      setTotalPages(Math.ceil(data.total / data.limit));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(page);
  }, [filters, page]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => fetchTransactions(1), 300);
  };

  const downloadCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['ID', 'User Email', 'Type', 'Amount (₱)', 'Fee', 'Status', 'Method', 'Provider', 'Created At'];
    const rows = transactions.map(t => [
      t.id,
      t.userEmail || '-',
      t.type,
      (t.amount / 100).toFixed(2),
      (t.fee / 100).toFixed(2),
      t.status,
      t.method || '-',
      t.provider,
      new Date(t.createdAt).toLocaleString(),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">Transaction Reports</h1>
        <p className="text-gray-600 mt-2">View and monitor all wallet transactions</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by user ID or remarks"
                value={search}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            >
              <option value="">All</option>
              <option value="deposit">Deposit</option>
              <option value="withdraw">Withdrawal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
            <select
              value={filters.method}
              onChange={(e) => {
                setFilters({ ...filters, method: e.target.value });
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
            >
              <option value="">All</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={downloadCSV}
            disabled={transactions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Export CSV
          </button>
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
                    <th className="pb-3">Date</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Fee</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="py-4">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="py-4">
                        <div className="text-sm">
                          <p className="font-medium">{tx.userName || '-'}</p>
                          <p className="text-gray-500 text-xs">{tx.userEmail || '-'}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          tx.type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </span>
                      </td>
                      <td className="py-4 font-medium">₱{(tx.amount / 100).toFixed(2)}</td>
                      <td className="py-4">₱{(tx.fee / 100).toFixed(2)}</td>
                      <td className="py-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-4">{tx.method || '-'}</td>
                      <td className="py-4 text-gray-600">{tx.provider}</td>
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

export default TransactionsReport;
