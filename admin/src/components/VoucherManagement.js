import React, { useState, useEffect } from 'react';
import { Ticket, Copy, Check, AlertCircle, X } from 'lucide-react';
import { adminApi } from '../lib/api';

function VoucherManagement({ adminUserId }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // list, create
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  // Create form state
  const [formData, setFormData] = useState({
    bonusType: 'fixed',
    bonusAmount: 5000,
    maxBonusMinor: undefined,
    maxUses: 10,
    validUntil: '',
    description: '',
    code: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    fetchVouchers();
  }, [adminUserId, search]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const result = await adminApi.getVouchers(adminUserId, { search: search || undefined });
      setVouchers(result.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      setFormLoading(true);
      const payload = {
        bonusType: formData.bonusType,
        bonusAmount: parseInt(formData.bonusAmount),
        maxUses: parseInt(formData.maxUses),
        description: formData.description || undefined,
        code: formData.code || undefined,
      };

      if (formData.bonusType === 'percentage' && formData.maxBonusMinor) {
        payload.maxBonusMinor = parseInt(formData.maxBonusMinor);
      }

      if (formData.validUntil) {
        payload.validUntil = new Date(formData.validUntil).toISOString();
      }

      const result = await adminApi.createVoucher(adminUserId, payload);
      setGeneratedCode(result.code);
      setFormData({
        bonusType: 'fixed',
        bonusAmount: 5000,
        maxBonusMinor: undefined,
        maxUses: 10,
        validUntil: '',
        description: '',
        code: '',
      });
      // Re-fetch list
      await fetchVouchers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (voucherId, currentActive) => {
    try {
      await adminApi.updateVoucher(adminUserId, voucherId, { active: !currentActive });
      await fetchVouchers();
    } catch (err) {
      alert(`Failed to update voucher: ${err.message}`);
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const formatBonus = (bonus, type, maxBonus) => {
    if (type === 'percentage') {
      return `${bonus}%`;
    }
    const amount = (bonus / 100).toFixed(2);
    if (maxBonus) {
      const cap = (maxBonus / 100).toFixed(2);
      return `₱${amount} (cap: ₱${cap})`;
    }
    return `₱${amount}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Ticket className="text-coral" size={32} />
          <div>
            <h1 className="text-4xl font-bold text-navy">Voucher Management</h1>
            <p className="text-navy/60">Create and manage deposit bonus voucher codes</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'list'
              ? 'border-coral text-coral'
              : 'border-transparent text-navy/60 hover:text-navy'
          }`}
        >
          📋 Vouchers
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'create'
              ? 'border-coral text-coral'
              : 'border-transparent text-navy/60 hover:text-navy'
          }`}
        >
          ✨ Create New
        </button>
      </div>

      {/* LIST TAB */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Ticket className="mx-auto text-navy/30 mb-3" size={48} />
              <p className="text-navy/60">No vouchers created yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr className="text-left text-navy/60 font-semibold">
                      <th className="px-6 py-3">Code</th>
                      <th className="px-6 py-3">Bonus</th>
                      <th className="px-6 py-3">Uses</th>
                      <th className="px-6 py-3">Valid Until</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-semibold text-coral bg-coral/5 px-2 py-1 rounded">
                              {v.code}
                            </code>
                            <button
                              onClick={() => copyToClipboard(v.code)}
                              className="text-navy/40 hover:text-navy transition"
                              title="Copy code"
                            >
                              {copiedCode === v.code ? (
                                <Check size={16} className="text-green-600" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-navy">
                          {formatBonus(v.bonusAmount, v.bonusType, v.maxBonusMinor)}
                        </td>
                        <td className="px-6 py-3 text-navy">
                          {v.currentUses}/{v.maxUses}
                        </td>
                        <td className="px-6 py-3 text-navy/70">
                          {v.validUntil ? new Date(v.validUntil).toLocaleDateString() : 'No expiry'}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            v.status === 'Active' ? 'bg-green-100 text-green-700' :
                            v.status === 'Expired' ? 'bg-gray-100 text-gray-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={() => handleToggleActive(v.id, v.active)}
                            className={`text-sm px-3 py-1 rounded transition ${
                              v.active
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {v.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE TAB */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-lg shadow p-8">
          <h3 className="text-xl font-bold text-navy mb-6">Create New Voucher</h3>

          {generatedCode && (
            <div className="mb-6 p-6 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-semibold mb-2">✓ Voucher Created Successfully!</p>
              <div className="flex items-center gap-3 mt-3">
                <code className="text-2xl font-bold text-green-700 bg-white px-4 py-2 rounded border-2 border-green-300">
                  {generatedCode}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedCode)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  {copiedCode === generatedCode ? (
                    <>
                      <Check size={16} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Copy Code
                    </>
                  )}
                </button>
                <button
                  onClick={() => setGeneratedCode('')}
                  className="p-2 hover:bg-gray-100 rounded transition"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
              <p className="text-xs text-green-600 mt-4">Share this code with users to apply the bonus on deposit</p>
            </div>
          )}

          {formError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{formError}</p>
            </div>
          )}

          <form onSubmit={handleCreateVoucher} className="space-y-6">
            {/* Bonus Type */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Bonus Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bonusType"
                    value="fixed"
                    checked={formData.bonusType === 'fixed'}
                    onChange={(e) => setFormData({ ...formData, bonusType: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-navy">Fixed Amount (₱)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bonusType"
                    value="percentage"
                    checked={formData.bonusType === 'percentage'}
                    onChange={(e) => setFormData({ ...formData, bonusType: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-navy">Percentage (%)</span>
                </label>
              </div>
            </div>

            {/* Bonus Amount */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Bonus Amount {formData.bonusType === 'percentage' ? '(%)' : '(₱ in centavos)'}
              </label>
              <input
                type="number"
                min="1"
                value={formData.bonusAmount}
                onChange={(e) => setFormData({ ...formData, bonusAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
              />
              <p className="text-xs text-navy/60 mt-1">
                {formData.bonusType === 'fixed'
                  ? `₱${(parseInt(formData.bonusAmount) / 100).toFixed(2)}`
                  : `${formData.bonusAmount}% of deposit amount`}
              </p>
            </div>

            {/* Max Bonus (percentage only) */}
            {formData.bonusType === 'percentage' && (
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">
                  Max Bonus Cap (₱ in centavos) <span className="text-navy/50">Optional</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxBonusMinor || ''}
                  onChange={(e) => setFormData({ ...formData, maxBonusMinor: e.target.value })}
                  placeholder="e.g., 10000 for ₱100 cap"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
                />
                <p className="text-xs text-navy/60 mt-1">
                  {formData.maxBonusMinor
                    ? `Bonus will be capped at ₱${(parseInt(formData.maxBonusMinor) / 100).toFixed(2)}`
                    : 'No cap (unlimited)'}
                </p>
              </div>
            )}

            {/* Max Uses */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Max Total Uses</label>
              <input
                type="number"
                min="1"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
              />
              <p className="text-xs text-navy/60 mt-1">Total number of times this code can be redeemed</p>
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Valid Until <span className="text-navy/50">Optional</span>
              </label>
              <input
                type="datetime-local"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
              />
              <p className="text-xs text-navy/60 mt-1">Leave empty for no expiration</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Description <span className="text-navy/50">Optional</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Welcome bonus for new users"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
              />
            </div>

            {/* Custom Code */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Custom Code <span className="text-navy/50">Optional</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Leave empty to auto-generate"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral font-mono"
              />
              <p className="text-xs text-navy/60 mt-1">Auto-generates if empty (format: XXXX-XXXX)</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full px-6 py-3 bg-coral text-white font-semibold rounded-lg hover:bg-coral/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? 'Creating...' : 'Create Voucher'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default VoucherManagement;
