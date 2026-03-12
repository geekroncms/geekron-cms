#!/bin/bash

# Geekron CMS 项目初始化脚本
set -e

echo "🦞 Geekron CMS 项目初始化"
echo "=========================="
echo ""

# 检查 Bun
if ! command -v bun &> /dev/null; then
    echo "❌ 未检测到 Bun，请先安装：https://bun.sh"
    exit 1
fi

# 安装依赖
echo "📦 安装项目依赖..."
bun install

# 复制环境文件
if [ ! -f .env ]; then
    echo "📝 创建环境配置文件..."
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请根据实际情况修改配置"
fi

# 初始化 Git
if [ ! -d .git ]; then
    echo "🔧 初始化 Git 仓库..."
    git init
    git branch -M main
    echo "✅ Git 仓库初始化完成"
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads
mkdir -p logs
mkdir -p .wrangler

# 检查 Wrangler
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler 未安装，正在全局安装..."
    bun install -g wrangler
fi

# Cloudflare 资源创建提示
echo ""
echo "☁️  Cloudflare 资源配置："
echo "------------------------"
echo "请运行以下命令创建必要资源："
echo ""
echo "1. 创建 D1 数据库:"
echo "   wrangler d1 create geekron-cms-db"
echo "   wrangler d1 create geekron-cms-db-staging"
echo "   wrangler d1 create geekron-cms-db-production"
echo ""
echo "2. 创建 R2 存储桶:"
echo "   wrangler r2 bucket create geekron-cms-files"
echo "   wrangler r2 bucket create geekron-cms-files-staging"
echo "   wrangler r2 bucket create geekron-cms-files-production"
echo ""
echo "3. 创建 KV 命名空间:"
echo "   wrangler kv:namespace create CACHE"
echo "   wrangler kv:namespace create CACHE --preview"
echo "   wrangler kv:namespace create CACHE --env staging"
echo "   wrangler kv:namespace create CACHE --env production"
echo ""
echo "创建完成后，请将 ID 填入 wrangler.toml"
echo ""

# 完成
echo "✅ 项目初始化完成！"
echo ""
echo "下一步："
echo "1. 修改 .env 文件中的配置"
echo "2. 创建 Cloudflare 资源并更新 wrangler.toml"
echo "3. 运行 'bun run dev' 启动开发服务器"
