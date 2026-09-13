import React, { useState, useEffect } from 'react';
import { Volume2, AlertCircle } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function CreateLoudSpeaker({ userId, balance, onSuccess }) {
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState('sitewide');
  const [duration, setDuration] = useState(60);
  const [animation, setAnimation] = useState('none');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [config, setConfig] = useState(null);
  const [loudSpeakerOptions, setLoudSpeakerOptions] = useState([]);
  const [durations, setDurations] = useState([]);
  const [bannerStyle, setBannerStyle] = useState('gradient-coral');
  const [buttonLabel, setButtonLabel] = useState('Visit');
  const [buttonLink, setButtonLink] = useState('https://');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);

  // Extract plain text from HTML for character limit check
  const getPlainText = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.innerText || temp.textContent || '';
  };

  const plainTextLength = getPlainText(message).length;

  const bannerStyles = {
    'gradient-coral': 'bg-gradient-to-r from-coral/10 to-orange-100 border-l-4 border-coral',
    'gradient-blue': 'bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-500',
    'gradient-purple': 'bg-gradient-to-r from-purple-100 to-purple-50 border-l-4 border-purple-500',
    'gradient-green': 'bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-500',
    'solid-coral': 'bg-coral text-white border-2 border-coral/50',
    'solid-dark': 'bg-navy text-white border-2 border-navy/50',
    'neon-pink': 'bg-pink-200 border-4 border-pink-500 shadow-lg',
    'rounded-soft': 'bg-cream border-2 border-coral rounded-3xl',
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setConfigLoading(true);
      const response = await fetch(`${API_BASE}/loud-speaker/config`);
      if (response.ok) {
        const configData = await response.json();
        setConfig(configData);

        // Build options from admin config
        const scopes = ['homepage', 'chat', 'conversations', 'sitewide'];
        const labels = {
          homepage: '🏠 Homepage',
          chat: '💬 Chat (Normal)',
          conversations: '📖 Conversations (Saved)',
          sitewide: '🌐 Entire Site',
        };

        const options = scopes.map((scopeKey) => ({
          scope: scopeKey,
          label: labels[scopeKey],
          basePriceMinor: configData.basePrices[scopeKey],
        }));

        setLoudSpeakerOptions(options);
        setScope('sitewide'); // Set default

        // Build duration options
        const minDuration = configData.limits.minDurationMinutes || 30;
        const maxDuration = configData.limits.maxDurationMinutes || 480;
        const durationList = [];

        for (let mins = minDuration; mins <= maxDuration; mins *= 2) {
          const hours = Math.floor(mins / 60);
          const remainingMins = mins % 60;
          let label = '';

          if (remainingMins === 0) {
            label = hours === 1 ? '1 hour' : `${hours} hours`;
          } else {
            label = `${mins} minutes`;
          }

          durationList.push({ minutes: mins, label });

          if (mins >= maxDuration / 2) break;
        }

        if (!durationList.find((d) => d.minutes === maxDuration)) {
          const hours = Math.floor(maxDuration / 60);
          durationList.push({ minutes: maxDuration, label: `${hours} hours` });
        }

        setDurations(durationList);
        setDuration(minDuration);
      }
    } catch (err) {
      console.error('Failed to fetch Loud Speaker config:', err);
      // Fallback to defaults
      setConfig({
        enabled: true,
        basePrices: { homepage: 1000, conversations: 1000, sitewide: 2000 },
        limits: { minDurationMinutes: 30, maxDurationMinutes: 480, maxMessageLength: 100 },
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const selectedOption = loudSpeakerOptions.find((o) => o.scope === scope);
  const basePriceMinor = selectedOption?.basePriceMinor || 2000; // ₱20 per 30 min default
  const priceMinor = Math.ceil(basePriceMinor * (duration / 30)); // Calculate based on duration
  const maxMessageLength = 100;
  const hasBalance = balance && balance >= priceMinor;


  const calculateCampaignStartTime = async () => {
    try {
      const response = await fetch(`${API_BASE}/loud-speaker/active?scope=${scope}`);
      if (response.ok) {
        const campaigns = await response.json();
        // Each campaign displays for 5 seconds in rotation
        const queuePosition = campaigns.length;
        const secondsToWait = queuePosition * 5;

        // Calculate actual date and time
        const now = new Date();
        const startTime = new Date(now.getTime() + secondsToWait * 1000);

        // Format: "Sep 14, 2:30 PM"
        const dateStr = startTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        const timeStr = startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        return `${dateStr} at ${timeStr}`;
      }
      return null;
    } catch (err) {
      console.error('Failed to calculate start time:', err);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (plainTextLength === 0) {
      setError('Please enter your message');
      return;
    }

    if (plainTextLength > maxMessageLength) {
      setError(`Message is too long (max ${maxMessageLength} characters)`);
      return;
    }

    if (!hasBalance) {
      setError(`Insufficient balance. Need ₱${(priceMinor / 100).toFixed(2)}`);
      return;
    }

    // Show confirmation dialog instead of submitting directly
    setLoading(true);
    try {
      const startTime = await calculateCampaignStartTime();
      setScheduledTime(startTime);
      setShowConfirmation(true);
    } catch (err) {
      setError('Failed to calculate scheduled time');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      const response = await fetch(`${API_BASE}/loud-speaker/create?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          scope,
          durationMinutes: duration,
          bannerStyle,
          buttonLabel: buttonLabel.trim() || 'Visit',
          buttonLink: buttonLink.trim() || 'https://',
          animation,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create campaign');
      }

      const data = await response.json();

      const successMessage = scheduledTime
        ? `✓ Your Loud Speaker is scheduled! Will appear ${scheduledTime} and run for ${duration} minutes.`
        : `✓ Your Loud Speaker is scheduled! Running for ${duration} minutes.`;

      setSuccess(successMessage);
      setMessage('');
      setButtonLabel('Visit');
      setButtonLink('https://');
      setBannerStyle('gradient-coral');
      setAnimation('none');
      if (onSuccess) onSuccess(data);

      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-coral flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-coral">
      <div className="flex items-center gap-2 mb-6">
        <Volume2 className="text-coral" size={24} />
        <div>
          <h2 className="text-2xl font-bold text-navy">Loud Speaker</h2>
          <p className="text-sm text-navy/60">Promote your message to active users</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">Your Message (Use toolbar to customize)</label>

          <ReactQuill
            value={message}
            onChange={setMessage}
            theme="snow"
            placeholder="What do you want to announce? (max 100 characters)"
            modules={{
              toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'font': [] }],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'align': [] }],
              ]
            }}
            formats={['bold', 'italic', 'underline', 'size', 'font', 'color', 'background', 'align']}
            readOnly={loading}
            className="bg-white rounded-lg border border-gray-300 focus:border-coral"
            style={{ minHeight: '120px' }}
          />
          <p className="text-xs text-navy/60 mt-2">
            {plainTextLength}/{maxMessageLength} characters
          </p>
        </div>

        {/* Scope Selection */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">Where should it appear?</label>
          <div className="grid grid-cols-2 gap-2">
            {loudSpeakerOptions.map((option) => {
              const optionPrice = Math.ceil(option.basePriceMinor * (duration / 30));
              return (
                <button
                  key={option.scope}
                  type="button"
                  onClick={() => setScope(option.scope)}
                  className={`p-3 rounded-lg border-2 transition text-left ${
                    scope === option.scope
                      ? 'border-coral bg-coral/5'
                      : 'border-gray-300 hover:border-coral/50'
                  }`}
                  disabled={loading}
                >
                  <p className="font-semibold text-navy text-sm">{option.label}</p>
                  <p className="text-coral font-bold text-sm">₱{(optionPrice / 100).toFixed(2)}</p>
                  {option.scope === 'sitewide' && (
                    <p className="text-xs text-navy/50 mt-1">All pages</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">How long?</label>
          <div className="grid grid-cols-2 gap-2">
            {durations.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className={`p-3 rounded-lg border-2 transition ${
                  duration === d.minutes
                    ? 'border-coral bg-coral/5'
                    : 'border-gray-300 hover:border-coral/50'
                }`}
                disabled={loading}
              >
                <p className="font-semibold text-navy text-sm">{d.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Banner Style */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">🎨 Banner Style</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBannerStyle('gradient-coral')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'gradient-coral'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-gradient-to-r from-coral/10 to-orange-100 border-l-4 border-coral p-2 rounded text-xs">
                Coral Gradient
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('gradient-blue')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'gradient-blue'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-500 p-2 rounded text-xs">
                Blue Gradient
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('gradient-purple')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'gradient-purple'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-gradient-to-r from-purple-100 to-purple-50 border-l-4 border-purple-500 p-2 rounded text-xs">
                Purple Gradient
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('solid-coral')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'solid-coral'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-coral text-white border-2 border-coral/50 p-2 rounded text-xs">
                Solid Coral
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('solid-dark')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'solid-dark'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-navy text-white border-2 border-navy/50 p-2 rounded text-xs">
                Dark Solid
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('neon-pink')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'neon-pink'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-pink-200 border-4 border-pink-500 p-2 rounded text-xs font-bold">
                Neon Pink
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('gradient-green')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'gradient-green'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-500 p-2 rounded text-xs">
                Green Gradient
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBannerStyle('rounded-soft')}
              className={`p-3 rounded-lg border-2 transition ${
                bannerStyle === 'rounded-soft'
                  ? 'border-coral bg-coral/5'
                  : 'border-gray-300 hover:border-coral/50'
              }`}
              disabled={loading}
            >
              <div className="bg-cream border-2 border-coral rounded-3xl p-2 text-xs">
                Soft Rounded
              </div>
            </button>
          </div>
        </div>

        {/* Button Customization */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">🔗 Call-to-Action Button</label>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-navy/60 mb-1">Button Label</label>
              <input
                type="text"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder="e.g., Visit, Click Here, Learn More"
                maxLength="30"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-coral"
              />
              <p className="text-xs text-navy/60 mt-1">{buttonLabel.length}/30 characters</p>
            </div>
            <div>
              <label className="block text-xs text-navy/60 mb-1">Button Link</label>
              <input
                type="url"
                value={buttonLink}
                onChange={(e) => setButtonLink(e.target.value)}
                placeholder="https://example.com"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-coral"
              />
            </div>
          </div>
        </div>

        {/* Animation/Design Options */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">✨ Banner Animation</label>
          <select
            value={animation}
            onChange={(e) => setAnimation(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
          >
            <option value="none">Static (No Animation)</option>
            <option value="marquee">Marquee (Scrolling Text)</option>
            <option value="fadeInOut">Fade In & Out</option>
            <option value="slideIn">Slide In</option>
            <option value="pulse">Pulse</option>
            <option value="bounce">Bounce</option>
          </select>
        </div>

        {/* Live Preview */}
        <div>
          <label className="block text-sm font-semibold text-navy mb-3">👁️ Live Preview</label>
          <style>{`
            @keyframes marqueeAnim {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
            @keyframes slideInAnim {
              0% { transform: translateX(-100%); opacity: 0; }
              100% { transform: translateX(0); opacity: 1; }
            }
            .preview-marquee { animation: marqueeAnim 15s linear infinite; }
            .preview-slideIn { animation: slideInAnim 0.6s ease-out; }
            .preview-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            .preview-content p, .preview-content strong, .preview-content em, .preview-content u {
              display: inline;
            }
          `}</style>
          <div className={`${bannerStyles[bannerStyle]} rounded-lg p-4 shadow-sm ${
            animation === 'marquee' ? 'overflow-hidden' : ''
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0 mt-1">📢</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-wide ${
                  bannerStyle.includes('solid') ? 'text-white' : 'text-coral'
                }`}>
                  Loud Speaker Preview
                </p>
                <div
                  className={`mt-2 break-words preview-content text-base ${
                    animation === 'fadeInOut' ? 'animate-pulse' :
                    animation === 'pulse' ? 'preview-pulse' :
                    animation === 'bounce' ? 'animate-bounce' :
                    animation === 'slideIn' ? 'preview-slideIn' :
                    animation === 'marquee' ? 'preview-marquee' : ''
                  } ${bannerStyle.includes('solid') ? 'text-white' : 'text-navy'}`}
                  dangerouslySetInnerHTML={{
                    __html: message || '<em>Your message will appear here...</em>'
                  }}
                  style={{
                    fontSize: 'inherit'
                  }}
                />
              </div>
              {buttonLabel && (
                <button
                  type="button"
                  disabled
                  className={`text-xs px-2 py-1 rounded font-semibold flex-shrink-0 transition ${
                    bannerStyle.includes('solid')
                      ? 'bg-white text-navy hover:bg-white/90'
                      : 'bg-coral text-white hover:bg-coral/90'
                  }`}
                >
                  {buttonLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-navy/5 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-navy/60">Total Cost</p>
              <p className="text-2xl font-bold text-navy">₱{(priceMinor / 100).toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-navy/60">Your Balance</p>
              <p className={`text-xl font-bold ${hasBalance ? 'text-green-600' : 'text-red-600'}`}>
                ₱{balance ? (balance / 100).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
            <Volume2 className="text-green-600 flex-shrink-0" size={20} />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !hasBalance || configLoading}
          className={`w-full py-3 rounded-lg font-bold transition ${
            hasBalance && !loading && !configLoading
              ? 'bg-coral text-white hover:bg-coral/90'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? 'Creating...' : 'Launch Loud Speaker'}
        </button>

        {!hasBalance && (
          <p className="text-xs text-red-600 text-center">
            Insufficient balance. Need ₱{(priceMinor / 100).toFixed(2)}
          </p>
        )}
      </form>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-navy">Confirm Your Campaign</h3>

            {/* Preview */}
            <div className={`${
              bannerStyle.includes('solid') ? (bannerStyle === 'solid-dark' ? 'text-white' : 'text-navy') : 'text-navy'
            } bg-gradient-to-r from-coral/10 to-orange-100 border-l-4 border-coral rounded-lg p-4`}>
              <p className="text-xs font-semibold text-coral uppercase mb-2">Preview</p>
              <div
                className="text-sm mb-3"
                dangerouslySetInnerHTML={{ __html: message || 'Your message' }}
              />
              <p className="text-xs text-navy/60">👤 {userId}</p>
            </div>

            {/* Details */}
            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-navy/60">Scope:</span>
                <span className="font-semibold text-navy capitalize">{scope}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy/60">Duration:</span>
                <span className="font-semibold text-navy">{duration} minutes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy/60">Cost:</span>
                <span className="font-semibold text-coral">₱{(priceMinor / 100).toFixed(2)}</span>
              </div>
              {scheduledTime && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-navy/60">Will appear:</span>
                  <span className="font-bold text-green-600">{scheduledTime}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-navy rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition disabled:opacity-50 font-semibold"
              >
                {loading ? 'Submitting...' : 'Confirm & Launch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateLoudSpeaker;
