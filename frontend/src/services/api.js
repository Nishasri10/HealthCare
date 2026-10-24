import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('carepoint-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'Unable to reach the service.';
    return Promise.reject(new Error(message));
  }
);

export default api;
