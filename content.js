// content.js – Injected into all pages
// IIFE + guard prevents any issues from double-injection
(() => {
  if (window.__codelensInitialized) return;
  window.__codelensInitialized = true;

  let panel = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "showExplainer") {
      showPanel(request.code, request.mode);
      sendResponse({ ok: true });
    }
  });

  // Keyboard shortcut Ctrl+Shift+E
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "E") {
      const selected = window.getSelection()?.toString().trim();
      if (selected) showPanel(selected, "explain");
    }
  });

  function showPanel(code, mode) {
    if (panel) panel.remove();

    panel = document.createElement("div");
    panel.id = "codelens-panel";
    panel.innerHTML = getPanelHTML(code, mode);
    document.body.appendChild(panel);

    // Position: center of viewport (safe default — right-click clears selection)
    panel.style.position = "fixed";
    panel.style.left = "50%";
    panel.style.top = "80px";
    panel.style.transform = "translateX(-50%)";
    panel.style.zIndex = "2147483647";

    setupPanelEvents(panel, code);
    triggerExplanation(code, mode);
  }

  function getPanelHTML(code, mode) {
    const modeLabels = { explain: "Explain Code", deep: "Deep Dive", bugs: "Find Bugs", optimize: "Optimize" };
    const truncated = code.length > 120 ? code.slice(0, 120) + "…" : code;

    return `
      <div class="cl-header" id="cl-drag-handle">
        <div class="cl-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 3C6.24 3 4 5.24 4 8c0 1.7.84 3.21 2.13 4.13C5.45 12.67 5 13.78 5 15h2c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2h2c0-1.22-.45-2.33-1.13-2.87C19.16 11.21 20 9.7 20 8c0-2.76-2.24-5-5-5H9z" fill="currentColor" opacity="0.9"/>
            <path d="M8 17h8v1a2 2 0 01-2 2h-4a2 2 0 01-2-2v-1z" fill="currentColor" opacity="0.7"/>
            <path d="M10 8l-2 2 2 2M14 8l2 2-2 2" stroke="#0d1117" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="cl-title">AI-Code Explainer</span>
          <span class="cl-badge">${modeLabels[mode] || "Explain"}</span>
        </div>
        <button class="cl-close" id="cl-close-btn" title="Close">✕</button>
      </div>

      <div class="cl-code-preview">
        <span class="cl-code-text">${escapeHtml(truncated)}</span>
      </div>

      <div class="cl-mode-tabs">
        <button class="cl-tab ${mode === 'explain' ? 'active' : ''}" data-mode="explain">💡 Explain</button>
        <button class="cl-tab ${mode === 'deep' ? 'active' : ''}" data-mode="deep">🧠 Deep Dive</button>
        <button class="cl-tab ${mode === 'bugs' ? 'active' : ''}" data-mode="bugs">🐛 Bugs</button>
        <button class="cl-tab ${mode === 'optimize' ? 'active' : ''}" data-mode="optimize">⚡ Optimize</button>
      </div>

      <div class="cl-content" id="cl-content">
        <div class="cl-loading">
          <div class="cl-spinner"></div>
          <span>Analyzing your code...</span>
        </div>
      </div>

      <div class="cl-footer">
        <button class="cl-copy-btn" id="cl-copy-btn" title="Copy explanation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        </button>
        <span class="cl-powered">Powered by Ollama + Phi3:mini (Docker)</span>
      </div>
    `;
  }

  function setupPanelEvents(panel, code) {
    document.getElementById("cl-close-btn")?.addEventListener("click", () => {
      panel.remove();
      panel = null;
    });

    panel.querySelectorAll(".cl-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        panel.querySelectorAll(".cl-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        triggerExplanation(code, tab.dataset.mode);
      });
    });

    document.getElementById("cl-copy-btn")?.addEventListener("click", () => {
      const content = document.getElementById("cl-content");
      if (content) {
        navigator.clipboard.writeText(content.innerText).then(() => {
          const btn = document.getElementById("cl-copy-btn");
          if (btn) {
            btn.textContent = "✓ Copied!";
            setTimeout(() => {
              btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
            }, 2000);
          }
        });
      }
    });

    // Dragging
    const handle = document.getElementById("cl-drag-handle");
    if (handle) {
      handle.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        panel.style.transform = "none";
        e.preventDefault();
      });
    }

    document.addEventListener("mousemove", (e) => {
      if (!isDragging || !panel) return;
      panel.style.left = (e.clientX - dragOffsetX) + "px";
      panel.style.top = (e.clientY - dragOffsetY) + "px";
    });

    document.addEventListener("mouseup", () => { isDragging = false; });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel) { panel.remove(); panel = null; }
    });
  }

  async function triggerExplanation(code, mode) {
    const content = document.getElementById("cl-content");
    if (!content) return;

    content.innerHTML = `
      <div class="cl-loading">
        <div class="cl-spinner"></div>
        <span>Analyzing with Phi3:mini (Ollama)...</span>
      </div>
    `;

    const response = await chrome.runtime.sendMessage({ action: "explainCode", code, mode });

    if (response.success) {
      content.innerHTML = `<div class="cl-result">${formatMarkdown(response.explanation)}</div>`;
    } else {
      content.innerHTML = `
        <div class="cl-error">
          <div class="cl-error-icon">⚠️</div>
          <div class="cl-error-title">Error</div>
          <p>${escapeHtml(response.error)}</p>
          <button class="cl-retry-btn" id="cl-retry">Retry</button>
        </div>
      `;
      document.getElementById("cl-retry")?.addEventListener("click", () => triggerExplanation(code, mode));
    }
  }

  function formatMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^(\d+\.\s)/gm, '<span class="cl-num">$1</span>')
      .replace(/^[\*\-]\s(.+)/gm, '<div class="cl-li">• $1</div>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/m, '<p>$1</p>');
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

})();
