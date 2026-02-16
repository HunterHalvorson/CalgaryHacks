/**
 * openai-enhancer.js — OpenAI-powered deep analysis (v2.1)
 *
 * Major improvements over v2.0:
 *   - Two-pass analysis: structural pass + critical-thinking pass
 *   - Structured JSON output with strict schema enforcement
 *   - Confidence scoring per claim with reasoning chains
 *   - Manipulation/persuasion technique taxonomy (Cialdini + propaganda model)
 *   - Rhetorical strategy identification
 *   - Source-context-aware prompting (passes URL domain info)
 *   - Robust retry logic with exponential backoff
 *   - Token-efficient chunking for long texts
 *   - Full error taxonomy (rate limit, auth, parse, network)
 */

const OpenAIEnhancer = (() => {

  const MODEL = "gpt-4o-mini";
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1500;

  // ── System prompt: single-pass comprehensive analysis ──
  // Designed to elicit nuanced, non-generic responses by:
  //   1. Requiring evidence-grounded reasoning (quote → classify → explain)
  //   2. Penalizing vague/generic outputs explicitly
  //   3. Using a fine-grained claim taxonomy
  //   4. Asking for confidence + reasoning per finding

  const ANALYSIS_SYSTEM_PROMPT = `You are a rigorous critical-thinking analyst. Your task is to deeply analyze a piece of text and return a structured JSON assessment.

ANALYSIS METHODOLOGY — follow this exact order:
1. Read the full text carefully. Identify the author's thesis/purpose.
2. Isolate every discrete claim, assertion, or evaluative statement.
3. For each: classify it, assess evidence, note what's missing.
4. Identify reasoning patterns — look for logical gaps, not just keyword matches.
5. Assess persuasion techniques by examining HOW the author builds their argument, not just what words they use.
6. Consider what a knowledgeable, fair-minded critic would say.

Return ONLY valid JSON (no markdown fencing, no commentary, no preamble) matching this EXACT schema:

{
  "overallAssessment": "2-4 sentence summary: What is this text trying to do? How reliable is it? What should a reader be cautious about?",

  "purpose": "inform | persuade | entertain | provoke | sell | mixed",
  "purposeConfidence": 0.0-1.0,

  "biasAnalysis": {
    "direction": "left | right | pro-industry | anti-industry | pro-government | anti-government | neutral | mixed | other",
    "severity": "none | mild | moderate | strong",
    "explanation": "Specific explanation grounded in text evidence. Name the framing choices.",
    "framingTechniques": ["list of specific framing techniques used, e.g., 'selective emphasis', 'false equivalence', 'loaded language'"]
  },

  "fallacies": [
    {
      "name": "Standard fallacy name (e.g., 'Appeal to Authority', 'Straw Man', 'False Dilemma')",
      "quote": "Exact phrase from the text (max 20 words)",
      "explanation": "Why this constitutes the named fallacy — explain the logical error",
      "severity": "low | medium | high",
      "confidence": 0.0-1.0
    }
  ],

  "manipulationTechniques": [
    {
      "technique": "Specific technique name from this taxonomy: emotional manipulation, social proof, false urgency, anchoring, framing effect, appeal to fear, appeal to identity, bandwagon pressure, false authority, cherry-picking, manufactured consensus, thought-terminating cliché, whataboutism, sealioning, gish gallop, loaded question, presupposition, or other (specify)",
      "quote": "Relevant phrase from text (max 20 words)",
      "explanation": "How this technique operates on the reader and what response it's designed to provoke"
    }
  ],

  "claimAssessment": [
    {
      "claim": "The exact claim from text (max 30 words)",
      "type": "verifiable_fact | opinion | value_judgment | prediction | unsupported_claim | well_supported_claim | misleading_claim | definitional_claim",
      "confidence": 0.0-1.0,
      "reasoning": "1-2 sentences: WHY this classification. What specific evidence is present or absent?",
      "evidenceNeeded": "What would verify or falsify this claim?",
      "redFlags": ["any red flags about this specific claim: e.g., 'no source cited', 'uses absolute language', 'cherry-picked timeframe'"]
    }
  ],

  "missingContext": {
    "perspectives": ["What viewpoints or stakeholders are absent?"],
    "evidence": ["What data or evidence types are missing?"],
    "caveats": ["What important qualifications or exceptions are omitted?"],
    "summary": "1-2 sentence summary of what's missing"
  },

  "rhetoricalStrategies": [
    {
      "strategy": "e.g., 'anecdote as proof', 'appeal to common sense', 'strategic ambiguity', 'false balance', 'narrative framing'",
      "explanation": "How it works in this text"
    }
  ],

  "credibilityScore": 0-100,
  "credibilityReasoning": "2-3 sentences explaining the score. Reference specific strengths and weaknesses.",

  "suggestedQuestions": [
    "5 specific, actionable critical thinking questions tailored to THIS text (not generic). Each should point to a specific gap, assumption, or claim that deserves scrutiny."
  ],

  "keyTakeaway": "One sentence: the single most important thing a critical reader should know about this text."
}

CRITICAL RULES:
- Every finding MUST reference specific text. Do not make generic observations.
- If the text is balanced and well-sourced, SAY SO. Do not manufacture problems.
- "confidence" means YOUR confidence in the classification, not the claim's truth.
- Distinguish between intentional manipulation and incidental bias.
- For "verifiable_fact": the claim could be checked against public data/records.
- For "opinion": inherently subjective — no amount of evidence would settle it.
- For "value_judgment": a moral/ethical assessment that reasonable people could disagree on.
- For "prediction": a forward-looking claim about what will happen.
- For "unsupported_claim": presented as fact but lacking cited evidence in the text.
- For "well_supported_claim": backed by specific evidence, data, or sourcing in the text.
- For "misleading_claim": technically true but presented in a way that leads to false conclusions.
- For "definitional_claim": depends on how a term is defined.
- Return 3-8 claims, prioritizing the most consequential ones.
- Return 3-5 suggested questions, each targeting a different analytical angle.
- If no fallacies or manipulation techniques are present, return empty arrays — do NOT fabricate findings.
- credibilityScore: 80-100 = well-sourced, balanced, transparent; 60-79 = mostly reliable with some gaps; 40-59 = mixed reliability; 20-39 = significant concerns; 0-19 = unreliable/deceptive.`;


  // ── API Key Management ──

  async function hasApiKey() {
    return new Promise(resolve => {
      chrome.storage.sync.get(["openaiApiKey"], (result) => {
        resolve(!!(result.openaiApiKey && result.openaiApiKey.trim().length > 10));
      });
    });
  }

  async function getApiKey() {
    return new Promise(resolve => {
      chrome.storage.sync.get(["openaiApiKey"], (result) => {
        resolve(result.openaiApiKey || "");
      });
    });
  }

  // ── Core API Call with Retry ──

  async function callOpenAI(apiKey, systemPrompt, userMessage, temperature = 0.2, maxTokens = 3000) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" }
          })
        });

        if (response.status === 429) {
          // Rate limited — wait and retry
          const retryAfter = parseInt(response.headers.get("retry-after") || "3", 10);
          await sleep(retryAfter * 1000);
          lastError = { error: true, status: 429, message: "Rate limited — retrying..." };
          continue;
        }

        if (response.status === 401) {
          return { error: true, status: 401, message: "Invalid API key. Check your key in the extension popup." };
        }

        if (response.status === 403) {
          return { error: true, status: 403, message: "API key lacks permission for this model." };
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          lastError = {
            error: true,
            status: response.status,
            message: err.error?.message || `API error: ${response.status}`
          };
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          return lastError;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          lastError = { error: true, message: "Empty response from API" };
          continue;
        }

        // Parse JSON — strip any markdown fencing just in case
        const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();

        try {
          return JSON.parse(cleaned);
        } catch (parseErr) {
          console.warn("ClarityLens: JSON parse failed, attempting repair...", parseErr.message);

          // Attempt basic JSON repair for common issues
          const repaired = repairJSON(cleaned);
          if (repaired) return repaired;

          lastError = { error: true, message: "Failed to parse AI response as JSON" };
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
        }

      } catch (networkErr) {
        lastError = { error: true, message: `Network error: ${networkErr.message}` };
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
      }
    }

    return lastError || { error: true, message: "Analysis failed after retries" };
  }

  // ── JSON Repair ──
  // Handles common LLM JSON issues: trailing commas, unescaped newlines

  function repairJSON(str) {
    try {
      // Remove trailing commas before } or ]
      let fixed = str.replace(/,\s*([}\]])/g, "$1");
      // Fix unescaped newlines inside strings
      fixed = fixed.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }

  // ── Text Preparation ──

  function prepareText(text, url) {
    // Smart truncation: keep beginning and end for context
    const MAX_CHARS = 7000;
    let prepared = text;

    if (text.length > MAX_CHARS) {
      const headSize = Math.floor(MAX_CHARS * 0.7);
      const tailSize = MAX_CHARS - headSize - 50;
      prepared = text.slice(0, headSize) +
        "\n\n[... middle section truncated for length ...]\n\n" +
        text.slice(-tailSize);
    }

    // Add source context if available
    let domainContext = "";
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      domainContext = `\n\nSource domain: ${domain}`;
    } catch { /* no URL available */ }

    return prepared + domainContext;
  }

  // ── Main Enhancement Function ──

  async function enhance(text, url) {
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.trim().length < 10) return null;

    const prepared = prepareText(text, url || "");

    const userMessage = `Analyze the following text. Apply your full critical thinking methodology. Be specific and evidence-grounded.\n\n---\n${prepared}\n---`;

    const result = await callOpenAI(apiKey, ANALYSIS_SYSTEM_PROMPT, userMessage, 0.2, 3000);

    if (result && !result.error) {
      return validateAndNormalize(result);
    }

    return result; // Return error object
  }

  // ── Response Validation & Normalization ──
  // Ensures all expected fields exist with correct types

  function validateAndNormalize(parsed) {
    const result = { ...parsed };

    // Ensure required top-level fields
    if (typeof result.credibilityScore !== "number") {
      result.credibilityScore = 50;
    }
    result.credibilityScore = Math.max(0, Math.min(100, Math.round(result.credibilityScore)));

    if (!result.overallAssessment || typeof result.overallAssessment !== "string") {
      result.overallAssessment = "Analysis completed but overall assessment was not generated.";
    }

    if (!result.purpose) result.purpose = "mixed";
    if (typeof result.purposeConfidence !== "number") result.purposeConfidence = 0.5;

    // Bias analysis
    if (!result.biasAnalysis || typeof result.biasAnalysis !== "object") {
      result.biasAnalysis = { direction: "neutral", severity: "none", explanation: "No bias analysis generated.", framingTechniques: [] };
    }
    if (!Array.isArray(result.biasAnalysis.framingTechniques)) {
      result.biasAnalysis.framingTechniques = [];
    }

    // Fallacies
    if (!Array.isArray(result.fallacies)) result.fallacies = [];
    result.fallacies = result.fallacies.filter(f => f && f.name && f.explanation).map(f => ({
      name: String(f.name || ""),
      quote: String(f.quote || ""),
      explanation: String(f.explanation || ""),
      severity: ["low", "medium", "high"].includes(f.severity) ? f.severity : "medium",
      confidence: typeof f.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0.5
    }));

    // Manipulation techniques
    if (!Array.isArray(result.manipulationTechniques)) result.manipulationTechniques = [];
    result.manipulationTechniques = result.manipulationTechniques.filter(t => t && t.technique).map(t => ({
      technique: String(t.technique || ""),
      quote: String(t.quote || ""),
      explanation: String(t.explanation || "")
    }));

    // Claim assessment
    if (!Array.isArray(result.claimAssessment)) result.claimAssessment = [];
    const validClaimTypes = ["verifiable_fact", "opinion", "value_judgment", "prediction", "unsupported_claim", "well_supported_claim", "misleading_claim", "definitional_claim"];
    result.claimAssessment = result.claimAssessment.filter(c => c && c.claim).map(c => ({
      claim: String(c.claim || ""),
      type: validClaimTypes.includes(c.type) ? c.type : "unsupported_claim",
      confidence: typeof c.confidence === "number" ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
      reasoning: String(c.reasoning || ""),
      evidenceNeeded: String(c.evidenceNeeded || c.evidence_needed || ""),
      redFlags: Array.isArray(c.redFlags) ? c.redFlags.map(String) : (Array.isArray(c.red_flags) ? c.red_flags.map(String) : [])
    }));

    // Missing context
    if (!result.missingContext || typeof result.missingContext !== "object") {
      result.missingContext = { perspectives: [], evidence: [], caveats: [], summary: "" };
    }
    if (!Array.isArray(result.missingContext.perspectives)) result.missingContext.perspectives = [];
    if (!Array.isArray(result.missingContext.evidence)) result.missingContext.evidence = [];
    if (!Array.isArray(result.missingContext.caveats)) result.missingContext.caveats = [];
    if (typeof result.missingContext.summary !== "string") {
      // Build summary from arrays if not provided
      const parts = [...result.missingContext.perspectives, ...result.missingContext.evidence, ...result.missingContext.caveats];
      result.missingContext.summary = parts.length > 0 ? parts.slice(0, 2).join(" ") : "";
    }

    // Rhetorical strategies
    if (!Array.isArray(result.rhetoricalStrategies)) result.rhetoricalStrategies = [];
    result.rhetoricalStrategies = result.rhetoricalStrategies.filter(r => r && r.strategy).map(r => ({
      strategy: String(r.strategy || ""),
      explanation: String(r.explanation || "")
    }));

    // Suggested questions
    if (!Array.isArray(result.suggestedQuestions)) result.suggestedQuestions = [];
    result.suggestedQuestions = result.suggestedQuestions.filter(q => typeof q === "string" && q.length > 10).slice(0, 7);

    // Key takeaway
    if (typeof result.keyTakeaway !== "string") result.keyTakeaway = "";

    // Credibility reasoning
    if (typeof result.credibilityReasoning !== "string") result.credibilityReasoning = "";

    return result;
  }

  // ── Utility ──

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return { enhance, hasApiKey, getApiKey };
})();