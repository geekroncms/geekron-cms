import api from './client'
import type {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddFieldRequest,
  CollectionsListResponse,
  Field,
} from './types'

/**
 * 集合（数据模型）管理 API
 */
export const collectionApi = {
  /**
   * 获取所有集合
   */
  list: async () => {
    const response = await api.get<CollectionsListResponse>('/collections')
    return response.data
  },

  /**
   * 获取集合详情（包含字段定义）
   */
  get: async (id: string) => {
    const response = await api.get<Collection>(`/collections/${id}`)
    return response.data
  },

  /**
   * 创建集合
   */
  create: async (data: CreateCollectionRequest) => {
    const response = await api.post<Collection>('/collections', data)
    return response.data
  },

  /**
   * 更新集合
   */
  update: async (id: string, data: UpdateCollectionRequest) => {
    const response = await api.patch(`/collections/${id}`, data)
    return response.data
  },

  /**
   * 删除集合
   */
  delete: async (id: string) => {
    const response = await api.delete(`/collections/${id}`)
    return response.data
  },

  /**
   * 添加字段到集合
   */
  addField: async (collectionId: string, field: AddFieldRequest) => {
    const response = await api.post<Field>(`/collections/${collectionId}/fields`, field)
    return response.data
  },

  /**
   * 从集合删除字段
   */
  deleteField: async (collectionId: string, fieldId: string) => {
    const response = await api.delete(`/collections/${collectionId}/fields/${fieldId}`)
    return response.data
  },

  /**
   * 批量更新集合字段
   */
  updateFields: async (collectionId: string, fields: AddFieldRequest[]) => {
    const response = await api.put(`/collections/${collectionId}/fields`, { fields })
    return response.data
  },
}

export default collectionApi
