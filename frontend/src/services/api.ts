import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from '../types';

const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${defaultHost}:3000/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
});


// Interceptor: Otomatis sisipkan Bearer token jika ada
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cat_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Tangani error respon secara seragam & logout saat 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      // Jika 401 pada path login, biarkan ditangani oleh form login
      const isLoginPath = error.config?.url?.includes('/auth/login');
      if (!isLoginPath) {
        localStorage.removeItem('cat_token');
        localStorage.removeItem('cat_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'Terjadi kesalahan saat berkomunikasi dengan server.';

    const customError = new Error(message) as any;
    customError.status = error.response?.status;
    customError.response = error.response;
    return Promise.reject(customError);
  }
);

export default apiClient;
