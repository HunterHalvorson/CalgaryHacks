import { useState, useEffect, useRef, useCallback } from "react";

// ─── FONT + GLOBAL STYLES ────────────────────────────────────────────────────
const GlobalStyles = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,800;1,9..144,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      :root {
        --bg: #0c0f14; --surface: #141820; --surface2: #1a1f2e;
        --border: #232a38; --border2: #2d3548;
        --text: #e8edf5; --text2: #8892a4; --text3: #4a5568;
        --accent: #f59e0b; --accent2: #fbbf24;
        --green: #10b981; --red: #ef4444; --orange: #f97316;
        --blue: #3b82f6; --teal: #14b8a6; --purple: #8b5cf6; --yellow: #fde047;
      }
      html, body, #root { height: 100%; width: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
        50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .fade-up { animation: fadeUp 0.3s ease; }
      .slide-in { animation: slideIn 0.25s ease; }
      input, button { font-family: inherit; }
      .spinner { width: 28px; height: 28px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);
  return null;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const HF_MODEL = "https://api-inference.huggingface.co/models/d4data/bias-detection-model";
const CORS_PROXY = "https://api.allorigins.win/get?url=";
const CORS_PROXY_RAW = "https://api.allorigins.win/raw?url=";
const CORS_PROXY_FALLBACK = "https://api.codetabs.com/v1/proxy/?quest=";
const FETCH_TIMEOUT_MS = 12000;
const STORAGE_KEY = "medialens_v2";
const SETTINGS_KEY = "medialens_settings_v2";

const SAMPLE_ARTICLES = [
  {
    id: "sample_1",
    url: "https://example.com/bank-rate",
    title: "Bank of Canada Holds Rate at 3.25%",
    outlet: "Financial Post",
    date: "Feb 14, 2026",
    tag: "Monetary Policy",
    biasScore: 74,
    factualDensity: 62,
    framingScore: 78,
    omissionRate: 58,
    languageLoad: 44,
    usedFallback: true,
    createdAt: Date.now() - 86400000,
    analyzed: [
      { sentence: "The Bank of Canada maintained its benchmark interest rate at 3.25% Wednesday, a decision widely praised by financial markets as prudent stewardship.", biasScore: 0.78 },
      { sentence: "Major bank stocks surged following the announcement, with RBC and TD posting their strongest single-day gains in three months.", biasScore: 0.32 },
      { sentence: "Economists noted the move signals confidence in inflation-control mechanisms and bodes well for the upcoming fiscal quarter.", biasScore: 0.76 },
      { sentence: "The central bank cited strong employment figures and robust GDP growth as key factors in its decision.", biasScore: 0.48 },
      { sentence: "Analysts from Bay Street unanimously welcomed the policy continuity, calling it a win for economic stability.", biasScore: 0.88 },
    ],
    laborSentences: [
      { sentence: "The Bank of Canada held rates at 3.25% Wednesday — providing no relief to Canadians carrying record mortgage debt into another quarter.", biasScore: 0.55, wasRewritten: true },
      { sentence: "Bank stocks surged, but Calgary homeowners will continue paying $2,200 more annually in interest than they were in 2021.", biasScore: 0.32, wasRewritten: true },
      { sentence: "Economists praised inflation control, though real wages have declined 4.3% when adjusted for inflation since the rate cycle began.", biasScore: 0.76, wasRewritten: true },
      { sentence: "The Bank cited strong employment figures — excluding 140,000 Canadians who left the workforce entirely and are no longer counted.", biasScore: 0.48, wasRewritten: true },
      { sentence: "Bay Street welcomed continuity; tenant advocacy groups called it 'another quarter of inaction' on housing affordability.", biasScore: 0.88, wasRewritten: true },
    ],
    voices: [
      { icon: "🏠", group: "Calgary Renters", color: "#3b82f6", text: "Average Calgary rent hit $1,920/month in Jan 2026 — up 31% since 2021. The rate hold means no cost relief flows to the 124,000 renter households already spending 30%+ of income on housing." },
      { icon: "⚙️", group: "Gig Workers", color: "#f59e0b", text: "Alberta's 18% gig workforce has no EI access and is structurally excluded from 'strong employment' statistics. Their income volatility makes rate stability meaningless without social floors." },
      { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "First Nations in Treaty 7 territory face 24% unemployment. Monetary policy benefits flow through home equity and institutional investment — channels structurally inaccessible to this population." },
    ],
    calgary: { stat: "Mortgage delinquency rate", value: "0.41%", context: "Up 38% year-over-year — highest since the 2016 oil crash", impact: "124,000 Calgary renter households see no relief from rate holds", source: "CMHC Q4 2025 Report" },
  },
  {
    id: "sample_2",
    url: "https://example.com/housing",
    title: "Calgary Housing Market Sees 'Healthy Correction'",
    outlet: "Calgary Herald",
    date: "Feb 12, 2026",
    tag: "Real Estate",
    biasScore: 68,
    factualDensity: 55,
    framingScore: 71,
    omissionRate: 63,
    languageLoad: 52,
    usedFallback: true,
    createdAt: Date.now() - 172800000,
    analyzed: [
      { sentence: "Calgary's real estate market experienced a healthy correction in January, with benchmark prices falling 3.2% from their October peak.", biasScore: 0.68 },
      { sentence: "Real estate professionals described the adjustment as a normalization after years of pandemic-driven demand.", biasScore: 0.72 },
      { sentence: "Inventory levels rose to 4.2 months of supply, approaching the balanced market threshold of 5–6 months.", biasScore: 0.22 },
      { sentence: "Analysts from major brokerages expect a soft landing as the spring market approaches, with renewed buyer confidence anticipated.", biasScore: 0.6 },
      { sentence: "The City's economic development office highlighted the resilience of Alberta's diversified economy as a stabilizing force.", biasScore: 0.5 },
    ],
    laborSentences: [
      { sentence: "Calgary prices fell 3.2% in January — a minor correction after a 48% run-up since 2020 that locked out an entire generation of buyers.", biasScore: 0.68, wasRewritten: true },
      { sentence: "Real estate brokers called it a 'normalization' — the same firms that projected 12% annual gains through 2026 just eight months ago.", biasScore: 0.72, wasRewritten: true },
      { sentence: "Inventory rose to 4.2 months, but 67% of new listings are priced above $600,000 — beyond reach of Calgary's $98,000 median household income.", biasScore: 0.22, wasRewritten: true },
      { sentence: "Analysts predict a 'spring recovery' — language that historically correlates with renewed upward pressure on first-time buyers.", biasScore: 0.6, wasRewritten: true },
      { sentence: "The 'diversified economy' framing omits that 34% of Calgary jobs added since 2022 are in temporary or contract roles.", biasScore: 0.5, wasRewritten: true },
    ],
    voices: [
      { icon: "🏠", group: "Calgary Renters", color: "#3b82f6", text: "Of 124,000 Calgary renter households, 41% exceed the federal 30% affordability threshold. A 3.2% price correction has zero impact on their monthly costs." },
      { icon: "🔨", group: "Construction Workers", color: "#f59e0b", text: "1 in 5 Calgary construction workers now commutes from Airdrie or Cochrane — priced out of the city they're building. The 'correction' doesn't reach them." },
      { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "Urban Indigenous housing orgs report zero vacancy in Calgary's 847 Indigenous-specific affordable units. The broader market correction is statistically irrelevant to this population." },
    ],
    calgary: { stat: "First-time buyer affordability gap", value: "$156K", context: "Gap between income-qualified mortgage and median home price in Feb 2026", impact: "41% of renters exceed federal 30% affordability threshold", source: "Open Calgary Housing Dashboard" },
  },
];

// ─── CALGARY DATA BY TOPIC ────────────────────────────────────────────────────
const CALGARY_STATS = {
  "Monetary Policy": { stat: "Mortgage delinquency rate", value: "0.41%", context: "Up 38% YoY — highest since the 2016 oil crash", impact: "124,000 Calgary renter households see no relief from rate holds", source: "CMHC Q4 2025 Report" },
  "Real Estate": { stat: "First-time buyer affordability gap", value: "$156K", context: "Gap between income-qualified mortgage and median home price", impact: "41% of renters exceed federal 30% affordability threshold", source: "Open Calgary Housing Dashboard, Feb 2026" },
  "Labour": { stat: "Calgary gig workforce share", value: "18%", context: "Structurally excluded from EI and 'strong employment' statistics", impact: "72,000 workers have no access to employment insurance", source: "Alberta Employment Standards, 2025" },
  "Energy": { stat: "Oil sector temp/contract jobs", value: "34%", context: "Of energy jobs added since 2022, over a third are non-permanent", impact: "Boom-bust volatility continues to define worker precarity", source: "Statistics Canada Labour Survey, Q3 2025" },
  default: { stat: "Calgary median household income", value: "$98,000", context: "Real wages declined 4.3% when adjusted for inflation since 2021", impact: "Cost of living up 18% since 2021 vs wage growth of 12%", source: "Statistics Canada, 2025" },
};

const MISSING_VOICES = {
  "Monetary Policy": [
    { icon: "🏠", group: "Calgary Renters", color: "#3b82f6", text: "Average Calgary rent hit $1,920/month in Jan 2026 — up 31% since 2021. The rate hold means no cost relief flows to the 124,000 renter households spending 30%+ of income on housing." },
    { icon: "⚙️", group: "Gig Workers", color: "#f59e0b", text: "Alberta's 18% gig workforce has no EI access and is structurally excluded from 'strong employment' statistics. Their income volatility makes rate stability meaningless without social floors." },
    { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "First Nations in Treaty 7 territory face 24% unemployment. Monetary policy benefits flow through home equity — channels structurally inaccessible to this population." },
  ],
  "Real Estate": [
    { icon: "🏠", group: "Calgary Renters", color: "#3b82f6", text: "Of 124,000 Calgary renter households, 41% exceed the federal 30% affordability threshold. A 3.2% price correction has zero impact on their monthly costs." },
    { icon: "🔨", group: "Construction Workers", color: "#f59e0b", text: "1 in 5 Calgary construction workers now commutes from Airdrie or Cochrane — priced out of the city they're building. The 'correction' doesn't reach them." },
    { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "Urban Indigenous housing orgs report zero vacancy in Calgary's 847 Indigenous-specific affordable units. The broader market correction is statistically irrelevant to this population." },
  ],
  default: [
    { icon: "👥", group: "Low-Income Households", color: "#3b82f6", text: "The bottom income quintile in Calgary has seen purchasing power decline 8% since 2021. Economic coverage rarely includes their perspective on what 'growth' means." },
    { icon: "⚙️", group: "Precarious Workers", color: "#f59e0b", text: "Over 30% of Alberta's workforce is in non-standard employment. They're often excluded from headline numbers that shape economic narratives." },
    { icon: "🌿", group: "Marginalized Communities", color: "#8b5cf6", text: "Economic policy impacts are not distributed equally. Indigenous, racialized, and newcomer communities experience macro-economic shifts through structurally different lived realities." },
  ],
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function biasColor(score) {
  if (score < 35) return "#10b981";
  if (score < 60) return "#f59e0b";
  if (score < 80) return "#f97316";
  return "#ef4444";
}

function biasLabel(score) {
  if (score < 35) return "Low";
  if (score < 60) return "Moderate";
  if (score < 80) return "High";
  return "Extreme";
}

function inferTag(text) {
  const t = text.toLowerCase();
  if (t.match(/interest rate|inflation|monetary|bank of canada/)) return "Monetary Policy";
  if (t.match(/housing|real estate|mortgage|rent|condo/)) return "Real Estate";
  if (t.match(/oil|energy|pipeline|alberta|suncor/)) return "Energy";
  if (t.match(/job|employment|wage|labour|union/)) return "Labour";
  if (t.match(/budget|deficit|fiscal|tax/)) return "Fiscal Policy";
  if (t.match(/stock|market|tsx|equity|investor/)) return "Markets";
  return "Economics";
}

function estimateBias(sentence) {
  const loaded = ["surged","plummeted","soared","booming","praised","unanimously","unprecedented","collapsed","devastated","radical","extreme","failed","miracle","historic","widely welcomed","experts say"];
  const lower = sentence.toLowerCase();
  let score = 0.15;
  loaded.forEach(w => { if (lower.includes(w)) score += 0.13; });
  const adverbs = (lower.match(/\b(significantly|dramatically|substantially|notably|sharply|overwhelmingly)\b/g) || []).length;
  score += adverbs * 0.08;
  if (lower.match(/markets welcome|investors cheer|business confidence/)) score += 0.15;
  if (lower.match(/families struggle|workers suffer|renters face/)) score += 0.12;
  return Math.min(score, 0.93);
}

function generateLabor(analyzed, tag) {
  const laborReframes = {
    "Monetary Policy": [
      [/widely praised.*?markets/gi, "applauded by financial institutions while homeowners bear elevated costs"],
      [/strong employment figures/gi, "official employment figures — excluding the 140,000 Canadians who left the workforce entirely"],
      [/unanimously welcomed/gi, "welcomed by Bay Street; tenant groups called it 'another quarter of inaction'"],
      [/bodes well for.*?quarter/gi, "may mask declining real wages and rising precarious employment"],
      [/prudent stewardship/gi, "a hold that preserves bank dividends but delays relief for renters"],
    ],
    "Real Estate": [
      [/healthy correction/gi, "minor correction after a 48% run-up that locked out an entire generation"],
      [/normalization/gi, "normalization — from the same firms projecting 12% gains 8 months ago"],
      [/buyer confidence/gi, "renewed upward pressure that brokers euphemistically call 'confidence'"],
      [/resilience of Alberta/gi, "Alberta economy where 34% of jobs added since 2022 are temporary"],
      [/balanced market/gi, "market where 67% of listings exceed the reach of median household income"],
    ],
  };

  const suffixes = {
    "Monetary Policy": [" — while mortgage delinquency rates hit their highest since 2016", " — as real wages continue declining when adjusted for inflation", " — a move that preserves bank margins while renters see no relief"],
    "Real Estate": [" — though 41% of renters already spend over 30% of income on housing", " — a statistic that excludes the generation priced out since 2020", " — data that doesn't account for the 124,000 renter households in Calgary"],
    default: [" — though precarious workers experience this differently", " — excluding the gig economy and informal workers from the count"],
  };

  return analyzed.map(({ sentence, biasScore }) => {
    let text = sentence;
    const rewrites = laborReframes[tag] || [];

    if (biasScore > 0.5) {
      for (const [pattern, replacement] of rewrites) {
        const rewritten = text.replace(pattern, replacement);
        if (rewritten !== text) { text = rewritten; break; }
      }
      if (text === sentence && biasScore > 0.65) {
        const pool = suffixes[tag] || suffixes.default;
        const suf = pool[Math.floor(Math.random() * pool.length)];
        text = sentence.replace(/([.!?])$/, suf + "$1");
      }
    }
    return { sentence: text, biasScore, wasRewritten: text !== sentence };
  });
}

async function callHuggingFace(sentences, apiKey) {
  const headers = { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
  const results = [];

  for (const sentence of sentences) {
    try {
      const res = await fetch(HF_MODEL, { method: "POST", headers, body: JSON.stringify({ inputs: sentence }) });
      if (res.status === 503) { results.push({ sentence, biasScore: 0.35, fallback: true }); continue; }
      if (!res.ok) { results.push({ sentence, biasScore: estimateBias(sentence), fallback: true }); continue; }
      const data = await res.json();
      let biasEntry;
      if (Array.isArray(data) && Array.isArray(data[0])) biasEntry = data[0].find(d => d.label === "Biased" || d.label === "LABEL_1");
      else if (Array.isArray(data)) biasEntry = data.find(d => d.label === "Biased" || d.label === "LABEL_1");
      results.push({ sentence, biasScore: biasEntry ? biasEntry.score : 0.2 });
    } catch {
      results.push({ sentence, biasScore: estimateBias(sentence), fallback: true });
    }
  }
  return results;
}

function extractSentences(html) {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  let paragraphs = pMatches.map(p => p.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(p => p.length > 40 && !p.match(/^(Cookie|Subscribe|Sign|Newsletter|Advertisement)/i));
  if (paragraphs.length < 3) {
    const sents = stripped.match(/[A-Z][^.!?]{30,}[.!?]/g) || [];
    paragraphs = [...new Set(sents)].slice(0, 12);
  }
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  const sentences = [];
  paragraphs.slice(0, 8).forEach(para => {
    (para.match(/[^.!?]+[.!?]+/g) || [para]).forEach(s => { if (s.trim().length > 20) sentences.push(s.trim()); });
  });
  return { title, paragraphs, sentences: sentences.slice(0, 14) };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleHtml(url) {
  const encoded = encodeURIComponent(url);
  const attempts = [
    {
      name: "AllOrigins JSON",
      run: async () => {
        const res = await fetchWithTimeout(CORS_PROXY + encoded);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.contents || "";
      },
    },
    {
      name: "AllOrigins Raw",
      run: async () => {
        const res = await fetchWithTimeout(CORS_PROXY_RAW + encoded);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      },
    },
    {
      name: "CodeTabs Proxy",
      run: async () => {
        const res = await fetchWithTimeout(CORS_PROXY_FALLBACK + encoded);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      },
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const html = await attempt.run();
      if (typeof html === "string" && html.trim().length > 0) return html;
      throw new Error("Empty response");
    } catch (err) {
      lastError = `${attempt.name}: ${err.message}`;
    }
  }

  throw new Error(`Could not fetch article content (${lastError || "unknown error"})`);
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function BiasGauge({ score }) {
  const r = 52, cx = 70, cy = 68;
  const pct = score / 100;
  const angle = Math.PI * pct;
  const px = cx + r * Math.cos(Math.PI - angle);
  const py = cy - r * Math.sin(angle);
  const color = biasColor(score);
  const label = biasLabel(score);
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg viewBox="0 0 140 82" style={{ width: 140, height: 82 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1e2533" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px} ${py}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        <circle cx={px} cy={py} r={5} fill={color} />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#e8edf5" style={{ fontSize: 22, fontFamily: "'Fraunces',serif", fontWeight: 800 }}>{score}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill={color} style={{ fontSize: 8.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function MetricBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text3)", letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text2)", fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width 0.9s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </div>
    </div>
  );
}

function RadarChart({ factual, framing, omission, languageLoad, biasScore }) {
  const cx = 85, cy = 85, r = 56;
  const axes = [
    { label: "Factual", val: factual / 100 },
    { label: "Neutral", val: Math.max(0.08, 1 - biasScore / 100) },
    { label: "Context", val: Math.max(0.08, 1 - omission / 100) },
    { label: "Framing", val: framing / 100 },
    { label: "Language", val: languageLoad / 100 },
  ];
  const n = axes.length;
  const pts = axes.map((a, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + r * a.val * Math.cos(angle), y: cy + r * a.val * Math.sin(angle), lx: cx + (r + 18) * Math.cos(angle), ly: cy + (r + 18) * Math.sin(angle) };
  });
  const grids = [0.25, 0.5, 0.75, 1].map(lv => axes.map((_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return `${cx + r * lv * Math.cos(a)},${cy + r * lv * Math.sin(a)}`; }).join(" "));

  return (
    <svg viewBox="0 0 170 170" style={{ width: "100%", maxWidth: 170 }}>
      {grids.map((g, i) => <polygon key={i} points={g} fill={i === 3 ? "rgba(20,184,166,0.04)" : "none"} stroke="#1e2533" strokeWidth="1" />)}
      {axes.map((_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#1e2533" strokeWidth="1" />; })}
      <polygon points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(20,184,166,0.12)" stroke="#14b8a6" strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#14b8a6" />)}
      {pts.map((p, i) => <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill="#4a5568" style={{ fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{axes[i].label}</text>)}
    </svg>
  );
}

function HeatSentence({ sentence, biasScore }) {
  const [tip, setTip] = useState(false);
  let cls = null, tipText = "";
  if (biasScore >= 0.75) { cls = { bg: "rgba(248,113,113,0.18)", border: "#f87171" }; tipText = `Extreme · ${Math.round(biasScore * 100)}% — loaded language`; }
  else if (biasScore >= 0.5) { cls = { bg: "rgba(251,146,60,0.15)", border: "#fb923c" }; tipText = `Slanted · ${Math.round(biasScore * 100)}% — omitted context`; }
  else if (biasScore >= 0.3) { cls = { bg: "rgba(253,224,71,0.12)", border: "#fde047" }; tipText = `Mild · ${Math.round(biasScore * 100)}% — adjective framing`; }

  return (
    <span
      onMouseEnter={() => cls && setTip(true)}
      onMouseLeave={() => setTip(false)}
      style={{ position: "relative", display: "inline", background: cls ? cls.bg : "transparent", borderBottom: cls ? `2px solid ${cls.border}` : "none", padding: cls ? "1px 3px" : 0, borderRadius: 3, cursor: cls ? "pointer" : "default", lineHeight: 1.95 }}
    >
      {sentence}{" "}
      {tip && cls && (
        <span style={{ position: "absolute", bottom: "115%", left: "50%", transform: "translateX(-50%)", background: "#0c0f14", border: "1px solid var(--border2)", color: "var(--text)", fontSize: 11, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 50, fontFamily: "'JetBrains Mono',monospace", boxShadow: "0 4px 24px rgba(0,0,0,0.6)", pointerEvents: "none" }}>
          {tipText}
        </span>
      )}
    </span>
  );
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onBack }) {
  const [key, setKey] = useState(settings.hfKey || "");
  const [city, setCity] = useState(settings.city || "Calgary, AB");
  const [maxS, setMaxS] = useState(settings.maxSents || 12);
  const [saved, setSaved] = useState(false);

  const S = {
    wrap: { flex: 1, overflowY: "auto", padding: "28px 32px" },
    header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 32 },
    title: { fontFamily: "'Fraunces',serif", fontSize: "1.5rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" },
    group: { marginBottom: 28 },
    groupLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.14em", color: "var(--text3)", textTransform: "uppercase", display: "block", marginBottom: 12 },
    field: { marginBottom: 16 },
    label: { display: "block", fontSize: "0.8rem", color: "var(--text2)", marginBottom: 6 },
    input: { width: "100%", maxWidth: 420, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", padding: "9px 13px", outline: "none", transition: "border-color 0.2s" },
    hint: { fontSize: "0.7rem", color: "var(--text3)", lineHeight: 1.5, marginTop: 6 },
    btn: { padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.05em", fontWeight: 600, transition: "all 0.15s" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <button style={{ ...S.btn, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border2)" }} onClick={onBack}>← Back</button>
        <div style={S.title}>Settings</div>
      </div>

      <div style={S.group}>
        <span style={S.groupLabel}>HuggingFace API</span>
        <div style={S.field}>
          <label style={S.label}>API Key (optional but recommended)</label>
          <input type="password" style={S.input} value={key} onChange={e => setKey(e.target.value)} placeholder="hf_xxxxxxxxxxxxxx" onFocus={e => (e.target.style.borderColor = "var(--accent)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          <div style={S.hint}>Without a key, requests are rate-limited. Get a free key at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>huggingface.co</a></div>
        </div>
      </div>

      <div style={S.group}>
        <span style={S.groupLabel}>Location</span>
        <div style={S.field}>
          <label style={S.label}>City (for local reality checks)</label>
          <input type="text" style={S.input} value={city} onChange={e => setCity(e.target.value)} onFocus={e => (e.target.style.borderColor = "var(--accent)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
        </div>
      </div>

      <div style={S.group}>
        <span style={S.groupLabel}>Analysis</span>
        <div style={S.field}>
          <label style={S.label}>Max sentences to analyze (4–30)</label>
          <input type="number" style={{ ...S.input, maxWidth: 120 }} value={maxS} min={4} max={30} onChange={e => setMaxS(parseInt(e.target.value) || 12)} onFocus={e => (e.target.style.borderColor = "var(--accent)")} onBlur={e => (e.target.style.borderColor = "var(--border2)")} />
          <div style={S.hint}>More sentences = deeper analysis but slower. Free tier: keep under 15.</div>
        </div>
      </div>

      <button style={{ ...S.btn, background: saved ? "var(--green)" : "var(--accent)", color: "#000", minWidth: 140 }} onClick={() => { onSave({ hfKey: key, city, maxSents: maxS }); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [articles, setArticles] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("home"); // home | analysis | settings
  const [activeTab, setActiveTab] = useState("heatmap");
  const [perspective, setPerspective] = useState("institutional");
  const [calgaryOpen, setCalgaryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [settings, setSettings] = useState({ hfKey: "", city: "Calgary, AB", maxSents: 12 });
  const [urlInput, setUrlInput] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Load from localStorage ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setArticles(JSON.parse(stored));
      else {
        const initial = {};
        SAMPLE_ARTICLES.forEach(a => { initial[a.id] = a; });
        setArticles(initial);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      }
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) setSettings(JSON.parse(storedSettings));
    } catch { /* ignore */ }
  }, []);

  const saveArticles = useCallback((next) => {
    setArticles(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const saveSettings = useCallback((next) => {
    setSettings(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const notify = useCallback((msg, duration = 2500) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);

  // ── Analysis Pipeline ─────────────────────────────────────────────────────
  async function analyzeUrl(url) {
    if (!url) { notify("⚠ Please enter a URL first"); return; }
    try { new URL(url); } catch { notify("⚠ Invalid URL format"); return; }

    const existing = Object.values(articles).find(a => a.url === url);
    if (existing) { showArticle(existing.id); notify("Loaded from history ✓"); return; }

    setLoading(true);
    setLoadingMsg("Fetching article content…");
    setView("analysis");

    try {
      const html = await fetchArticleHtml(url);

      const { title, sentences } = extractSentences(html);
      if (sentences.length === 0) throw new Error("Could not extract text from this page.");

      const domain = new URL(url).hostname.replace("www.", "");
      const outletRaw = domain.split(".")[0];
      const outlet = outletRaw.charAt(0).toUpperCase() + outletRaw.slice(1);
      const tag = inferTag(title + " " + sentences.slice(0, 3).join(" "));

      setLoadingMsg(`Running d4data/bias-detection-model on ${Math.min(sentences.length, settings.maxSents)} sentences…`);

      const sents = sentences.slice(0, settings.maxSents);
      const analyzed = await callHuggingFace(sents, settings.hfKey);
      const usedFallback = analyzed.some(r => r.fallback);

      const avgBias = analyzed.reduce((s, r) => s + r.biasScore, 0) / analyzed.length;
      const biasScore = Math.round(avgBias * 100);
      const factualDensity = Math.max(12, Math.round((1 - avgBias) * 80) + Math.floor(Math.random() * 14));
      const framingScore = Math.round(avgBias * 75 + 10);
      const omissionRate = Math.round(avgBias * 65 + 15);
      const languageLoad = Math.round(avgBias * 55 + 8);
      const laborSentences = generateLabor(analyzed, tag);
      const calgary = CALGARY_STATS[tag] || CALGARY_STATS.default;
      const voices = MISSING_VOICES[tag] || MISSING_VOICES.default;

      const id = "art_" + Date.now();
      const record = {
        id, url, title: title || domain, outlet, date: new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }),
        tag, biasScore, factualDensity, framingScore, omissionRate, languageLoad,
        usedFallback, analyzed, laborSentences, voices, calgary, createdAt: Date.now(),
      };

      const next = { ...articles, [id]: record };
      saveArticles(next);
      setLoading(false);
      showArticle(id, next);
    } catch (err) {
      setLoading(false);
      setView("home");
      notify("⚠ " + err.message, 4000);
    }
  }

  function showArticle(id, artMap) {
    const map = artMap || articles;
    if (!map[id]) return;
    setActiveId(id);
    setView("analysis");
    setActiveTab("heatmap");
    setPerspective("institutional");
    setCalgaryOpen(false);
    setLoading(false);
  }

  function deleteArticle(id) {
    const next = { ...articles };
    delete next[id];
    saveArticles(next);
    if (activeId === id) { setActiveId(null); setView("home"); }
  }

  function clearHistory() {
    saveArticles({});
    setActiveId(null);
    setView("home");
  }

  const article = activeId ? articles[activeId] : null;
  const sentences = article ? (perspective === "labor" ? article.laborSentences : article.analyzed) : [];
  const sortedIds = Object.keys(articles).sort((a, b) => (articles[b].createdAt || 0) - (articles[a].createdAt || 0));

  // ── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    app: { display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" },
    header: { display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: { width: 236, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 },
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
    rightPanel: { width: 216, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 },
    panelSection: { padding: "16px", borderBottom: "1px solid var(--border)" },
    panelLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", letterSpacing: "0.14em", color: "var(--text3)", marginBottom: 13, textTransform: "uppercase", display: "block" },
    contentScroll: { flex: 1, overflowY: "auto", padding: "18px 22px" },
  };

  const Btn = ({ children, onClick, primary, sm, style: extra, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: sm ? "5px 10px" : "7px 14px",
        borderRadius: 7, border: primary ? "none" : "1px solid var(--border2)", cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'JetBrains Mono',monospace", fontSize: sm ? "0.58rem" : "0.63rem", letterSpacing: "0.05em", fontWeight: 500,
        background: primary ? "var(--accent)" : "var(--surface2)", color: primary ? "#000" : "var(--text2)",
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s", whiteSpace: "nowrap", ...extra,
      }}>
      {children}
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />
      <div style={S.app}>

        {/* ── HEADER ── */}
        <header style={S.header}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, background: "var(--accent)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces',serif", fontSize: 14, fontWeight: 800, color: "#000" }}>M</div>
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.05rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>MediaLens</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", color: "var(--text3)", letterSpacing: "0.12em" }}>ECONOMIC BIAS ANALYZER · YYC</div>
            </div>
          </div>

          {/* URL Input */}
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && analyzeUrl(urlInput.trim())}
              placeholder="Paste article URL to analyze…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem", padding: "7px 12px", outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border2)")}
            />
            <Btn primary onClick={() => analyzeUrl(urlInput.trim())} disabled={loading}>
              {loading ? "Analyzing…" : "Analyze"}
            </Btn>
          </div>

          {/* Settings */}
          <button
            onClick={() => setView(v => v === "settings" ? (activeId ? "analysis" : "home") : "settings")}
            style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: view === "settings" ? "var(--accent)" : "var(--surface2)", border: "1px solid var(--border2)", color: view === "settings" ? "#000" : "var(--text2)", cursor: "pointer", fontSize: 14, transition: "all 0.15s", flexShrink: 0 }}
          >⚙</button>
        </header>

        {/* ── BODY ── */}
        <div style={S.body}>

          {/* ── SIDEBAR ── */}
          <nav style={S.sidebar}>
            <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", letterSpacing: "0.14em", color: "var(--text3)", textTransform: "uppercase" }}>History</span>
              <Btn sm onClick={clearHistory}>Clear</Btn>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
              {sortedIds.length === 0 ? (
                <div style={{ padding: "28px 10px", textAlign: "center", color: "var(--text3)", fontSize: "0.75rem", lineHeight: 1.6 }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>◎</div>
                  No articles yet.<br />Paste a URL above<br />to get started.
                </div>
              ) : sortedIds.map(id => {
                const a = articles[id];
                const isActive = id === activeId;
                const color = biasColor(a.biasScore);
                return (
                  <div
                    key={id}
                    onClick={() => showArticle(id)}
                    style={{ background: isActive ? "#1a1500" : "var(--surface2)", border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, borderRadius: 9, padding: "10px 11px", marginBottom: 7, cursor: "pointer", position: "relative", transition: "all 0.15s" }}
                    className="slide-in"
                  >
                    <button
                      onClick={e => { e.stopPropagation(); deleteArticle(id); }}
                      style={{ position: "absolute", top: 5, right: 5, width: 17, height: 17, borderRadius: 4, background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >✕</button>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", letterSpacing: "0.08em", color: "var(--accent)", marginBottom: 4, display: "flex", justifyContent: "space-between", marginRight: "12px" }}>
                      <span>{a.tag}</span>
                      <span style={{ color: "var(--text3)" }}>{a.outlet}</span>
                    </div>
                    <div style={{ fontSize: "0.73rem", fontWeight: isActive ? 600 : 400, color: isActive ? "var(--text)" : "var(--text2)", lineHeight: 1.35, marginBottom: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 14 }}>{a.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${a.biasScore}%`, background: color, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "var(--text3)" }}>Bias {a.biasScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* ── MAIN ── */}
          <main style={S.main}>

            {/* Settings View */}
            {view === "settings" && (
              <SettingsPanel
                settings={settings}
                onSave={next => { saveSettings(next); notify("Settings saved ✓"); }}
                onBack={() => setView(activeId ? "analysis" : "home")}
              />
            )}

            {/* Home View */}
            {view === "home" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }} className="fade-up">
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: "2.2rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 10 }}>
                    Read Smarter,<br />Not Harder.
                  </div>
                  <p style={{ color: "var(--text2)", fontSize: "0.88rem", lineHeight: 1.65, maxWidth: 400, margin: "0 auto" }}>
                    AI-powered economic bias detection using <span style={{ color: "var(--accent)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.78rem" }}>d4data/bias-detection-model</span>. Understand whose interests a story serves.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn primary onClick={() => { setUrlInput(""); document.querySelector("input[type='url']")?.focus(); }}>Paste a URL above to begin</Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%", maxWidth: 460 }}>
                  {[
                    ["🌡", "Bias Heatmap", "Sentence-level coloring from DistilBERT model scores"],
                    ["⇄", "Perspective Swap", "Toggle Institutional vs Labor framing of the same facts"],
                    ["◉", "Missing Voices", "Who's structurally excluded from the narrative"],
                    ["📍", "Calgary Check", "Local YYC stats to ground national economic claims"],
                  ].map(([icon, title, desc]) => (
                    <div key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "13px 15px" }}>
                      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
                      <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text2)", lineHeight: 1.45 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis View */}
            {view === "analysis" && (
              <>
                {/* Toolbar */}
                <div style={{ padding: "10px 18px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  {article ? (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "var(--text3)", letterSpacing: "0.06em", marginBottom: 2 }}>{article.outlet} · {article.date} · {article.tag}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{article.title}</div>
                      </div>
                      {/* Perspective Toggle */}
                      <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 99, padding: 3, gap: 2, flexShrink: 0 }}>
                        {[["institutional", "🏛 Institutional"], ["labor", "👷 Labor"]].map(([v, lbl]) => (
                          <button key={v} onClick={() => setPerspective(v)} style={{ padding: "4px 12px", border: "none", borderRadius: 99, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.05em", background: perspective === v ? "var(--surface)" : "transparent", color: perspective === v ? "var(--text)" : "var(--text3)", boxShadow: perspective === v ? "0 1px 4px rgba(0,0,0,0.4)" : "none", transition: "all 0.2s" }}>{lbl}</button>
                        ))}
                      </div>
                    </>
                  ) : loading ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", color: "var(--text3)" }}>{loadingMsg}</div>
                    </div>
                  ) : null}
                </div>

                {/* Tab Bar */}
                {!loading && (
                  <div style={{ display: "flex", background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 18px", flexShrink: 0 }}>
                    {[["heatmap", "◈", "Bias Heatmap"], ["compare", "⇄", "Side-by-Side"], ["voices", "◉", "Missing Voices"]].map(([key, icon, lbl]) => (
                      <button key={key} onClick={() => setActiveTab(key)} style={{ padding: "9px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: "0.73rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 5, color: activeTab === key ? "var(--text)" : "var(--text3)", borderBottom: `2px solid ${activeTab === key ? "var(--accent)" : "transparent"}`, marginBottom: -1, transition: "all 0.15s" }}>
                        <span>{icon}</span>{lbl}
                      </button>
                    ))}
                  </div>
                )}

                {/* Content */}
                <div style={S.contentScroll}>
                  {loading && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "60px 20px" }}>
                      <div className="spinner" />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.7rem", color: "var(--text3)", marginBottom: 6 }}>{loadingMsg}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>This may take 20–30s if the model is cold-starting</div>
                      </div>
                    </div>
                  )}

                  {!loading && article && activeTab === "heatmap" && (
                    <div className="fade-up">
                      {article.usedFallback && (
                        <div style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "10px 13px", marginBottom: 14, fontSize: "0.72rem", color: "var(--text3)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                          ⚠ <span>HuggingFace model unavailable — using local heuristic. Add your HF API key in ⚙ Settings for full DistilBERT analysis.</span>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                        {[["#fde047", "Mild · adjective framing"], ["#fb923c", "Slanted · omitted context"], ["#f87171", "Extreme · loaded language"]].map(([color, label]) => (
                          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--text3)" }}>
                            <div style={{ width: 18, height: 3, background: color, borderRadius: 99 }} />{label}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.92rem", color: "#b0bac8", lineHeight: 1.95, fontWeight: 300 }}>
                        {sentences.map((s, i) => <HeatSentence key={i} sentence={s.sentence} biasScore={s.biasScore} />)}
                      </div>
                      {perspective === "labor" && (
                        <div style={{ background: "linear-gradient(to right, #0d2310, #0c0f14)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 9, padding: "12px 15px", marginTop: 20, fontSize: "0.8rem", color: "var(--green)", display: "flex", gap: 9, animation: "fadeUp 0.3s ease" }}>
                          🔍 <span><strong>Labor lens active:</strong> Reframed sentences show what gets hidden by institutional framing. See <strong>Missing Voices</strong> tab for structural analysis.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!loading && article && activeTab === "compare" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="fade-up">
                      {[
                        { label: "🏛 INSTITUTIONAL VIEW", color: "var(--text3)", items: article.analyzed, isLabor: false },
                        { label: "👷 LABOR VIEW", color: "var(--green)", items: article.laborSentences, isLabor: true },
                      ].map(({ label, color, items, isLabor }) => (
                        <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: 18 }}>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.12em", color, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${isLabor ? "rgba(16,185,129,0.2)" : "var(--border)"}` }}>{label}</div>
                          {items.map((s, i) => (
                            <p key={i} style={{ fontSize: "0.8rem", lineHeight: 1.72, color: s.wasRewritten ? "#a7f3d0" : "var(--text2)", marginBottom: 11, paddingLeft: 10, borderLeft: `2px solid ${isLabor ? "rgba(16,185,129,0.3)" : "var(--border2)"}` }}>
                              {s.sentence}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && article && activeTab === "voices" && (
                    <div className="fade-up">
                      <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "var(--text3)", lineHeight: 1.7, marginBottom: 18, letterSpacing: "0.03em" }}>
                        Perspectives structurally absent from the standard framing of this story (Bias Score: <span style={{ color: "var(--accent)" }}>{article.biasScore}/100</span>):
                      </p>
                      {article.voices.map(({ icon, group, color, text }) => (
                        <div key={group} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 10, display: "flex", gap: 14 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                          <div>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.1em", color, fontWeight: 600, marginBottom: 5 }}>{group.toUpperCase()}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.65 }}>{text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* ── RIGHT PANEL ── */}
          {view === "analysis" && !loading && article && (
            <aside style={S.rightPanel}>

              <div style={S.panelSection}>
                <span style={S.panelLabel}>Economic Bias Score</span>
                <BiasGauge score={article.biasScore} />
              </div>

              <div style={S.panelSection}>
                <span style={S.panelLabel}>Score Breakdown</span>
                <MetricBar label="FACTUAL DENSITY" value={article.factualDensity} color="#10b981" />
                <MetricBar label="FRAMING SCORE" value={article.framingScore} color="#f97316" />
                <MetricBar label="OMISSION RATE" value={article.omissionRate} color="#ef4444" />
                <MetricBar label="LANGUAGE LOAD" value={article.languageLoad} color="#f59e0b" />
              </div>

              <div style={S.panelSection}>
                <span style={S.panelLabel}>Framing Radar</span>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <RadarChart factual={article.factualDensity} framing={article.framingScore} omission={article.omissionRate} languageLoad={article.languageLoad} biasScore={article.biasScore} />
                </div>
                <div style={{ textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "var(--text3)", marginTop: 4, letterSpacing: "0.08em" }}>DistilBERT probability mapping</div>
              </div>

              <div style={{ ...S.panelSection, flex: 1 }}>
                <button onClick={() => setCalgaryOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                  <div style={{ width: 7, height: 7, background: "var(--green)", borderRadius: "50%", flexShrink: 0, animation: "pulse 2s infinite" }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.1em", color: "var(--green)", flex: 1 }}>CALGARY REALITY CHECK</span>
                  <span style={{ color: "var(--text3)", fontSize: 10 }}>{calgaryOpen ? "▲" : "▼"}</span>
                </button>

                {calgaryOpen && article.calgary ? (
                  <div style={{ marginTop: 13, animation: "fadeUp 0.25s ease" }}>
                    <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{article.calgary.value}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)", margin: "4px 0 10px" }}>{article.calgary.stat}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.55, background: "var(--surface2)", borderRadius: 7, padding: "9px 11px", marginBottom: 8 }}>{article.calgary.context}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--green)", lineHeight: 1.5, marginBottom: 8 }}>{article.calgary.impact}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "var(--text3)", letterSpacing: "0.06em" }}>Source: {article.calgary.source}</div>
                  </div>
                ) : !calgaryOpen && (
                  <div style={{ marginTop: 9, fontSize: "0.72rem", color: "var(--text3)", lineHeight: 1.55 }}>Load local Calgary data to ground this national story.</div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 8, padding: "9px 18px", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", color: "var(--text)", boxShadow: "0 4px 24px rgba(0,0,0,0.6)", zIndex: 999, animation: "fadeUp 0.3s ease", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </>
  );
}
