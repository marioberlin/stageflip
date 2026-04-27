# services/cv-worker/tests/test_deploy_script.py
# AC #18, #19, #20: scripts/deploy-cv-worker.sh shape contract.

from __future__ import annotations

import os
import shutil
import stat
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "deploy-cv-worker.sh"


def test_deploy_script_exists() -> None:
    """AC #18: the script is present at the documented path."""
    assert DEPLOY_SCRIPT.is_file(), f"deploy script not found at {DEPLOY_SCRIPT}"


def test_deploy_script_executable() -> None:
    """AC #18: the script is executable."""
    mode = DEPLOY_SCRIPT.stat().st_mode
    assert mode & stat.S_IXUSR, "deploy script must be executable (chmod +x)"


def test_deploy_script_uses_strict_mode() -> None:
    """AC #18: `set -euo pipefail` for strict-mode safety."""
    body = DEPLOY_SCRIPT.read_text()
    assert "set -euo pipefail" in body, "deploy script must enable strict mode"


def test_deploy_script_documents_required_env() -> None:
    """AC #19: GCP_PROJECT_ID is required and fail-fast."""
    body = DEPLOY_SCRIPT.read_text()
    assert "${GCP_PROJECT_ID:?" in body, (
        "deploy script must fail-fast when GCP_PROJECT_ID is unset (use ${VAR:?})"
    )


def test_deploy_script_includes_cloud_run_flags() -> None:
    """AC #20: gcloud run deploy invocation contains the documented flags."""
    body = DEPLOY_SCRIPT.read_text()
    required_flags = [
        "--image=",
        "--region=",
        "--platform=managed",
        "--memory=4Gi",
        "--cpu=2",
        "--concurrency=80",
        "--min-instances=",
        "--max-instances=",
        "--timeout=120",
        "--no-allow-unauthenticated",
    ]
    for flag in required_flags:
        assert flag in body, f"deploy script missing required flag: {flag}"


@pytest.mark.skipif(
    shutil.which("bash") is None,
    reason="bash not available",
)
def test_deploy_script_fails_fast_without_project_id() -> None:
    """AC #19: invoking without GCP_PROJECT_ID exits non-zero."""
    env = os.environ.copy()
    env.pop("GCP_PROJECT_ID", None)
    proc = subprocess.run(
        ["bash", str(DEPLOY_SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert proc.returncode != 0, "expected non-zero exit when GCP_PROJECT_ID is unset"
    assert "GCP_PROJECT_ID" in (proc.stderr + proc.stdout)


@pytest.mark.skipif(
    shutil.which("shellcheck") is None,
    reason="shellcheck not installed",
)
def test_deploy_script_passes_shellcheck() -> None:
    """AC #18 (shellcheck): deploy script is shellcheck-clean."""
    proc = subprocess.run(
        ["shellcheck", str(DEPLOY_SCRIPT)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, f"shellcheck failed:\n{proc.stdout}\n{proc.stderr}"
