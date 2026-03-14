import api from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  AuthMeResponse,
  TenantsListResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
} from './types'

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 用户登录
   */
  login: async (email: string, password: string, tenantId?: string) => {
    const response = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
      tenantId,
    })
    return response.data
  },

  /**
   * 用户注册（同时创建租户）
   */
  register: async (data: RegisterRequest) => {
    const response = await api.post<RegisterResponse>('/auth/register', data)
    return response.data
  },

  /**
   * 获取当前用户信息
   */
  me: async () => {
    const response = await api.get<AuthMeResponse>('/auth/me')
    return response.data
  },

  /**
   * 刷新 Token
   */
  refresh: async () => {
    const response = await api.post<{ token: string; message: string }>('/auth/refresh')
    return response.data
  },

  /**
   * 获取用户所有租户
   */
  getTenants: async () => {
    const response = await api.get<TenantsListResponse>('/auth/tenants')
    return response.data
  },

  /**
   * 切换租户
   */
  switchTenant: async (tenantId: string) => {
    const response = await api.post<SwitchTenantResponse>('/auth/switch-tenant', {
      tenantId,
    })
    return response.data
  },

  /**
   * 登出
   */
  logout: async () => {
    const response = await api.post<{ message: string }>('/auth/logout')
    return response.data
  },
}

/**
 * 登录并保存 Token 到本地存储
 */
export async function login(email: string, password: string, tenantId?: string) {
  const data = await authApi.login(email, password, tenantId)

  // 保存认证信息
  localStorage.setItem('token', data.token)
  localStorage.setItem('tenantId', data.tenant.id)
  localStorage.setItem('userId', data.user.id)
  localStorage.setItem('userEmail', data.user.email)
  localStorage.setItem('userName', data.user.name)

  return data
}

/**
 * 登出并清除本地存储
 */
export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('tenantId')
  localStorage.removeItem('userId')
  localStorage.removeItem('userEmail')
  localStorage.removeItem('userName')
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token')
}

/**
 * 获取当前 Token
 */
export function getToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * 获取当前租户 ID
 */
export function getTenantId(): string | null {
  return localStorage.getItem('tenantId')
}

/**
 * 获取当前用户 ID
 */
export function getUserId(): string | null {
  return localStorage.getItem('userId')
}

export default authApi
