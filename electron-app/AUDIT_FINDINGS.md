# 🔍 Full System Audit — `electron-app/`

This audit document identifies all hardcoded/seeded data, unwired UI affordances, dead code, swallowed errors, and runtime inconsistencies across the Electron app codebase prior to Part 2 & Part 3 refactoring.

---

## 🚨 Category 1: Breaks Demo (Critical Issues)

### 1. Missing Ground-Truth Terminal View (`Terminal.tsx`)
- **File & Line:** [App.tsx:L171-L238](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/App.tsx#L171-L238) / [Terminal.tsx](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/Terminal.tsx)
- **Finding:** The `Terminal` component (xterm.js viewport) was completely detached from `App.tsx` during the recent UI refactor. Standard output is currently piped only into string buffers in `App.tsx`.
- **Impact:** The ground-truth xterm.js terminal view required alongside structured agent views is missing, breaking live side-by-side terminal verification during demo runs.

### 2. Silently Swallowed Process & Spawn Errors
- **File & Line:** [App.tsx:L36, L94](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/App.tsx#L36), [agentManager.ts:L41-L47, L80-L84](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/main/agentManager.ts#L41-L47)
- **Finding:** If `main.py` is missing, Python fails to launch, or Groq API returns a fatal connection error, `spawnAgent` returns `{ success: false, error: '...' }`, but `App.tsx` ignores `res.error` completely and displays no error banner or toast.
- **Impact:** If python fails or API keys are missing, the GUI remains stuck in "Agent Active" or idle without telling the user why.

---

## 🎭 Category 2: Looks Fake (Hardcoded / Stubbed Data)

### 1. Static Non-Functional Model Selector Pill
- **File & Line:** [ClaudeInput.tsx:L90-L93](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/ClaudeInput.tsx#L90-L93)
- **Finding:** Hardcoded `"Groq Llama 3.3"` label rendered inside a `<div>` with `cursor-pointer` and `ChevronDown`, but has no onClick handler, no dropdown menu, and no IPC integration to query or switch models.
- **Impact:** Looks like a non-working demo stub.

### 2. Dummy Unwired Sidebar Menu Items
- **File & Line:** [ClaudeSidebar.tsx:L54-L72](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/ClaudeSidebar.tsx#L54-L72)
- **Finding:** Navigation items (`Home`, `Code`, `Projects`, `Customize`) are static `<div>` elements styled with hover states but no click handlers or functional views.
- **Impact:** Gives the impression of non-functional placeholder UI.

### 3. Non-Interactive Recents List Items
- **File & Line:** [ClaudeSidebar.tsx:L123-L131](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/ClaudeSidebar.tsx#L123-L131)
- **Finding:** Items in `recentChats` render as clickable-looking rows (`cursor-pointer`) but lack click handlers to switch active chat threads or clear history.
- **Impact:** Clicking recent chat history items does nothing.

---

## 🧹 Category 3: Minor Polish (Scaffolding & Swallowed Errors)

### 1. Swallowed File Picker & Directory Errors
- **File & Line:** [ClaudeInput.tsx:L51-L53](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/ClaudeInput.tsx#L51-L53), [FileTree.tsx:L72-L74](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/components/FileTree.tsx#L72-L74)
- **Finding:** File selection failures or directory read errors log to `console.error` or return empty arrays without surfacing feedback to the user interface.

### 2. Duplicate Type Declarations
- **File & Line:** [src/preload/index.d.ts](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/preload/index.d.ts) vs [src/renderer/src/env.d.ts](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/env.d.ts)
- **Finding:** Both files declare `interface Window { api: SpiralAPI }`, creating redundant type declaration overrides.

### 3. Working Directory Enforce Mismatch
- **File & Line:** [App.tsx:L63-L103](file:///c:/Users/SOHAM/Nyx_CLI/electron-app/src/renderer/src/App.tsx#L63-L103)
- **Finding:** User can submit prompts before selecting a project directory (`currentDir` is null). Python runs in repository root instead of prompting user to select a workspace.
