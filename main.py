"""
SPIRAL — Autonomous CLI Coding Agent
Entry point. Can be run directly or via the `spiral` CLI command.

Usage:
    python main.py
    spiral          (after pip install -e .)

Powered by Groq. Guided by Nyx.
"""

import sys
import os

# Ensure the project root is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run():
    """Launch SPIRAL. Used as console_scripts entry point."""
    from ui.cli import SpiralCLI
    try:
        cli = SpiralCLI()
        cli.start()
    except KeyboardInterrupt:
        print("\n")
        sys.exit(0)
    except Exception as e:
        print(f"\n[FATAL] {e}")
        sys.exit(1)


if __name__ == "__main__":
    run()