import api from './client'
import type {
  QuotaStatusResponse,
  ResetUsageRequest,
  CheckQuotaResponse,
} from './types'

/**
 * 配额管理 API
 */
export const quotaApi = {
  /**
   * 获取当前租户配额和使用情况
   */
  get: async () => {
    const response = await api.get<QuotaStatusResponse>('/quotas')
    return response.data
  },

  /**
   * 获取详细使用统计
   */
  getUsage: async () => {
    const response = await api.get<QuotaStatusResponse>('/quotas/usage')
    return response.data
  },

  /**
   * 重置使用量（仅管理员）
   */
  reset: async (data: ResetUsageRequest) => {
    const response = await api.post<{
      success: boolean
      message: string
      reset: {
        requests: boolean
        storage: boolean
      }
    }>('/quotas/reset', data)
    return response.data
  },

  /**
   * 更新配额（仅超级管理员）
   */
  update: async (data: {
    max_requests_per_minute?: number
    max_requests_per_day?: number
    max_storage_bytes?: number
    max_users?: number
    max_collections?: number
    max_api_keys?: number
    plan?: 'free' | 'pro' | 'enterprise'
  }) => {
    const response = await api.patch('/quotas', data)
    return response.data
  },

  /**
   * 检查特定资源配额是否充足
   */
  check: async (
    resource: 'users' | 'collections' | 'api_keys' | 'storage',
    amount: number = 1,
  ) => {
    const response = await api.get<CheckQuotaResponse>(`/quotas/check/${resource}`, {
      params: { amount },
    })
    return response.data
  },

  /**
   * 更新存储使用量（文件上传时调用）
   */
  updateStorage: async (delta: number, fileId?: string) => {
    const response = await api.post<{
      success: boolean
      message: string
      data: {
        delta: number
        file_id?: string
        new_total: number
        limit: number
      }
    }>('/quotas/usage/storage', { delta, file_id: fileId })
    return response.data
  },
}

export default quotaApi
