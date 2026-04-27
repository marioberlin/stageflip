# services/cv-worker/tests/conftest.py
# Test config — adds the service directory to sys.path so `import app` /
# `import schemas` work without packaging the service as a Python distribution.

from __future__ import annotations

import os
import sys
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

# Default to SAM 2 disabled in the test environment.
os.environ.setdefault("ENABLE_SAM2", "false")
