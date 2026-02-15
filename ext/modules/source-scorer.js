/**
 * source-scorer.js — Heuristic source credibility assessment
 * Evaluates domain reputation, TLD trust signals, and content-level indicators.
 */

const SourceScorer = (() => {

  const DOMAIN_TIERS = {
    high: ["reuters.com","apnews.com","bbc.com","bbc.co.uk","npr.org","pbs.org","nature.com","science.org","thelancet.com","nejm.org","who.int","cdc.gov","nih.gov","nasa.gov","noaa.gov","gov.uk","europa.eu","un.org","worldbank.org","nytimes.com","washingtonpost.com","wsj.com","economist.com","ft.com","theguardian.com","abc.net.au","cbc.ca","snopes.com","factcheck.org","politifact.com","scholar.google.com","pubmed.ncbi.nlm.nih.gov","arxiv.org","jstor.org","ssrn.com","springer.com","wiley.com","ieee.org","acm.org"],
    medium: ["cnn.com","foxnews.com","msnbc.com","nbcnews.com","cbsnews.com","abcnews.go.com","usatoday.com","latimes.com","bloomberg.com","cnbc.com","forbes.com","time.com","newsweek.com","theatlantic.com","newyorker.com","vox.com","axios.com","thehill.com","politico.com","wired.com","arstechnica.com","techcrunch.com","theverge.com","wikipedia.org","britannica.com","medium.com"],
    low: ["infowars.com","naturalnews.com","zerohedge.com","beforeitsnews.com","worldnetdaily.com","globalresearch.ca","rt.com","sputniknews.com","thegatewaypundit.com"]
  };

  const TLD_SCORES = { ".gov":15,".edu":12,".mil":12,".int":10,".org":3,".ac.uk":10,".com":0,".net":0,".io":0,".info":-3,".biz":-5,".xyz":-5,".click":-8,".buzz":-8 };

  const POS_SIGNALS = [
    { pattern: /\b(according to|cited|reference[ds]?|peer[\s-]?reviewed|published in)\b/gi, label: "Evidence citation", weight: 3 },
    { pattern: /\b(university|institute|journal|methodology|systematic review)\b/gi, label: "Academic context", weight: 3 },
    { pattern: /\b(however|on the other hand|conversely|critics argue|some disagree|counterargument)\b/gi, label: "Balanced perspective", weight: 4 },
    { pattern: /\b(updated|correction|editor'?s note|clarification)\b/gi, label: "Transparency signals", weight: 3 },
    { pattern: /\b(\d+\s*percent|\d+%|survey of \d+|sample size)\b/gi, label: "Quantitative support", weight: 2 },
    { pattern: /\b(disclaimer|disclosure|conflict of interest|funded by)\b/gi, label: "Disclosure", weight: 2 }
  ];

  const NEG_SIGNALS = [
    { pattern: /\b(they don't want you to know|shocking truth|what .{3,20} doesn't tell you)\b/gi, label: "Conspiracy framing", weight: -5 },
    { pattern: /\b(miracle cure|cure[\s-]?all|guaranteed results|secret remedy|ancient secret)\b/gi, label: "Pseudoscience markers", weight: -4 },
    { pattern: /\b(click here|subscribe now|share this before|limited time|act now)\b/gi, label: "Clickbait / marketing", weight: -3 },
    { pattern: /\b(mainstream media won't|lamestream|fake news|cover[\s-]?up)\b/gi, label: "Media distrust markers", weight: -4 },
    { pattern: /\b(just asking questions|do your own research|wake up sheeple)\b/gi, label: "Bad-faith inquiry", weight: -5 },
    { pattern: /\b[A-Z]{5,}\b/g, label: "Sensationalist caps", weight: -1 },
    { pattern: /[!]{3,}|[?]{3,}/g, label: "Excessive punctuation", weight: -2 }
  ];

  function analyze(url, text) {
    let score = 50;
    const signals = [];
    const warnings = [];
    let domain = "";

    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = url || "unknown"; }

    // Domain tier
    if (DOMAIN_TIERS.high.some(d => domain.endsWith(d))) {
      score += 20;
      signals.push({ type: "positive", label: "High-credibility domain", detail: domain });
    } else if (DOMAIN_TIERS.low.some(d => domain.endsWith(d))) {
      score -= 25;
      warnings.push({ type: "negative", label: "Low-credibility domain", detail: domain });
    } else if (DOMAIN_TIERS.medium.some(d => domain.endsWith(d))) {
      score += 5;
      signals.push({ type: "neutral", label: "Known media source", detail: domain });
    }

    // TLD
    for (const [tld, val] of Object.entries(TLD_SCORES)) {
      if (domain.endsWith(tld)) {
        score += val;
        if (val > 5) signals.push({ type: "positive", label: `Government/academic domain (${tld})`, detail: domain });
        if (val < -3) warnings.push({ type: "negative", label: `Low-trust TLD (${tld})`, detail: domain });
        break;
      }
    }

    // HTTPS
    if (url && url.startsWith("https://")) score += 2;
    else if (url) { score -= 5; warnings.push({ type: "negative", label: "No HTTPS", detail: url.slice(0, 60) }); }

    // Content signals
    if (text && text.length > 50) {
      POS_SIGNALS.forEach(({ pattern, label, weight }) => {
        pattern.lastIndex = 0;
        const m = text.match(pattern);
        if (m) { score += Math.min(weight * 2, weight * m.length); signals.push({ type: "positive", label, detail: `${m.length} instance(s)` }); }
      });
      NEG_SIGNALS.forEach(({ pattern, label, weight }) => {
        pattern.lastIndex = 0;
        const m = text.match(pattern);
        if (m) { score += Math.max(weight * 2, weight * m.length); warnings.push({ type: "negative", label, detail: `${m.length} instance(s)` }); }
      });
      if (/\b(by |author:|written by|reported by)\b/i.test(text)) { score += 3; signals.push({ type: "positive", label: "Author attributed", detail: "" }); }
      if (/\b(published|updated|posted)\s*:?\s*\w+\s+\d{1,2},?\s+\d{4}/i.test(text) || /\d{4}-\d{2}-\d{2}/.test(text)) { score += 2; signals.push({ type: "positive", label: "Date provided", detail: "" }); }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let credibilityLabel;
    if (score >= 80) credibilityLabel = "High Credibility";
    else if (score >= 60) credibilityLabel = "Moderate Credibility";
    else if (score >= 40) credibilityLabel = "Mixed Credibility";
    else if (score >= 20) credibilityLabel = "Low Credibility";
    else credibilityLabel = "Very Low Credibility";

    return { score, credibilityLabel, domain, signals: signals.slice(0, 10), warnings: warnings.slice(0, 10) };
  }

  return { analyze };
})();
