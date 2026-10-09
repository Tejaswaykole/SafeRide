// Centralized SafeRide API & WebSocket Configuration

const envApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const getHost = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return '127.0.0.1';
};

export const getApiBaseUrl = (): string => {
  if (envApiUrl) {
    return envApiUrl.replace(/\/+$/, '');
  }
  const host = getHost();
  // If running in production (e.g. Vercel, Netlify, custom domain) without explicit env var, default to live Render backend
  if (host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
    return 'https://saferide-9s02.onrender.com';
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${host}:8000`;
};

export const getWsBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  if (cleanUrl.startsWith('https://')) {
    return cleanUrl.replace('https://', 'wss://');
  }
  if (cleanUrl.startsWith('http://')) {
    return cleanUrl.replace('http://', 'ws://');
  }
  return `wss://${cleanUrl.replace(/^wss?:\/\//, '')}`;
};

export const getVehicleRestUrl = (vehicleId: number = 1): string => {
  return `${getApiBaseUrl()}/api/vehicles/${vehicleId}`;
};

export const getVehicleWsUrl = (vehicleId: number = 1): string => {
  return `${getWsBaseUrl()}/api/ws/${vehicleId}`;
};
