import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_PORT = 5000;
/** Fallback PC LAN IPs. Live IP is learned from /health and saved. */
export const CURRENT_WIFI_IP = '10.185.83.146';
const EXTRA_WIFI_IPS = ['192.168.1.5', '192.168.5.140', '192.168.5.197', '10.180.228.146'];

const SAVED_URL_KEY = 'ksp_server_base_url';
const LAN_IPS_KEY = 'ksp_lan_ips';

export const DEFAULT_BASE_URL = `http://${CURRENT_WIFI_IP}:${API_PORT}/api`;

const toApiUrl = (hostOrUrl: string) => {
  let cleaned = String(hostOrUrl || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `http://${cleaned}`;
  }
  if (!cleaned.endsWith('/api')) cleaned = `${cleaned}/api`;
  return cleaned.replace(/:\/\/(127\.0\.0\.1)\b/, '://localhost');
};

const uniqueUrls = (urls: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const v = toApiUrl(u || '');
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

export const CANDIDATE_BASE_URLS = uniqueUrls([
  `http://${CURRENT_WIFI_IP}:${API_PORT}/api`,
  `http://10.0.2.2:${API_PORT}/api`,
  `http://localhost:${API_PORT}/api`,
  `http://127.0.0.1:${API_PORT}/api`,
  ...EXTRA_WIFI_IPS.map((ip) => `http://${ip}:${API_PORT}/api`),
]);

const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-client-platform': 'MOBILE',
  },
  timeout: 12000,
});

let memoryToken: string | null = null;
let discovering: Promise<string | null> | null = null;

export const setCachedAuthToken = (token: string | null) => {
  memoryToken = token;
};

const loadLanApiUrls = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(LAN_IPS_KEY);
    const ips: string[] = raw ? JSON.parse(raw) : [];
    return uniqueUrls(ips.map((ip) => `http://${ip}:${API_PORT}/api`));
  } catch {
    return [];
  }
};

const rememberLanIps = async (lanIps?: string[]) => {
  if (!lanIps?.length) return;
  await AsyncStorage.setItem(LAN_IPS_KEY, JSON.stringify(lanIps));
};

export const probeHealth = async (baseApi: string, timeout = 3500) => {
  const healthUrl = toApiUrl(baseApi).replace(/\/api\/?$/, '/health');
  const res = await axios.get(healthUrl, { timeout });
  return {
    ok: res.status === 200 && res.data?.success !== false,
    lanIps: Array.isArray(res.data?.lanIps) ? (res.data.lanIps as string[]) : [],
    message: res.data?.message || 'Server connected successfully!',
  };
};

export const discoverWorkingBaseUrl = async (): Promise<string | null> => {
  if (discovering) return discovering;
  discovering = (async () => {
    const saved = await AsyncStorage.getItem(SAVED_URL_KEY);
    const remembered = await loadLanApiUrls();
    const candidates = uniqueUrls([
      DEFAULT_BASE_URL,
      `http://${CURRENT_WIFI_IP}:${API_PORT}/api`,
      api.defaults.baseURL as string,
      saved,
      ...remembered,
      ...CANDIDATE_BASE_URLS,
    ]);

    for (const candidate of candidates) {
      try {
        const probe = await probeHealth(candidate, 1800);
        if (!probe.ok) continue;
        await rememberLanIps(probe.lanIps);
        const lanUrls = uniqueUrls((probe.lanIps || []).map((ip) => `http://${ip}:${API_PORT}/api`));
        for (const extra of lanUrls) {
          if (!candidates.includes(extra)) candidates.push(extra);
        }
        api.defaults.baseURL = candidate;
        await AsyncStorage.setItem(SAVED_URL_KEY, candidate);
        return candidate;
      } catch {
        // try next
      }
    }
    return null;
  })();
  try {
    return await discovering;
  } finally {
    discovering = null;
  }
};

discoverWorkingBaseUrl().catch(() => {});

export const getServerBaseUrl = (): string => {
  return (api.defaults.baseURL as string) || DEFAULT_BASE_URL;
};

export const setServerBaseUrl = async (newUrl: string): Promise<string> => {
  const cleaned = toApiUrl(newUrl);
  api.defaults.baseURL = cleaned;
  await AsyncStorage.setItem(SAVED_URL_KEY, cleaned);
  return cleaned;
};

export const checkServerHealth = async (urlToCheck?: string): Promise<{ ok: boolean; message?: string }> => {
  try {
    const base = urlToCheck || (api.defaults.baseURL as string) || DEFAULT_BASE_URL;
    const probe = await probeHealth(base, 4000);
    if (probe.ok) {
      await rememberLanIps(probe.lanIps);
      return { ok: true, message: probe.message };
    }
    return { ok: false, message: 'Server is not healthy' };
  } catch (err: any) {
    const recovered = await discoverWorkingBaseUrl();
    if (recovered) {
      return { ok: true, message: `Connected via ${recovered}` };
    }
    return { ok: false, message: err.message || 'Cannot reach server' };
  }
};

api.interceptors.request.use(
  async (config) => {
    let token = memoryToken;
    if (!token) {
      token = await AsyncStorage.getItem('ksp_mobile_token');
      memoryToken = token;
    }
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

    if (isNetworkError && originalRequest && !originalRequest._retriedWithFallback) {
      originalRequest._retriedWithFallback = true;
      const recovered = await discoverWorkingBaseUrl();
      if (recovered) {
        originalRequest.baseURL = recovered;
        return api(originalRequest);
      }
    }

    if (error.response?.status === 401) {
      memoryToken = null;
      await AsyncStorage.removeItem('ksp_mobile_token');
    }

    const message = error.response?.data?.message || error.message || 'Network error. Please verify server connection.';
    return Promise.reject(new Error(message));
  }
);

export default api;
