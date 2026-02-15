/**
 * analyzer-core.js — Orchestrates all analysis modules
 * 
 * Validates text length and returns appropriate analysis depth:
 *   < 3 words  → reject (not enough data)
 *   3–9 words  → basic (sentiment only + readability basics)
 *   10–49 words → standard (all modules, reduced confidence note)
 *   50+ words  → full (all modules, full confidence)
 *   200+ words → full + enhanced statistics
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

    // OpenAI enhancement (async, non-blocking)
    let aiResults = null;
    const hasKey = await OpenAIEnhancer.hasApiKey();
    if (hasKey && wordCount >= THRESHOLDS.BASIC) {
      try {
        aiResults = await OpenAIEnhancer.enhance(cleanText);
      } catch (e) {
        console.warn("AI enhancement failed:", e);
      }
    }

    // Compute composite score
    let compositeScore = 50; // default neutral
    if (results.source) compositeScore = results.source.score * 0.3;
    if (results.bias) compositeScore += (100 - results.bias.biasScore) * 0.25;
    if (results.fallacies) compositeScore += (100 - results.fallacies.fallacyDensity) * 0.2;
    if (results.sentiment) compositeScore += results.sentiment.objectivity * 0.15;
    if (results.readability) compositeScore += Math.min(100, results.readability.scores.fleschEase) * 0.1;
    compositeScore = Math.round(compositeScore);

    // If AI results available and valid, factor them in
    if (aiResults && !aiResults.error && typeof aiResults.credibilityScore === "number") {
      compositeScore = Math.round(compositeScore * 0.6 + aiResults.credibilityScore * 0.4);
    }

    return {
      depth,
      depthNote,
      wordCount,
      compositeScore,
      results,
      ai: aiResults && !aiResults.error ? aiResults : null,
      aiError: aiResults?.error ? aiResults.message : null,
      hasAiKey: hasKey,
      timestamp: Date.now()
    };
  }

  return { analyze, getDepth, THRESHOLDS };
})();
