"""
SPIRAL Agent Loop v3.0 — Adaptive Autonomous Orchestration
True agent loop with dual-mode routing: plan → execute → test → verify → debug → reflect → replan

Features:
  - Intent-based routing (AGENT mode vs CHAT mode)
  - Tester agent integration
  - Persistent workspace context
  - Plans are NOT locked. The loop adapts based on observations.
"""

import os
import time
from typing import Optional, Dict, List
from core.state import AgentState, StepResult
from core.observation import Observation
from core.intent import IntentAnalyzer, AGENT_INTENTS, CHAT_INTENTS
from agents.planner import PlannerAgent
from agents.coder import CoderAgent
from agents.debugger import DebuggerAgent
from agents.reflector import ReflectorAgent
from agents.verifier import VerifierAgent
from agents.tester import TesterAgent
from llm.groq_client import GroqClient
from tools import file_tool, exec_tool, terminal_tool
from ui.mascot import nyx
from ui.token_meter import TokenMeter
from ui.theme import Colors, Theme, print_themed
from memory.memory import ShortTermMemory, LongTermMemory
from memory.workspace_context import WorkspaceContext
import config


class AgentLoop:
    """
    Adaptive autonomous agent loop for SPIRAL v3.0.

    Dual-mode system:
      CHAT MODE — conversational responses (questions, casual)
      AGENT MODE — full planning + execution loop

    Agent mode core cycle (runs until task_complete or max iterations):
        1. CLASSIFY — determine intent and route
        2. PLAN — create or refine the plan based on current state + workspace context
        3. DECIDE — pick the next action from the plan
        4. EXECUTE — run the action using tools
        5. OBSERVE — capture and structure the result
        6. TEST — generate and run test cases
        7. VERIFY — check if the result is actually correct
        8. DEBUG — if errors, analyze and fix
        9. REFLECT — learn from the execution
        10. UPDATE STATE — feed everything back
    """

    def __init__(self, token_meter: TokenMeter = None):
        """Initialize all agents, tools, and state."""
        try:
            self.llm = GroqClient()
        except ValueError as e:
            raise ValueError(str(e))

        # ── Agents ──
        self.planner = PlannerAgent(self.llm)
        self.coder = CoderAgent(self.llm)
        self.debugger = DebuggerAgent(self.llm)
        self.reflector = ReflectorAgent(self.llm)
        self.verifier = VerifierAgent(self.llm)
        self.tester = TesterAgent(self.llm)
        self.intent_analyzer = IntentAnalyzer(self.llm)

        # ── State & Memory ──
        self.state = AgentState()
        self.short_memory = ShortTermMemory()
        self.long_memory = LongTermMemory()
        self.workspace = WorkspaceContext()

        # ── Token Meter ──
        self.token_meter = token_meter or TokenMeter()

    def _track_tokens(self, response) -> None:
        """Record token usage from an LLM response."""
        if response and hasattr(response, 'input_tokens'):
            self.token_meter.record(response.input_tokens, response.output_tokens)
            self.state.record_tokens(response.input_tokens, response.output_tokens)

    # ═══════════════════════════════════════════════════════════
    #  MAIN ENTRY POINT — DUAL MODE ROUTING
    # ═══════════════════════════════════════════════════════════

    def run(self, user_input: str) -> None:
        """
        Main entry point. Classifies intent and routes to the appropriate mode.
        """
        self.short_memory.add("user", user_input)

        # ── Step 1: Classify Intent ──
        if config.INTENT_CLASSIFICATION:
            nyx.start_spinner("Analyzing intent")
            intent_result = self.intent_analyzer.classify(user_input)
            nyx.stop_spinner()

            intent = intent_result.intent
            mode = "AGENT" if intent_result.is_agent_mode else "CHAT"

            nyx.intent_detected(intent, mode)
            self._track_tokens(None)  # Intent might use LLM
        else:
            # Default to agent mode if classification is disabled
            intent = "coding_task"
            mode = "AGENT"

        # ── Step 2: Route ──
        if mode == "CHAT":
            self._chat_response(user_input, intent)
        else:
            self._agent_run(user_input, intent)

    # ═══════════════════════════════════════════════════════════
    #  CHAT MODE
    # ═══════════════════════════════════════════════════════════

    def _chat_response(self, user_input: str, intent: str) -> None:
        """
        Handle conversational responses in CHAT mode.
        Nyx responds naturally with personality. Can include code snippets.
        """
        nyx.start_spinner("Thinking")
        try:
            # Build context from short-term memory
            context = self.short_memory.get_context()[-6:]  # Last few exchanges

            # Add workspace awareness
            workspace_info = self.workspace.get_project_context(max_files=10)

            system = config.CHAT_SYSTEM_PROMPT
            if workspace_info and "No project" not in workspace_info:
                system += f"\n\nCurrent workspace context:\n{workspace_info}"

            response = self.llm.generate_response(
                prompt=user_input,
                system_prompt=system,
                context=context,
                temperature=0.7,  # More creative for chat
                max_tokens=1024,
            )
            self._track_tokens(response)

            # Stop spinner BEFORE displaying response to prevent stdout corruption
            nyx.stop_spinner()

            if "[LLM_ERROR]" in response.text:
                nyx.error_detected("Couldn't generate response.")
                return

            # Display the response (spinner is already stopped)
            nyx.chat_response(response.text)

            # Save to memory
            self.short_memory.add("assistant", response.text[:500])

        except Exception as e:
            nyx.stop_spinner()
            nyx.error_detected(f"Chat error: {str(e)[:50]}")

    # ═══════════════════════════════════════════════════════════
    #  AGENT MODE — FULL AUTONOMOUS LOOP
    # ═══════════════════════════════════════════════════════════

    def _agent_run(self, user_input: str, intent: str) -> None:
        """
        Execute the full adaptive agent loop for a user request.
        This is the true autonomous loop — plans, executes, tests,
        verifies, debugs, reflects, and replans dynamically.
        """
        self.state.set_task(user_input, intent=intent)
        print_themed(Theme.separator("━"))

        # ── Phase 1: Initial Plan (with workspace context) ──
        nyx.planning()
        plan = self._generate_plan(user_input)
        if not plan:
            nyx.error_detected("Failed to generate plan.")
            return

        self.state.set_plan(plan)
        self._display_plan(plan)
        nyx.plan_ready(self.state.total_steps)

        # ── Phase 2: Adaptive Execution Loop ──
        while not self.state.task_complete and not self.state.task_failed:
            if not self.state.increment_iteration():
                nyx.warn(f"Max iterations ({self.state.max_iterations}) reached.")
                self.state.task_failed = True
                break

            # Check token budget
            if self.token_meter.usage_ratio >= config.TOKEN_CRITICAL:
                nyx.warn("Token budget critical. Stopping.")
                self.state.task_failed = True
                break

            # Get next step
            step = self.state.get_next_step()

            if step is None:
                # All steps completed — run final verification
                if self._final_verification(user_input):
                    self.state.task_complete = True
                else:
                    # Verification failed — replan
                    if not self._try_replan(user_input):
                        self.state.task_failed = True
                break

            # Execute the step
            step_id = step.get("id", self.state.current_step_index + 1)
            desc = step.get("description", "Unknown step")

            nyx.step_start(self.state.steps_completed + 1, self.state.total_steps, desc)
            print_themed(Theme.step_indicator(
                self.state.steps_completed + 1, self.state.total_steps, desc
            ))

            observation = self._execute_step(step)

            if observation.has_error:
                # ── DEBUG CYCLE ──
                nyx.error_detected(observation.error_summary[:60])
                if self._debug_cycle(step, observation):
                    self.state.mark_step_done(step_id)
                    nyx.step_done(self.state.steps_completed)
                else:
                    # Debug failed — try replanning
                    if not self._try_replan(user_input):
                        self.state.task_failed = True
                        break
            else:
                # ── TEST (for code steps) ──
                if step.get("type") in ("write_file", "modify_file", "execute"):
                    self._run_tests(step, observation)

                # ── VERIFY ──
                verified = self._verify_step(step, observation)
                if verified:
                    self.state.mark_step_done(step_id)
                    nyx.step_done(self.state.steps_completed)

                    # Update workspace context
                    fp = step.get("file_path", "")
                    if fp:
                        if step.get("type") in ("write_file", "create"):
                            self.workspace.record_file_created(fp, desc)
                        elif step.get("type") in ("modify_file", "modify"):
                            self.workspace.record_file_modified(fp, desc)
                else:
                    # Verification failed, but no error — try debug cycle anyway
                    if self._debug_cycle(step, observation):
                        self.state.mark_step_done(step_id)
                        nyx.step_done(self.state.steps_completed)
                    elif not self._try_replan(user_input):
                        self.state.task_failed = True
                        break

        # ── Phase 3: Reflect ──
        if self.state.history:
            self._reflect(user_input)

        # ── Phase 4: Display Results ──
        self.token_meter.display()

        if self.state.task_complete:
            nyx.task_complete()
            self._display_summary()
        else:
            nyx.task_failed()

        print_themed(Theme.separator("━"))

    # ═══════════════════════════════════════════════════════════
    #  PLANNING (with workspace context)
    # ═══════════════════════════════════════════════════════════

    def _generate_plan(self, user_input: str) -> Optional[Dict]:
        """Generate an initial plan using the planner agent + workspace context."""
        nyx.start_spinner("Generating plan")
        try:
            existing = file_tool.list_files(".", ['.py', '.js', '.html', '.css', '.json', '.txt', '.md'])
            learnings = self.long_memory.get_relevant_learnings(user_input)

            # Build rich context with workspace awareness
            context_parts = []
            if learnings:
                context_parts.append("Past learnings:\n" + "\n".join(learnings))

            workspace_ctx = self.workspace.get_project_context()
            if workspace_ctx and "No project" not in workspace_ctx:
                context_parts.append(workspace_ctx)

            context = "\n\n".join(context_parts) if context_parts else ""

            plan, response = self.planner.create_plan(
                user_request=user_input,
                context=context,
                existing_files=existing if not existing.startswith("[FILE") else "",
            )
            self._track_tokens(response)

            if "[LLM_ERROR]" in str(plan):
                return None

            self.short_memory.add("assistant", f"Plan: {plan.get('plan_summary', '')}")
            return plan
        except Exception as e:
            nyx.error_detected(f"Planning failed: {str(e)[:50]}")
            return None
        finally:
            nyx.stop_spinner()

    def _try_replan(self, user_input: str) -> bool:
        """Attempt to replan after failures. Returns True if new plan created."""
        self.state.replan_count += 1
        if self.state.replan_count > config.MAX_REPLAN_CYCLES:
            nyx.warn("Max replan attempts reached.")
            return False

        nyx.replanning()
        nyx.start_spinner("Replanning")
        try:
            completed = [r.description for r in self.state.history if r.success]
            failed = [r.description for r in self.state.history if not r.success]
            errors = self.state.error_log[-3:]

            plan, response = self.planner.replan(
                user_request=user_input,
                completed_steps=completed,
                failed_steps=failed,
                errors=errors,
                files_created=self.state.files_created,
                context=self.state.get_context_summary(),
            )
            self._track_tokens(response)

            if "[LLM_ERROR]" in str(plan) or not plan.get("steps"):
                return False

            # Clear completed_steps so new plan steps aren't incorrectly skipped
            self.state.clear_completed_for_replan()
            self.state.set_plan(plan)
            self._display_plan(plan)
            nyx.plan_ready(self.state.total_steps)
            return True
        except Exception:
            return False
        finally:
            nyx.stop_spinner()

    # ═══════════════════════════════════════════════════════════
    #  EXECUTION
    # ═══════════════════════════════════════════════════════════

    def _execute_step(self, step: Dict) -> Observation:
        """Execute a single plan step and return an Observation."""
        step_type = step.get("type", "write_file")

        try:
            if step_type in ("write_file", "modify_file"):
                return self._exec_code_step(step)
            elif step_type == "execute":
                return self._exec_run_step(step)
            elif step_type == "shell":
                return self._exec_shell_step(step)
            elif step_type == "analyze":
                return self._exec_analyze_step(step)
            else:
                return self._exec_code_step(step)
        except Exception as e:
            return Observation(
                stderr=f"Step execution error: {str(e)}",
                returncode=-1,
                action_type=step_type,
                action_detail=step.get("description", ""),
            )

    def _exec_code_step(self, step: Dict) -> Observation:
        """Write or modify code via the coder agent."""
        step_id = step.get("id", 0)
        desc = step.get("description", "")
        file_path = step.get("file_path", "")

        nyx.start_spinner("Writing code")
        try:
            context = self.state.get_context_summary()

            # Add workspace context for better code generation
            ws_ctx = self.workspace.get_project_context(max_files=15)
            if ws_ctx and "No project" not in ws_ctx:
                context += f"\n\n{ws_ctx}"

            status, response = self.coder.write_code(step, context)
            self._track_tokens(response)

            success = "[FILE_OK]" in status
            self.state.record_result(StepResult(
                step_id=step_id, type=step.get("type", "write_file"),
                description=desc, success=success,
                output=status, file_path=file_path,
            ))

            if success:
                print_themed(f"  {Colors.SUCCESS}→ {status}{Colors.RESET}")
                self.short_memory.add("assistant", f"Wrote: {status[:80]}")

                return Observation(
                    stdout=status, returncode=0,
                    files_changed=[file_path] if file_path else [],
                    action_type="write_file", action_detail=desc,
                )
            else:
                print_themed(f"  {Colors.ERROR}→ {status}{Colors.RESET}")
                return Observation(
                    stderr=status, returncode=1,
                    action_type="write_file", action_detail=desc,
                )
        finally:
            nyx.stop_spinner()

    def _exec_run_step(self, step: Dict) -> Observation:
        """Execute a Python file."""
        step_id = step.get("id", 0)
        desc = step.get("description", "")
        file_path = step.get("file_path", "")

        if not file_path and self.state.files_created:
            # Only pick .py files as fallback for execution
            py_files = [f for f in self.state.files_created if f.endswith('.py')]
            if py_files:
                file_path = py_files[-1]

        if not file_path:
            return Observation(stderr="No file to execute", returncode=1,
                             action_type="execute", action_detail=desc)

        nyx.start_spinner(f"Running {os.path.basename(file_path)}")
        try:
            result = exec_tool.run_python(file_path)

            self.state.record_result(StepResult(
                step_id=step_id, type="execute", description=desc,
                success=result.success,
                output=result.stdout[:500], error=result.stderr[:500],
                file_path=file_path,
            ))

            obs = Observation(
                stdout=result.stdout, stderr=result.stderr,
                returncode=result.returncode,
                files_changed=[file_path],
                action_type="execute", action_detail=desc,
            )

            if result.success and result.stdout.strip():
                print_themed(f"\n{Theme.code_block(result.stdout.strip()[:400], 'output')}")

            self.state.record_observation(obs.to_dict())
            self.short_memory.add("system", f"Run {file_path}: {'OK' if result.success else 'FAIL'}")
            return obs
        finally:
            nyx.stop_spinner()

    def _exec_shell_step(self, step: Dict) -> Observation:
        """Execute a shell command."""
        desc = step.get("description", "")
        cmd = step.get("details", "") or desc

        nyx.start_spinner("Running command")
        try:
            result = terminal_tool.run_command(cmd)

            self.state.record_result(StepResult(
                step_id=step.get("id", 0), type="shell",
                description=desc, success=result.success,
                output=result.stdout[:500], error=result.stderr[:500],
            ))

            if result.stdout.strip():
                print_themed(f"  {Colors.GRAY}{result.stdout.strip()[:200]}{Colors.RESET}")

            return Observation(
                stdout=result.stdout, stderr=result.stderr,
                returncode=result.returncode,
                action_type="shell", action_detail=cmd[:100],
            )
        finally:
            nyx.stop_spinner()

    def _exec_analyze_step(self, step: Dict) -> Observation:
        """Read a file for analysis."""
        file_path = step.get("file_path", "")
        output = ""
        if file_path and file_tool.file_exists(file_path):
            output = file_tool.read_file(file_path)

        self.state.record_result(StepResult(
            step_id=step.get("id", 0), type="analyze",
            description=step.get("description", ""), success=True,
            output=output[:500], file_path=file_path,
        ))
        return Observation(stdout=output[:500], returncode=0,
                          action_type="analyze", action_detail=file_path)

    # ═══════════════════════════════════════════════════════════
    #  TESTING
    # ═══════════════════════════════════════════════════════════

    def _run_tests(self, step: Dict, observation: Observation) -> None:
        """Generate and run tests for a completed step."""
        file_path = step.get("file_path", "")
        if not file_path or not file_tool.file_exists(file_path):
            return

        # Skip testing for non-code files
        if not file_path.endswith(('.py', '.js', '.ts')):
            return

        code = file_tool.read_file(file_path)
        if code.startswith("[FILE_ERROR]"):
            return

        nyx.testing()
        nyx.start_spinner("Running tests")
        try:
            test_result, response = self.tester.test(
                task=self.state.task,
                code=code[:3000],
                file_path=file_path,
                context=self.state.get_context_summary(),
            )
            self._track_tokens(response)

            # Record test result
            self.state.record_test({
                "file": file_path,
                "passed": test_result.passed,
                "failed": test_result.failed,
                "total": test_result.total,
                "skipped": test_result.skipped,
                "summary": test_result.summary,
            })

            if test_result.skipped:
                print_themed(f"  {Colors.DIM}Tests skipped: {test_result.skip_reason}{Colors.RESET}")
            elif test_result.success:
                nyx.test_passed(test_result.summary)
            else:
                nyx.test_failed(test_result.summary)
                for failure in test_result.failures[:3]:
                    print_themed(f"  {Colors.ERROR}  • {failure[:80]}{Colors.RESET}")

        except Exception as e:
            print_themed(f"  {Colors.DIM}Test generation error: {str(e)[:50]}{Colors.RESET}")
        finally:
            nyx.stop_spinner()

    # ═══════════════════════════════════════════════════════════
    #  VERIFICATION
    # ═══════════════════════════════════════════════════════════

    def _verify_step(self, step: Dict, observation: Observation) -> bool:
        """Verify a step's result using the verifier agent."""
        # Skip verification for simple analyze steps
        if step.get("type") == "analyze":
            return True

        nyx.verifying()
        nyx.start_spinner("Verifying")
        try:
            # Get file content if available
            files_state = ""
            fp = step.get("file_path", "")
            if fp and file_tool.file_exists(fp):
                content = file_tool.read_file(fp)
                if not content.startswith("[FILE_ERROR]"):
                    files_state = f"--- {fp} ---\n{content[:1500]}"

            # Include test results in verification context
            test_ctx = ""
            if self.state.test_results:
                last_test = self.state.test_results[-1]
                test_ctx = f"\nTest results: {last_test.get('summary', 'N/A')}"

            verification, response = self.verifier.verify(
                task=self.state.task,
                step_description=step.get("description", ""),
                action_taken=f"{step.get('type', '?')}: {step.get('description', '')}",
                result=observation.to_context_string() + test_ctx,
                files_state=files_state,
                context=self.state.get_context_summary(),
            )
            self._track_tokens(response)

            is_valid = verification.get("valid", False)
            confidence = verification.get("confidence", 0.5)

            if is_valid and confidence >= 0.6:
                nyx.verification_passed()
                # Update last result as verified
                if self.state.last_result:
                    self.state.last_result.verified = True
                return True
            else:
                issues = verification.get("issues", [])
                reason = issues[0] if issues else verification.get("reasoning", "")
                nyx.verification_failed(reason[:60])
                for issue in issues[:2]:
                    print_themed(f"  {Colors.VIOLET}! {issue}{Colors.RESET}")
                return False
        except Exception as e:
            # If verification itself fails, assume step is OK to avoid blocking
            nyx.warn(f"Verification error: {str(e)[:40]}. Proceeding.")
            return True
        finally:
            nyx.stop_spinner()

    def _final_verification(self, user_input: str) -> bool:
        """Final self-critique before declaring task complete."""
        if not self.state.all_files:
            return True  # Nothing to verify

        nyx.verifying()
        nyx.start_spinner("Final verification")
        try:
            all_files = {}
            for fp in self.state.all_files[:5]:  # Limit to 5 files
                if file_tool.file_exists(fp):
                    content = file_tool.read_file(fp)
                    if not content.startswith("[FILE_ERROR]"):
                        all_files[fp] = content

            if not all_files:
                return True

            execution_summary = self.state.get_context_summary()
            critique, response = self.verifier.self_critique(
                task=user_input,
                all_files=all_files,
                execution_summary=execution_summary,
            )
            self._track_tokens(response)

            is_complete = critique.get("task_complete", critique.get("valid", False))
            confidence = critique.get("confidence", 0.5)

            if is_complete and confidence >= 0.5:
                nyx.verification_passed()
                return True
            else:
                issues = critique.get("issues", [])
                if issues:
                    nyx.verification_failed(issues[0][:60])
                    for issue in issues[:2]:
                        print_themed(f"  {Colors.VIOLET}! {issue}{Colors.RESET}")
                return False
        except Exception:
            return True  # Don't block on verification errors
        finally:
            nyx.stop_spinner()

    # ═══════════════════════════════════════════════════════════
    #  DEBUGGING
    # ═══════════════════════════════════════════════════════════

    def _debug_cycle(self, step: Dict, observation: Observation) -> bool:
        """
        Attempt to debug and fix a failed step.
        Returns True if the step was eventually fixed.
        """
        file_path = step.get("file_path", "")
        desc = step.get("description", "")
        max_retries = config.MAX_DEBUG_RETRIES

        for attempt in range(1, max_retries + 1):
            self.state.debug_attempts += 1
            nyx.debug_start(attempt, max_retries)
            print_themed(f"  {Colors.VIOLET}Debug attempt {attempt}/{max_retries}{Colors.RESET}")

            # Get error info
            error_output = observation.stderr or observation.stdout
            if not error_output and self.state.last_result:
                error_output = self.state.last_result.error or self.state.last_result.output

            # Read current source
            source_code = ""
            if file_path and file_tool.file_exists(file_path):
                source_code = file_tool.read_file(file_path)

            # Ask debugger
            nyx.start_spinner("Analyzing error")
            try:
                fix, fix_response = self.debugger.analyze_and_fix(
                    error_output=error_output[:2000],
                    source_code=source_code[:3000],
                    file_path=file_path,
                    step_description=desc,
                    context=self.state.get_context_summary(),
                )
                self._track_tokens(fix_response)
            except Exception as e:
                nyx.error_detected(f"Debug analysis failed: {str(e)[:40]}")
                continue
            finally:
                nyx.stop_spinner()

            # Check if new approach needed
            if fix.get("requires_new_approach", False):
                nyx.warn("Different approach needed.")
                return False

            # Apply fix
            fixed_content = fix.get("fixed_content", "")
            fix_path = fix.get("file_path", file_path)

            if not fixed_content or not fix_path:
                nyx.error_detected("Couldn't generate a fix.")
                continue

            write_status = file_tool.write_file(fix_path, fixed_content)
            nyx.fix_applied()
            print_themed(f"  {Colors.SUCCESS}→ {write_status}{Colors.RESET}")
            print_themed(f"  {Colors.DIM}Fix: {fix.get('fix_description', 'applied')}{Colors.RESET}")

            self.short_memory.add("assistant", f"Debug fix: {fix.get('root_cause', '')[:80]}")

            # Update workspace context
            self.workspace.record_file_modified(fix_path, f"Debug fix: {fix.get('root_cause', '')[:50]}")

            # Re-execute if it was a run step
            if step.get("type") == "execute":
                nyx.start_spinner(f"Re-running {os.path.basename(fix_path)}")
                re_result = exec_tool.run_python(fix_path)
                nyx.stop_spinner()

                if re_result.success:
                    self.state.record_result(StepResult(
                        step_id=step.get("id", 0), type="execute",
                        description=f"[FIXED] {desc}", success=True,
                        output=re_result.stdout[:500], file_path=fix_path,
                    ))
                    if re_result.stdout.strip():
                        print_themed(f"\n{Theme.code_block(re_result.stdout.strip()[:300], 'output')}")
                    return True
                else:
                    # Update observation for next debug attempt
                    observation = Observation(
                        stdout=re_result.stdout, stderr=re_result.stderr,
                        returncode=re_result.returncode,
                        action_type="execute", action_detail=desc,
                    )
                    self.state.record_result(StepResult(
                        step_id=step.get("id", 0), type="execute",
                        description=f"[RETRY {attempt}] {desc}", success=False,
                        error=re_result.stderr[:500], file_path=fix_path,
                    ))
                    continue
            else:
                # For write/modify steps, the fix is the success
                self.state.record_result(StepResult(
                    step_id=step.get("id", 0),
                    type=step.get("type", "write_file"),
                    description=f"[FIXED] {desc}", success=True,
                    output=write_status, file_path=fix_path,
                ))
                return True

        return False

    # ═══════════════════════════════════════════════════════════
    #  REFLECTION
    # ═══════════════════════════════════════════════════════════

    def _reflect(self, user_input: str) -> None:
        """Run post-task reflection."""
        nyx.reflecting()
        nyx.start_spinner("Reflecting")
        try:
            history_dicts = [
                {"type": r.type, "description": r.description, "success": r.success}
                for r in self.state.history
            ]

            reflection, response = self.reflector.reflect(
                user_request=user_input,
                plan=self.state.plan,
                execution_history=history_dicts,
                error_count=self.state.error_count,
            )
            self._track_tokens(response)

            insights = reflection.get("insights", [])
            if insights:
                nyx.reflect_note(reflection.get("summary", "Noted."))
                for insight in insights[:3]:
                    print_themed(f"  {Colors.DIM_PURPLE}•{Colors.RESET} {Colors.GRAY}{insight}{Colors.RESET}")

            self.long_memory.record_task(
                task=user_input,
                outcome=reflection.get("outcome", "unknown"),
                insights=insights,
            )
        except Exception:
            pass  # Reflection failure is non-critical
        finally:
            nyx.stop_spinner()

    # ═══════════════════════════════════════════════════════════
    #  DISPLAY
    # ═══════════════════════════════════════════════════════════

    def _display_plan(self, plan: Dict) -> None:
        """Display the execution plan in a styled box."""
        summary = plan.get("plan_summary", "")
        steps = plan.get("steps", [])

        print_themed(f"\n  {Colors.DEEP_PURPLE}╔══ PLAN {'═' * 48}╗{Colors.RESET}")
        if summary:
            print_themed(f"  {Colors.DEEP_PURPLE}║{Colors.RESET} {Colors.WHITE}{summary[:55]}{Colors.RESET}")
        print_themed(f"  {Colors.DEEP_PURPLE}╠{'═' * 57}╣{Colors.RESET}")

        type_colors = {
            "write_file": Colors.SUCCESS, "modify_file": Colors.VIOLET,
            "execute": Colors.PURPLE, "shell": Colors.DIM, "analyze": Colors.INFO,
        }

        for step in steps:
            sid = step.get("id", "?")
            stype = step.get("type", "?")
            sdesc = step.get("description", "?")
            spath = step.get("file_path", "")
            tc = type_colors.get(stype, Colors.WHITE)

            print_themed(
                f"  {Colors.DEEP_PURPLE}║{Colors.RESET}"
                f"  {Colors.PURPLE}{sid}.{Colors.RESET}"
                f" {tc}[{stype}]{Colors.RESET}"
                f" {Colors.WHITE}{sdesc[:40]}{Colors.RESET}"
            )
            if spath:
                print_themed(f"  {Colors.DEEP_PURPLE}║{Colors.RESET}     {Colors.DIM}→ {spath}{Colors.RESET}")

        print_themed(f"  {Colors.DEEP_PURPLE}╚{'═' * 57}╝{Colors.RESET}\n")

    def _display_summary(self) -> None:
        """Display final task summary."""
        created = self.state.files_created
        modified = self.state.files_modified

        if created or modified:
            print_themed(f"\n  {Colors.DEEP_PURPLE}── Files ──{Colors.RESET}")
            for f in created:
                print_themed(f"  {Colors.SUCCESS}+ {f}{Colors.RESET}")
            for f in modified:
                print_themed(f"  {Colors.VIOLET}~ {f}{Colors.RESET}")

        # Test summary
        if self.state.test_results:
            total_passed = sum(t.get("passed", 0) for t in self.state.test_results)
            total_failed = sum(t.get("failed", 0) for t in self.state.test_results)
            print_themed(
                f"\n  {Colors.DEEP_PURPLE}── Tests ──{Colors.RESET}"
                f"\n  {Colors.DIM}Passed: {total_passed} | Failed: {total_failed}{Colors.RESET}"
            )

        stats = (
            f"  {Colors.DIM}Iterations: {self.state.iteration} | "
            f"Steps: {self.state.steps_completed}/{self.state.total_steps} | "
            f"Debug cycles: {self.state.debug_attempts} | "
            f"Replans: {self.state.replan_count}{Colors.RESET}"
        )
        print_themed(stats)
