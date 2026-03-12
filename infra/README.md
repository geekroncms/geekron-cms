# Geekron CMS 基础设施配置文档

本文档描述了 Geekron CMS 的数据库和基础设施配置。

## 目录结构

```
geekron-cms/
├── infra/
│   ├── migrations/          # 数据库迁移文件
│   │   ├── 001_initial_schema.sql    # 初始表结构
│   │   └── 002_sync_triggers.sql     # 同步触发器
│   └── d1/                  # D1 配置文件
├── scripts/                 # 运维脚本
│   ├── init-d1.sh          # D1 初始化
│   ├── healthcheck.sh      # 健康检查
│   ├── backup-d1.sh        # D1 备份
│   ├── backup-postgres.sh  # PostgreSQL 备份
│   ├── verify-backup.sh    # 备份验证
│   └── crontab-example     # 定时任务示例
├── packages/server/src/
│   ├── db/
│   │   ├── schema.ts       # D1 Schema 定义
│   │   ├── migrate.ts      # D1 迁移脚本
│   │   ├── seeds.ts        # 种子数据
│   │   └── postgres-migrate.ts  # PostgreSQL 迁移
│   ├── routes/
│   │   └── sync.ts         # 同步 API
│   └── sync/
│       └── d1-to-pg-sync.ts # 数据同步逻辑
├── docker-compose.yml       # Docker 配置
└── wrangler.toml           # Cloudflare 配置
```

## 数据库架构

### D1 (SQLite) - 租户数据
- 存储租户隔离的业务数据
- 部署在 Cloudflare Workers 边缘
- 低延迟、高可用

### PostgreSQL - 中心数据
- 存储全局索引和审计数据
- 支持复杂查询和分析
- 数据备份和恢复

### 表结构

#### 核心表
- `tenants` - 租户信息
- `users` - 用户账户
- `collections` - 数据集合定义
- `collection_fields` - 集合字段
- `collection_data` - 动态数据
- `api_keys` - API 密钥
- `audit_logs` - 审计日志
- `files` - 文件元数据

#### 系统表
- `_migrations` - 迁移历史 (PostgreSQL)
- `sync_queue` - 同步队列 (PostgreSQL)
- `sync_stats` - 同步统计 (物化视图)

## 快速开始

### 1. 启动 Docker 环境

```bash
docker-compose up -d
```

服务端口:
- PostgreSQL: 5432
- Redis: 6379
- MinIO: 9000 (API), 9001 (Console)
- 应用：3000

### 2. 初始化 D1 数据库

```bash
./scripts/init-d1.sh
```

### 3. 导入种子数据

```bash
bun run db:seed
```

### 4. 运行迁移

```bash
# D1 迁移
bun run db:migrate

# PostgreSQL 迁移
bun run db:pg-migrate
```

### 5. 健康检查

```bash
./scripts/healthcheck.sh
```

## 数据同步

### 同步策略

1. **全量同步**: 初次同步或数据不一致时
2. **增量同步**: 基于 `updated_at` 字段
3. **实时同步**: 通过 PostgreSQL 触发器

### API 使用

```bash
# 启动全量同步
curl -X POST http://localhost:3000/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{"type":"full"}'

# 启动增量同步
curl -X POST http://localhost:3000/api/sync/start \
  -H "Content-Type: application/json" \
  -d '{"type":"incremental","since":"2026-03-12T00:00:00Z"}'

# 查询同步状态
curl http://localhost:3000/api/sync/status/sync-123456

# 查询同步历史
curl http://localhost:3000/api/sync/history
```

## 备份策略

### 定时备份配置

编辑 crontab:
```bash
crontab -e
```

添加示例配置:
```bash
cat scripts/crontab-example >> /etc/crontab
```

### 手动备份

```bash
# 备份 D1
./scripts/backup-d1.sh

# 备份 PostgreSQL
./scripts/backup-postgres.sh

# 验证备份
./scripts/verify-backup.sh
```

### 备份存储

- D1 备份：`backups/d1/`
- PostgreSQL 备份：`backups/postgres/`
- 保留策略：30 天

## 监控与告警

### 健康检查端点

```bash
curl http://localhost:3000/health
```

### 日志位置

- 应用日志：`logs/app.log`
- 同步日志：`logs/sync.log`
- 备份日志：`logs/backup.log`

### 监控指标

- 数据库连接数
- 同步队列长度
- 备份文件大小
- API 响应时间

## 安全配置

### 环境变量

```bash
# 数据库
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=geekron_cms
PG_USER=postgres
PG_PASSWORD=<secure-password>

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=<secure-key>
MINIO_SECRET_KEY=<secure-secret>
```

### RLS (Row Level Security)

PostgreSQL 启用了 RLS，需要在应用层设置租户上下文:

```sql
SET app.current_tenant = '<tenant-uuid>';
```

## 故障恢复

### 恢复 D1 数据

```bash
wrangler d1 execute geekron-d1-local --local --file=backups/d1/backup.sql
```

### 恢复 PostgreSQL 数据

```bash
pg_restore -h localhost -U postgres -d geekron_cms backups/postgres/backup.dump
```

## 性能优化

### 索引策略

- 所有外键字段都有索引
- 常用查询字段（status, email, slug）有索引
- JSON 字段使用 GIN 索引

### 批量操作

- 同步批次大小：100 条/批
- 可调整 `batchSize` 参数优化性能

### 连接池

- PostgreSQL: 10 个连接
- Redis: 5 个连接

## 开发指南

### 添加新表

1. 在 `schema.ts` 中添加表定义
2. 在 `001_initial_schema.sql` 中添加 SQL
3. 运行迁移

### 添加新索引

1. 在迁移文件中添加 `CREATE INDEX`
2. 在 `schema.ts` 中添加索引定义

### 测试同步

```bash
# 本地测试
bun run sync:test
```

## 常见问题

### Q: 同步失败怎么办？
A: 检查 `sync_queue` 表的错误信息，手动重试或修复数据。

### Q: 备份文件太大？
A: 调整保留天数或启用压缩。

### Q: 如何监控同步状态？
A: 查询 `sync_stats` 物化视图或调用 `/api/sync/history`。

---

_最后更新：2026-03-12_
