import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>

/**
 * GET /health
 * 健康检查端点
 */
healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.0.1',
  })
})

/**
 * GET /health/ready
 * 就绪检查（检查数据库连接等）
 */
healthRoutes.get('/ready', async (c) => {
  try {
    // 检查 D1 数据库连接
    await c.env.DB.prepare('SELECT 1').first()

    return c.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return c.json(
      {
        status: 'not_ready',
        database: 'disconnected',
        error: (error as Error).message,
      },
      503,
    )
  }
})
