import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { User, GraduationCap, Venus, Mars, Transgender, Lock, Crown, Sparkles, X, Check, XCircle, CreditCard, Wallet, Landmark, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function LandingPage({ onStartChat }) {
  const [formData, setFormData] = useState({
    username: '',
    university: '',
    gender: '',
    genderFilter: 'all',
    avatar: 'adventurer',
    avatarSeed: '',
  });
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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
      const timestamp = Date.now();
      const userResponse = await axios.post(`${API_URL}/users`, {
        email: `${formData.username}${timestamp}@chatmoo.com`,
        name: formData.username,
      });

      const userId = userResponse.data.id;

      const sessionResponse = await axios.post(`${API_URL}/sessions`, {
        userId,
        username: formData.username,
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
      };

      onStartChat(sessionData);
    } catch (err) {
      setError('Failed to start chat. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

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
            <CardTitle className="text-4xl font-bold text-navy">
              ChatMoo
            </CardTitle>
            <CardDescription className="text-lg text-navy/70">
              Connect with strangers worldwide
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <label className="text-sm font-medium flex items-center gap-2 text-navy">
                  <GraduationCap className="w-4 h-4 text-softPurple" />
                  University (Optional)
                </label>
                <Input
                  name="university"
                  value={formData.university}
                  onChange={handleChange}
                  placeholder="Enter your university"
                  className="rounded-xl"
                />
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