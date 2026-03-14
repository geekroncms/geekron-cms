/**
 * 工作流引擎服务
 * 实现状态机定义、配置和转换逻辑
 */

import type { Bindings } from '../types/hono'

// ==================== 类型定义 ====================

export interface WorkflowState {
  id: string
  name: string
  color: string
  description?: string
}

export interface WorkflowTransition {
  from: string
  to: string
  action: string
  description?: string
}

export interface WorkflowConfig {
  id: string
  collectionId: string
  states: WorkflowState[]
  transitions: WorkflowTransition[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowAction {
  action: string
  comment?: string
  metadata?: Record<string, any>
}

export interface WorkflowHistory {
  id: string
  contentId: string
  fromState: string
  toState: string
  action: string
  comment?: string
  userId: string
  createdAt: string
}

// ==================== 默认工作流配置 ====================

/**
 * 默认的内容审核工作流
 * 状态：草稿 → 待审核 → 已发布 → 已归档
 */
export const DEFAULT_WORKFLOW: Omit<WorkflowConfig, 'id' | 'collectionId' | 'createdAt' | 'updatedAt'> = {
  states: [
    { id: 'draft', name: '草稿', color: 'gray', description: '内容正在编辑中' },
    { id: 'pending', name: '待审核', color: 'yellow', description: '等待审核通过' },
    { id: 'published', name: '已发布', color: 'green', description: '内容已发布' },
    { id: 'archived', name: '已归档', color: 'blue', description: '内容已归档' },
  ],
  transitions: [
    { from: 'draft', to: 'pending', action: 'submit', description: '提交审核' },
    { from: 'pending', to: 'published', action: 'approve', description: '审核通过' },
    { from: 'pending', to: 'draft', action: 'reject', description: '拒绝并返回草稿' },
    { from: 'published', to: 'archived', action: 'archive', description: '归档内容' },
    { from: 'archived', to: 'draft', action: 'restore', description: '恢复为草稿' },
  ],
}

// ==================== 工作流服务类 ====================

export class WorkflowService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * 获取集合的工作流配置
   */
  async getWorkflowConfig(collectionId: string): Promise<WorkflowConfig | null> {
    const config: any = await this.db
      .prepare('SELECT * FROM workflow_configs WHERE collection_id = ?')
      .bind(collectionId)
      .first()

    if (!config) {
      return null
    }

    return {
      ...config,
      states: typeof config.states === 'string' ? JSON.parse(config.states) : config.states,
      transitions:
        typeof config.transitions === 'string' ? JSON.parse(config.transitions) : config.transitions,
    }
  }

  /**
   * 创建或更新工作流配置
   */
  async saveWorkflowConfig(config: Omit<WorkflowConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowConfig> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    // 检查是否已存在该集合的工作流配置
    const existing: any = await this.db
      .prepare('SELECT id, updated_at FROM workflow_configs WHERE collection_id = ?')
      .bind(config.collectionId)
      .first()

    if (existing) {
      // 更新现有配置
      await this.db
        .prepare(
          `
        UPDATE workflow_configs 
        SET states = ?, transitions = ?, updated_at = ?
        WHERE collection_id = ?
      `,
        )
        .bind(
          JSON.stringify(config.states),
          JSON.stringify(config.transitions),
          now,
          config.collectionId,
        )
        .run()

      return {
        id: existing.id,
        collectionId: config.collectionId,
        states: config.states,
        transitions: config.transitions,
        createdAt: existing.updated_at, // 保持原有创建时间
        updatedAt: now,
      }
    } else {
      // 创建新配置
      await this.db
        .prepare(
          `
        INSERT INTO workflow_configs (id, collection_id, states, transitions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          id,
          config.collectionId,
          JSON.stringify(config.states),
          JSON.stringify(config.transitions),
          now,
          now,
        )
        .run()

      return {
        id,
        collectionId: config.collectionId,
        states: config.states,
        transitions: config.transitions,
        createdAt: now,
        updatedAt: now,
      }
    }
  }

  /**
   * 验证状态转换是否合法
   */
  canTransition(config: WorkflowConfig, fromState: string, action: string): { valid: boolean; toState?: string } {
    const transition = config.transitions.find(
      (t) => t.from === fromState && t.action === action,
    )

    if (!transition) {
      return { valid: false }
    }

    return {
      valid: true,
      toState: transition.to,
    }
  }

  /**
   * 执行工作流动作
   */
  async executeAction(
    contentId: string,
    action: WorkflowAction,
    userId: string,
  ): Promise<{
    success: boolean
    error?: string
    data?: { previousState: string; newState: string }
  }> {
    // 获取内容当前状态
    const content: any = await this.db
      .prepare('SELECT collection_id, status FROM collection_data WHERE id = ?')
      .bind(contentId)
      .first()

    if (!content) {
      return { success: false, error: 'Content not found' }
    }

    const currentState = content.status || 'draft'
    const collectionId = content.collection_id

    // 获取工作流配置
    let config = await this.getWorkflowConfig(collectionId)
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

    // 验证状态转换
    const transition = this.canTransition(config, currentState, action.action)
    if (!transition.valid) {
      return {
        success: false,
        error: `Invalid transition from ${currentState} with action ${action.action}`,
      }
    }

    const newState = transition.toState!
    const now = new Date().toISOString()

    // 更新内容状态
    const updateData: any = {
      status: newState,
      updated_at: now,
    }

    // 如果是发布操作，记录发布时间
    if (newState === 'published') {
      updateData.published_at = now
    }

    await this.db
      .prepare(
        `
      UPDATE collection_data 
      SET status = ?, updated_at = ?, published_at = COALESCE(published_at, ?)
      WHERE id = ?
    `,
      )
      .bind(newState, now, newState === 'published' ? now : null, contentId)
      .run()

    // 记录工作流历史
    const historyId = crypto.randomUUID()
    await this.db
      .prepare(
        `
      INSERT INTO workflow_history (id, content_id, from_state, to_state, action, comment, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        historyId,
        contentId,
        currentState,
        newState,
        action.action,
        action.comment || null,
        userId,
        now,
      )
      .run()

    return {
      success: true,
      data: {
        previousState: currentState,
        newState,
      },
    }
  }

  /**
   * 获取内容的工作流历史
   */
  async getWorkflowHistory(contentId: string): Promise<WorkflowHistory[]> {
    const results: any = await this.db
      .prepare(
        `
      SELECT * FROM workflow_history 
      WHERE content_id = ? 
      ORDER BY created_at DESC
    `,
      )
      .bind(contentId)
      .all()

    return (results.results || []).map((row: any) => ({
      id: row.id,
      contentId: row.content_id,
      fromState: row.from_state,
      toState: row.to_state,
      action: row.action,
      comment: row.comment,
      userId: row.user_id,
      createdAt: row.created_at,
    }))
  }

  /**
   * 获取可用转换动作
   */
  getAvailableActions(config: WorkflowConfig, currentState: string): WorkflowTransition[] {
    return config.transitions.filter((t) => t.from === currentState)
  }
}

// ==================== 工具函数 ====================

/**
 * 初始化工作流数据库表
 */
export async function initWorkflowTables(db: D1Database): Promise<void> {
  // 创建工作流配置表
  await db
    .prepare(`
    CREATE TABLE IF NOT EXISTS workflow_configs (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL UNIQUE,
      states TEXT NOT NULL,
      transitions TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
    .run()

  // 创建工作流历史表
  await db
    .prepare(`
    CREATE TABLE IF NOT EXISTS workflow_history (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
    .run()

  // 为 collection_data 表添加 status 字段（如果不存在）
  // 注意：SQLite 不支持直接添加带默认值的列，需要检查是否存在
  try {
    await db
      .prepare(`
      ALTER TABLE collection_data ADD COLUMN status TEXT DEFAULT 'draft'
    `)
      .run()
  } catch (e) {
    // 列可能已存在，忽略错误
  }

  // 为 collection_data 表添加 published_at 字段
  try {
    await db
      .prepare(`
      ALTER TABLE collection_data ADD COLUMN published_at TEXT
    `)
      .run()
  } catch (e) {
    // 列可能已存在，忽略错误
  }
}
