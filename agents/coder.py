"""
SPIRAL Coder Agent
Generates and modifies code based on plan steps.
"""

import json
import re
from typing import Dict, Optional, Tuple
from llm.groq_client import GroqClient, LLMResponse
from tools import file_tool

CODER_SYSTEM_PROMPT = """You are the Coder module of SPIRAL, an autonomous coding agent.

Your job is to write or modify code files based on step instructions.

RULES:
1. Write clean, well-commented, production-quality code
2. Include docstrings for functions and classes
3. Handle edge cases and errors properly
4. Use standard libraries when possible
5. Follow the language's conventions and best practices

OUTPUT FORMAT (JSON):
{
  "action": "write_file" or "modify_file",
  "file_path": "path/to/file.py",
  "content": "full file content here",
  "explanation": "brief explanation of what this code does"
}

For modify_file, provide the COMPLETE new file content (not a diff).

Respond with ONLY valid JSON. No markdown wrapping."""


class CoderAgent:
    """Generates and modifies code based on plan steps."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def execute_step(
        self,
        step: Dict,
        context: str = "",
        existing_code: str = "",
    ) -> Tuple[Dict, LLMResponse]:
        """
        Execute a coding step from the plan.

        Args:
            step: Plan step dict with type, description, file_path, details
            context: Additional context (errors, prev output)
            existing_code: Current file content if modifying

        Returns:
            (result_dict, llm_response)
        """
        prompt_parts = [
            f"STEP: {step.get('description', '')}",
            f"TYPE: {step.get('type', 'write_file')}",
        ]

        if step.get('file_path'):
            prompt_parts.append(f"FILE: {step['file_path']}")

        if step.get('details'):
            prompt_parts.append(f"DETAILS: {step['details']}")

        if existing_code:
            prompt_parts.append(f"\nEXISTING CODE:\n```\n{existing_code}\n```")

        if context:
            prompt_parts.append(f"\nCONTEXT:\n{context}")

        prompt_parts.append("\nWrite the code and respond with JSON.")

        prompt = "\n".join(prompt_parts)

        result, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=CODER_SYSTEM_PROMPT,
        )

        return result, response

    def write_code(self, step: Dict, context: str = "") -> Tuple[str, LLMResponse]:
        """
        Generate code and write it to disk.

        Returns:
            (status_message, llm_response)
        """
        # Read existing file if modifying
        existing_code = ""
        file_path = step.get("file_path", "")

        if step.get("type") == "modify_file" and file_path:
            existing = file_tool.read_file(file_path)
            if not existing.startswith("[FILE_ERROR]"):
                existing_code = existing

        result, response = self.execute_step(step, context, existing_code)

        # Extract and write file
        content = result.get("content", "")
        path = result.get("file_path", file_path)

        if not content:
            # Try to extract from raw text
            raw = result.get("raw_text", "")
            if raw:
                content = self._extract_code(raw)

        if content and path:
            status = file_tool.write_file(path, content)
            return status, response
        elif content and not path:
            return "[CODER] Code generated but no file path specified.", response
        else:
            return "[CODER_ERROR] No code generated.", response

    def _extract_code(self, text: str) -> str:
        """Extract code from markdown-wrapped text."""
        # Try to find code blocks
        pattern = r'```(?:\w+)?\n(.*?)```'
        matches = re.findall(pattern, text, re.DOTALL)
        if matches:
            return matches[0].strip()
        return text.strip()
