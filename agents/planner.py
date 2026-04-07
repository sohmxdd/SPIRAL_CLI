"""
SPIRAL Planner Agent (Adaptive)
Creates and refines plans dynamically based on execution state.
Plans are NOT locked — they evolve with each iteration.
"""

import json
from typing import List, Dict, Optional, Tuple
from llm.groq_client import GroqClient, LLMResponse

PLANNER_SYSTEM_PROMPT = """You are the Planner module of SPIRAL, an autonomous coding agent.

Your job is to take a user's request and create an ADAPTIVE execution plan.

CRITICAL RULES:
1. Each step must be concrete, actionable, and self-contained
2. Steps are ordered by dependency
3. Each step has a type: "write_file", "modify_file", "execute", "analyze", or "shell"
4. Keep plans minimal — fewest steps to accomplish the goal
5. ALWAYS include file paths for file operations
6. File paths should be relative to the current working directory
7. Do NOT include steps for explaining or talking — only actions
8. Include an "execute" step to test/run the code whenever appropriate
9. If you receive execution context showing previous errors, adjust the plan accordingly

OUTPUT FORMAT (JSON):
{
  "plan_summary": "Brief description of what we're building",
  "steps": [
    {
      "id": 1,
      "type": "write_file",
      "description": "Create the main script",
      "file_path": "main.py",
      "details": "Detailed description of what this step should produce"
    }
  ],
  "completion_criteria": "How to verify the task is complete"
}

Respond with ONLY valid JSON. No markdown, no explanation."""

REPLAN_SYSTEM_PROMPT = """You are the Planner module of SPIRAL, an autonomous coding agent.
You are REPLANNING — the previous plan hit issues and needs adjustment.

You receive the original task, what was already done, and what went wrong.

Create a NEW plan that:
1. Builds on what already succeeded (don't redo completed work)
2. Fixes the issues that caused failures
3. Takes a different approach if the original approach failed repeatedly

OUTPUT FORMAT (JSON):
{
  "plan_summary": "Adjusted plan description",
  "steps": [
    {
      "id": 1,
      "type": "write_file",
      "description": "...",
      "file_path": "...",
      "details": "..."
    }
  ],
  "completion_criteria": "How to verify"
}

Respond with ONLY valid JSON."""


class PlannerAgent:
    """Creates and refines adaptive execution plans."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def create_plan(
        self,
        user_request: str,
        context: str = "",
        existing_files: str = "",
    ) -> Tuple[Dict, LLMResponse]:
        """Generate an initial execution plan."""
        prompt_parts = [f"USER REQUEST: {user_request}"]

        if existing_files and not existing_files.startswith("[FILE"):
            prompt_parts.append(f"\nEXISTING FILES IN DIRECTORY:\n{existing_files}")

        if context:
            prompt_parts.append(f"\nCONTEXT:\n{context}")

        prompt_parts.append("\nCreate an execution plan as JSON.")
        prompt = "\n".join(prompt_parts)

        plan_dict, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=PLANNER_SYSTEM_PROMPT,
        )

        return self._validate_plan(plan_dict, user_request), response

    def replan(
        self,
        user_request: str,
        completed_steps: List[str],
        failed_steps: List[str],
        errors: List[str],
        files_created: List[str],
        context: str = "",
    ) -> Tuple[Dict, LLMResponse]:
        """
        Generate a refined plan based on execution results.
        Adapts to what succeeded and what failed.
        """
        prompt_parts = [
            f"ORIGINAL TASK: {user_request}",
            f"\nCOMPLETED STEPS:\n" + ("\n".join(f"  ✓ {s}" for s in completed_steps) if completed_steps else "  (none)"),
            f"\nFAILED STEPS:\n" + ("\n".join(f"  ✗ {s}" for s in failed_steps) if failed_steps else "  (none)"),
            f"\nFILES ALREADY CREATED: {', '.join(files_created) if files_created else '(none)'}",
        ]

        if errors:
            prompt_parts.append(f"\nERRORS ENCOUNTERED:\n" + "\n".join(f"  - {e[:150]}" for e in errors[-3:]))

        if context:
            prompt_parts.append(f"\nCONTEXT:\n{context}")

        prompt_parts.append("\nCreate a NEW adjusted plan. Don't redo completed work. Fix the issues.")
        prompt = "\n".join(prompt_parts)

        plan_dict, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=REPLAN_SYSTEM_PROMPT,
        )

        return self._validate_plan(plan_dict, user_request), response

    def _validate_plan(self, plan_dict: Dict, fallback_desc: str) -> Dict:
        """Ensure plan has required structure."""
        if "steps" not in plan_dict or not isinstance(plan_dict.get("steps"), list):
            plan_dict = {
                "plan_summary": "Direct execution",
                "steps": [{
                    "id": 1,
                    "type": "write_file",
                    "description": fallback_desc,
                    "file_path": "",
                    "details": plan_dict.get("raw_text", fallback_desc),
                }],
                "completion_criteria": "Code executes without errors",
            }

        # Ensure each step has required fields
        for i, step in enumerate(plan_dict["steps"]):
            step.setdefault("id", i + 1)
            step.setdefault("type", "write_file")
            step.setdefault("description", "")
            step.setdefault("file_path", "")
            step.setdefault("details", step.get("description", ""))

        plan_dict.setdefault("plan_summary", "")
        plan_dict.setdefault("completion_criteria", "")

        return plan_dict
