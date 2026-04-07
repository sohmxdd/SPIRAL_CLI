"""
SPIRAL Tester Agent
Generates and executes simple test cases for produced code.
Part of the verify-before-declare-success pipeline.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple
from llm.groq_client import GroqClient, LLMResponse
from tools import exec_tool

TESTER_SYSTEM_PROMPT = """You are the Tester module of SPIRAL, an autonomous coding agent.

Your job is to generate simple, focused test cases for code that was just written.

You receive:
- The task description
- The code that was produced
- The file path

RULES:
1. Write 2-4 small, focused test cases
2. Tests should verify core functionality, not edge cases
3. Tests must be self-contained (no external dependencies beyond what the code uses)
4. If the code is a script (not importable), test by running it and checking output
5. If the code defines functions/classes, import and test them directly
6. Each test should print "PASS: <test name>" or "FAIL: <test name> - <reason>"
7. Keep tests simple — they run in a subprocess

OUTPUT FORMAT (JSON):
{
  "test_strategy": "Brief description of what we're testing",
  "test_code": "complete Python test code as a string",
  "test_count": 3,
  "can_test": true,
  "skip_reason": ""
}

If the code cannot be meaningfully tested (e.g., it's a UI-only file, configuration, etc.),
set "can_test" to false and provide a "skip_reason".

Respond with ONLY valid JSON."""


@dataclass
class TestResult:
    """Result from running test cases."""
    passed: int = 0
    failed: int = 0
    total: int = 0
    failures: List[str] = field(default_factory=list)
    output: str = ""
    skipped: bool = False
    skip_reason: str = ""

    @property
    def success(self) -> bool:
        return self.skipped or (self.total > 0 and self.failed == 0)

    @property
    def summary(self) -> str:
        if self.skipped:
            return f"Skipped: {self.skip_reason}"
        return f"{self.passed}/{self.total} passed" + (
            f" ({self.failed} failed)" if self.failed else ""
        )


class TesterAgent:
    """Generates and executes test cases for produced code."""

    def __init__(self, llm: GroqClient):
        self.llm = llm

    def test(
        self,
        task: str,
        code: str,
        file_path: str,
        context: str = "",
    ) -> Tuple[TestResult, LLMResponse]:
        """
        Generate and run tests for the given code.

        Args:
            task: Original task description
            code: The code that was produced
            file_path: Path to the code file
            context: Additional context

        Returns:
            (TestResult, LLMResponse)
        """
        # Generate test cases
        prompt_parts = [
            f"TASK: {task}",
            f"FILE: {file_path}",
            f"\nCODE:\n```\n{code[:3000]}\n```",
        ]

        if context:
            prompt_parts.append(f"\nCONTEXT:\n{context}")

        prompt_parts.append("\nGenerate test cases. Respond with JSON.")
        prompt = "\n".join(prompt_parts)

        result_dict, response = self.llm.generate_json(
            prompt=prompt,
            system_prompt=TESTER_SYSTEM_PROMPT,
        )

        # Check if testing is possible
        if not result_dict.get("can_test", True):
            return TestResult(
                skipped=True,
                skip_reason=result_dict.get("skip_reason", "Not testable"),
            ), response

        test_code = result_dict.get("test_code", "")
        test_count = result_dict.get("test_count", 0)

        if not test_code:
            return TestResult(
                skipped=True,
                skip_reason="No test code generated",
            ), response

        # Execute the tests
        test_result = self._run_tests(test_code, test_count)
        return test_result, response

    def _run_tests(self, test_code: str, expected_count: int) -> TestResult:
        """Execute test code and parse results."""
        exec_result = exec_tool.run_code_string(test_code, timeout=15)

        output = exec_result.stdout + exec_result.stderr
        result = TestResult(output=output, total=expected_count)

        if exec_result.timed_out:
            result.failed = expected_count
            result.failures.append("Tests timed out")
            return result

        # Parse PASS/FAIL lines from output
        lines = output.split('\n')
        pass_count = 0
        fail_count = 0
        failures = []

        for line in lines:
            line = line.strip()
            if line.startswith("PASS:"):
                pass_count += 1
            elif line.startswith("FAIL:"):
                fail_count += 1
                failures.append(line)

        # If no PASS/FAIL markers found, check return code
        if pass_count == 0 and fail_count == 0:
            if exec_result.success:
                result.passed = expected_count
                result.total = expected_count
            else:
                result.failed = 1
                result.total = 1
                result.failures.append(
                    exec_result.stderr[:200] if exec_result.stderr
                    else "Test execution failed"
                )
        else:
            result.passed = pass_count
            result.failed = fail_count
            result.total = pass_count + fail_count
            result.failures = failures

        return result
