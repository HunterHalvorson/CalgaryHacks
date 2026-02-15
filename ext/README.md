# ClarityLens v2 — Critical Thinking Chrome Extension

Algorithmic + optional AI-enhanced critical thinking toolkit. **Select text on any page** to analyze it for bias, logical fallacies, emotional language, readability, source credibility, and claim types.

## How It Works

1. **Select text** on any webpage
2. Click the **Analyze** button that appears
3. A side panel slides in with full analysis across multiple tabs
4. The analyzed text stays **highlighted** — click any highlight to revisit its analysis
5. Highlights **persist** across sessions (stored in chrome.storage.local)

### Smart Text Validation

The extension won't produce meaningless results on tiny selections:

| Selection Size | Analysis Depth |
|---|---|
| < 3 words | Rejected — "select more text" |
| 3–9 words | Basic (sentiment + readability only) |
| 10–49 words | Standard (all modules, noted as limited sample) |
| 50–199 words | Full analysis |
| 200+ words | Comprehensive with enhanced statistics |

## Analysis Modules

All modules are **purely algorithmic** with no AI dependency:

| Module | Approach |
|---|---|
| **Sentiment** | AFINN-style lexicon (~600 words), negation handling (3-word window), intensifier multiplication, hedge detection, emotional appeal patterns |
| **Bias** | Loaded language detection (5 categories), weasel words, 14 framing patterns, passive voice density, leading questions |
| **Fallacies** | Pattern-matches 13 informal fallacies with per-sentence context checking and minimum word thresholds to reduce false positives |
| **Claims** | Classifies sentences as opinion / strong claim / hedged claim / factual / rhetorical question |
| **Readability** | 6 published formulas (Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG, ARI) + vocabulary diversity |
| **Source** | Domain tier lookup, TLD trust scoring, content credibility signals |
| **Reflection** | Context-aware Socratic question generator triggered by analysis findings |

## Optional: OpenAI Enhancement

Add an OpenAI API key in the extension popup to layer AI analysis on top:

- **Deeper bias detection** with directional assessment
- **Specific fallacy identification** with explanations
- **Manipulation technique detection**
- **Claim-by-claim assessment** (verifiable fact / opinion / unsupported)
- **Missing context identification**
- **AI-generated critical thinking questions**

The AI results appear in a dedicated "AI" tab and are blended into the composite score (60% algorithmic / 40% AI). Uses `gpt-4o-mini` for cost efficiency.

**The extension works fully without any API key.** The AI layer supplements — never replaces — the algorithmic engine.

## Installation

1. Download and unzip
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `clarity-lens` folder
5. (Optional) Click the extension icon → enter OpenAI API key

## Architecture

```
clarity-lens/
├── manifest.json
├── background.js
├── content.js              ← Selection detection, highlights, in-page panel
├── content.css
├── popup.html/css/js       ← Settings (API key, highlight management)
├── modules/
│   ├── sentiment.js        ← Negation-aware lexicon scoring
│   ├── bias-detector.js    ← Loaded language, framing, weasel words
│   ├── fallacy-detector.js ← 13 fallacies, context-windowed
│   ├── readability.js      ← 6 standard formulas
│   ├── source-scorer.js    ← Domain + content credibility
│   ├── claim-analyzer.js   ← Sentence-level classification
│   ├── reflection.js       ← Socratic question generation
│   ├── openai-enhancer.js  ← Optional AI layer
│   └── analyzer-core.js    ← Orchestrator + text validation
└── icons/
```

## Limitations

- Pattern matching produces heuristic indicators, not definitive verdicts
- Calibrated for English prose
- Fallacy detection identifies linguistic patterns that correlate with fallacies
- Source credibility domain lists cover major outlets but aren't exhaustive
- Highlight restoration uses text matching — may fail if page content changes between visits

## License

MIT
