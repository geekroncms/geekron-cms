import api from './client'
import type {
  DataEntry,
  CreateDataRequest,
  UpdateDataRequest,
  DataListResponse,
  QueryParams,
} from './types'

/**
 * 数据管理 API（集合数据 CRUD）
 */
export const dataApi = {
  /**
   * 创建数据条目
   */
  create: async (collectionId: string, data: Record<string, any>) => {
    const response = await api.post<DataEntry>('/data', {
      collectionId,
      data,
    })
    return response.data
  },

  /**
   * 获取集合中的所有数据（分页）
   */
  list: async (collectionId: string, params?: QueryParams) => {
    const queryParams: any = {
      page: params?.page || 1,
      limit: params?.limit || 20,
      order: params?.order || 'desc',
    }

    if (params?.sort) {
      queryParams.sort = params.sort
    }

    if (params?.filter) {
      queryParams.filter = JSON.stringify(params.filter)
    }

    const response = await api.get<DataListResponse>(`/data/${collectionId}`, {
      params: queryParams,
    })
    return response.data
  },

  /**
   * 获取单条数据
   */
  get: async (collectionId: string, id: string) => {
    const response = await api.get<DataEntry>(`/data/${collectionId}/${id}`)
    return response.data
  },

  /**
   * 更新数据
   */
  update: async (collectionId: string, id: string, data: Record<string, any>) => {
    const response = await api.patch(`/data/${collectionId}/${id}`, { data })
    return response.data
  },

  /**
   * 删除数据
   */
  delete: async (collectionId: string, id: string) => {
    const response = await api.delete(`/data/${collectionId}/${id}`)
    return response.data
  },

  /**
   * 批量创建数据
   */
  bulkCreate: async (collectionId: string, items: Record<string, any>[]) => {
    const response = await api.post<{
      data: DataEntry[]
      count: number
      message: string
    }>(`/data/${collectionId}/bulk`, items)
    return response.data
  },
}

export default dataApi
