# services/blender-worker/Dockerfile
# T-265 — Bake worker image. Multi-stage:
#   builder  : install Node deps + tsc-build the worker
#   runtime  : Blender 4.2 LTS + Python 3.11 + the built JS bundle
#
# Image size target: <4 GB after stripping (T-265 escalation trigger). Blender
# 4.2 LTS itself is ~600 MB; CUDA runtime libs are ~1.5 GB; remaining budget
# is Node + node_modules.

# --- builder ---------------------------------------------------------------

FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME="/usr/local/pnpm" \
    PATH="/usr/local/pnpm:$PATH"

RUN corepack enable

WORKDIR /build

# Copy the workspace manifest + lockfile so we can install deps with the
# repo's pinned versions. The full source is COPYed below.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY services/blender-worker/package.json services/blender-worker/tsconfig.json ./services/blender-worker/
COPY packages/runtimes/blender/package.json ./packages/runtimes/blender/
COPY packages/runtimes/contract/package.json ./packages/runtimes/contract/
COPY packages/schema/package.json ./packages/schema/
COPY packages/auth-schema/package.json ./packages/auth-schema/

# Sources required for tsc.
COPY services/blender-worker/src ./services/blender-worker/src
# Non-TS assets the runtime stage copies out of the builder layer
# (see `COPY --from=builder ... /scripts` and `/templates` below). Without
# these, the runtime-stage COPYs fail on a fresh image build.
COPY services/blender-worker/scripts ./services/blender-worker/scripts
COPY services/blender-worker/templates ./services/blender-worker/templates
COPY packages/runtimes/blender ./packages/runtimes/blender
COPY packages/runtimes/contract ./packages/runtimes/contract
COPY packages/schema ./packages/schema
COPY packages/auth-schema ./packages/auth-schema

RUN pnpm install --frozen-lockfile --filter @stageflip/blender-worker...
# Build workspace deps first so the worker's tsc can resolve their dist/.
# `@stageflip/runtimes-blender` exports point at ./dist/index.d.ts; without
# an explicit build the worker fails with TS2307.
RUN pnpm --filter @stageflip/runtimes-blender build
RUN pnpm --filter @stageflip/blender-worker build

# --- runtime --------------------------------------------------------------

FROM debian:bookworm-slim AS runtime

ENV NODE_ENV=production \
    BLENDER_VERSION=4.2.3 \
    DEBIAN_FRONTEND=noninteractive

# System libs Blender needs at runtime (xrender, libsm, etc.) plus the
# Python interpreter Blender invokes for our render.py.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        xz-utils \
        libxrender1 \
        libxi6 \
        libxxf86vm1 \
        libxfixes3 \
        libxkbcommon0 \
        libsm6 \
        libgl1 \
        libglu1-mesa \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node 22 (Debian's default is too old).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Blender 4.2 LTS. Pinned to a specific patch so the image is
# reproducible; bump in lockstep with the determinism contract.
RUN curl -fsSL "https://download.blender.org/release/Blender4.2/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
    -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz

ENV PATH="/opt/blender:${PATH}"

WORKDIR /app

# Copy the built JS + node_modules from the builder.
COPY --from=builder /build/services/blender-worker/dist ./dist
COPY --from=builder /build/services/blender-worker/node_modules ./node_modules
COPY --from=builder /build/services/blender-worker/package.json ./package.json
COPY --from=builder /build/services/blender-worker/scripts ./scripts
COPY --from=builder /build/services/blender-worker/templates ./templates

# Non-root user.
RUN groupadd --system app && useradd --system --gid app --home /app --shell /usr/sbin/nologin app
USER app

CMD ["node", "./dist/main.js"]
