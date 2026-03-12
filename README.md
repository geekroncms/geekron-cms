# Geekron CMS

基于 Cloudflare Workers + Bun + Vue3 的多租户 SaaS CMS 系统。

[![CI](https://github.com/GeekronCMS/geekron-cms/actions/workflows/ci.yml/badge.svg)](https://github.com/GeekronCMS/geekron-cms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-blue)](https://bun.sh)

## 📖 目录

- [特性](#特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [部署](#部署)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [贡献](#贡献)
- [许可证](#许可证)

## ✨ 特性

- 🏢 **多租户架构** - 完整的多租户支持，数据隔离
- ⚡ **高性能** - 基于 Cloudflare Workers 边缘计算
- 🔒 **安全可靠** - JWT 认证，数据加密
- 🎨 **可定制** - 动态数据模型引擎
- 📦 **易于部署** - 一键部署到 Cloudflare
- 🛠️ **开发友好** - TypeScript + 热重载 + 完整工具链

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Cloudflare CDN                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Server    │  │    Admin    │  │     SDK     │         │
│  │   (Hono)    │  │   (Vue3)    │  │  (Client)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  D1 (SQL)   │      │  R2 Store   │      │   KV Cache  │
│  Database   │      │   Files     │      │   Session   │
└─────────────┘      └─────────────┘      └─────────────┘
```

### 技术组件

| 组件 | 技术 | 用途 |
|------|------|------|
| 后端运行时 | Cloudflare Workers | 边缘计算 |
| 后端框架 | Hono | API 路由 |
| 前端框架 | Vue 3 | 管理后台 |
| 数据库 | D1 + Supabase | 数据存储 |
| 文件存储 | R2 + OSS | 文件管理 |
| 缓存 | KV | 会话/缓存 |
| 语言 | TypeScript | 类型安全 |
| 包管理 | Bun | 快速安装 |

## 🚀 快速开始

### 环境要求

- **Bun** >= 1.0 ([安装指南](https://bun.sh))
- **Git** >= 2.0
- **Docker** (可选，用于本地数据库)

### 1. 克隆项目

```bash
git clone https://github.com/GeekronCMS/geekron-cms.git
cd geekron-cms
```

### 2. 初始化项目

```bash
# 运行初始化脚本
bun run init

# 或手动执行
bun install
cp .env.example .env
```

### 3. 配置环境

编辑 `.env` 文件，填入必要的配置：

```bash
# Cloudflare 配置
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# 数据库配置
D1_DATABASE_ID=your_d1_id

# 其他配置...
```

### 4. 创建 Cloudflare 资源

```bash
# 创建 D1 数据库
wrangler d1 create geekron-cms-db
wrangler d1 create geekron-cms-db-staging
wrangler d1 create geekron-cms-db-production

# 创建 R2 存储桶
wrangler r2 bucket create geekron-cms-files

# 创建 KV 命名空间
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview
```

将创建的 ID 填入 `wrangler.toml`。

### 5. 启动开发服务器

```bash
# 启动本地基础设施（可选）
docker-compose up -d

# 启动开发服务器
bun run dev
```

访问：
- 管理后台：http://localhost:5173
- API 服务：http://localhost:8787

## 📝 开发指南

### 项目结构

```
geekron-cms/
├── packages/
│   ├── server/          # 后端 API 服务
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/  # API 路由
│   │   │   ├── db/      # 数据库
│   │   │   └── utils/   # 工具函数
│   │   └── package.json
│   ├── admin/           # 管理后台前端
│   │   ├── src/
│   │   │   ├── views/   # 页面
│   │   │   ├── components/
│   │   │   └── stores/  # Pinia stores
│   │   └── package.json
│   └── sdk/             # 客户端 SDK
├── infra/               # 基础设施配置
├── scripts/             # 工具脚本
├── docs/                # 文档
├── .github/             # GitHub 配置
└── docker/              # Docker 配置
```

### 常用命令

```bash
# 开发
bun run dev              # 启动所有服务
bun run dev:server       # 仅启动后端
bun run dev:admin        # 仅启动前端

# 构建
bun run build            # 构建所有
bun run build:server     # 构建后端
bun run build:admin      # 构建前端

# 测试
bun test                 # 运行测试
bun test --coverage      # 测试覆盖率

# 代码质量
bun run lint             # ESLint 检查
bun run lint:fix         # 自动修复
bun run format           # Prettier 格式化
bun run typecheck        # TypeScript 检查

# 数据库
bun run db:migrate       # 执行迁移
bun run db:seed          # 填充测试数据
bun run db:reset         # 重置数据库

# 部署
bun run deploy           # 部署到默认环境
bun run deploy:staging   # 部署到 staging
bun run deploy:production # 部署到 production

# 版本管理
bun run version show     # 查看版本
bun run version bump patch # 增加补丁版本
```

### 开发规范

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- 所有代码必须通过 ESLint 和 TypeScript 检查
- 新功能需要添加单元测试
- PR 需要至少一位维护者审查

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚀 部署

### 手动部署

```bash
# 部署到 Staging
bun run deploy:staging

# 部署到 Production
bun run deploy:production
```

### GitHub Actions 自动部署

项目配置了 CI/CD 流程：

- **Push to develop**: 自动部署到 Staging
- **Push to main**: 自动部署到 Production
- **Create tag**: 创建 Release 并部署

配置 Secrets：
```
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | ✅ |
| `D1_DATABASE_ID` | D1 数据库 ID | ✅ |
| `R2_BUCKET_NAME` | R2 存储桶名称 | ✅ |
| `JWT_SECRET` | JWT 密钥 | ✅ |
| `NODE_ENV` | 环境 (development/production) | ❌ |

## 📦 技术栈

### 后端

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: D1 (SQLite), Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Auth**: JWT (jose)

### 前端

- **Framework**: Vue 3
- **State**: Pinia
- **Router**: Vue Router
- **UI**: TailwindCSS
- **HTTP**: Axios

### 工具

- **Runtime**: Bun
- **Language**: TypeScript
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Bun Test
- **Deploy**: Wrangler

## 📚 文档

- [API 文档](./docs/API.md)
- [OpenAPI 规范](./docs/openapi.yaml)
- [贡献指南](./CONTRIBUTING.md)

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 👥 团队

- **创始人**: 欧阳浩
- **联系**: oyhemail@163.com
- **公司**: 深圳市极客领航科技有限公司

---

**Made with ❤️ by GeekronCMS Team**
