# AI-Code Explainer – Chrome Extension

> An AI-powered Chrome Extension that explains code snippets in real-time using a locally running LLM (Phi3 via Ollama in Docker) — fully private, no API keys, no cloud.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [How Each File Works](#how-each-file-works)
6. [Installation & Setup](#installation--setup)
7. [How to Use](#how-to-use)

## Project Overview

AI-Code Explainer is a Chrome browser extension that allows developers to select any code snippet on any webpage and instantly get an AI-generated explanation, bug report, or optimization suggestion — all through a floating draggable panel that appears directly on the page.

Unlike cloud-based AI tools, this extension runs entirely on your own machine using **Ollama**, which hosts LLM models locally. No data leaves your computer, no API keys are needed, and there are no usage limits or costs.

### Problem It Solves

Developers frequently encounter unfamiliar code while browsing documentation, Stack Overflow, GitHub, or tutorials. Switching to a separate AI tool, copying code, pasting it, and waiting for a response breaks the workflow. AI-Code Explainer puts the AI explanation directly on the page in one right-click.

---
## Features

| Feature | Description |
|---|---|
| Instant Explanation | Select any code snippet and get a clear, structured explanation |
| Deep Dive Analysis | Line-by-line breakdown with complexity analysis and design patterns |
| Bug Detection | Identify potential bugs, security issues, and edge cases |
| Code Optimization | Receive performance tips and a refactored version of your code |
| Draggable Panel | Move the floating panel anywhere on screen |
| Multi-mode Tabs | Switch between explanation modes without re-selecting code |
| Copy to Clipboard | One-click copy of the AI explanation |
| Keyboard Shortcut | `Ctrl+Shift+E` to explain selected code instantly |
| Context Menu | Right-click any selection for quick access to all modes |
| No API Key | Runs entirely locally — no accounts or keys needed |
| Offline Support | Works without an internet connection |
| Full Privacy | No code ever leaves your machine |

---

## Project Structure

```
aai-code-explainer/
├── manifest.json        # Extension configuration (Manifest V3)
├── background.js        # Service worker: context menus, Ollama API calls
├── content.js           # Injected script: floating panel UI and interaction
├── content.css          # Styles for the floating panel
├── popup.html           # Extension popup: Ollama status UI
├── popup.js             # Popup logic: connection check
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Architecture

```
User selects code on any webpage
            │
            ▼
  Right-click → Context Menu
  OR Ctrl+Shift+E keyboard shortcut
            │
            ▼
  background.js (Service Worker)
  ├── Injects content.js + content.css into the tab
  └── Sends "showExplainer" message to content script
            │
            ▼
  content.js (runs inside the webpage)
  ├── Creates and displays floating panel
  ├── Shows loading spinner
  └── Sends "explainCode" message to background
            │
            ▼
  background.js
  └── HTTP POST → http://127.0.0.1:11434/api/chat
            │
            ▼
  Ollama (running locally on your machine)
  └── Phi3 model processes the prompt
            │
            ▼
  background.js
  └── Returns response text to content script
            │
            ▼
  content.js
  └── Renders formatted markdown in the panel
```

### Why Manifest V3?

Chrome has migrated all extensions to Manifest V3 (MV3). MV3 replaces persistent background pages with Service Workers, which are short-lived scripts that wake up when needed and shut down when idle. This extension is built for MV3 to be future-proof and compatible with modern Chrome.

---

## How Each File Works

### manifest.json

The extension's configuration file. Declares:
- **permissions**: `activeTab` (read current tab), `contextMenus` (right-click menu), `storage` (save settings), `scripting` (inject content scripts dynamically)
- **host_permissions**: `http://127.0.0.1:11434/*` — allows the service worker to make HTTP requests to Ollama's local API
- **background.service_worker**: Points to `background.js` as the Manifest V3 service worker
- **content_scripts**: Automatically injects `content.js` and `content.css` into every page the user visits

### background.js

The service worker that runs in the background. Responsibilities:

1. **Context menu creation** — On extension install, registers four right-click menu items: Explain, Deep Dive, Find Bugs, Optimize
2. **Context menu handler** — When a menu item is clicked, injects the content script into the tab (in case the tab was open before the extension was loaded), then sends a `showExplainer` message
3. **API call handler** — Listens for `explainCode` messages from content scripts, builds the appropriate prompt based on mode, and calls Ollama's `/api/chat` endpoint
4. **Ollama connection check** — Handles `checkOllama` messages from the popup by calling `/api/tags` to verify Ollama is running

**Prompt engineering**: Each mode uses a carefully crafted system prompt that instructs Phi3 to produce structured markdown output with specific sections. This ensures consistent, readable responses.

### content.js

Injected into every webpage. Responsibilities:

1. **Double-injection guard** — Wrapped in an IIFE with `window.__codelensInitialized` flag to prevent duplicate listeners if the script is injected more than once
2. **Message listener** — Listens for `showExplainer` from the background script
3. **Keyboard shortcut** — `Ctrl+Shift+E` triggers explanation on the current selection
4. **Panel creation** — `showPanel()` builds and injects a div into the page's DOM with the full panel UI
5. **Panel events** — Handles close button, tab switching, copy button, drag-to-move, and Escape key
6. **Explanation trigger** — `triggerExplanation()` sends code + mode to background and renders the response
7. **Markdown renderer** — `formatMarkdown()` converts the model's markdown output to HTML for display

### content.css

Styles for the floating panel. Key design decisions:
- `position: fixed` with `z-index: 2147483647` (maximum possible) ensures the panel always appears on top of any page content
- Dark theme (`#0d1117` background) matches GitHub's dark mode and is easy on the eyes for developers
- The panel uses flexbox for layout with a fixed max-height and scrollable content area
- CSS animation (`cl-slide-in`) gives the panel a smooth entrance

### popup.html + popup.js

The extension popup that appears when you click the toolbar icon. In this version:
- Displays the current Ollama connection status
- Shows step-by-step Docker setup instructions for Ollama and Phi3
- Provides a "Check Connection" button that pings `http://127.0.0.1:11434/api/tags`
- Links to Ollama on Docker Hub and the Phi3 model page

---

## Installation & Setup

### Prerequisites

- Google Chrome browser
- macOS, Linux, or Windows
- Docker Desktop installed and running
- At least 5 GB of free Docker disk space (image + model)
- 8 GB RAM recommended

### Step 1: Start the Ollama Docker Container

```bash
docker run -d -p 11434:11434 -e "OLLAMA_ORIGINS=*" --name ollama ollama/ollama
```

This pulls the official Ollama image, starts it as a background container, exposes the API on `localhost:11434`, and sets `OLLAMA_ORIGINS=*` so Chrome extensions can reach it.

### Step 2: Pull the Phi3:mini Model

```bash
docker exec ollama ollama pull phi3:mini
```

This downloads the Phi-3 Mini model (~2.3 GB) inside the running container. It only needs to be done once.

### Step 3: Verify

```bash
docker exec ollama ollama list
```

You should see `phi3:mini` listed. The extension connects to `http://127.0.0.1:11434` automatically.

### Step 4: Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `aai-code-explainer` folder
5. The AI-Code Explainer icon appears in the toolbar

### Step 5: Verify Connection

1. Click the AI-Code Explainer icon in the toolbar
2. Click **Check Connection**
3. Status should show: `Ollama running — Phi3 model ready`

---

## How to Use

### Method 1: Right-Click Menu

1. Select any code on any webpage
2. Right-click the selected text
3. Choose one of:
   - **Explain with AI-Code Explainer** — Standard explanation
   - **Deep Dive Explanation** — Detailed analysis
   - **Find Bugs & Issues** — Bug detection
   - **Suggest Optimizations** — Performance improvements
4. A floating panel appears with the Phi3-generated response

### Method 2: Keyboard Shortcut

1. Select any code on any webpage
2. Press `Ctrl+Shift+E`
3. The panel appears instantly in Explain mode

### Switching Modes

Once the panel is open, click any tab (Explain / Deep Dive / Bugs / Optimize) to re-analyze the same code in a different mode — no need to re-select.

### Closing the Panel

- Click the **✕** button in the top-right of the panel
- Press **Escape**

---

## AI Explanation Modes

### Explain (Default)
Best for: understanding unfamiliar code quickly.

Returns:
- **What it does** — 1-2 sentence summary
- **How it works** — Step-by-step breakdown
- **Key concepts** — Important patterns and paradigms used
- **Example use case** — Real-world context

### Deep Dive
Best for: thorough code review or learning.

Returns:
- **Overview** — What the code does
- **Line-by-line breakdown** — Detailed walkthrough of every part
- **Design patterns** — Any architectural patterns identified
- **Time & Space complexity** — Big-O analysis where applicable
- **Dependencies & assumptions** — What the code relies on
- **Potential edge cases** — Things to watch out for

### Find Bugs
Best for: code review, debugging, security audit.

Returns:
- **Bug summary** — Overall assessment
- **Issues found** — Numbered list of specific problems
- **Security concerns** — Potential vulnerabilities
- **Suggested fixes** — Concrete fix for each issue

### Optimize
Best for: performance improvement, refactoring.

Returns:
- **Current performance** — Assessment of the existing code
- **Optimization opportunities** — Specific improvements
- **Refactored version** — Improved code snippet
- **Trade-offs** — What changes and why

---

## Security & Privacy

| Concern | How it is handled |
|---|---|
| Code privacy | All code is processed locally by Phi3:mini via Ollama. Nothing is sent to external servers |
| API keys | Not required. No credentials are stored or transmitted |
| Network requests | The only outbound request is to `http://127.0.0.1:11434` — your own machine |
| Data retention | Ollama does not log or store prompts by default |
| Extension permissions | Minimal: only what is needed to inject UI and call the local API |

---
