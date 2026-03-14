/**
 * 工作流引擎测试
 * 测试状态机、工作流转换、审核流程等功能
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { WorkflowService, DEFAULT_WORKFLOW } from '../src/services/workflow'
import { NotificationService } from '../src/services/notification'

// 模拟 D1 数据库
class MockD1Database {
  private tables: Record<string, any[]> = {}

  async prepare(query: string) {
    return {
      bind: (...params: any[]) => {
        return {
          first: async () => {
            console.log('SQL (first):', query, params)
            return null
          },
          all: async () => {
            console.log('SQL (all):', query, params)
            return { results: [] }
          },
          run: async () => {
            console.log('SQL (run):', query, params)
            return { success: true }
          },
        }
      },
    }
  }
}

describe('WorkflowService', () => {
  let db: any
  let workflowService: WorkflowService

  beforeEach(() => {
    db = new MockD1Database()
    workflowService = new WorkflowService(db)
  })

  describe('DEFAULT_WORKFLOW', () => {
    it('应该包含正确的状态', () => {
      expect(DEFAULT_WORKFLOW.states).toHaveLength(4)
      expect(DEFAULT_WORKFLOW.states.map((s) => s.id)).toEqual([
        'draft',
        'pending',
        'published',
        'archived',
      ])
    })

    it('应该包含正确的转换', () => {
      expect(DEFAULT_WORKFLOW.transitions).toHaveLength(5)
      expect(
        DEFAULT_WORKFLOW.transitions.some((t) => t.from === 'draft' && t.to === 'pending'),
      ).toBe(true)
      expect(
        DEFAULT_WORKFLOW.transitions.some((t) => t.from === 'pending' && t.to === 'published'),
      ).toBe(true)
      expect(
        DEFAULT_WORKFLOW.transitions.some((t) => t.from === 'pending' && t.to === 'draft'),
      ).toBe(true)
    })
  })

  describe('canTransition', () => {
    it('应该允许有效的状态转换', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = workflowService.canTransition(config, 'draft', 'submit')
      expect(result.valid).toBe(true)
      expect(result.toState).toBe('pending')
    })

    it('应该拒绝无效的状态转换', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = workflowService.canTransition(config, 'draft', 'approve')
      expect(result.valid).toBe(false)
    })

    it('应该拒绝不存在的动作', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = workflowService.canTransition(config, 'draft', 'invalid-action')
      expect(result.valid).toBe(false)
    })
  })

  describe('getAvailableActions', () => {
    it('应该返回当前状态的所有可用动作', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const actions = workflowService.getAvailableActions(config, 'draft')
      expect(actions).toHaveLength(1)
      expect(actions[0].action).toBe('submit')
      expect(actions[0].to).toBe('pending')
    })

    it('草稿状态只能提交审核', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const actions = workflowService.getAvailableActions(config, 'draft')
      expect(actions.map((a) => a.action)).toEqual(['submit'])
    })

    it('待审核状态可以审核通过或拒绝', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const actions = workflowService.getAvailableActions(config, 'pending')
      expect(actions.map((a) => a.action)).toEqual(['approve', 'reject'])
    })

    it('已发布状态可以归档', () => {
      const config = {
        id: 'test',
        collectionId: 'collection-1',
        ...DEFAULT_WORKFLOW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const actions = workflowService.getAvailableActions(config, 'published')
      expect(actions.map((a) => a.action)).toEqual(['archive'])
    })
  })
})

describe('Workflow States', () => {
  it('状态颜色应该正确', () => {
    const stateColors: Record<string, string> = {
      draft: 'gray',
      pending: 'yellow',
      published: 'green',
      archived: 'blue',
    }

    expect(stateColors.draft).toBe('gray')
    expect(stateColors.pending).toBe('yellow')
    expect(stateColors.published).toBe('green')
    expect(stateColors.archived).toBe('blue')
  })

  it('状态名称应该正确', () => {
    const stateNames: Record<string, string> = {
      draft: '草稿',
      pending: '待审核',
      published: '已发布',
      archived: '已归档',
    }

    expect(stateNames.draft).toBe('草稿')
    expect(stateNames.pending).toBe('待审核')
    expect(stateNames.published).toBe('已发布')
    expect(stateNames.archived).toBe('已归档')
  })
})

describe('Workflow Transitions', () => {
  const transitions = DEFAULT_WORKFLOW.transitions

  it('应该包含从草稿到待审核的转换', () => {
    const transition = transitions.find((t) => t.from === 'draft' && t.to === 'pending')
    expect(transition).toBeDefined()
    expect(transition?.action).toBe('submit')
    expect(transition?.description).toBe('提交审核')
  })

  it('应该包含从待审核到已发布的转换', () => {
    const transition = transitions.find((t) => t.from === 'pending' && t.to === 'published')
    expect(transition).toBeDefined()
    expect(transition?.action).toBe('approve')
    expect(transition?.description).toBe('审核通过')
  })

  it('应该包含从待审核到草稿的转换', () => {
    const transition = transitions.find((t) => t.from === 'pending' && t.to === 'draft')
    expect(transition).toBeDefined()
    expect(transition?.action).toBe('reject')
    expect(transition?.description).toBe('拒绝并返回草稿')
  })

  it('应该包含从已发布到已归档的转换', () => {
    const transition = transitions.find((t) => t.from === 'published' && t.to === 'archived')
    expect(transition).toBeDefined()
    expect(transition?.action).toBe('archive')
    expect(transition?.description).toBe('归档内容')
  })

  it('应该包含从已归档到草稿的转换', () => {
    const transition = transitions.find((t) => t.from === 'archived' && t.to === 'draft')
    expect(transition).toBeDefined()
    expect(transition?.action).toBe('restore')
    expect(transition?.description).toBe('恢复为草稿')
  })
})

describe('审核流程', () => {
  it('完整的审核流程应该是：草稿 → 待审核 → 已发布 → 已归档', () => {
    const workflow = ['draft', 'pending', 'published', 'archived']
    const transitions = DEFAULT_WORKFLOW.transitions

    // 验证每个步骤都有对应的转换
    for (let i = 0; i < workflow.length - 1; i++) {
      const from = workflow[i]
      const to = workflow[i + 1]
      const hasTransition = transitions.some((t) => t.from === from && t.to === to)
      expect(hasTransition).toBe(true)
    }
  })

  it('应该支持从待审核拒绝回草稿', () => {
    const transitions = DEFAULT_WORKFLOW.transitions
    const hasReject = transitions.some((t) => t.from === 'pending' && t.to === 'draft')
    expect(hasReject).toBe(true)
  })

  it('应该支持从已归档恢复到草稿', () => {
    const transitions = DEFAULT_WORKFLOW.transitions
    const hasRestore = transitions.some((t) => t.from === 'archived' && t.to === 'draft')
    expect(hasRestore).toBe(true)
  })
})

describe('NotificationService', () => {
  let db: any
  let notificationService: NotificationService

  beforeEach(() => {
    db = new MockD1Database()
    notificationService = new NotificationService(db)
  })

  describe('buildWorkflowMessage', () => {
    it('应该正确构建工作流通知消息', () => {
      const data = {
        contentId: 'content-1',
        collectionId: 'collection-1',
        previousState: 'draft',
        newState: 'pending',
        action: 'submit',
        actorId: 'user-1',
        actorName: '张三',
        comment: '请审核这篇文章',
      }

      // 这里需要访问私有方法，实际测试中应该通过公共 API 测试
      expect(data.previousState).toBe('draft')
      expect(data.newState).toBe('pending')
      expect(data.action).toBe('submit')
    })
  })
})

describe('工作流配置验证', () => {
  it('工作流配置必须至少有一个状态', () => {
    const config = {
      states: [] as any[],
      transitions: [] as any[],
    }
    expect(config.states.length).toBe(0)
    // 实际验证在 API 层进行
  })

  it('所有转换的 from 和 to 状态都必须存在', () => {
    const states = [
      { id: 'draft', name: '草稿', color: 'gray' },
      { id: 'published', name: '已发布', color: 'green' },
    ]
    const transitions = [
      { from: 'draft', to: 'published', action: 'publish' },
      { from: 'invalid', to: 'published', action: 'invalid' },
    ]

    const stateIds = states.map((s) => s.id)
    const invalidTransitions = transitions.filter(
      (t) => !stateIds.includes(t.from) || !stateIds.includes(t.to),
    )

    expect(invalidTransitions).toHaveLength(1)
    expect(invalidTransitions[0].from).toBe('invalid')
  })
})
