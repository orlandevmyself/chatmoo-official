import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import ChatPage from './components/ChatPage';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState('landing');

  const handleStartChat = (sessionData) => {
    setSession(sessionData);
    setCurrentPage('chat');
  };

  const handleBackToLanding = () => {
    setSession(null);
    setCurrentPage('landing');
  };

  return (
    <div className="App">
      {currentPage === 'landing' ? (
        <LandingPage onStartChat={handleStartChat} />
      ) : (
        <ChatPage session={session} onBackToLanding={handleBackToLanding} />
      )}
    </div>
  );
}

export default App;