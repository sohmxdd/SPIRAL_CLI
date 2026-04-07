"""
SPIRAL Memory System
Short-term (in-session) and long-term (persistent) memory.
"""

import json
import os
from typing import List, Dict, Optional
from datetime import datetime
import config


# Roles that the Groq API accepts in message history
_VALID_API_ROLES = {"system", "user", "assistant"}


class ShortTermMemory:
    """
    In-session context window.
    Keeps the last N messages/events for LLM context.
    """

    def __init__(self, max_entries: int = None):
        self.max_entries = max_entries or config.MAX_CONTEXT_MESSAGES
        self.entries: List[Dict] = []

    def add(self, role: str, content: str, metadata: Dict = None) -> None:
        """Add a memory entry."""
        entry = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        }
        if metadata:
            entry["metadata"] = metadata

        self.entries.append(entry)

        # Trim to window size
        if len(self.entries) > self.max_entries:
            self.entries = self.entries[-self.max_entries:]

    def get_context(self) -> List[Dict[str, str]]:
        """
        Get entries formatted as LLM message history.
        Sanitizes roles: 'system' entries in mid-conversation are
        mapped to 'user' with a [System] prefix to avoid API errors.
        Only 'user' and 'assistant' entries are returned (system prompt
        is handled separately by the caller).
        """
        result = []
        for e in self.entries:
            role = e["role"]
            content = e["content"]

            if role == "system":
                # Remap system messages to user with prefix
                role = "user"
                content = f"[System Note] {content}"
            elif role not in _VALID_API_ROLES:
                # Unknown role — map to user
                role = "user"

            result.append({"role": role, "content": content})
        return result

    def get_recent(self, n: int = 5) -> List[Dict]:
        """Get last N entries."""
        return self.entries[-n:]

    def clear(self) -> None:
        """Clear all entries."""
        self.entries = []

    def summary(self) -> str:
        """Brief summary for display."""
        return f"Memory: {len(self.entries)}/{self.max_entries} entries"


class LongTermMemory:
    """
    Persistent memory across sessions.
    Stores task outcomes, learnings, and preferences.
    """

    def __init__(self, filepath: str = None):
        self.filepath = filepath or config.MEMORY_FILE
        self.data: Dict = self._load()

    def _load(self) -> Dict:
        """Load memory from disk."""
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                # Ensure all expected keys exist (handles older formats)
                default = self._default()
                for key, value in default.items():
                    data.setdefault(key, value)
                return data
            except (json.JSONDecodeError, IOError, ValueError):
                return self._default()
        return self._default()

    def _default(self) -> Dict:
        """Default memory structure."""
        return {
            "tasks_completed": 0,
            "learnings": [],
            "preferences": {},
            "history": [],
        }

    def save(self) -> None:
        """Persist memory to disk."""
        try:
            with open(self.filepath, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
        except (IOError, OSError):
            pass  # Fail silently — memory is optional

    def record_task(self, task: str, outcome: str, insights: List[str] = None) -> None:
        """Record a completed task."""
        self.data["tasks_completed"] = self.data.get("tasks_completed", 0) + 1
        entry = {
            "task": task[:200],
            "outcome": outcome,
            "timestamp": datetime.now().isoformat(),
        }
        if insights:
            entry["insights"] = insights
            learnings = self.data.get("learnings", [])
            learnings.extend(insights[-3:])  # Keep top 3
            self.data["learnings"] = learnings

        history = self.data.get("history", [])
        history.append(entry)
        self.data["history"] = history

        # Trim history
        if len(self.data["history"]) > 50:
            self.data["history"] = self.data["history"][-50:]
        if len(self.data.get("learnings", [])) > 30:
            self.data["learnings"] = self.data["learnings"][-30:]

        self.save()

    def get_relevant_learnings(self, task: str, n: int = 3) -> List[str]:
        """Get recent learnings (simple recency-based for now)."""
        return self.data.get("learnings", [])[-n:]

    def summary(self) -> str:
        """Brief summary."""
        return (
            f"Long-term: {self.data.get('tasks_completed', 0)} tasks, "
            f"{len(self.data.get('learnings', []))} learnings"
        )
