import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api/v1'

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// 请求拦截器 - 添加 Token 和 Tenant ID
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    const tenantId = localStorage.getItem('tenantId')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId
    }

    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // 401 未授权，跳转到登录页
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('tenantId')
      // 避免在登录页死循环
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    // 统一错误处理
    const errorData: any = {
      status: error.response?.status || 500,
      code: 'UNKNOWN_ERROR',
      message: error.response?.statusText || 'Network error',
      details: (error.response?.data as any)?.message || error.message,
    }

    if (error.response?.data) {
      const data = error.response.data as any
      errorData.code = data.code || errorData.code
      errorData.message = data.message || errorData.message
      errorData.details = data.details || errorData.details
    }

    return Promise.reject(errorData)
  },
)

// 导出 API 实例和类型
export type { AxiosInstance, AxiosError, AxiosResponse }
export default api
