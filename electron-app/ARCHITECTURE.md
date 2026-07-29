# SPIRAL CLI GUI — Architecture & Process Model

This document outlines the v1 desktop architecture for the SPIRAL CLI Coding Agent GUI.

## System Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      ELECTRON MAIN PROCESS                             │
 │  (Node.js runtime, window lifecycle, dialogs, process management)      │
 └─────────────────┬────────────────────────────────────▲─────────────────┘
                   │ IPC Handlers                       │ IPC Events
                   │ (spawn, sendInput, kill, dialogs)  │ (agent:stdout/stderr)
 ┌─────────────────▼────────────────────────────────────┴─────────────────┐
 │                      PRELOAD CONTEXT BRIDGE                            │
 │  (Secure contextBridge exposing window.api without nodeIntegration)    │
 └─────────────────┬────────────────────────────────────▲─────────────────┘
                   │ Function Calls                     │ Event Listeners
 ┌─────────────────▼────────────────────────────────────┴─────────────────┐
 │                      ELECTRON RENDERER PROCESS                         │
 │  (React + TypeScript + Tailwind CSS + xterm.js UI Component)            │
 └────────────────────────────────────────────────────────────────────────┘
                   │
                   │ Spawns via child_process.spawn('python', ['-u', 'main.py'])
 ┌─────────────────▼──────────────────────────────────────────────────────┐
 │                      SPIRAL CLI AGENT (Python)                         │
 │  (Existing codebase: main.py, core loop, subagents, tools, Groq LLM)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## Architectural Breakdown

### 1. Main Process (`src/main/index.ts` & `src/main/agentManager.ts`)
- **Child Process Management:** Spawns `python -u main.py` using Node.js `child_process.spawn`.
- **CWD Support:** Uses the selected working directory as the child process `cwd`.
- **Lifecycle Protection:** Registers `app.on('before-quit')`, `window.on('close')`, and `app.on('window-all-closed')` handlers ensuring `killAgent()` terminates any lingering Python child processes cleanly.
- **FS & Dialogs:** Exposes native folder selection via `dialog.showOpenDialog` and reads directory trees recursively for the sidebar.

### 2. Preload Bridge (`src/preload/index.ts`)
- Configured with `contextBridge.exposeInMainWorld('api', ...)` with `nodeIntegration: false` and `contextIsolation: true`.
- Exposes typed functions (`spawnAgent`, `sendInput`, `killAgent`, `selectDirectory`, `getDirectoryTree`) and streaming listeners (`onAgentStdout`, `onAgentStderr`, `onAgentExit`).

### 3. Renderer Process (`src/renderer/src/`)
- **`App.tsx`:** Master container orchestrating sidebar workspace context, terminal state, input bar, and header.
- **`Sidebar.tsx` & `FileTree.tsx`:** Explorer tree rendering working directory files.
- **`Terminal.tsx`:** Embedded `xterm.js` viewport rendering raw ANSI streams (spinners, color schemes, Nyx mascot graphics, box drawings).
- **`InputBar.tsx`:** Rounded dark input bar with file attachment support (`/read <path>`), send button, and process control.

---

## How to Run

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+ with dependencies installed (`pip install -r requirements.txt`)
- `GROQ_API_KEY` set in repository `.env` file

### Development
Navigate to the `electron-app/` directory and run:
```bash
cd electron-app
npm install
npm run dev
```

### Typecheck & Production Build
```bash
cd electron-app
npm run typecheck
npm run build
```
