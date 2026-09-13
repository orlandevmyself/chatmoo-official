import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Trash2 } from 'lucide-react';
import CreateLoudSpeaker from './CreateLoudSpeaker';
import LoudSpeaker from './LoudSpeaker';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function LoudSpeakerPage({ userId, onBack, walletBalance }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [userId]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/loud-speaker/user?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      } else {
        setError('Failed to load campaigns');
      }
    } catch (err) {
      setError('Failed to load campaigns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignCreated = (newCampaign) => {
    setCampaigns([newCampaign, ...campaigns]);
    setTimeout(() => fetchCampaigns(), 1000);
  };

  const handleDelete = async (campaignId) => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/loud-speaker/${campaignId}?userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCampaigns(campaigns.filter((c) => c.id !== campaignId));
        setDeleteConfirm(null);
      } else {
        const err = await response.json();
        alert(err.message || 'Failed to cancel campaign');
      }
    } catch (err) {
      alert('Failed to cancel campaign');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return '🟢 Active';
      case 'scheduled':
        return '🔵 Scheduled';
      case 'completed':
        return '⚪ Completed';
      case 'cancelled':
        return '❌ Cancelled';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-navy hover:text-coral transition"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-navy">🔊 Loud Speaker</h1>
            <p className="text-navy/60 text-sm">Promote your message to active users</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Create Campaign Section */}
        <div>
          <CreateLoudSpeaker userId={userId} balance={walletBalance} onSuccess={handleCampaignCreated} />
        </div>

        {/* Preview Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-navy mb-4">Live Preview</h2>
          <p className="text-sm text-navy/60 mb-4">This is how your message appears to other users:</p>
          <LoudSpeaker scope="sitewide" userId={userId} />
        </div>

        {/* Campaigns List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-navy mb-4">Your Campaigns</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2 mb-6">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-navy/50">
              <p className="text-lg">No campaigns yet</p>
              <p className="text-sm">Create your first Loud Speaker above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                          {getStatusLabel(campaign.status)}
                        </span>
                        <span className="text-xs text-navy/60">
                          {campaign.scope === 'sitewide' ? '🌐 Entire Site' : `📍 ${campaign.scope}`}
                        </span>
                      </div>
                      <p className="text-navy font-medium mb-3">{campaign.message}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm text-navy/60">
                        <div>
                          <span className="font-semibold text-navy">Price:</span> {campaign.price}
                        </div>
                        <div>
                          <span className="font-semibold text-navy">Impressions:</span> {campaign.impressions || 0}
                        </div>
                        <div>
                          <span className="font-semibold text-navy">Clicks:</span> {campaign.clicks || 0}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-navy/50 space-y-1">
                        <div>
                          Starts: {new Date(campaign.startAt).toLocaleString()}
                        </div>
                        <div>
                          Ends: {new Date(campaign.endAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {campaign.status === 'scheduled' && (
                      <button
                        onClick={() => setDeleteConfirm(campaign.id)}
                        className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded transition text-sm font-medium"
                      >
                        <Trash2 size={16} />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-navy mb-3">Cancel Campaign?</h3>
            <p className="text-navy/70 mb-6">
              This scheduled campaign will be cancelled and you'll receive a full refund.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={deleting}
              >
                Keep It
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Cancelling...' : 'Cancel Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoudSpeakerPage;
