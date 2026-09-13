import React, { useState, useEffect } from 'react';
import LoudSpeakerDisplay from './LoudSpeakerDisplay';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function LoudSpeaker({ scope = 'sitewide', userId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCampaigns();
    const interval = setInterval(fetchActiveCampaigns, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [scope]);

  useEffect(() => {
    if (campaigns.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % campaigns.length);
      }, 5000); // Rotate every 5 seconds
      return () => clearInterval(timer);
    }
  }, [campaigns.length]);

  const fetchActiveCampaigns = async () => {
    try {
      const url = new URL(`${API_BASE}/loud-speaker/active`);
      url.searchParams.set('scope', scope);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || campaigns.length === 0) {
    return null;
  }

  const campaign = campaigns[currentIndex];

  return <LoudSpeakerDisplay campaign={campaign} userId={userId} />;
}

export default LoudSpeaker;
