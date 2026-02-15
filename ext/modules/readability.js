/**
 * readability.js — Multi-metric readability analysis
 * Implements standard published formulas: Flesch-Kincaid, Gunning Fog,
 * Coleman-Liau, SMOG, Automated Readability Index.
 */

const ReadabilityAnalyzer = (() => {

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length <= 2) return 1;

    const EXCEPTIONS = {"area":3,"idea":3,"real":2,"realize":3,"create":2,"science":2,"every":3,"favorite":3,"chocolate":3,"camera":3,"different":3,"evening":3,"interest":3,"beautiful":3,"business":2,"average":3,"family":3,"several":3,"basically":4,"generally":4,"literally":4,"naturally":4,"especially":4,"occasionally":5,"immediately":5,"unfortunately":5,"comfortable":4,"temperature":4,"vegetable":4,"restaurant":3,"interesting":4,"experience":4,"important":3,"everything":3};
    if (EXCEPTIONS[word]) return EXCEPTIONS[word];

    // Remove trailing silent-e
    let w = word.replace(/(?:[^leas])e$/, "");
    if (w.length === 0) return 1;

    // Count vowel groups
    const groups = w.match(/[aeiouy]+/g);
    let count = groups ? groups.length : 1;

    // Adjust for -le preceded by consonant
    if (/[^aeiou]le$/.test(word) && !w.endsWith("le")) count++;
    // -ed not adding syllable when preceded by consonant (except t/d)
    if (/[^aeioutd]ed$/.test(word)) count = Math.max(1, count - 1);

    return Math.max(1, count);
  }

  function splitSentences(text) {
    return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 2 && s.split(/\s+/).length >= 2);
  }

  function splitWords(text) {
    return text.split(/\s+/).filter(w => w.replace(/[^a-z]/gi, "").length > 0);
  }

  function isComplex(word) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length < 4) return false;
    return countSyllables(clean) >= 3;
  }

  function analyze(text) {
    if (!text || text.trim().length < 10) return emptyResult();

    const sentences = splitSentences(text);
    const words = splitWords(text);
    const sentenceCount = sentences.length || 1;
    const wordCount = words.length;
    if (wordCount < 3) return emptyResult();

    const totalSyllables = words.reduce((s, w) => s + countSyllables(w), 0);
    const complexWords = words.filter(isComplex);
    const complexCount = complexWords.length;
    const letterCount = words.reduce((s, w) => s + w.replace(/[^a-z]/gi, "").length, 0);

    const avgWPS = wordCount / sentenceCount;
    const avgSPW = totalSyllables / wordCount;
    const pctComplex = (complexCount / wordCount) * 100;

    // Flesch Reading Ease (0-100, higher = easier)
    const fleschEase = Math.max(0, Math.min(100, Math.round((206.835 - 1.015 * avgWPS - 84.6 * avgSPW) * 10) / 10));

    // Flesch-Kincaid Grade Level
    const fk = Math.max(0, Math.round((0.39 * avgWPS + 11.8 * avgSPW - 15.59) * 10) / 10);

    // Gunning Fog
    const gf = Math.max(0, Math.round((0.4 * (avgWPS + pctComplex)) * 10) / 10);

    // Coleman-Liau
    const L = (letterCount / wordCount) * 100;
    const S = (sentenceCount / wordCount) * 100;
    const cl = Math.max(0, Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10);

    // SMOG (needs 30+ sentences for accuracy, falls back to FK)
    const smog = sentenceCount >= 3
      ? Math.max(0, Math.round((1.0430 * Math.sqrt(complexCount * (30 / sentenceCount)) + 3.1291) * 10) / 10)
      : fk;

    // Automated Readability Index
    const ari = Math.max(0, Math.round((4.71 * (letterCount / wordCount) + 0.5 * avgWPS - 21.43) * 10) / 10);

    const compositeGrade = Math.round(((fk + gf + cl + smog + ari) / 5) * 10) / 10;

    let levelLabel;
    if (compositeGrade <= 5) levelLabel = "Elementary";
    else if (compositeGrade <= 8) levelLabel = "Middle School";
    else if (compositeGrade <= 12) levelLabel = "High School";
    else if (compositeGrade <= 16) levelLabel = "College";
    else levelLabel = "Graduate / Professional";

    const readingTimeMinutes = Math.max(1, Math.round(wordCount / 238));
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, ""))).size;
    const vocabularyDiversity = Math.round((uniqueWords / wordCount) * 100);

    const sentLengths = sentences.map(s => splitWords(s).length);
    const mean = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
    const variance = sentLengths.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / sentLengths.length;

    return {
      scores: { fleschEase, fleschKincaid: fk, gunningFog: gf, colemanLiau: cl, smog, ari, compositeGrade },
      levelLabel,
      stats: {
        wordCount, sentenceCount,
        avgWordsPerSentence: Math.round(avgWPS * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSPW * 100) / 100,
        complexWordCount: complexCount,
        complexWordPercent: Math.round(pctComplex * 10) / 10,
        vocabularyDiversity,
        readingTimeMinutes
      },
      sentenceStructure: {
        longSentences: sentLengths.filter(l => l > 25).length,
        shortSentences: sentLengths.filter(l => l < 8).length,
        variance: Math.round(variance * 10) / 10
      },
      complexWords: [...new Set(complexWords.map(w => w.toLowerCase().replace(/[^a-z]/g, "")))].slice(0, 20)
    };
  }

  function emptyResult() {
    return {
      scores: { fleschEase: 0, fleschKincaid: 0, gunningFog: 0, colemanLiau: 0, smog: 0, ari: 0, compositeGrade: 0 },
      levelLabel: "N/A",
      stats: { wordCount: 0, sentenceCount: 0, avgWordsPerSentence: 0, avgSyllablesPerWord: 0, complexWordCount: 0, complexWordPercent: 0, vocabularyDiversity: 0, readingTimeMinutes: 0 },
      sentenceStructure: { longSentences: 0, shortSentences: 0, variance: 0 },
      complexWords: []
    };
  }

  return { analyze };
})();
