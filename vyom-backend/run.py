"""VYOM Backend — One-command startup script."""
import subprocess, sys, os

os.chdir(os.path.dirname(__file__))
subprocess.run([
    sys.executable, "-m", "uvicorn", "main:app",
    "--host", "0.0.0.0",
    "--port", "8000",
    "--reload",
    "--log-level", "info",
])
