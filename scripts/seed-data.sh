#!/bin/bash

# Geekron CMS 测试数据生成脚本
set -e

ENVIRONMENT=${1:-local}
COUNT=${2:-10}

echo "🌱 生成测试数据"
echo "==============="
echo "环境：${ENVIRONMENT}"
echo "租户数量：${COUNT}"
echo ""

# 生成测试数据脚本
cat > /tmp/seed_data.ts << 'EOF'
// 测试数据生成脚本
import { Database } from '@cloudflare/workers-types/experimental'

interface Env {
  DB: Database
}

export async function seedData(env: Env, count: number = 10) {
  console.log(`开始生成 ${count} 个测试租户...`)
  
  // 生成租户
  for (let i = 1; i <= count; i++) {
    const tenantId = `tenant_${Date.now()}_${i}`
    const tenantName = `测试租户 ${i}`
    const subdomain = `tenant-${i}`
    
    await env.DB.prepare(`
      INSERT INTO tenants (id, name, subdomain, status, created_at)
      VALUES (?, ?, ?, 'active', datetime('now'))
    `).bind(tenantId, tenantName, subdomain).run()
    
    console.log(`✅ 创建租户：${tenantName} (${subdomain})`)
  }
  
  // 生成测试用户
  console.log('\n生成测试用户...')
  for (let i = 1; i <= count; i++) {
    const userId = `user_${Date.now()}_${i}`
    const email = `user${i}@test.com`
    const tenantId = `tenant_${Date.now()}_${i}`
    
    await env.DB.prepare(`
      INSERT INTO users (id, tenant_id, email, name, role, status, created_at)
      VALUES (?, ?, ?, ?, 'admin', 'active', datetime('now'))
    `).bind(userId, tenantId, email, `测试用户 ${i}`).run()
    
    console.log(`✅ 创建用户：${email}`)
  }
  
  console.log('\n✅ 测试数据生成完成！')
}
EOF

echo "📝 测试数据脚本已生成"
echo ""
echo "请手动运行以下命令执行数据生成："
echo "  bun run packages/server/src/db/seed.ts --count ${COUNT}"
echo ""
echo "或者使用 Wrangler 本地运行："
echo "  wrangler d1 execute geekron-cms-db --local --file=/tmp/seed_data.ts"
echo ""

# 清理临时文件
# rm -f /tmp/seed_data.ts

echo "✅ 脚本准备完成！"
