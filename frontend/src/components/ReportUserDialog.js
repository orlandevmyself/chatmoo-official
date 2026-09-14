import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, AlertTriangle } from 'lucide-react';
import { blockReportApi } from '../utils/blockReportApi';

const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment or bullying',
  'Explicit content',
  'Spam or scam',
  'Underage user',
  'Other',
];

function ReportUserDialog({ userId, reportedUser, onClose, onReportSuccess }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await blockReportApi.reportUser(userId, reportedUser.id, selectedReason, description);
      setSuccess(true);
      setTimeout(() => {
        onReportSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">Report User</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="text-green-500 text-4xl mb-4">✓</div>
              <p className="text-gray-700 font-medium">Report submitted successfully</p>
              <p className="text-sm text-gray-500 mt-2">Thank you for helping keep the community safe</p>
            </div>
          ) : (
            <>
              {/* User Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reporting:</p>
                <p className="font-medium text-gray-900">{reportedUser.displayName || reportedUser.username}</p>
              </div>

              {/* Reason Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Reason for report *</label>
                <div className="space-y-2">
                  {REPORT_REASONS.map((reason) => (
                    <label key={reason} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="reason"
                        value={reason}
                        checked={selectedReason === reason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide any additional information that would help us review this report..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={loading || !selectedReason}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  Submit Report
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportUserDialog;
