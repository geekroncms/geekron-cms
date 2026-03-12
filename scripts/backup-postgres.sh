#!/bin/bash
# PostgreSQL 数据备份脚本
# 用于定期备份 PostgreSQL 数据库

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 配置
BACKUP_DIR="${PROJECT_ROOT}/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/geekron-postgres-${DATE}.sql"
RETENTION_DAYS=30

# 数据库配置（可从环境变量覆盖）
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DATABASE="${PG_DATABASE:-geekron_cms}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "Geekron CMS - PostgreSQL 数据备份"
echo "======================================"
echo ""

# 检查 psql 是否安装
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}✗${NC} pg_dump 未安装"
    exit 1
fi

echo -e "${GREEN}✓${NC} pg_dump 已安装"

# 创建备份目录
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} 备份目录：$BACKUP_DIR"

# 导出 PostgreSQL 数据
echo ""
echo "正在导出 PostgreSQL 数据库..."
export PGPASSWORD="$PG_PASSWORD"

pg_dump \
    -h "$PG_HOST" \
    -p "$PG_PORT" \
    -U "$PG_USER" \
    -d "$PG_DATABASE" \
    --no-owner \
    --no-privileges \
    --format=custom \
    -f "$BACKUP_FILE"

unset PGPASSWORD

if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓${NC} 备份完成：$BACKUP_FILE ($FILE_SIZE)"
else
    echo -e "${RED}✗${NC} 备份失败"
    exit 1
fi

# 压缩备份文件（custom format 已经是压缩的，可选）
# echo ""
# echo "压缩备份文件..."
# gzip "$BACKUP_FILE"
# echo -e "${GREEN}✓${NC} 压缩完成：${BACKUP_FILE}.gz"

# 清理旧备份
echo ""
echo "清理 ${RETENTION_DAYS} 天前的旧备份..."
find "$BACKUP_DIR" -name "*.sql" -o -name "*.dump" | xargs -I {} sh -c 'if [ $(stat -c %Y "{}") -lt $(date -d "-'"${RETENTION_DAYS}"' days" +%s) ]; then rm "{}"; fi' 2>/dev/null || true
echo -e "${GREEN}✓${NC} 清理完成"

# 显示备份统计
echo ""
echo "当前备份文件:"
ls -lh "$BACKUP_DIR"/* | tail -10

echo ""
echo "======================================"
echo "备份完成!"
echo "备份文件：$BACKUP_FILE"
echo "======================================"
