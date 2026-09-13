import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Zap, MapPin, Building2, Users, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { COUNTRIES } from '../utils/locationConstants';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const GENDERS = [
  { value: 'all', label: 'All', emoji: '👥' },
  { value: 'male', label: 'Male', emoji: '👨' },
  { value: 'female', label: 'Female', emoji: '👩' },
];

function PremiumFilters({ isPremium, session, onFiltersChange, onGetPremium }) {
  const [showFilters, setShowFilters] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [filters, setFilters] = useState({
    country: session?.country || '',
    gender: 'all',
  });

  useEffect(() => {
    if (isPremium) {
      loadPremiumStatus();
    }
  }, [isPremium]);

  const loadPremiumStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/premium/status?userId=${session?.userId}`);
      setPremiumStatus(res.data);
    } catch (err) {
      console.error('Error loading premium status:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  if (!isPremium) {
    return (
      <Card className="bg-gradient-to-r from-coral/10 to-softPurple/10 border-2 border-coral/30 p-4 mb-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-navy mb-1">Advanced Filters</p>
            <p className="text-sm text-navy/70 mb-3">
              Get premium to filter by country, university, and gender. Plus priority matching!
            </p>
            <Button
              onClick={onGetPremium}
              className="bg-coral hover:bg-coral/90 text-white text-sm h-8"
            >
              <Zap className="w-3 h-3 mr-1" />
              Get Premium
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-4">
      {/* Premium Status Badge */}
      {premiumStatus && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-xs font-semibold text-green-900 uppercase">Premium Active</p>
              <p className="text-sm font-medium text-green-700">
                {premiumStatus.daysRemaining} days remaining
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white border-2 border-coral/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-navy flex items-center gap-2">
            <Users className="w-4 h-4" />
            Match Preferences
          </p>
          {showFilters && (
            <button
              onClick={() => setShowFilters(false)}
              className="text-navy/50 hover:text-navy transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showFilters ? (
          <div className="space-y-4">
            {/* Country Filter */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Country
              </label>
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-coral"
              >
                <option value="">Any Country</option>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            <div>
              <label className="text-sm font-medium text-navy mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Gender
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GENDERS.map((gender) => (
                  <button
                    key={gender.value}
                    onClick={() => handleFilterChange('gender', gender.value)}
                    className={cn(
                      'py-2 rounded-lg border-2 font-medium transition',
                      filters.gender === gender.value
                        ? 'border-coral bg-coral/10 text-coral'
                        : 'border-gray-200 text-navy hover:border-coral'
                    )}
                  >
                    <span className="text-lg mr-1">{gender.emoji}</span>
                    {gender.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setShowFilters(false)}
              className="w-full bg-coral hover:bg-coral/90 text-white"
            >
              Apply Filters
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowFilters(true)}
            className="w-full p-2 text-left text-sm font-medium text-coral hover:bg-coral/5 rounded-lg transition"
          >
            {filters.country || filters.gender !== 'all'
              ? `Filtering: ${filters.country || 'Any'} • ${
                  GENDERS.find((g) => g.value === filters.gender)?.label
                }`
              : 'Click to set filters'}
          </button>
        )}
      </Card>
    </div>
  );
}

export default PremiumFilters;
