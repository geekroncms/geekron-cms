#!/bin/bash
# 备份验证脚本
# 用于验证备份文件的完整性

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 配置
BACKUP_DIR="${PROJECT_ROOT}/backups"
TEMP_DIR="/tmp/geekron-backup-verify-$$"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "Geekron CMS - 备份验证"
echo "======================================"
echo ""

# 创建临时目录
mkdir -p "$TEMP_DIR"
trap "rm -rf $TEMP_DIR" EXIT

# 验证函数
verify_backup() {
    local file=$1
    local type=$2
    
    echo -n "验证 $file ... "
    
    case $type in
        "d1")
            # 验证 SQL 文件语法
            if gunzip -t "$file" 2>/dev/null; then
                echo -e "${GREEN}✓ 完整${NC}"
                return 0
            else
                echo -e "${RED}✗ 损坏${NC}"
                return 1
            fi
            ;;
        "postgres")
            # 验证 PostgreSQL custom format
            if pg_restore --list "$file" > /dev/null 2>&1; then
                echo -e "${GREEN}✓ 完整${NC}"
                return 0
            else
                echo -e "${RED}✗ 损坏${NC}"
                return 1
            fi
            ;;
        *)
            echo -e "${YELLOW}? 未知类型${NC}"
            return 1
            ;;
    esac
}

# 验证 D1 备份
echo "验证 D1 备份..."
echo "--------------------------------------"
D1_BACKUPS=$(find "${BACKUP_DIR}/d1" -name "*.sql.gz" -type f 2>/dev/null | sort -r | head -5)
if [ -z "$D1_BACKUPS" ]; then
    echo -e "${YELLOW}⚠${NC} 未找到 D1 备份文件"
else
    for backup in $D1_BACKUPS; do
        verify_backup "$backup" "d1"
    done
fi

echo ""

# 验证 PostgreSQL 备份
echo "验证 PostgreSQL 备份..."
echo "--------------------------------------"
PG_BACKUPS=$(find "${BACKUP_DIR}/postgres" -name "*.sql" -o -name "*.dump" -type f 2>/dev/null | sort -r | head -5)
if [ -z "$PG_BACKUPS" ]; then
    echo -e "${YELLOW}⚠${NC} 未找到 PostgreSQL 备份文件"
else
    for backup in $PG_BACKUPS; do
        verify_backup "$backup" "postgres"
    done
fi

echo ""
echo "======================================"
echo "验证完成"
echo "======================================"
