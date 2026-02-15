/**
 * openai-enhancer.js — Optional OpenAI-powered deep analysis
 * 
 * When an API key is configured, enhances algorithmic results with
 * GPT-based analysis for nuanced bias, fallacy, and credibility assessment.
 * Falls back gracefully to algorithmic-only when unavailable.
 */

const OpenAIEnhancer = (() => {

  const SYSTEM_PROMPT = `You are a critical thinking analyst. Analyze the provided text and return ONLY valid JSON (no markdown, no backticks) with this exact structure:

{
  "overallAssessment": "1-2 sentence summary of the text's reliability and intent",
  "biasAnalysis": {
    "direction": "left|right|neutral|mixed",
    "severity": "none|mild|moderate|strong",
    "explanation": "Brief explanation of detected bias"
  },
  "fallacies": [
    {
      "name": "Fallacy name",
      "quote": "The exact phrase (max 15 words)",
      "explanation": "Why this is fallacious"
    }
  ],
  "manipulationTechniques": [
    {
      "technique": "Name",
      "explanation": "How it's used here"
    }
  ],
  "claimAssessment": [
    {
      "claim": "A key claim from the text (max 20 words)",
      "type": "verifiable_fact|opinion|unsupported_claim|well_supported",
      "concern": "Brief note on verifiability or accuracy"
    }
  ],
  "missingContext": "What important context or perspectives are absent",
  "credibilityScore": 0-100,
  "suggestedQuestions": ["Critical question 1", "Critical question 2", "Critical question 3"]
}

Be specific. Reference actual text. Don't invent issues that aren't there. If the text is balanced and factual, say so. Return ONLY the JSON object.`;

  /**
   * Check if API key is configured
   */
  async function hasApiKey() {
    return new Promise(resolve => {
      chrome.storage.sync.get(["openaiApiKey"], (result) => {
        resolve(!!(result.openaiApiKey && result.openaiApiKey.trim().length > 10));
      });
    });
  }

  /**
   * Get the stored API key
   */
  async function getApiKey() {
    return new Promise(resolve => {
      chrome.storage.sync.get(["openaiApiKey"], (result) => {
        resolve(result.openaiApiKey || "");
      });
    });
  }

  /**
   * Enhance analysis with OpenAI
   * @param {string} text - The text to analyze
   * @returns {object|null} Enhanced analysis or null if unavailable
   */
  async function enhance(text) {
    const apiKey = await getApiKey();
    if (!apiKey || apiKey.trim().length < 10) return null;

    // Truncate very long text for API efficiency
    const truncated = text.length > 6000 ? text.slice(0, 6000) + "\n[...truncated]" : text;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Analyze this text:\n\n${truncated}` }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn("ClarityLens OpenAI error:", response.status, err);
        return { error: true, status: response.status, message: err.error?.message || "API request failed" };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      // Parse JSON — strip any markdown fencing just in case
      const cleaned = content.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      // Validate structure minimally
      if (typeof parsed.credibilityScore !== "number" || !parsed.overallAssessment) {
        console.warn("ClarityLens: unexpected AI response structure");
        return null;
      }

      return parsed;

    } catch (err) {
      console.warn("ClarityLens OpenAI error:", err.message);
      return { error: true, message: err.message };
    }
  }

  return { enhance, hasApiKey, getApiKey };
})();
