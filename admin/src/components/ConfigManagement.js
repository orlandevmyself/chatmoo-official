import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { AlertCircle, CheckCircle } from 'lucide-react';

function ConfigManagement({ adminUserId }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changes, setChanges] = useState({});

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getConfig(adminUserId);
        setConfig(data);
        setChanges({});
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [adminUserId]);

  const handleChange = (key, value) => {
    setChanges({ ...changes, [key]: parseInt(value, 10) });
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      setError('No changes to save');
      return;
    }

    try {
      setError('');
      setSuccess('');
      await adminApi.updateConfig(adminUserId, changes);
      setSuccess('Configuration updated successfully');
      setConfig({ ...config, ...changes });
      setChanges({});
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async (key) => {
    try {
      setError('');
      await adminApi.clearConfigKey(adminUserId, key);
      setSuccess(`${key} reset to default`);
      // Refetch to get updated values
      const data = await adminApi.getConfig(adminUserId);
      setConfig(data);
      setChanges({});
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const configFields = [
    {
      key: 'withdrawablePercent',
      label: 'Withdrawable Percentage',
      description: 'Percentage of balance users can withdraw (1-100)',
      min: 1,
      max: 100,
      unit: '%',
    },
    {
      key: 'minDepositMinor',
      label: 'Minimum Deposit',
      description: 'Minimum deposit amount in minor units (1 peso = 100 minor units)',
      min: 1,
      max: 100000000,
      unit: 'minor units',
    },
    {
      key: 'minWithdrawMinor',
      label: 'Minimum Withdrawal',
      description: 'Minimum withdrawal amount in minor units',
      min: 1,
      max: 100000000,
      unit: 'minor units',
    },
    {
      key: 'maxTxMinor',
      label: 'Maximum Transaction',
      description: 'Maximum transaction amount in minor units',
      min: 1000,
      max: 100000000,
      unit: 'minor units',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
          <AlertCircle className="text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error || 'Failed to load configuration'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">Platform Configuration</h1>
        <p className="text-gray-600 mt-2">Manage platform-level settings</p>
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

      <div className="bg-white rounded-lg shadow p-8">
        <div className="space-y-8">
          {configFields.map((field) => {
            const currentValue = changes[field.key] ?? config[field.key];
            const isChanged = changes[field.key] !== undefined;

            return (
              <div key={field.key} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <label className="block text-lg font-semibold text-navy">
                      {field.label}
                    </label>
                    <p className="text-sm text-gray-600 mt-1">{field.description}</p>
                  </div>
                  <button
                    onClick={() => handleReset(field.key)}
                    className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition"
                  >
                    Reset
                  </button>
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      min={field.min}
                      max={field.max}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-coral focus:border-transparent ${
                        isChanged ? 'border-coral bg-coral/5' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <span className="text-gray-600 text-sm px-3 py-3">{field.unit}</span>
                  {isChanged && (
                    <span className="text-xs font-medium text-coral bg-coral/10 px-3 py-2 rounded">
                      Changed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-8 pt-8 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={Object.keys(changes).length === 0}
            className="px-6 py-3 bg-coral text-white font-medium rounded-lg hover:bg-coral/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
          <button
            onClick={() => {
              setChanges({});
              setError('');
            }}
            disabled={Object.keys(changes).length === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfigManagement;
