import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Platform Admin Authentication API
export const platformAuth = {
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Verify the user is actually a platform admin
      if (response.data.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied. Platform admin privileges required.');
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || error.message || 'Login failed';
    }
  },

  logout: () => {
    localStorage.removeItem('platform_admin_token');
    localStorage.removeItem('platform_admin_user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('platform_admin_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken: () => {
    return localStorage.getItem('platform_admin_token');
  },

  setAuthData: (token, user) => {
    localStorage.setItem('platform_admin_token', token);
    localStorage.setItem('platform_admin_user', JSON.stringify(user));
  }
};

// Platform Admin Business API
export const platformAPI = {
  // Business metrics
  getBusinessMetrics: async () => {
    const response = await api.get('/platform-admin/business-metrics');
    return response.data;
  },

  // Revenue data
  getRevenueData: async (timeframe = '30d') => {
    const response = await api.get(`/platform-admin/revenue-data?timeframe=${timeframe}`);
    return response.data;
  },

  // Companies management
  getCompanies: async (page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc') => {
    const response = await api.get(`/platform-admin/companies?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
    return response.data;
  },

  // Company revenue details
  getCompanyRevenue: async (companyId) => {
    const response = await api.get(`/platform-admin/company-revenue/${companyId}`);
    return response.data;
  },

  // Platform statistics
  getPlatformStats: async () => {
    const response = await api.get('/platform-admin/platform-stats');
    return response.data;
  }
};

export default api;