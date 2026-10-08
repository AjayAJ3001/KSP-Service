import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Current PC Wi-Fi IP and default endpoints
export const CURRENT_WIFI_IP = '10.180.228.146';
export const DEFAULT_BASE_URL = 'http://localhost:5000/api';

export const CANDIDATE_BASE_URLS = [
  'http://localhost:5000/api',             // USB Cable (ADB Reverse)
  `http://${CURRENT_WIFI_IP}:5000/api`,    // PC Wi-Fi Local IP
  'http://10.0.2.2:5000/api',               // Android Emulator
];

const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-client-platform': 'MOBILE',
  },
  timeout: 10000,
});

// Load saved custom base URL if any
AsyncStorage.getItem('ksp_server_base_url').then((saved) => {
  if (saved) {
    api.defaults.baseURL = saved;
  }
}).catch(() => {});

export const getServerBaseUrl = (): string => {
  return (api.defaults.baseURL as string) || DEFAULT_BASE_URL;
};

export const setServerBaseUrl = async (newUrl: string): Promise<string> => {
  let cleaned = newUrl.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  if (!cleaned.endsWith('/api')) {
    cleaned = `${cleaned}/api`;
  }
  api.defaults.baseURL = cleaned;
  await AsyncStorage.setItem('ksp_server_base_url', cleaned);
  return cleaned;
};

export const checkServerHealth = async (urlToCheck?: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const base = urlToCheck || (api.defaults.baseURL as string) || DEFAULT_BASE_URL;
    const healthUrl = base.replace(/\/api\/?$/, '/health');
    const res = await axios.get(healthUrl, { timeout: 3500 });
    if (res.status === 200) {
      return { ok: true, message: res.data?.message || 'Server connected successfully!' };
    }
    return { ok: false, message: `Server returned status ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Cannot reach server' };
  }
};

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('ksp_mobile_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isNetworkError = !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT'
    );

    // If network failed and hasn't retried yet, probe other candidate URLs
    if (isNetworkError && originalRequest && !originalRequest._retriedWithFallback) {
      originalRequest._retriedWithFallback = true;
      const currentUrl = (api.defaults.baseURL as string) || DEFAULT_BASE_URL;
      const fallbacks = CANDIDATE_BASE_URLS.filter((u) => u !== currentUrl);

      for (const candidate of fallbacks) {
        try {
          const healthUrl = candidate.replace(/\/api\/?$/, '/health');
          const probe = await axios.get(healthUrl, { timeout: 2500 });
          if (probe.status === 200) {
            api.defaults.baseURL = candidate;
            await AsyncStorage.setItem('ksp_server_base_url', candidate);
            originalRequest.baseURL = candidate;
            return api(originalRequest);
          }
        } catch {
          // Probe failed for this candidate, try next
        }
      }
    }

    const message = error.response?.data?.message || error.message || 'Network error. Please verify server connection.';
    return Promise.reject(new Error(message));
  }
);

export default api;
