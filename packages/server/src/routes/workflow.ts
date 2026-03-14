/**
 * 工作流 API 路由
 * 提供工作流配置、状态转换和历史记录管理
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { errors } from '../utils/errors'
import {
  WorkflowService,
  DEFAULT_WORKFLOW,
  initWorkflowTables,
} from '../services/workflow'

export const workflowRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==================== Schema Definitions ====================

const workflowActionSchema = z.object({
  action: z.string(),
  comment: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

const workflowConfigSchema = z.object({
  collectionId: z.string().uuid(),
  states: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      description: z.string().optional(),
    }),
  ),
  transitions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      action: z.string(),
      description: z.string().optional(),
    }),
  ),
})

// ==================== Middleware: Initialize Workflow Tables ====================

workflowRoutes.use('*', async (c, next) => {
  // 确保工作流表已初始化
  await initWorkflowTables(c.env.DB)
  await next()
})

// ==================== Workflow Configuration Routes ====================

/**
 * GET /workflow/config/:collectionId
 * 获取集合的工作流配置
 */
workflowRoutes.get('/config/:collectionId', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')

  // 验证集合属于当前租户
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  const workflowService = new WorkflowService(c.env.DB)
  const config = await workflowService.getWorkflowConfig(collectionId)

  if (!config) {
    // 返回默认工作流配置
    return c.json({
      success: true,
      data: {
        collectionId,
        ...DEFAULT_WORKFLOW,
      },
    })
  }

  return c.json({
    success: true,
    data: config,
  })
})

/**
 * PUT /workflow/config
 * 创建或更新工作流配置
 */
workflowRoutes.put('/config', zValidator('json', workflowConfigSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const { collectionId, states, transitions } = c.req.valid('json')

  // 验证集合属于当前租户
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  // 验证工作流配置的有效性
  if (states.length === 0) {
    throw errors.invalidInput({ states: '至少需要一个状态' })
  }

  // 验证所有转换的 from 和 to 状态都存在
  const stateIds = states.map((s) => s.id)
  for (const transition of transitions) {
    if (!stateIds.includes(transition.from)) {
      throw errors.invalidInput({
        transitions: `无效的 from 状态：${transition.from}`,
      })
    }
    if (!stateIds.includes(transition.to)) {
      throw errors.invalidInput({
        transitions: `无效的 to 状态：${transition.to}`,
      })
    }
  }

  const workflowService = new WorkflowService(c.env.DB)
  const config = await workflowService.saveWorkflowConfig({
    collectionId,
    states,
    transitions,
  })

  return c.json({
    success: true,
    data: config,
    message: '工作流配置已保存',
  })
})

// ==================== Workflow Execution Routes ====================

/**
 * POST /workflow/:collectionId/:contentId/execute
 * 执行工作流动作（状态转换）
 */
workflowRoutes.post(
  '/:collectionId/:contentId/execute',
  zValidator('json', workflowActionSchema),
  async (c) => {
    const tenantId = c.get('tenantId')
    const userId = c.get('userId')
    const collectionId = c.req.param('collectionId')
    const contentId = c.req.param('contentId')
    const { action, comment, metadata } = c.req.valid('json')

    // 验证内容属于当前租户和集合
    const content: any = await c.env.DB.prepare(
      'SELECT id, status FROM collection_data WHERE id = ? AND collection_id = ? AND tenant_id = ?',
    )
      .bind(contentId, collectionId, tenantId)
      .first()

    if (!content) {
      throw errors.notFound('Content')
    }

    const workflowService = new WorkflowService(c.env.DB)
    const result = await workflowService.executeAction(
      contentId,
      { action, comment, metadata },
      userId,
    )

    if (!result.success) {
      throw errors.badRequest(result.error || '工作流动作执行失败')
    }

    // TODO: 触发通知机制
    // await notifyWorkflowChange(contentId, result.data!, userId, c.env)

    return c.json({
      success: true,
      data: {
        id: contentId,
        previousState: result.data!.previousState,
        newState: result.data!.newState,
        action,
        comment,
      },
      message: '工作流动作执行成功',
    })
  },
)

/**
 * GET /workflow/:collectionId/:contentId/history
 * 获取内容的工作流历史
 */
workflowRoutes.get('/:collectionId/:contentId/history', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')
  const contentId = c.req.param('contentId')

  // 验证内容属于当前租户和集合
  const content: any = await c.env.DB.prepare(
    'SELECT id FROM collection_data WHERE id = ? AND collection_id = ? AND tenant_id = ?',
  )
    .bind(contentId, collectionId, tenantId)
    .first()

  if (!content) {
    throw errors.notFound('Content')
  }

  const workflowService = new WorkflowService(c.env.DB)
  const history = await workflowService.getWorkflowHistory(contentId)

  return c.json({
    success: true,
    data: history,
  })
})

/**
 * GET /workflow/:collectionId/:contentId/available-actions
 * 获取内容当前可用的转换动作
 */
workflowRoutes.get('/:collectionId/:contentId/available-actions', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')
  const contentId = c.req.param('contentId')

  // 验证内容属于当前租户和集合
  const content: any = await c.env.DB.prepare(
    'SELECT id, status FROM collection_data WHERE id = ? AND collection_id = ? AND tenant_id = ?',
  )
    .bind(contentId, collectionId, tenantId)
    .first()

  if (!content) {
    throw errors.notFound('Content')
  }

  const workflowService = new WorkflowService(c.env.DB)
  let config = await workflowService.getWorkflowConfig(collectionId)

  if (!config) {
    // 使用默认工作流
    config = {
      id: 'default',
      collectionId,
      ...DEFAULT_WORKFLOW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const currentState = content.status || 'draft'
  const availableActions = workflowService.getAvailableActions(config, currentState)

  return c.json({
    success: true,
    data: {
      currentState,
      availableActions,
    },
  })
})

// ==================== Workflow Statistics Routes ====================

/**
 * GET /workflow/:collectionId/stats
 * 获取集合的工作流统计信息
 */
workflowRoutes.get('/:collectionId/stats', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.param('collectionId')

  // 验证集合属于当前租户
  const collection: any = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND tenant_id = ?',
  )
    .bind(collectionId, tenantId)
    .first()

  if (!collection) {
    throw errors.notFound('Collection')
  }

  // 统计各状态的内容数量
  const stats: any = await c.env.DB.prepare(
    `
    SELECT 
      status,
      COUNT(*) as count
    FROM collection_data
    WHERE collection_id = ? AND tenant_id = ?
    GROUP BY status
  `,
  )
    .bind(collectionId, tenantId)
    .all()

  const statusCounts: Record<string, number> = {}
  let total = 0

  for (const row of stats.results || []) {
    const status = row.status || 'draft'
    statusCounts[status] = row.count
    total += row.count
  }

  // 获取最近的工作流活动
  const recentActivity: any = await c.env.DB.prepare(
    `
    SELECT 
      wh.*,
      cd.data as content_data
    FROM workflow_history wh
    JOIN collection_data cd ON wh.content_id = cd.id
    WHERE cd.collection_id = ? AND cd.tenant_id = ?
    ORDER BY wh.created_at DESC
    LIMIT 10
  `,
  )
    .bind(collectionId, tenantId)
    .all()

  return c.json({
    success: true,
    data: {
      total,
      byStatus: statusCounts,
      recentActivity: (recentActivity.results || []).map((row: any) => ({
        id: row.id,
        contentId: row.content_id,
        fromState: row.from_state,
        toState: row.to_state,
        action: row.action,
        comment: row.comment,
        userId: row.user_id,
        createdAt: row.created_at,
      })),
    },
  })
})
