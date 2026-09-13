import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function LoudSpeakerDisplay({ campaign, userId }) {
  if (!campaign) return null;

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

  const bannerStyle = campaign.bannerStyle || 'gradient-coral';
  const buttonLabel = campaign.buttonLabel || 'Visit';
  const buttonLink = campaign.buttonLink || 'https://';
  const animation = campaign.animation || 'none';
  const textColor = bannerStyle.includes('solid') ? 'text-white' : 'text-navy';

  const recordImpression = async () => {
    try {
      await fetch(`${API_BASE}/loud-speaker/${campaign.id}/impression`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to record impression:', err);
    }
  };

  const recordClick = async () => {
    try {
      await fetch(`${API_BASE}/loud-speaker/${campaign.id}/click`, { method: 'POST' });
      if (buttonLink && buttonLink !== 'https://') {
        window.open(buttonLink, '_blank');
      }
    } catch (err) {
      console.error('Failed to record click:', err);
    }
  };

  useEffect(() => {
    recordImpression();
  }, [campaign.id]);

  return (
    <>
      <style>{`
        @keyframes marqueeAnim {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes slideInAnim {
          0% { transform: translateX(-100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .ls-marquee { animation: marqueeAnim 15s linear infinite; }
        .ls-slideIn { animation: slideInAnim 0.6s ease-out; }
        .ls-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .ls-content p, .ls-content strong, .ls-content em, .ls-content u {
          display: inline;
        }
      `}</style>

      <div className={`${bannerStyles[bannerStyle]} rounded-lg p-4 mb-4 shadow-sm ${
        animation === 'marquee' ? 'overflow-hidden' : ''
      }`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-1">📢</span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold text-coral uppercase tracking-wide ${
              bannerStyle.includes('solid') ? '!text-white' : ''
            }`}>
              Loud Speaker
            </p>
            <div
              className={`mt-2 break-words ls-content text-sm ${
                animation === 'fadeInOut' ? 'animate-pulse' :
                animation === 'pulse' ? 'ls-pulse' :
                animation === 'bounce' ? 'animate-bounce' :
                animation === 'slideIn' ? 'ls-slideIn' :
                animation === 'marquee' ? 'ls-marquee' : ''
              } ${textColor}`}
              dangerouslySetInnerHTML={{
                __html: campaign.message
              }}
            />
            {campaign.user && (
              <p className={`text-xs mt-2 ${bannerStyle.includes('solid') ? 'text-white/80' : 'text-navy/60'}`}>
                👤 {campaign.user?.name || campaign.user?.username}
              </p>
            )}
          </div>
          {buttonLabel && (
            <button
              onClick={recordClick}
              className={`text-xs px-2 py-1 rounded font-semibold flex-shrink-0 transition whitespace-nowrap ${
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
    </>
  );
}

export default LoudSpeakerDisplay;
