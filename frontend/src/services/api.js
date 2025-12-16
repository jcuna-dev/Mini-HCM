import axios from 'axios';
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  getProfile: (uid) => api.get(`/auth/profile/${uid}`),
  updateProfile: (uid, data) => api.put(`/auth/profile/${uid}`, data),
};

// Attendance API
export const attendanceAPI = {
  punchIn: () => api.post('/attendance/punch-in'),
  punchOut: () => api.post('/attendance/punch-out'),
  getStatus: () => api.get('/attendance/status'),
  getHistory: (params) => api.get('/attendance/history', { params }),
};

// Summary API
export const summaryAPI = {
  getDaily: (date) => api.get('/summary/daily', { params: { date } }),
  getWeekly: (startDate) => api.get('/summary/weekly', { params: { startDate } }),
  getDashboard: () => api.get('/summary/dashboard'),
};

// Admin API
export const adminAPI = {
  getEmployees: () => api.get('/admin/employees'),
  getPunches: (params) => api.get('/admin/punches', { params }),
  editPunch: (punchId, data) => api.put(`/admin/punches/${punchId}`, data),
  deletePunch: (punchId) => api.delete(`/admin/punches/${punchId}`),
  getDailyReport: (date) => api.get('/admin/reports/daily', { params: { date } }),
  getWeeklyReport: (startDate) => api.get('/admin/reports/weekly', { params: { startDate } }),
};

export default api;
