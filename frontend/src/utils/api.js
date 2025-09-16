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

export default api;