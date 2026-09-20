import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // httpOnly cookies sent automatically
});

let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    const isAuthEndpoint =
      original.url?.includes('/refresh') ||
      original.url?.includes('/login')   ||
      original.url?.includes('/register')||
      original.url?.includes('/logout');

    // Only intercept 401s on protected endpoints, once per request
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch((e) => Promise.reject(e));
      }

      isRefreshing = true;

      try {
        await api.post('/refresh');
        processQueue(null);
        isRefreshing = false;
        return api(original); // retry original request with new cookie
      } catch {
        processQueue(new Error('Session expired'));
        isRefreshing = false;
        // Clear session hint so AuthContext skips server check on next mount
        sessionStorage.removeItem('ss_session');
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
