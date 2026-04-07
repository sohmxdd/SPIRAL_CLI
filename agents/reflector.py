"""
SPIRAL Reflector Agent
Reviews execution history and produces improvement notes.
"""

from typing import Dict, List, Tuple
from llm.groq_client import GroqClient, LLMResponse

REFLECTOR_SYSTEM_PROMPT = """You are the Reflector module of SPIRAL, an autonomous coding agent.

After a task completes (success or failure), you review what happened and produce insights.

You receive:
- The original user request
- The plan that was executed
- Execution results for each step
- Any errors that occurred

RULES:
1. Be concise — max 3-4 bullet points
2. Focus on actionable insights
3. Note patterns (repeated errors, inefficiencies)
4. Suggest improvements for similar future tasks
5. If everything went well, say so briefly

OUTPUT FORMAT (JSON):
{
  "outcome": "success" or "partial" or "failure",
  "insights": [
    "Insight 1",
    "Insight 2"
  ],
  "improvements": [
    "Suggestion 1"
  ],
  "summary": "One sentence summary"
}

Respond with ONLY valid JSON."""


class ReflectorAgent:
    """Reviews execution and produces improvement notes."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def reflect(
        self,
        user_request: str,
        plan: Dict,
        execution_history: List[Dict],
        error_count: int = 0,
    ) -> Tuple[Dict, LLMResponse]:
        """
        Reflect on the completed task.

        Args:
            user_request: Original user input
            plan: The execution plan used
            execution_history: List of step results
            error_count: Number of errors encountered

        Returns:
            (reflection_dict, llm_response)
        """
        prompt_parts = [
            f"USER REQUEST: {user_request}",
            f"\nPLAN: {plan.get('plan_summary', 'N/A')}",
            f"STEPS: {len(plan.get('steps', []))}",
            f"ERRORS ENCOUNTERED: {error_count}",
        ]

        # Summarize execution history
        prompt_parts.append("\nEXECUTION HISTORY:")
        for entry in execution_history[-10:]:  # Last 10 entries
            prompt_parts.append(
                f"  - [{entry.get('type', 'action')}] "
                f"{entry.get('description', '')[:100]}: "
                f"{'✓' if entry.get('success', False) else '✗'}"
            )

        prompt_parts.append("\nReflect on this execution and respond with JSON.")

        prompt = "\n".join(prompt_parts)

        result, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=REFLECTOR_SYSTEM_PROMPT,
        )

        return result, response
