<div align="center">

#  SPIRAL / Nyx CLI
**The Advanced Autonomous AI Coding Agent**

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-purple?style=for-the-badge" alt="Status Active" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/Architecture-Autonomous-8A2BE2?style=for-the-badge" alt="LLM Powered" />
</p>

<!-- 
=======================================================================
PLACEHOLDER FOR YOUR SCREENSHOT
Replace the 'src' in the img tag below with the path to your actual screenshot.
=======================================================================
-->
<img src="https://via.placeholder.com/800x400/2D1B4e/FFFFFF?text=Insert+Nyx+CLI+Screenshot+Here" alt="Nyx CLI Interface Screenshot Placeholder" width="800" style="border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"/>
<br>
<em>*The sleek, purple-themed, Claude-style interface featuring our pixel-accurate Nyx mascot.*</em>

</div>

<br>

##  Overview

**SPIRAL (Nyx CLI)** is a sophisticated, production-grade autonomous AI coding system built for real-world robustness. It moves beyond standard LLM wrappers by featuring an intent-based dual-mode architecture, offering both conversational assistance and autonomous, multi-step execution. With integrated workspace memory, advanced testing systems, and a meticulously crafted UI, Nyx is your ultimate pair-programming companion.

---

##  Key Features

-  **Dual-Mode Architecture**: Seamlessly switch between **Agent Mode** (for autonomous, multi-step problem solving and iterative loops) and **Chat Mode** (for quick conversations and intent-based assistance).
-  **Persistent Workspace Memory**: Never lose context. Nyx remembers past interactions, files read, and workspace states, allowing for true stateful problem-solving across development sessions.
-  **Rigorous Verification Pipeline**: Code execution isn't blindly trusted. Our internal verification agents evaluate outcomes, test for failures, and dynamically iterate until the objective is fully met.
-  **Stunning Aesthetic UI**: Designed with a sleek, premium purple-tinted aesthetic inspired by modern interfaces. Enjoy fluid input handling, real-time logging, and pixel-accurate rendering of our mascot, Nyx.
-  **True Iterative Execution**: Instead of single-shot generation, the agent explores, plans, executes, and refines in a continuous, robust feedback loop to eliminate failures before returning control.

---

##  Installation

Ensure you have Python 3.10 or higher installed.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sohmxdd/SPIRAL_CLI.git
   cd SPIRAL_CLI
   ```

2. **Set up a virtual environment (Recommended):**
   ```bash
   python -m venv .venv
   
   # Provide execution policy if required (Windows)
   .venv\Scripts\activate
   # Or on Mac/Linux:
   # source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Setup:**
   Copy the example environment file and configure your keys:
   ```bash
   cp .env.example .env
   ```
   *(Add your actual LLM provider APIs inside the newly created `.env` file)*

---

##  Usage

Launch the agent using the included startup script (which handles environment checks securely) or via Python:

```bash
# Windows
run.bat

# Standard
python main.py
```

Once running, state your objective, and Nyx will autonomously plan, execute, and verify the task for you.

---

## 🏗️ Architecture Under the Hood

The SPIRAL architecture relies on clearly structured, decoupled components:
- `core/`: Drives the true iterative execution loop and system lifecycle.
- `agents/`: Pluggable, specialized sub-agents (Planner, Verifier, Executor) for delegating system tasks.
- `llm/`: Handles dynamic and structured communications with large language models.
- `memory/`: Disk-backed workspace tracking mechanism that commits context safely to `.spiral_memory.json`.
- `ui/` & `mascot/`: Controls the interactive terminal user interface, responsive formatting, and sprite rendering.

---

<div align="center">
  <i>Built to be beautiful. Built to be robust.</i>
</div>