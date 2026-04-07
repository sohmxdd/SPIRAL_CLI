"""
SPIRAL Verifier Agent
Validates outputs, checks correctness, ensures task completion.
Self-critique capability — questions its own system's outputs.
"""

from typing import Dict, List, Tuple
from llm.groq_client import GroqClient, LLMResponse

VERIFIER_SYSTEM_PROMPT = """You are the Verifier module of SPIRAL, an autonomous coding agent.

Your job is to critically evaluate whether the last action actually accomplished what was intended.

You receive:
- The original task
- The current plan step
- The action that was taken (code written, command run, etc.)
- The result (stdout, stderr, files changed)

YOUR RESPONSIBILITIES:
1. Check if the output is ACTUALLY correct — not just "no errors"
2. Detect missing logic, edge cases, incomplete implementations
3. Verify the task is genuinely solved, not just superficially
4. Check for common mistakes: wrong file paths, missing imports, logic errors
5. If code was written, verify it would actually work for the intended purpose

CRITICAL RULES:
- Do NOT declare success just because there were no errors
- Do NOT be overly generous — be skeptical
- If something looks wrong, say so
- Suggest specific fixes if verification fails

OUTPUT FORMAT (JSON):
{
  "valid": true or false,
  "confidence": 0.0 to 1.0,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["fix 1", "fix 2"],
  "reasoning": "Brief explanation of your assessment",
  "task_complete": true or false,
  "next_action": "What should happen next (if not complete)"
}

Respond with ONLY valid JSON."""


class VerifierAgent:
    """Validates correctness, detects issues, ensures real task completion."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def verify(
        self,
        task: str,
        step_description: str,
        action_taken: str,
        result: str,
        files_state: str = "",
        context: str = "",
    ) -> Tuple[Dict, LLMResponse]:
        """
        Verify the result of an action.

        Args:
            task: Original user task
            step_description: What this step was supposed to do
            action_taken: What was actually done (file written, command run)
            result: Output from the action
            files_state: Current state of relevant files
            context: Execution history context

        Returns:
            (verification_dict, llm_response)
        """
        prompt_parts = [
            f"ORIGINAL TASK: {task}",
            f"\nCURRENT STEP: {step_description}",
            f"\nACTION TAKEN: {action_taken}",
            f"\nRESULT:\n{result[:2000]}",
        ]

        if files_state:
            prompt_parts.append(f"\nFILES STATE:\n{files_state[:1500]}")

        if context:
            prompt_parts.append(f"\nEXECUTION CONTEXT:\n{context[:1000]}")

        prompt_parts.append(
            "\nCritically evaluate: Is this step ACTUALLY correct and complete? Respond with JSON."
        )

        prompt = "\n".join(prompt_parts)

        result_dict, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=VERIFIER_SYSTEM_PROMPT,
        )

        # Ensure required fields have defaults
        result_dict.setdefault("valid", False)
        result_dict.setdefault("confidence", 0.5)
        result_dict.setdefault("issues", [])
        result_dict.setdefault("suggestions", [])
        result_dict.setdefault("task_complete", False)
        result_dict.setdefault("reasoning", "")
        result_dict.setdefault("next_action", "")

        return result_dict, response

    def self_critique(
        self,
        task: str,
        all_files: Dict[str, str],
        execution_summary: str,
    ) -> Tuple[Dict, LLMResponse]:
        """
        Final self-critique: question the entire output before declaring success.

        Args:
            task: Original user request
            all_files: Dict of {filepath: content} for all created/modified files
            execution_summary: Summary of what happened

        Returns:
            (critique_dict, llm_response)
        """
        files_desc = ""
        for path, content in all_files.items():
            files_desc += f"\n--- {path} ---\n{content[:800]}\n"

        prompt = (
            f"ORIGINAL TASK: {task}\n\n"
            f"EXECUTION SUMMARY: {execution_summary}\n\n"
            f"FILES PRODUCED:{files_desc}\n\n"
            f"Question everything. Is this task ACTUALLY solved? "
            f"Are there bugs, missing features, or edge cases? "
            f"Be critical. Respond with JSON."
        )

        result_dict, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=VERIFIER_SYSTEM_PROMPT,
        )

        result_dict.setdefault("valid", False)
        result_dict.setdefault("confidence", 0.5)
        result_dict.setdefault("issues", [])
        result_dict.setdefault("suggestions", [])
        result_dict.setdefault("task_complete", False)

        return result_dict, response
