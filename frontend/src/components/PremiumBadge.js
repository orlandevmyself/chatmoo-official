import React from 'react';
import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';

function PremiumBadge({ isPremium, daysRemaining, className, size = 'sm' }) {
  if (!isPremium) return null;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-sm',
    md: 'px-3 py-1.5 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 bg-gradient-to-r from-coral to-softPurple text-white font-semibold rounded-full',
        sizeClasses[size],
        className
      )}
      title={daysRemaining ? `Premium active for ${daysRemaining} more days` : 'Premium member'}
    >
      <Zap className="w-3 h-3" />
      <span>Premium</span>
      {daysRemaining && <span className="text-xs opacity-80">({daysRemaining}d)</span>}
    </div>
  );
}

export default PremiumBadge;
