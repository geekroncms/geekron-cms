#!/bin/bash

# Geekron CMS 数据库重置脚本
# ⚠️  警告：这将删除所有数据！
set -e

ENVIRONMENT=${1:-local}

echo "⚠️  数据库重置警告"
echo "==================="
echo "环境：${ENVIRONMENT}"
echo "此操作将删除所有数据且不可恢复！"
echo ""

read -p "确认继续？(输入 yes 继续): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "❌ 操作取消"
    exit 1
fi

case "$ENVIRONMENT" in
    local)
        echo "🔄 重置本地数据库..."
        
        # 如果使用 Docker PostgreSQL
        if docker ps | grep -q postgres; then
            docker exec -i postgres psql -U postgres -c "DROP DATABASE IF EXISTS geekron_cms;"
            docker exec -i postgres psql -U postgres -c "CREATE DATABASE geekron_cms;"
            echo "✅ PostgreSQL 数据库已重置"
        fi
        
        # 如果使用 D1 本地
        if command -v wrangler &> /dev/null; then
            echo "🔄 重置 D1 本地数据库..."
            wrangler d1 execute geekron-cms-db --local --command "DROP TABLE IF EXISTS tenants;"
            wrangler d1 execute geekron-cms-db --local --command "DROP TABLE IF EXISTS users;"
            echo "✅ D1 本地数据库已重置"
        fi
        ;;
        
    staging)
        echo "🔄 重置 Staging 数据库..."
        wrangler d1 execute geekron-cms-db-staging --command "DELETE FROM tenants;"
        wrangler d1 execute geekron-cms-db-staging --command "DELETE FROM users;"
        echo "✅ Staging 数据库已重置"
        ;;
        
    production)
        echo "❌ 禁止直接重置生产数据库！"
        echo "如需重置生产数据库，请手动操作或联系管理员"
        exit 1
        ;;
        
    *)
        echo "❌ 未知环境：${ENVIRONMENT}"
        echo "用法：./scripts/reset-db.sh [local|staging|production]"
        exit 1
        ;;
esac

echo ""
echo "✅ 数据库重置完成！"
echo "运行 'bun run db:migrate' 重新执行迁移"
