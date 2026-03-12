#!/bin/bash
# D1 数据库初始化脚本
# 用于本地开发和测试环境

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "Geekron CMS - D1 数据库初始化"
echo "======================================"

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler 未安装，请先安装：npm install -g wrangler"
    exit 1
fi

# 检查 wrangler.toml 是否存在
if [ ! -f "$PROJECT_ROOT/wrangler.toml" ]; then
    echo "❌ wrangler.toml 不存在"
    exit 1
fi

echo "✓ wrangler 已安装"

# 创建 D1 数据库
echo ""
echo "创建 D1 数据库..."
DB_ID=$(wrangler d1 create geekron-d1-local --json | jq -r '.database_id')

if [ -z "$DB_ID" ]; then
    echo "❌ 创建数据库失败"
    exit 1
fi

echo "✓ 数据库创建成功，ID: $DB_ID"

# 更新 wrangler.toml 中的数据库 ID
echo ""
echo "更新 wrangler.toml 配置..."
sed -i "s/database_id = .*/database_id = \"$DB_ID\"/" "$PROJECT_ROOT/wrangler.toml"
echo "✓ wrangler.toml 已更新"

# 执行迁移
echo ""
echo "执行数据库迁移..."
wrangler d1 execute geekron-d1-local --local --file="$PROJECT_ROOT/infra/migrations/001_initial_schema.sql"
echo "✓ 迁移执行成功"

# 执行种子数据
echo ""
echo "导入种子数据..."
# 种子数据通过 TypeScript 脚本执行
echo "请运行：bun run db:seed"
echo "✓ 初始化完成"

echo ""
echo "======================================"
echo "D1 数据库初始化完成!"
echo "数据库 ID: $DB_ID"
echo "======================================"
