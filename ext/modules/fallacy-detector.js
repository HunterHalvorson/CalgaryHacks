/**
 * fallacy-detector.js — Pattern-based logical fallacy identification
 * 
 * Each fallacy checks patterns within individual sentences for context.
 * Requires minimum sentence length to avoid false positives on fragments.
 */

const FallacyDetector = (() => {

  const FALLACIES = [
    {
      name: "Ad Hominem",
      description: "Attacks the person rather than their argument.",
      severity: "high",
      patterns: [
        /\b(you're|they're|he's|she's)\s+(just|only|nothing but|merely)\s+(a|an)\s+\w+/gi,
        /\bof course (?:you|he|she|they) would say that\b/gi,
        /\bconsider the source\b/gi,
        /\blook who'?s talking\b/gi,
        /\b(?:typical|classic)\s+(?:liberal|conservative|leftist|right[\s-]?winger|democrat|republican)\b/gi
      ],
      minSentenceWords: 5
    },
    {
      name: "Straw Man",
      description: "Misrepresents someone's argument to attack a distorted version.",
      severity: "high",
      patterns: [
        /\bso (?:you're|you are) saying\b/gi,
        /\bwhat (?:you're|they're) really saying is\b/gi,
        /\b(?:basically|essentially),?\s*(?:you|they)\s+(?:want|believe|think|are saying)\b/gi,
        /\b(?:want(?:s)? to|trying to)\s+(?:destroy|ban|eliminate|abolish)\s+(?:all|every)\b/gi
      ],
      minSentenceWords: 6
    },
    {
      name: "Appeal to Authority",
      description: "Uses authority status as evidence rather than the argument itself.",
      severity: "medium",
      patterns: [
        /\b(?:experts|scientists|doctors) (?:agree|all agree|have confirmed|have proven)\b/gi,
        /\baccording to (?:leading|top|renowned|eminent) (?:experts|scientists|researchers)\b/gi,
        /\beven (?:he|she|they|[A-Z]\w+) (?:agrees?|admits?|acknowledges?|concedes?)\b/gi
      ],
      minSentenceWords: 6
    },
    {
      name: "Appeal to Emotion",
      description: "Manipulates feelings instead of using logical reasoning.",
      severity: "medium",
      patterns: [
        /\bthink of the (?:children|families|victims|elderly|veterans)\b/gi,
        /\bhow (?:would|could|can) you (?:live with yourself|sleep at night)\b/gi,
        /\bimagine if (?:this|it) (?:happened|were|was) (?:to you|to your)\b/gi,
        /\byou should be (?:ashamed|afraid|worried|outraged|disgusted)\b/gi,
        /\bwon't someone (?:think of|care about)\b/gi
      ],
      minSentenceWords: 5
    },
    {
      name: "False Dilemma",
      description: "Presents only two options when more exist.",
      severity: "high",
      patterns: [
        /\byou(?:'re| are) (?:either with us or against us)\b/gi,
        /\b(?:the only|there(?:'s| is) only one) (?:option|choice|way|solution|answer)\b/gi,
        /\bif (?:you're|we're|you are|we are) not (?:for|supporting|with).{3,30},?\s*(?:then you're|you must be|you are)\b/gi,
        /\byou (?:can|must) either .{5,40} or .{5,40}\b/gi
      ],
      minSentenceWords: 7
    },
    {
      name: "Slippery Slope",
      description: "Assumes one event inevitably leads to extreme consequences without justification.",
      severity: "medium",
      patterns: [
        /\bwhere does it (?:end|stop)\b/gi,
        /\bnext thing you know\b/gi,
        /\bbefore (?:you|we) know it\b/gi,
        /\bif we (?:allow|let|permit) this.{5,40}(?:then|next|soon|eventually)\b/gi,
        /\bopen(?:s|ing)? the (?:door|floodgate)s?\b/gi,
        /\bthin end of the wedge\b/gi,
        /\btoday .{5,25},?\s*tomorrow .{5,25}\b/gi
      ],
      minSentenceWords: 6
    },
    {
      name: "Bandwagon / Appeal to Popularity",
      description: "Argues something is true because many people believe it.",
      severity: "low",
      patterns: [
        /\b(?:everyone|everybody|millions of people) (?:knows?|agrees?|believes?|thinks?)\b/gi,
        /\b(?:growing|increasing) number of (?:people|Americans?|experts?)\s+(?:believe|think|agree|support)\b/gi,
        /\b\d+\s*(?:million|percent|%) of (?:people|Americans?|voters?) (?:agree|believe|support|think)\b/gi
      ],
      minSentenceWords: 5
    },
    {
      name: "Red Herring / Deflection",
      description: "Introduces an irrelevant topic to divert from the issue.",
      severity: "medium",
      patterns: [
        /\bthe real (?:issue|question|problem) (?:is|here is)\b/gi,
        /\blet'?s not forget (?:that|about)\b/gi,
        /\bwe should (?:really|instead) be (?:talking|focusing|looking) (?:about|at|on)\b/gi,
        /\bforget about that.{0,10}(?:what about|the real)\b/gi
      ],
      minSentenceWords: 6
    },
    {
      name: "Whataboutism (Tu Quoque)",
      description: "Deflects criticism by pointing to someone else's behavior.",
      severity: "medium",
      patterns: [
        /\b(?:but |yeah but |and )?what about (?:when|the time)\b/gi,
        /\byou(?:'re| are) one to talk\b/gi,
        /\bpot calling the kettle\b/gi,
        /\bhow about (?:when you|what they|what he|what she)\b/gi,
        /\b(?:but|yet) (?:you|they|he|she) (?:also|too) (?:did|do|have)\b/gi
      ],
      minSentenceWords: 5
    },
    {
      name: "Hasty Generalization",
      description: "Draws broad conclusions from insufficient evidence.",
      severity: "medium",
      patterns: [
        /\b(?:i knew a|my friend|my neighbor|this one guy).{5,30}(?:so|therefore|that'?s why|which (?:means|proves|shows))\b/gi,
        /\b(?:one|two|a few|couple of?) (?:examples?|cases?|instances?)\s+(?:prove|show|demonstrate|confirm)\b/gi,
        /\bjust look at .{5,30}(?:clearly|obviously|proves?|shows?)\b/gi
      ],
      minSentenceWords: 8
    },
    {
      name: "Circular Reasoning",
      description: "The conclusion is assumed in the premise.",
      severity: "high",
      patterns: [
        /\bit'?s true because .{5,30} (?:is true|says so|because it is)\b/gi,
        /\bthe bible is true because .{3,20} the bible\b/gi,
        /\b(\w+) is (\w+) because \1 is \2\b/gi
      ],
      minSentenceWords: 8
    },
    {
      name: "Appeal to Nature",
      description: "Argues something is good because it's 'natural' or bad because it's 'unnatural'.",
      severity: "low",
      patterns: [
        /\b(?:natural|nature) (?:is|means?) (?:always |inherently )?(?:better|safer|healthier|good)\b/gi,
        /\b(?:unnatural|artificial|synthetic|man[\s-]?made) (?:is|means?|are) (?:always |inherently )?(?:bad|harmful|dangerous|unhealthy)\b/gi,
        /\b(?:nature intended|against nature|playing god)\b/gi
      ],
      minSentenceWords: 5
    },
    {
      name: "False Cause (Post Hoc)",
      description: "Assumes causation from correlation or sequence.",
      severity: "medium",
      patterns: [
        /\b(?:ever since|right after|immediately after) .{5,40} (?:started|began|happened|things went)\b/gi,
        /\b(?:no |not a )?coincidence\??\b/gi,
        /\bcorrelat(?:ion|es?) .{3,15} (?:cause[ds]?|proof|proves?)\b/gi
      ],
      minSentenceWords: 6
    }
  ];

  function analyze(text) {
    if (!text || text.trim().length < 20) return emptyResult();

    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    const findings = [];
    let totalMatches = 0;

    FALLACIES.forEach(fallacy => {
      const matches = [];

      sentences.forEach(sentence => {
        const sentWords = sentence.split(/\s+/).length;
        if (sentWords < fallacy.minSentenceWords) return;

        fallacy.patterns.forEach(pattern => {
          // Reset regex state
          pattern.lastIndex = 0;
          const found = sentence.match(pattern);
          if (found) {
            found.forEach(m => {
              const trimmed = m.trim();
              if (!matches.some(e => e.toLowerCase() === trimmed.toLowerCase())) {
                matches.push(trimmed);
              }
            });
          }
        });
      });

      if (matches.length > 0) {
        findings.push({
          name: fallacy.name,
          description: fallacy.description,
          severity: fallacy.severity,
          matchCount: matches.length,
          examples: matches.slice(0, 3)
        });
        totalMatches += matches.length;
      }
    });

    // Sort by severity desc, then match count desc
    const sev = { high: 3, medium: 2, low: 1 };
    findings.sort((a, b) => (sev[b.severity] - sev[a.severity]) || (b.matchCount - a.matchCount));

    // Density relative to sentence count
    const fallacyDensity = sentences.length > 0
      ? Math.min(100, Math.round((totalMatches / sentences.length) * 40))
      : 0;

    let riskLabel;
    if (fallacyDensity < 10) riskLabel = "Low Risk";
    else if (fallacyDensity < 25) riskLabel = "Mild Risk";
    else if (fallacyDensity < 50) riskLabel = "Moderate Risk";
    else if (fallacyDensity < 75) riskLabel = "High Risk";
    else riskLabel = "Very High Risk";

    return { fallacies: findings, totalMatches, fallacyDensity, riskLabel, sentenceCount: sentences.length };
  }

  function emptyResult() {
    return { fallacies: [], totalMatches: 0, fallacyDensity: 0, riskLabel: "Low Risk", sentenceCount: 0 };
  }

  return { analyze };
})();
