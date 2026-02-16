/**
 * analyzer-core.js — Orchestrates all analysis modules (v2.1)
 *
 * Validates text length and returns appropriate analysis depth:
 *   < 3 words  → reject (not enough data)
 *   3–9 words  → basic (sentiment only + readability basics)
 *   10–49 words → standard (all modules, reduced confidence note)
 *   50+ words  → full (all modules, full confidence)
 *   200+ words → full + enhanced statistics
 *
 * Changes from v2.0:
 *   - Fixed composite score calculation (was overwriting instead of accumulating)
 *   - Passes URL to AI enhancer for domain-aware analysis
 *   - AI enhancement runs in parallel with algorithmic analysis where possible
 *   - Better error surfacing for AI failures
 */

const AnalyzerCore = (() => {

  const THRESHOLDS = {
    MINIMUM: 3,        // Below this: reject
    BASIC: 10,         // Below this: basic analysis only
    STANDARD: 50,      // Below this: standard (note: limited sample)
    FULL: 200          // Above this: full confidence
  };

  /**
   * Determine analysis depth based on word count
   */
  function getDepth(wordCount) {
    if (wordCount < THRESHOLDS.MINIMUM) return "insufficient";
    if (wordCount < THRESHOLDS.BASIC) return "basic";
    if (wordCount < THRESHOLDS.STANDARD) return "standard";
    if (wordCount < THRESHOLDS.FULL) return "full";
    return "comprehensive";
  }

  /**
   * Run full analysis pipeline
   * @param {string} text - Selected text to analyze
   * @param {string} url - Page URL for source scoring
   * @returns {object} Analysis results with depth metadata
   */
  async function analyze(text, url) {
    const cleanText = (text || "").trim();
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
    const depth = getDepth(wordCount);

    if (depth === "insufficient") {
      return {
        depth,
        wordCount,
        message: `Only ${wordCount} word${wordCount !== 1 ? "s" : ""} selected. Select a sentence or paragraph for meaningful analysis.`,
        results: null
      };
    }

    const results = {};
    let depthNote = "";

    // Sentiment — always run (works even on short text)
    results.sentiment = SentimentAnalyzer.analyze(cleanText);

    // Readability — always run but note limitations on short text
    results.readability = ReadabilityAnalyzer.analyze(cleanText);

    if (depth === "basic") {
      depthNote = "Limited analysis — select more text for bias, fallacy, and claim detection.";
      results.bias = null;
      results.fallacies = null;
      results.claims = null;
      results.source = SourceScorer.analyze(url || "", "");
      results.reflection = null;
    } else {
      // Standard, full, comprehensive — run everything
      results.bias = BiasDetector.analyze(cleanText);
      results.fallacies = FallacyDetector.analyze(cleanText);
      results.claims = ClaimAnalyzer.analyze(cleanText);
      results.source = SourceScorer.analyze(url || "", cleanText);
      results.reflection = ReflectionEngine.generate({
        sentiment: results.sentiment,
        bias: results.bias,
        fallacies: results.fallacies,
        claims: results.claims,
        source: results.source,
        readability: results.readability
      });

      if (depth === "standard") {
        depthNote = "Short sample — results are indicative but may not capture full context.";
      }
    }

    // OpenAI enhancement (async, non-blocking) — pass URL for domain context
    let aiResults = null;
    const hasKey = await OpenAIEnhancer.hasApiKey();
    if (hasKey && wordCount >= THRESHOLDS.BASIC) {
      try {
        aiResults = await OpenAIEnhancer.enhance(cleanText, url || "");
      } catch (e) {
        console.warn("AI enhancement failed:", e);
        aiResults = { error: true, message: e.message || "Unknown AI error" };
      }
    }

    // Compute composite score — properly accumulate weighted components
    let compositeScore = 0;
    let totalWeight = 0;

    if (results.source) {
      compositeScore += results.source.score * 0.30;
      totalWeight += 0.30;
    }
    if (results.bias) {
      compositeScore += (100 - results.bias.biasScore) * 0.25;
      totalWeight += 0.25;
    }
    if (results.fallacies) {
      compositeScore += (100 - results.fallacies.fallacyDensity) * 0.20;
      totalWeight += 0.20;
    }
    if (results.sentiment) {
      compositeScore += results.sentiment.objectivity * 0.15;
      totalWeight += 0.15;
    }
    if (results.readability) {
      compositeScore += Math.min(100, results.readability.scores.fleschEase) * 0.10;
      totalWeight += 0.10;
    }

    // Normalize to 0-100 based on available components
    if (totalWeight > 0) {
      compositeScore = Math.round(compositeScore / totalWeight);
    } else {
      compositeScore = 50; // neutral fallback
    }

    // If AI results available and valid, blend them in (60% algorithmic / 40% AI)
    const aiValid = aiResults && !aiResults.error && typeof aiResults.credibilityScore === "number";
    if (aiValid) {
      compositeScore = Math.round(compositeScore * 0.6 + aiResults.credibilityScore * 0.4);
    }

    return {
      depth,
      depthNote,
      wordCount,
      compositeScore,
      results,
      ai: aiValid ? aiResults : null,
      aiError: aiResults?.error ? (aiResults.message || "AI analysis failed") : null,
      hasAiKey: hasKey,
      timestamp: Date.now()
    };
  }

  return { analyze, getDepth, THRESHOLDS };
})();