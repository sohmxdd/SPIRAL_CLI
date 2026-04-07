"""
SPIRAL Debugger Agent
Analyzes runtime errors and produces fixes.
"""

import json
from typing import Dict, Tuple
from llm.groq_client import GroqClient, LLMResponse

DEBUGGER_SYSTEM_PROMPT = """You are the Debugger module of SPIRAL, an autonomous coding agent.

Your job is to analyze runtime errors and produce fixes.

You receive:
- The error output (stdout/stderr)
- The source code that caused the error
- The original step description

RULES:
1. Identify the root cause precisely
2. Provide the COMPLETE fixed code (not a diff)
3. Explain what went wrong in one sentence
4. If the error is in the approach, suggest a different approach
5. Never guess — analyze the actual error

OUTPUT FORMAT (JSON):
{
  "error_type": "SyntaxError" or "RuntimeError" or "ImportError" etc.,
  "root_cause": "One sentence explanation",
  "fix_description": "What the fix does",
  "file_path": "path/to/file.py",
  "fixed_content": "complete fixed file content",
  "requires_new_approach": false,
  "new_approach": ""
}

Respond with ONLY valid JSON."""


class DebuggerAgent:
    """Analyzes errors and produces fixes."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def analyze_and_fix(
        self,
        error_output: str,
        source_code: str,
        file_path: str,
        step_description: str = "",
        context: str = "",
    ) -> Tuple[Dict, LLMResponse]:
        """
        Analyze an error and produce a fix.

        Args:
            error_output: Combined stdout/stderr from execution
            source_code: The code that produced the error
            file_path: Path to the file with the error
            step_description: What the code was supposed to do
            context: Additional context

        Returns:
            (fix_dict, llm_response)
        """
        prompt_parts = [
            f"ERROR OUTPUT:\n{error_output}",
            f"\nSOURCE CODE ({file_path}):\n```\n{source_code}\n```",
        ]

        if step_description:
            prompt_parts.append(f"\nINTENDED BEHAVIOR: {step_description}")

        if context:
            prompt_parts.append(f"\nCONTEXT:\n{context}")

        prompt_parts.append("\nAnalyze the error and provide the fix as JSON.")

        prompt = "\n".join(prompt_parts)

        result, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=DEBUGGER_SYSTEM_PROMPT,
        )

        return result, response

    def get_error_summary(self, error_output: str) -> str:
        """Extract a brief error summary for Nyx to display."""
        lines = error_output.strip().split('\n')
        # Get the last meaningful line (usually the error message)
        for line in reversed(lines):
            line = line.strip()
            if line and not line.startswith('['):
                # Truncate if too long
                return line[:80] + "..." if len(line) > 80 else line
        return "Unknown error"
