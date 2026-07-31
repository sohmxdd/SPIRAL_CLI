import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ─── Package Directories ───────────────────────────────────────
_pkg_dir = Path(__file__).parent.resolve()
_env_path = _pkg_dir / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv()

# ─── LLM Settings ──────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
DEFAULT_MODEL = GROQ_MODEL
FALLBACK_MODEL = "llama-3.1-8b-instant"
MAX_TOKENS_PER_CALL = 4096
TEMPERATURE = 0.2
DEFAULT_TEMPERATURE = 0.2

# ─── Agent Loop Settings ───────────────────────────────────────
MAX_ITERATIONS = 10
MAX_PLAN_STEPS = 10
MAX_HISTORY_ITEMS = 20
MAX_DEBUG_RETRIES = 3
MAX_REPLAN_CYCLES = 3
EXEC_TIMEOUT = 30
MAX_CONTEXT_MESSAGES = 30

# ─── Token Budget & Thresholds ─────────────────────────────────
TOKEN_BUDGET = 100000
TOKEN_WARN = 0.7
TOKEN_WARN_THRESHOLD = 0.7
TOKEN_CRITICAL = 0.9

# ─── Features & Safety ─────────────────────────────────────────
ENABLE_VERIFIER = True
ENABLE_REFLECTOR = True
INTENT_CLASSIFICATION = True
SAFE_MODE = True
CONFIRM_DESTRUCTIVE_COMMANDS = True

SAFE_COMMANDS = [
    "python", "python3", "py", "pip", "pip3",
    "node", "npm", "npx",
    "ls", "dir", "cat", "type", "echo", "find",
    "mkdir", "touch", "cp", "copy", "move", "mv",
    "git", "cargo", "go", "rustc", "javac", "java",
    "head", "tail", "wc", "sort", "grep", "cd", "make", "pytest", "unittest"
]

DESTRUCTIVE_PATTERNS = [
    r"rm\s+-rf\s+/",
    r"rm\s+-rf\s+~",
    r"mkfs",
    r"dd\s+if=",
    r">\s*/dev/sd",
    r"del\s+/f\s+/s\s+/q\s+c:\\",
    r"format\s+[c-z]:",
]

ALLOWED_COMMAND_PREFIXES = SAFE_COMMANDS

# ─── Paths ─────────────────────────────────────────────────────
WORKSPACE_DIR = os.getcwd()
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

_personality_override = os.getenv("SPIRAL_PERSONALITY_PROMPT", "").strip()
if _personality_override:
    CHAT_SYSTEM_PROMPT = f"{CHAT_SYSTEM_PROMPT}\n\nAdditional Personality & Persona Directives:\n{_personality_override}"
