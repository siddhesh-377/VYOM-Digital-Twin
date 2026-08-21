"""Shared fixtures and path setup for the VYOM backend test suite.

Runs pytest from the `vyom-backend/` directory. The backend modules use
top-level imports (`from engines...`) so `vyom-backend/` is placed on
`sys.path`. A dedicated SQLite database file is used so tests never touch
the real `vyom_missions.db`.
"""
import os
import sys
import tempfile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Must be set before `core.database` is imported (engine binds at import time).
_TEST_DB = os.path.join(tempfile.gettempdir(), "vyom_backend_tests.db")
os.environ.setdefault("VYOM_DATABASE_URL", f"sqlite:///{_TEST_DB}")


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def reset_state():
    """Isolate tests from each other: fresh DB tables and empty sim registry."""
    from core.database import Base, engine
    from simulation.loop import _simulations

    # Clear any running simulations first so DB tables are not in use.
    _simulations.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    _simulations.clear()