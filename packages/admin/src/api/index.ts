// API 客户端基础配置
export { default as api } from './client'

// 认证模块
export { authApi, login, logout, isAuthenticated, getToken, getTenantId, getUserId } from './auth'
export type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  AuthMeResponse,
  TenantsListResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
} from './types'

// 租户管理模块
export { tenantApi } from './tenants'
export type {
  Tenant,
  CreateTenantRequest,
  UpdateTenantRequest,
  QuotasResponse,
} from './types'

// 用户管理模块
export { userApi } from './users'
export type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  InviteUserRequest,
  ChangePasswordRequest,
  UsersListResponse,
} from './types'

// 集合管理模块
export { collectionApi } from './collections'
export type {
  Collection,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddFieldRequest,
  CollectionsListResponse,
  Field,
  FieldType,
} from './types'

// 数据管理模块
export { dataApi } from './data'
export type {
  DataEntry,
  CreateDataRequest,
  UpdateDataRequest,
  DataListResponse,
  QueryParams,
} from './types'

// API Key 管理模块
export { apiKeyApi } from './apiKeys'
export type {
  ApiKey,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeysListResponse,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  ApiKeyUsageResponse,
  ApiKeyUsage,
} from './types'

// 配额管理模块
export { quotaApi } from './quotas'
export type {
  QuotaStatusResponse,
  ResetUsageRequest,
  CheckQuotaResponse,
  QuotaConfig,
  UsageStats,
} from './types'

// 通用类型
export type {
  ApiResponse,
  Pagination,
  ApiError,
  UserInfo,
  TenantInfo,
  TenantItem,
  QuotaUsage,
} from './types'
