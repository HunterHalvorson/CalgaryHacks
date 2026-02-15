/**
 * popup.js — Settings panel controller
 */

(() => {
  const $ = (sel) => document.querySelector(sel);

  // --- Load existing API key ---
  chrome.storage.sync.get(["openaiApiKey"], (result) => {
    const key = result.openaiApiKey || "";
    if (key) {
      $("#api-key").value = key;
      showStatus("API key saved.", "status-ok");
    }
  });

  // --- Save API key ---
  $("#save-key").addEventListener("click", async () => {
    const key = $("#api-key").value.trim();

    if (!key) {
      chrome.storage.sync.remove(["openaiApiKey"], () => {
        showStatus("API key removed. Using algorithmic analysis only.", "status-info");
      });
      return;
    }

    if (!key.startsWith("sk-")) {
      showStatus("Invalid key format. Should start with sk-", "status-err");
      return;
    }

    // Test the key with a minimal request
    showStatus("Validating…", "status-info");

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "respond with just: ok" }],
          max_tokens: 5
        })
      });

      if (resp.ok) {
        chrome.storage.sync.set({ openaiApiKey: key }, () => {
          showStatus("Key validated and saved. AI enhancement active.", "status-ok");
        });
      } else {
        const err = await resp.json().catch(() => ({}));
        showStatus(`Invalid key: ${err.error?.message || resp.status}`, "status-err");
      }
    } catch (e) {
      // Can't reach OpenAI from popup (network restrictions), save anyway
      chrome.storage.sync.set({ openaiApiKey: key }, () => {
        showStatus("Key saved. Will validate on first use.", "status-info");
      });
    }
  });

  // --- Highlight count ---
  async function updateHighlightCount() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "getHighlightCount" }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          $("#highlight-count").textContent = "No highlights on this page.";
          return;
        }
        const n = resp.count || 0;
        $("#highlight-count").textContent = n === 0
          ? "No highlights on this page."
          : `${n} highlight${n !== 1 ? "s" : ""} on this page.`;
      });
    } catch {
      $("#highlight-count").textContent = "Unable to check this page.";
    }
  }

  updateHighlightCount();

  // --- Clear highlights ---
  $("#clear-highlights").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "clearHighlights" }, (resp) => {
        if (resp?.success) {
          $("#highlight-count").textContent = "All highlights cleared.";
        }
      });
    } catch {
      // nothing
    }
  });

  function showStatus(msg, cls) {
    const el = $("#key-status");
    el.textContent = msg;
    el.className = "status " + (cls || "");
  }

})();
