#!/bin/bash

# Geekron CMS 部署脚本
# 用法：./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 开始部署到 ${ENVIRONMENT} 环境..."

# 检查环境
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ 错误：环境必须是 staging 或 production"
    exit 1
fi

# 检查依赖
if ! command -v bun &> /dev/null; then
    echo "❌ 错误：需要安装 Bun"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误：需要安装 Wrangler"
    echo "运行：bun install -g wrangler"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
bun install

# 类型检查
echo "🔍 运行类型检查..."
bun run --bun tsc --noEmit

# 运行测试
echo "🧪 运行测试..."
bun test

# 构建
echo "🔨 构建项目..."
bun run build

# 部署
echo "☁️  部署到 Cloudflare Workers..."
if [[ "$ENVIRONMENT" == "production" ]]; then
    wrangler deploy --env production
else
    wrangler deploy --env staging
fi

echo "✅ 部署完成！"
echo ""
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "🌐 生产环境：https://api.geekron-cms.com"
else
    echo "🌐 测试环境：https://staging-api.geekron-cms.com"
fi
