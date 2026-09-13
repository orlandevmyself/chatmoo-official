import React, { useState } from 'react';
import { adminApi } from '../lib/api';
import { AlertCircle, Trash2, RotateCcw, Activity } from 'lucide-react';

function OperationButton({ icon: Icon, label, description, onClick, danger, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-start gap-2 p-6 rounded-lg border-2 transition disabled:opacity-50 ${
        danger
          ? 'border-red-300 bg-red-50 hover:bg-red-100 text-red-700'
          : 'border-coral/30 bg-white hover:bg-cream-50 text-navy'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={24} />
        <div>
          <h3 className="font-semibold text-lg">{label}</h3>
          <p className="text-sm opacity-70">{description}</p>
        </div>
      </div>
    </button>
  );
}

function Operations({ adminUserId }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleCleanup = async () => {
    if (!window.confirm('Clean up stale data (demo users, inactive sessions, empty chatrooms)?')) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.cleanup(adminUserId);
      setMessage(`✅ Cleanup complete! Deleted ${result.deletedDemoUsers} demo users, ${result.deletedSessions} sessions, and ${result.deletedChatrooms} chatrooms.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(`❌ Cleanup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('⚠️ THIS WILL DELETE ALL DATA! All conversations and users will be erased (admin account will remain). This cannot be undone. Type "RESET" to confirm.')) {
      return;
    }

    const confirmation = window.prompt('Type "RESET" to confirm permanent data deletion:');
    if (confirmation !== 'RESET') {
      setError('❌ Reset cancelled - confirmation did not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await adminApi.resetAllData(adminUserId);
      setMessage(`✅ ${result.message} Deleted ${result.deletedUsers} users, ${result.deletedConversations} conversations, ${result.deletedSessions} sessions.`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(`❌ Reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndSeed = async () => {
    if (!window.confirm('⚠️ Reset all data and reseed demo data? This will erase all conversations and most users. Type "RESEED" to confirm.')) {
      return;
    }

    const confirmation = window.prompt('Type "RESEED" to confirm:');
    if (confirmation !== 'RESEED') {
      setError('❌ Reseed cancelled - confirmation did not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await adminApi.reseedData(adminUserId);
      setMessage(`✅ ${result.message}`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      setError(`❌ Reseed failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-cream-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy">Operations</h1>
        <p className="text-navy/60 mt-2">Manage system-wide operations and data</p>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cleanup */}
        <OperationButton
          icon={Trash2}
          label="Clean Up Data"
          description="Remove demo accounts, inactive sessions, empty chatrooms"
          onClick={handleCleanup}
          loading={loading}
        />

        {/* Reset Data */}
        <OperationButton
          icon={RotateCcw}
          label="Reset All Data"
          description="Erase all conversations and users (admin remains)"
          onClick={handleResetData}
          danger
          loading={loading}
        />

        {/* Reseed Data */}
        <OperationButton
          icon={Activity}
          label="Reset & Reseed"
          description="Reset all data and create fresh demo accounts"
          onClick={handleResetAndSeed}
          danger
          loading={loading}
        />
      </div>

      <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Caution</h3>
        <p className="text-yellow-800 text-sm">
          Some operations are destructive and cannot be undone. Make sure you understand what each operation does before running it.
        </p>
      </div>
    </div>
  );
}

export default Operations;
