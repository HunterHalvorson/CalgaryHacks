/**
 * content.js — ClarityLens content script (v2.1)
 *
 * Selection-driven workflow:
 *   1. User selects text → floating "Analyze" button appears
 *   2. Click → analysis runs → results panel slides in → text highlighted
 *   3. Highlight + analysis persisted to chrome.storage.local
 *   4. On page revisit, highlights restored; clicking them reopens analysis
 *
 * Changes from v2.0:
 *   - Fixed AI tab rendering to match updated openai-enhancer schema
 *   - New AI sub-sections: rhetorical strategies, missing context (detailed),
 *     claim red flags, purpose detection, credibility reasoning, key takeaway
 *   - Proper field mapping (evidenceNeeded, redFlags, etc.)
 */

(() => {
  const STORAGE_PREFIX = "cl_highlights_";
  const MIN_SELECTION_LENGTH = 2; // minimum characters before showing button
  let floatingBtn = null;
  let panelHost = null;
  let panelShadow = null;
  let currentAnalysis = null;
  let highlightCounter = 0;

  // ═══════════════════════════════════════════
  // STORAGE HELPERS
  // ═══════════════════════════════════════════

  function getStorageKey() {
    return STORAGE_PREFIX + btoa(location.href).replace(/[^a-zA-Z0-9]/g, "").slice(0, 80);
  }

  async function loadHighlights() {
    return new Promise(resolve => {
      chrome.storage.local.get([getStorageKey()], r => resolve(r[getStorageKey()] || []));
    });
  }

  async function saveHighlights(highlights) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [getStorageKey()]: highlights }, resolve);
    });
  }

  // ═══════════════════════════════════════════
  // FLOATING ANALYZE BUTTON
  // ═══════════════════════════════════════════

  function createFloatingButton() {
    if (floatingBtn) return;
    floatingBtn = document.createElement("div");
    floatingBtn.id = "cl-float-btn";
    floatingBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:5px"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="7" r="0.8" fill="currentColor"/></svg>Analyze`;
    floatingBtn.style.cssText = `
      position:fixed;z-index:2147483647;display:none;
      padding:7px 16px;background:#111;color:#eee;
      font:600 12.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      border-radius:8px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08);
      border:1px solid #444;transition:opacity .15s,transform .15s;
      user-select:none;white-space:nowrap;pointer-events:auto;
    `;
    floatingBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAnalyzeClick();
    });
    floatingBtn.addEventListener("mouseenter", () => {
      floatingBtn.style.background = "#222";
      floatingBtn.style.borderColor = "#666";
    });
    floatingBtn.addEventListener("mouseleave", () => {
      floatingBtn.style.background = "#111";
      floatingBtn.style.borderColor = "#444";
    });
    document.body.appendChild(floatingBtn);
  }

  function showFloatingButton(viewportX, viewportY) {
    if (!floatingBtn) createFloatingButton();

    const btnWidth = 110;
    let left = viewportX - btnWidth / 2;
    let top = viewportY + 10;

    left = Math.max(8, Math.min(left, window.innerWidth - btnWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - 40));

    if (top > window.innerHeight - 60) {
      top = viewportY - 42;
    }

    floatingBtn.style.left = left + "px";
    floatingBtn.style.top = top + "px";
    floatingBtn.style.display = "block";
    floatingBtn.style.opacity = "0";
    floatingBtn.style.transform = "translateY(4px) scale(0.95)";
    requestAnimationFrame(() => {
      floatingBtn.style.opacity = "1";
      floatingBtn.style.transform = "translateY(0) scale(1)";
    });
  }

  function hideFloatingButton() {
    if (floatingBtn) {
      floatingBtn.style.display = "none";
    }
  }

  // ═══════════════════════════════════════════
  // SELECTION LISTENER
  // ═══════════════════════════════════════════

  let selectionTimeout = null;
  let lastSelectionText = "";

  document.addEventListener("mouseup", (e) => {
    if (e.target.closest?.("#cl-float-btn") || e.target.closest?.("#cl-panel-host")) return;

    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();

      if (text.length >= MIN_SELECTION_LENGTH && sel.rangeCount > 0) {
        lastSelectionText = text;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showFloatingButton(rect.left + rect.width / 2, rect.bottom);
      } else {
        hideFloatingButton();
      }
    }, 200);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target.closest?.("#cl-float-btn") || e.target.closest?.("#cl-panel-host")) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.toString().trim().length < MIN_SELECTION_LENGTH) {
        hideFloatingButton();
      }
    }, 50);
  });

  // ═══════════════════════════════════════════
  // ANALYSIS TRIGGER
  // ═══════════════════════════════════════════

  async function onAnalyzeClick() {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH || sel.rangeCount === 0) return;

    hideFloatingButton();

    const range = sel.getRangeAt(0);

    // Show panel with loading state
    showPanel({ loading: true });

    // Run analysis
    const analysis = await AnalyzerCore.analyze(text, location.href);
    currentAnalysis = analysis;

    if (analysis.depth === "insufficient") {
      showPanel({ analysis });
      return;
    }

    // Highlight the selected text
    const highlightId = "cl-hl-" + Date.now() + "-" + (++highlightCounter);
    try {
      await highlightRange(range, highlightId);
    } catch (err) {
      console.warn("ClarityLens: couldn't highlight range:", err.message);
    }

    // Save to storage
    const stored = await loadHighlights();
    stored.push({
      id: highlightId,
      text: text.slice(0, 2000),
      contextBefore: getContextAround(range, "before"),
      contextAfter: getContextAround(range, "after"),
      analysis: analysis,
      timestamp: Date.now()
    });
    await saveHighlights(stored);

    // Show results
    showPanel({ analysis, highlightId });
  }

  function getContextAround(range, direction) {
    try {
      const container = range.commonAncestorContainer;
      const textContent = container.textContent || "";
      const selectedText = range.toString();
      const idx = textContent.indexOf(selectedText);
      if (idx === -1) return "";
      if (direction === "before") return textContent.slice(Math.max(0, idx - 60), idx).trim();
      return textContent.slice(idx + selectedText.length, idx + selectedText.length + 60).trim();
    } catch { return ""; }
  }

  // ═══════════════════════════════════════════
  // HIGHLIGHT MANAGEMENT
  // ═══════════════════════════════════════════

  async function highlightRange(range, id) {
    try {
      if (range.startContainer !== range.endContainer) {
        await highlightMultiNodeRange(range, id);
        return;
      }

      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const text = textNode.textContent;
        const start = range.startOffset;
        const end = range.endOffset;

        if (start >= end) return;

        const parent = textNode.parentNode;

        const before = document.createTextNode(text.substring(0, start));
        const selectedText = text.substring(start, end);
        const after = document.createTextNode(text.substring(end));

        const mark = document.createElement("mark");
        mark.className = "cl-highlight";
        mark.dataset.clId = id;
        mark.textContent = selectedText;

        parent.insertBefore(before, textNode);
        parent.insertBefore(mark, textNode);
        parent.insertBefore(after, textNode);
        parent.removeChild(textNode);

        addClickListenerToMark(mark, id);
      } else {
        const walker = document.createTreeWalker(
          range.startContainer,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              return range.intersectsNode(node) ?
                NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );

        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        if (textNodes.length === 0) return;

        if (textNodes.length === 1) {
          const node = textNodes[0];
          const newRange = range.cloneRange();
          newRange.setStart(node, Math.max(0, range.startOffset));
          newRange.setEnd(node, Math.min(node.length, range.endOffset));
          await highlightRange(newRange, id);
          return;
        }

        for (let i = 0; i < textNodes.length; i++) {
          const node = textNodes[i];
          const nodeRange = document.createRange();
          nodeRange.selectNode(node);

          if (nodeRange.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
            nodeRange.setStart(node, 0);
          } else {
            nodeRange.setStart(node, range.startOffset);
          }

          if (nodeRange.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
            nodeRange.setEnd(node, node.length);
          } else {
            nodeRange.setEnd(node, range.endOffset);
          }

          if (nodeRange.toString().trim().length > 0) {
            await highlightRange(nodeRange, id);
          }
        }
      }

      window.getSelection().removeAllRanges();

    } catch (err) {
      console.warn("ClarityLens highlight error:", err);
      try {
        const mark = document.createElement("mark");
        mark.className = "cl-highlight";
        mark.dataset.clId = id;
        const extracted = range.extractContents();
        mark.appendChild(extracted);
        range.insertNode(mark);
        addClickListenerToMark(mark, id);
      } catch (fallbackErr) {
        console.warn("ClarityLens fallback highlight failed:", fallbackErr);
      }
    }
  }

  async function highlightMultiNodeRange(range, id) {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          return range.intersectsNode(node) ?
            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const nodeRange = document.createRange();

      if (node === startContainer) {
        nodeRange.setStart(node, startOffset);
        nodeRange.setEnd(node, node.length);
      } else if (node === endContainer) {
        nodeRange.setStart(node, 0);
        nodeRange.setEnd(node, endOffset);
      } else {
        nodeRange.selectNodeContents(node);
      }

      if (nodeRange.toString().trim().length > 0) {
        await highlightRange(nodeRange, id);
      }
    }
  }

  function addClickListenerToMark(mark, id) {
    mark.addEventListener("click", async (e) => {
      e.stopPropagation();
      const stored = await loadHighlights();
      const entry = stored.find(h => h.id === id);
      if (entry) {
        currentAnalysis = entry.analysis;
        showPanel({ analysis: entry.analysis, highlightId: id });
      }
    });
  }

  async function restoreHighlights() {
    const stored = await loadHighlights();
    if (!stored || stored.length === 0) return;

    const body = document.body;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const entry of stored) {
      if (!entry.text || entry.text.length < 2) continue;

      const searchStr = entry.text.slice(0, 200);

      for (const node of textNodes) {
        const idx = node.textContent.indexOf(searchStr);
        if (idx === -1) continue;

        if (entry.contextBefore) {
          const before = node.textContent.slice(Math.max(0, idx - 60), idx);
          if (!before.includes(entry.contextBefore.slice(-20))) continue;
        }

        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, Math.min(node.textContent.length, idx + entry.text.length));

          await highlightRange(range, entry.id);
          break;
        } catch { /* skip */ }
      }
    }
  }

  // ═══════════════════════════════════════════
  // RESULTS PANEL (Shadow DOM for CSS isolation)
  // ═══════════════════════════════════════════

  function createPanelHost() {
    if (panelHost) return;

    panelHost = document.createElement("div");
    panelHost.id = "cl-panel-host";
    panelHost.style.cssText = "position:fixed;top:0;right:-420px;width:400px;height:100vh;z-index:2147483646;transition:right .3s cubic-bezier(.25,.8,.25,1);";
    document.body.appendChild(panelHost);

    panelShadow = panelHost.attachShadow({ mode: "open" });
    panelShadow.innerHTML = `<style>${getPanelCSS()}</style><div id="cl-panel"></div>`;
  }

  function showPanel({ loading = false, analysis = null, highlightId = null }) {
    createPanelHost();
    const panel = panelShadow.getElementById("cl-panel");

    if (loading) {
      panel.innerHTML = `<div class="cl-p-header"><span class="cl-p-title">ClarityLens</span><button class="cl-p-close" id="cl-close">✕</button></div><div class="cl-p-loading"><div class="cl-spinner"></div><p>Analyzing…</p></div>`;
    } else if (analysis) {
      panel.innerHTML = renderAnalysis(analysis, highlightId);
    }

    requestAnimationFrame(() => {
      panelHost.style.right = "0px";
    });

    const closeBtn = panelShadow.getElementById("cl-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", hidePanel);
    }

    panelShadow.querySelectorAll(".cl-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        panelShadow.querySelectorAll(".cl-tab").forEach(t => t.classList.remove("active"));
        panelShadow.querySelectorAll(".cl-tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const target = panelShadow.getElementById("cl-tp-" + tab.dataset.tab);
        if (target) target.classList.add("active");
      });
    });

    const delBtn = panelShadow.getElementById("cl-del-hl");
    if (delBtn && highlightId) {
      delBtn.addEventListener("click", async () => {
        await removeHighlight(highlightId);
        hidePanel();
      });
    }
  }

  function hidePanel() {
    if (panelHost) panelHost.style.right = "-420px";
  }

  async function removeHighlight(id) {
    const marks = document.querySelectorAll(`mark[data-cl-id="${id}"]`);
    marks.forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
    const stored = await loadHighlights();
    await saveHighlights(stored.filter(h => h.id !== id));
  }

  // ═══════════════════════════════════════════
  // PANEL RENDERING
  // ═══════════════════════════════════════════

  function renderAnalysis(data, highlightId) {
    if (data.depth === "insufficient") {
      return `
        <div class="cl-p-header"><span class="cl-p-title">ClarityLens</span><button class="cl-p-close" id="cl-close">✕</button></div>
        <div class="cl-p-empty"><p>${esc(data.message)}</p></div>
      `;
    }

    const r = data.results;
    const ai = data.ai;
    const isBasic = data.depth === "basic";

    // Build tabs
    let tabs = `<button class="cl-tab active" data-tab="overview">Overview</button>`;
    tabs += `<button class="cl-tab" data-tab="tone">Tone</button>`;
    if (!isBasic) {
      tabs += `<button class="cl-tab" data-tab="bias">Bias</button>`;
      tabs += `<button class="cl-tab" data-tab="fallacies">Fallacies</button>`;
      tabs += `<button class="cl-tab" data-tab="claims">Claims</button>`;
    }
    tabs += `<button class="cl-tab" data-tab="readability">Read.</button>`;
    if (!isBasic) tabs += `<button class="cl-tab" data-tab="reflect">Reflect</button>`;
    if (ai) tabs += `<button class="cl-tab" data-tab="ai">AI</button>`;

    let panels = "";

    // --- OVERVIEW ---
    panels += `<div class="cl-tab-panel active" id="cl-tp-overview">`;
    panels += `<div class="cl-score-ring">${data.compositeScore}<span class="cl-score-label">/100</span></div>`;

    if (data.depthNote) panels += `<div class="cl-note">${esc(data.depthNote)}</div>`;
    if (ai) panels += `<div class="cl-ai-badge">AI Enhanced</div>`;

    panels += `<div class="cl-metrics">`;
    panels += metricRow("Words", data.wordCount, "");
    if (r.sentiment) panels += metricRow("Tone", r.sentiment.toneLabel, scoreColor(r.sentiment.objectivity));
    if (r.bias) panels += metricRow("Bias", r.bias.biasLabel, scoreColor(100 - r.bias.biasScore));
    if (r.fallacies) panels += metricRow("Fallacies", r.fallacies.totalMatches + " found", scoreColor(100 - r.fallacies.fallacyDensity));
    if (r.source) panels += metricRow("Source", r.source.credibilityLabel, scoreColor(r.source.score));
    if (r.readability) panels += metricRow("Reading Level", r.readability.levelLabel, "");
    if (r.claims) panels += metricRow("Content Type", r.claims.contentType, "");
    if (ai && ai.purpose) panels += metricRow("AI: Purpose", capitalize(ai.purpose), "#60a5fa");
    panels += `</div>`;

    if (ai && ai.keyTakeaway) {
      panels += `<div class="cl-card"><div class="cl-card-title">Key Takeaway</div><p class="cl-card-text">${esc(ai.keyTakeaway)}</p></div>`;
    } else if (ai && ai.overallAssessment) {
      panels += `<div class="cl-card"><div class="cl-card-title">AI Assessment</div><p class="cl-card-text">${esc(ai.overallAssessment)}</p></div>`;
    }

    if (highlightId) {
      panels += `<button class="cl-del-btn" id="cl-del-hl">Remove Highlight</button>`;
    }
    panels += `</div>`;

    // --- TONE ---
    panels += `<div class="cl-tab-panel" id="cl-tp-tone">`;
    if (r.sentiment) {
      const s = r.sentiment;
      panels += gauge("Objectivity", s.objectivity, scoreColor(s.objectivity));
      panels += gauge("Emotional Intensity", s.emotionalIntensity, scoreColor(100 - s.emotionalIntensity));
      panels += `<div class="cl-metrics">`;
      panels += metricRow("Normalized Score", (s.normalizedScore > 0 ? "+" : "") + s.normalizedScore, "");
      panels += metricRow("Positive Words", s.positiveScore, "#4ade80");
      panels += metricRow("Negative Words", s.negativeScore, "#f87171");
      panels += metricRow("Intensifiers", s.intensifiers.count, "");
      panels += metricRow("Hedges", s.hedges.count, "");
      panels += `</div>`;
      if (s.positiveWords.length) panels += tagCloud("Positive Words", s.positiveWords, "#4ade80");
      if (s.negativeWords.length) panels += tagCloud("Negative Words", s.negativeWords, "#f87171");
      if (s.intensifiers.words.length) panels += tagCloud("Intensifiers", s.intensifiers.words, "#facc15");
      if (s.emotionalPatterns.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Emotional Patterns</div>`;
        s.emotionalPatterns.forEach(p => { panels += `<div class="cl-finding"><strong>${esc(p.label)}</strong> <span class="cl-count">${p.count}×</span></div>`; });
        panels += `</div>`;
      }
    }
    panels += `</div>`;

    // --- BIAS ---
    if (!isBasic && r.bias) {
      const b = r.bias;
      panels += `<div class="cl-tab-panel" id="cl-tp-bias">`;
      panels += gauge("Bias Level", b.biasScore, scoreColor(100 - b.biasScore));
      panels += `<div class="cl-metrics">`;
      panels += metricRow("Loaded Language", b.totalLoadedCount, "");
      panels += metricRow("Balance", b.balanceLabel, "");
      panels += metricRow("Absolutist Terms", b.absolutistCount, "");
      panels += metricRow("Passive Voice", b.passiveVoice.density + "%", "");
      panels += `</div>`;

      Object.entries(b.loadedLanguage).forEach(([cat, words]) => {
        const label = cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        panels += tagCloud(label, words.map(w => w.word), "#facc15");
      });

      if (b.framing.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Framing Patterns</div>`;
        b.framing.forEach(f => { panels += `<div class="cl-finding"><strong>${esc(f.label)}</strong> <span class="cl-badge">${esc(f.bias)}</span></div>`; });
        panels += `</div>`;
      }
      if (b.weaselWords.length) {
        panels += tagCloud("Weasel Words", b.weaselWords.map(w => w.phrase), "#fb923c");
      }

      // AI bias analysis inlined
      if (ai && ai.biasAnalysis && ai.biasAnalysis.severity !== "none") {
        panels += `<div class="cl-card"><div class="cl-card-title">AI Bias Assessment</div>`;
        panels += `<div class="cl-metrics">`;
        panels += metricRow("Direction", capitalize(ai.biasAnalysis.direction), "#60a5fa");
        panels += metricRow("Severity", capitalize(ai.biasAnalysis.severity), ai.biasAnalysis.severity === "strong" ? "#f87171" : ai.biasAnalysis.severity === "moderate" ? "#facc15" : "#999");
        panels += `</div>`;
        panels += `<p class="cl-card-text">${esc(ai.biasAnalysis.explanation)}</p>`;
        if (ai.biasAnalysis.framingTechniques && ai.biasAnalysis.framingTechniques.length) {
          panels += `<div class="cl-tags" style="margin-top:6px">${ai.biasAnalysis.framingTechniques.map(t => `<span class="cl-tag" style="border-color:#60a5fa40">${esc(t)}</span>`).join("")}</div>`;
        }
        panels += `</div>`;
      }

      if (!b.totalLoadedCount && !b.framing.length && !b.weaselWords.length && !(ai && ai.biasAnalysis && ai.biasAnalysis.severity !== "none")) {
        panels += `<div class="cl-empty-msg">No significant bias markers detected.</div>`;
      }
      panels += `</div>`;
    }

    // --- FALLACIES ---
    if (!isBasic && r.fallacies) {
      const f = r.fallacies;
      panels += `<div class="cl-tab-panel" id="cl-tp-fallacies">`;
      panels += gauge("Fallacy Risk", f.fallacyDensity, scoreColor(100 - f.fallacyDensity));
      panels += `<div class="cl-metrics">${metricRow("Patterns Found", f.totalMatches, "")}${metricRow("Sentences Checked", f.sentenceCount, "")}</div>`;

      if (f.fallacies.length) {
        f.fallacies.forEach(fl => {
          const sevColor = fl.severity === "high" ? "#f87171" : fl.severity === "medium" ? "#facc15" : "#60a5fa";
          panels += `<div class="cl-card">
            <div class="cl-card-title" style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${sevColor};display:inline-block"></span>
              ${esc(fl.name)} <span class="cl-count">${fl.matchCount}×</span>
            </div>
            <p class="cl-card-text">${esc(fl.description)}</p>
            <div class="cl-examples">${fl.examples.map(e => `"${esc(e)}"`).join(" · ")}</div>
          </div>`;
        });
      } else {
        panels += `<div class="cl-empty-msg">No logical fallacy patterns detected.</div>`;
      }

      // AI fallacies — with confidence scores
      if (ai && ai.fallacies && ai.fallacies.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">AI-Detected Fallacies</div>`;
        ai.fallacies.forEach(fl => {
          const sevColor = fl.severity === "high" ? "#f87171" : fl.severity === "medium" ? "#facc15" : "#60a5fa";
          const confPct = Math.round((fl.confidence || 0.5) * 100);
          panels += `<div class="cl-finding">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span style="width:6px;height:6px;border-radius:50%;background:${sevColor};display:inline-block"></span>
              <strong>${esc(fl.name)}</strong>
              <span class="cl-count">${confPct}% conf.</span>
            </div>
            ${fl.quote ? `<div class="cl-examples">"${esc(fl.quote)}"</div>` : ""}
            <p class="cl-card-text" style="margin-top:4px">${esc(fl.explanation)}</p>
          </div>`;
        });
        panels += `</div>`;
      }
      panels += `</div>`;
    }

    // --- CLAIMS ---
    if (!isBasic && r.claims) {
      const c = r.claims;
      const colors = { opinion: "#fb923c", strong_claim: "#f87171", hedged_claim: "#facc15", factual_claim: "#4ade80", hedged_fact: "#60a5fa", rhetorical_question: "#999" };
      const labels = { opinion: "Opinion", strong_claim: "Strong Claim", hedged_claim: "Hedged Claim", factual_claim: "Factual", hedged_fact: "Hedged Fact", rhetorical_question: "Rhetorical" };

      panels += `<div class="cl-tab-panel" id="cl-tp-claims">`;
      panels += `<div class="cl-dist-bar">`;
      if (c.distribution.opinionPercent) panels += `<div style="width:${c.distribution.opinionPercent}%;background:#fb923c"></div>`;
      if (c.distribution.claimPercent) panels += `<div style="width:${c.distribution.claimPercent}%;background:#f87171"></div>`;
      if (c.distribution.factualPercent) panels += `<div style="width:${c.distribution.factualPercent}%;background:#4ade80"></div>`;
      panels += `</div>`;
      panels += `<div class="cl-dist-legend">
        <span><span class="cl-dot" style="background:#fb923c"></span>Opinion ${c.distribution.opinionPercent}%</span>
        <span><span class="cl-dot" style="background:#f87171"></span>Claims ${c.distribution.claimPercent}%</span>
        <span><span class="cl-dot" style="background:#4ade80"></span>Factual ${c.distribution.factualPercent}%</span>
      </div>`;
      panels += `<div class="cl-metrics">${metricRow("Content Type", c.contentType, "")}${metricRow("Classified", c.totalClassified + " / " + c.totalSentences, "")}</div>`;

      if (c.classifications.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Algorithmic Classification</div>`;
        c.classifications.slice(0, 12).forEach(item => {
          const color = colors[item.classification] || "#999";
          panels += `<div class="cl-claim"><p class="cl-card-text">${esc(item.text)}</p><span class="cl-badge" style="background:${color}20;color:${color}">${labels[item.classification] || item.classification}</span> <span class="cl-count">${Math.round(item.confidence * 100)}%</span></div>`;
        });
        panels += `</div>`;
      }

      // AI claim assessment — detailed view
      if (ai && ai.claimAssessment && ai.claimAssessment.length) {
        const aiClaimColors = {
          verifiable_fact: "#4ade80", opinion: "#fb923c", value_judgment: "#c084fc",
          prediction: "#60a5fa", unsupported_claim: "#f87171", well_supported_claim: "#4ade80",
          misleading_claim: "#ef4444", definitional_claim: "#999"
        };
        panels += `<div class="cl-card"><div class="cl-card-title">AI Claim Assessment</div>`;
        ai.claimAssessment.forEach(claim => {
          const typeColor = aiClaimColors[claim.type] || "#999";
          const typeLabel = (claim.type || "").replace(/_/g, " ");
          const confPct = Math.round((claim.confidence || 0.5) * 100);
          panels += `<div class="cl-claim">
            <p class="cl-card-text">${esc(claim.claim)}</p>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
              <span class="cl-badge" style="background:${typeColor}20;color:${typeColor}">${esc(typeLabel)}</span>
              <span class="cl-count">${confPct}% conf.</span>
            </div>
            ${claim.reasoning ? `<p class="cl-card-text" style="margin-top:4px;font-size:11px;color:#999">${esc(claim.reasoning)}</p>` : ""}
            ${claim.evidenceNeeded ? `<p class="cl-card-text" style="margin-top:2px;font-size:11px;color:#888"><em>To verify:</em> ${esc(claim.evidenceNeeded)}</p>` : ""}
            ${claim.redFlags && claim.redFlags.length ? `<div class="cl-tags" style="margin-top:4px">${claim.redFlags.map(f => `<span class="cl-tag" style="border-color:#f8717140;color:#f87171">${esc(f)}</span>`).join("")}</div>` : ""}
          </div>`;
        });
        panels += `</div>`;
      }
      panels += `</div>`;
    }

    // --- READABILITY ---
    panels += `<div class="cl-tab-panel" id="cl-tp-readability">`;
    if (r.readability && r.readability.stats.wordCount > 0) {
      const rd = r.readability;
      panels += `<div class="cl-score-ring">${rd.scores.compositeGrade}<span class="cl-score-label">grade</span></div>`;
      panels += `<div class="cl-metrics">`;
      panels += metricRow("Reading Level", rd.levelLabel, "");
      panels += metricRow("Flesch Ease", rd.scores.fleschEase, "");
      panels += metricRow("Flesch-Kincaid", rd.scores.fleschKincaid, "");
      panels += metricRow("Gunning Fog", rd.scores.gunningFog, "");
      panels += metricRow("Coleman-Liau", rd.scores.colemanLiau, "");
      panels += metricRow("SMOG", rd.scores.smog, "");
      panels += metricRow("ARI", rd.scores.ari, "");
      panels += `</div>`;
      panels += `<div class="cl-metrics">`;
      panels += metricRow("Words", rd.stats.wordCount, "");
      panels += metricRow("Sentences", rd.stats.sentenceCount, "");
      panels += metricRow("Avg Words/Sent", rd.stats.avgWordsPerSentence, "");
      panels += metricRow("Complex Words", rd.stats.complexWordPercent + "%", "");
      panels += metricRow("Vocab Diversity", rd.stats.vocabularyDiversity + "%", "");
      panels += metricRow("Reading Time", rd.stats.readingTimeMinutes + " min", "");
      panels += `</div>`;
      if (rd.complexWords.length) panels += tagCloud("Complex Words", rd.complexWords, "#60a5fa");
    }
    panels += `</div>`;

    // --- REFLECT ---
    if (!isBasic && r.reflection) {
      const ref = r.reflection;
      panels += `<div class="cl-tab-panel" id="cl-tp-reflect">`;
      if (ref.synthesis) panels += `<div class="cl-card"><div class="cl-card-title">Key Insight</div><p class="cl-card-text">${esc(ref.synthesis)}</p></div>`;
      if (ref.questions.length) {
        ref.questions.forEach(q => { panels += `<div class="cl-question"><span class="cl-q-mark">?</span>${esc(q)}</div>`; });
      }
      if (ai && ai.suggestedQuestions && ai.suggestedQuestions.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">AI-Generated Questions</div>`;
        ai.suggestedQuestions.forEach(q => { panels += `<div class="cl-question"><span class="cl-q-mark">AI</span>${esc(q)}</div>`; });
        panels += `</div>`;
      }
      panels += `</div>`;
    }

    // --- AI TAB (comprehensive) ---
    if (ai) {
      panels += `<div class="cl-tab-panel" id="cl-tp-ai">`;

      // Credibility score with reasoning
      panels += `<div class="cl-card"><div class="cl-card-title">AI Credibility Score</div><div class="cl-score-ring" style="color:${scoreColor(ai.credibilityScore)}">${ai.credibilityScore}<span class="cl-score-label">/100</span></div>`;
      if (ai.credibilityReasoning) {
        panels += `<p class="cl-card-text" style="margin-top:8px">${esc(ai.credibilityReasoning)}</p>`;
      }
      panels += `</div>`;

      // Overall assessment
      if (ai.overallAssessment) {
        panels += `<div class="cl-card"><div class="cl-card-title">Overall Assessment</div><p class="cl-card-text">${esc(ai.overallAssessment)}</p></div>`;
      }

      // Purpose
      if (ai.purpose) {
        const purposeConf = ai.purposeConfidence ? Math.round(ai.purposeConfidence * 100) : null;
        panels += `<div class="cl-card"><div class="cl-card-title">Detected Purpose</div>`;
        panels += `<div class="cl-metrics">`;
        panels += metricRow("Purpose", capitalize(ai.purpose), "#60a5fa");
        if (purposeConf) panels += metricRow("Confidence", purposeConf + "%", "");
        panels += `</div></div>`;
      }

      // Bias analysis
      if (ai.biasAnalysis) {
        const ba = ai.biasAnalysis;
        panels += `<div class="cl-card"><div class="cl-card-title">Bias Analysis</div>`;
        panels += `<div class="cl-metrics">`;
        panels += metricRow("Direction", capitalize(ba.direction), "");
        panels += metricRow("Severity", capitalize(ba.severity), ba.severity === "strong" ? "#f87171" : ba.severity === "moderate" ? "#facc15" : "#4ade80");
        panels += `</div>`;
        panels += `<p class="cl-card-text">${esc(ba.explanation)}</p>`;
        if (ba.framingTechniques && ba.framingTechniques.length) {
          panels += `<div class="cl-tags" style="margin-top:6px">${ba.framingTechniques.map(t => `<span class="cl-tag" style="border-color:#60a5fa40">${esc(t)}</span>`).join("")}</div>`;
        }
        panels += `</div>`;
      }

      // Fallacies
      if (ai.fallacies && ai.fallacies.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Detected Fallacies</div>`;
        ai.fallacies.forEach(fl => {
          const sevColor = fl.severity === "high" ? "#f87171" : fl.severity === "medium" ? "#facc15" : "#60a5fa";
          const confPct = Math.round((fl.confidence || 0.5) * 100);
          panels += `<div class="cl-finding">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span style="width:6px;height:6px;border-radius:50%;background:${sevColor};display:inline-block"></span>
              <strong>${esc(fl.name)}</strong>
              <span class="cl-count">${confPct}%</span>
            </div>
            ${fl.quote ? `<div class="cl-examples">"${esc(fl.quote)}"</div>` : ""}
            <p class="cl-card-text" style="margin-top:4px">${esc(fl.explanation)}</p>
          </div>`;
        });
        panels += `</div>`;
      }

      // Manipulation techniques
      if (ai.manipulationTechniques && ai.manipulationTechniques.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Manipulation Techniques</div>`;
        ai.manipulationTechniques.forEach(t => {
          panels += `<div class="cl-finding">
            <strong>${esc(t.technique)}</strong>
            ${t.quote ? `<div class="cl-examples" style="margin-top:3px">"${esc(t.quote)}"</div>` : ""}
            <p class="cl-card-text" style="margin-top:4px">${esc(t.explanation)}</p>
          </div>`;
        });
        panels += `</div>`;
      }

      // Rhetorical strategies
      if (ai.rhetoricalStrategies && ai.rhetoricalStrategies.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Rhetorical Strategies</div>`;
        ai.rhetoricalStrategies.forEach(rs => {
          panels += `<div class="cl-finding"><strong>${esc(rs.strategy)}</strong><p class="cl-card-text">${esc(rs.explanation)}</p></div>`;
        });
        panels += `</div>`;
      }

      // Claim assessment
      if (ai.claimAssessment && ai.claimAssessment.length) {
        const aiClaimColors = {
          verifiable_fact: "#4ade80", opinion: "#fb923c", value_judgment: "#c084fc",
          prediction: "#60a5fa", unsupported_claim: "#f87171", well_supported_claim: "#4ade80",
          misleading_claim: "#ef4444", definitional_claim: "#999"
        };
        panels += `<div class="cl-card"><div class="cl-card-title">Claim Assessment</div>`;
        ai.claimAssessment.forEach(claim => {
          const typeColor = aiClaimColors[claim.type] || "#999";
          const typeLabel = (claim.type || "").replace(/_/g, " ");
          const confPct = Math.round((claim.confidence || 0.5) * 100);
          panels += `<div class="cl-claim">
            <p class="cl-card-text">${esc(claim.claim)}</p>
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
              <span class="cl-badge" style="background:${typeColor}20;color:${typeColor}">${esc(typeLabel)}</span>
              <span class="cl-count">${confPct}% conf.</span>
            </div>
            ${claim.reasoning ? `<p class="cl-card-text" style="margin-top:4px;font-size:11px;color:#999">${esc(claim.reasoning)}</p>` : ""}
            ${claim.evidenceNeeded ? `<p class="cl-card-text" style="margin-top:2px;font-size:11px;color:#888"><em>To verify:</em> ${esc(claim.evidenceNeeded)}</p>` : ""}
            ${claim.redFlags && claim.redFlags.length ? `<div class="cl-tags" style="margin-top:4px">${claim.redFlags.map(f => `<span class="cl-tag" style="border-color:#f8717140;color:#f87171">${esc(f)}</span>`).join("")}</div>` : ""}
          </div>`;
        });
        panels += `</div>`;
      }

      // Missing context (detailed)
      if (ai.missingContext) {
        const mc = ai.missingContext;
        const hasMissing = mc.summary || (mc.perspectives && mc.perspectives.length) || (mc.evidence && mc.evidence.length) || (mc.caveats && mc.caveats.length);
        if (hasMissing) {
          panels += `<div class="cl-card"><div class="cl-card-title">Missing Context</div>`;
          if (mc.summary) panels += `<p class="cl-card-text" style="margin-bottom:8px">${esc(mc.summary)}</p>`;
          if (mc.perspectives && mc.perspectives.length) {
            panels += `<div class="cl-finding"><strong style="color:#c084fc">Missing Perspectives</strong>`;
            mc.perspectives.forEach(p => { panels += `<p class="cl-card-text" style="margin-top:2px">• ${esc(p)}</p>`; });
            panels += `</div>`;
          }
          if (mc.evidence && mc.evidence.length) {
            panels += `<div class="cl-finding"><strong style="color:#60a5fa">Missing Evidence</strong>`;
            mc.evidence.forEach(e => { panels += `<p class="cl-card-text" style="margin-top:2px">• ${esc(e)}</p>`; });
            panels += `</div>`;
          }
          if (mc.caveats && mc.caveats.length) {
            panels += `<div class="cl-finding"><strong style="color:#facc15">Omitted Caveats</strong>`;
            mc.caveats.forEach(c => { panels += `<p class="cl-card-text" style="margin-top:2px">• ${esc(c)}</p>`; });
            panels += `</div>`;
          }
          panels += `</div>`;
        }
      }

      // AI suggested questions
      if (ai.suggestedQuestions && ai.suggestedQuestions.length) {
        panels += `<div class="cl-card"><div class="cl-card-title">Critical Questions</div>`;
        ai.suggestedQuestions.forEach(q => { panels += `<div class="cl-question"><span class="cl-q-mark">?</span>${esc(q)}</div>`; });
        panels += `</div>`;
      }

      panels += `</div>`; // end AI tab
    }

    // AI error notification
    let aiNote = "";
    if (data.aiError) aiNote = `<div class="cl-note cl-note-warn">AI enhancement failed: ${esc(data.aiError)}</div>`;
    else if (data.hasAiKey && !ai) aiNote = "";
    else if (!data.hasAiKey && !isBasic) aiNote = `<div class="cl-note">Add OpenAI API key in extension popup for AI-enhanced analysis.</div>`;

    return `
      <div class="cl-p-header">
        <span class="cl-p-title">ClarityLens</span>
        <button class="cl-p-close" id="cl-close">✕</button>
      </div>
      ${aiNote}
      <div class="cl-tabs">${tabs}</div>
      <div class="cl-panels">${panels}</div>
    `;
  }

  // ═══════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════

  function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function scoreColor(score) {
    if (score >= 70) return "#4ade80";
    if (score >= 50) return "#facc15";
    if (score >= 30) return "#fb923c";
    return "#f87171";
  }

  function capitalize(s) {
    if (!s) return "";
    return String(s).replace(/\b\w/g, c => c.toUpperCase()).replace(/_/g, " ");
  }

  function metricRow(label, value, color) {
    const style = color ? ` style="color:${color}"` : "";
    return `<div class="cl-metric"><span class="cl-metric-label">${esc(label)}</span><span class="cl-metric-value"${style}>${esc(String(value))}</span></div>`;
  }

  function gauge(label, value, color) {
    return `<div class="cl-gauge"><div class="cl-gauge-header"><span>${esc(label)}</span><span style="color:${color}">${value}%</span></div><div class="cl-gauge-bar"><div class="cl-gauge-fill" style="width:${value}%;background:${color}"></div></div></div>`;
  }

  function tagCloud(label, words, color) {
    return `<div class="cl-card"><div class="cl-card-title">${esc(label)}</div><div class="cl-tags">${words.map(w => `<span class="cl-tag" style="border-color:${color}40">${esc(w)}</span>`).join("")}</div></div>`;
  }

  // ═══════════════════════════════════════════
  // PANEL CSS (injected into Shadow DOM)
  // ═══════════════════════════════════════════

  function getPanelCSS() {
    return `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
      :host { all: initial; }
      * { margin:0;padding:0;box-sizing:border-box; }
      #cl-panel {
        width:400px;height:100vh;background:#0a0a0a;color:#e8e8e8;
        font:13px/1.5 'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
        display:flex;flex-direction:column;border-left:1px solid #2a2a2a;
        -webkit-font-smoothing:antialiased;
      }
      ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      .cl-p-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #2a2a2a;flex-shrink:0}
      .cl-p-title{font-size:15px;font-weight:700;letter-spacing:-.3px}
      .cl-p-close{background:none;border:none;color:#666;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:all .15s}
      .cl-p-close:hover{color:#eee;background:#222}
      .cl-p-loading{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#999}
      .cl-spinner{width:24px;height:24px;border:2px solid #333;border-top-color:#eee;border-radius:50%;animation:spin .7s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
      .cl-p-empty{flex:1;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:#888}
      .cl-tabs{display:flex;gap:1px;padding:0 12px;border-bottom:1px solid #2a2a2a;overflow-x:auto;flex-shrink:0;scrollbar-width:none}
      .cl-tabs::-webkit-scrollbar{display:none}
      .cl-tab{padding:8px 10px;background:none;border:none;border-bottom:2px solid transparent;color:#666;font:500 11.5px 'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all .15s;position:relative;bottom:-1px}
      .cl-tab:hover{color:#aaa} .cl-tab.active{color:#eee;border-bottom-color:#eee}
      .cl-panels{flex:1;overflow-y:auto;padding:14px 16px 20px}
      .cl-tab-panel{display:none;animation:fadeIn .2s ease} .cl-tab-panel.active{display:block}
      @keyframes fadeIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
      .cl-score-ring{text-align:center;font-size:36px;font-weight:700;padding:16px 0 8px;letter-spacing:-1px}
      .cl-score-label{font-size:13px;font-weight:400;color:#666;margin-left:2px}
      .cl-note{padding:8px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;font-size:11.5px;color:#888;margin-bottom:10px;line-height:1.5}
      .cl-note-warn{border-color:#facc1540;color:#facc15}
      .cl-ai-badge{display:inline-block;padding:3px 10px;background:rgba(96,165,250,.12);color:#60a5fa;border-radius:20px;font-size:11px;font-weight:500;margin-bottom:10px;text-align:center;width:fit-content;margin-left:auto;margin-right:auto}
      .cl-metrics{margin:10px 0}
      .cl-metric{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e1e1e;font-size:12.5px}
      .cl-metric-label{color:#999}
      .cl-metric-value{font-weight:600;font-family:'DM Mono',monospace;font-size:12px}
      .cl-card{background:#1a1a1a;border:1px solid #1e1e1e;border-radius:8px;padding:12px;margin:8px 0}
      .cl-card-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#888;margin-bottom:6px}
      .cl-card-text{font-size:12.5px;color:#bbb;line-height:1.55}
      .cl-finding{padding:8px 0;border-bottom:1px solid #1e1e1e}
      .cl-finding:last-child{border-bottom:none}
      .cl-finding strong{font-size:12px}
      .cl-examples{font:11px 'DM Mono',monospace;color:#666;background:#111;padding:6px 8px;border-radius:4px;margin-top:4px;border-left:2px solid #333;word-break:break-word}
      .cl-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
      .cl-tag{padding:2px 7px;background:#111;border:1px solid #2a2a2a;border-radius:3px;font:11px 'DM Mono',monospace;color:#aaa}
      .cl-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:500;background:#222;color:#aaa}
      .cl-count{font-size:11px;color:#666;margin-left:4px}
      .cl-gauge{margin:10px 0}
      .cl-gauge-header{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
      .cl-gauge-bar{height:5px;background:#1a1a1a;border-radius:3px;overflow:hidden}
      .cl-gauge-fill{height:100%;border-radius:3px;transition:width .5s ease}
      .cl-dist-bar{display:flex;height:7px;border-radius:4px;overflow:hidden;background:#1a1a1a;margin:8px 0}
      .cl-dist-bar>div{height:100%}
      .cl-dist-legend{display:flex;gap:12px;font-size:11px;color:#888;margin-bottom:8px}
      .cl-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:middle}
      .cl-question{position:relative;padding:10px 12px 10px 32px;background:#1a1a1a;border:1px solid #1e1e1e;border-radius:8px;margin:6px 0;font-size:12.5px;line-height:1.55;color:#ddd}
      .cl-q-mark{position:absolute;left:10px;top:10px;font:700 12px 'DM Mono',monospace;color:#555}
      .cl-claim{padding:8px 0;border-bottom:1px solid #1e1e1e}
      .cl-claim:last-child{border-bottom:none}
      .cl-empty-msg{text-align:center;color:#555;padding:24px;font-size:13px}
      .cl-del-btn{display:block;width:100%;margin-top:12px;padding:8px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#888;font:12px 'DM Sans',sans-serif;cursor:pointer;transition:all .15s}
      .cl-del-btn:hover{color:#f87171;border-color:#f87171}
    `;
  }

  // ═══════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════

  if (document.readyState === "complete") {
    restoreHighlights();
  } else {
    window.addEventListener("load", restoreHighlights);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getHighlightCount") {
      loadHighlights().then(h => sendResponse({ count: h.length }));
      return true;
    }
    if (msg.action === "clearHighlights") {
      document.querySelectorAll("mark.cl-highlight").forEach(m => {
        const parent = m.parentNode;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
        parent.normalize();
      });
      saveHighlights([]).then(() => sendResponse({ success: true }));
      return true;
    }
  });

})();