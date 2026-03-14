import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { z } from 'zod'
import { errors } from '../utils/errors'
import { VersionService } from '../services/version-service'

export const versionRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ==================== Schema Definitions ====================

const createVersionSchema = z.object({
  dataId: z.string().uuid('Invalid data ID'),
  collectionId: z.string().uuid('Invalid collection ID'),
  data: z.record(z.any()),
  changeSummary: z.string().optional(),
  changeType: z.enum(['create', 'update', 'rollback', 'auto_save']).optional(),
})

const rollbackSchema = z.object({
  versionId: z.string().uuid('Invalid version ID'),
  changeSummary: z.string().optional(),
})

const compareVersionsSchema = z.object({
  versionId1: z.string().uuid('Invalid version ID 1'),
  versionId2: z.string().uuid('Invalid version ID 2'),
})

const updateAutoVersionConfigSchema = z.object({
  collectionId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
  autoSaveInterval: z.number().int().positive().optional(),
  maxVersions: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
})

// ==================== Helper Functions ====================

function getVersionService(c: any): VersionService {
  return new VersionService(c.env.DB)
}

// ==================== Version CRUD Routes ====================

/**
 * GET /versions/:dataId/history
 * 获取内容版本历史
 */
versionRoutes.get('/:dataId/history', async (c) => {
  const tenantId = c.get('tenantId')
  const dataId = c.req.param('dataId')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const versionService = getVersionService(c)
  const { versions, total } = await versionService.getVersionHistory(dataId, tenantId, limit, offset)

  return c.json({
    success: true,
    data: {
      versions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + versions.length < total,
      },
    },
  })
})

/**
 * GET /versions/:versionId
 * 获取指定版本详情
 */
versionRoutes.get('/version/:versionId', async (c) => {
  const tenantId = c.get('tenantId')
  const versionId = c.req.param('versionId')

  const versionService = getVersionService(c)
  const version = await versionService.getVersion(versionId, tenantId)

  if (!version) {
    throw errors.notFound('Version')
  }

  return c.json({
    success: true,
    data: version,
  })
})

/**
 * GET /versions/:dataId/current
 * 获取当前版本
 */
versionRoutes.get('/:dataId/current', async (c) => {
  const tenantId = c.get('tenantId')
  const dataId = c.req.param('dataId')

  const versionService = getVersionService(c)
  const currentVersion = await versionService.getCurrentVersion(dataId, tenantId)

  if (!currentVersion) {
    throw errors.notFound('Current version')
  }

  return c.json({
    success: true,
    data: currentVersion,
  })
})

/**
 * POST /versions
 * 创建新版本 (手动创建)
 */
versionRoutes.post('/', zValidator('json', createVersionSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const userEmail = c.get('userEmail')
  const { dataId, collectionId, data, changeSummary, changeType = 'update' } = c.req.valid('json')

  // 验证数据是否存在
  const existingData: any = await c.env.DB.prepare(
    'SELECT id FROM collection_data WHERE id = ? AND tenant_id = ?',
  )
    .bind(dataId, tenantId)
    .first()

  if (!existingData) {
    throw errors.notFound('Data entry')
  }

  const versionService = getVersionService(c)
  const version = await versionService.createVersion({
    dataId,
    collectionId,
    tenantId,
    data,
    changeSummary,
    changeType,
    userId,
    userEmail,
  })

  return c.json(
    {
      success: true,
      data: version,
      message: 'Version created successfully',
    },
    201,
  )
})

/**
 * POST /versions/rollback
 * 版本回滚
 */
versionRoutes.post('/rollback', zValidator('json', rollbackSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const { versionId, changeSummary } = c.req.valid('json')

  const versionService = getVersionService(c)

  try {
    const rollbackVersion = await versionService.rollbackToVersion({
      versionId,
      changeSummary,
      userId,
    })

    return c.json({
      success: true,
      data: rollbackVersion,
      message: 'Successfully rolled back to version',
    })
  } catch (error: any) {
    throw errors.badRequest(error.message || 'Rollback failed')
  }
})

/**
 * GET /versions/compare
 * 比较两个版本
 */
versionRoutes.get('/compare', zValidator('query', compareVersionsSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const { versionId1, versionId2 } = c.req.valid('query')

  const versionService = getVersionService(c)

  try {
    const diff = await versionService.compareVersions(versionId1, versionId2, tenantId)

    return c.json({
      success: true,
      data: {
        versionId1,
        versionId2,
        diff,
      },
    })
  } catch (error: any) {
    throw errors.badRequest(error.message || 'Version comparison failed')
  }
})

/**
 * GET /versions/:versionId/summary
 * 获取版本变更摘要
 */
versionRoutes.get('/version/:versionId/summary', async (c) => {
  const tenantId = c.get('tenantId')
  const versionId = c.req.param('versionId')

  const versionService = getVersionService(c)
  const summary = await versionService.getVersionChangeSummary(versionId, tenantId)

  if (summary === null) {
    throw errors.notFound('Version')
  }

  return c.json({
    success: true,
    data: {
      versionId,
      summary,
    },
  })
})

// ==================== Auto Version Control Routes ====================

/**
 * GET /versions/auto-config
 * 获取自动版本控制配置
 */
versionRoutes.get('/auto-config', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.query('collectionId')

  const versionService = getVersionService(c)
  const config = await versionService.getAutoVersionConfig(tenantId, collectionId || undefined)

  return c.json({
    success: true,
    data: config,
  })
})

/**
 * PUT /versions/auto-config
 * 更新自动版本控制配置
 */
versionRoutes.put('/auto-config', zValidator('json', updateAutoVersionConfigSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const config = c.req.valid('json')

  const versionService = getVersionService(c)
  await versionService.updateAutoVersionConfig(tenantId, config)

  return c.json({
    success: true,
    message: 'Auto version config updated successfully',
  })
})

/**
 * POST /versions/cleanup
 * 清理过期版本 (管理员操作)
 */
versionRoutes.post('/cleanup', async (c) => {
  const tenantId = c.get('tenantId')
  const retentionDays = parseInt(c.req.query('retentionDays') || '90')
  const maxVersions = parseInt(c.req.query('maxVersions') || '50')

  const versionService = getVersionService(c)
  const deletedCount = await versionService.cleanupOldVersions(tenantId, retentionDays, maxVersions)

  return c.json({
    success: true,
    data: {
      deletedCount,
      retentionDays,
      maxVersions,
    },
    message: `Cleaned up ${deletedCount} old versions`,
  })
})

// ==================== Version Statistics ====================

/**
 * GET /versions/stats
 * 获取版本统计信息
 */
versionRoutes.get('/stats', async (c) => {
  const tenantId = c.get('tenantId')
  const collectionId = c.req.query('collectionId')

  let baseQuery = 'WHERE tenant_id = ?'
  const params: any[] = [tenantId]

  if (collectionId) {
    baseQuery += ' AND collection_id = ?'
    params.push(collectionId)
  }

  // 总版本数
  const totalResult: any = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM content_versions ${baseQuery}`,
  )
    .bind(...params)
    .first()

  // 今天创建的版本数
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayResult: any = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM content_versions ${baseQuery} AND created_at >= ?`,
  )
    .bind(...params, todayStart.toISOString())
    .first()

  // 最大的版本号
  const maxVersionResult: any = await c.env.DB.prepare(
    `SELECT MAX(version_number) as maxVersion FROM content_versions ${baseQuery}`,
  )
    .bind(...params)
    .first()

  return c.json({
    success: true,
    data: {
      totalVersions: totalResult?.count || 0,
      versionsToday: todayResult?.count || 0,
      maxVersionNumber: maxVersionResult?.maxVersion || 0,
    },
  })
})
