import React, { createContext, useContext, useEffect, useState } from 'react';
import { isOnline, subscribeToOnline } from '../utils/network';

const ConnectionContext = createContext({ online: true, reconnectTick: 0 });

export const useConnection = () => useContext(ConnectionContext);

export function ConnectionProvider({ children }) {
  const [state, setState] = useState(() => ({ online: isOnline(), reconnectTick: 0 }));

  useEffect(() => {
    return subscribeToOnline((online) => {
      setState((prev) => ({
        online,
        // Bumps every time we come back online so pages can re-run their loads.
        reconnectTick: online ? prev.reconnectTick + 1 : prev.reconnectTick,
      }));
    });
  }, []);

  return (
    <ConnectionContext.Provider value={state}>{children}</ConnectionContext.Provider>
  );
}

export default ConnectionProvider;