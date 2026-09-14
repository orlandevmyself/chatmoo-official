import axios from 'axios';

// App-wide user settings. Persisted in the DB per user; a per-user local
// cache makes reads instant and keeps things working offline. Writes update
// the cache immediately (UI applies at once) and sync to the DB debounced.
const API_URL = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

export const DEFAULT_SETTINGS = {
  messageSound: true,
  browserNotifications: false,
  typingIndicators: true,
  showAvatars: true,
  showTimestamps: true,
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  chatTheme: 'default',
  status: 'online', // 'online' | 'busy' | 'away' | 'invisible'
  statusMessage: '',
};

export const FONT_SIZE_CLASSES = {
  small: 'text-sm',
  medium: '',
  large: 'text-lg',
};

export const CHAT_THEMES = {
  default: {
    label: 'Default',
    header: 'linear-gradient(to right, #FF6B4A, #C4A1FF)',
    chat: '#FFF8F0',
  },
  ocean: {
    label: 'Ocean',
    header: 'linear-gradient(to right, #0EA5E9, #1E3A8A)',
    chat: '#F0F9FF',
  },
  sunset: {
    label: 'Sunset',
    header: 'linear-gradient(to right, #F59E0B, #EF4444)',
    chat: '#FFFBEB',
  },
  forest: {
    label: 'Forest',
    header: 'linear-gradient(to right, #10B981, #065F46)',
    chat: '#ECFDF5',
  },
  midnight: {
    label: 'Midnight',
    header: 'linear-gradient(to right, #1A1A2E, #401899)',
    chat: '#E6E6F0',
  },
};

export const STATUS_META = {
  online: { label: 'Online', dot: 'bg-green-500' },
  busy: { label: 'Busy', dot: 'bg-red-500' },
  away: { label: 'Away', dot: 'bg-amber-400' },
  invisible: { label: 'Invisible', dot: 'bg-gray-400' },
};

const keyFor = (uid) => `chatmoo_app_settings_${uid || 'guest'}`;

const readLocal = (uid) => {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeLocal = (uid, settings) => {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(settings));
  } catch {
    // storage unavailable — memory cache keeps working for this session
  }
};

const sanitize = (data) => ({
  messageSound: typeof data?.messageSound === 'boolean' ? data.messageSound : DEFAULT_SETTINGS.messageSound,
  browserNotifications: typeof data?.browserNotifications === 'boolean' ? data.browserNotifications : DEFAULT_SETTINGS.browserNotifications,
  typingIndicators: typeof data?.typingIndicators === 'boolean' ? data.typingIndicators : DEFAULT_SETTINGS.typingIndicators,
  showAvatars: typeof data?.showAvatars === 'boolean' ? data.showAvatars : DEFAULT_SETTINGS.showAvatars,
  showTimestamps: typeof data?.showTimestamps === 'boolean' ? data.showTimestamps : DEFAULT_SETTINGS.showTimestamps,
  fontSize: ['small', 'medium', 'large'].includes(data?.fontSize) ? data.fontSize : DEFAULT_SETTINGS.fontSize,
  chatTheme: typeof data?.chatTheme === 'string' && data.chatTheme ? data.chatTheme : DEFAULT_SETTINGS.chatTheme,
  status: ['online', 'busy', 'away', 'invisible'].includes(data?.status) ? data.status : DEFAULT_SETTINGS.status,
  statusMessage: typeof data?.statusMessage === 'string' ? data.statusMessage : DEFAULT_SETTINGS.statusMessage,
});

let currentUserId = null;
let memoryCache = null;
let saveTimer = null;

// Load settings for a user: local cache first (instant), then DB (authoritative).
export const initAppSettings = async (uid) => {
  currentUserId = uid || null;
  memoryCache = { ...DEFAULT_SETTINGS, ...(readLocal(currentUserId) || {}) };
  if (!currentUserId) return memoryCache;
  try {
    const res = await axios.get(`${API_URL}/auth/user/${currentUserId}/settings`);
    if (res.data) {
      memoryCache = sanitize(res.data);
      writeLocal(currentUserId, memoryCache);
    }
  } catch {
    // DB unreachable — keep working from the local cache
  }
  return memoryCache;
};

export const resetAppSettings = () => {
  currentUserId = null;
  memoryCache = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
};

export const getAppSettings = () => {
  if (memoryCache) return memoryCache;
  return { ...DEFAULT_SETTINGS, ...(readLocal(currentUserId) || {}) };
};

// Applies instantly (cache) and persists to the DB debounced. Guests
// (no user id) stay local-only.
export const saveAppSettings = (patch) => {
  const next = sanitize({ ...getAppSettings(), ...patch });
  memoryCache = next;
  writeLocal(currentUserId, next);
  if (currentUserId) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await axios.put(`${API_URL}/auth/user/${currentUserId}/settings`, next);
      } catch {
        // DB unreachable — local cache keeps working; retried on next change
      }
    }, 400);
  }
  return next;
};

let audioCtx = null;
export const playMessageSound = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch {
    // sound unavailable — stay silent
  }
};

export const requestNotificationPermission = async () => {
  try {
    if (!('Notification' in window)) return 'unsupported';
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
};

export const notifyNewMessage = (title, body) => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return; // only nudge when the tab is in the background
    new Notification(title || 'New message', { body: body || '' });
  } catch {
    // notifications unavailable — ignore
  }
};
