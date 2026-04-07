"""
SPIRAL Theme Engine
Purple/black cyberpunk aesthetic for the CLI.
All colors use ANSI escape codes via colorama for Windows compatibility.
"""

from colorama import init, Fore, Back, Style
import sys
import os

# Initialize colorama for Windows ANSI support
init(autoreset=True)


# ─── ANSI Color Codes (Extended Purple Palette) ────────────────
# Colorama doesn't have purple, so we use raw ANSI 256-color codes.

class Colors:
    """Purple-dominant color palette for SPIRAL."""

    # ── Core Purple Shades ──
    PURPLE       = "\033[38;5;135m"   # Primary purple — Nyx identity
    PURPLE_BOLD  = "\033[1;38;5;135m" # Bold purple for emphasis
    DEEP_PURPLE  = "\033[38;5;93m"    # Deeper purple for headers
    LIGHT_PURPLE = "\033[38;5;183m"   # Light violet for success/glow
    DIM_PURPLE   = "\033[38;5;96m"    # Muted purple for backgrounds
    VIOLET       = "\033[38;5;141m"   # Violet for accents
    BRIGHT_PURPLE = "\033[38;5;129m"  # Vivid bright purple for highlights

    # ── Functional Colors ──
    ERROR        = "\033[38;5;168m"   # Purple-red tint for errors
    SUCCESS      = "\033[38;5;183m"   # Light violet glow
    WARNING      = "\033[38;5;179m"   # Amber (not orange, golden)
    INFO         = "\033[38;5;147m"   # Soft lavender info

    # ── Neutrals ──
    WHITE        = "\033[38;5;255m"
    GRAY         = "\033[38;5;245m"
    DIM          = "\033[38;5;240m"
    DARK         = "\033[38;5;236m"

    # ── Special ──
    RESET        = "\033[0m"
    BOLD         = "\033[1m"
    DIM_STYLE    = "\033[2m"
    ITALIC       = "\033[3m"
    UNDERLINE    = "\033[4m"

    # ── Bar Characters ──
    BLOCK_FULL   = "█"
    BLOCK_EMPTY  = "░"
    BLOCK_MED    = "▓"
    BLOCK_LIGHT  = "▒"


class Theme:
    """Themed output helpers for consistent CLI styling."""

    @staticmethod
    def purple(text: str) -> str:
        """Primary purple text."""
        return f"{Colors.PURPLE}{text}{Colors.RESET}"

    @staticmethod
    def bold_purple(text: str) -> str:
        """Bold purple text — for headings and Nyx name."""
        return f"{Colors.PURPLE_BOLD}{text}{Colors.RESET}"

    @staticmethod
    def deep(text: str) -> str:
        """Deep purple text — for headers."""
        return f"{Colors.DEEP_PURPLE}{text}{Colors.RESET}"

    @staticmethod
    def dim(text: str) -> str:
        """Dimmed gray text — for metadata."""
        return f"{Colors.DIM}{text}{Colors.RESET}"

    @staticmethod
    def error(text: str) -> str:
        """Purple-red error text."""
        return f"{Colors.ERROR}{text}{Colors.RESET}"

    @staticmethod
    def success(text: str) -> str:
        """Light violet success text."""
        return f"{Colors.SUCCESS}{text}{Colors.RESET}"

    @staticmethod
    def warning(text: str) -> str:
        """Warning text."""
        return f"{Colors.WARNING}{text}{Colors.RESET}"

    @staticmethod
    def info(text: str) -> str:
        """Info text."""
        return f"{Colors.INFO}{text}{Colors.RESET}"

    @staticmethod
    def white(text: str) -> str:
        """Clean white text."""
        return f"{Colors.WHITE}{text}{Colors.RESET}"

    @staticmethod
    def gray(text: str) -> str:
        """Gray text."""
        return f"{Colors.GRAY}{text}{Colors.RESET}"

    @staticmethod
    def violet(text: str) -> str:
        """Violet accent text."""
        return f"{Colors.VIOLET}{text}{Colors.RESET}"

    # ─── Structural Elements ──────────────────────────────────

    @staticmethod
    def separator(char: str = "─", width: int = 60) -> str:
        """Purple horizontal line."""
        return f"{Colors.DIM_PURPLE}{char * width}{Colors.RESET}"

    @staticmethod
    def header(text: str, width: int = 60) -> str:
        """Boxed header with purple borders."""
        border = f"{Colors.DEEP_PURPLE}{'━' * width}{Colors.RESET}"
        padded = text.center(width)
        return (
            f"\n{border}\n"
            f"{Colors.DEEP_PURPLE}┃{Colors.RESET}"
            f"{Colors.PURPLE_BOLD}{padded}{Colors.RESET}"
            f"{Colors.DEEP_PURPLE}┃{Colors.RESET}\n"
            f"{border}"
        )

    @staticmethod
    def box(text: str, width: int = 58) -> str:
        """Bordered box around text."""
        lines = text.split('\n')
        top    = f"{Colors.DIM_PURPLE}╭{'─' * width}╮{Colors.RESET}"
        bottom = f"{Colors.DIM_PURPLE}╰{'─' * width}╯{Colors.RESET}"
        body = ""
        for line in lines:
            padded = line.ljust(width)[:width]
            body += f"{Colors.DIM_PURPLE}│{Colors.RESET} {Colors.WHITE}{padded}{Colors.RESET}{Colors.DIM_PURPLE}│{Colors.RESET}\n"
        return f"{top}\n{body}{bottom}"

    @staticmethod
    def label(key: str, value: str) -> str:
        """Key: value pair with themed colors."""
        return f"  {Colors.DIM_PURPLE}{key}:{Colors.RESET} {Colors.WHITE}{value}{Colors.RESET}"

    @staticmethod
    def step_indicator(current: int, total: int, label: str) -> str:
        """Step progress indicator."""
        return (
            f"  {Colors.PURPLE}[{current}/{total}]{Colors.RESET} "
            f"{Colors.WHITE}{label}{Colors.RESET}"
        )

    @staticmethod
    def code_block(code: str, language: str = "") -> str:
        """Display code with purple borders."""
        lines = code.split('\n')
        header = f"{Colors.DIM_PURPLE}┌── {language} {'─' * (50 - len(language))}┐{Colors.RESET}"
        footer = f"{Colors.DIM_PURPLE}└{'─' * 55}┘{Colors.RESET}"
        body = ""
        for i, line in enumerate(lines, 1):
            num = f"{Colors.DIM}{i:3}{Colors.RESET}"
            body += f"{Colors.DIM_PURPLE}│{Colors.RESET} {num} {Colors.GRAY}{line}{Colors.RESET}\n"
        return f"{header}\n{body}{footer}"

    # ─── New v3.0 Helpers ─────────────────────────────────────

    @staticmethod
    def mode_badge(mode: str) -> str:
        """Render AGENT or CHAT mode badge."""
        if mode.upper() == "AGENT":
            return (
                f"{Colors.DEEP_PURPLE}[{Colors.RESET}"
                f"{Colors.BRIGHT_PURPLE}⚡AGENT{Colors.RESET}"
                f"{Colors.DEEP_PURPLE}]{Colors.RESET}"
            )
        else:
            return (
                f"{Colors.DEEP_PURPLE}[{Colors.RESET}"
                f"{Colors.VIOLET}💬 CHAT{Colors.RESET}"
                f"{Colors.DEEP_PURPLE}]{Colors.RESET}"
            )

    @staticmethod
    def intent_badge(intent: str) -> str:
        """Render intent classification result."""
        icons = {
            "coding_task": "🔨",
            "debugging_task": "🐛",
            "modification_task": "✏️",
            "question": "❓",
            "casual": "💬",
        }
        icon = icons.get(intent, "•")
        return f"{Colors.DIM_PURPLE}{icon} {intent}{Colors.RESET}"

    @staticmethod
    def input_bar(width: int = 60) -> tuple:
        """
        Render the Claude-style input bar borders.
        Returns (top_border, bottom_border) strings.
        """
        top = f"{Colors.PURPLE}╭{'─' * width}╮{Colors.RESET}"
        bottom = f"{Colors.PURPLE}╰{'─' * width}╯{Colors.RESET}"
        return top, bottom

    @staticmethod
    def side_by_side(left_lines: list, right_lines: list, left_width: int = 30, gap: int = 3) -> str:
        """
        Render two blocks of text side by side.
        Used for startup layout (mascot + info panel).
        """
        max_lines = max(len(left_lines), len(right_lines))
        spacer = " " * gap

        output_lines = []
        for i in range(max_lines):
            left = left_lines[i] if i < len(left_lines) else ""
            right = right_lines[i] if i < len(right_lines) else ""

            # Pad left side (accounting for ANSI codes — use raw padding)
            # Strip ANSI to measure visible length
            visible_left = _strip_ansi(left)
            pad = max(0, left_width - len(visible_left))
            output_lines.append(f"{left}{' ' * pad}{spacer}{right}")

        return "\n".join(output_lines)


def _strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences for length calculation."""
    import re
    return re.sub(r'\033\[[0-9;]*m', '', text)


def print_themed(text: str) -> None:
    """Print with theme and flush."""
    print(text, flush=True)


def get_terminal_width() -> int:
    """Get terminal width, defaulting to 80."""
    try:
        return os.get_terminal_size().columns
    except (ValueError, OSError):
        return 80
