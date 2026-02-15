// App.jsx
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
const NEWS_API_TOKEN = "0p7kzhfSk4waHAS9kvNtsAIbLOaobEgPgnDDkrJG";
const NEWS_API_BASE = "https://thenewsapi.com/v2/news";
const HF_MODEL = "https://api-inference.huggingface.co/models/d4data/bias-detection-model";
const STORAGE_KEY = "medialens_articles";
const SETTINGS_KEY = "medialens_settings";

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

// Fetch news articles from The News API
async function fetchNewsArticles(query = "economy OR business OR finance", limit = 10) {
  const url = new URL(NEWS_API_BASE);
  url.searchParams.append("token", NEWS_API_TOKEN);
  url.searchParams.append("search", query);
  url.searchParams.append("language", "en");
  url.searchParams.append("limit", limit);
  url.searchParams.append("sort", "published_desc");

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
}

// Search articles by URL or get article details
async function fetchArticleByUrl(url) {
  const urlObj = new URL(NEWS_API_BASE);
  urlObj.searchParams.append("token", NEWS_API_TOKEN);
  urlObj.searchParams.append("url", url);

  try {
    const res = await fetch(urlObj);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.data?.[0] || null;
  } catch (error) {
    console.error("Error fetching article by URL:", error);
    throw error;
  }
}

// Classify text using Hugging Face model
async function classifyWithHF(texts, apiKey, onProgress) {
  const headers = { 
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  };
  
  const results = [];
  const batchSize = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (text) => {
      try {
        const res = await fetch(HF_MODEL, { 
          method: "POST", 
          headers, 
          body: JSON.stringify({ 
            inputs: text,
            options: { wait_for_model: true }
          })
        });
        
        if (res.status === 503) {
          return { text, biasScore: 0.5, fallback: true, error: "Model loading" };
        }
        if (!res.ok) {
          return { text, biasScore: 0.5, fallback: true, error: `HTTP ${res.status}` };
        }
        
        const data = await res.json();
        
        // Parse model output
        let biasScore = 0.5;
        if (Array.isArray(data)) {
          if (Array.isArray(data[0])) {
            const biased = data[0].find(d => d.label?.toLowerCase().includes('bias') || d.label === 'LABEL_1');
            if (biased) biasScore = biased.score;
          } else {
            const biased = data.find(d => d.label?.toLowerCase().includes('bias') || d.label === 'LABEL_1');
            if (biased) biasScore = biased.score;
          }
        }
        
        return { text, biasScore, fallback: false };
      } catch (error) {
        return { text, biasScore: 0.5, fallback: true, error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.min(100, Math.round((i + batchSize) / texts.length * 100)));
    }
  }

  return results;
}

// Calculate bias metrics from classifications
function calculateMetrics(classified) {
  const scores = classified.map(c => c.biasScore);
  const avgBias = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  const factualDensity = Math.round(classified.filter(c => c.biasScore < 0.4).length / classified.length * 100);
  const framingScore = Math.round(classified.filter(c => c.biasScore >= 0.4 && c.biasScore < 0.7).length / classified.length * 100);
  const omissionRate = Math.round(classified.filter(c => c.biasScore >= 0.7).length / classified.length * 100);
  const languageLoad = Math.round(classified.filter(c => c.biasScore > 0.8).length / classified.length * 100);
  
  return {
    biasScore: Math.round(avgBias * 100),
    factualDensity,
    framingScore,
    omissionRate,
    languageLoad,
    sentenceCount: classified.length,
    fallbackUsed: classified.some(c => c.fallback)
  };
}

// Split text into sentences
function splitSentences(text) {
  if (!text) return [];
  
  // Clean the text
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]+\]/g, '') // Remove citations
    .trim();
  
  // Split by sentence boundaries
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  
  // Filter for meaningful sentences
  return sentences
    .map(s => s.trim())
    .filter(s => 
      s.length > 40 && 
      s.length < 300 && 
      s.split(' ').length > 5 &&
      !s.match(/^(photo|image|figure|table|source|credit|advertisement|cookie)/i)
    );
}

// Generate alternative perspective
function generateAlternativePerspective(classified) {
  return classified.map(item => {
    let alternative = item.text;
    
    // Simple perspective shifting for demonstration
    if (item.biasScore > 0.6) {
      const shifts = [
        { from: /\b(market|investor|shareholder)s?\b/gi, to: 'worker' },
        { from: /\b(profit|gain|return)s?\b/gi, to: 'wage' },
        { from: /\b(growth|expansion)\b/gi, to: 'stability' },
        { from: /\b(confidence|optimism)\b/gi, to: 'security' },
        { from: /\b(efficient|productive)\b/gi, to: 'fair' },
        { from: /\b(benefits?|advantage)s?\b/gi, to: 'impact' },
        { from: /\b(positive|negative)\b/gi, to: 'different' },
      ];
      
      shifts.forEach(({ from, to }) => {
        alternative = alternative.replace(from, to);
      });
    }
    
    return {
      ...item,
      alternative,
      wasShifted: alternative !== item.text
    };
  });
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

function HeatSentence({ sentence, biasScore }) {
  const [tip, setTip] = useState(false);
  let cls = null, tipText = "";
  if (biasScore >= 0.75) { 
    cls = { bg: "rgba(248,113,113,0.18)", border: "#f87171" }; 
    tipText = `Extreme Bias · ${Math.round(biasScore * 100)}% — Loaded language, emotional framing`; 
  }
  else if (biasScore >= 0.5) { 
    cls = { bg: "rgba(251,146,60,0.15)", border: "#fb923c" }; 
    tipText = `High Bias · ${Math.round(biasScore * 100)}% — Omitted context, selective framing`; 
  }
  else if (biasScore >= 0.3) { 
    cls = { bg: "rgba(253,224,71,0.12)", border: "#fde047" }; 
    tipText = `Mild Bias · ${Math.round(biasScore * 100)}% — Subjective adjectives`; 
  } else {
    tipText = `Low Bias · ${Math.round(biasScore * 100)}% — Factual statement`;
  }

  return (
    <span
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
      style={{ 
        position: "relative", 
        display: "inline", 
        background: cls ? cls.bg : "transparent", 
        borderBottom: cls ? `2px solid ${cls.border}` : "2px solid #10b981", 
        padding: "1px 3px", 
        borderRadius: 3, 
        cursor: "pointer", 
        lineHeight: 1.95,
        transition: "all 0.2s"
      }}
    >
      {sentence}{" "}
      {tip && (
        <span style={{ 
          position: "absolute", 
          bottom: "115%", 
          left: "50%", 
          transform: "translateX(-50%)", 
          background: "#0c0f14", 
          border: "1px solid var(--border2)", 
          color: "var(--text)", 
          fontSize: 11, 
          padding: "5px 10px", 
          borderRadius: 6, 
          whiteSpace: "nowrap", 
          zIndex: 50, 
          fontFamily: "'JetBrains Mono',monospace", 
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)", 
          pointerEvents: "none" 
        }}>
          {tipText}
        </span>
      )}
    </span>
  );
}

function ArticleCard({ article, onClick, isActive, onDelete }) {
  const color = biasColor(article.biasScore);
  
  return (
    <div
      onClick={onClick}
      style={{ 
        background: isActive ? "#1a1500" : "var(--surface2)", 
        border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, 
        borderRadius: 10, 
        padding: "14px", 
        marginBottom: 10, 
        cursor: "pointer", 
        position: "relative", 
        transition: "all 0.15s" 
      }}
      className="slide-in"
    >
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ 
          position: "absolute", top: 8, right: 8, 
          width: 20, height: 20, borderRadius: 4, 
          background: "transparent", border: "none", 
          color: "var(--text3)", cursor: "pointer", 
          fontSize: 10, display: "flex", 
          alignItems: "center", justifyContent: "center" 
        }}
      >✕</button>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--accent)", marginBottom: 6, display: "flex", justifyContent: "space-between", marginRight: 16 }}>
        <span>{article.source}</span>
        <span style={{ color: "var(--text3)" }}>{new Date(article.date).toLocaleDateString()}</span>
      </div>
      <div style={{ 
        fontSize: "0.8rem", 
        fontWeight: isActive ? 600 : 400, 
        color: isActive ? "var(--text)" : "var(--text2)", 
        lineHeight: 1.4, 
        marginBottom: 10, 
        display: "-webkit-box", 
        WebkitLineClamp: 2, 
        WebkitBoxOrient: "vertical", 
        overflow: "hidden" 
      }}>{article.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${article.biasScore}%`, background: color, borderRadius: 99 }} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--text3)" }}>Bias {article.biasScore}</span>
      </div>
    </div>
  );
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
function SettingsPanel({ settings, onSave, onBack }) {
  const [key, setKey] = useState(settings.hfKey || "");
  const [maxSents, setMaxSents] = useState(settings.maxSents || 15);
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
          <label style={S.label}>API Key (optional)</label>
          <input type="password" style={S.input} value={key} onChange={e => setKey(e.target.value)} placeholder="hf_xxxxxxxxxxxxxx" />
          <div style={S.hint}>Without a key, requests are rate-limited. Get a free key at huggingface.co/settings/tokens</div>
        </div>
      </div>

      <div style={S.group}>
        <span style={S.groupLabel}>Analysis</span>
        <div style={S.field}>
          <label style={S.label}>Max sentences to analyze (5–30)</label>
          <input type="number" style={{ ...S.input, maxWidth: 120 }} value={maxSents} min={5} max={30} onChange={e => setMaxSents(parseInt(e.target.value) || 15)} />
          <div style={S.hint}>More sentences = deeper analysis but slower processing.</div>
        </div>
      </div>

      <button style={{ ...S.btn, background: saved ? "var(--green)" : "var(--accent)", color: "#000", minWidth: 140 }} onClick={() => { onSave({ hfKey: key, maxSents }); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [articles, setArticles] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("home");
  const [activeTab, setActiveTab] = useState("heatmap");
  const [perspective, setPerspective] = useState("original");
  const [loading, setLoading] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [settings, setSettings] = useState({ hfKey: "", maxSents: 15 });
  const [searchQuery, setSearchQuery] = useState("economy OR business OR finance");
  const [newsResults, setNewsResults] = useState([]);
  const [showNewsBrowser, setShowNewsBrowser] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setArticles(JSON.parse(stored));
      
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

  // Search news
  async function searchNews() {
    setLoadingNews(true);
    setNewsResults([]);
    
    try {
      const results = await fetchNewsArticles(searchQuery, 20);
      setNewsResults(results);
      setShowNewsBrowser(true);
    } catch (error) {
      notify("⚠ Failed to fetch news: " + error.message);
    } finally {
      setLoadingNews(false);
    }
  }

  // Analyze article
  async function analyzeArticle(articleData) {
    setLoading(true);
    setProgress(0);
    setLoadingMsg("Preparing article for analysis...");
    setView("analysis");

    try {
      // Combine title and description for analysis
      const fullText = `${articleData.title}. ${articleData.description || ''} ${articleData.snippet || ''}`;
      const sentences = splitSentences(fullText);
      
      if (sentences.length === 0) {
        sentences.push(articleData.title);
      }

      setLoadingMsg(`Classifying with d4data/bias-detection-model...`);
      setProgress(30);

      const sentsToAnalyze = sentences.slice(0, settings.maxSents);
      const classified = await classifyWithHF(sentsToAnalyze, settings.hfKey, (p) => {
        setProgress(30 + Math.round(p * 0.5));
      });

      setProgress(80);
      setLoadingMsg("Calculating bias metrics...");

      const metrics = calculateMetrics(classified);
      const alternative = generateAlternativePerspective(classified);

      const id = "art_" + Date.now();
      const record = {
        id,
        url: articleData.url,
        title: articleData.title,
        source: articleData.source,
        date: articleData.published_at,
        author: articleData.author,
        image: articleData.image_url,
        ...metrics,
        classified,
        alternative,
        fullText,
        createdAt: Date.now(),
      };

      const next = { ...articles, [id]: record };
      saveArticles(next);
      
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setActiveId(id);
        setShowNewsBrowser(false);
      }, 500);
      
    } catch (err) {
      setLoading(false);
      notify("⚠ " + err.message, 4000);
    }
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
  const currentSentences = article ? (perspective === "alternative" ? article.alternative : article.classified) : [];
  const sortedIds = Object.keys(articles).sort((a, b) => (articles[b].createdAt || 0) - (articles[a].createdAt || 0));

  // Styles
  const S = {
    app: { display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" },
    header: { display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 },
    body: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: { width: 280, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 },
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
    rightPanel: { width: 280, background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 },
    panelSection: { padding: "20px", borderBottom: "1px solid var(--border)" },
    panelLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 15, textTransform: "uppercase" },
    contentScroll: { flex: 1, overflowY: "auto", padding: "24px" },
  };

  const Btn = ({ children, onClick, primary, sm, style: extra, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: sm ? "6px 12px" : "8px 16px",
        borderRadius: 8, border: primary ? "none" : "1px solid var(--border2)", 
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'JetBrains Mono',monospace", fontSize: sm ? "0.6rem" : "0.65rem", 
        letterSpacing: "0.05em", fontWeight: 500,
        background: primary ? "var(--accent)" : "var(--surface2)", 
        color: primary ? "#000" : "var(--text2)",
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s", whiteSpace: "nowrap", ...extra,
      }}>
      {children}
    </button>
  );

  return (
    <>
      <GlobalStyles />
      <div style={S.app}>

        {/* Header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, background: "var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 800, color: "#000" }}>M</div>
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.1rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>MediaLens</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "var(--text3)", letterSpacing: "0.1em" }}>BIAS DETECTION</div>
            </div>
          </div>

          {/* Search Input */}
          <div style={{ flex: 1, display: "flex", gap: 10, maxWidth: 700, margin: "0 auto" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchNews()}
              placeholder="Search for news (e.g., 'economy', 'inflation', 'housing')"
              style={{ 
                flex: 1, 
                background: "var(--bg)", 
                border: "1px solid var(--border2)", 
                borderRadius: 8, 
                color: "var(--text)", 
                fontFamily: "'JetBrains Mono',monospace", 
                fontSize: "0.7rem", 
                padding: "8px 14px", 
                outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border2)")}
            />
            <Btn primary onClick={searchNews} disabled={loadingNews}>
              {loadingNews ? "Searching..." : "Search"}
            </Btn>
          </div>

          {/* Settings */}
          <button
            onClick={() => setView(v => v === "settings" ? (activeId ? "analysis" : "home") : "settings")}
            style={{ 
              width: 36, height: 36, 
              display: "flex", alignItems: "center", justifyContent: "center", 
              borderRadius: 8, 
              background: view === "settings" ? "var(--accent)" : "var(--surface2)", 
              border: "1px solid var(--border2)", 
              color: view === "settings" ? "#000" : "var(--text2)", 
              cursor: "pointer", 
              fontSize: 16, 
              transition: "all 0.15s", 
              flexShrink: 0 
            }}
          >⚙</button>
        </header>

        {/* Body */}
        <div style={S.body}>

          {/* Sidebar - History */}
          <nav style={S.sidebar}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text3)", textTransform: "uppercase" }}>History</span>
              <Btn sm onClick={clearHistory}>Clear</Btn>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {sortedIds.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text3)", fontSize: "0.8rem", lineHeight: 1.6 }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📄</div>
                  No articles yet.<br />Search for news above.
                </div>
              ) : sortedIds.map(id => (
                <ArticleCard
                  key={id}
                  article={articles[id]}
                  isActive={id === activeId}
                  onClick={() => { setActiveId(id); setView("analysis"); setShowNewsBrowser(false); }}
                  onDelete={() => deleteArticle(id)}
                />
              ))}
            </div>
          </nav>

          {/* Main Content Area */}
          <main style={S.main}>

            {/* Settings View */}
            {view === "settings" && (
              <SettingsPanel
                settings={settings}
                onSave={next => { saveSettings(next); notify("Settings saved ✓"); }}
                onBack={() => setView(activeId ? "analysis" : "home")}
              />
            )}

            {/* News Browser */}
            {showNewsBrowser && !loading && (
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "1.5rem", marginBottom: 20 }}>Search Results</h2>
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                  {newsResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => analyzeArticle(item)}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 16,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        hover: { transform: "translateY(-2px)", borderColor: "var(--accent)" }
                      }}
                    >
                      {item.image_url && (
                        <img 
                          src={item.image_url} 
                          alt={item.title}
                          style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8, marginBottom: 12 }}
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--accent)", marginBottom: 8 }}>
                        {item.source}
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
                        {item.description?.substring(0, 120)}...
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>
                          {new Date(item.published_at).toLocaleDateString()}
                        </span>
                        <span style={{ fontSize: "0.65rem", color: "var(--accent)" }}>Click to analyze →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Home View */}
            {view === "home" && !showNewsBrowser && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: 40 }} className="fade-up">
                <div style={{ textAlign: "center", maxWidth: 600 }}>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: "2.5rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 16 }}>
                    Detect Media Bias<br />with AI
                  </div>
                  <p style={{ color: "var(--text2)", fontSize: "1rem", lineHeight: 1.7 }}>
                    Using <span style={{ color: "var(--accent)", fontFamily: "'JetBrains Mono',monospace" }}>d4data/bias-detection-model</span> to analyze news and reveal hidden perspectives.
                  </p>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 700 }}>
                  {[
                    ["🎯", "Sentence-Level Analysis", "Each sentence scored for bias using Hugging Face transformers"],
                    ["📊", "Bias Metrics", "Factual density, framing score, omission rate, language load"],
                    ["🔄", "Alternative View", "See how the same facts could be framed differently"],
                  ].map(([icon, title, desc]) => (
                    <div key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                      <div style={{ fontSize: 24, marginBottom: 12 }}>{icon}</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text2)", lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>

                <Btn primary onClick={() => searchNews()}>Browse Latest News</Btn>
              </div>
            )}

            {/* Analysis View */}
            {view === "analysis" && article && (
              <>
                {/* Article Header */}
                <div style={{ padding: "16px 24px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "var(--accent)" }}>{article.source}</span>
                      <span style={{ fontSize: "0.55rem", color: "var(--text3)" }}>•</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--text3)" }}>{new Date(article.date).toLocaleDateString()}</span>
                      {article.fallbackUsed && (
                        <>
                          <span style={{ fontSize: "0.55rem", color: "var(--text3)" }}>•</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--orange)" }}>⚠ Local fallback</span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>{article.title}</div>
                    {article.author && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>By {article.author}</div>
                    )}
                  </div>
                  
                  {/* Perspective Toggle */}
                  <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 99, padding: 4, gap: 2 }}>
                    {[["original", "📄 Original"], ["alternative", "🔄 Alternative"]].map(([v, lbl]) => (
                      <button 
                        key={v} 
                        onClick={() => setPerspective(v)} 
                        style={{ 
                          padding: "6px 16px", 
                          border: "none", 
                          borderRadius: 99, 
                          cursor: "pointer", 
                          fontFamily: "'JetBrains Mono',monospace", 
                          fontSize: "0.6rem", 
                          background: perspective === v ? "var(--surface)" : "transparent", 
                          color: perspective === v ? "var(--text)" : "var(--text3)", 
                          transition: "all 0.2s" 
                        }}
                      >{lbl}</button>
                    ))}
                  </div>
                </div>

                {/* Tab Bar */}
                <div style={{ display: "flex", background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", gap: 16, flexShrink: 0 }}>
                  {[
                    ["heatmap", "🔥", "Bias Heatmap"],
                    ["breakdown", "📊", "Breakdown"],
                    ["alternative", "🔄", "Alternative View"]
                  ].map(([key, icon, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      style={{
                        padding: "12px 0",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: activeTab === key ? "var(--text)" : "var(--text3)",
                        borderBottom: `2px solid ${activeTab === key ? "var(--accent)" : "transparent"}`,
                        marginBottom: -1,
                        transition: "all 0.15s"
                      }}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div style={S.contentScroll}>
                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "60px 20px" }}>
                      <div className="spinner" />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", color: "var(--text3)", marginBottom: 12 }}>{loadingMsg}</div>
                        <div style={{ width: 300, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", borderRadius: 99, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeTab === "heatmap" && (
                        <div className="fade-up">
                          <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap", background: "var(--surface)", padding: 16, borderRadius: 12 }}>
                            {[
                              ["#10b981", "Low Bias", "Factual statement"],
                              ["#fde047", "Mild Bias", "Subjective adjectives"],
                              ["#fb923c", "High Bias", "Omitted context"],
                              ["#f87171", "Extreme Bias", "Loaded language"]
                            ].map(([color, label, desc]) => (
                              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 20, height: 4, background: color, borderRadius: 99 }} />
                                <div>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "var(--text)" }}>{label}</span>
                                  <span style={{ fontSize: "0.55rem", color: "var(--text3)", marginLeft: 6 }}>{desc}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div style={{ fontSize: "0.95rem", color: "var(--text)", lineHeight: 2, fontWeight: 300 }}>
                            {currentSentences.map((s, i) => (
                              <HeatSentence key={i} sentence={s.text} biasScore={s.biasScore} />
                            ))}
                          </div>
                          
                          {perspective === "alternative" && (
                            <div style={{ 
                              background: "linear-gradient(to right, #0d2310, #0c0f14)", 
                              border: "1px solid rgba(16,185,129,0.2)", 
                              borderRadius: 10, 
                              padding: "16px 20px", 
                              marginTop: 24, 
                              fontSize: "0.85rem", 
                              color: "var(--green)", 
                              display: "flex", 
                              gap: 12 
                            }}>
                              🔄 <span><strong>Alternative perspective active:</strong> Showing how the same information might be framed from a different viewpoint.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === "breakdown" && (
                        <div style={{ display: "grid", gap: 24 }} className="fade-up">
                          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24 }}>
                            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: "1.2rem", marginBottom: 20 }}>Bias Analysis</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                              <MetricBar label="Factual Density" value={article.factualDensity} color="#10b981" />
                              <MetricBar label="Framing Score" value={article.framingScore} color="#f97316" />
                              <MetricBar label="Omission Rate" value={article.omissionRate} color="#ef4444" />
                              <MetricBar label="Language Load" value={article.languageLoad} color="#f59e0b" />
                            </div>
                            <div style={{ marginTop: 20, padding: 16, background: "var(--surface2)", borderRadius: 8 }}>
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", color: "var(--text3)", marginBottom: 8 }}>ANALYSIS SUMMARY</div>
                              <div style={{ fontSize: "0.9rem", color: "var(--text2)", lineHeight: 1.6 }}>
                                Analyzed {article.sentenceCount} sentences. Overall bias score: <strong style={{ color: biasColor(article.biasScore) }}>{article.biasScore}/100</strong> ({biasLabel(article.biasScore)}).
                                {article.factualDensity > 60 ? " High factual density." : " Moderate factual density."}
                                {article.framingScore > 50 ? " Significant framing detected." : " Minimal framing detected."}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "alternative" && (
                        <div className="fade-up">
                          <div style={{ display: "grid", gap: 20 }}>
                            {article.alternative.map((item, i) => (
                              <div key={i} style={{ 
                                background: "var(--surface)", 
                                borderRadius: 10, 
                                padding: 16,
                                borderLeft: `4px solid ${item.wasShifted ? "var(--green)" : "var(--border)"}`
                              }}>
                                <div style={{ display: "flex", gap: 16 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--text3)", marginBottom: 6 }}>ORIGINAL</div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.6 }}>{item.text}</div>
                                  </div>
                                  {item.wasShifted && (
                                    <>
                                      <div style={{ color: "var(--text3)", alignSelf: "center" }}>→</div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "var(--green)", marginBottom: 6 }}>ALTERNATIVE FRAME</div>
                                        <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6 }}>{item.alternative}</div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </main>

          {/* Right Panel - Metrics */}
          {view === "analysis" && !loading && article && (
            <aside style={S.rightPanel}>
              <div style={S.panelSection}>
                <span style={S.panelLabel}>Bias Score</span>
                <BiasGauge score={article.biasScore} />
              </div>

              <div style={S.panelSection}>
                <span style={S.panelLabel}>Metrics</span>
                <MetricBar label="Factual Density" value={article.factualDensity} color="#10b981" />
                <MetricBar label="Framing Score" value={article.framingScore} color="#f97316" />
                <MetricBar label="Omission Rate" value={article.omissionRate} color="#ef4444" />
                <MetricBar label="Language Load" value={article.languageLoad} color="#f59e0b" />
              </div>

              <div style={S.panelSection}>
                <span style={S.panelLabel}>Analysis</span>
                <div style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.7 }}>
                  <p>📊 {article.sentenceCount} sentences analyzed</p>
                  <p>🎯 Bias range: {Math.min(...article.classified.map(c => c.biasScore * 100).filter(s => s > 0))} - {Math.max(...article.classified.map(c => c.biasScore * 100))}</p>
                  <p>⚡ {article.fallbackUsed ? "Using local fallback" : "HF model results"}</p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{ 
          position: "fixed", 
          bottom: 24, 
          left: "50%", 
          transform: "translateX(-50%)", 
          background: "var(--surface)", 
          border: "1px solid var(--border2)", 
          borderRadius: 10, 
          padding: "12px 24px", 
          fontFamily: "'JetBrains Mono',monospace", 
          fontSize: "0.7rem", 
          color: "var(--text)", 
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", 
          zIndex: 999, 
          animation: "fadeUp 0.3s ease" 
        }}>
          {toast}
        </div>
      )}
    </>
  );
}