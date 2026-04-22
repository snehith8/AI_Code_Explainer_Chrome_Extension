// popup.js – Extension popup logic (Ollama + Phi3 via Docker)

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const toast = document.getElementById("toast");
const checkBtn = document.getElementById("check-btn");

// Check Ollama connection on load
checkOllamaStatus();

checkBtn.addEventListener("click", checkOllamaStatus);

function checkOllamaStatus() {
  statusDot.className = "status-dot inactive";
  statusText.textContent = "Checking Ollama connection...";

  chrome.runtime.sendMessage({ action: "checkOllama" }, (result) => {
    if (result && result.running) {
      setStatus(true);
    } else {
      setStatus(false);
    }
  });
}

function setStatus(active) {
  statusDot.className = `status-dot ${active ? "" : "inactive"}`;
  statusText.textContent = active
    ? "Ollama running — Phi3:mini model ready"
    : "Ollama not detected on localhost:11434";
}

function showToast(msg, type = "success") {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 2500);
}
