import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { User, GraduationCap, Venus, Mars, Transgender, Check, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const UNIVERSITIES_API = `${API_URL}/utils/universities`;

const COUNTRIES = [
  { name: 'Philippines', code: 'PH' },
  { name: 'United States', code: 'US' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'Japan', code: 'JP' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Singapore', code: 'SG' },
  { name: 'India', code: 'IN' },
  { name: 'Germany', code: 'DE' },
  { name: 'France', code: 'FR' },
  { name: 'Spain', code: 'ES' },
  { name: 'Italy', code: 'IT' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Norway', code: 'NO' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Finland', code: 'FI' },
  { name: 'Switzerland', code: 'CH' },
];

function ProfileSetup({ googleUser, onComplete }) {
  const [formData, setFormData] = useState({
    username: '',
    displayName: googleUser.name || '',
    country: 'Philippines',
    countryCode: 'PH',
    university: '',
    gender: '',
    avatar: 'adventurer',
    avatarSeed: '',
  });
  const [universities, setUniversities] = useState([]);
  const [loadingUniversities, setLoadingUniversities] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [universitySearchQuery, setUniversitySearchQuery] = useState('');
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false);
  const [isOtherCountry, setIsOtherCountry] = useState(false);
  const [isOtherUniversity, setIsOtherUniversity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('');

  useEffect(() => {
    const fetchUniversities = async () => {
      if (!formData.country) return;

      setLoadingUniversities(true);
      try {
        const response = await axios.get(`${UNIVERSITIES_API}?country=${formData.country}`, {
          timeout: 5000,
        });
        setUniversities(response.data || []);
      } catch (error) {
        console.warn('University API unavailable, using manual input');
        setUniversities([]);
      } finally {
        setLoadingUniversities(false);
      }
    };

    const timer = setTimeout(fetchUniversities, 300);
    return () => clearTimeout(timer);
  }, [formData.country]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCountrySelect = (country) => {
    if (country.code === 'OTHER') {
      setIsOtherCountry(true);
      setFormData({
        ...formData,
        country: '',
        countryCode: '',
        university: '',
      });
    } else {
      setIsOtherCountry(false);
      setFormData({
        ...formData,
        country: country.name,
        countryCode: country.code,
        university: '',
      });
    }
    setShowCountryDropdown(false);
    setCountrySearchQuery('');
  };

  const handleUniversitySelect = (universityName) => {
    if (universityName === 'Other') {
      setIsOtherUniversity(true);
      setFormData({
        ...formData,
        university: '',
      });
    } else {
      setIsOtherUniversity(false);
      setFormData({
        ...formData,
        university: universityName,
      });
    }
    setShowUniversityDropdown(false);
    setUniversitySearchQuery('');
  };

  const handleAvatarStyleChange = (style) => {
    setSelectedAvatarStyle(style);
    setFormData({
      ...formData,
      avatar: style,
    });
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setAvatarSeed(randomSeed);
    setFormData({
      ...formData,
      avatarSeed: randomSeed,
    });
  };

  const getAvatarUrl = (style, seed) => {
    const finalSeed = seed || formData.username || 'default';
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${finalSeed}`;
  };

  const getFlagUrl = (countryCode) => {
    return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
  };

  const checkUsernameAvailability = async (username) => {
    if (!username) {
      setUsernameAvailable(null);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/auth/check-username/${username}`);
      setUsernameAvailable(response.data.available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (formData.username) {
        checkUsernameAvailability(formData.username);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [formData.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate username
      if (!formData.username || formData.username.length < 3) {
        setError('Username must be at least 3 characters');
        setLoading(false);
        return;
      }

      if (usernameAvailable === false) {
        setError('Username is already taken');
        setLoading(false);
        return;
      }

      console.log('[ProfileSetup] Submitting profile for user:', googleUser.id);
      console.log('[ProfileSetup] Profile data:', {
        username: formData.username,
        displayName: formData.displayName,
        country: formData.country,
        countryCode: formData.countryCode,
        university: formData.university,
        gender: formData.gender,
        avatar: formData.avatar,
        avatarSeed: formData.avatarSeed,
        profileComplete: true,
      });

      // Update user profile
      const response = await axios.post(`${API_URL}/auth/user/${googleUser.id}/profile`, {
        username: formData.username,
        displayName: formData.displayName,
        country: formData.country,
        countryCode: formData.countryCode,
        university: formData.university,
        gender: formData.gender,
        avatar: formData.avatar,
        avatarSeed: formData.avatarSeed,
        profileComplete: true,
      });

      console.log('[ProfileSetup] Profile update successful:', response.data);
      
      // Show success message briefly before completing
      setLoading(false);
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error) {
      console.error('[ProfileSetup] Error updating profile:', error);
      if (error.response) {
        console.error('[ProfileSetup] Server response:', error.response.data);
        console.error('[ProfileSetup] Status:', error.response.status);
      }
      setError('Failed to update profile. Please try again.');
      setLoading(false);
    }
  };

  const GenderOption = ({ gender, icon: Icon, label, selected, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
        selected
          ? "border-coral bg-gradient-to-br from-coral to-softPurple text-white shadow-lg"
          : "border-navy/20 bg-white hover:border-coral hover:bg-navy/5"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center shadow-md",
        selected ? "bg-white text-coral" : "bg-gradient-to-br from-coral to-softPurple text-white"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-softPurple flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-coral/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-softPurple/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <Card className="relative z-10 bg-cream/95 backdrop-blur-lg shadow-2xl border-0 max-w-2xl w-full">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-4xl font-bold text-navy">
            Complete Your Profile
          </CardTitle>
          <CardDescription className="text-lg text-navy/70">
            Set up your username and preferences
          </CardDescription>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Signed in as: <span className="font-medium">{googleUser.email}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-navy">
                <User className="w-4 h-4 text-coral" />
                Username <span className="text-navy/50">(cannot be changed later)</span>
              </label>
              <Input
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Choose a unique username"
                className="rounded-xl"
              />
              {usernameAvailable === true && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Username available
                </p>
              )}
              {usernameAvailable === false && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Username already taken
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Display Name</label>
              <Input
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Your display name"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Country</label>
              {isOtherCountry ? (
                <div className="flex gap-2">
                  <Input
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="Enter your country"
                    className="rounded-xl flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtherCountry(false);
                      setShowCountryDropdown(true);
                    }}
                    className="px-3 py-2 rounded-xl border-2 border-navy/20 bg-white hover:border-coral/50 transition-all text-navy"
                  >
                    ↓
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-navy/20 bg-white hover:border-coral/50 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <img
                        src={getFlagUrl(formData.countryCode)}
                        alt={formData.country}
                        className="w-6 h-4 object-cover rounded"
                      />
                      <span className="text-navy">{formData.country}</span>
                    </span>
                    <span className="text-navy">▼</span>
                  </button>
                  {showCountryDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-navy/20 rounded-xl shadow-lg max-h-80 overflow-hidden">
                      <div className="p-3 border-b border-navy/10">
                        <input
                          type="text"
                          placeholder="Search countries..."
                          value={countrySearchQuery}
                          onChange={(e) => setCountrySearchQuery(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-navy/20 text-sm focus:outline-none focus:border-coral text-navy"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearchQuery.toLowerCase())).map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => handleCountrySelect(country)}
                            className="w-full flex items-center gap-2 p-3 hover:bg-navy/5 transition-all text-left"
                          >
                            <img
                              src={getFlagUrl(country.code)}
                              alt={country.name}
                              className="w-6 h-4 object-cover rounded"
                            />
                            <span className="text-navy">{country.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2 text-navy">
                <GraduationCap className="w-4 h-4 text-softPurple" />
                University (Optional)
              </label>
              {loadingUniversities ? (
                <div className="text-navy/70 text-sm">Loading universities...</div>
              ) : universities.length > 0 && !isOtherUniversity ? (
                <div className="relative">
                  <div className="relative">
                    <Input
                      name="university"
                      value={formData.university || universitySearchQuery}
                      onChange={(e) => {
                        handleChange(e);
                        setUniversitySearchQuery(e.target.value);
                        setShowUniversityDropdown(true);
                      }}
                      onFocus={() => setShowUniversityDropdown(true)}
                      placeholder="Search or select your university"
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUniversityDropdown(!showUniversityDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy"
                    >
                      ▼
                    </button>
                  </div>
                  {showUniversityDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-navy/20 rounded-xl shadow-lg max-h-80 overflow-hidden">
                      <div className="p-3 border-b border-navy/10">
                        <input
                          type="text"
                          placeholder="Search universities..."
                          value={universitySearchQuery}
                          onChange={(e) => setUniversitySearchQuery(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-navy/20 text-sm focus:outline-none focus:border-coral text-navy"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {universities.filter(u => u.name.toLowerCase().includes(universitySearchQuery.toLowerCase())).map((uni) => (
                          <button
                            key={uni.name}
                            type="button"
                            onClick={() => handleUniversitySelect(uni.name)}
                            className="w-full p-3 hover:bg-navy/5 transition-all text-left text-navy"
                          >
                            {uni.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleUniversitySelect('Other')}
                          className="w-full p-3 hover:bg-navy/5 transition-all text-left text-navy border-t border-navy/10 font-medium"
                        >
                          Other...
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    name="university"
                    value={formData.university}
                    onChange={handleChange}
                    placeholder="Enter your university"
                    className="rounded-xl flex-1"
                  />
                  {universities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOtherUniversity(false);
                        setShowUniversityDropdown(true);
                      }}
                      className="px-3 py-2 rounded-xl border-2 border-navy/20 bg-white hover:border-coral/50 transition-all text-navy"
                    >
                      ▼
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Your Gender (Optional)</label>
              <div className="grid grid-cols-3 gap-3">
                <GenderOption
                  gender="male"
                  icon={Mars}
                  label="Male"
                  selected={formData.gender === 'male'}
                  onClick={() => setFormData({ ...formData, gender: 'male' })}
                />
                <GenderOption
                  gender="female"
                  icon={Venus}
                  label="Female"
                  selected={formData.gender === 'female'}
                  onClick={() => setFormData({ ...formData, gender: 'female' })}
                />
                <GenderOption
                  gender="other"
                  icon={Transgender}
                  label="Other"
                  selected={formData.gender === 'other'}
                  onClick={() => setFormData({ ...formData, gender: 'other' })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Avatar Style</label>
              <div className="grid grid-cols-4 gap-2">
                {['adventurer', 'avataaars', 'bottts', 'lorelei', 'micah', 'notionists', 'open-peeps', 'personas'].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => handleAvatarStyleChange(style)}
                    className={cn(
                      "p-2 rounded-lg border-2 transition-all",
                      selectedAvatarStyle === style
                        ? "border-coral bg-coral/10"
                        : "border-navy/20 hover:border-coral hover:bg-navy/5"
                    )}
                  >
                    <img
                      src={getAvatarUrl(style, avatarSeed)}
                      alt={style}
                      className="w-12 h-12"
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRandomAvatar}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border-2 border-navy/20 hover:border-coral hover:bg-navy/5 transition-all text-navy"
              >
                <span className="text-2xl">🎲</span>
                <span className="text-sm">Randomize Avatar</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || usernameAvailable === false}
              className="w-full rounded-xl h-12 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 shadow-lg text-white font-medium"
            >
              {loading ? 'Saving...' : 'Complete Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfileSetup;
