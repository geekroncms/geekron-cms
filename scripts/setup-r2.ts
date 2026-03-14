#!/usr/bin/env bun
/**
 * R2 存储桶设置脚本
 * 用法：bun run setup:r2
 */

import { $ } from 'bun'

async function setupR2() {
  console.log('🪣 开始设置 R2 存储桶...\n')

  // Cloudflare 配置
  const accountId = '645d044b57cf108ea46a1850870a827a'
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!apiToken) {
    console.error('❌ 错误：请设置 CLOUDFLARE_API_TOKEN 环境变量')
    console.log('示例：export CLOUDFLARE_API_TOKEN="your_token"')
    process.exit(1)
  }

  const buckets = [
    { name: 'geekron-cms-files', public: false },
    { name: 'geekron-cms-files-public', public: true },
  ]

  for (const bucket of buckets) {
    console.log(`📦 处理存储桶：${bucket.name}`)

    try {
      // 检查存储桶是否存在
      console.log('  检查存储桶...')
      const checkResult = await $`curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket.name}" \
        -H "Authorization: Bearer ${apiToken}"`.text()

      const checkData = JSON.parse(checkResult)

      if (checkData.success) {
        console.log(`  ✅ 存储桶已存在：${bucket.name}`)
      } else {
        // 创建存储桶
        console.log('  创建存储桶...')
        const createResult = await $`curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets" \
          -H "Authorization: Bearer ${apiToken}" \
          -H "Content-Type: application/json" \
          --data '{"name":"${bucket.name}"}'`.text()

        const createData = JSON.parse(createResult)

        if (createData.success) {
          console.log(`  ✅ 存储桶创建成功：${bucket.name}`)
        } else {
          console.log(`  ⚠️  存储桶创建失败：${JSON.stringify(createData.errors)}`)
          continue
        }
      }

      // 如果是公共存储桶，配置 CORS
      if (bucket.public) {
        console.log('  配置公共访问...')
        const corsConfig = {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 3600,
            },
          ],
        }

        const corsResult = await $`curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket.name}/cors" \
          -H "Authorization: Bearer ${apiToken}" \
          -H "Content-Type: application/json" \
          --data '${JSON.stringify(corsConfig)}'`.text()

        const corsData = JSON.parse(corsResult)

        if (corsData.success) {
          console.log('  ✅ 公共访问配置成功')
        } else {
          console.log(`  ⚠️  公共访问配置失败：${JSON.stringify(corsData.errors)}`)
        }
      }
    } catch (error: any) {
      console.log(`  ❌ 处理失败：${error.message}`)
    }

    console.log('')
  }

  console.log('✅ R2 存储桶设置完成！\n')
  console.log('📝 下一步:')
  console.log('1. 在 Cloudflare Dashboard 确认存储桶已创建')
  console.log('2. 配置 BUCKET_URL 环境变量 (如果使用公共存储桶)')
  console.log('3. 运行：bun run db:migrate 更新数据库表结构')
}

setupR2().catch(console.error)
