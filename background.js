// background.js – Service Worker for CodeLens AI (Powered by Ollama + Phi3)

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = "phi3:mini";

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explainCode",
    title: "🔍 Explain with CodeLens AI",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "explainCodeInDepth",
    title: "🧠 Deep Dive Explanation",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "findBugs",
    title: "🐛 Find Bugs & Issues",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "optimizeCode",
    title: "⚡ Suggest Optimizations",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  if (!selectedText) return;

  let mode = "explain";
  if (info.menuItemId === "explainCodeInDepth") mode = "deep";
  if (info.menuItemId === "findBugs") mode = "bugs";
  if (info.menuItemId === "optimizeCode") mode = "optimize";

  const message = { action: "showExplainer", code: selectedText, mode };

  // Always inject before sending — IIFE guard in content.js prevents double-init
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
  } catch (e) {
    console.error("CodeLens: cannot inject into this page:", e.message);
    return;
  }

  chrome.tabs.sendMessage(tab.id, message);
});

// Handle API calls from content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "explainCode") {
    handleExplainCode(request.code, request.mode)
      .then(result => sendResponse({ success: true, explanation: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "checkOllama") {
    fetch("http://127.0.0.1:11434/api/tags")
      .then(r => r.ok ? sendResponse({ running: true }) : sendResponse({ running: false }))
      .catch(() => sendResponse({ running: false }));
    return true;
  }
});

async function handleExplainCode(code, mode) {
  const prompts = {
    explain: `You are CodeLens AI, an expert code explainer. Explain the following code snippet clearly and concisely for a developer audience.

Structure your response as:
**What it does:** (1-2 sentences)
**How it works:** (step-by-step breakdown)
**Key concepts:** (list important patterns/concepts used)
**Example use case:** (brief real-world context)

Code to explain:
\`\`\`
${code}
\`\`\``,

    deep: `You are CodeLens AI, a senior engineer performing an in-depth code review. Provide a comprehensive deep-dive explanation.

Structure your response as:
**Overview:** (what this code does)
**Line-by-line breakdown:** (detailed walkthrough)
**Design patterns:** (any patterns/paradigms used)
**Time & Space complexity:** (if applicable)
**Dependencies & assumptions:** (what it relies on)
**Potential edge cases:** (things to watch out for)

Code:
\`\`\`
${code}
\`\`\``,

    bugs: `You are CodeLens AI, a code quality expert. Analyze this code for bugs, errors, and potential issues.

Structure your response as:
**Bug summary:** (overall assessment)
**Issues found:** (numbered list of specific problems)
**Security concerns:** (any security issues)
**Suggested fixes:** (concrete fix for each issue)

Code to analyze:
\`\`\`
${code}
\`\`\``,

    optimize: `You are CodeLens AI, a performance optimization expert. Analyze this code and suggest improvements.

Structure your response as:
**Current performance:** (assessment of current code)
**Optimization opportunities:** (specific improvements)
**Refactored version:** (improved code snippet)
**Trade-offs:** (what changes and why)

Code to optimize:
\`\`\`
${code}
\`\`\``
  };

  const prompt = prompts[mode] || prompts.explain;

  let response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0.3, num_predict: 1500 }
      })
    });
  } catch (_) {
    throw new Error("Cannot reach Ollama. Make sure it is running and OLLAMA_ORIGINS=* is set.");
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error(`Model "${OLLAMA_MODEL}" not found. Run: docker exec ollama ollama pull phi3:mini`);
    throw new Error(`Ollama error: ${response.status}. Make sure Ollama is running on localhost:11434`);
  }

  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error("No response from Ollama. Please try again.");
  return text;
}
