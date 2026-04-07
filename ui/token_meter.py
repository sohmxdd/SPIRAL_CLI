"""
SPIRAL Token Meter
Purple-themed token usage visualization with Nyx commentary.
"""

from ui.theme import Colors, Theme
import config


class TokenMeter:
    """
    Tracks and visualizes token usage across the session.
    Purple-themed bar with Nyx personality commentary.
    """

    def __init__(self, budget: int = None):
        self.budget = budget or config.TOKEN_BUDGET
        self.input_tokens = 0
        self.output_tokens = 0
        self.call_count = 0
        self.history = []  # (input, output) per call

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def usage_ratio(self) -> float:
        if self.budget <= 0:
            return 0.0
        return min(self.total_tokens / self.budget, 1.0)

    @property
    def percentage(self) -> int:
        return int(self.usage_ratio * 100)

    def record(self, input_tokens: int, output_tokens: int) -> None:
        """Record token usage from an LLM call."""
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.call_count += 1
        self.history.append((input_tokens, output_tokens))

    def render_bar(self, width: int = 20) -> str:
        """Render the purple token usage bar."""
        filled = int(self.usage_ratio * width)
        empty = width - filled

        # Color based on usage level
        if self.usage_ratio >= config.TOKEN_CRITICAL:
            bar_color = Colors.ERROR
        elif self.usage_ratio >= config.TOKEN_WARN_THRESHOLD:
            bar_color = Colors.VIOLET
        else:
            bar_color = Colors.PURPLE

        bar = (
            f"{bar_color}{Colors.BLOCK_FULL * filled}{Colors.RESET}"
            f"{Colors.DIM}{Colors.BLOCK_EMPTY * empty}{Colors.RESET}"
        )

        pct = f"{self.percentage}%"
        return f"{bar} {Colors.WHITE}{pct}{Colors.RESET}"

    def render(self) -> str:
        """Full token meter display."""
        bar = self.render_bar()
        icon = "🟣"
        if self.usage_ratio >= config.TOKEN_CRITICAL:
            icon = "⚡"
        elif self.usage_ratio >= config.TOKEN_WARN_THRESHOLD:
            icon = "🟣"

        prefix = f"{Colors.DIM_PURPLE}[{Colors.RESET}{Colors.PURPLE_BOLD}Nyx{Colors.RESET} {icon}{Colors.DIM_PURPLE}]{Colors.RESET}"
        meter_line = f"{prefix} {Colors.DIM_PURPLE}Tokens:{Colors.RESET} {bar}"

        # Detail line
        detail = (
            f"       {Colors.DIM}in:{Colors.RESET} {Colors.GRAY}{self.input_tokens:,}{Colors.RESET}"
            f" {Colors.DIM}out:{Colors.RESET} {Colors.GRAY}{self.output_tokens:,}{Colors.RESET}"
            f" {Colors.DIM}total:{Colors.RESET} {Colors.GRAY}{self.total_tokens:,}{Colors.RESET}"
            f" {Colors.DIM}calls:{Colors.RESET} {Colors.GRAY}{self.call_count}{Colors.RESET}"
        )

        return f"{meter_line}\n{detail}"

    def get_nyx_comment(self) -> str:
        """Get Nyx's commentary on token usage."""
        ratio = self.usage_ratio

        if ratio < 0.1:
            return ""  # Too early to comment
        elif ratio < 0.3:
            return "Efficient. I like it."
        elif ratio < 0.5:
            return "Reasonable burn rate."
        elif ratio < 0.7:
            return "Token usage rising."
        elif ratio < 0.9:
            return "Careful. We're getting expensive."
        else:
            return "Budget critical. Make this count."

    def display(self) -> None:
        """Print the full meter with optional Nyx comment."""
        if not config.SHOW_TOKEN_METER:
            return

        print(f"\n{self.render()}", flush=True)

        comment = self.get_nyx_comment()
        if comment:
            from ui.mascot import nyx
            nyx.say(comment, "warning" if self.usage_ratio > 0.7 else "info")

    def reset(self) -> None:
        """Reset all counters."""
        self.input_tokens = 0
        self.output_tokens = 0
        self.call_count = 0
        self.history = []
