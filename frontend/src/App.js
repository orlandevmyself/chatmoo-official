import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './components/LandingPage';
import ChatPage from './components/ChatPage';
import ProfileSetup from './components/ProfileSetup';
import UserDashboard from './components/UserDashboard';
import SettingsPage from './components/SettingsPage';
import WalletPage from './components/WalletPage';
import LoudSpeakerPage from './components/LoudSpeakerPage';
import { sessionManager } from './utils/sessionManager';
import { resetAppSettings } from './utils/appSettings';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [profileTick, setProfileTick] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load session from localStorage on mount
    const loadSession = () => {
      // Check for Google OAuth callback in URL first
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('userId');
      const email = urlParams.get('email');
      const name = urlParams.get('name');
      const profileComplete = urlParams.get('profileComplete');

      if (userId && email) {
        // New OAuth callback - save session
        const newGoogleUser = {
          id: userId,
          email,
          name,
          profileComplete: profileComplete === 'true',
        };
        setGoogleUser(newGoogleUser);
        setGuestSession(null); // Clear guest session when user logs in
        sessionManager.saveSession(newGoogleUser);
        sessionManager.clearGuestSession(); // Clear guest session from storage
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // No OAuth callback - check for existing sessions
      const savedSession = sessionManager.getSession();
      if (savedSession && sessionManager.isSessionValid(savedSession)) {
        console.log('[App] Restoring authenticated session from storage:', savedSession);
        setGoogleUser(savedSession);
      } else {
        // Check for guest session
        const guestSessionData = sessionManager.getGuestSession();
        if (guestSessionData && sessionManager.isSessionValid(guestSessionData)) {
          console.log('[App] Restoring guest session from storage:', guestSessionData);
          setGuestSession(guestSessionData);
        } else {
          console.log('[App] No valid session found');
          sessionManager.clearSession();
          sessionManager.clearGuestSession();
        }
      }
    };

    loadSession();
    setRestoring(false);
  }, []);

  // Fetch wallet balance when user logs in
  useEffect(() => {
    let cancelled = false;
    if (!googleUser?.id) {
      setWalletBalance(null);
      return;
    }
    axios.get(`${API_URL}/wallet?userId=${googleUser.id}`)
      .then((res) => { if (!cancelled) setWalletBalance(res.data?.balance ?? null); })
      .catch(() => { if (!cancelled) setWalletBalance(null); });
    return () => { cancelled = true; };
  }, [googleUser?.id]);

  const handleStartChat = (sessionData) => {
    setSession(sessionData);

    // Update guest session if this is a guest user
    if (sessionData.isGuest) {
      sessionManager.saveGuestSession(sessionData);
      setGuestSession(sessionData);
    }
    navigate('/chat');
  };

  const handleBackToLanding = () => {
    setSession(null);
    navigate('/');
  };

  const handleProfileComplete = () => {
    const updatedUser = { ...googleUser, profileComplete: true };
    setGoogleUser(updatedUser);
    sessionManager.saveSession(updatedUser);
    navigate('/');
  };

  const handleLogout = () => {
    setGoogleUser(null);
    setGuestSession(null);
    setSession(null);
    sessionManager.clearSession();
    sessionManager.clearGuestSession();
    resetAppSettings();
    navigate('/');
  };

  if (restoring) {
    return <LoadingScreen />;
  }

  const dashboard = (
    <UserDashboard
      googleUser={googleUser}
      onLogout={handleLogout}
      onStartChat={handleStartChat}
      onOpenSettings={() => navigate('/settings')}
      onOpenWallet={() => navigate('/wallet')}
      refreshSignal={profileTick}
    />
  );

  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            googleUser ? (
              googleUser.profileComplete ? (
                dashboard
              ) : (
                <Navigate to="/profile-setup" replace />
              )
            ) : (
              <LandingPage
                onStartChat={handleStartChat}
                googleUser={googleUser}
                guestSession={guestSession}
                onLogout={handleLogout}
              />
            )
          }
        />
        <Route
          path="/profile-setup"
          element={
            googleUser && !googleUser.profileComplete ? (
              <ProfileSetup googleUser={googleUser} onComplete={handleProfileComplete} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/chat"
          element={
            session ? (
              <ChatPage session={session} onBackToLanding={handleBackToLanding} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            googleUser ? (
              <SettingsPage
                googleUser={googleUser}
                onBack={() => {
                  setProfileTick((t) => t + 1);
                  navigate('/');
                }}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/wallet"
          element={
            googleUser ? (
              <WalletPage
                googleUser={googleUser}
                onBack={() => {
                  setProfileTick((t) => t + 1);
                  navigate('/');
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/conversations/:conversationId"
          element={
            googleUser ? dashboard : <Navigate to="/" replace />
          }
        />
        <Route
          path="/loud-speaker"
          element={
            googleUser ? (
              <LoudSpeakerPage
                userId={googleUser.id}
                onBack={() => {
                  setProfileTick((t) => t + 1);
                  navigate('/');
                }}
                walletBalance={walletBalance}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;