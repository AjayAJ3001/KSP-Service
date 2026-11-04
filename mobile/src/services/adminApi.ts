import api from './api';

const adminHeaders = { 'x-client-platform': 'MOBILE_ADMIN' };

const withAdmin = (config?: any) => ({
  ...config,
  headers: { ...(config?.headers || {}), ...adminHeaders },
});

const adminApi = {
  get: (url: string, config?: any) => api.get(url, withAdmin(config)),
  post: (url: string, data?: any, config?: any) => api.post(url, data, withAdmin(config)),
  put: (url: string, data?: any, config?: any) => api.put(url, data, withAdmin(config)),
  patch: (url: string, data?: any, config?: any) => api.patch(url, data, withAdmin(config)),
  delete: (url: string, config?: any) => api.delete(url, withAdmin(config)),
};

export default adminApi;
