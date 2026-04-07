"""
SPIRAL Workspace Context
Persistent project-level memory: tracks files, relationships, and purpose.
Gives the planner deep awareness of the project structure.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime


# ─── Default Directories to Skip ───────────────────────────────

SKIP_DIRS = {
    '__pycache__', 'node_modules', '.git', 'venv', '.venv',
    '.tox', '.mypy_cache', '.pytest_cache', 'dist', 'build',
    '.egg-info', 'spiral_agent.egg-info', '.spiral',
}

# File extensions we care about
CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css',
    '.json', '.yaml', '.yml', '.toml', '.md', '.txt',
    '.sql', '.sh', '.bat', '.ps1', '.go', '.rs', '.java',
    '.c', '.cpp', '.h', '.hpp', '.rb', '.php',
}


class WorkspaceContext:
    """
    Persistent workspace context manager.
    Tracks project structure, file relationships, and per-file summaries.

    Stores:
      - project_map.json  → file inventory with metadata
      - file_summaries.json → LLM-generated purpose descriptions
    """

    def __init__(self, context_dir: str = None, workspace_dir: str = None):
        self.workspace_dir = workspace_dir or os.getcwd()

        # Default context storage under memory/workspace_context/
        if context_dir is None:
            pkg_root = Path(__file__).parent.parent.resolve()
            context_dir = str(pkg_root / "memory" / "workspace_context")

        self.context_dir = context_dir
        os.makedirs(self.context_dir, exist_ok=True)

        self._map_path = os.path.join(self.context_dir, "project_map.json")
        self._summaries_path = os.path.join(self.context_dir, "file_summaries.json")

        # Load existing data
        self.project_map: Dict = self._load_json(self._map_path, {"files": {}, "last_scan": ""})
        self.file_summaries: Dict = self._load_json(self._summaries_path, {})

        # Auto-scan on init
        self.scan_workspace()

    # ─── Scanning ──────────────────────────────────────────────

    def scan_workspace(self) -> None:
        """Scan the workspace directory and update the project map."""
        files_found = {}

        try:
            for root, dirs, filenames in os.walk(self.workspace_dir):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]

                for fname in filenames:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in CODE_EXTENSIONS:
                        continue
                    if fname.startswith('.'):
                        continue

                    full_path = os.path.join(root, fname)
                    rel_path = os.path.relpath(full_path, self.workspace_dir)

                    try:
                        stat = os.stat(full_path)
                        files_found[rel_path] = {
                            "extension": ext,
                            "size_bytes": stat.st_size,
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                            "type": self._classify_file(rel_path, ext),
                        }
                    except OSError:
                        continue

        except Exception:
            pass

        self.project_map["files"] = files_found
        self.project_map["last_scan"] = datetime.now().isoformat()
        self._save()

    def _classify_file(self, rel_path: str, ext: str) -> str:
        """Classify a file by its role in the project."""
        name = os.path.basename(rel_path).lower()
        parts = rel_path.replace('\\', '/').split('/')

        if name in ('main.py', 'app.py', 'index.py', 'index.js', 'index.html'):
            return "entry_point"
        if name in ('config.py', 'settings.py', 'config.json', 'config.yaml'):
            return "configuration"
        if name.startswith('test_') or name.endswith('_test.py'):
            return "test"
        if ext == '.md':
            return "documentation"
        if any(p in ('tools', 'utils', 'helpers') for p in parts):
            return "utility"
        if any(p in ('agents',) for p in parts):
            return "agent"
        if any(p in ('ui', 'views', 'templates', 'components') for p in parts):
            return "ui"
        if any(p in ('core', 'lib', 'src') for p in parts):
            return "core"
        if any(p in ('memory', 'data', 'storage') for p in parts):
            return "data"

        return "source"

    # ─── File Tracking ─────────────────────────────────────────

    def record_file_created(self, file_path: str, summary: str = "") -> None:
        """Record that a file was created during the current task."""
        rel_path = os.path.relpath(os.path.abspath(file_path), self.workspace_dir)
        ext = os.path.splitext(file_path)[1].lower()

        self.project_map["files"][rel_path] = {
            "extension": ext,
            "size_bytes": self._get_size(file_path),
            "modified": datetime.now().isoformat(),
            "type": self._classify_file(rel_path, ext),
            "created_by_spiral": True,
        }

        if summary:
            self.file_summaries[rel_path] = summary

        self._save()

    def record_file_modified(self, file_path: str, summary: str = "") -> None:
        """Record that a file was modified during the current task."""
        rel_path = os.path.relpath(os.path.abspath(file_path), self.workspace_dir)

        if rel_path in self.project_map["files"]:
            self.project_map["files"][rel_path]["modified"] = datetime.now().isoformat()
            self.project_map["files"][rel_path]["size_bytes"] = self._get_size(file_path)

        if summary:
            self.file_summaries[rel_path] = summary

        self._save()

    def update_summary(self, file_path: str, summary: str) -> None:
        """Update the purpose summary for a file."""
        rel_path = os.path.relpath(os.path.abspath(file_path), self.workspace_dir)
        self.file_summaries[rel_path] = summary
        self._save()

    # ─── Context for LLM ──────────────────────────────────────

    def get_project_context(self, max_files: int = 30) -> str:
        """
        Generate a project context string for LLM consumption.
        Includes file tree, types, and known summaries.
        """
        files = self.project_map.get("files", {})
        if not files:
            return "No project files detected."

        parts = ["PROJECT STRUCTURE:"]

        # Group by type
        by_type: Dict[str, List[str]] = {}
        for path, info in sorted(files.items())[:max_files]:
            ftype = info.get("type", "source")
            by_type.setdefault(ftype, []).append(path)

        for ftype, paths in sorted(by_type.items()):
            parts.append(f"\n  [{ftype}]")
            for p in paths:
                summary = self.file_summaries.get(p, "")
                suffix = f" — {summary}" if summary else ""
                parts.append(f"    • {p}{suffix}")

        parts.append(f"\n  Total files: {len(files)}")

        return "\n".join(parts)

    def get_file_list(self) -> List[str]:
        """Get list of all known file paths."""
        return list(self.project_map.get("files", {}).keys())

    # ─── Persistence ──────────────────────────────────────────

    def _save(self) -> None:
        """Save project map and summaries to disk."""
        self._save_json(self._map_path, self.project_map)
        self._save_json(self._summaries_path, self.file_summaries)

    def _load_json(self, path: str, default: dict) -> dict:
        """Load a JSON file or return default."""
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return default
        return default

    def _save_json(self, path: str, data: dict) -> None:
        """Save data to a JSON file."""
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError:
            pass

    def _get_size(self, file_path: str) -> int:
        """Get file size safely."""
        try:
            return os.path.getsize(os.path.abspath(file_path))
        except OSError:
            return 0

    def summary(self) -> str:
        """Brief summary for display."""
        file_count = len(self.project_map.get("files", {}))
        summary_count = len(self.file_summaries)
        return f"Workspace: {file_count} files tracked, {summary_count} summaries"
