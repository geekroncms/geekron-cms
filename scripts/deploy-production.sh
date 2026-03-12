#!/bin/bash

# 部署到 Production 环境
set -e

echo "🚀 部署到 Production 环境..."
echo "⚠️  警告：这是生产环境部署！"
read -p "确认继续？(yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "❌ 部署取消"
    exit 1
fi

./scripts/deploy.sh production
