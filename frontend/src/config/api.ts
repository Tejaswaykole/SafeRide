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
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${host}:8000`;
};

export const getWsBaseUrl = (): string => {
  if (envApiUrl) {
    const cleanUrl = envApiUrl.replace(/\/+$/, '');
    if (cleanUrl.startsWith('https://')) {
      return cleanUrl.replace('https://', 'wss://');
    }
    if (cleanUrl.startsWith('http://')) {
      return cleanUrl.replace('http://', 'ws://');
    }
    return `wss://${cleanUrl.replace(/^wss?:\/\//, '')}`;
  }
  const host = getHost();
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}:8000`;
};

export const getVehicleRestUrl = (vehicleId: number = 1): string => {
  return `${getApiBaseUrl()}/api/vehicles/${vehicleId}`;
};

export const getVehicleWsUrl = (vehicleId: number = 1): string => {
  return `${getWsBaseUrl()}/api/ws/${vehicleId}`;
};
