import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenantId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  
  return config;
});

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('tenantId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API 方法
export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  
  register: (email: string, password: string, name: string) => 
    api.post('/auth/register', { email, password, name }),
  
  me: () => api.get('/auth/me'),
};

export const tenantApi = {
  getMe: () => api.get('/tenants/me'),
  create: (data: any) => api.put('/tenants/me', data),
  delete: () => api.delete('/tenants/me'),
};

export const collectionApi = {
  list: () => api.get('/collections'),
  get: (id: string) => api.get(`/collections/${id}`),
  create: (data: any) => api.post('/collections', data),
  update: (id: string, data: any) => api.put(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
  updateFields: (id: string, fields: any[]) => api.put(`/collections/${id}/fields`, { fields }),
};

export const userApi = {
  list: () => api.get('/users'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export const contentApi = {
  list: (collectionId: string, params?: any) => 
    api.get(`/collections/${collectionId}/contents`, { params }),
  get: (collectionId: string, id: string) => 
    api.get(`/collections/${collectionId}/contents/${id}`),
  create: (collectionId: string, data: any) => 
    api.post(`/collections/${collectionId}/contents`, data),
  update: (collectionId: string, id: string, data: any) => 
    api.put(`/collections/${collectionId}/contents/${id}`, data),
  delete: (collectionId: string, id: string) => 
    api.delete(`/collections/${collectionId}/contents/${id}`),
};

export default api;
