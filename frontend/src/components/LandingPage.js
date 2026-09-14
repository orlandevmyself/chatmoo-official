import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { User, GraduationCap, Venus, Mars, Transgender, Lock, Crown, Sparkles, X, Check, XCircle, CreditCard, Wallet, Landmark, RefreshCw, ChevronDown, Search, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { sessionManager } from '../utils/sessionManager';
import { getErrorMessage } from '../utils/network';
import { useConnection } from '../context/ConnectionContext';
import LoudSpeaker from './LoudSpeaker';


const API_URL = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';
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
  { name: 'Other', code: 'OTHER' },
];

function LandingPage({ onStartChat, googleUser, guestSession, onLogout }) {
  const [formData, setFormData] = useState({
    username: guestSession?.username || '',
    country: guestSession?.country || 'Philippines',
    countryCode: guestSession?.countryCode || 'PH',
    university: guestSession?.university || '',
    gender: guestSession?.gender || '',
    genderFilter: guestSession?.genderFilter || 'all',
    avatar: guestSession?.avatar || 'adventurer',
    avatarSeed: guestSession?.avatarSeed || '',
  });
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [universities, setUniversities] = useState([]);
  const [loadingUniversities, setLoadingUniversities] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [universitySearchQuery, setUniversitySearchQuery] = useState('');
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false);
  const [isOtherCountry, setIsOtherCountry] = useState(false);
  const [isOtherUniversity, setIsOtherUniversity] = useState(false);
  const { reconnectTick } = useConnection();

  // Load guest session data when available
  useEffect(() => {
    if (guestSession && !googleUser) {
      setFormData({
        username: guestSession.username || '',
        country: guestSession.country || 'Philippines',
        countryCode: guestSession.countryCode || 'PH',
        university: guestSession.university || '',
        gender: guestSession.gender || '',
        genderFilter: guestSession.genderFilter || 'all',
        avatar: guestSession.avatar || 'adventurer',
        avatarSeed: guestSession.avatarSeed || '',
      });
      setSelectedAvatarStyle(guestSession.avatar || 'adventurer');
      setAvatarSeed(guestSession.avatarSeed || '');
    }
  }, [guestSession, googleUser]);

  // Fetch universities when country changes
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
  }, [formData.country, reconnectTick]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.country-dropdown') && !event.target.closest('.country-button')) {
        setShowCountryDropdown(false);
        setCountrySearchQuery('');
      }
      if (!event.target.closest('.university-dropdown') && !event.target.closest('.university-input')) {
        setShowUniversityDropdown(false);
        setUniversitySearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPremiumModal, setShowPremiumModal] = useState(false);

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
        university: '', // Reset university when country changes
      });
    } else {
      setIsOtherCountry(false);
      setFormData({
        ...formData,
        country: country.name,
        countryCode: country.code,
        university: '', // Reset university when country changes
      });
    }
    setShowCountryDropdown(false);
    setCountrySearchQuery('');
  };

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(countrySearchQuery.toLowerCase())
  );

  const filteredUniversities = universities.filter(uni =>
    uni.name.toLowerCase().includes(universitySearchQuery.toLowerCase())
  );

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



  const handleGenderSelect = (gender) => {
    setFormData({
      ...formData,
      gender,
    });
  };

  const handleGenderFilterSelect = (filter) => {
    if (filter !== 'all') {
      setShowPremiumModal(true);
      return;
    }
    setFormData({
      ...formData,
      genderFilter: filter,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userId;
      
      if (googleUser) {
        // Use authenticated user's ID
        userId = googleUser.id;
      } else {
        // Create guest user
        const timestamp = Date.now();
        const userResponse = await axios.post(`${API_URL}/users`, {
          email: `${formData.username}${timestamp}@chatmoo.com`,
          name: formData.username,
          role: 'guest',
        });
        userId = userResponse.data.id;
      }

      const sessionResponse = await axios.post(`${API_URL}/sessions`, {
        userId,
        username: formData.username,
        country: formData.country,
        countryCode: formData.countryCode,
        university: formData.university,
        gender: formData.gender,
        genderFilter: formData.genderFilter,
        avatar: formData.avatar,
        avatarSeed: avatarSeed || formData.username,
      });

      const sessionData = {
        ...sessionResponse.data,
        userId,
        ...formData,
        avatar: formData.avatar,
        avatarSeed: avatarSeed || formData.username,
        country: formData.country,
        countryCode: formData.countryCode,
        isGuest: !googleUser, // Mark as guest session
      };

      // Save guest session if not authenticated
      if (!googleUser) {
        sessionManager.saveGuestSession(sessionData);
      }

      onStartChat(sessionData);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to start chat. Please try again.'));
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const GenderOption = ({ gender, icon: Icon, label, selected, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
        selected
          ? "border-coral bg-gradient-to-br from-coral to-softPurple text-white shadow-lg"
          : "border-navy/20 bg-white hover:border-coral hover:bg-navy/5",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center shadow-md",
        selected ? "bg-white text-coral" : "bg-gradient-to-br from-coral to-softPurple text-white"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="font-medium text-sm">{label}</span>
      {disabled && <Lock className="absolute top-3 right-3 w-4 h-4 text-navy/40" />}
    </button>
  );

  const PremiumPlan = ({ title, price, period, features, featured, current, buttonText }) => (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-lg",
      featured ? "border-2 border-coral shadow-xl" : "border-2 border-navy/20"
    )}>
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-coral to-softPurple text-xs font-bold px-3 py-1 rounded-full text-white shadow-md">
          Popular
        </div>
      )}
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold text-navy">{title}</CardTitle>
        <div className="mt-2">
          <span className="text-4xl font-bold text-coral">{price}</span>
          <span className="text-navy/60 ml-1">{period}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            {feature.included ? (
              <Check className="w-5 h-5 text-coral flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-navy/30 flex-shrink-0" />
            )}
            <span className={cn("text-sm", feature.included ? "text-navy" : "text-navy/40")}>
              {feature.text}
            </span>
          </div>
        ))}
        <Button
          className={cn(
            "w-full mt-4",
            current ? "bg-navy/10 text-navy cursor-default" : "bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90"
          )}
          disabled={current}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      {/* Loud Speaker Banner */}
      <div className="relative z-10 w-full max-w-6xl mb-6">
        <LoudSpeaker scope="homepage" userId={googleUser?.id} />
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row gap-6 items-start">
        {/* Floating Avatar Selection Panel */}
        <Card className="bg-cream/95 backdrop-blur-lg shadow-2xl border-0 p-6 lg:sticky lg:top-4 w-full lg:w-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-navy text-center">Your Avatar</h3>
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-coral shadow-lg bg-white">
              <img
                src={getAvatarUrl(selectedAvatarStyle, avatarSeed)}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            </div>
            <Button
              type="button"
              onClick={handleRandomAvatar}
              variant="outline"
              className="w-full border-navy/20 text-navy hover:bg-navy/5"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Random
            </Button>
            <div className="grid grid-cols-4 lg:grid-cols-2 gap-2">
              {['adventurer', 'avataaars', 'bottts', 'lorelei', 'micah', 'notionists', 'open-peeps', 'personas'].map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => handleAvatarStyleChange(style)}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all duration-200",
                    selectedAvatarStyle === style
                      ? "border-coral bg-coral/10"
                      : "border-navy/20 hover:border-coral/50"
                  )}
                >
                  <img
                    src={`https://api.dicebear.com/7.x/${style}/svg?seed=${style}`}
                    alt={style}
                    className="w-12 h-12 mx-auto"
                  />
                  <p className="text-xs text-navy mt-1 capitalize truncate">{style}</p>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Main Form Card */}
        <Card className="bg-cream/95 backdrop-blur-lg shadow-2xl border-0 flex-1 w-full">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center gap-3 mb-1">
              <img
                src="/logo-graphic.png"
                alt="ChatMoo logo"
                className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow"
              />
              <img
                src="/logo-text.png"
                alt="ChatMoo"
                className="h-9 md:h-10 w-auto object-contain drop-shadow"
              />
            </div>
            <CardDescription className="text-lg text-navy/70">
              Connect with strangers worldwide
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!googleUser && (
              <div className="flex justify-center">
                <a
                  href={`${API_URL}/auth/google`}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  <span className="text-gray-700 font-medium">Sign in with Google</span>
                </a>
              </div>
            )}
            {googleUser && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-800">Signed in as {googleUser.name}</span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2 text-navy">
                  <User className="w-4 h-4 text-coral" />
                  Username
                </label>
                <Input
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="Enter your username"
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
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative country-dropdown">
                    <button
                      type="button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="country-button w-full flex items-center justify-between p-3 rounded-xl border-2 border-navy/20 bg-white hover:border-coral/50 transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <img
                          src={getFlagUrl(formData.countryCode)}
                          alt={formData.country}
                          className="w-6 h-4 object-cover rounded"
                        />
                        <span className="text-navy">{formData.country}</span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-navy" />
                    </button>
                    {showCountryDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-navy/20 rounded-xl shadow-lg max-h-80 overflow-hidden">
                        <div className="p-3 border-b border-navy/10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/50" />
                            <input
                              type="text"
                              placeholder="Search countries..."
                              value={countrySearchQuery}
                              onChange={(e) => setCountrySearchQuery(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-navy/20 text-sm focus:outline-none focus:border-coral text-navy"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredCountries.length > 0 ? (
                            filteredCountries.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => handleCountrySelect(country)}
                                className="w-full flex items-center gap-2 p-3 hover:bg-navy/5 transition-all text-left"
                              >
                                {country.code === 'OTHER' ? (
                                  <span className="text-2xl">🌍</span>
                                ) : (
                                  <img
                                    src={getFlagUrl(country.code)}
                                    alt={country.name}
                                    className="w-6 h-4 object-cover rounded"
                                  />
                                )}
                                <span className="text-navy">{country.name}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-navy/50 text-sm text-center">No countries found</div>
                          )}
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
                  <div className="relative university-dropdown">
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
                        className="university-input rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUniversityDropdown(!showUniversityDropdown)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    {showUniversityDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-navy/20 rounded-xl shadow-lg max-h-80 overflow-hidden">
                        <div className="p-3 border-b border-navy/10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/50" />
                            <input
                              type="text"
                              placeholder="Search universities..."
                              value={universitySearchQuery}
                              onChange={(e) => setUniversitySearchQuery(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-navy/20 text-sm focus:outline-none focus:border-coral text-navy"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredUniversities.length > 0 ? (
                            <>
                              {filteredUniversities.map((uni) => (
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
                            </>
                          ) : (
                            <div className="p-3 text-navy/50 text-sm text-center">No universities found</div>
                          )}
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
                        <ChevronDown className="w-4 h-4" />
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
                    onClick={() => handleGenderSelect('male')}
                  />
                  <GenderOption
                    gender="female"
                    icon={Venus}
                    label="Female"
                    selected={formData.gender === 'female'}
                    onClick={() => handleGenderSelect('female')}
                  />
                  <GenderOption
                    gender="other"
                    icon={Transgender}
                    label="Other"
                    selected={formData.gender === 'other'}
                    onClick={() => handleGenderSelect('other')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-navy">Match with Gender</label>
                  <div className="flex items-center gap-1 bg-gradient-to-r from-coral to-softPurple text-xs font-bold px-2 py-1 rounded-full text-white">
                    <Crown className="w-3 h-3" />
                    Premium
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <GenderOption
                    gender="all"
                    icon={User}
                    label="Anyone"
                    selected={formData.genderFilter === 'all'}
                    onClick={() => handleGenderFilterSelect('all')}
                  />
                  <GenderOption
                    gender="male"
                    icon={Mars}
                    label="Male Only"
                    selected={formData.genderFilter === 'male'}
                    onClick={() => handleGenderFilterSelect('male')}
                    disabled
                  />
                  <GenderOption
                    gender="female"
                    icon={Venus}
                    label="Female Only"
                    selected={formData.genderFilter === 'female'}
                    onClick={() => handleGenderFilterSelect('female')}
                    disabled
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 text-lg font-semibold shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  'Start Chatting'
                )}
              </Button>
            </form>

            <Card className="bg-gradient-to-r from-coral to-softPurple border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 font-bold text-white mb-1">
                  <Crown className="w-5 h-5" />
                  Upgrade to Premium
                </div>
                <p className="text-sm text-white/90">Unlock gender filtering and more features!</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPremiumModal} onOpenChange={setShowPremiumModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl text-navy">
              <Crown className="w-6 h-6 text-coral" />
              Premium Plans
            </DialogTitle>
            <DialogDescription className="text-navy/70">
              Choose the perfect plan for your needs
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <PremiumPlan
              title="Basic"
              price="Free"
              period=""
              features={[
                { text: 'Unlimited random chats', included: true },
                { text: 'Basic matching', included: true },
                { text: 'Gender filtering', included: false },
              ]}
              current
              buttonText="Current Plan"
            />
            <PremiumPlan
              title="Premium"
              price="₱99"
              period="/month"
              featured
              features={[
                { text: 'Everything in Basic', included: true },
                { text: 'Gender filtering', included: true },
                { text: 'Priority matching', included: true },
                { text: 'Ad-free experience', included: true },
              ]}
              buttonText="Upgrade Now"
            />
            <PremiumPlan
              title="Annual"
              price="₱899"
              period="/year"
              features={[
                { text: 'Everything in Premium', included: true },
                { text: 'Save ₱189/year', included: true },
                { text: 'Exclusive badges', included: true },
                { text: 'Early access features', included: true },
              ]}
              buttonText="Best Value"
            />
          </div>
          <DialogFooter className="flex-col gap-4 pt-6">
            <p className="text-sm text-navy/70">Secure payment via PH Money</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-cream px-3 py-2 rounded-lg text-navy font-medium border border-navy/20">
                <Wallet className="w-4 h-4 text-coral" />
                GCash
              </div>
              <div className="flex items-center gap-2 bg-cream px-3 py-2 rounded-lg text-navy font-medium border border-navy/20">
                <CreditCard className="w-4 h-4 text-softPurple" />
                Maya
              </div>
              <div className="flex items-center gap-2 bg-cream px-3 py-2 rounded-lg text-navy font-medium border border-navy/20">
                <Landmark className="w-4 h-4 text-coral" />
                Bank Transfer
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingPage;