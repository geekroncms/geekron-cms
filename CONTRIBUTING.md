# 贡献指南

感谢你对 Geekron CMS 项目的关注！本文档将指导你如何参与项目贡献。

## 📋 目录

- [行为准则](#行为准则)
- [开发环境设置](#开发环境设置)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request](#pull-request)

## 行为准则

- 保持专业和尊重的沟通
- 专注于技术讨论，避免人身攻击
- 欢迎不同观点，但以建设性方式表达

## 开发环境设置

### 1. 克隆项目

```bash
git clone https://github.com/GeekronCMS/geekron-cms.git
cd geekron-cms
```

### 2. 安装依赖

```bash
bun install
```

### 3. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

### 4. 启动开发服务器

```bash
bun run dev
```

### 5. 运行测试

```bash
bun test
```

## 开发流程

### 分支管理

我们采用 Git Flow 工作流：

- `main` - 生产环境代码
- `develop` - 开发分支
- `feature/*` - 新功能分支
- `bugfix/*` - Bug 修复分支
- `release/*` - 发布分支

### 开发步骤

1. **从 develop 创建功能分支**
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/your-feature-name
   ```

2. **开发和测试**
   - 编写代码
   - 运行测试确保通过
   - 运行 linter 检查代码风格

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **推送到远程**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 PR 到 `develop` 分支
   - 填写详细的 PR 描述
   - 等待 Code Review

## 代码规范

### TypeScript

- 使用严格模式
- 为函数和变量添加明确的类型注解
- 避免使用 `any`，必要时使用 `unknown`
- 使用接口定义对象结构

### 代码风格

我们使用 ESLint 和 Prettier 统一代码风格：

```bash
# 检查代码
bun run lint

# 自动修复格式问题
bun run lint -- --fix
```

### 命名规范

- 文件和目录：kebab-case (`user-profile.ts`)
- 类和组件：PascalCase (`UserProfile`)
- 函数和变量：camelCase (`getUserInfo`)
- 常量：UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- 类型和接口：PascalCase (`UserInfo`, `IUser`)

## 提交规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交类型

- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是 Bug 修复）
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具变动

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 示例

```bash
feat(server): add tenant management API

- Add create tenant endpoint
- Add update tenant endpoint
- Add delete tenant endpoint

Closes #123
```

## Pull Request

### PR 检查清单

在提交 PR 前，请确保：

- [ ] 代码通过所有测试
- [ ] 代码通过 ESLint 检查
- [ ] 添加了必要的单元测试
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] PR 描述清晰完整

### PR 描述模板

```markdown
## 变更说明
简要描述此 PR 的变更内容

## 相关 Issue
Closes #issue_number

## 测试计划
描述如何测试这些变更

## 截图（如适用）
添加相关截图
```

## 代码审查

所有 PR 都需要经过至少一位维护者的审查。审查要点：

- 代码功能正确性
- 代码质量和可读性
- 测试覆盖率
- 性能影响
- 安全性

## 发布流程

1. 合并到 `develop` 分支
2. 创建 `release/*` 分支
3. 更新版本号和变更日志
4. 测试验证
5. 合并到 `main` 并打标签
6. 部署到生产环境

## 问题反馈

发现问题？请创建 Issue 并包含：

- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（系统、Node/Bun 版本等）

## 许可证

通过贡献代码，你同意你的贡献遵循项目的 MIT 许可证。

---

感谢你的贡献！🦞
