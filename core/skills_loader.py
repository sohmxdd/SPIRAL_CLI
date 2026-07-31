"""
SPIRAL Dynamic Skills Loader
Scans workspace-local (.spiral/skills/) and global (~/.spiral/skills/) directories
for Markdown skill definitions with YAML frontmatter.
"""

import os
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


@dataclass
class Skill:
    name: str
    description: str
    triggers: List[str] = field(default_factory=list)
    instructions: str = ""
    file_path: str = ""


class SkillsLoader:
    """Discovers, parses, and manages SpiralCLI skills."""

    def __init__(self, workspace_dir: Optional[str] = None):
        self.workspace_dir = workspace_dir or os.getcwd()
        self.skills: Dict[str, Skill] = {}
        self.reload()

    def _get_skill_directories(self) -> List[Path]:
        dirs = []

        # 1. Global ~/.spiral/skills/
        home_dir = Path.home() / ".spiral" / "skills"
        if home_dir.exists() and home_dir.is_dir():
            dirs.append(home_dir)

        # 2. Workspace-local .spiral/skills/
        if self.workspace_dir:
            ws_dir = Path(self.workspace_dir) / ".spiral" / "skills"
            if ws_dir.exists() and ws_dir.is_dir():
                dirs.append(ws_dir)

        return dirs

    def _parse_frontmatter(self, text: str) -> Tuple[Dict, str]:
        """Simple, robust YAML frontmatter parser for --- delimited metadata."""
        frontmatter = {}
        body = text

        pattern = r"^---\s*\n(.*?)\n---\s*\n(.*)$"
        match = re.match(pattern, text, re.DOTALL)

        if match:
            yaml_str = match.group(1)
            body = match.group(2)

            for line in yaml_str.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    key, val = line.split(":", 1)
                    key = key.strip().lower()
                    val = val.strip()

                    # Handle list format: [a, b, c]
                    if val.startswith("[") and val.endswith("]"):
                        val_list = [item.strip().strip('"\'') for item in val[1:-1].split(",") if item.strip()]
                        frontmatter[key] = val_list
                    else:
                        frontmatter[key] = val.strip('"\'')

        return frontmatter, body.strip()

    def reload(self) -> None:
        """Scan directories and load all .md skill files."""
        self.skills.clear()

        for skill_dir in self._get_skill_directories():
            try:
                for file_path in skill_dir.glob("*.md"):
                    try:
                        content = file_path.read_text(encoding="utf-8", errors="replace")
                        meta, body = self._parse_frontmatter(content)

                        name = meta.get("name", file_path.stem)
                        description = meta.get("description", "No description provided.")
                        triggers = meta.get("triggers", [])
                        if isinstance(triggers, str):
                            triggers = [t.strip() for t in triggers.split(",")]

                        skill = Skill(
                            name=name,
                            description=description,
                            triggers=triggers,
                            instructions=body,
                            file_path=str(file_path)
                        )
                        self.skills[name] = skill
                    except Exception as e:
                        print(f"[SKILLS_WARN] Failed to parse {file_path}: {e}")
            except Exception as e:
                print(f"[SKILLS_WARN] Failed to read skills directory {skill_dir}: {e}")

    def list_skills(self) -> List[Dict]:
        """Return metadata list of all registered skills."""
        return [
            {
                "name": s.name,
                "description": s.description,
                "triggers": s.triggers,
                "file_path": s.file_path
            }
            for s in self.skills.values()
        ]

    def match_skill(self, prompt: str) -> Optional[Skill]:
        """Find the best matching skill for a user prompt based on triggers, name, or slash command."""
        prompt_lower = prompt.lower()

        # 1. Explicit slash command syntax: /skill:name or /skill name or /skill-name
        slash_match = re.search(r"/skill[:\s]+([a-zA-Z0-9_-]+)", prompt_lower)
        if slash_match:
            skill_target = slash_match.group(1).strip()
            for sname, skill in self.skills.items():
                if sname.lower() == skill_target:
                    return skill

        # 2. Direct name or trigger match
        for skill in self.skills.values():
            if skill.name.lower() in prompt_lower:
                return skill
            for trigger in skill.triggers:
                if trigger.lower() in prompt_lower:
                    return skill

        return None
