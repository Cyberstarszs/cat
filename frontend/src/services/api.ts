import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from '../types';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return 'http://' + host + ':3000/api/v1';
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

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

// Mutex & Antrean Refresh Token Transparan (mencegah thundering herd & session drop saat ujian berlangsung)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Interceptor: Tangani error respon secara seragam & auto-refresh token saat 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest) {
      const url = originalRequest.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh');

      if (!isAuthEndpoint && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const currentToken = localStorage.getItem('cat_token') || '';
          const refreshRes = await axios.post<{ token: string }>(
            `${API_BASE_URL}/auth/refresh`,
            {},
            {
              headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
              withCredentials: true,
            }
          );

          const newToken = refreshRes.data.token;
          if (newToken) {
            localStorage.setItem('cat_token', newToken);
            apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return apiClient(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          localStorage.removeItem('cat_token');
          localStorage.removeItem('cat_user');
          localStorage.removeItem('cat_profile');

          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }
    }

    const data = error.response?.data as any;
    const message =
      data?.message ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      error.message ||
      'Terjadi kendala saat berkomunikasi dengan server.';

    const customError = new Error(message) as any;
    customError.status = error.response?.status;
    customError.response = error.response;
    return Promise.reject(customError);
  }
);

export default apiClient;
