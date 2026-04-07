"""
SPIRAL Configuration
Global settings for the autonomous coding agent.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the package directory (not cwd)
_pkg_dir = Path(__file__).parent.resolve()
_env_path = _pkg_dir / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()  # fallback to cwd

# ─── LLM Settings ──────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_MODEL = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama-3.1-8b-instant"
MAX_TOKENS_PER_CALL = 4096
TEMPERATURE = 0.2

# ─── Agent Loop Settings ───────────────────────────────────────
MAX_ITERATIONS = 10         # Max total loop cycles per task
MAX_DEBUG_RETRIES = 3       # Max debug attempts per failure
MAX_REPLAN_CYCLES = 3       # Max times plan can be refined
EXEC_TIMEOUT = 30           # Seconds before subprocess kill
MAX_CONTEXT_MESSAGES = 30   # Short-term memory window

# ─── Token Budget ──────────────────────────────────────────────
TOKEN_BUDGET = 100000       # Total token budget per session
TOKEN_WARN_THRESHOLD = 0.7  # Nyx warns at 70%
TOKEN_CRITICAL = 0.9        # Nyx gets serious at 90%

# ─── Intent Classification ────────────────────────────────────
INTENT_CLASSIFICATION = True  # Enable LLM-based intent analysis

# ─── Execution Safety ─────────────────────────────────────────
SAFE_COMMANDS = [
    "python", "python3", "py", "pip", "pip3",
    "node", "npm", "npx",
    "ls", "dir", "cat", "type", "echo", "find",
    "mkdir", "touch", "cp", "copy", "move", "mv",
    "git", "cargo", "go", "rustc", "javac", "java",
    "head", "tail", "wc", "sort", "grep",
]

# ─── Paths ─────────────────────────────────────────────────────
WORKSPACE_DIR = os.getcwd()  # Work in current directory, not a sandbox
MEMORY_FILE = os.path.join(str(_pkg_dir), ".spiral_memory.json")
WORKSPACE_CONTEXT_DIR = os.path.join(str(_pkg_dir), "memory", "workspace_context")

# ─── Display ───────────────────────────────────────────────────
SHOW_TOKEN_METER = True
SHOW_MASCOT_ART = True

# ─── Python Executable ────────────────────────────────────────
PYTHON_EXE = sys.executable

# ─── Chat Mode ─────────────────────────────────────────────────
CHAT_SYSTEM_PROMPT = """You are Nyx, the AI guide of SPIRAL — an autonomous coding agent.

Personality:
- Calm, intelligent, slightly witty
- Speaks in concise, sharp sentences
- Uses technical language naturally
- Helpful but never over-explains
- You ARE the system — not a separate entity

When answering questions:
- Be direct and informative
- Include code snippets when relevant (use proper formatting)
- For coding questions, give working examples
- Keep answers focused — no fluff

When responding to casual input:
- Be brief and personable
- Stay in character as a system presence
- Light humor is welcome

Always respond as Nyx. Never break character."""
