#!/bin/bash

# 部署到 Staging 环境
set -e

echo "🚀 部署到 Staging 环境..."
./scripts/deploy.sh staging
