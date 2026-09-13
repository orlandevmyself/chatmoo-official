import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ArrowLeft, MapPin, Users, Building2, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { COUNTRIES, UNIVERSITIES_API } from '../utils/locationConstants';

const GENDERS = [
  { value: 'all', label: 'All Genders', emoji: '👥' },
  { value: 'male', label: 'Male', emoji: '👨' },
  { value: 'female', label: 'Female', emoji: '👩' },
];

function PremiumSetup({ userProfile, onComplete, onBack }) {
  const [formData, setFormData] = useState({
    country: userProfile?.country || 'Philippines',
    university: userProfile?.university || '',
    gender: 'all',
    displayName: userProfile?.displayName || userProfile?.username || '',
  });
  const [universities, setUniversities] = useState([]);
  const [loadingUniversities, setLoadingUniversities] = useState(false);

  // Fetch universities when country changes
  useEffect(() => {
    const fetchUniversities = async () => {
      if (!formData.country || formData.country === 'Other') {
        setUniversities([]);
        return;
      }

      try {
        setLoadingUniversities(true);
        const response = await axios.get(`${UNIVERSITIES_API}?country=${formData.country}`);
        const uniNames = response.data.map((uni) => uni.name).slice(0, 50);
        setUniversities(uniNames);
      } catch (err) {
        console.error('Error fetching universities:', err);
        setUniversities([]);
      } finally {
        setLoadingUniversities(false);
      }
    };

    fetchUniversities();
  }, [formData.country]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleComplete = () => {
    onComplete?.(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <Card className="relative z-10 bg-cream/95 backdrop-blur-lg shadow-2xl border-0 max-w-2xl w-full p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy mb-2">Premium Setup</h1>
          <p className="text-navy/70">Configure your profile to find the perfect match</p>
        </div>

        <div className="space-y-6">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              placeholder="How you'll appear to others"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
            <p className="text-xs text-navy/50 mt-1">This is how others will see you in chat</p>
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Country
            </label>
            <select
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.name}>
                  {country.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-navy/50 mt-1">Helps others find you by location</p>
          </div>

          {/* University */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              University
            </label>
            <div className="relative">
              <input
                type="text"
                list="universities-list"
                value={formData.university}
                onChange={(e) => handleChange('university', e.target.value)}
                placeholder={loadingUniversities ? 'Loading universities...' : 'Your university (optional)'}
                disabled={loadingUniversities}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:bg-gray-50"
              />
              {universities.length > 0 && (
                <datalist id="universities-list">
                  {universities.map((uni) => (
                    <option key={uni} value={uni} />
                  ))}
                </datalist>
              )}
            </div>
            <p className="text-xs text-navy/50 mt-1">Match with people from your school</p>
          </div>

          {/* Gender Preference */}
          <div>
            <label className="block text-sm font-semibold text-navy mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Match Preference
            </label>
            <div className="grid grid-cols-3 gap-3">
              {GENDERS.map((gender) => (
                <button
                  key={gender.value}
                  onClick={() => handleChange('gender', gender.value)}
                  className={cn(
                    'py-3 px-2 rounded-lg border-2 font-medium transition flex flex-col items-center gap-1',
                    formData.gender === gender.value
                      ? 'border-coral bg-coral/10 text-coral'
                      : 'border-gray-200 text-navy hover:border-coral'
                  )}
                >
                  <span className="text-2xl">{gender.emoji}</span>
                  <span className="text-xs">{gender.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-navy/50 mt-2">Who would you like to chat with?</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-coral/10 border border-coral/20 rounded-lg">
          <p className="text-sm text-navy">
            <span className="font-semibold">💡 Pro Tip:</span> Premium members get priority in the matching queue and can apply these filters during search!
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-3 text-navy border border-navy/20 hover:bg-navy/5 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 text-white font-semibold rounded-lg transition"
          >
            Start Searching
          </button>
        </div>
      </Card>
    </div>
  );
}

export default PremiumSetup;
