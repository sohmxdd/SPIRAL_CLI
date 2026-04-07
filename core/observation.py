"""
SPIRAL Observation Layer
Structures execution outputs for agent consumption.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class Observation:
    """Structured observation from a tool execution."""

    stdout: str = ""
    stderr: str = ""
    returncode: int = 0
    files_changed: List[str] = field(default_factory=list)
    action_type: str = ""          # write_file, execute, shell, etc.
    action_detail: str = ""        # What was done
    duration_ms: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def success(self) -> bool:
        return self.returncode == 0

    @property
    def has_error(self) -> bool:
        return bool(self.stderr.strip()) or self.returncode != 0

    @property
    def error_summary(self) -> str:
        """Extract brief error summary for display."""
        if not self.stderr:
            return ""
        lines = self.stderr.strip().split('\n')
        for line in reversed(lines):
            line = line.strip()
            if line and not line.startswith('['):
                return line[:80] + ("..." if len(line) > 80 else "")
        return lines[-1][:80] if lines else ""

    def to_context_string(self) -> str:
        """Format observation for LLM context consumption."""
        parts = [f"[ACTION] {self.action_type}: {self.action_detail}"]
        if self.stdout.strip():
            parts.append(f"[STDOUT]\n{self.stdout.strip()[:500]}")
        if self.stderr.strip():
            parts.append(f"[STDERR]\n{self.stderr.strip()[:500]}")
        parts.append(f"[STATUS] {'SUCCESS' if self.success else 'FAILED'}")
        if self.files_changed:
            parts.append(f"[FILES] {', '.join(self.files_changed)}")
        return "\n".join(parts)

    def to_dict(self) -> dict:
        return {
            "action_type": self.action_type,
            "action_detail": self.action_detail,
            "success": self.success,
            "stdout": self.stdout[:300],
            "stderr": self.stderr[:300],
            "files_changed": self.files_changed,
        }
