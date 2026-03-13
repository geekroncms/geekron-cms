# E2E 测试执行指南

**创建时间**: 2026-03-12  
**测试框架**: Playwright  
**测试文件**: 18 个（8 功能 + 5 响应式 + 5 Page Object）

---

## 📋 前置条件

### 1. 安装依赖

```bash
cd /root/.openclaw/workspace/geekron-cms
bun install
```

### 2. 安装 Playwright 浏览器

```bash
cd packages/admin
bunx playwright install
```

### 3. 启动开发服务器

```bash
# 终端 1: 启动后端
cd packages/server
bun run dev

# 终端 2: 启动前端
cd packages/admin
bun run dev
```

---

## 🚀 运行 E2E 测试

### 方式 1: 运行所有测试

```bash
cd packages/admin
bun run test:e2e
```

### 方式 2: UI 模式（推荐首次使用）

```bash
bun run test:e2e:ui
```

### 方式 3: 运行特定测试

```bash
# 运行认证测试
bunx playwright test e2e/auth.spec.ts

# 运行租户管理测试
bunx playwright test e2e/tenants.spec.ts

# 运行响应式测试
bunx playwright test e2e/responsive/

# 运行特定浏览器
bunx playwright test --project=chromium
```

### 方式 4: 调试模式

```bash
# 带调试器运行
bunx playwright test --debug

# 慢速模式（观察测试执行）
bunx playwright test --slow
```

---

## 📊 测试设备配置

### 已配置设备（12 种）

| 设备类型 | 设备名称        | 分辨率    |
| -------- | --------------- | --------- |
| **桌面** | Desktop Chrome  | 1920x1080 |
| **桌面** | Desktop Firefox | 1920x1080 |
| **桌面** | Desktop Safari  | 1920x1080 |
| **手机** | Mobile Chrome   | 393x852   |
| **手机** | Mobile Safari   | 430x932   |
| **平板** | iPad            | 1024x1366 |

### 响应式断点测试

- **Mobile**: 375x667 (375px+)
- **Tablet**: 768x1024 (768px+)
- **Desktop**: 1366x768 (1366px+)
- **Large**: 1920x1080 (1920px+)

---

## 📁 测试文件清单

### 功能测试（8 个）

| 文件                      | 行数 | 测试内容             |
| ------------------------- | ---- | -------------------- |
| `e2e/auth.spec.ts`        | 70   | 登录/登出/Token 刷新 |
| `e2e/dashboard.spec.ts`   | 59   | Dashboard 页面       |
| `e2e/tenants.spec.ts`     | 102  | 租户管理 CRUD        |
| `e2e/users.spec.ts`       | 105  | 用户管理 CRUD        |
| `e2e/collections.spec.ts` | 135  | 数据模型管理         |
| `e2e/content.spec.ts`     | 111  | 内容管理 CRUD        |
| `e2e/api-keys.spec.ts`    | 129  | API Key 管理         |
| `e2e/quotas.spec.ts`      | 102  | 配额管理             |

### 响应式测试（5 个）

| 文件                                | 行数 | 测试内容     |
| ----------------------------------- | ---- | ------------ |
| `e2e/responsive/layout.spec.ts`     | 298  | 布局响应式   |
| `e2e/responsive/navigation.spec.ts` | 262  | 导航响应式   |
| `e2e/responsive/tables.spec.ts`     | 252  | 表格响应式   |
| `e2e/responsive/forms.spec.ts`      | 291  | 表单响应式   |
| `e2e/responsive/modals.spec.ts`     | 337  | 模态框响应式 |

### Page Object（8 个）

- `LoginPage.ts` - 登录页
- `DashboardPage.ts` - Dashboard
- `TenantsPage.ts` - 租户管理
- `UsersPage.ts` - 用户管理
- `CollectionsPage.ts` - 数据模型
- `ContentPage.ts` - 内容管理
- `ApiKeysPage.ts` - API Key 管理
- `QuotasPage.ts` - 配额管理

---

## 📈 测试报告

### 查看 HTML 报告

```bash
bunx playwright show-report
```

### 报告内容

- 测试执行时间
- 截图（失败时自动保存）
- 录屏（失败时自动保存）
- 每个测试的详细日志

---

## ✅ 测试检查清单

### 功能测试

- [ ] 登录流程正常
- [ ] Dashboard 数据显示正确
- [ ] 租户 CRUD 操作正常
- [ ] 用户管理功能正常
- [ ] 数据模型管理正常
- [ ] 内容管理 CRUD 正常
- [ ] API Key 管理正常
- [ ] 配额管理正常

### 响应式测试

- [ ] 手机布局正确（iPhone 14 Pro/Max）
- [ ] 平板布局正确（iPad）
- [ ] 桌面布局正确（1920x1080）
- [ ] 导航菜单响应式正常
- [ ] 表格响应式正常（卡片视图）
- [ ] 表单响应式正常
- [ ] 模态框响应式正常

### 性能测试

- [ ] 页面加载时间 < 2s
- [ ] 交互响应时间 < 100ms
- [ ] 无内存泄漏

---

## ⚠️ 常见问题

### 问题 1: 无法连接开发服务器

**错误**: `Error: connect ECONNREFUSED 127.0.0.1:5173`

**解决**:

```bash
# 确保前端开发服务器已启动
cd packages/admin
bun run dev
```

### 问题 2: 浏览器未安装

**错误**: `Executable doesn't exist at /root/.cache/ms-playwright/...`

**解决**:

```bash
bunx playwright install
```

### 问题 3: 测试超时

**错误**: `Test timeout of 30000ms exceeded`

**解决**:

```bash
# 增加超时时间
bunx playwright test --timeout=60000

# 或修改 playwright.config.ts
```

### 问题 4: 认证失败

**错误**: 登录后立即被踢出

**解决**:

- 检查后端开发服务器是否运行
- 检查 JWT_SECRET 环境变量
- 检查数据库连接

---

## 🎯 预期结果

### 通过后

```
✓ 所有功能测试通过
✓ 所有响应式测试通过
✓ 无视觉回归问题
✓ 性能指标达标
```

### 失败处理

1. 查看 HTML 报告中的截图和录屏
2. 检查错误日志
3. 使用 `--debug` 模式重现问题
4. 修复后重新运行失败的测试

---

## 📝 下一步

1. **启动开发服务器**
2. **运行 E2E 测试**
3. **查看测试报告**
4. **修复失败测试**
5. **提交测试报告**

---

**准备就绪！可以开始运行 E2E 测试了！** 🚀
