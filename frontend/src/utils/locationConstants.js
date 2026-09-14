export const COUNTRIES = [
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

const API_BASE = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';
export const UNIVERSITIES_API = `${API_BASE}/utils/universities`;

export const getFlagUrl = (countryCode) => {
  if (!countryCode || countryCode === 'OTHER') return null;
  return `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;
};
