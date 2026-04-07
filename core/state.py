"""
SPIRAL State Management
Tracks task state, execution history, observations, and accumulated context.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime


def _coerce_step_id(raw_id) -> int:
    """Safely coerce a step ID to int, handling string IDs from LLM JSON."""
    try:
        return int(raw_id)
    except (ValueError, TypeError):
        return 0


@dataclass
class StepResult:
    """Result of a single execution step."""
    step_id: int
    type: str
    description: str
    success: bool
    output: str = ""
    error: str = ""
    file_path: str = ""
    verified: bool = False
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class AgentState:
    """
    Central state for SPIRAL's adaptive agent loop.
    Maintains task context, dynamic plan, history, and observations.
    """

    # ── Current Task ──
    task: str = ""
    task_id: int = 0
    intent: str = ""  # Classified intent (coding_task, question, etc.)

    # ── Dynamic Plan (can be updated mid-execution) ──
    plan: Dict = field(default_factory=dict)
    current_step_index: int = 0
    completed_steps: List[int] = field(default_factory=list)

    # ── Execution History ──
    history: List[StepResult] = field(default_factory=list)
    observations: List[Dict] = field(default_factory=list)
    error_log: List[str] = field(default_factory=list)

    # ── File Tracking ──
    files_created: List[str] = field(default_factory=list)
    files_modified: List[str] = field(default_factory=list)

    # ── Iteration Tracking ──
    iteration: int = 0
    max_iterations: int = 10
    debug_attempts: int = 0
    replan_count: int = 0

    # ── Token Tracking ──
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    # ── Task Completion ──
    task_complete: bool = False
    task_failed: bool = False

    # ── Test Results ──
    test_results: List[Dict] = field(default_factory=list)

    def set_task(self, task: str, intent: str = "") -> None:
        """Initialize a new task — resets everything except token counts."""
        self.task = task
        self.task_id += 1
        self.intent = intent
        self.plan = {}
        self.current_step_index = 0
        self.completed_steps = []
        self.history = []
        self.observations = []
        self.error_log = []
        self.files_created = []
        self.files_modified = []
        self.iteration = 0
        self.debug_attempts = 0
        self.replan_count = 0
        self.task_complete = False
        self.task_failed = False
        self.test_results = []

    def set_plan(self, plan: Dict) -> None:
        """Set or update the execution plan (adaptive — can be called multiple times)."""
        self.plan = plan
        self.current_step_index = 0

        # Normalize all step IDs to int to prevent type mismatches
        for step in self.plan.get("steps", []):
            step["id"] = _coerce_step_id(step.get("id", 0))

    def get_next_step(self) -> Optional[Dict]:
        """Get the next unexecuted step from the plan."""
        steps = self.plan.get("steps", [])
        while self.current_step_index < len(steps):
            step = steps[self.current_step_index]
            step_id = _coerce_step_id(step.get("id", self.current_step_index + 1))
            if step_id not in self.completed_steps:
                return step
            self.current_step_index += 1
        return None

    def mark_step_done(self, step_id) -> None:
        """Mark a step as completed."""
        step_id = _coerce_step_id(step_id)
        if step_id not in self.completed_steps:
            self.completed_steps.append(step_id)

        # Only advance the index if it currently points at this step
        steps = self.plan.get("steps", [])
        if self.current_step_index < len(steps):
            current_id = _coerce_step_id(
                steps[self.current_step_index].get("id", self.current_step_index + 1)
            )
            if current_id == step_id:
                self.current_step_index += 1

    def clear_completed_for_replan(self) -> None:
        """Clear completed steps when replanning to prevent new steps from being skipped."""
        self.completed_steps = []
        self.current_step_index = 0

    @property
    def total_steps(self) -> int:
        return len(self.plan.get("steps", []))

    @property
    def steps_completed(self) -> int:
        return len(self.completed_steps)

    def record_result(self, result: StepResult) -> None:
        """Record a step execution result."""
        self.history.append(result)
        if not result.success:
            error_text = result.error or result.output or "Unknown error"
            self.error_log.append(
                f"Step {result.step_id}: {error_text}"
            )
        if result.file_path and result.success:
            if result.type in ("write_file", "create"):
                if result.file_path not in self.files_created:
                    self.files_created.append(result.file_path)
            elif result.type in ("modify_file", "modify"):
                if result.file_path not in self.files_modified:
                    self.files_modified.append(result.file_path)

    def record_observation(self, obs_dict: Dict) -> None:
        """Record a structured observation."""
        self.observations.append(obs_dict)

    def record_tokens(self, input_tokens: int, output_tokens: int) -> None:
        """Track token usage."""
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

    def record_test(self, test_result: Dict) -> None:
        """Record a test execution result."""
        self.test_results.append(test_result)

    def increment_iteration(self) -> bool:
        """Increment iteration. Returns False if max reached."""
        self.iteration += 1
        return self.iteration <= self.max_iterations

    @property
    def has_errors(self) -> bool:
        return len(self.error_log) > 0

    @property
    def last_error(self) -> str:
        return self.error_log[-1] if self.error_log else ""

    @property
    def last_result(self) -> Optional[StepResult]:
        return self.history[-1] if self.history else None

    @property
    def error_count(self) -> int:
        return len(self.error_log)

    @property
    def all_files(self) -> List[str]:
        return list(set(self.files_created + self.files_modified))

    def get_context_summary(self) -> str:
        """Generate a rich context summary for LLM consumption."""
        parts = [f"Task: {self.task}"]
        if self.intent:
            parts.append(f"Intent: {self.intent}")
        parts.append(f"Iteration: {self.iteration}/{self.max_iterations}")

        if self.plan:
            parts.append(f"Plan: {self.plan.get('plan_summary', '')}")
            parts.append(f"Steps: {self.steps_completed}/{self.total_steps} completed")

        if self.files_created:
            parts.append(f"Files created: {', '.join(self.files_created)}")
        if self.files_modified:
            parts.append(f"Files modified: {', '.join(self.files_modified)}")

        # Recent observations (last 5)
        recent_obs = self.observations[-5:]
        if recent_obs:
            parts.append("\nRecent observations:")
            for obs in recent_obs:
                status = "OK" if obs.get("success") else "FAIL"
                parts.append(f"  [{status}] {obs.get('action_type', '?')}: {obs.get('action_detail', '?')[:60]}")

        # Recent results
        recent = self.history[-5:]
        if recent:
            parts.append("\nRecent step results:")
            for r in recent:
                s = "pass" if r.success else "FAIL"
                v = " [verified]" if r.verified else ""
                parts.append(f"  [{s}]{v} {r.description[:60]}")

        # Test results
        if self.test_results:
            parts.append(f"\nTests run: {len(self.test_results)}")
            last_test = self.test_results[-1]
            parts.append(f"Last test: {last_test.get('summary', 'N/A')}")

        if self.error_log:
            parts.append(f"\nTotal errors: {self.error_count}")
            parts.append(f"Last error: {self.last_error[:200]}")

        return "\n".join(parts)

    def to_dict(self) -> Dict:
        """Serialize state for persistence."""
        return {
            "task": self.task,
            "task_id": self.task_id,
            "intent": self.intent,
            "plan_summary": self.plan.get("plan_summary", ""),
            "steps_completed": self.steps_completed,
            "total_steps": self.total_steps,
            "iteration": self.iteration,
            "error_count": self.error_count,
            "files_created": self.files_created,
            "files_modified": self.files_modified,
            "task_complete": self.task_complete,
            "tests_run": len(self.test_results),
            "tokens": {
                "input": self.total_input_tokens,
                "output": self.total_output_tokens,
            },
        }
