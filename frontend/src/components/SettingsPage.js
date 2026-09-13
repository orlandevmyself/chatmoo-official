import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  ArrowLeft, Check, Lock, LogOut, Shuffle, ChevronDown, User, Bell,
  MessageCircle, Palette, Activity, FileText, ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getAvatarUrl, getFlagUrl } from '../utils/conversationHelpers';
import {
  getAppSettings, saveAppSettings, initAppSettings, CHAT_THEMES, STATUS_META,
  requestNotificationPermission,
} from '../utils/appSettings';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const UNIVERSITIES_API = 'http://universities.hipolabs.com/search';

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

const AVATAR_STYLES = ['adventurer', 'avataaars', 'bottts', 'lorelei', 'micah', 'notionists', 'open-peeps', 'personas'];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-11 h-6 rounded-full relative transition-colors flex-shrink-0",
        checked ? "bg-green-500" : "bg-navy/20"
      )}
      aria-pressed={checked}
    >
      <span className={cn(
        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
        checked ? "left-[22px]" : "left-0.5"
      )} />
    </button>
  );
}

function SettingRow({ label, hint, control }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-navy/10 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{label}</p>
        {hint && <p className="text-xs text-navy/50 mt-0.5">{hint}</p>}
      </div>
      {control}
    </div>
  );
}

// Only these profile fields are editable. Username and gender are locked.
function SettingsPage({ googleUser, onBack, onLogout }) {
  const [openSection, setOpenSection] = useState('account');
  const [prefs, setPrefs] = useState(() => getAppSettings());
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    displayName: '',
    country: '',
    countryCode: '',
    university: '',
    avatar: 'adventurer',
    avatarSeed: '',
  });
  const [universities, setUniversities] = useState([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notifState, setNotifState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    loadProfile();
    // Load authoritative settings from the DB, then refresh the toggles
    initAppSettings(googleUser?.id).then((s) => setPrefs({ ...s }));
  }, [googleUser]);

  useEffect(() => {
    const fetchUniversities = async () => {
      if (!form.country) {
        setUniversities([]);
        return;
      }
      try {
        const response = await axios.get(`${UNIVERSITIES_API}?country=${form.country}`);
        setUniversities(response.data || []);
      } catch {
        setUniversities([]);
      }
    };
    fetchUniversities();
  }, [form.country]);

  const updatePrefs = (patch) => {
    setPrefs(saveAppSettings(patch));
  };

  const loadProfile = async () => {
    if (!googleUser?.id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/auth/user/${googleUser.id}`);
      const data = response.data;
      setProfile(data);
      setForm({
        displayName: data.displayName || '',
        country: data.country || '',
        countryCode: data.countryCode || '',
        university: data.university || '',
        avatar: data.avatar || 'adventurer',
        avatarSeed: data.avatarSeed || '',
      });
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCountrySelect = (country) => {
    setForm({ ...form, country: country.name, countryCode: country.code });
    setShowCountryDropdown(false);
    setCountrySearchQuery('');
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setForm({ ...form, avatarSeed: randomSeed });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!form.displayName || form.displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters');
      setSaving(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/user/${googleUser.id}/profile`, {
        displayName: form.displayName.trim(),
        country: form.country,
        countryCode: form.countryCode,
        university: form.university,
        avatar: form.avatar,
        avatarSeed: form.avatarSeed,
      });
      setProfile(response.data);
      setSuccess('Profile updated successfully');
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBrowserNotifToggle = async (enabled) => {
    if (enabled) {
      const permission = await requestNotificationPermission();
      setNotifState(permission);
      updatePrefs({ browserNotifications: permission === 'granted' });
    } else {
      updatePrefs({ browserNotifications: false });
    }
  };

  const toggleSection = (id) => setOpenSection(openSection === id ? null : id);

  const Section = ({ id, icon: Icon, title, subtitle, children }) => (
    <Card className="bg-white/95 backdrop-blur-lg border-0 shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral to-softPurple flex items-center justify-center text-white flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy">{title}</p>
          <p className="text-xs text-navy/60 truncate">{subtitle}</p>
        </div>
        <ChevronDown className={cn(
          "w-5 h-5 text-navy/40 transition-transform flex-shrink-0",
          openSection === id && "rotate-180"
        )} />
      </button>
      {openSection === id && (
        <div className="px-4 pb-4 border-t border-navy/10">
          {children}
        </div>
      )}
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-softPurple to-coral p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="bg-white/20 text-white hover:bg-white/30 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Settings</h1>
        </div>

        {/* My Account */}
        <Section id="account" icon={User} title="My Account" subtitle="Avatar, display name, country, university">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mt-3">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm mt-3 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {success}
            </div>
          )}
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-3">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-coral shadow-lg bg-white flex-shrink-0">
                <img
                  src={getAvatarUrl(form.displayName || profile?.username, form.avatar, form.avatarSeed)}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRandomAvatar}
                className="rounded-xl"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Randomize
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setForm({ ...form, avatar: style })}
                  className={cn(
                    "p-2 rounded-xl border-2 transition-all",
                    form.avatar === style
                      ? "border-coral bg-coral/10"
                      : "border-navy/20 hover:border-coral hover:bg-navy/5"
                  )}
                >
                  <img
                    src={getAvatarUrl(form.displayName || profile?.username, style, form.avatarSeed)}
                    alt={style}
                    className="w-10 h-10 md:w-12 md:h-12 mx-auto"
                  />
                  <p className="text-[10px] text-navy/60 mt-1 truncate">{style}</p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Display Name</label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Your display name"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">Country</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-navy/20 bg-white hover:border-coral/50 transition-all"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {form.countryCode ? (
                      <img
                        src={getFlagUrl(form.countryCode)}
                        alt={form.country}
                        className="w-6 h-4 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <span>🌍</span>
                    )}
                    <span className="text-navy truncate">{form.country || 'Select country'}</span>
                  </span>
                  <span className="text-navy flex-shrink-0">▼</span>
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-navy">University (Optional)</label>
              <Input
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                placeholder="Enter your university"
                className="rounded-xl"
                list="settings-university-list"
              />
              <datalist id="settings-university-list">
                {universities.slice(0, 100).map((u) => (
                  <option key={u.name} value={u.name} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy flex items-center gap-1">
                  Username
                  <Lock className="w-3 h-3 text-navy/40" />
                </label>
                <Input
                  value={profile?.username || ''}
                  disabled
                  className="rounded-xl bg-navy/5 text-navy/60"
                />
                <p className="text-xs text-navy/50">Cannot be changed</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy flex items-center gap-1">
                  Gender
                  <Lock className="w-3 h-3 text-navy/40" />
                </label>
                <Input
                  value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set'}
                  disabled
                  className="rounded-xl bg-navy/5 text-navy/60"
                />
                <p className="text-xs text-navy/50">Cannot be changed</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl h-12 bg-gradient-to-r from-coral to-softPurple hover:from-coral/90 hover:to-softPurple/90 shadow-lg text-white font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Section>

        {/* Notifications */}
        <Section id="notifications" icon={Bell} title="Notifications" subtitle="Sounds and alerts for new activity">
          <SettingRow
            label="Message sounds"
            hint="Play a sound when a new message arrives"
            control={<Toggle checked={prefs.messageSound} onChange={(v) => updatePrefs({ messageSound: v })} />}
          />
          <SettingRow
            label="Browser notifications"
            hint={notifState === 'denied'
              ? 'Blocked — allow notifications in your browser settings to enable'
              : 'Show a system notification when a message arrives and the tab is hidden'}
            control={<Toggle checked={prefs.browserNotifications} onChange={handleBrowserNotifToggle} />}
          />
          <SettingRow
            label="Typing indicators"
            hint="Show when the other person is typing"
            control={<Toggle checked={prefs.typingIndicators} onChange={(v) => updatePrefs({ typingIndicators: v })} />}
          />
        </Section>

        {/* Chat */}
        <Section id="chat" icon={MessageCircle} title="Chat" subtitle="Avatars, text size, timestamps">
          <SettingRow
            label="Show avatars"
            hint="Display profile pictures inside conversations"
            control={<Toggle checked={prefs.showAvatars} onChange={(v) => updatePrefs({ showAvatars: v })} />}
          />
          <SettingRow
            label="Show timestamps"
            hint="Display the time under each message"
            control={<Toggle checked={prefs.showTimestamps} onChange={(v) => updatePrefs({ showTimestamps: v })} />}
          />
          <div className="py-3">
            <p className="text-sm font-medium text-navy mb-2">Message text size</p>
            <div className="grid grid-cols-3 gap-2">
              {['small', 'medium', 'large'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => updatePrefs({ fontSize: size })}
                  className={cn(
                    "py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all",
                    prefs.fontSize === size
                      ? "border-coral bg-coral/10 text-navy"
                      : "border-navy/20 text-navy/60 hover:border-coral"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Themes */}
        <Section id="themes" icon={Palette} title="Themes" subtitle="Chat header and background">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
            {Object.entries(CHAT_THEMES).map(([key, theme]) => (
              <button
                key={key}
                type="button"
                onClick={() => updatePrefs({ chatTheme: key })}
                className={cn(
                  "rounded-xl border-2 overflow-hidden transition-all",
                  prefs.chatTheme === key
                    ? "border-coral"
                    : "border-navy/20 hover:border-coral"
                )}
              >
                <div className="h-10" style={{ background: theme.header }} />
                <div className="px-2 py-1.5 flex items-center justify-between" style={{ backgroundColor: theme.chat }}>
                  <span className="text-xs font-medium text-navy">{theme.label}</span>
                  {prefs.chatTheme === key && <Check className="w-3 h-3 text-coral" />}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* User Status */}
        <Section id="status" icon={Activity} title="User Status" subtitle="How you appear to others">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => updatePrefs({ status: key })}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                  prefs.status === key
                    ? "border-coral bg-coral/10 text-navy"
                    : "border-navy/20 text-navy/60 hover:border-coral"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
                {meta.label}
              </button>
            ))}
          </div>
          <div className="space-y-2 pt-3">
            <label className="text-sm font-medium text-navy">Status message (Optional)</label>
            <Input
              value={prefs.statusMessage}
              onChange={(e) => updatePrefs({ statusMessage: e.target.value })}
              placeholder="e.g. Studying for finals 📚"
              className="rounded-xl"
            />
          </div>
        </Section>

        {/* Terms of Service */}
        <Section id="terms" icon={FileText} title="Terms of Service" subtitle="The rules of using ChatMoo">
          <div className="text-sm text-navy/70 space-y-3 pt-3">
            <p>By using ChatMoo you agree to chat respectfully and follow these rules:</p>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>You must be 13 years or older to use ChatMoo.</li>
              <li>Be kind — harassment, hate speech, and explicit content are not allowed and may get your account removed.</li>
              <li>Do not share personal information (full name, address, phone number) with strangers.</li>
              <li>Conversations you choose to save are stored so you and your chat partner can revisit them.</li>
              <li>ChatMoo may moderate or remove content that violates these terms.</li>
            </ul>
            <p className="text-xs text-navy/50">Last updated September 2026.</p>
          </div>
        </Section>

        {/* Privacy Policy */}
        <Section id="privacy" icon={ShieldCheck} title="Privacy Policy" subtitle="How your data is handled">
          <div className="text-sm text-navy/70 space-y-3 pt-3">
            <ul className="list-disc ml-5 space-y-1.5">
              <li>Your Google account is only used to sign you in — we store your email, display name, and profile details you provide.</li>
              <li>Random chats are temporary. Only conversations you explicitly save are kept, along with their messages.</li>
              <li>Saved conversations are visible to you and the person you chatted with — nobody else.</li>
              <li>Notification, theme, and chat preferences are stored only on your device.</li>
              <li>You can sign out any time, and you may request deletion of your data by contacting support.</li>
            </ul>
            <p className="text-xs text-navy/50">Last updated September 2026.</p>
          </div>
        </Section>

        {/* Logout */}
        <Card className="bg-white/95 backdrop-blur-lg border-0 shadow-xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to sign out?')) {
                onLogout?.();
              }
            }}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-500">Logout</p>
              <p className="text-xs text-navy/60 truncate">Sign out of your account on this device</p>
            </div>
          </button>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
