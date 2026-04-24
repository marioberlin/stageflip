# apps/render-worker/Dockerfile
# T-231 — Cloud Run Job image for the render worker. Multi-stage;
# final image runs the worker once per task invocation.

FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .changeset ./.changeset

COPY apps/render-worker/package.json apps/render-worker/
COPY packages/export-html5-zip/package.json packages/export-html5-zip/
COPY packages/export-video/package.json packages/export-video/

RUN pnpm install --frozen-lockfile --filter "@stageflip/app-render-worker..."

COPY tsconfig.base.json biome.json ./
COPY apps/render-worker ./apps/render-worker
COPY packages ./packages

RUN pnpm --filter "@stageflip/app-render-worker" run build \
  && pnpm --filter "@stageflip/app-render-worker" deploy --prod --legacy /out

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /out ./
USER app

CMD ["node", "dist/bin.js"]
