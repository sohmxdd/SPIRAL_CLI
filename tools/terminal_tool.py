"""
SPIRAL Terminal Tool
Safe shell command execution with allowlist filtering.
"""

import subprocess
import shlex
import os
import platform
from dataclasses import dataclass
import config
from tools.exec_tool import ExecResult


def _is_safe_command(cmd: str) -> bool:
    """Check if a command's base program is in the safety allowlist."""
    try:
        if platform.system() == "Windows":
            parts = cmd.strip().split()
        else:
            parts = shlex.split(cmd)

        if not parts:
            return False

        base_cmd = os.path.basename(parts[0]).lower()
        # Strip .exe on Windows
        if base_cmd.endswith('.exe'):
            base_cmd = base_cmd[:-4]

        return base_cmd in config.SAFE_COMMANDS
    except Exception:
        return False


def run_command(cmd: str, timeout: int = None, force: bool = False) -> ExecResult:
    """
    Execute a shell command safely.

    Args:
        cmd: Shell command string
        timeout: Max seconds (defaults to config.EXEC_TIMEOUT)
        force: Skip safety check (use with caution)

    Returns:
        ExecResult with stdout, stderr, return code
    """
    timeout = timeout or config.EXEC_TIMEOUT

    if not force and not _is_safe_command(cmd):
        return ExecResult(
            stdout="",
            stderr=f"[BLOCKED] Command not in allowlist: {cmd}\nAllowed: {', '.join(config.SAFE_COMMANDS)}",
            returncode=-1,
        )

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.getcwd(),
        )

        return ExecResult(
            stdout=result.stdout,
            stderr=result.stderr,
            returncode=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return ExecResult(
            stdout="",
            stderr=f"Command timed out after {timeout}s",
            returncode=-1,
            timed_out=True,
        )
    except Exception as e:
        return ExecResult(
            stdout="",
            stderr=str(e),
            returncode=-1,
        )
