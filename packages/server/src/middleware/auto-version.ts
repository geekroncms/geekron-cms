import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../types/hono'
import { VersionService } from '../services/version-service'

/**
 * 自动版本控制中间件
 * 在内容创建/更新时自动创建版本快照
 */

export async function autoVersionMiddleware(c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) {
  // 仅在 POST/PATCH/PUT 请求时生效
  const method = c.req.method
  if (!['POST', 'PATCH', 'PUT'].includes(method)) {
    return await next()
  }

  // 检查是否是 collection-data 相关的路由
  const path = c.req.path
  if (!path.includes('/collection-data') && !path.includes('/data/')) {
    return await next()
  }

  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const userEmail = c.get('userEmail')

  // 获取自动版本配置
  const versionService = new VersionService(c.env.DB)
  
  // 尝试从路径中提取 collectionId
  const pathParts = path.split('/')
  let collectionId: string | undefined
  
  // 路径格式：/data/:collectionId/:id 或 /collection-data/:collectionId/...
  for (let i = 0; i < pathParts.length; i++) {
    if (pathParts[i] === 'data' && i + 1 < pathParts.length) {
      collectionId = pathParts[i + 1]
      break
    }
  }

  // 获取自动版本控制配置
  const config = await versionService.getAutoVersionConfig(tenantId, collectionId)

  // 如果未启用自动版本，跳过
  if (!config?.enabled) {
    return await next()
  }

  // 继续处理请求
  await next()

  // 如果响应成功，创建版本快照
  if (c.res.status >= 200 && c.res.status < 300) {
    try {
      // 从响应或请求中提取数据
      const requestData = await c.req.json().catch(() => null)
      
      if (requestData?.dataId && requestData?.collectionId && requestData?.data) {
        // 手动指定了 dataId 和 collectionId，直接使用
        await versionService.createVersion({
          dataId: requestData.dataId,
          collectionId: requestData.collectionId,
          tenantId,
          data: requestData.data,
          changeSummary: requestData.changeSummary || '自动保存',
          changeType: 'auto_save',
          userId,
          userEmail,
        })
      } else if (path.includes('/data/') && method === 'PATCH') {
        // PATCH /data/:collectionId/:id 格式，需要从路径提取
        const pathMatch = path.match(/\/data\/([^/]+)\/([^/]+)$/)
        if (pathMatch) {
          const [, pathCollectionId, dataId] = pathMatch
          
          // 获取当前数据
          const currentData: any = await c.env.DB.prepare(
            'SELECT * FROM collection_data WHERE id = ? AND tenant_id = ?',
          )
            .bind(dataId, tenantId)
            .first()

          if (currentData) {
            const currentDataObj = typeof currentData.data === 'string' 
              ? JSON.parse(currentData.data) 
              : currentData.data

            await versionService.createVersion({
              dataId,
              collectionId: pathCollectionId,
              tenantId,
              data: currentDataObj,
              changeSummary: '自动保存',
              changeType: 'auto_save',
              userId,
              userEmail,
            })
          }
        }
      } else if (method === 'POST' && path.includes('/data/')) {
        // POST /data/:collectionId 格式，创建后获取最新数据
        const pathMatch = path.match(/\/data\/([^/]+)$/)
        if (pathMatch && requestData?.data) {
          const [, pathCollectionId] = pathMatch
          
          // 获取刚创建的数据 (通过最新的 created_at)
          const newData: any = await c.env.DB.prepare(
            `SELECT * FROM collection_data 
             WHERE collection_id = ? AND tenant_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
          )
            .bind(pathCollectionId, tenantId)
            .first()

          if (newData) {
            const newDataObj = typeof newData.data === 'string' 
              ? JSON.parse(newData.data) 
              : newData.data

            await versionService.createVersion({
              dataId: newData.id,
              collectionId: pathCollectionId,
              tenantId,
              data: newDataObj,
              changeSummary: '初始版本',
              changeType: 'create',
              userId,
              userEmail,
            })
          }
        }
      }
    } catch (error) {
      // 自动版本创建失败不影响主流程，仅记录日志
      console.error('[AutoVersion] Failed to create version:', error)
    }
  }
}

/**
 * 定时版本清理中间件 (可选)
 * 定期清理过期版本
 */
export async function versionCleanupMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next,
) {
  await next()

  // 在响应后异步清理 (不阻塞响应)
  const tenantId = c.get('tenantId')
  if (tenantId) {
    const versionService = new VersionService(c.env.DB)
    
    // 异步清理，不等待完成
    versionService.cleanupOldVersions(tenantId).catch((error) => {
      console.error('[VersionCleanup] Failed to cleanup versions:', error)
    })
  }
}
