"""
SPIRAL Execution Tool
Run Python files and capture stdout/stderr safely.
Uses the same Python interpreter that launched SPIRAL.
"""

import subprocess
import sys
import os
from dataclasses import dataclass
import config


@dataclass
class ExecResult:
    """Result from code execution."""
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool = False

    @property
    def success(self) -> bool:
        return self.returncode == 0

    @property
    def output(self) -> str:
        """Combined output for agent consumption."""
        parts = []
        if self.stdout.strip():
            parts.append(f"[STDOUT]\n{self.stdout.strip()}")
        if self.stderr.strip():
            parts.append(f"[STDERR]\n{self.stderr.strip()}")
        if self.timed_out:
            parts.append("[TIMEOUT] Execution timed out.")
        if not parts:
            parts.append("[NO_OUTPUT]")
        return "\n".join(parts)


def run_python(filepath: str, timeout: int = None) -> ExecResult:
    """
    Run a Python file using the same interpreter as SPIRAL.

    Args:
        filepath: Path to .py file
        timeout: Max seconds (defaults to config.EXEC_TIMEOUT)

    Returns:
        ExecResult with stdout, stderr, and return code
    """
    timeout = timeout or config.EXEC_TIMEOUT
    abs_path = os.path.abspath(filepath)

    if not os.path.exists(abs_path):
        return ExecResult(stdout="", stderr=f"File not found: {abs_path}", returncode=1)

    if not abs_path.endswith('.py'):
        return ExecResult(stdout="", stderr=f"Not a Python file: {abs_path}", returncode=1)

    try:
        python_exe = config.PYTHON_EXE or sys.executable
        result = subprocess.run(
            [python_exe, abs_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.getcwd(),  # Use workspace root, not file directory
            env={**os.environ},  # Inherit environment
        )
        return ExecResult(
            stdout=result.stdout,
            stderr=result.stderr,
            returncode=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return ExecResult(stdout="", stderr=f"Execution timed out after {timeout}s", returncode=-1, timed_out=True)
    except FileNotFoundError:
        return ExecResult(stdout="", stderr=f"Python not found at: {python_exe}", returncode=-1)
    except Exception as e:
        return ExecResult(stdout="", stderr=f"Execution error: {str(e)}", returncode=-1)


def run_code_string(code: str, timeout: int = None) -> ExecResult:
    """Execute a Python code string directly."""
    timeout = timeout or config.EXEC_TIMEOUT
    try:
        python_exe = config.PYTHON_EXE or sys.executable
        result = subprocess.run(
            [python_exe, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.getcwd(),  # Use workspace root consistently
        )
        return ExecResult(stdout=result.stdout, stderr=result.stderr, returncode=result.returncode)
    except subprocess.TimeoutExpired:
        return ExecResult(stdout="", stderr=f"Timed out after {timeout}s", returncode=-1, timed_out=True)
    except Exception as e:
        return ExecResult(stdout="", stderr=str(e), returncode=-1)
