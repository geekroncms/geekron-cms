/**
 * 通知 API 路由
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { errors } from '../utils/errors'
import { NotificationService } from '../services/notification'

export const notificationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /notifications
 * 获取当前用户的通知列表
 */
notificationRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const unreadOnly = c.req.query('unreadOnly') === 'true'
  const limit = parseInt(c.req.query('limit') || '50')

  const notificationService = new NotificationService(c.env.DB)
  const notifications = await notificationService.getUserNotifications(userId, {
    limit,
    unreadOnly,
  })

  return c.json({
    success: true,
    data: notifications,
  })
})

/**
 * GET /notifications/unread-count
 * 获取未读通知数量
 */
notificationRoutes.get('/unread-count', async (c) => {
  const userId = c.get('userId')

  const notificationService = new NotificationService(c.env.DB)
  const count = await notificationService.getUnreadCount(userId)

  return c.json({
    success: true,
    data: { count },
  })
})

/**
 * POST /notifications/:id/read
 * 标记通知为已读
 */
notificationRoutes.post('/:id/read', async (c) => {
  const userId = c.get('userId')
  const notificationId = c.req.param('id')

  const notificationService = new NotificationService(c.env.DB)
  await notificationService.markAsRead(notificationId, userId)

  return c.json({
    success: true,
    message: '通知已标记为已读',
  })
})

/**
 * POST /notifications/read-all
 * 标记所有通知为已读
 */
notificationRoutes.post('/read-all', async (c) => {
  const userId = c.get('userId')

  const notificationService = new NotificationService(c.env.DB)
  await notificationService.markAllAsRead(userId)

  return c.json({
    success: true,
    message: '所有通知已标记为已读',
  })
})

/**
 * DELETE /notifications/:id
 * 删除通知
 */
notificationRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const notificationId = c.req.param('id')

  const notificationService = new NotificationService(c.env.DB)
  await notificationService.deleteNotification(notificationId, userId)

  return c.json({
    success: true,
    message: '通知已删除',
  })
})
