#!/bin/bash
# D1 数据导出备份脚本
# 用于定期备份 Cloudflare D1 数据库

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 配置
BACKUP_DIR="${PROJECT_ROOT}/backups/d1"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/geekron-d1-${DATE}.sql"
RETENTION_DAYS=30

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "Geekron CMS - D1 数据备份"
echo "======================================"
echo ""

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗${NC} wrangler 未安装"
    exit 1
fi

echo -e "${GREEN}✓${NC} wrangler 已安装"

# 创建备份目录
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} 备份目录：$BACKUP_DIR"

# 导出 D1 数据
echo ""
echo "正在导出 D1 数据库..."
wrangler d1 export geekron-d1-local --local --output "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓${NC} 备份完成：$BACKUP_FILE ($FILE_SIZE)"
else
    echo -e "${RED}✗${NC} 备份失败"
    exit 1
fi

# 压缩备份文件
echo ""
echo "压缩备份文件..."
gzip "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} 压缩完成：${BACKUP_FILE}.gz"

# 清理旧备份
echo ""
echo "清理 ${RETENTION_DAYS} 天前的旧备份..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo -e "${GREEN}✓${NC} 清理完成"

# 显示备份统计
echo ""
echo "当前备份文件:"
ls -lh "$BACKUP_DIR"/*.sql.gz | tail -10

echo ""
echo "======================================"
echo "备份完成!"
echo "备份文件：${BACKUP_FILE}.gz"
echo "======================================"
