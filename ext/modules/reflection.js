/**
 * reflection.js — Socratic question generator
 * Selects critical thinking prompts based on which analysis signals fired.
 */

const ReflectionEngine = (() => {

  const BANKS = {
    high_emotion: [
      "This text uses strong emotional language. What would the argument look like stripped of emotional framing?",
      "If you removed all emotional words, would the core point still be compelling?",
      "Who benefits from you feeling the emotions this text evokes?",
      "Is the emotional reaction this triggers proportional to the evidence presented?"
    ],
    high_bias: [
      "What perspective is missing or underrepresented here?",
      "Whose interests are served by this particular framing?",
      "If the opposing side wrote about this topic, what different language would they use?",
      "Which facts are emphasized and which might be omitted to support this narrative?"
    ],
    fallacies_detected: [
      "Can you identify where the reasoning breaks down?",
      "What evidence would actually be needed to support the claims being made?",
      "Could the conclusion still be true even if the reasoning is flawed?",
      "What alternative explanations exist that the author doesn't consider?"
    ],
    strong_claims: [
      "What specific evidence would you need to verify these claims?",
      "Are the claims here falsifiable? How would you test them?",
      "What would change your mind about the claims in this text?",
      "How would a domain expert evaluate these assertions?"
    ],
    low_credibility: [
      "Can you verify these claims with more established sources?",
      "Is this source trying to inform you or persuade you?",
      "What is the funding model of this publication, and how might it influence content?",
      "Would you trust this source for important decisions?"
    ],
    opinion_heavy: [
      "What facts would you need to form your own independent view?",
      "Can you separate the author's opinions from any factual claims?",
      "If someone you disagreed with made the same argument, would you evaluate it differently?"
    ],
    general: [
      "Before sharing this, ask: Is it true? Is it fair? Is it necessary?",
      "What is the author's purpose — to inform, persuade, entertain, or provoke?",
      "What questions does this text leave unanswered?",
      "How does this fit with what you already know? Does it confirm or challenge existing beliefs?"
    ]
  };

  function pick(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  function generate(results) {
    const { sentiment, bias, fallacies, claims, source, readability } = results;
    const questions = [];
    const categories = [];

    if (sentiment && sentiment.emotionalIntensity > 40) { categories.push("high_emotion"); questions.push(...pick(BANKS.high_emotion, 2)); }
    if (bias && bias.biasScore > 30) { categories.push("high_bias"); questions.push(...pick(BANKS.high_bias, 2)); }
    if (fallacies && fallacies.totalMatches > 0) { categories.push("fallacies_detected"); questions.push(...pick(BANKS.fallacies_detected, 2)); }
    if (claims && (claims.counts.strong_claim || 0) > 2) { categories.push("strong_claims"); questions.push(...pick(BANKS.strong_claims, 1)); }
    if (source && source.score < 40) { categories.push("low_credibility"); questions.push(...pick(BANKS.low_credibility, 2)); }
    if (claims && claims.distribution.opinionPercent > 50) { categories.push("opinion_heavy"); questions.push(...pick(BANKS.opinion_heavy, 1)); }

    questions.push(...pick(BANKS.general, 2));

    const parts = [];
    if (categories.includes("high_emotion") && categories.includes("high_bias"))
      parts.push("This content combines emotional language with bias markers — often indicating persuasive rather than informational intent.");
    if (categories.includes("fallacies_detected"))
      parts.push(`${results.fallacies.totalMatches} potential logical fallacy pattern(s) detected.`);
    if (categories.includes("low_credibility"))
      parts.push("Source credibility signals suggest caution. Cross-reference key claims.");
    if (parts.length === 0)
      parts.push("Consider what perspective might be missing and whether evidence supports the conclusions.");

    return {
      questions: [...new Set(questions)].slice(0, 7),
      categories,
      synthesis: parts.join(" ")
    };
  }

  return { generate };
})();
