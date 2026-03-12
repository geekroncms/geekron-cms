# Geekron CMS Server Dockerfile
# 用于本地开发和测试

FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖
FROM base AS install
COPY package.json bun.lockb* ./
COPY packages/server/package.json ./packages/server/
COPY packages/admin/package.json ./packages/admin/
COPY packages/sdk/package.json ./packages/sdk/
RUN bun install --frozen-lockfile || bun install

# 构建
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

# 生产镜像
FROM base AS release
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "dist/server/index.js"]
