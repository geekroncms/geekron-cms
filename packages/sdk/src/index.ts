/**
 * Geekron CMS Client SDK
 * 
 * @example
 * ```typescript
 * import { GeekronCMS } from '@geekron-cms/sdk'
 * 
 * const client = new GeekronCMS({
 *   baseURL: 'https://api.geekron-cms.com',
 *   token: 'your_jwt_token'
 * })
 * 
 * const tenants = await client.tenants.list()
 * ```
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

export interface GeekronCMSConfig {
  baseURL: string
  token?: string
  timeout?: number
}

export interface PaginationParams {
  page?: number
  limit?: number
  orderBy?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Tenant {
  id: string
  name: string
  subdomain: string
  status: 'active' | 'suspended' | 'deleted'
  plan: 'free' | 'pro' | 'enterprise'
  settings: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'inactive'
  avatarUrl?: string
  createdAt: string
}

export class GeekronCMS {
  private client: AxiosInstance

  public tenants: TenantsAPI
  public users: UsersAPI
  public content: ContentAPI
  public files: FilesAPI

  constructor(config: GeekronCMSConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 添加认证拦截器
    this.client.interceptors.request.use((config) => {
      if (config.token) {
        config.headers.Authorization = `Bearer ${config.token}`
      }
      return config
    })

    // 初始化 API 模块
    this.tenants = new TenantsAPI(this.client, config.token)
    this.users = new UsersAPI(this.client, config.token)
    this.content = new ContentAPI(this.client, config.token)
    this.files = new FilesAPI(this.client, config.token)
  }

  /**
   * 设置认证 Token
   */
  setToken(token: string) {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`
    
    // 更新所有 API 模块的 token
    this.tenants.setToken(token)
    this.users.setToken(token)
    this.content.setToken(token)
    this.files.setToken(token)
  }
}

class TenantsAPI {
  constructor(private client: AxiosInstance, private token?: string) {}

  setToken(token: string) {
    this.token = token
  }

  async list(params?: PaginationParams): Promise<PaginatedResponse<Tenant>> {
    const response = await this.client.get('/api/v1/tenants', { params })
    return response.data
  }

  async get(id: string): Promise<{ success: boolean; data: Tenant }> {
    const response = await this.client.get(`/api/v1/tenants/${id}`)
    return response.data
  }

  async create(data: {
    name: string
    subdomain: string
    plan?: 'free' | 'pro' | 'enterprise'
    settings?: Record<string, any>
  }): Promise<{ success: boolean; data: Tenant }> {
    const response = await this.client.post('/api/v1/tenants', data)
    return response.data
  }

  async update(
    id: string,
    data: { name?: string; plan?: string; settings?: Record<string, any> }
  ): Promise<{ success: boolean; data: Tenant }> {
    const response = await this.client.put(`/api/v1/tenants/${id}`, data)
    return response.data
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/api/v1/tenants/${id}`)
  }
}

class UsersAPI {
  constructor(private client: AxiosInstance, private token?: string) {}

  setToken(token: string) {
    this.token = token
  }

  async list(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const response = await this.client.get('/api/v1/users', { params })
    return response.data
  }

  async get(id: string): Promise<{ success: boolean; data: User }> {
    const response = await this.client.get(`/api/v1/users/${id}`)
    return response.data
  }

  async create(data: {
    email: string
    name: string
    role?: 'admin' | 'member' | 'viewer'
  }): Promise<{ success: boolean; data: User }> {
    const response = await this.client.post('/api/v1/users', data)
    return response.data
  }

  async update(
    id: string,
    data: { name?: string; role?: string; status?: string }
  ): Promise<{ success: boolean; data: User }> {
    const response = await this.client.put(`/api/v1/users/${id}`, data)
    return response.data
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/api/v1/users/${id}`)
  }
}

class ContentAPI {
  constructor(private client: AxiosInstance, private token?: string) {}

  setToken(token: string) {
    this.token = token
  }

  async list(params?: PaginationParams & { model?: string; status?: string }): Promise<PaginatedResponse<any>> {
    const response = await this.client.get('/api/v1/content', { params })
    return response.data
  }

  async get(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.client.get(`/api/v1/content/${id}`)
    return response.data
  }

  async create(data: {
    title: string
    modelId: string
    slug?: string
    data?: Record<string, any>
    status?: 'draft' | 'published'
  }): Promise<{ success: boolean; data: any }> {
    const response = await this.client.post('/api/v1/content', data)
    return response.data
  }

  async update(id: string, data: Record<string, any>): Promise<{ success: boolean; data: any }> {
    const response = await this.client.put(`/api/v1/content/${id}`, data)
    return response.data
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/api/v1/content/${id}`)
  }

  async publish(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.client.post(`/api/v1/content/${id}/publish`)
    return response.data
  }

  async unpublish(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.client.post(`/api/v1/content/${id}/unpublish`)
    return response.data
  }
}

class FilesAPI {
  constructor(private client: AxiosInstance, private token?: string) {}

  setToken(token: string) {
    this.token = token
  }

  async list(params?: PaginationParams): Promise<PaginatedResponse<any>> {
    const response = await this.client.get('/api/v1/files', { params })
    return response.data
  }

  async upload(file: File | Blob): Promise<{ success: boolean; data: any }> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await this.client.post('/api/v1/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  async get(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.client.get(`/api/v1/files/${id}`)
    return response.data
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/api/v1/files/${id}`)
  }

  async getUrl(id: string): Promise<{ success: boolean; data: { url: string } }> {
    const response = await this.client.get(`/api/v1/files/${id}/url`)
    return response.data
  }
}

export default GeekronCMS
