---
name: unit-test
description: Generates comprehensive unit tests for Python or JavaScript files with edge case coverage.
triggers: [unit test, write tests, generate tests, test coverage, test suite]
---
# Unit Testing Skill Instructions

When generating unit tests for code in this workspace:
1. Identify the target source file and analyze all functions, classes, and exported methods.
2. For Python: use `unittest` or `pytest`. For JavaScript/TypeScript: use standard `jest` or `vitest` assertions.
3. Test valid inputs, boundary/edge cases, empty/null values, and expected error handling paths.
4. Save the unit tests in a separate file inside `tests/` or alongside the module.
5. Provide executable assertions that can be run with standard test runners.
