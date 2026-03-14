import api from './client'
import type {
  ApiKey,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeysListResponse,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  ApiKeyUsageResponse,
} from './types'

/**
 * API Key 管理 API
 */
export const apiKeyApi = {
  /**
   * 创建新的 API Key
   */
  create: async (data: CreateApiKeyRequest) => {
    const response = await api.post<ApiKey>('/api-keys', data)
    return response.data
  },

  /**
   * 获取 API Key 列表
   */
  list: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<ApiKeysListResponse>('/api-keys', { params })
    return response.data
  },

  /**
   * 获取 API Key 详情
   */
  get: async (id: string) => {
    const response = await api.get<ApiKey>(`/api-keys/${id}`)
    return response.data
  },

  /**
   * 更新 API Key
   */
  update: async (id: string, data: UpdateApiKeyRequest) => {
    const response = await api.patch(`/api-keys/${id}`, data)
    return response.data
  },

  /**
   * 删除（撤销）API Key
   */
  delete: async (id: string) => {
    const response = await api.delete(`/api-keys/${id}`)
    return response.data
  },

  /**
   * 轮换 API Key（生成新 Key，使旧 Key 失效）
   */
  rotate: async (id: string) => {
    const response = await api.post<{
      id: string
      key: string
      message: string
    }>(`/api-keys/${id}/rotate`)
    return response.data
  },

  /**
   * 验证 API Key
   */
  validate: async (key: string) => {
    const response = await api.post<ValidateApiKeyResponse>('/api-keys/validate', { key })
    return response.data
  },

  /**
   * 获取 API Key 使用统计
   */
  getUsage: async (id: string) => {
    const response = await api.get<ApiKeyUsageResponse>(`/api-keys/${id}/usage`)
    return response.data
  },
}

export default apiKeyApi
