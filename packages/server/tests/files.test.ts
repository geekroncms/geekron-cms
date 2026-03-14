#!/usr/bin/env bun
/**
 * 文件管理系统测试脚本
 * 用法：bun run test:files
 */

import { expect, test, describe } from 'bun:test'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1'
const TEST_TENANT_ID = 'test-tenant-' + Date.now()
const TEST_USER_ID = 'test-user-' + Date.now()

describe('文件管理系统', () => {
  let authToken: string
  let uploadedFileId: string

  // 获取认证 Token
  beforeAll(async () => {
    // 这里应该先创建测试租户和用户
    // 简化处理，假设有有效的 token
    authToken = 'test-token'
  })

  describe('文件上传', () => {
    test('单文件上传', async () => {
      const formData = new FormData()
      const testFile = new Blob(['test content'], { type: 'text/plain' })
      formData.append('file', testFile, 'test.txt')

      const response = await fetch(`${API_BASE_URL}/files/upload?folder=test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('url')
      expect(data.name).toBe('test.txt')
      
      uploadedFileId = data.id
    })

    test('批量文件上传', async () => {
      const formData = new FormData()
      
      // 添加多个文件
      for (let i = 0; i < 3; i++) {
        const testFile = new Blob([`test content ${i}`], { type: 'text/plain' })
        formData.append('files', testFile, `test-${i}.txt`)
      }

      const response = await fetch(`${API_BASE_URL}/files/upload/batch?folder=test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('uploaded')
      expect(data.uploaded.length).toBeGreaterThan(0)
    })

    test('上传超大文件应该失败', async () => {
      const formData = new FormData()
      // 创建 60MB 的文件 (超过 50MB 限制)
      const largeFile = new Blob([new Array(60 * 1024 * 1024).fill('x').join('')], { 
        type: 'text/plain' 
      })
      formData.append('file', largeFile, 'large.txt')

      const response = await fetch(`${API_BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      expect(response.status).toBe(400)
    })

    test('上传不允许的文件类型应该失败', async () => {
      const formData = new FormData()
      const executableFile = new Blob(['fake executable'], { type: 'application/x-executable' })
      formData.append('file', executableFile, 'malicious.exe')

      const response = await fetch(`${API_BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      expect(response.status).toBe(400)
    })
  })

  describe('文件列表', () => {
    test('获取文件列表', async () => {
      const response = await fetch(`${API_BASE_URL}/files`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)
    })

    test('分页获取文件列表', async () => {
      const response = await fetch(`${API_BASE_URL}/files?page=1&limit=10`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('pagination')
      expect(data.pagination).toHaveProperty('page')
      expect(data.pagination).toHaveProperty('limit')
      expect(data.pagination).toHaveProperty('total')
    })

    test('按类型筛选文件', async () => {
      const response = await fetch(`${API_BASE_URL}/files?type=image`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      // 所有返回的文件应该是图片类型
      data.data.forEach((file: any) => {
        expect(file.mime_type).toStartWith('image/')
      })
    })
  })

  describe('文件信息', () => {
    test('获取单个文件信息', async () => {
      const response = await fetch(`${API_BASE_URL}/files/${uploadedFileId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBe(uploadedFileId)
      expect(data).toHaveProperty('name')
      expect(data).toHaveProperty('url')
    })

    test('获取不存在的文件应该返回 404', async () => {
      const response = await fetch(`${API_BASE_URL}/files/non-existent-id`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(404)
    })
  })

  describe('文件下载', () => {
    test('下载文件', async () => {
      const response = await fetch(`${API_BASE_URL}/files/${uploadedFileId}/download`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
    })
  })

  describe('图片处理', () => {
    let imageFileId: string

    beforeAll(async () => {
      // 上传测试图片
      const formData = new FormData()
      // 创建一个简单的 PNG 图片
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82,
      ])
      const testImage = new Blob([pngHeader], { type: 'image/png' })
      formData.append('file', testImage, 'test.png')

      const response = await fetch(`${API_BASE_URL}/files/upload?folder=test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      const data = await response.json()
      imageFileId = data.id
    })

    test('生成缩略图', async () => {
      const response = await fetch(
        `${API_BASE_URL}/files/${imageFileId}/thumbnail?width=100&height=100`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toStartWith('image/')
    })

    test('图片变换', async () => {
      const response = await fetch(`${API_BASE_URL}/files/${imageFileId}/transform`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operations: [
            { type: 'resize', width: 800, height: 600 },
          ],
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('url')
      expect(data.operations).toBeDefined()
    })

    test('图片优化', async () => {
      const response = await fetch(
        `${API_BASE_URL}/files/${imageFileId}/optimize?quality=80&format=webp`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('id')
      expect(data.format).toBe('webp')
      expect(data.quality).toBe(80)
    })
  })

  describe('文件更新', () => {
    test('更新文件元数据', async () => {
      const response = await fetch(`${API_BASE_URL}/files/${uploadedFileId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'updated-name.txt',
          folder: 'new-folder',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.name).toBe('updated-name.txt')
    })
  })

  describe('文件删除', () => {
    test('删除文件', async () => {
      const response = await fetch(`${API_BASE_URL}/files/${uploadedFileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('message')
    })

    test('删除不存在的文件应该返回 404', async () => {
      const response = await fetch(`${API_BASE_URL}/files/non-existent-id`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(404)
    })
  })
})
