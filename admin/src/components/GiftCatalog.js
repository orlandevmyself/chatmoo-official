import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { AlertCircle, CheckCircle, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

function GiftCatalog({ adminUserId }) {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    coins: '',
    amountMinor: '',
    emoji: '',
    color: '#FF6B4A',
    lucide: '',
  });

  useEffect(() => {
    fetchGifts();
  }, [adminUserId]);

  const fetchGifts = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getGifts(adminUserId);
      setGifts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingKey) {
        await adminApi.updateGift(adminUserId, editingKey, {
          label: formData.label,
          coins: parseInt(formData.coins, 10),
          amountMinor: parseInt(formData.amountMinor, 10),
          emoji: formData.emoji,
          color: formData.color,
          lucide: formData.lucide,
        });
        setSuccess(`Gift "${formData.label}" updated`);
      } else {
        await adminApi.createGift(adminUserId, {
          key: formData.key,
          label: formData.label,
          coins: parseInt(formData.coins, 10),
          amountMinor: parseInt(formData.amountMinor, 10),
          emoji: formData.emoji,
          color: formData.color,
        });
        setSuccess(`Gift "${formData.label}" created`);
      }
      fetchGifts();
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleEnabled = async (key, enabled) => {
    try {
      setError('');
      await adminApi.setGiftEnabled(adminUserId, key, !enabled);
      fetchGifts();
      setSuccess(`Gift ${!enabled ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (gift) => {
    setEditingKey(gift.key);
    setFormData({
      key: gift.key,
      label: gift.label,
      coins: gift.coins.toString(),
      amountMinor: gift.amountMinor.toString(),
      emoji: gift.emoji,
      color: gift.color,
      lucide: gift.lucide || '',
    });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingKey(null);
    setFormData({
      key: '',
      label: '',
      coins: '',
      amountMinor: '',
      emoji: '',
      color: '#FF6B4A',
      lucide: '',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-navy">Gift Catalog</h1>
          <p className="text-gray-600 mt-2">Manage available gifts and their pricing</p>
        </div>
        <button
          onClick={() => {
            setEditingKey(null);
            setIsFormOpen(!isFormOpen);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition"
        >
          <Plus size={20} />
          New Gift
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {isFormOpen && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-navy mb-6">
            {editingKey ? 'Edit Gift' : 'Create New Gift'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!editingKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gift Key</label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleFormChange}
                  placeholder="unique_key"
                  pattern="^[a-z][a-z0-9_]{1,31}$"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">2-32 lowercase letters, digits, underscores</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
              <input
                type="text"
                name="label"
                value={formData.label}
                onChange={handleFormChange}
                placeholder="e.g., Gold Gift"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coins</label>
              <input
                type="number"
                name="coins"
                value={formData.coins}
                onChange={handleFormChange}
                min="1"
                max="100000"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₱ minor units)</label>
              <input
                type="number"
                name="amountMinor"
                value={formData.amountMinor}
                onChange={handleFormChange}
                min="1"
                max="10000000"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">1 peso = 100 minor units</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emoji</label>
              <input
                type="text"
                name="emoji"
                value={formData.emoji}
                onChange={handleFormChange}
                placeholder="🎁"
                maxLength="8"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <input
                type="color"
                name="color"
                value={formData.color}
                onChange={handleFormChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Lucide Icon (optional)</label>
              <input
                type="text"
                name="lucide"
                value={formData.lucide}
                onChange={handleFormChange}
                placeholder="e.g., heart, star, gift"
                maxLength="32"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition font-medium"
              >
                {editingKey ? 'Update Gift' : 'Create Gift'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gifts.map((gift) => (
          <div key={gift.key} className="bg-white rounded-lg shadow p-6 border-t-4" style={{ borderTopColor: gift.color }}>
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{gift.emoji}</div>
              <button
                onClick={() => handleToggleEnabled(gift.key, gift.enabled)}
                className={`p-2 rounded-lg transition ${
                  gift.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {gift.enabled ? <Eye size={20} /> : <EyeOff size={20} />}
              </button>
            </div>

            <h3 className="text-lg font-bold text-navy mb-2">{gift.label}</h3>
            <p className="text-sm text-gray-600 mb-4">{gift.key}</p>

            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Coins:</span>
                <span className="font-semibold">{gift.coins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold">₱{(gift.amountMinor / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rank:</span>
                <span className="font-semibold">{gift.rank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-semibold ${gift.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {gift.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleEdit(gift)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <Edit2 size={18} />
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GiftCatalog;
