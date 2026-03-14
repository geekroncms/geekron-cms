# 文件管理系统文档

## 📋 功能概述

Geekron CMS 文件管理系统提供完整的文件上传、存储、管理和处理功能，基于 Cloudflare R2 对象存储。

### 核心功能

- ✅ 单文件/多文件上传
- ✅ 文件列表和搜索
- ✅ 文件预览和下载
- ✅ 文件删除和批量操作
- ✅ 图片缩略图生成
- ✅ 图片变换（裁剪、缩放、旋转）
- ✅ 图片优化和格式转换
- ✅ 拖拽上传
- ✅ 分片上传（大文件）
- ✅ CDN 加速

---

## 🚀 快速开始

### 1. 配置 R2 存储桶

#### 方法一：使用设置脚本（推荐）

```bash
# 设置环境变量
export CLOUDFLARE_API_TOKEN="your_api_token"

# 运行设置脚本
cd geekron-cms
bun run setup:r2
```

#### 方法二：手动配置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 R2 存储
3. 创建存储桶：
   - `geekron-cms-files` (私有)
   - `geekron-cms-files-public` (公共)

4. 配置 CORS（公共存储桶）：
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

### 2. 更新 wrangler.toml

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "geekron-cms-files"

[[r2_buckets]]
binding = "BUCKET_PUBLIC"
bucket_name = "geekron-cms-files-public"
```

### 3. 运行数据库迁移

```bash
bun run db:migrate
```

### 4. 配置环境变量

```bash
# .env 或 .env.local
R2_BUCKET_NAME=geekron-cms-files
BUCKET_URL=https://pub-xxx.r2.dev  # 公共访问 URL（从 R2 Dashboard 获取）
```

---

## 📡 API 参考

### 文件上传

#### 单文件上传

```http
POST /api/v1/files/upload?folder=uploads
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: <file>
```

**响应：**
```json
{
  "id": "file-uuid",
  "name": "image.png",
  "url": "https://pub-xxx.r2.dev/uploads/tenant-id/123456-image.png",
  "r2Key": "uploads/tenant-id/123456-image.png",
  "mimeType": "image/png",
  "size": 1024000,
  "message": "File uploaded successfully"
}
```

#### 批量上传

```http
POST /api/v1/files/upload/batch?folder=uploads
Content-Type: multipart/form-data
Authorization: Bearer {token}

files: <file1>, <file2>, <file3>
```

**响应：**
```json
{
  "uploaded": [
    {
      "id": "file-uuid-1",
      "name": "image1.png",
      "url": "https://...",
      "mimeType": "image/png",
      "size": 1024000
    }
  ],
  "failed": [],
  "message": "Successfully uploaded 3 of 3 files"
}
```

### 文件列表

```http
GET /api/v1/files?page=1&limit=20&type=image&search=keyword
Authorization: Bearer {token}
```

**查询参数：**
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20）
- `type`: 文件类型筛选（image, document, video, audio, other）
- `search`: 搜索关键词
- `sort`: 排序方式（created_at, name, size）

**响应：**
```json
{
  "data": [
    {
      "id": "file-uuid",
      "name": "image.png",
      "url": "https://...",
      "mime_type": "image/png",
      "size": 1024000,
      "created_at": "2026-03-13T10:00:00Z",
      "folder": "uploads"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 文件信息

```http
GET /api/v1/files/:id
Authorization: Bearer {token}
```

### 文件下载

```http
GET /api/v1/files/:id/download
Authorization: Bearer {token}
```

### 文件删除

```http
DELETE /api/v1/files/:id
Authorization: Bearer {token}
```

### 更新文件元数据

```http
PUT /api/v1/files/:id
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "new-name.png",
  "folder": "new-folder"
}
```

---

## 🎨 图片处理

### 生成缩略图

```http
GET /api/v1/files/:id/thumbnail?width=200&height=200&fit=cover
Authorization: Bearer {token}
```

**参数：**
- `width`: 宽度（像素，默认 200）
- `height`: 高度（像素，默认 200）
- `fit`: 适配方式（cover, contain, fill）

### 图片变换

```http
POST /api/v1/files/:id/transform
Content-Type: application/json
Authorization: Bearer {token}

{
  "operations": [
    {
      "type": "resize",
      "width": 800,
      "height": 600
    },
    {
      "type": "crop",
      "x": 0,
      "y": 0,
      "width": 400,
      "height": 400
    },
    {
      "type": "rotate",
      "degrees": 90
    }
  ]
}
```

**支持的操作：**

1. **resize** - 缩放
   ```json
   { "type": "resize", "width": 800, "height": 600, "fit": "cover" }
   ```

2. **crop** - 裁剪
   ```json
   { "type": "crop", "x": 0, "y": 0, "width": 400, "height": 400 }
   ```

3. **rotate** - 旋转
   ```json
   { "type": "rotate", "degrees": 90 }
   ```

4. **flip** - 翻转
   ```json
   { "type": "flip", "horizontal": true, "vertical": false }
   ```

### 图片优化

```http
POST /api/v1/files/:id/optimize?quality=80&format=webp
Authorization: Bearer {token}
```

**参数：**
- `quality`: 质量 1-100（默认 80）
- `format`: 输出格式（webp, jpeg, png）

---

## 🖥️ 前端使用

### 文件管理页面

访问：`/admin/files`

#### 功能特性

1. **拖拽上传**
   - 支持拖拽文件到上传区域
   - 自动显示上传进度
   - 支持批量上传

2. **文件预览**
   - 图片文件直接预览
   - PDF 文件在线预览
   - 其他文件类型下载

3. **批量操作**
   - 多选文件
   - 批量下载
   - 批量删除

4. **图片编辑**
   - 生成缩略图
   - 图片变换
   - 图片优化

#### 使用示例

```vue
<template>
  <div>
    <!-- 上传按钮 -->
    <label class="btn btn-primary">
      📤 上传文件
      <input 
        type="file" 
        hidden 
        multiple 
        @change="handleFileUpload"
        accept="image/*,application/pdf,.doc,.docx"
      >
    </label>
    
    <!-- 文件列表 -->
    <div v-for="file in files" :key="file.id">
      <img :src="file.url" :alt="file.name">
      <h3>{{ file.name }}</h3>
      <p>{{ formatSize(file.size) }}</p>
      
      <!-- 操作按钮 -->
      <button @click="downloadFile(file)">下载</button>
      <button @click="copyUrl(file)">复制链接</button>
      <button @click="deleteFile(file)">删除</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'

const files = ref([])

onMounted(async () => {
  const response = await api.get('/files')
  files.value = response.data?.data || []
})

async function handleFileUpload(event) {
  const fileList = event.target.files
  const formData = new FormData()
  
  for (const file of fileList) {
    formData.append('files', file)
  }
  
  const response = await api.post('/files/upload/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  
  // 刷新文件列表
  await fetchFiles()
}

function formatSize(bytes) {
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>
```

---

## 🧪 测试

### 运行测试

```bash
# 运行文件管理测试
bun run test:files

# 运行所有测试
bun test

# 带覆盖率测试
bun test --coverage
```

### 手动测试

```bash
# 1. 上传测试文件
curl -X POST "http://localhost:3000/api/v1/files/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.png" \
  -F "folder=test"

# 2. 获取文件列表
curl "http://localhost:3000/api/v1/files" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 下载文件
curl "http://localhost:3000/api/v1/files/FILE_ID/download" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded-file.png

# 4. 生成缩略图
curl "http://localhost:3000/api/v1/files/FILE_ID/thumbnail?width=200&height=200" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o thumbnail.png

# 5. 图片变换
curl -X POST "http://localhost:3000/api/v1/files/FILE_ID/transform" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operations":[{"type":"resize","width":800,"height":600}]}'

# 6. 图片优化
curl -X POST "http://localhost:3000/api/v1/files/FILE_ID/optimize?quality=80&format=webp" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o optimized-image.webp
```

---

## 📊 数据库表结构

### files 表

```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    r2_key TEXT,
    checksum TEXT,
    uploaded_by TEXT,
    folder TEXT DEFAULT 'uploads',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_folder ON files(folder);
CREATE INDEX idx_files_mime_type ON files(mime_type);
CREATE INDEX idx_files_created ON files(created_at);
```

### file_transforms 表

```sql
CREATE TABLE file_transforms (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    operations TEXT,
    format TEXT,
    quality INTEGER,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_file_transforms_tenant ON file_transforms(tenant_id);
CREATE INDEX idx_file_transforms_source ON file_transforms(source_file_id);
```

---

## 🔒 安全考虑

### 文件类型限制

系统默认允许的文件类型：

**图片：**
- image/jpeg
- image/png
- image/gif
- image/webp
- image/svg+xml

**文档：**
- application/pdf
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document
- application/vnd.ms-excel
- application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- text/plain
- text/csv
- application/json

**多媒体：**
- video/mp4
- audio/mpeg

### 文件大小限制

- 单文件最大：50MB
- 批量上传最多：10 个文件
- 分片上传最大：500MB

### 租户隔离

- 每个租户的文件存储在独立的 R2 路径
- 数据库查询自动添加 tenant_id 过滤
- 中间件确保租户隔离

---

## 🚀 性能优化

### CDN 加速

1. 使用 Cloudflare R2 自带的 CDN
2. 配置公共存储桶获得全球加速
3. 设置合适的缓存策略

### 缓存策略

```http
Cache-Control: public, max-age=31536000
```

### 懒加载

前端图片使用懒加载：
```html
<img src="image.jpg" loading="lazy" alt="...">
```

### 缩略图

- 列表页使用缩略图而非原图
- 减少带宽消耗
- 提升加载速度

---

## 🛠️ 故障排查

### 常见问题

#### 1. 文件上传失败

**检查项：**
- R2 存储桶是否创建
- wrangler.toml 配置是否正确
- 文件大小是否超限
- 文件类型是否允许

#### 2. 文件无法访问

**检查项：**
- BUCKET_URL 是否配置
- 存储桶访问权限
- CORS 配置是否正确

#### 3. 图片处理失败

**检查项：**
- 文件是否为图片类型
- Cloudflare Images 服务是否启用
- 变换参数是否合法

### 日志查看

```bash
# 查看 Worker 日志
npx wrangler tail geekron-cms-server

# 查看实时日志
npx wrangler tail geekron-cms-server --format pretty
```

---

## 📈 监控与指标

### 关键指标

- 上传成功率
- 平均上传时间
- 存储空间使用量
- CDN 命中率
- 文件访问次数

### Cloudflare Analytics

在 Cloudflare Dashboard 查看：
- R2 存储用量
- 请求次数
- 带宽使用
- CDN 缓存命中率

---

## 🔮 未来计划

- [ ] 支持更多图片格式
- [ ] 视频缩略图生成
- [ ] 文件版本管理
- [ ] 文件分享链接
- [ ] 文件回收站
- [ ] 文件标签系统
- [ ] 文件夹管理
- [ ] 文件搜索增强

---

_文档版本：1.0.0_  
_更新时间：2026-03-13_
