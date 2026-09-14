import React, { useState, useEffect } from 'react';
import { Volume2, TrendingUp, Eye, MousePointer, DollarSign, Zap, AlertCircle, Save } from 'lucide-react';
import { adminApi } from '../lib/api';

function StatCard({ label, value, icon: Icon, subtext, color = 'coral' }) {
  const colorClass = {
    coral: 'text-coral',
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
  }[color] || 'text-coral';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-coral hover:shadow-lg transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-navy/60 text-sm font-medium">{label}</p>
          <p className="text-4xl font-bold text-navy mt-3">{value}</p>
          {subtext && <p className="text-xs text-navy/50 mt-2">{subtext}</p>}
        </div>
        <Icon className={`${colorClass}`} size={40} />
      </div>
    </div>
  );
}

function LoudSpeakerDashboard({ adminUserId }) {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [config, setConfig] = useState(null);
  const [configEditing, setConfigEditing] = useState(false);
  const [configTemp, setConfigTemp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('stats'); // stats, campaigns, config

  useEffect(() => {
    fetchData();
  }, [adminUserId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, campaignsData, configData] = await Promise.all([
        adminApi.getLoudSpeakerStats(adminUserId),
        adminApi.getLoudSpeakerCampaigns(adminUserId),
        adminApi.getLoudSpeakerConfig(adminUserId),
      ]);
      setStats(statsData);
      setCampaigns(campaignsData.items || []);
      setConfig(configData);
      setConfigTemp(configData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSave = async () => {
    try {
      const updated = await adminApi.updateLoudSpeakerConfig(adminUserId, configTemp);
      setConfig(updated);
      setConfigEditing(false);
      alert('Configuration updated successfully!');
    } catch (err) {
      alert(`Failed to update config: ${err.message}`);
    }
  };

  const updatePrice = (scope, value) => {
    setConfigTemp({
      ...configTemp,
      basePrices: {
        ...configTemp.basePrices,
        [scope]: parseInt(value) || 0,
      },
    });
  };

  const updateLimit = (key, value) => {
    setConfigTemp({
      ...configTemp,
      limits: {
        ...configTemp.limits,
        [key]: parseInt(value) || 0,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Volume2 className="text-coral" size={32} />
          <div>
            <h1 className="text-4xl font-bold text-navy">Loud Speaker Dashboard</h1>
            <p className="text-navy/60">Manage advertising campaigns and revenue</p>
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
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'stats'
              ? 'border-coral text-coral'
              : 'border-transparent text-navy/60 hover:text-navy'
          }`}
        >
          📊 Statistics
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'campaigns'
              ? 'border-coral text-coral'
              : 'border-transparent text-navy/60 hover:text-navy'
          }`}
        >
          📢 Campaigns
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            activeTab === 'config'
              ? 'border-coral text-coral'
              : 'border-transparent text-navy/60 hover:text-navy'
          }`}
        >
          ⚙️ Configuration
        </button>
      </div>

      {/* STATISTICS TAB */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Campaigns"
              value={stats.campaigns.total}
              icon={Volume2}
              subtext={`${stats.campaigns.active} active`}
              color="coral"
            />
            <StatCard
              label="Completed Campaigns"
              value={stats.campaigns.completed}
              icon={TrendingUp}
              subtext="Ready to renew"
              color="green"
            />
            <StatCard
              label="Total Impressions"
              value={(stats.engagement.totalImpressions || 0).toLocaleString()}
              icon={Eye}
              subtext={`CTR: ${stats.engagement.ctr}%`}
              color="blue"
            />
            <StatCard
              label="Total Clicks"
              value={(stats.engagement.totalClicks || 0).toLocaleString()}
              icon={MousePointer}
              subtext="User interactions"
              color="purple"
            />
          </div>

          {/* Revenue */}
          <div className="bg-gradient-to-r from-coral/10 to-orange-100 rounded-lg shadow p-6 border-l-4 border-coral">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-navy/60 text-sm font-medium">Total Revenue</p>
                <p className="text-5xl font-bold text-coral mt-2">₱{(stats.revenue.totalPHP || 0).toFixed(2)}</p>
                <p className="text-sm text-navy/60 mt-2">From {stats.campaigns.total} campaigns</p>
              </div>
              <DollarSign className="text-coral" size={60} />
            </div>
          </div>

          {/* By Scope */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-navy mb-4">Revenue by Scope</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(stats.byScope || {}).map(([scope, data]: [string, any]) => (
                <div key={scope} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-navy capitalize">{scope}</p>
                    <span className="text-sm font-bold text-coral">₱{(data.revenue / 100).toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-navy/60">{data.count} campaigns</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div>
          <h3 className="text-lg font-bold text-navy mb-6 flex items-center gap-2">
            <Volume2 size={20} className="text-coral" />
            Your Campaigns
          </h3>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-navy/60">No campaigns yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {campaigns.map((campaign) => {
                const stripHtml = (html) => {
                  const tmp = document.createElement('DIV');
                  tmp.innerHTML = html;
                  return tmp.textContent || tmp.innerText || '';
                };
                const messageText = stripHtml(campaign.message || '').substring(0, 100);
                const statusColors = {
                  active: 'border-green-200 bg-green-50',
                  scheduled: 'border-blue-200 bg-blue-50',
                  completed: 'border-gray-200 bg-gray-50',
                  cancelled: 'border-red-200 bg-red-50',
                };
                const statusBadge = {
                  active: 'bg-green-100 text-green-700',
                  scheduled: 'bg-blue-100 text-blue-700',
                  completed: 'bg-gray-100 text-gray-700',
                  cancelled: 'bg-red-100 text-red-700',
                };

                return (
                  <div
                    key={campaign.id}
                    className={`border-l-4 rounded-lg shadow-sm hover:shadow-md transition p-5 ${statusColors[campaign.status] || statusColors.scheduled}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusBadge[campaign.status]}`}>
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </span>
                          <span className="text-xs text-navy/60 flex items-center gap-1">
                            📍 {campaign.scope}
                          </span>
                        </div>
                        <p className="text-sm text-navy font-medium line-clamp-2">{messageText}...</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 text-sm">
                      <div className="bg-white/60 rounded p-2 text-center">
                        <p className="text-xs text-navy/60">Price</p>
                        <p className="font-bold text-navy">₱{(campaign.price / 100).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <p className="text-xs text-navy/60">Impressions</p>
                        <p className="font-bold text-navy">{campaign.impressions}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <p className="text-xs text-navy/60">Clicks</p>
                        <p className="font-bold text-navy">{campaign.clicks}</p>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <p className="text-xs text-navy/60">CTR</p>
                        <p className="font-bold text-navy">{campaign.ctr || 0}%</p>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <p className="text-xs text-navy/60">Duration</p>
                        <p className="font-bold text-navy text-xs">{campaign.durationMinutes}min</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-current border-opacity-10 text-xs text-navy/60 flex justify-between">
                      <span>Start: {new Date(campaign.startAt).toLocaleString()}</span>
                      <span>End: {new Date(campaign.endAt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && configTemp && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-navy flex items-center gap-2">
              <Zap size={20} className="text-coral" />
              Configuration
            </h3>
            {configEditing ? (
              <button
                onClick={handleConfigSave}
                className="flex items-center gap-2 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition"
              >
                <Save size={16} />
                Save Changes
              </button>
            ) : (
              <button
                onClick={() => setConfigEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-coral text-coral rounded-lg hover:bg-coral/5 transition"
              >
                <Zap size={16} />
                Edit
              </button>
            )}
          </div>

          {/* Feature Status */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 font-medium">
              🔊 Loud Speaker is currently <span className={configTemp.enabled ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {configTemp.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </p>
          </div>

          {/* Pricing Configuration */}
          <div className="space-y-4 mb-6">
            <h4 className="font-bold text-navy">💰 Base Price (per 30 minutes)</h4>
            <p className="text-sm text-navy/60">Final cost = Base Price × (Duration ÷ 30 min)</p>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(configTemp.basePrices || {}).map(([scope, price]) => {
                const thirtyMinPrice = price / 100;
                const oneHourPrice = (price * 2) / 100;
                const twoHourPrice = (price * 4) / 100;
                return (
                  <div key={scope}>
                    <label className="block text-sm font-semibold text-navy mb-1 capitalize">{scope}</label>
                    <div className="flex items-center mb-2">
                      <span className="text-navy/60 text-sm">₱</span>
                      <input
                        type="number"
                        value={thirtyMinPrice}
                        onChange={(e) => updatePrice(scope, (parseFloat(e.target.value) || 0) * 100)}
                        disabled={!configEditing}
                        className="ml-1 flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 text-sm"
                        step="0.01"
                      />
                    </div>
                    <div className="text-xs text-navy/50 space-y-0.5">
                      <p>30 min: ₱{thirtyMinPrice.toFixed(2)}</p>
                      <p>1 hour: ₱{oneHourPrice.toFixed(2)}</p>
                      <p>2 hours: ₱{twoHourPrice.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Limits Configuration */}
          <div className="space-y-4">
            <h4 className="font-bold text-navy">⏱️ Duration Limits (minutes)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">Minimum Duration</label>
                <input
                  type="number"
                  value={configTemp.limits?.minDurationMinutes || 30}
                  onChange={(e) => updateLimit('minDurationMinutes', e.target.value)}
                  disabled={!configEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">Maximum Duration</label>
                <input
                  type="number"
                  value={configTemp.limits?.maxDurationMinutes || 480}
                  onChange={(e) => updateLimit('maxDurationMinutes', e.target.value)}
                  disabled={!configEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Max Message Length (characters)</label>
              <input
                type="number"
                value={configTemp.limits?.maxMessageLength || 500}
                onChange={(e) => updateLimit('maxMessageLength', e.target.value)}
                disabled={!configEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoudSpeakerDashboard;
