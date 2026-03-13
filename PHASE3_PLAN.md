# 阶段三：数据模型引擎开发计划

**阶段目标**: 实现租户自定义数据模型和动态 CRUD API 生成

**预计工时**: 6-8 小时（AI agent 并行开发）

**开始时间**: 2026-03-12 23:30 UTC

---

## 📋 任务分解（WBS）

### 3.1 元数据管理系统（P0 - 2 小时）
**子任务**:
- [ ] 数据库迁移：创建 metadata 相关表
- [ ] 后端 API：元数据 CRUD 接口
- [ ] 元数据缓存机制
- [ ] 单元测试

**负责人**: dev-backend

**输出**:
- `infra/migrations/006_metadata.sql`
- `packages/server/src/routes/metadata.ts`
- `packages/server/tests/metadata.test.ts`

---

### 3.2 动态 CRUD API（P0 - 2 小时）
**子任务**:
- [ ] 动态路由生成器
- [ ] 通用 CRUD 服务
- [ ] 查询构建器增强
- [ ] 数据验证中间件
- [ ] 单元测试

**负责人**: dev-backend

**输出**:
- `packages/server/src/services/dynamic-crud.ts`
- `packages/server/src/middleware/data-validation.ts`
- `packages/server/tests/dynamic-crud.test.ts`

---

### 3.3 字段类型系统（P0 - 1.5 小时）
**子任务**:
- [ ] 字段类型定义（text/number/boolean/date/json/relation）
- [ ] 类型验证器
- [ ] 默认值处理
- [ ] 类型转换工具

**负责人**: dev-fullstack

**输出**:
- `packages/server/src/utils/field-types.ts`
- `packages/server/src/validators/`

---

### 3.4 关系管理（P1 - 1.5 小时）
**子任务**:
- [ ] 一对多关系支持
- [ ] 多对多关系支持
- [ ] 关系查询优化
- [ ] 级联操作

**负责人**: dev-fullstack

**输出**:
- `packages/server/src/services/relations.ts`
- `packages/server/tests/relations.test.ts`

---

### 3.5 数据验证引擎（P1 - 1 小时）
**子任务**:
- [ ] Zod 规则动态生成
- [ ] 自定义验证规则
- [ ] 错误消息国际化
- [ ] 验证性能优化

**负责人**: dev-backend

**输出**:
- `packages/server/src/validators/dynamic-validator.ts`
- `packages/server/tests/validator.test.ts`

---

## 🎯 验收标准

### 功能验收
- [ ] 租户可创建自定义数据模型
- [ ] 可添加/编辑/删除字段
- [ ] 自动生成 CRUD API 端点
- [ ] 支持所有字段类型
- [ ] 关系查询正常工作
- [ ] 数据验证生效

### 测试验收
- [ ] 单元测试覆盖率 >85%
- [ ] 集成测试通过
- [ ] E2E 测试更新

### 文档验收
- [ ] API 文档更新
- [ ] 使用指南编写
- [ ] 示例代码提供

---

## 📦 交付物清单

### 后端代码
- [ ] `routes/metadata.ts` - 元数据管理 API
- [ ] `services/dynamic-crud.ts` - 动态 CRUD 服务
- [ ] `services/relations.ts` - 关系管理
- [ ] `middleware/data-validation.ts` - 数据验证
- [ ] `utils/field-types.ts` - 字段类型工具
- [ ] `validators/` - 验证器目录

### 数据库迁移
- [ ] `006_metadata.sql` - 元数据表结构

### 测试代码
- [ ] `tests/metadata.test.ts`
- [ ] `tests/dynamic-crud.test.ts`
- [ ] `tests/relations.test.ts`
- [ ] `tests/validator.test.ts`

### 文档
- [ ] `docs/METADATA_API.md`
- [ ] `docs/DYNAMIC_CRUD.md`
- [ ] `examples/` - 使用示例

---

## ⏱️ 时间规划

| 时间段 | 任务 | 负责人 |
|--------|------|--------|
| 23:30 - 01:30 | 元数据管理系统 | dev-backend |
| 23:30 - 01:30 | 动态 CRUD API | dev-backend |
| 01:30 - 03:00 | 字段类型系统 | dev-fullstack |
| 01:30 - 03:00 | 关系管理 | dev-fullstack |
| 03:00 - 04:00 | 数据验证引擎 | dev-backend |
| 04:00 - 05:00 | 集成测试 | 全体 |
| 05:00 - 06:00 | 文档编写 | 全体 |

**预计完成**: 2026-03-13 05:30 UTC（约 6 小时）

---

## 🚀 开发流程

```
1. 创建开发分支
   ↓
2. 并行开发子任务
   ↓
3. 单元测试验证
   ↓
4. 集成测试
   ↓
5. 合并到 develop
   ↓
6. 创建 PR
```

---

## 📢 汇报机制

**每个子任务完成后在群里同步**:
- ✅ 完成内容
- 📦 输出物
- ⚠️ 遇到的问题
- ➡️ 下一步计划

**阶段完成后**:
- 汇总所有交付物
- 运行完整测试套件
- 合并到 develop 分支
- 创建 Pull Request

---

**开始执行！** 🚀
