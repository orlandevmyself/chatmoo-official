import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import ChatPage from './components/ChatPage';
import ProfileSetup from './components/ProfileSetup';
import UserDashboard from './components/UserDashboard';
import SettingsPage from './components/SettingsPage';
import { sessionManager } from './utils/sessionManager';
import { resetAppSettings } from './utils/appSettings';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState('landing');
  const [googleUser, setGoogleUser] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [profileTick, setProfileTick] = useState(0);

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
          // For guest sessions, restore to landing page with the session data
          // The user can then start chatting again with their previous preferences
        } else {
          console.log('[App] No valid session found');
          sessionManager.clearSession();
          sessionManager.clearGuestSession();
        }
      }
    };

    loadSession();
  }, []);

  const handleStartChat = (sessionData) => {
    setSession(sessionData);
    setCurrentPage('chat');
    
    // Update guest session if this is a guest user
    if (sessionData.isGuest) {
      sessionManager.saveGuestSession(sessionData);
      setGuestSession(sessionData);
    }
  };

  const handleBackToLanding = () => {
    setSession(null);
    setCurrentPage('landing');
  };

  const handleProfileComplete = () => {
    const updatedUser = { ...googleUser, profileComplete: true };
    setGoogleUser(updatedUser);
    sessionManager.saveSession(updatedUser);
    setCurrentPage('landing');
  };

  const handleLogout = () => {
    setGoogleUser(null);
    setGuestSession(null);
    setSession(null);
    setCurrentPage('landing');
    sessionManager.clearSession();
    sessionManager.clearGuestSession();
    resetAppSettings();
  };

  return (
    <div className="App">
      {googleUser && !googleUser.profileComplete ? (
        <ProfileSetup googleUser={googleUser} onComplete={handleProfileComplete} />
      ) : currentPage === 'settings' && googleUser ? (
        <SettingsPage
          googleUser={googleUser}
          onBack={() => {
            setProfileTick((t) => t + 1);
            setCurrentPage('landing');
          }}
          onLogout={handleLogout}
        />
      ) : currentPage === 'landing' && googleUser ? (
        <UserDashboard 
          googleUser={googleUser}
          onLogout={handleLogout}
          onStartChat={handleStartChat}
          onOpenSettings={() => setCurrentPage('settings')}
          refreshSignal={profileTick}
        />
      ) : currentPage === 'landing' ? (
        <LandingPage 
          onStartChat={handleStartChat} 
          googleUser={googleUser}
          guestSession={guestSession}
          onLogout={handleLogout}
        />
      ) : (
        <ChatPage session={session} onBackToLanding={handleBackToLanding} />
      )}
    </div>
  );
}

export default App;