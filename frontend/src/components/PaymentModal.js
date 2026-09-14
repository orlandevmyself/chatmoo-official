import React, { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import paymongoApi from '../utils/paymongoApi';

const PAYMENT_PURPOSES = {
  WALLET_TOPUP: 'wallet',
  GIFT_PURCHASE: 'gift',
  PREMIUM_UPGRADE: 'premium',
};

const PRESET_AMOUNTS = {
  wallet: [100, 500, 1000, 5000],
  gift: [50, 100, 250, 500],
  premium: [99],
};

function PaymentModal({ isOpen, onClose, purpose = 'wallet', onSuccess, userId, initialAmount = '' }) {
  const [step, setStep] = useState('amount'); // amount, payment-method, processing, success
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSelectAmount = (selectedAmount) => {
    setAmount(selectedAmount.toString());
  };

  const handleContinue = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!userId) {
      setError('User information is missing. Please reload and try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const description = `${purpose === 'wallet' ? 'Wallet Top-up' : purpose === 'gift' ? 'Gift Purchase' : 'Premium Upgrade'} - PHP ${amount}`;

      // Create a hosted checkout session. The webhook uses userId in metadata
      // to credit the correct wallet, so no redirect/return flow needed here.
      const checkout = await paymongoApi.createCheckoutSession(
        parseFloat(amount),
        'PHP',
        description,
        {
          purpose,
          email,
          userId,
        }
      );

      const checkoutUrl =
        checkout?.attributes?.checkout_url || checkout?.checkout_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError('Failed to generate payment link. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {purpose === 'wallet' ? 'Top-up Wallet' : purpose === 'gift' ? 'Buy Gift' : 'Upgrade Premium'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Amount Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Select Amount or Enter Custom
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS[purpose]?.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSelectAmount(preset)}
                  className={`px-3 py-2 rounded-lg font-medium transition ${
                    amount === preset.toString()
                      ? 'bg-coral text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ₱{preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Or enter custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
              min="1"
              step="1"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/50"
            />
          </div>

          {/* Summary */}
          {amount && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold text-gray-900">₱{parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-500">
                Processing fee may apply
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={loading || !amount || !email}
            className="flex-1 px-4 py-2 bg-coral text-white rounded-lg font-medium hover:bg-coral/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              'Continue to Payment'
            )}
          </button>
        </div>

        {/* Info */}
        <div className="px-6 pb-4 text-xs text-gray-500 border-t border-gray-100">
          You will be redirected to PayMongo secure payment page. Your payment is encrypted and secure.
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
