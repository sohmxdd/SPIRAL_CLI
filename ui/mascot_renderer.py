"""
SPIRAL Mascot Renderer v3.0
Pixel-accurate rendering of the Nyx sprite with vivid SPIRAL purple gradient.
Compact 6-7 line rendering with half-block characters for double resolution.

Uses PIL to load the original pixel art and renders it directly
in the terminal using ANSI 24-bit color + block characters.

NO grayscale. NO intensity mapping. NO dull colors.
Each pixel rendered with SPIRAL's vivid purple gradient.
"""

import os
from pathlib import Path
from typing import Optional, Tuple, List

try:
    from PIL import Image
except ImportError:
    Image = None


# ─── Constants ─────────────────────────────────────────────────

_PKG_DIR = Path(__file__).parent.parent.resolve()
_MASCOT_DIR = _PKG_DIR / "mascot"
_DEFAULT_IMAGE = "png-clipart-emojipedia-space-invaders-iphone-emoji-purple-violet.png"
_LOGO_SIZE_REF = "logo_size.png"

# Render size — compact for 6-7 terminal lines
# Using half-block chars (▀▄), each row = 2 pixel rows → 14 pixel rows = 7 lines
SPRITE_WIDTH = 14    # columns (each pixel = "██" → 28 visual chars)
SPRITE_HEIGHT = 14   # rows (rendered with half-blocks → 7 terminal lines)

# Transparency threshold
ALPHA_THRESHOLD = 30

# Background detection
BG_THRESHOLD = 200


# ─── SPIRAL Purple Gradient Palette ────────────────────────────
# Deep purple → Bright purple → Light violet
# These are vivid, saturated purples — NOT dull grayish tones

PURPLE_GRADIENT = {
    "deep":    (75, 0, 130),     # Deep indigo purple — outlines/dark
    "base":    (128, 0, 200),    # Rich purple — main body
    "bright":  (155, 89, 210),   # Bright purple — mid tone
    "light":   (190, 130, 255),  # Light violet — highlights
    "accent":  (210, 170, 255),  # Pale violet — brightest accents
    "glow":    (180, 100, 255),  # Glowing purple — for state effects
}


def _remap_to_spiral_purple(r: int, g: int, b: int) -> Tuple[int, int, int]:
    """
    Remap a pixel color to SPIRAL's vivid purple gradient.
    Uses luminance to pick the right shade — dark pixels get deep purple,
    bright pixels get light violet. Always vivid, never grayish.
    """
    # Calculate luminance (perceived brightness)
    lum = int(0.299 * r + 0.587 * g + 0.114 * b)

    # Very dark (outlines, edges) — keep near-black but with purple tint
    if lum < 30:
        return (20, 0, 35)

    # Dark areas — deep indigo
    if lum < 80:
        t = lum / 80.0
        return (
            int(30 + t * 50),
            int(0 + t * 5),
            int(50 + t * 80),
        )

    # Mid tones — rich to bright purple
    if lum < 170:
        t = (lum - 80) / 90.0
        return (
            int(80 + t * 75),
            int(5 + t * 84),
            int(130 + t * 80),
        )

    # Highlights — light violet to pale accent
    t = min(1.0, (lum - 170) / 85.0)
    return (
        int(155 + t * 55),
        int(89 + t * 81),
        int(210 + t * 45),
    )


def _is_background(r: int, g: int, b: int, a: int) -> bool:
    """Check if a pixel should be treated as transparent/background."""
    if a < ALPHA_THRESHOLD:
        return True
    if r > BG_THRESHOLD and g > BG_THRESHOLD and b > BG_THRESHOLD:
        return True
    return False


def _apply_state_tint(r: int, g: int, b: int, state: str) -> Tuple[int, int, int]:
    """Apply a subtle state-specific color tint."""
    if state == "error":
        # Warm the purple slightly toward red
        return (min(255, r + 40), max(0, g - 15), max(0, b - 20))
    elif state == "success":
        # Cool the purple slightly toward cyan
        return (max(0, r - 15), min(255, g + 30), min(255, b + 10))
    elif state == "thinking":
        # Brighten slightly
        return (min(255, r + 15), min(255, g + 15), min(255, b + 25))
    elif state == "warning":
        # Amber tint
        return (min(255, r + 30), min(255, g + 15), max(0, b - 25))
    return (r, g, b)


# ─── ANSI Helpers ──────────────────────────────────────────────

def _ansi_fg(r: int, g: int, b: int) -> str:
    """24-bit ANSI foreground color."""
    return f"\033[38;2;{r};{g};{b}m"

def _ansi_bg(r: int, g: int, b: int) -> str:
    """24-bit ANSI background color."""
    return f"\033[48;2;{r};{g};{b}m"

def _ansi_reset() -> str:
    return "\033[0m"


# ─── Renderer ─────────────────────────────────────────────────

class MascotRenderer:
    """
    Pixel-accurate terminal renderer for the Nyx mascot sprite v3.0.

    Renders compact (6-7 lines) using half-block characters (▀▄)
    for double vertical resolution. Colors mapped to SPIRAL's
    vivid purple gradient palette.
    """

    def __init__(
        self,
        image_path: str = None,
        width: int = SPRITE_WIDTH,
        height: int = SPRITE_HEIGHT,
    ):
        self._image_path = image_path or str(_MASCOT_DIR / _DEFAULT_IMAGE)
        self._width = width
        self._height = height
        self._cached_frames: dict = {}  # state -> rendered string
        self._pixel_grid = None  # cached RGBA pixel grid
        self._loaded = False

        # Load and cache on init
        self._load_image()

    def _load_image(self) -> None:
        """Load image and prepare pixel grid."""
        if Image is None:
            return

        if not os.path.exists(self._image_path):
            return

        try:
            img = Image.open(self._image_path)
            img = img.convert("RGBA")

            # Resize with NEAREST for pixel art sharpness
            img = img.resize((self._width, self._height), Image.NEAREST)

            self._pixel_grid = img.load()
            self._img_obj = img
            self._loaded = True

            # Pre-render all states
            for state in ("idle", "thinking", "success", "error", "warning", "info"):
                self._cached_frames[state] = self._render_state(state)

        except Exception:
            self._loaded = False

    def _render_state(self, state: str) -> str:
        """
        Render the sprite for a given state using half-block characters.

        Half-block technique:
        - Process pixels in pairs (row, row+1)
        - Use "▀" with fg=top_color, bg=bottom_color
        - This gives 2× vertical resolution in the same terminal space
        """
        if not self._pixel_grid:
            return ""

        lines = []

        # Process rows in pairs for half-block rendering
        for y in range(0, self._height, 2):
            line_parts = ["    "]  # left indent

            for x in range(self._width):
                # Top pixel
                r1, g1, b1, a1 = self._pixel_grid[x, y]
                top_bg = _is_background(r1, g1, b1, a1)

                # Bottom pixel (may not exist for odd heights)
                if y + 1 < self._height:
                    r2, g2, b2, a2 = self._pixel_grid[x, y + 1]
                    bot_bg = _is_background(r2, g2, b2, a2)
                else:
                    bot_bg = True
                    r2, g2, b2 = 0, 0, 0

                if top_bg and bot_bg:
                    # Both transparent — empty space
                    line_parts.append("  ")
                elif top_bg and not bot_bg:
                    # Only bottom pixel — use ▄ with fg=bottom
                    pr, pg, pb = _remap_to_spiral_purple(r2, g2, b2)
                    pr, pg, pb = _apply_state_tint(pr, pg, pb, state)
                    line_parts.append(f"{_ansi_fg(pr, pg, pb)}▄▄{_ansi_reset()}")
                elif not top_bg and bot_bg:
                    # Only top pixel — use ▀ with fg=top
                    pr, pg, pb = _remap_to_spiral_purple(r1, g1, b1)
                    pr, pg, pb = _apply_state_tint(pr, pg, pb, state)
                    line_parts.append(f"{_ansi_fg(pr, pg, pb)}▀▀{_ansi_reset()}")
                else:
                    # Both pixels — ▀ with fg=top, bg=bottom
                    tr, tg, tb = _remap_to_spiral_purple(r1, g1, b1)
                    tr, tg, tb = _apply_state_tint(tr, tg, tb, state)
                    br, bg_, bb = _remap_to_spiral_purple(r2, g2, b2)
                    br, bg_, bb = _apply_state_tint(br, bg_, bb, state)
                    line_parts.append(
                        f"{_ansi_fg(tr, tg, tb)}{_ansi_bg(br, bg_, bb)}▀▀{_ansi_reset()}"
                    )

            lines.append("".join(line_parts))

        return "\n".join(lines)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def render(self, state: str = "idle") -> str:
        """
        Get the rendered sprite string for a given state.
        Returns cached output for performance.
        """
        if not self._loaded:
            return ""
        return self._cached_frames.get(state, self._cached_frames.get("idle", ""))

    def display(self, state: str = "idle") -> None:
        """Print the sprite to terminal."""
        output = self.render(state)
        if output:
            print(output, flush=True)

    def get_lines(self, state: str = "idle") -> List[str]:
        """Get the rendered sprite as a list of lines (for side-by-side layout)."""
        output = self.render(state)
        if output:
            return output.split("\n")
        return []


# ─── Global Instance ──────────────────────────────────────────

_renderer: Optional[MascotRenderer] = None


def get_renderer() -> MascotRenderer:
    """Get or create the global mascot renderer (lazy init)."""
    global _renderer
    if _renderer is None:
        _renderer = MascotRenderer()
    return _renderer


def render_mascot(state: str = "idle") -> None:
    """Convenience: render mascot sprite to terminal."""
    renderer = get_renderer()
    if renderer.is_loaded:
        renderer.display(state)


def get_mascot_string(state: str = "idle") -> str:
    """Convenience: get mascot sprite as string."""
    renderer = get_renderer()
    return renderer.render(state)


def get_mascot_lines(state: str = "idle") -> List[str]:
    """Convenience: get mascot sprite as list of lines."""
    renderer = get_renderer()
    return renderer.get_lines(state)
