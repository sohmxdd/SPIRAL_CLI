"""
SPIRAL CLI Interface v3.0
Interactive command loop with Nyx integration, purple Claude-style UI,
dual-mode routing, and adaptive agent.
"""

import sys
import os

# Ensure package root is on path
_pkg_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _pkg_root not in sys.path:
    sys.path.insert(0, _pkg_root)

from ui.theme import Colors, Theme, print_themed, get_terminal_width
from ui.mascot import nyx
from ui.mascot_renderer import get_mascot_lines
from ui.token_meter import TokenMeter
from core.loop import AgentLoop
import config


# ─── Startup Banner ───────────────────────────────────────────

BANNER = f"""\033[0m
{Colors.DEEP_PURPLE}
    ███████╗██████╗ ██╗██████╗  █████╗ ██╗     
    ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗██║     
    ███████╗██████╔╝██║██████╔╝███████║██║     
    ╚════██║██╔═══╝ ██║██╔══██╗██╔══██║██║     
    ███████║██║     ██║██║  ██║██║  ██║███████╗
    ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝{Colors.RESET}
{Colors.PURPLE}
           ╔═══════════════════════════════════╗
           ║  {Colors.LIGHT_PURPLE}Autonomous Coding Agent  v3.0{Colors.PURPLE}   ║
           ║  {Colors.DIM_PURPLE}Powered by Groq  ·  Guided by Nyx{Colors.PURPLE} ║
           ╚═══════════════════════════════════╝{Colors.RESET}
"""

HELP_TEXT = f"""
{Colors.DEEP_PURPLE}━━━ SPIRAL Commands ━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.RESET}

  {Colors.PURPLE}/help{Colors.RESET}     {Colors.GRAY}Show this help{Colors.RESET}
  {Colors.PURPLE}/status{Colors.RESET}   {Colors.GRAY}Show session state and token usage{Colors.RESET}
  {Colors.PURPLE}/reset{Colors.RESET}    {Colors.GRAY}Reset session state{Colors.RESET}
  {Colors.PURPLE}/files{Colors.RESET}    {Colors.GRAY}List files in current directory{Colors.RESET}
  {Colors.PURPLE}/read{Colors.RESET}     {Colors.GRAY}Read a file (e.g. /read main.py){Colors.RESET}
  {Colors.PURPLE}/model{Colors.RESET}    {Colors.GRAY}Show current LLM model{Colors.RESET}
  {Colors.PURPLE}/clear{Colors.RESET}    {Colors.GRAY}Clear terminal{Colors.RESET}
  {Colors.PURPLE}/exit{Colors.RESET}     {Colors.GRAY}Exit SPIRAL{Colors.RESET}

  {Colors.DIM}Any other input is routed by intent:{Colors.RESET}
  {Colors.DIM}  • coding/debug/modify → {Colors.BRIGHT_PURPLE}Agent Mode{Colors.DIM} (plans + executes){Colors.RESET}
  {Colors.DIM}  • questions/casual    → {Colors.VIOLET}Chat Mode{Colors.DIM}  (Nyx responds){Colors.RESET}

{Colors.DEEP_PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.RESET}
"""


class SpiralCLI:
    """
    Interactive CLI for SPIRAL v3.0.
    Nyx-driven feedback, Claude-style input bar, dual-mode routing.
    """

    def __init__(self):
        self.token_meter = TokenMeter()
        self.agent_loop = None

    def _init_agent(self) -> bool:
        """Initialize the agent loop. Returns True if successful."""
        try:
            self.agent_loop = AgentLoop(token_meter=self.token_meter)
            return True
        except ValueError as e:
            nyx.error_detected(str(e))
            print_themed(f"\n  {Colors.ERROR}{e}{Colors.RESET}")
            print_themed(f"  {Colors.DIM}Set GROQ_API_KEY in .env file.{Colors.RESET}")
            return False
        except Exception as e:
            nyx.error_detected("Initialization failed.")
            print_themed(f"\n  {Colors.ERROR}{e}{Colors.RESET}")
            return False

    def _render_startup(self) -> None:
        """Render the startup layout with Nyx sprite + info panel."""
        sprite_lines = nyx.get_sprite_lines()

        # Build info panel
        info_lines = [
            f"{Colors.LIGHT_PURPLE}Welcome back!{Colors.RESET}",
            "",
            f"{Colors.PURPLE}Tips for getting started{Colors.RESET}",
            f"{Colors.GRAY}Type a task to enter Agent Mode{Colors.RESET}",
            f"{Colors.GRAY}Ask a question for Chat Mode{Colors.RESET}",
            f"{Colors.GRAY}Type /help for all commands{Colors.RESET}",
            "",
            f"{Colors.PURPLE}Recent activity{Colors.RESET}",
        ]

        # Add recent task history if available
        if self.agent_loop and self.agent_loop.long_memory.data.get("history"):
            history = self.agent_loop.long_memory.data["history"][-3:]
            for entry in reversed(history):
                task = entry.get("task", "")[:40]
                outcome = entry.get("outcome", "?")
                icon = "✓" if outcome == "success" else "✗"
                info_lines.append(
                    f"{Colors.DIM}  {icon} {task}{Colors.RESET}"
                )
        else:
            info_lines.append(f"{Colors.DIM}  No recent activity{Colors.RESET}")

        # Render side by side
        output = Theme.side_by_side(sprite_lines, info_lines, left_width=34, gap=4)
        print(output, flush=True)

    def start(self) -> None:
        """Launch the interactive CLI loop."""
        # ── Startup ──
        print(BANNER)

        if not self._init_agent():
            return

        # Render startup layout (Nyx + info panel)
        self._render_startup()
        print()

        # Test connection
        nyx.start_spinner("Testing Groq connection")
        connected = self.agent_loop.llm.test_connection()
        nyx.stop_spinner()

        if connected:
            nyx.say("Groq connected. Fast inference ready.", "success")
            print_themed(Theme.label("Model", config.DEFAULT_MODEL))
            print_themed(Theme.label("Working Dir", os.getcwd()))
            print_themed(Theme.label("Token Budget", f"{config.TOKEN_BUDGET:,}"))

            # Show workspace context summary
            ws_summary = self.agent_loop.workspace.summary()
            print_themed(Theme.label("Context", ws_summary))
        else:
            nyx.error_detected("Can't reach Groq. Check API key.")
            return

        print()

        # ── Main Loop ──
        while True:
            try:
                user_input = self._get_input()

                if user_input is None:
                    break

                if not user_input:
                    continue

                if user_input.startswith("/"):
                    if not self._handle_command(user_input):
                        break
                    continue

                # ── Execute via Agent Loop (dual-mode routing) ──
                self.agent_loop.run(user_input)

            except KeyboardInterrupt:
                print()
                nyx.say("Interrupted. Type /exit to quit.", "warning")
                continue
            except EOFError:
                break

        nyx.goodbye()

    def _get_input(self) -> str:
        """
        Get user input with Claude-style purple-bordered input bar.
        Returns the input string, or None to exit.
        """
        tw = min(get_terminal_width() - 4, 72)

        # Top border
        top = f"  {Colors.PURPLE}╭{'─' * tw}╮{Colors.RESET}"
        print(f"\n{top}")

        # Input prompt line
        prompt_prefix = (
            f"  {Colors.PURPLE}│{Colors.RESET} "
            f"{Colors.DIM_PURPLE}({Colors.RESET}"
            f"{Colors.PURPLE_BOLD}spiral{Colors.RESET}"
            f"{Colors.DIM_PURPLE}){Colors.RESET} "
            f"{Colors.BRIGHT_PURPLE}➤{Colors.RESET} "
        )

        try:
            user_input = input(prompt_prefix).strip()
        except (EOFError, KeyboardInterrupt):
            # Close the box anyway
            bottom = f"  {Colors.PURPLE}╰{'─' * tw}╯{Colors.RESET}"
            print(bottom)
            return None

        # Bottom border
        bottom = f"  {Colors.PURPLE}╰{'─' * tw}╯{Colors.RESET}"
        print(bottom)

        return user_input

    def _handle_command(self, cmd: str) -> bool:
        """Handle slash commands. Returns False to exit."""
        parts = cmd.split(maxsplit=1)
        command = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if command in ("/exit", "/quit", "/q"):
            return False

        elif command == "/help":
            print(HELP_TEXT)

        elif command == "/status":
            self._show_status()

        elif command == "/reset":
            self.token_meter.reset()
            try:
                self.agent_loop = AgentLoop(token_meter=self.token_meter)
                nyx.say("Session reset. Clean slate.", "success")
            except ValueError as e:
                nyx.error_detected(str(e))
                print_themed(f"\n  {Colors.ERROR}{e}{Colors.RESET}")
                print_themed(f"  {Colors.DIM}Set GROQ_API_KEY in .env file.{Colors.RESET}")
            except Exception as e:
                nyx.error_detected(f"Reset failed: {str(e)[:50]}")

        elif command == "/files":
            from tools import file_tool
            files = file_tool.list_files(".")
            if files.startswith("[FILE"):
                nyx.say("Directory is empty.", "idle")
            else:
                print_themed(f"\n  {Colors.DEEP_PURPLE}── Files ──{Colors.RESET}")
                for f in files.split('\n')[:30]:
                    print_themed(f"  {Colors.DIM_PURPLE}•{Colors.RESET} {Colors.WHITE}{f}{Colors.RESET}")
                print()

        elif command == "/read":
            if not args:
                nyx.say("Specify a file. e.g. /read main.py", "idle")
            else:
                from tools import file_tool
                content = file_tool.read_file(args)
                if content.startswith("[FILE_ERROR]"):
                    nyx.error_detected(content)
                else:
                    print_themed(Theme.code_block(content[:3000], args))

        elif command == "/model":
            print_themed(Theme.label("Model", config.DEFAULT_MODEL))

        elif command == "/clear":
            os.system('cls' if os.name == 'nt' else 'clear')

        else:
            nyx.say(f"Unknown: {command}. Try /help.", "idle")

        return True

    def _show_status(self) -> None:
        """Display session status."""
        print_themed(f"\n{Theme.header('  SPIRAL STATUS  ')}")
        print()

        if self.agent_loop and self.agent_loop.state:
            s = self.agent_loop.state
            print_themed(Theme.label("Task", s.task or "None"))
            print_themed(Theme.label("Intent", s.intent or "N/A"))
            print_themed(Theme.label("Tasks Completed", str(s.task_id)))
            print_themed(Theme.label("Files Created", str(len(s.files_created))))
            print_themed(Theme.label("Debug Cycles", str(s.debug_attempts)))
            print_themed(Theme.label("Errors", str(s.error_count)))
            print_themed(Theme.label("Tests Run", str(len(s.test_results))))

        print()
        self.token_meter.display()

        if self.agent_loop:
            print_themed(f"\n  {Colors.DIM}{self.agent_loop.short_memory.summary()}{Colors.RESET}")
            print_themed(f"  {Colors.DIM}{self.agent_loop.long_memory.summary()}{Colors.RESET}")
            print_themed(f"  {Colors.DIM}{self.agent_loop.workspace.summary()}{Colors.RESET}")
        print()
