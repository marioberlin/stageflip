# services/cv-worker/pipeline/__init__.py
# Pipeline package — exposes the top-level orchestrator.

from .compose import detect_candidates

__all__ = ["detect_candidates"]
