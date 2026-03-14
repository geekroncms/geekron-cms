import { describe, expect, test } from 'bun:test'
import {
  validateLogin,
  validateUsername,
  validatePassword,
  quickValidate,
  type LoginCredentials,
} from '../src/utils/login-validator'

describe('Login Validator - 用户名验证', () => {
  test('应该拒绝空用户名', () => {
    const result = validateUsername('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('用户名不能为空')
  })

  test('应该拒绝 null 用户名', () => {
    const result = validateUsername(null as any)
    expect(result.valid).toBe(false)
  })

  test('应该拒绝只包含空格的用户名', () => {
    const result = validateUsername('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('用户名不能只包含空格')
  })

  test('应该拒绝长度小于 3 的用户名', () => {
    const result = validateUsername('ab')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('用户名长度至少为 3 个字符')
  })

  test('应该接受长度为 3 的用户名', () => {
    const result = validateUsername('abc')
    expect(result.valid).toBe(true)
  })

  test('应该拒绝长度超过 50 的用户名', () => {
    const result = validateUsername('a'.repeat(51))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('用户名长度不能超过 50 个字符')
  })

  test('应该拒绝包含特殊字符的用户名', () => {
    const result = validateUsername('user@name')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('用户名只能包含字母、数字、下划线和连字符')
  })

  test('应该接受包含下划线和连字符的用户名', () => {
    const result = validateUsername('user_name-123')
    expect(result.valid).toBe(true)
  })
})

describe('Login Validator - 密码验证', () => {
  test('应该拒绝空密码', () => {
    const result = validatePassword('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('密码不能为空')
  })

  test('应该拒绝 null 密码', () => {
    const result = validatePassword(null as any)
    expect(result.valid).toBe(false)
  })

  test('应该拒绝长度小于 6 的密码', () => {
    const result = validatePassword('12345')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('密码长度至少为 6 位')
  })

  test('应该接受长度为 6 的密码', () => {
    const result = validatePassword('123456')
    expect(result.valid).toBe(true)
  })

  test('应该接受长度大于 6 的密码', () => {
    const result = validatePassword('password123')
    expect(result.valid).toBe(true)
  })

  test('应该拒绝长度超过 100 的密码', () => {
    const result = validatePassword('a'.repeat(101))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('密码长度不能超过 100 位')
  })
})

describe('Login Validator - 完整登录验证', () => {
  test('应该通过有效凭据', () => {
    const credentials: LoginCredentials = {
      username: 'testuser',
      password: 'password123',
    }
    const result = validateLogin(credentials)
    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('应该拒绝空用户名和空密码', () => {
    const credentials: LoginCredentials = {
      username: '',
      password: '',
    }
    const result = validateLogin(credentials)
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('应该拒绝空用户名', () => {
    const credentials: LoginCredentials = {
      username: '',
      password: 'password123',
    }
    const result = validateLogin(credentials)
    expect(result.success).toBe(false)
    expect(result.errors).toContain('用户名不能为空')
  })

  test('应该拒绝短密码', () => {
    const credentials: LoginCredentials = {
      username: 'testuser',
      password: '123',
    }
    const result = validateLogin(credentials)
    expect(result.success).toBe(false)
    expect(result.errors).toContain('密码长度至少为 6 位')
  })

  test('应该返回所有错误', () => {
    const credentials: LoginCredentials = {
      username: '',
      password: '123',
    }
    const result = validateLogin(credentials)
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Login Validator - 快速验证', () => {
  test('应该通过有效凭据', () => {
    const result = quickValidate('testuser', 'password123')
    expect(result.valid).toBe(true)
  })

  test('应该拒绝空用户名', () => {
    const result = quickValidate('', 'password123')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('用户名不能为空')
  })

  test('应该拒绝短密码', () => {
    const result = quickValidate('testuser', '123')
    expect(result.valid).toBe(false)
    expect(result.message).toBe('密码长度至少为 6 位')
  })

  test('应该拒绝空格用户名', () => {
    const result = quickValidate('   ', 'password123')
    expect(result.valid).toBe(false)
  })
})
