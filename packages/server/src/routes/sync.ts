/**
 * 数据同步 API 路由
 * 提供 D1 <-> PostgreSQL 数据同步的 HTTP 接口
 */

import { Hono } from 'hono';
import { D1ToPostgresSync } from '../sync/d1-to-pg-sync';
import { Pool } from 'pg';

interface SyncRequest {
  type: 'full' | 'incremental';
  tables?: string[];
  since?: string; // ISO 8601 格式
}

interface SyncResponse {
  success: boolean;
  syncId: string;
  startTime: string;
  endTime: string;
  results: Array<{
    table: string;
    inserted: number;
    updated: number;
    deleted: number;
    errors: string[];
  }>;
  errors: string[];
}

export const syncRoutes = new Hono();

// 同步状态存储（生产环境应使用数据库）
const syncHistory: Map<string, SyncResponse> = new Map();

/**
 * POST /api/sync/start
 * 启动数据同步任务
 */
syncRoutes.post('/start', async (c) => {
  try {
    const body: SyncRequest = await c.req.json();
    
    // 验证请求
    if (!body.type || !['full', 'incremental'].includes(body.type)) {
      return c.json({ error: 'Invalid sync type' }, 400);
    }

    // 获取数据库连接
    const d1Database = c.get('d1Database');
    const pgPool = c.get('pgPool') as Pool;

    if (!d1Database || !pgPool) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // 创建同步器
    const sync = new D1ToPostgresSync({
      d1Database,
      pgPool,
      batchSize: 100,
      tables: body.tables || ['tenants', 'users', 'collections', 'collection_fields', 'collection_data', 'api_keys', 'files'],
    });

    // 执行同步
    const startTime = new Date();
    let results;

    if (body.type === 'full') {
      results = await sync.fullSync();
    } else {
      const since = body.since ? new Date(body.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      results = await sync.incrementalSync(since);
    }

    const endTime = new Date();
    const syncId = `sync-${Date.now()}`;

    // 构建响应
    const response: SyncResponse = {
      success: results.every(r => r.errors.length === 0),
      syncId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      results: results.map(r => ({
        table: r.table,
        inserted: r.inserted,
        updated: r.updated,
        deleted: r.deleted,
        errors: r.errors,
      })),
      errors: results.flatMap(r => r.errors),
    };

    // 保存历史记录
    syncHistory.set(syncId, response);

    return c.json(response);

  } catch (error) {
    console.error('Sync failed:', error);
    return c.json({ 
      success: false, 
      error: error.message,
      syncId: `sync-${Date.now()}`
    }, 500);
  }
});

/**
 * GET /api/sync/status/:id
 * 查询同步任务状态
 */
syncRoutes.get('/status/:id', (c) => {
  const syncId = c.req.param('id');
  const status = syncHistory.get(syncId);

  if (!status) {
    return c.json({ error: 'Sync task not found' }, 404);
  }

  return c.json(status);
});

/**
 * GET /api/sync/history
 * 查询同步历史记录
 */
syncRoutes.get('/history', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const history = Array.from(syncHistory.values()).slice(-limit);
  
  return c.json({
    total: syncHistory.size,
    history,
  });
});

/**
 * POST /api/sync/schedule
 * 配置定时同步任务
 */
syncRoutes.post('/schedule', async (c) => {
  try {
    const body = await c.req.json();
    const { cron, type, tables } = body;

    // 这里应该集成到定时任务系统（如 node-cron）
    // 示例代码：
    /*
    import cron from 'node-cron';
    
    cron.schedule(cron, async () => {
      // 执行同步
    });
    */

    return c.json({
      success: true,
      message: 'Schedule configured (not implemented in demo)',
      config: { cron, type, tables },
    });

  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/sync/config
 * 获取同步配置
 */
syncRoutes.get('/config', (c) => {
  return c.json({
    availableTables: ['tenants', 'users', 'collections', 'collection_fields', 'collection_data', 'api_keys', 'files', 'audit_logs'],
    syncTypes: ['full', 'incremental'],
    defaultBatchSize: 100,
  });
});

export default syncRoutes;
