import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Default to PC Wi-Fi IP (192.168.7.6) so it works on Wi-Fi without USB cable,
// or localhost:5000 when ADB reverse is active.
const getBaseUrl = () => {
  return 'http://192.168.7.6:5000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

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
  (error) => {
    const message = error.response?.data?.message || error.message || 'Network error. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
