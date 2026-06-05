"""Shared pytest fixtures for the OpsPilot backend test suite."""

import json
import sys
from pathlib import Path

import pytest

# Make the backend package importable when tests run from repo root or backend/.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

DEMO_GRAPH_PATH = BACKEND_ROOT.parent / "demo" / "demo_graph.json"


@pytest.fixture(scope="session")
def demo_graph_raw() -> dict:
    return json.loads(DEMO_GRAPH_PATH.read_text(encoding="utf-8"))
