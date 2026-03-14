import api from './client'
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  InviteUserRequest,
  ChangePasswordRequest,
  UsersListResponse,
} from './types'

/**
 * 用户管理 API
 */
export const userApi = {
  /**
   * 获取用户列表（当前租户内）
   */
  list: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<UsersListResponse>('/users', { params })
    return response.data
  },

  /**
   * 获取用户详情
   */
  get: async (id: string) => {
    const response = await api.get<User>(`/users/${id}`)
    return response.data
  },

  /**
   * 创建用户并添加到当前租户
   */
  create: async (data: CreateUserRequest) => {
    const response = await api.post<User>('/users', data)
    return response.data
  },

  /**
   * 邀请现有用户加入当前租户
   */
  invite: async (data: InviteUserRequest) => {
    const response = await api.post<{
      message: string
      userId: string
      email: string
      role: string
    }>('/users/invite', data)
    return response.data
  },

  /**
   * 更新用户信息
   */
  update: async (id: string, data: UpdateUserRequest) => {
    const response = await api.patch(`/users/${id}`, data)
    return response.data
  },

  /**
   * 从当前租户移除用户（软删除）
   */
  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`)
    return response.data
  },

  /**
   * 用户离开当前租户
   */
  leave: async (userId: string) => {
    const response = await api.post(`/users/${userId}/leave`)
    return response.data
  },

  /**
   * 修改密码
   */
  changePassword: async (data: ChangePasswordRequest) => {
    const response = await api.post('/users/change-password', data)
    return response.data
  },
}

export default userApi
