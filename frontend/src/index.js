import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { ConnectionProvider } from './context/ConnectionContext';
import OfflineBanner from './components/OfflineBanner';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ConnectionProvider>
        <OfflineBanner />
        <App />
      </ConnectionProvider>
    </BrowserRouter>
  </React.StrictMode>
);