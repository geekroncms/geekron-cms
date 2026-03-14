/**
 * 登录验证工具函数
 * Geekron CMS - 用户登录验证模块
 */

export interface LoginValidationResult {
  success: boolean
  errors: string[]
}

export interface LoginCredentials {
  username: string
  password: string
}

/**
 * 验证用户名
 * 规则：不能为空，不能只包含空格
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: '用户名不能为空' }
  }

  const trimmed = username.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: '用户名不能只包含空格' }
  }

  if (trimmed.length < 3) {
    return { valid: false, error: '用户名长度至少为 3 个字符' }
  }

  if (trimmed.length > 50) {
    return { valid: false, error: '用户名长度不能超过 50 个字符' }
  }

  // 只允许字母、数字、下划线、连字符
  const validPattern = /^[a-zA-Z0-9_-]+$/
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: '用户名只能包含字母、数字、下划线和连字符',
    }
  }

  return { valid: true }
}

/**
 * 验证密码
 * 规则：长度≥6 位
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '密码不能为空' }
  }

  if (password.length < 6) {
    return { valid: false, error: '密码长度至少为 6 位' }
  }

  if (password.length > 100) {
    return { valid: false, error: '密码长度不能超过 100 位' }
  }

  return { valid: true }
}

/**
 * 登录验证主函数
 * 验证用户名和密码
 */
export function validateLogin(credentials: LoginCredentials): LoginValidationResult {
  const errors: string[] = []

  // 验证用户名
  const usernameResult = validateUsername(credentials.username)
  if (!usernameResult.valid && usernameResult.error) {
    errors.push(usernameResult.error)
  }

  // 验证密码
  const passwordResult = validatePassword(credentials.password)
  if (!passwordResult.valid && passwordResult.error) {
    errors.push(passwordResult.error)
  }

  return {
    success: errors.length === 0,
    errors,
  }
}

/**
 * 简化版验证函数（快速验证）
 * 只检查基本规则：用户名不为空，密码长度≥6
 */
export function quickValidate(username: string, password: string): {
  valid: boolean
  message?: string
} {
  // 验证用户名不为空
  if (!username || username.trim().length === 0) {
    return { valid: false, message: '用户名不能为空' }
  }

  // 验证密码长度≥6 位
  if (!password || password.length < 6) {
    return { valid: false, message: '密码长度至少为 6 位' }
  }

  return { valid: true }
}
