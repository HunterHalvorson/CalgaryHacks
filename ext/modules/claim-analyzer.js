/**
 * claim-analyzer.js — Sentence-level claim/opinion/fact classifier
 * Uses linguistic markers to classify sentence types.
 */

const ClaimAnalyzer = (() => {

  const OPINION_MARKERS = [
    /\b(i think|i believe|i feel|in my (?:opinion|view|estimation)|it seems to me)\b/gi,
    /\b(we think|we believe|our view is|it (?:seems|appears) (?:that|to))\b/gi,
    /\b(should|ought to|must|need to) (?!be\b)/gi,
    /\b(best|worst|greatest|most important|least important|overrated|underrated)\b/gi,
    /\b(beautiful|ugly|terrible|wonderful|amazing|awful|horrible|brilliant|ridiculous|absurd)\b/gi,
    /\b(obviously|clearly|undoubtedly|certainly|of course|needless to say)\b/gi,
    /\b(sadly|fortunately|unfortunately|thankfully|hopefully|regrettably)\b/gi,
    /\b(unacceptable|outrageous|nonsensical|ludicrous|preposterous)\b/gi,
    /\b(wrong|right|fair|unfair|just|unjust|moral|immoral|ethical|unethical)\b/gi
  ];

  const FACTUAL_MARKERS = [
    /\b\d[\d,.]*\s*(?:percent|%|million|billion|trillion|thousand|hundred|km|miles?|kg|lbs?)\b/gi,
    /\b(?:according to|based on|data (?:shows?|indicates?)|research (?:shows?|found|indicates?))\b/gi,
    /\b(?:in \d{4}|on \w+ \d{1,2},? \d{4}|since \d{4}|from \d{4} to \d{4})\b/gi,
    /\b(?:located in|headquartered in|founded in|established in|born (?:in|on))\b/gi,
    /\b(?:measured|calculated|recorded|documented|published in|appeared in)\b/gi,
    /\b(?:increased|decreased|rose|fell|grew|shrank|declined) (?:by|from|to)\b/gi,
    /\b(?:population|GDP|revenue|profit|temperature|rate|index)\b/gi
  ];

  const CLAIM_MARKERS = [
    /\b(?:proves?|evidence (?:shows?|demonstrates?)|confirms?|establishes?|demonstrates?)\b/gi,
    /\bis the (?:cause|reason|result|solution|answer|key|only)\b/gi,
    /\bwill (?:cause|lead to|result in|create|destroy|prevent|guarantee)\b/gi,
    /\b(?:the fact is|the truth is|the reality is|make no mistake|let me be clear)\b/gi,
    /\b(?:guaranteed|certain to|inevitable|impossible|undeniable|irrefutable)\b/gi,
    /\bthe (?:biggest|greatest|worst|most serious|primary|main) (?:threat|problem|issue|cause)\b/gi
  ];

  const HEDGED_MARKERS = [
    /\b(?:may|might|could|possibly|potentially|arguably)\b/gi,
    /\b(?:suggests?|indicates?|implies?|appears?|seems?)\b/gi,
    /\b(?:likely|unlikely|probable|improbable|plausible)\b/gi,
    /\b(?:estimated|approximate(?:ly)?|roughly|about|around)\b/gi,
    /\b(?:tends? to|generally|typically|usually|often)\b/gi
  ];

  function classifySentence(sentence) {
    const s = sentence.trim();
    if (s.length < 15 || s.split(/\s+/).length < 4) return null;

    let opinionScore = 0, factualScore = 0, claimScore = 0, hedgedScore = 0;
    const markers = [];

    const countMatches = (patterns, type, scoreVar) => {
      let total = 0;
      patterns.forEach(p => {
        p.lastIndex = 0;
        const m = s.match(p);
        if (m) {
          total += m.length;
          m.forEach(x => markers.push({ text: x.trim(), type }));
        }
      });
      return total;
    };

    opinionScore = countMatches(OPINION_MARKERS, "opinion") * 2;
    factualScore = countMatches(FACTUAL_MARKERS, "factual") * 2;
    claimScore = countMatches(CLAIM_MARKERS, "claim") * 2;
    hedgedScore = countMatches(HEDGED_MARKERS, "hedged");

    // Skip questions (unless rhetorical)
    if (/\?\s*$/.test(s)) {
      const rhetorical = /\b(isn't it|don't you|wouldn't you|can't we|shouldn't we|how can anyone|who could possibly)\b/i.test(s);
      if (rhetorical) {
        return {
          text: s.length > 120 ? s.slice(0, 120) + "…" : s,
          classification: "rhetorical_question",
          confidence: 0.65,
          markers: dedup(markers).slice(0, 5),
          explanation: "Rhetorical question — asserts a position disguised as inquiry."
        };
      }
      return null;
    }

    // Need at least some signal
    if (opinionScore + factualScore + claimScore + hedgedScore === 0) return null;

    const maxEntry = [["opinion", opinionScore], ["factual", factualScore], ["claim", claimScore]]
      .sort((a, b) => b[1] - a[1])[0];

    let classification, explanation, confidence;
    const [maxType, maxVal] = maxEntry;

    // Calculate confidence proportional to signal strength, capped at 0.92
    const totalSignal = opinionScore + factualScore + claimScore;
    const dominance = totalSignal > 0 ? maxVal / totalSignal : 0;

    if (maxType === "opinion") {
      classification = "opinion";
      explanation = "Contains subjective language or value judgments.";
      confidence = Math.min(0.92, 0.35 + dominance * 0.4 + Math.min(opinionScore * 0.04, 0.2));
    } else if (maxType === "factual") {
      classification = hedgedScore > 0 ? "hedged_fact" : "factual_claim";
      explanation = hedgedScore > 0 ? "Presents data with appropriate qualification." : "Presents verifiable information — consider checking sources.";
      confidence = Math.min(0.92, 0.35 + dominance * 0.4 + Math.min(factualScore * 0.04, 0.2));
    } else {
      classification = hedgedScore > 0 ? "hedged_claim" : "strong_claim";
      explanation = hedgedScore > 0 ? "Makes an assertion with some qualification." : "Makes a strong assertion — verify supporting evidence.";
      confidence = Math.min(0.92, 0.35 + dominance * 0.4 + Math.min(claimScore * 0.04, 0.2));
    }

    return {
      text: s.length > 120 ? s.slice(0, 120) + "…" : s,
      classification,
      confidence: Math.round(confidence * 100) / 100,
      markers: dedup(markers).slice(0, 5),
      explanation
    };
  }

  function dedup(markers) {
    const seen = new Set();
    return markers.filter(m => { const k = m.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  function analyze(text) {
    if (!text || text.trim().length < 20) return emptyResult();

    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 15);
    const results = sentences.map(classifySentence).filter(Boolean);

    const counts = {};
    results.forEach(r => { counts[r.classification] = (counts[r.classification] || 0) + 1; });

    const total = results.length || 1;
    const opinionPct = Math.round(((counts.opinion || 0) / total) * 100);
    const claimPct = Math.round((((counts.strong_claim || 0) + (counts.hedged_claim || 0)) / total) * 100);
    const factualPct = Math.round((((counts.factual_claim || 0) + (counts.hedged_fact || 0)) / total) * 100);

    let contentType;
    if (opinionPct > 50) contentType = "Opinion / Editorial";
    else if (factualPct > 50) contentType = "Informational / Factual";
    else if (claimPct > 40) contentType = "Argumentative / Persuasive";
    else contentType = "Mixed Content";

    return {
      classifications: results.slice(0, 30),
      counts,
      distribution: { opinionPercent: opinionPct, claimPercent: claimPct, factualPercent: factualPct },
      contentType,
      totalSentences: sentences.length,
      totalClassified: results.length
    };
  }

  function emptyResult() {
    return { classifications: [], counts: {}, distribution: { opinionPercent: 0, claimPercent: 0, factualPercent: 0 }, contentType: "N/A", totalSentences: 0, totalClassified: 0 };
  }

  return { analyze };
})();
