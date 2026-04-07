"""
NYX — SPIRAL's Mascot System v3.0
State-driven pixel sprite with dual-mode awareness.
Uses mascot_renderer for pixel-accurate compact output.
"""

import sys
import time
import threading
from ui.theme import Colors, print_themed
from ui.mascot_renderer import render_mascot, get_renderer, get_mascot_lines


# Compact inline indicator (for messages, not full sprite)
NYX_INDICATOR = {
    "idle":     f"{Colors.PURPLE}◈{Colors.RESET}",
    "thinking": f"{Colors.VIOLET}◉{Colors.RESET}",
    "error":    f"{Colors.ERROR}◈{Colors.RESET}",
    "success":  f"{Colors.SUCCESS}◈{Colors.RESET}",
    "warning":  f"{Colors.WARNING}◈{Colors.RESET}",
    "info":     f"{Colors.INFO}◈{Colors.RESET}",
}


class Nyx:
    """
    Nyx — The SPIRAL mascot v3.0. State-driven pixel sprite system.

    Personality: Calm, intelligent, slightly sarcastic.
    Speaks in short, sharp sentences. Never overexplains.
    Reacts to system state. Feels like a senior engineer.

    v3.0: Dual-mode awareness (AGENT/CHAT), compact sprite, vivid purple.
    """

    VALID_STATES = {"idle", "thinking", "error", "success", "warning", "info"}

    def __init__(self, show_art: bool = True):
        self._state = "idle"
        self.show_art = show_art
        self._spinner_active = False
        self._spinner_thread = None
        self._spinner_stop_event = threading.Event()
        self._lock = threading.Lock()

    # ─── State Management ─────────────────────────────────────

    @property
    def state(self) -> str:
        return self._state

    def set_state(self, state: str) -> None:
        """Set Nyx's current state. Controls sprite and message styling."""
        if state in self.VALID_STATES:
            self._state = state

    # ─── Rendering ────────────────────────────────────────────

    def render(self) -> None:
        """Render the current state pixel sprite to terminal."""
        if not self.show_art:
            return
        try:
            renderer = get_renderer()
            if renderer.is_loaded:
                print()
                renderer.display(self._state)
                print()
            else:
                # Fallback: minimal text indicator
                indicator = NYX_INDICATOR.get(self._state, NYX_INDICATOR["idle"])
                print(f"\n  {indicator} {Colors.PURPLE_BOLD}Nyx{Colors.RESET}\n", flush=True)
        except Exception:
            # Never crash on rendering — it's purely cosmetic
            pass

    def get_sprite_lines(self) -> list:
        """Get sprite as list of lines (for side-by-side layout)."""
        try:
            renderer = get_renderer()
            if renderer.is_loaded:
                return renderer.get_lines(self._state)
        except Exception:
            pass
        return [
            f"  {NYX_INDICATOR.get(self._state, NYX_INDICATOR['idle'])} {Colors.PURPLE_BOLD}Nyx{Colors.RESET}"
        ]

    def say(self, message: str, state: str = None) -> None:
        """Print a Nyx message with state-driven styling."""
        if state:
            self.set_state(state)

        s = self._state
        indicator = NYX_INDICATOR.get(s, NYX_INDICATOR["idle"])

        color_map = {
            "error": Colors.ERROR,
            "success": Colors.SUCCESS,
            "warning": Colors.WARNING,
            "info": Colors.INFO,
        }
        color = color_map.get(s, Colors.PURPLE)

        prefix = (
            f"{Colors.DIM_PURPLE}[{Colors.RESET}"
            f"{Colors.PURPLE_BOLD}Nyx{Colors.RESET} "
            f"{indicator}"
            f"{Colors.DIM_PURPLE}]{Colors.RESET}"
        )
        print(f"\n{prefix} {color}{message}{Colors.RESET}", flush=True)

    # ─── Convenience Methods ──────────────────────────────────

    def greet(self) -> None:
        """Startup greeting with pixel sprite."""
        self.set_state("idle")
        self.render()
        self.say("SPIRAL online. What are we building?")

    def thinking(self, task: str = "") -> None:
        msg = "Thinking..." if not task else f"Working on: {task}"
        self.say(msg, "thinking")

    def planning(self) -> None:
        self.say("Analyzing. Building a plan.", "thinking")

    def plan_ready(self, step_count: int) -> None:
        self.say(f"Plan ready. {step_count} steps. Adaptive — I'll adjust as we go.", "idle")

    def step_start(self, step_num: int, total: int, desc: str) -> None:
        self.say(f"Step {step_num}/{total} — {desc}", "thinking")

    def step_done(self, step_num: int) -> None:
        self.say(f"Step {step_num} complete.", "success")

    def error_detected(self, brief: str = "") -> None:
        msg = "Runtime error. Fixing it." if not brief else f"Error: {brief[:70]}"
        self.say(msg, "error")

    def debug_start(self, attempt: int, max_attempts: int) -> None:
        self.say(f"Debug cycle {attempt}/{max_attempts}. Analyzing.", "error")

    def fix_applied(self) -> None:
        self.say("Fix applied. Retrying.", "idle")

    def verifying(self) -> None:
        self.say("Verifying output. Don't trust — verify.", "thinking")

    def verification_passed(self) -> None:
        self.say("Verification passed.", "success")

    def verification_failed(self, reason: str = "") -> None:
        msg = "Verification failed." if not reason else f"Not right: {reason[:60]}"
        self.say(msg, "error")

    def replanning(self) -> None:
        self.say("Plan needs adjustment. Replanning.", "thinking")

    def reflecting(self) -> None:
        self.say("Reflecting on execution.", "info")

    def task_complete(self) -> None:
        self.set_state("success")
        self.render()
        self.say("Done. Clean execution.")

    def task_failed(self) -> None:
        self.set_state("error")
        self.render()
        self.say("Couldn't complete it. Check the output.")

    def warn(self, message: str) -> None:
        self.say(message, "warning")

    def reflect_note(self, note: str) -> None:
        self.say(note, "info")

    def goodbye(self) -> None:
        self.say("Shutting down. Good session.", "idle")

    # ─── Dual Mode Messages ──────────────────────────────────

    def chat_response(self, message: str) -> None:
        """Display a chat mode response from Nyx."""
        self.set_state("idle")
        indicator = NYX_INDICATOR["idle"]

        prefix = (
            f"{Colors.DIM_PURPLE}[{Colors.RESET}"
            f"{Colors.PURPLE_BOLD}Nyx{Colors.RESET} "
            f"{indicator}"
            f"{Colors.DIM_PURPLE}]{Colors.RESET}"
        )

        # Format multi-line responses nicely
        lines = message.strip().split('\n')
        print(f"\n{prefix}", flush=True)

        in_code_block = False
        for line in lines:
            stripped = line.strip()

            # Detect code blocks
            if stripped.startswith('```'):
                in_code_block = not in_code_block
                if in_code_block:
                    lang = stripped[3:].strip()
                    print(f"  {Colors.DIM_PURPLE}┌── {lang} {'─' * max(1, 44 - len(lang))}┐{Colors.RESET}", flush=True)
                else:
                    print(f"  {Colors.DIM_PURPLE}└{'─' * 49}┘{Colors.RESET}", flush=True)
                continue

            if in_code_block:
                print(f"  {Colors.DIM_PURPLE}│{Colors.RESET} {Colors.LIGHT_PURPLE}{line}{Colors.RESET}", flush=True)
            else:
                print(f"  {Colors.PURPLE}{line}{Colors.RESET}", flush=True)

    def intent_detected(self, intent: str, mode: str) -> None:
        """Announce detected intent and mode."""
        from ui.theme import Theme
        badge = Theme.mode_badge(mode)
        intent_str = Theme.intent_badge(intent)
        print(f"\n  {badge} {intent_str}", flush=True)

    def testing(self) -> None:
        """Announce test execution."""
        self.say("Running tests. Trust but verify.", "thinking")

    def test_passed(self, summary: str) -> None:
        """Announce test pass."""
        self.say(f"Tests passed. {summary}", "success")

    def test_failed(self, summary: str) -> None:
        """Announce test failure."""
        self.say(f"Tests failed: {summary}", "error")

    # ─── Spinner ──────────────────────────────────────────────

    def start_spinner(self, message: str = "Processing") -> None:
        """Start an animated spinner (thread-safe)."""
        with self._lock:
            if self._spinner_active:
                return

            # Wait for any previous spinner thread to fully terminate
            if self._spinner_thread is not None and self._spinner_thread.is_alive():
                self._spinner_stop_event.set()
                self._spinner_thread.join(timeout=3)
                self._spinner_thread = None

            self._spinner_stop_event.clear()
            self._spinner_active = True

        frames = ["⣷", "⣯", "⣟", "⡿", "⢿", "⣻", "⣽", "⣾"]

        def _spin():
            i = 0
            try:
                while not self._spinner_stop_event.is_set():
                    frame = f"{Colors.PURPLE}{frames[i % len(frames)]}{Colors.RESET}"
                    sys.stdout.write(
                        f"\r  {frame} {Colors.DIM_PURPLE}{message}...{Colors.RESET}  "
                    )
                    sys.stdout.flush()
                    # Use Event.wait for faster shutdown response
                    self._spinner_stop_event.wait(timeout=0.08)
                    i += 1
            except Exception:
                pass  # Never crash in spinner thread
            finally:
                # Clean the spinner line
                try:
                    sys.stdout.write("\r" + " " * 70 + "\r")
                    sys.stdout.flush()
                except Exception:
                    pass

        self._spinner_thread = threading.Thread(target=_spin, daemon=True)
        self._spinner_thread.start()

    def stop_spinner(self) -> None:
        """Stop the animated spinner (thread-safe)."""
        with self._lock:
            if not self._spinner_active:
                return
            self._spinner_active = False
            self._spinner_stop_event.set()

        # Join outside the lock to avoid deadlock
        thread = self._spinner_thread
        if thread is not None:
            thread.join(timeout=3)

        with self._lock:
            self._spinner_thread = None


# ─── Global Instance ──────────────────────────────────────────
nyx = Nyx()
