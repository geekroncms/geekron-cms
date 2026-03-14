import api from './client'
import type {
  Tenant,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantsListResponse,
  QuotasResponse,
} from './types'

/**
 * 租户管理 API
 */
export const tenantApi = {
  /**
   * 获取当前租户信息
   */
  getMe: async () => {
    const response = await api.get<Tenant>('/tenants/me')
    return response.data
  },

  /**
   * 创建租户（管理员操作）
   */
  create: async (data: CreateTenantRequest) => {
    const response = await api.post<Tenant>('/tenants', data)
    return response.data
  },

  /**
   * 获取租户列表（分页）
   */
  list: async (params?: {
    page?: number
    limit?: number
    status?: string
    plan?: string
  }) => {
    const response = await api.get<TenantsListResponse>('/tenants', { params })
    return response.data
  },

  /**
   * 获取租户详情
   */
  get: async (id: string) => {
    const response = await api.get<Tenant>(`/tenants/${id}`)
    return response.data
  },

  /**
   * 更新租户
   */
  update: async (id: string, data: UpdateTenantRequest) => {
    const response = await api.patch(`/tenants/${id}`, data)
    return response.data
  },

  /**
   * 删除租户（软删除）
   */
  delete: async (id: string) => {
    const response = await api.delete(`/tenants/${id}`)
    return response.data
  },

  /**
   * 激活租户
   */
  activate: async (id: string) => {
    const response = await api.post(`/tenants/${id}/activate`)
    return response.data
  },

  /**
   * 暂停租户
   */
  suspend: async (id: string) => {
    const response = await api.post(`/tenants/${id}/suspend`)
    return response.data
  },

  /**
   * 检查子域名是否可用
   */
  checkSubdomain: async (subdomain: string) => {
    const response = await api.get<{
      available: boolean
      valid: boolean
      subdomain: string
      message?: string
    }>(`/tenants/check-subdomain/${subdomain}`)
    return response.data
  },

  /**
   * 获取租户配额使用情况
   */
  getQuotas: async (id: string) => {
    const response = await api.get<QuotasResponse>(`/tenants/${id}/quotas`)
    return response.data
  },

  /**
   * 重置租户配额使用量
   */
  resetQuotas: async (id: string) => {
    const response = await api.post(`/tenants/${id}/quotas/reset`)
    return response.data
  },
}

export default tenantApi
