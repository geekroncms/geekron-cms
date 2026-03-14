// ==================== 通用类型定义 ====================

export interface ApiResponse<T = any> {
  data?: T
  message?: string
  pagination?: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiError {
  status: number
  code: string
  message: string
  details?: any
}

// ==================== 认证相关类型 ====================

export interface LoginRequest {
  email: string
  password: string
  tenantId?: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
  }
  tenant: {
    id: string
    name: string
    slug: string
    plan: string
  }
  role: string
  permissions: string[]
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  tenantName: string
  tenantSlug: string
}

export interface RegisterResponse {
  user: {
    id: string
    email: string
    name: string
  }
  tenant: {
    id: string
    name: string
    slug: string
  }
  message: string
}

export interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface TenantInfo {
  id: string
  name: string
  slug: string
  plan: string
}

export interface AuthMeResponse {
  user: UserInfo
  tenant: TenantInfo | null
  role: string
  permissions: string[]
}

export interface TenantItem {
  id: string
  name: string
  slug: string
  plan: string
  role: string
  joinedAt: string
}

export interface TenantsListResponse {
  tenants: TenantItem[]
  total: number
}

export interface SwitchTenantRequest {
  tenantId: string
}

export interface SwitchTenantResponse {
  token: string
  tenant: TenantInfo
  role: string
  permissions: string[]
  message: string
}

// ==================== 租户相关类型 ====================

export interface Tenant {
  id: string
  name: string
  subdomain: string
  email: string
  plan: string
  status: string
  settings?: Record<string, any>
  quotas?: {
    apiCalls: number
    storageMb: number
    users: number
  }
  usage?: {
    apiCalls: number
    storageMb: number
    users: number
  }
  memberCount?: number
  createdAt: string
  updatedAt: string
}

export interface CreateTenantRequest {
  name: string
  subdomain: string
  email: string
  plan?: 'free' | 'pro' | 'enterprise'
  settings?: Record<string, any>
}

export interface UpdateTenantRequest {
  name?: string
  email?: string
  plan?: 'free' | 'pro' | 'enterprise'
  settings?: Record<string, any>
}

export interface TenantsListResponse {
  data: Tenant[]
  pagination: Pagination
}

export interface QuotaUsage {
  limit: number
  used: number
  remaining: number
  percentage: number
}

export interface QuotasResponse {
  plan: string
  quotas: {
    apiCalls: QuotaUsage
    storage: QuotaUsage
    users: QuotaUsage
  }
}

// ==================== 用户相关类型 ====================

export interface User {
  id: string
  email: string
  name: string
  role: string
  status: string
  tenant_role?: string
  permissions?: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role?: 'owner' | 'admin' | 'editor' | 'viewer'
}

export interface UpdateUserRequest {
  email?: string
  name?: string
  role?: 'owner' | 'admin' | 'editor' | 'viewer'
  status?: 'active' | 'inactive' | 'banned'
}

export interface InviteUserRequest {
  email: string
  role?: 'owner' | 'admin' | 'editor' | 'viewer'
  permissions?: string[]
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UsersListResponse {
  data: User[]
  pagination: Pagination
}

// ==================== 集合相关类型 ====================

export interface FieldType {
  name: string
  type: 'text' | 'number' | 'boolean' | 'date' | 'json' | 'relation'
  required: boolean
  unique: boolean
  defaultValue?: any
}

export interface Field extends FieldType {
  id: string
  collection_id: string
  created_at: string
}

export interface Collection {
  id: string
  tenant_id: string
  name: string
  slug: string
  description?: string
  fields?: Field[]
  field_count?: number
  createdAt: string
  updatedAt: string
}

export interface CreateCollectionRequest {
  name: string
  slug: string
  description?: string
  fields?: FieldType[]
}

export interface UpdateCollectionRequest {
  name?: string
  slug?: string
  description?: string
}

export interface AddFieldRequest extends FieldType {}

export interface CollectionsListResponse {
  data: Collection[]
}

// ==================== 数据相关类型 ====================

export interface DataEntry {
  id: string
  collection_id: string
  tenant_id: string
  data: Record<string, any>
  created_by: string
  updated_by: string
  createdAt: string
  updatedAt: string
}

export interface CreateDataRequest {
  collectionId: string
  data: Record<string, any>
}

export interface UpdateDataRequest {
  data: Record<string, any>
}

export interface QueryParams {
  page?: number
  limit?: number
  filter?: Record<string, any>
  sort?: string
  order?: 'asc' | 'desc'
}

export interface DataListResponse {
  data: DataEntry[]
  pagination: Pagination
}

// ==================== API Key 相关类型 ====================

export interface ApiKey {
  id: string
  name: string
  key?: string // 仅在创建时返回
  permissions: string[]
  expiresAt?: string
  lastUsedAt?: string
  createdAt: string
}

export interface CreateApiKeyRequest {
  name: string
  permissions?: ('read' | 'write' | 'delete' | 'admin')[]
  expiresAt?: string
}

export interface UpdateApiKeyRequest {
  name?: string
  permissions?: ('read' | 'write' | 'delete' | 'admin')[]
  expiresAt?: string
}

export interface ApiKeysListResponse {
  data: ApiKey[]
  pagination: Pagination
}

export interface ValidateApiKeyRequest {
  key: string
}

export interface ValidateApiKeyResponse {
  valid: boolean
  keyId?: string
  tenantId?: string
  name?: string
  permissions?: string[]
  expiresAt?: string
  lastUsedAt?: string
  error?: string
  expired?: boolean
}

export interface ApiKeyUsage {
  totalRequests: number
  readCount: number
  writeCount: number
  deleteCount: number
  firstUsedDate?: string
  lastUsedDate?: string
}

export interface ApiKeyUsageResponse {
  keyId: string
  name: string
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  usage: ApiKeyUsage
  recentUsage: Array<{
    action: string
    resource: string
    resourceId: string
    timestamp: string
    ipAddress?: string
  }>
}

// ==================== 配额相关类型 ====================

export interface QuotaConfig {
  max_requests_per_minute: number
  max_requests_per_day: number
  max_storage_bytes: number
  max_users: number
  max_collections: number
  max_api_keys: number
  plan: string
}

export interface UsageStats {
  requests_today: number
  requests_this_minute: number
  storage_bytes: number
  users_count: number
  collections_count: number
  api_keys_count: number
}

export interface QuotaStatusResponse {
  data: {
    tenant_id: string
    plan: string
    quotas: QuotaConfig
    usage: UsageStats
    usage_percent: {
      requests_today: number
      storage: number
      users: number
      collections: number
      api_keys: number
    }
    last_request_at?: string
    reset_date?: string
    updated_at: string
  }
}

export interface ResetUsageRequest {
  reset_requests?: boolean
  reset_storage?: boolean
  reason?: string
}

export interface CheckQuotaResponse {
  data: {
    resource: string
    requested_amount: number
    ok: boolean
    current: number
    limit: number
    remaining: number
  }
}
