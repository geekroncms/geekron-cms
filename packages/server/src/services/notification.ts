/**
 * 通知服务
 * 提供工作流变更通知的基础功能
 */

import type { Bindings } from '../types/hono'

export interface Notification {
  id: string
  type: 'workflow' | 'system' | 'mention'
  title: string
  message: string
  userId: string
  metadata?: Record<string, any>
  read: boolean
  createdAt: string
}

export interface WorkflowNotificationData {
  contentId: string
  collectionId: string
  collectionName?: string
  previousState: string
  newState: string
  action: string
  actorId: string
  actorName?: string
  comment?: string
}

/**
 * 通知服务类
 */
export class NotificationService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * 初始化通知表
   */
  async initTables(): Promise<void> {
    await this.db
      .prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        user_id TEXT NOT NULL,
        metadata TEXT,
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
      .run()

    // 创建索引
    await this.db
      .prepare(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user 
      ON notifications(user_id, created_at DESC)
    `)
      .run()

    await this.db
      .prepare(`
      CREATE INDEX IF NOT EXISTS idx_notifications_read 
      ON notifications(user_id, read)
    `)
      .run()
  }

  /**
   * 创建工作流变更通知
   */
  async createWorkflowNotification(
    userId: string,
    data: WorkflowNotificationData,
  ): Promise<Notification> {
    await this.initTables()

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const notification: Notification = {
      id,
      type: 'workflow',
      title: `内容状态变更：${data.action}`,
      message: this.buildWorkflowMessage(data),
      userId,
      metadata: data,
      read: false,
      createdAt: now,
    }

    await this.db
      .prepare(
        `
      INSERT INTO notifications (id, type, title, message, user_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        id,
        notification.type,
        notification.title,
        notification.message,
        userId,
        JSON.stringify(data),
        now,
      )
      .run()

    return notification
  }

  /**
   * 构建工作流通知消息
   */
  private buildWorkflowMessage(data: WorkflowNotificationData): string {
    const stateNames: Record<string, string> = {
      draft: '草稿',
      pending: '待审核',
      published: '已发布',
      archived: '已归档',
    }

    const actionNames: Record<string, string> = {
      submit: '提交审核',
      approve: '审核通过',
      reject: '拒绝',
      archive: '归档',
      restore: '恢复',
    }

    const fromState = stateNames[data.previousState] || data.previousState
    const toState = stateNames[data.newState] || data.newState
    const action = actionNames[data.action] || data.action

    let message = `${data.actorName || '用户'} ${action}，状态从 ${fromState} 变为 ${toState}`

    if (data.comment) {
      message += `。备注：${data.comment}`
    }

    return message
  }

  /**
   * 获取用户的通知列表
   */
  async getUserNotifications(
    userId: string,
    options: { limit?: number; unreadOnly?: boolean } = {},
  ): Promise<Notification[]> {
    await this.initTables()

    const { limit = 50, unreadOnly = false } = options

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
    `

    const params: any[] = [userId]

    if (unreadOnly) {
      query += ` AND read = 0`
    }

    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const results: any = await this.db.prepare(query).bind(...params).all()

    return (results.results || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      userId: row.user_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      read: row.read === 1,
      createdAt: row.created_at,
    }))
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db
      .prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE id = ? AND user_id = ?
    `)
      .bind(notificationId, userId)
      .run()
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE user_id = ?
    `)
      .bind(userId)
      .run()
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result: any = await this.db
      .prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND read = 0
    `)
      .bind(userId)
      .first()

    return result?.count || 0
  }

  /**
   * 删除通知
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.db
      .prepare(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `)
      .bind(notificationId, userId)
      .run()
  }
}

/**
 * 通知工作流变更（便捷函数）
 */
export async function notifyWorkflowChange(
  contentId: string,
  data: { previousState: string; newState: string; action: string },
  actorId: string,
  env: Bindings,
  collectionName?: string,
  comment?: string,
): Promise<void> {
  const notificationService = new NotificationService(env.DB)

  // 这里可以添加逻辑来确定需要通知哪些用户
  // 例如：通知所有有审核权限的用户
  // 目前简化为只通知内容创建者（实际应该根据角色和权限来确定）

  // TODO: 实现更智能的通知目标用户选择
  // 1. 如果是提交审核，通知所有审核员
  // 2. 如果是审核通过/拒绝，通知内容创建者
  // 3. 如果是归档，通知相关编辑人员
}
