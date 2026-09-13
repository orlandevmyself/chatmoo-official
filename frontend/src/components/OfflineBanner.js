import React from 'react';
import { CloudOff, Wifi } from 'lucide-react';
import { useConnection } from '../context/ConnectionContext';

function OfflineBanner() {
  const { online } = useConnection();
  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-amber-500 text-white text-sm font-medium py-2 px-3 flex items-center justify-center gap-2 shadow-lg">
      <CloudOff className="w-4 h-4 shrink-0" />
      <span className="truncate">You're offline — reconnecting automatically when internet comes back.</span>
      <Wifi className="w-4 h-4 shrink-0 hidden" aria-hidden="true" />
    </div>
  );
}

export default OfflineBanner;