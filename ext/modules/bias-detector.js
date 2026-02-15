/**
 * bias-detector.js — Algorithmic bias & loaded language detection
 * Detects loaded language categories, weasel words, framing patterns,
 * passive voice obscuring agency, and leading questions.
 */

const BiasDetector = (() => {

  const LOADED_LANGUAGE = {
    "fear_mongering": [
      "invasion","flooding","swarm","plague","ticking time bomb",
      "skyrocketing","out of control","under siege","spiraling out",
      "collapse of","wave of","onslaught","inundated"
    ],
    "glorification": [
      "hero","patriot","freedom fighter","champion","savior","visionary",
      "trailblazer","genius","legendary","iconic","fearless","selfless",
      "unwavering","tireless champion"
    ],
    "demonization": [
      "thug","radical","extremist","puppet","tyrant","monster","predator",
      "crooked","elitist","out of touch","un-american","anti-american",
      "enemy of the people","threat to democracy"
    ],
    "euphemism": [
      "enhanced interrogation","collateral damage","right-sizing",
      "downsizing","neutralize","pacification","regime change",
      "kinetic action","alternative facts","clean coal",
      "ethnic cleansing","friendly fire","pre-owned",
      "economically disadvantaged","passed away","let go"
    ],
    "absolutist": [
      "always","never","everyone knows","no one","nobody","nothing",
      "without exception","the only way","the only answer","impossible",
      "guaranteed","definitively proven","indisputable","irrefutable",
      "beyond question","unquestionable"
    ]
  };

  const WEASEL_PHRASES = [
    "some say","many believe","experts say","critics claim","some people think",
    "it is said","it has been suggested","there are those who",
    "sources say","insiders claim","according to sources","observers note",
    "it is widely believed","many feel","questions have been raised",
    "concerns have been raised","some argue","many argue",
    "studies show","research shows","science says"
  ];

  const FRAMING_PATTERNS = [
    { pattern: /\btaxpayer[\s-]?funded\b/gi, label: "Financial burden framing", bias: "fiscal-conservative" },
    { pattern: /\bjob[\s-]?killing\b/gi, label: "Anti-regulation framing", bias: "deregulation" },
    { pattern: /\b(pro[\s-]?life|unborn child|sanctity of life)\b/gi, label: "Anti-abortion framing", bias: "socially conservative" },
    { pattern: /\b(pro[\s-]?choice|reproductive rights|bodily autonomy)\b/gi, label: "Pro-choice framing", bias: "socially progressive" },
    { pattern: /\b(illegal alien|illegals)\b/gi, label: "Anti-immigration framing", bias: "restrictionist" },
    { pattern: /\b(undocumented worker|asylum seeker|dreamer)\b/gi, label: "Pro-immigration framing", bias: "permissive" },
    { pattern: /\b(gun rights|second amendment rights|law[\s-]?abiding gun owner)\b/gi, label: "Pro-gun framing", bias: "gun rights" },
    { pattern: /\b(gun violence epidemic|common[\s-]?sense gun|gun safety)\b/gi, label: "Gun control framing", bias: "gun control" },
    { pattern: /\b(climate alarmis[mt]|climate hoax|so[\s-]?called climate)\b/gi, label: "Climate skepticism framing", bias: "climate skeptic" },
    { pattern: /\b(climate crisis|climate emergency|climate catastrophe)\b/gi, label: "Climate urgency framing", bias: "climate action" },
    { pattern: /\b(mainstream media|liberal media|lamestream|fake news media)\b/gi, label: "Media distrust framing", bias: "media skeptic" },
    { pattern: /\b(big pharma|big tech|big government|deep state|the establishment)\b/gi, label: "Anti-establishment framing", bias: "populist" },
    { pattern: /\b(wealth gap|income inequality|the one percent|working class|exploitation of workers)\b/gi, label: "Economic justice framing", bias: "economic-left" },
    { pattern: /\b(free market solution|job creators|over[\s-]?regulation|nanny state)\b/gi, label: "Pro-market framing", bias: "economic-right" }
  ];

  // Passive voice heuristic: form of "to be" + past participle
  // Only counts constructions that obscure the agent
  const PASSIVE_REGEX = /\b(was|were|is|are|been|being|be)\s+(\w+ed|taken|given|shown|known|seen|done|made|told|found|left|held|brought|thought|kept|sent|grown|drawn|written|broken|spoken|chosen|driven|forgotten|hidden|bitten|eaten|fallen|risen|born|worn|torn|sworn|frozen|stolen|shaken|woven)\b/gi;

  function analyze(text) {
    if (!text || text.trim().length < 10) return emptyResult();

    const lowerText = text.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);

    // 1. Loaded language detection
    const loadedFindings = {};
    let totalLoadedCount = 0;

    Object.entries(LOADED_LANGUAGE).forEach(([category, phrases]) => {
      const found = [];
      phrases.forEach(phrase => {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        const matches = lowerText.match(regex);
        if (matches) {
          found.push({ word: phrase, count: matches.length });
          totalLoadedCount += matches.length;
        }
      });
      if (found.length > 0) loadedFindings[category] = found;
    });

    // 2. Weasel words
    const weaselFindings = [];
    WEASEL_PHRASES.forEach(phrase => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      const matches = lowerText.match(regex);
      if (matches) {
        weaselFindings.push({ phrase, count: matches.length });
      }
    });
    const weaselTotal = weaselFindings.reduce((s, f) => s + f.count, 0);

    // 3. Framing analysis
    const framingFindings = [];
    FRAMING_PATTERNS.forEach(({ pattern, label, bias }) => {
      // Reset regex lastIndex since we reuse patterns
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      if (matches) {
        framingFindings.push({ label, bias, count: matches.length, examples: [...new Set(matches.map(m => m.trim()))].slice(0, 3) });
      }
    });

    // 4. Passive voice — count only clear passive constructions
    const passiveMatches = text.match(PASSIVE_REGEX);
    const passiveCount = passiveMatches ? passiveMatches.length : 0;
    const passiveDensity = sentences.length > 0 ? Math.round((passiveCount / sentences.length) * 100) : 0;

    // 5. Leading questions
    const leadingQuestions = [];
    const leadingPatterns = [
      /\b(isn't it true that|don't you think|wouldn't you agree|isn't it obvious that)\b/gi,
      /\b(how can anyone|why would anyone|who could possibly|who in their right mind)\b/gi
    ];
    leadingPatterns.forEach(p => {
      const matches = text.match(p);
      if (matches) leadingQuestions.push(...matches.map(m => m.trim()));
    });

    // 6. One-sidedness measurement
    const posLoadedCount = (loadedFindings["glorification"] || []).reduce((s, f) => s + f.count, 0);
    const negLoadedCount = (loadedFindings["demonization"] || []).reduce((s, f) => s + f.count, 0)
      + (loadedFindings["fear_mongering"] || []).reduce((s, f) => s + f.count, 0);

    let balanceLabel = "Balanced";
    if (posLoadedCount + negLoadedCount >= 2) {
      const ratio = (posLoadedCount + 1) / (negLoadedCount + 1);
      if (ratio > 3) balanceLabel = "Heavily positive framing";
      else if (ratio > 1.8) balanceLabel = "Leans positive";
      else if (ratio < 0.33) balanceLabel = "Heavily negative framing";
      else if (ratio < 0.55) balanceLabel = "Leans negative";
    }

    // Absolutist count
    const absolutistCount = (loadedFindings["absolutist"] || []).reduce((s, f) => s + f.count, 0);

    // Composite bias score
    const loadedDensity = (totalLoadedCount / wordCount) * 100;
    const weaselDensity = (weaselTotal / wordCount) * 100;

    const biasScore = Math.min(100, Math.round(
      loadedDensity * 6 +
      weaselDensity * 10 +
      framingFindings.length * 5 +
      (absolutistCount / wordCount) * 400 +
      (passiveDensity > 40 ? 8 : passiveDensity > 20 ? 4 : 0) +
      leadingQuestions.length * 4
    ));

    let biasLabel;
    if (biasScore < 15) biasLabel = "Low Bias";
    else if (biasScore < 35) biasLabel = "Mild Bias";
    else if (biasScore < 55) biasLabel = "Moderate Bias";
    else if (biasScore < 75) biasLabel = "High Bias";
    else biasLabel = "Very High Bias";

    return {
      biasScore,
      biasLabel,
      balanceLabel,
      loadedLanguage: loadedFindings,
      totalLoadedCount,
      weaselWords: weaselFindings,
      framing: framingFindings,
      passiveVoice: { count: passiveCount, density: passiveDensity },
      leadingQuestions: [...new Set(leadingQuestions)].slice(0, 5),
      absolutistCount,
      wordCount
    };
  }

  function emptyResult() {
    return {
      biasScore: 0, biasLabel: "Low Bias", balanceLabel: "Balanced",
      loadedLanguage: {}, totalLoadedCount: 0, weaselWords: [],
      framing: [], passiveVoice: { count: 0, density: 0 },
      leadingQuestions: [], absolutistCount: 0, wordCount: 0
    };
  }

  return { analyze };
})();
