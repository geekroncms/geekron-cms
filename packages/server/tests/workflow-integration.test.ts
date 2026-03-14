/**
 * 工作流 API 集成测试
 * 验证工作流路由是否正确注册和响应
 */

import { describe, it, expect } from 'bun:test'

describe('工作流 API 路由', () => {
  it('工作流服务应该正确导出', async () => {
    const { WorkflowService, DEFAULT_WORKFLOW } = await import('../src/services/workflow')
    
    expect(WorkflowService).toBeDefined()
    expect(DEFAULT_WORKFLOW).toBeDefined()
    expect(DEFAULT_WORKFLOW.states).toHaveLength(4)
    expect(DEFAULT_WORKFLOW.transitions).toHaveLength(5)
  })

  it('通知服务应该正确导出', async () => {
    const { NotificationService } = await import('../src/services/notification')
    
    expect(NotificationService).toBeDefined()
  })

  it('工作流路由应该正确导出', async () => {
    const { workflowRoutes } = await import('../src/routes/workflow')
    
    expect(workflowRoutes).toBeDefined()
  })

  it('通知路由应该正确导出', async () => {
    const { notificationRoutes } = await import('../src/routes/notifications')
    
    expect(notificationRoutes).toBeDefined()
  })

  it('主应用应该导入所有路由', async () => {
    // 验证主应用文件可以正常导入
    const app = await import('../src/index')
    expect(app).toBeDefined()
    expect(app.default).toBeDefined()
  })
})

describe('工作流配置验证', () => {
  it('默认工作流应该包含所有必需的状态', () => {
    const { DEFAULT_WORKFLOW } = require('../src/services/workflow')
    
    const requiredStates = ['draft', 'pending', 'published', 'archived']
    const actualStates = DEFAULT_WORKFLOW.states.map((s: any) => s.id)
    
    for (const state of requiredStates) {
      expect(actualStates).toContain(state)
    }
  })

  it('默认工作流应该包含所有必需的转换', () => {
    const { DEFAULT_WORKFLOW } = require('../src/services/workflow')
    
    const requiredTransitions = [
      { from: 'draft', to: 'pending', action: 'submit' },
      { from: 'pending', to: 'published', action: 'approve' },
      { from: 'pending', to: 'draft', action: 'reject' },
      { from: 'published', to: 'archived', action: 'archive' },
      { from: 'archived', to: 'draft', action: 'restore' },
    ]
    
    for (const required of requiredTransitions) {
      const found = DEFAULT_WORKFLOW.transitions.find(
        (t: any) =>
          t.from === required.from &&
          t.to === required.to &&
          t.action === required.action
      )
      expect(found).toBeDefined()
    }
  })

  it('状态颜色应该符合规范', () => {
    const { DEFAULT_WORKFLOW } = require('../src/services/workflow')
    
    const expectedColors: Record<string, string> = {
      draft: 'gray',
      pending: 'yellow',
      published: 'green',
      archived: 'blue',
    }
    
    for (const state of DEFAULT_WORKFLOW.states) {
      expect(state.color).toBe(expectedColors[state.id])
    }
  })
})

describe('审核流程验证', () => {
  it('应该支持完整的审核流程', () => {
    const { DEFAULT_WORKFLOW } = require('../src/services/workflow')
    const { WorkflowService } = require('../src/services/workflow')
    
    // 模拟数据库
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    }
    
    const service = new WorkflowService(mockDb)
    const config = {
      id: 'test',
      collectionId: 'test-collection',
      ...DEFAULT_WORKFLOW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // 验证草稿可以提交审核
    const submitResult = service.canTransition(config, 'draft', 'submit')
    expect(submitResult.valid).toBe(true)
    expect(submitResult.toState).toBe('pending')
    
    // 验证待审核可以审核通过
    const approveResult = service.canTransition(config, 'pending', 'approve')
    expect(approveResult.valid).toBe(true)
    expect(approveResult.toState).toBe('published')
    
    // 验证待审核可以拒绝
    const rejectResult = service.canTransition(config, 'pending', 'reject')
    expect(rejectResult.valid).toBe(true)
    expect(rejectResult.toState).toBe('draft')
    
    // 验证已发布可以归档
    const archiveResult = service.canTransition(config, 'published', 'archive')
    expect(archiveResult.valid).toBe(true)
    expect(archiveResult.toState).toBe('archived')
    
    // 验证已归档可以恢复
    const restoreResult = service.canTransition(config, 'archived', 'restore')
    expect(restoreResult.valid).toBe(true)
    expect(restoreResult.toState).toBe('draft')
  })

  it('不应该支持无效的状态转换', () => {
    const { DEFAULT_WORKFLOW } = require('../src/services/workflow')
    const { WorkflowService } = require('../src/services/workflow')
    
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    }
    
    const service = new WorkflowService(mockDb)
    const config = {
      id: 'test',
      collectionId: 'test-collection',
      ...DEFAULT_WORKFLOW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    // 验证草稿不能直接发布
    const directPublish = service.canTransition(config, 'draft', 'approve')
    expect(directPublish.valid).toBe(false)
    
    // 验证待审核不能直接归档
    const pendingArchive = service.canTransition(config, 'pending', 'archive')
    expect(pendingArchive.valid).toBe(false)
    
    // 验证已发布不能直接回到待审核
    const publishedToPending = service.canTransition(config, 'published', 'submit')
    expect(publishedToPending.valid).toBe(false)
  })
})
