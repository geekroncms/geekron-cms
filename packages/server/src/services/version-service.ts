import type { D1Database } from '@cloudflare/workers-types'

/**
 * 版本管理服务
 * 负责内容的版本创建、保存、比较、回滚等功能
 */

export interface VersionData {
  id: string
  dataId: string
  collectionId: string
  tenantId: string
  versionNumber: number
  data: Record<string, any>
  changeSummary?: string
  changeType: 'create' | 'update' | 'rollback' | 'auto_save'
  createdBy?: string
  createdByEmail?: string
  isCurrent: boolean
  parentVersionId?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface VersionDiff {
  added: Record<string, any>
  removed: Record<string, any>
  modified: Record<string, { old: any; new: any }>
  unchanged: string[]
}

export interface CreateVersionOptions {
  dataId: string
  collectionId: string
  tenantId: string
  data: Record<string, any>
  changeSummary?: string
  changeType?: 'create' | 'update' | 'rollback' | 'auto_save'
  userId?: string
  userEmail?: string
  parentVersionId?: string
}

export interface RollbackOptions {
  versionId: string
  changeSummary?: string
  userId?: string
}

export class VersionService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  /**
   * 创建新版本
   * 每次内容变更时调用此方法创建版本快照
   */
  async createVersion(options: CreateVersionOptions): Promise<VersionData> {
    const {
      dataId,
      collectionId,
      tenantId,
      data,
      changeSummary = '',
      changeType = 'update',
      userId,
      userEmail,
      parentVersionId,
    } = options

    // 获取当前最大版本号
    const maxVersionResult: any = await this.db
      .prepare(
        `
        SELECT MAX(version_number) as maxVersion 
        FROM content_versions 
        WHERE data_id = ? AND tenant_id = ?
      `,
      )
      .bind(dataId, tenantId)
      .first()

    const currentVersionNumber = maxVersionResult?.maxVersion || 0
    const newVersionNumber = currentVersionNumber + 1

    // 标记所有旧版本为非当前版本
    await this.db
      .prepare(
        `
        UPDATE content_versions 
        SET is_current = 0 
        WHERE data_id = ? AND tenant_id = ?
      `,
      )
      .bind(dataId, tenantId)
      .run()

    // 创建新版本
    const versionId = crypto.randomUUID()
    const now = new Date().toISOString()

    await this.db
      .prepare(
        `
        INSERT INTO content_versions 
        (id, data_id, collection_id, tenant_id, version_number, data, change_summary, change_type, 
         created_by, created_by_email, is_current, parent_version_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
      )
      .bind(
        versionId,
        dataId,
        collectionId,
        tenantId,
        newVersionNumber,
        JSON.stringify(data),
        changeSummary || null,
        changeType,
        userId || null,
        userEmail || null,
        parentVersionId || null,
        now,
      )
      .run()

    return {
      id: versionId,
      dataId,
      collectionId,
      tenantId,
      versionNumber: newVersionNumber,
      data,
      changeSummary: changeSummary || '',
      changeType,
      createdBy: userId,
      createdByEmail: userEmail,
      isCurrent: true,
      parentVersionId,
      createdAt: now,
    }
  }

  /**
   * 获取内容的所有版本历史
   */
  async getVersionHistory(
    dataId: string,
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ versions: VersionData[]; total: number }> {
    // 获取总数
    const totalResult: any = await this.db
      .prepare(
        `
        SELECT COUNT(*) as count 
        FROM content_versions 
        WHERE data_id = ? AND tenant_id = ?
      `,
      )
      .bind(dataId, tenantId)
      .first()

    const total = totalResult?.count || 0

    // 获取版本列表 (倒序，最新版本在前)
    const results: any = await this.db
      .prepare(
        `
        SELECT * FROM content_versions 
        WHERE data_id = ? AND tenant_id = ?
        ORDER BY version_number DESC
        LIMIT ? OFFSET ?
      `,
      )
      .bind(dataId, tenantId, limit, offset)
      .all()

    const versions = (results.results || []).map((row: any) => ({
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    }))

    return { versions, total }
  }

  /**
   * 获取指定版本
   */
  async getVersion(versionId: string, tenantId: string): Promise<VersionData | null> {
    const version: any = await this.db
      .prepare(
        `
        SELECT * FROM content_versions 
        WHERE id = ? AND tenant_id = ?
      `,
      )
      .bind(versionId, tenantId)
      .first()

    if (!version) return null

    return {
      ...version,
      data: typeof version.data === 'string' ? JSON.parse(version.data) : version.data,
      metadata: version.metadata ? (typeof version.metadata === 'string' ? JSON.parse(version.metadata) : version.metadata) : null,
    }
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(dataId: string, tenantId: string): Promise<VersionData | null> {
    const version: any = await this.db
      .prepare(
        `
        SELECT * FROM content_versions 
        WHERE data_id = ? AND tenant_id = ? AND is_current = 1
      `,
      )
      .bind(dataId, tenantId)
      .first()

    if (!version) return null

    return {
      ...version,
      data: typeof version.data === 'string' ? JSON.parse(version.data) : version.data,
    }
  }

  /**
   * 版本回滚
   * 将内容恢复到指定版本
   */
  async rollbackToVersion(options: RollbackOptions): Promise<VersionData> {
    const { versionId, changeSummary = '回滚到历史版本', userId } = options

    // 获取目标版本
    const targetVersion = await this.getVersion(versionId, '')
    if (!targetVersion) {
      throw new Error('Version not found')
    }

    // 创建新的回滚版本
    const rollbackVersion = await this.createVersion({
      dataId: targetVersion.dataId,
      collectionId: targetVersion.collectionId,
      tenantId: targetVersion.tenantId,
      data: targetVersion.data,
      changeSummary,
      changeType: 'rollback',
      userId,
      parentVersionId: versionId,
    })

    // 更新 collection_data 表为回滚的数据
    await this.db
      .prepare(
        `
        UPDATE collection_data 
        SET data = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .bind(
        JSON.stringify(targetVersion.data),
        userId || null,
        new Date().toISOString(),
        targetVersion.dataId,
      )
      .run()

    return rollbackVersion
  }

  /**
   * 比较两个版本的差异
   */
  async compareVersions(
    versionId1: string,
    versionId2: string,
    tenantId: string,
  ): Promise<VersionDiff> {
    const version1 = await this.getVersion(versionId1, tenantId)
    const version2 = await this.getVersion(versionId2, tenantId)

    if (!version1 || !version2) {
      throw new Error('One or both versions not found')
    }

    return this.computeDiff(version1.data, version2.data)
  }

  /**
   * 计算两个数据对象的差异
   */
  private computeDiff(data1: Record<string, any>, data2: Record<string, any>): VersionDiff {
    const diff: VersionDiff = {
      added: {},
      removed: {},
      modified: {},
      unchanged: [],
    }

    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)])

    for (const key of allKeys) {
      const hasIn1 = key in data1
      const hasIn2 = key in data2
      const val1 = data1[key]
      const val2 = data2[key]

      if (!hasIn1 && hasIn2) {
        // 新增字段
        diff.added[key] = val2
      } else if (hasIn1 && !hasIn2) {
        // 删除字段
        diff.removed[key] = val1
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        // 修改字段
        diff.modified[key] = { old: val1, new: val2 }
      } else {
        // 未变字段
        diff.unchanged.push(key)
      }
    }

    return diff
  }

  /**
   * 获取版本的变更摘要
   */
  async getVersionChangeSummary(versionId: string, tenantId: string): Promise<string | null> {
    const version = await this.getVersion(versionId, tenantId)
    if (!version) return null

    return version.changeSummary || `版本 ${version.versionNumber}`
  }

  /**
   * 清理过期版本
   * 根据配置清理超过保留天数的版本
   */
  async cleanupOldVersions(
    tenantId: string,
    retentionDays: number = 90,
    maxVersions: number = 50,
  ): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    const cutoffDateStr = cutoffDate.toISOString()

    // 删除超过保留天数的旧版本 (保留最近的 maxVersions 个)
    const result: any = await this.db
      .prepare(
        `
        DELETE FROM content_versions
        WHERE tenant_id = ? 
          AND created_at < ?
          AND version_number NOT IN (
            SELECT version_number 
            FROM content_versions 
            WHERE tenant_id = ?
            ORDER BY version_number DESC
            LIMIT ?
          )
      `,
      )
      .bind(tenantId, cutoffDateStr, tenantId, maxVersions)
      .run()

    return result.changes || 0
  }

  /**
   * 获取自动版本控制配置
   */
  async getAutoVersionConfig(
    tenantId: string,
    collectionId?: string,
  ): Promise<{
    enabled: boolean
    autoSaveInterval: number
    maxVersions: number
    retentionDays: number
  } | null> {
    // 先查找集合级别的配置
    if (collectionId) {
      const config: any = await this.db
        .prepare(
          `
          SELECT * FROM auto_version_configs 
          WHERE tenant_id = ? AND collection_id = ?
        `,
        )
        .bind(tenantId, collectionId)
        .first()

      if (config) {
        return {
          enabled: config.enabled,
          autoSaveInterval: config.autoSaveInterval,
          maxVersions: config.maxVersions,
          retentionDays: config.retentionDays,
        }
      }
    }

    // 再查找全局配置
    const globalConfig: any = await this.db
      .prepare(
        `
        SELECT * FROM auto_version_configs 
        WHERE tenant_id = ? AND collection_id IS NULL
      `,
    )
      .bind(tenantId)
      .first()

    if (globalConfig) {
      return {
        enabled: globalConfig.enabled,
        autoSaveInterval: globalConfig.autoSaveInterval,
        maxVersions: globalConfig.maxVersions,
        retentionDays: globalConfig.retentionDays,
      }
    }

    // 返回默认配置
    return {
      enabled: true,
      autoSaveInterval: 300, // 5 分钟
      maxVersions: 50,
      retentionDays: 90,
    }
  }

  /**
   * 更新自动版本控制配置
   */
  async updateAutoVersionConfig(
    tenantId: string,
    config: {
      collectionId?: string
      enabled?: boolean
      autoSaveInterval?: number
      maxVersions?: number
      retentionDays?: number
    },
  ): Promise<void> {
    const { collectionId, enabled, autoSaveInterval, maxVersions, retentionDays } = config
    const now = new Date().toISOString()

    // 检查配置是否存在
    const existing: any = await this.db
      .prepare(
        `
        SELECT id FROM auto_version_configs 
        WHERE tenant_id = ? AND ${collectionId ? 'collection_id = ?' : 'collection_id IS NULL'}
      `,
      )
      .bind(collectionId ? tenantId : tenantId, collectionId)
      .first()

    if (existing) {
      // 更新配置
      const updateFields: string[] = []
      const values: any[] = []

      if (enabled !== undefined) {
        updateFields.push('enabled = ?')
        values.push(enabled ? 1 : 0)
      }
      if (autoSaveInterval !== undefined) {
        updateFields.push('auto_save_interval = ?')
        values.push(autoSaveInterval)
      }
      if (maxVersions !== undefined) {
        updateFields.push('max_versions = ?')
        values.push(maxVersions)
      }
      if (retentionDays !== undefined) {
        updateFields.push('retention_days = ?')
        values.push(retentionDays)
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?')
        values.push(now)
        values.push(collectionId || null)
        values.push(tenantId)

        await this.db
          .prepare(
            `
            UPDATE auto_version_configs 
            SET ${updateFields.join(', ')}
            WHERE ${collectionId ? 'collection_id = ?' : 'collection_id IS NULL'} AND tenant_id = ?
          `,
          )
          .bind(...values)
          .run()
      }
    } else {
      // 创建新配置
      const configId = crypto.randomUUID()
      await this.db
        .prepare(
          `
          INSERT INTO auto_version_configs 
          (id, tenant_id, collection_id, enabled, auto_save_interval, max_versions, retention_days, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .bind(
          configId,
          tenantId,
          collectionId || null,
          enabled !== undefined ? (enabled ? 1 : 0) : 1,
          autoSaveInterval || 300,
          maxVersions || 50,
          retentionDays || 90,
          now,
        )
        .run()
    }
  }
}
