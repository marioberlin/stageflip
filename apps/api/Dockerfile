# apps/api/Dockerfile
# T-231 — Cloud Run container image for @stageflip/app-api.
# Multi-stage: build the workspace once, copy only runtime artifacts
# into a distroless-ish final image.

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /repo

# Install pnpm via corepack (pinned by packageManager field).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy manifests first for cache efficiency.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .changeset ./.changeset

# Workspace manifests — the publishable closure plus firebase.
COPY apps/api/package.json apps/api/
COPY packages/engine/package.json packages/engine/
COPY packages/llm-abstraction/package.json packages/llm-abstraction/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/rir/package.json packages/rir/
COPY packages/runtimes/contract/package.json packages/runtimes/contract/
COPY packages/schema/package.json packages/schema/
COPY packages/skills-core/package.json packages/skills-core/
COPY packages/skills-sync/package.json packages/skills-sync/
COPY packages/validation/package.json packages/validation/

RUN pnpm install --frozen-lockfile --filter "@stageflip/app-api..."

# Source + build.
COPY tsconfig.base.json biome.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm --filter "@stageflip/mcp-server..." run build \
  && pnpm --filter "@stageflip/app-api" run build \
  && pnpm --filter "@stageflip/app-api" deploy --prod --legacy /out

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Drop root.
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /out ./
USER app

EXPOSE 8080
CMD ["node", "dist/bin.js"]
