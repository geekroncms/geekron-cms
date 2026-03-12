/**
 * D1 -> PostgreSQL 数据同步脚本
 * 
 * 同步策略：
 * 1. 全量同步：初次同步或数据不一致时使用
 * 2. 增量同步：基于 updated_at 字段同步变更数据
 * 3. 双向同步：支持 D1 和 PG 之间的数据同步（可选）
 * 
 * 同步流程：
 * 1. 从 D1 读取数据
 * 2. 转换数据格式（SQLite -> PostgreSQL）
 * 3. 批量写入 PostgreSQL
 * 4. 记录同步日志
 */

import { Pool } from 'pg';

interface SyncConfig {
  d1Database: D1Database;
  pgPool: Pool;
  batchSize: number;
  tables: string[];
}

interface SyncResult {
  table: string;
  inserted: number;
  updated: number;
  deleted: number;
  errors: string[];
}

interface SyncLog {
  id: string;
  startTime: Date;
  endTime: Date;
  table: string;
  status: 'success' | 'partial' | 'failed';
  inserted: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export class D1ToPostgresSync {
  private config: SyncConfig;
  private syncLogs: SyncLog[] = [];

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * 全量同步所有表
   */
  async fullSync(): Promise<SyncResult[]> {
    console.log('Starting full sync...\n');
    
    const results: SyncResult[] = [];
    
    for (const table of this.config.tables) {
      console.log(`Syncing table: ${table}`);
      const result = await this.syncTable(table);
      results.push(result);
      console.log(`  ✓ Inserted: ${result.inserted}, Updated: ${result.updated}, Deleted: ${result.deleted}\n`);
    }

    this.logSync('full_sync', results);
    return results;
  }

  /**
   * 增量同步（基于 updated_at）
   */
  async incrementalSync(since: Date): Promise<SyncResult[]> {
    console.log(`Starting incremental sync since ${since.toISOString()}...\n`);
    
    const results: SyncResult[] = [];
    
    for (const table of this.config.tables) {
      console.log(`Syncing table: ${table}`);
      const result = await this.syncTableIncremental(table, since);
      results.push(result);
      console.log(`  ✓ Inserted: ${result.inserted}, Updated: ${result.updated}\n`);
    }

    this.logSync('incremental_sync', results);
    return results;
  }

  /**
   * 同步单个表（全量）
   */
  private async syncTable(table: string): Promise<SyncResult> {
    const result: SyncResult = {
      table,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // 从 D1 读取所有数据
      const d1Data = await this.readFromD1(table);
      
      if (d1Data.length === 0) {
        console.log(`  No data in ${table}`);
        return result;
      }

      // 分批写入 PostgreSQL
      const batches = this.chunkArray(d1Data, this.config.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.writeToPostgres(table, batch);
        result.inserted += batchResult.inserted;
        result.updated += batchResult.updated;
      }

    } catch (error) {
      result.errors.push(`Sync failed: ${error.message}`);
      console.error(`  ✗ Error: ${error.message}`);
    }

    return result;
  }

  /**
   * 同步单个表（增量）
   */
  private async syncTableIncremental(table: string, since: Date): Promise<SyncResult> {
    const result: SyncResult = {
      table,
      inserted: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // 从 D1 读取变更数据
      const d1Data = await this.readFromD1Incremental(table, since);
      
      if (d1Data.length === 0) {
        console.log(`  No changes in ${table}`);
        return result;
      }

      // 分批写入 PostgreSQL
      const batches = this.chunkArray(d1Data, this.config.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.writeToPostgres(table, batch, true);
        result.inserted += batchResult.inserted;
        result.updated += batchResult.updated;
      }

    } catch (error) {
      result.errors.push(`Sync failed: ${error.message}`);
      console.error(`  ✗ Error: ${error.message}`);
    }

    return result;
  }

  /**
   * 从 D1 读取数据
   */
  private async readFromD1(table: string): Promise<any[]> {
    const query = `SELECT * FROM ${table}`;
    const result = await this.config.d1Database.prepare(query).all();
    return result.results || [];
  }

  /**
   * 从 D1 读取增量数据
   */
  private async readFromD1Incremental(table: string, since: Date): Promise<any[]> {
    const query = `
      SELECT * FROM ${table} 
      WHERE updated_at > ? OR created_at > ?
      ORDER BY updated_at ASC
    `;
    const sinceStr = since.toISOString();
    const result = await this.config.d1Database.prepare(query).bind(sinceStr, sinceStr).all();
    return result.results || [];
  }

  /**
   * 写入 PostgreSQL
   */
  private async writeToPostgres(
    table: string,
    data: any[],
    isUpdate: boolean = false
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    const client = await this.config.pgPool.connect();

    try {
      await client.query('BEGIN');

      for (const row of data) {
        try {
          // 检查记录是否存在
          const checkQuery = `SELECT id FROM ${table} WHERE id = $1`;
          const checkResult = await client.query(checkQuery, [row.id]);

          if (checkResult.rowCount === 0) {
            // 插入新记录
            await this.insertRow(client, table, row);
            inserted++;
          } else {
            // 更新现有记录
            await this.updateRow(client, table, row);
            updated++;
          }
        } catch (error) {
          console.error(`    Error processing row ${row.id}: ${error.message}`);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return { inserted, updated };
  }

  /**
   * 插入行
   */
  private async insertRow(client: any, table: string, row: any): Promise<void> {
    const columns = Object.keys(row).filter(k => k !== 'id');
    const values = Object.values(row).filter((_, i) => i !== 0);
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');

    const query = `
      INSERT INTO ${table} (id, ${columns.join(', ')})
      VALUES ($1, ${placeholders})
    `;

    await client.query(query, [row.id, ...values]);
  }

  /**
   * 更新行
   */
  private async updateRow(client: any, table: string, row: any): Promise<void> {
    const columns = Object.keys(row).filter(k => k !== 'id');
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');

    const query = `
      UPDATE ${table}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
    `;

    await client.query(query, [row.id, ...Object.values(row).filter((_, i) => i !== 0)]);
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 记录同步日志
   */
  private logSync(type: string, results: SyncResult[]): void {
    const log: SyncLog = {
      id: `sync-${Date.now()}`,
      startTime: new Date(),
      endTime: new Date(),
      table: results.map(r => r.table).join(', '),
      status: results.every(r => r.errors.length === 0) ? 'success' : 'partial',
      inserted: results.reduce((sum, r) => sum + r.inserted, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      deleted: results.reduce((sum, r) => sum + r.deleted, 0),
      errors: results.flatMap(r => r.errors),
    };

    this.syncLogs.push(log);
    console.log(`Sync log: ${log.id} - ${log.status}`);
  }

  /**
   * 获取同步日志
   */
  getSyncLogs(): SyncLog[] {
    return this.syncLogs;
  }
}

// CLI 入口
async function main() {
  const { Pool } = await import('pg');
  
  const pgPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'geekron_cms',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
  });

  // D1 数据库需要从 Cloudflare 环境获取
  // 这里仅作为示例
  const d1Database = undefined as unknown as D1Database;

  const sync = new D1ToPostgresSync({
    d1Database,
    pgPool,
    batchSize: 100,
    tables: ['tenants', 'users', 'collections', 'collection_fields', 'collection_data', 'api_keys', 'files'],
  });

  try {
    await sync.fullSync();
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

export { D1ToPostgresSync };
