import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const auth = {
  registerCompany: (data) => api.post('/auth/register-company', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  getDepartmentSignupInfo: (departmentId) => api.get(`/auth/department/${departmentId}/signup-info`),
  getDepartmentSignupInfoBySlug: (companySlug, departmentSlug) => api.get(`/auth/company/${companySlug}/department/${departmentSlug}/signup-info`),
  registerDepartmentUser: (departmentId, data) => api.post(`/auth/department/${departmentId}/signup`, data),
  registerDepartmentUserBySlug: (companySlug, departmentSlug, data) => api.post(`/auth/company/${companySlug}/department/${departmentSlug}/signup`, data),
  registerDepartmentHead: (departmentId, data) => api.post(`/auth/department/${departmentId}/signup-head`, data),
  registerDepartmentHeadBySlug: (companySlug, departmentSlug, data) => api.post(`/auth/company/${companySlug}/department/${departmentSlug}/signup-head`, data),
};

// Company API calls
export const companies = {
  getCompany: (id) => api.get(`/companies/${id}`),
  createDepartment: (companyId, data) => api.post(`/companies/${companyId}/departments`, data),
};

// Department API calls
export const departments = {
  getAll: () => api.get('/departments'),
  getCompanyDepartments: (companyId) => api.get(`/departments/company/${companyId}`),
  getDepartment: (id) => api.get(`/departments/${id}`),
  getDepartmentBySlug: (companySlug, departmentSlug) => api.get(`/companies/slug/${companySlug}/${departmentSlug}`),
  create: (data) => api.post('/departments', data),
  delete: (id) => api.delete(`/departments/${id}`),
  addUser: (departmentId, data) => api.post(`/departments/${departmentId}/users`, data),
  removeUser: (departmentId, userId) => api.delete(`/departments/${departmentId}/users/${userId}`),
  requestUserRemoval: (departmentId, userId, data) => api.post(`/departments/${departmentId}/users/${userId}/request-removal`, data),
  assignAdmin: (departmentId, data) => api.patch(`/departments/${departmentId}/admin`, data),
  assignHead: (departmentId, data) => api.patch(`/departments/${departmentId}/head`, data),
  removeHead: (departmentId, data) => api.patch(`/departments/${departmentId}/remove-head`, data),
};

// Notes API calls
export const notes = {
  getDepartmentNotes: (departmentId, params) => api.get(`/notes/department/${departmentId}`, { params }),
  getDepartmentNotesBySlug: (companySlug, departmentSlug, params) => api.get(`/notes/company/${companySlug}/department/${departmentSlug}`, { params }),
  getNote: (id) => api.get(`/notes/${id}`),
  createNote: (data) => api.post('/notes', data),
  updateNote: (id, data) => api.put(`/notes/${id}`, data),
  deleteNote: (id) => api.delete(`/notes/${id}`),
};

// Tasks API calls
export const tasks = {
  getDepartmentTasks: (departmentId, params) => api.get(`/tasks/department/${departmentId}`, { params }),
  getDepartmentTasksBySlug: (companySlug, departmentSlug, params) => api.get(`/tasks/company/${companySlug}/department/${departmentSlug}`, { params }),
  getTask: (id) => api.get(`/tasks/${id}`),
  createTask: (data) => api.post('/tasks', data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
};

// Activity API calls
export const activity = {
  getCompanyActivity: (companyId, params) => api.get(`/activity/company/${companyId}`, { params }),
  getActivitySummary: (companyId, params) => api.get(`/activity/company/${companyId}/summary`, { params }),
};

// Messages API calls
export const messages = {
  send: (recipientId, content) => api.post('/messages', { recipientId, content }),
  getThread: (userId) => api.get(`/messages/thread/${userId}`),
  getCompanyMessages: () => api.get('/messages/company'), // super admin only
  markRead: (messageId) => api.patch(`/messages/${messageId}/read`),
  getGroupMessages: (groupId, params) => api.get(`/messages/group/${groupId}`, { params }),
  sendGroupMessage: (groupId, content) => api.post('/messages-enhanced', { groupId, content, type: 'TEXT' }),
};

// Groups API calls
export const groups = {
  getUserGroups: () => api.get('/groups'),
  createGroup: (data) => api.post('/groups/create', data),
  updateGroup: (groupId, data) => api.patch(`/groups/${groupId}`, data),
  addMembers: (groupId, memberIds) => api.post(`/groups/${groupId}/members`, { memberIds }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

// Reactions API calls
export const reactions = {
  addReaction: (messageId, emoji) => api.post(`/messages/${messageId}/reactions`, { emoji }),
  getMessageReactions: (messageId) => api.get(`/messages/${messageId}/reactions`),
  getReactionUsers: (messageId, emoji) => api.get(`/messages/${messageId}/reactions/${emoji}/users`),
};

// Message Editing API calls
export const messageEditing = {
  editMessage: (messageId, content) => api.put(`/messages/${messageId}`, { content }),
  getMessageHistory: (messageId) => api.get(`/messages/${messageId}/history`),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
};

// Thread API calls
export const threads = {
  getThread: (messageId, page = 1, limit = 20) => api.get(`/threads/${messageId}?page=${page}&limit=${limit}`),
  createReply: (messageId, content, type = 'TEXT') => api.post(`/threads/${messageId}/replies`, { content, type }),
  getThreadSummary: (messageId) => api.get(`/threads/${messageId}/summary`),
  joinThread: (messageId) => api.post(`/threads/${messageId}/join`),
};

// Admin API calls
export const admin = {
  // Analytics
  getMessageAnalytics: (timeframe = '7d', companyId) => 
    api.get(`/admin/analytics/messages?timeframe=${timeframe}${companyId ? `&companyId=${companyId}` : ''}`),
  
  // User activity
  getUserActivity: (page = 1, limit = 20, search, department) => 
    api.get(`/admin/users/activity?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}${department ? `&department=${department}` : ''}`),
  
  // Content moderation
  getModerationMessages: (page = 1, limit = 20, status = 'pending') => 
    api.get(`/admin/moderation/messages?page=${page}&limit=${limit}&status=${status}`),
  
  // System health
  getSystemHealth: () => api.get('/admin/system/health'),
  
  // Company management
  getCompanies: (page = 1, limit = 20, search) => 
    api.get(`/admin/companies?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),
  
  // Group management
  getGroups: (page = 1, limit = 20, search) => 
    api.get(`/admin/groups?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),
};

// Platform Admin API calls (SUPER_ADMIN only)
export const platformAdmin = {
  // Business analytics endpoints
  getBusinessMetrics: (timeframe = '30d') => api.get(`/platform-admin/business-metrics?timeframe=${timeframe}`),
  getRevenueData: (timeframe = '30d') => api.get(`/platform-admin/revenue-data?timeframe=${timeframe}`),
  getCompanyRevenue: (companyId, timeframe = '30d') => 
    api.get(`/platform-admin/company-revenue/${companyId}?timeframe=${timeframe}`),
  
  // Company listing
  getCompanies: (page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc') => 
    api.get(`/platform-admin/companies?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
  
  // Legacy endpoints (kept for compatibility)
  getOverview: (timeframe = '30d') => api.get(`/platform-admin/overview?timeframe=${timeframe}`),
  getCompanyDetails: (companyId, timeframe = '30d') => 
    api.get(`/platform-admin/companies/${companyId}/details?timeframe=${timeframe}`),
  getSystemHealth: () => api.get('/platform-admin/system/health'),
};

// Company Admin API calls (HEAD_OF_DEPARTMENT only)
export const companyAdmin = {
  getOverview: (timeframe = '30d') => api.get(`/company-admin/overview?timeframe=${timeframe}`),
  getUsers: (page = 1, limit = 20, search, department, role, status) => 
    api.get(`/company-admin/users?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}${department ? `&department=${department}` : ''}${role ? `&role=${role}` : ''}${status ? `&status=${status}` : ''}`),
  getDepartments: () => api.get('/company-admin/departments'),
  getGroups: (page = 1, limit = 20, search) => 
    api.get(`/company-admin/groups?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`),
  getFlaggedContent: (page = 1, limit = 20, type) => 
    api.get(`/company-admin/content/flagged?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`),
  getSettings: () => api.get('/company-admin/settings'),
  updateSettings: (data) => api.patch('/company-admin/settings', data),
};

// Department Dashboard API calls (USER role)
export const departmentDashboard = {
  getOverview: (timeframe = '30d') => api.get(`/department-dashboard/overview?timeframe=${timeframe}`),
  getMyStats: (timeframe = '30d') => api.get(`/department-dashboard/my-stats?timeframe=${timeframe}`),
  getColleagues: (search, status) => 
    api.get(`/department-dashboard/colleagues${search ? `?search=${search}` : ''}${status ? `${search ? '&' : '?'}status=${status}` : ''}`),
  getMyGroups: () => api.get('/department-dashboard/my-groups'),
  getRecentActivity: (limit = 20) => api.get(`/department-dashboard/recent-activity?limit=${limit}`),
};

export default api;