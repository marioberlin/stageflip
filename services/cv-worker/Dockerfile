# services/cv-worker/Dockerfile
# T-244-cv-worker — Cloud Run image for the CV sidecar. Multi-stage:
#   builder  : install Python deps into a venv (build cache layer)
#   runtime  : copy the venv + app source; non-root user; uvicorn entrypoint
#
# Image size: ~1.5 GB without SAM 2; ~3.5 GB with SAM 2 enabled.

FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# OpenCV needs libgl + libglib for cv2 to import; PaddlePaddle needs libgomp.
# Pin via apt-get update / install, then clean to keep the layer small.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ---------------------------------------------------------------------------

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8080 \
    ENABLE_SAM2=false \
    MAX_IMAGE_SIZE_BYTES=5242880

WORKDIR /app

# Runtime libs only — no build-essential.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home /app --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

COPY app.py schemas.py ./
COPY pipeline ./pipeline

USER app

EXPOSE 8080

# Cloud Run injects $PORT; honor it. Single worker keeps memory bounded; Cloud
# Run scales horizontally via concurrent instances.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
