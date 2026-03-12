#!/bin/bash
# 健康检查脚本
# 用于检查所有服务的运行状态

set -e

echo "======================================"
echo "Geekron CMS - 健康检查"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
    local name=$1
    local cmd=$2
    
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name - 正常"
        return 0
    else
        echo -e "${RED}✗${NC} $name - 异常"
        return 1
    fi
}

# 检查 Docker 容器
echo "检查 Docker 容器..."
echo "--------------------------------------"

check_service "PostgreSQL" "docker ps | grep -q geekron-postgres"
check_service "Redis" "docker ps | grep -q geekron-redis"
check_service "MinIO" "docker ps | grep -q geekron-minio"

echo ""

# 检查 PostgreSQL 连接
echo "检查 PostgreSQL 连接..."
echo "--------------------------------------"
if command -v psql &> /dev/null; then
    check_service "PostgreSQL 连接" "pg_isready -h localhost -p 5432 -U postgres"
else
    echo -e "${YELLOW}⚠${NC} psql 未安装，跳过连接检查"
fi

echo ""

# 检查 Redis 连接
echo "检查 Redis 连接..."
echo "--------------------------------------"
if command -v redis-cli &> /dev/null; then
    check_service "Redis 连接" "redis-cli -h localhost -p 6379 ping | grep -q PONG"
else
    echo -e "${YELLOW}⚠${NC} redis-cli 未安装，跳过连接检查"
fi

echo ""

# 检查 MinIO 连接
echo "检查 MinIO 连接..."
echo "--------------------------------------"
check_service "MinIO API" "curl -s -o /dev/null -w '%{http_code}' http://localhost:9000/minio/health/live | grep -q 200"
check_service "MinIO Console" "curl -s -o /dev/null -w '%{http_code}' http://localhost:9001 | grep -q 200"

echo ""

# 检查应用服务
echo "检查应用服务..."
echo "--------------------------------------"
check_service "应用健康检查" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health | grep -q 200"

echo ""
echo "======================================"
echo "健康检查完成"
echo "======================================"
