import { useState } from "react";

const FontLoader = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,800;1,9..144,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>
);

const ARTICLES = {
  rates: {
    id: "rates", outlet: "Financial Post", date: "Feb 14, 2026", tag: "Monetary Policy",
    title: "Bank of Canada Holds Rate at 3.25%",
    biasScore: 74, factualDensity: 62, framingScore: 78, omissionRate: 58, languageLoad: 44,
    institutional: [
      { text: "The Bank of Canada maintained its benchmark interest rate at 3.25% Wednesday, a decision widely praised by financial markets as prudent stewardship.", score: 0.55 },
      { text: "Major bank stocks surged following the announcement, with RBC and TD posting their strongest single-day gains in three months.", score: 0.32 },
      { text: "Economists noted the move signals confidence in inflation-control mechanisms and bodes well for the upcoming fiscal quarter.", score: 0.76 },
      { text: "The central bank cited strong employment figures and robust GDP growth as key factors in its decision.", score: 0.48 },
      { text: "Analysts from Bay Street unanimously welcomed the policy continuity, calling it a win for economic stability.", score: 0.88 },
    ],
    labor: [
      { text: "The Bank of Canada held rates at 3.25% Wednesday — providing no relief to Canadians carrying record mortgage debt into another quarter.", score: 0.55 },
      { text: "Bank stocks surged, but Calgary homeowners will continue paying $2,200 more annually in interest than they were in 2021.", score: 0.32 },
      { text: "Economists praised inflation control, though real wages have declined 4.3% when adjusted for inflation since the rate cycle began.", score: 0.76 },
      { text: "The Bank cited strong employment figures — excluding 140,000 Canadians who left the workforce entirely and are no longer counted.", score: 0.48 },
      { text: "Bay Street welcomed continuity; tenant advocacy groups called it 'another quarter of inaction' on housing affordability.", score: 0.88 },
    ],
    voices: [
      { icon: "🏠", group: "Calgary Renters", color: "#0ea5e9", text: "Average Calgary rent hit $1,920/month in Jan 2026 — up 31% since 2021. The rate hold means no cost relief flows to the 124,000 renter households already spending 30%+ of income on housing." },
      { icon: "⚙️", group: "Gig Workers", color: "#f59e0b", text: "Alberta's 18% gig workforce has no EI access and is structurally excluded from 'strong employment' statistics. Their income volatility makes rate stability meaningless without social floors." },
      { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "First Nations in Treaty 7 territory face 24% unemployment. Monetary policy benefits flow through home equity and institutional investment — channels structurally inaccessible to this population." },
    ],
    calgary: { stat: "Mortgage delinquency rate", value: "0.41%", context: "Up 38% year-over-year — highest since the 2016 oil crash", source: "CMHC Q4 2025 Report" },
  },
  housing: {
    id: "housing", outlet: "Calgary Herald", date: "Feb 12, 2026", tag: "Real Estate",
    title: "Calgary Housing Market Sees 'Healthy Correction'",
    biasScore: 68, factualDensity: 55, framingScore: 71, omissionRate: 63, languageLoad: 52,
    institutional: [
      { text: "Calgary's real estate market experienced a healthy correction in January, with benchmark prices falling 3.2% from their October peak.", score: 0.68 },
      { text: "Real estate professionals described the adjustment as a normalization after years of pandemic-driven demand.", score: 0.72 },
      { text: "Inventory levels rose to 4.2 months of supply, approaching the balanced market threshold of 5–6 months.", score: 0.22 },
      { text: "Analysts from major brokerages expect a soft landing as the spring market approaches, with renewed buyer confidence anticipated.", score: 0.6 },
      { text: "The City's economic development office highlighted the resilience of Alberta's diversified economy as a stabilizing force.", score: 0.5 },
    ],
    labor: [
      { text: "Calgary prices fell 3.2% in January — a minor correction after a 48% run-up since 2020 that locked out an entire generation of buyers.", score: 0.68 },
      { text: "Real estate brokers called it a 'normalization' — the same firms that projected 12% annual gains through 2026 just eight months ago.", score: 0.72 },
      { text: "Inventory rose to 4.2 months, but 67% of new listings are priced above $600,000 — beyond reach of Calgary's $98,000 median household income.", score: 0.22 },
      { text: "Analysts predict a 'spring recovery' — language that historically correlates with renewed upward pressure on first-time buyers.", score: 0.6 },
      { text: "The 'diversified economy' framing omits that 34% of Calgary jobs added since 2022 are in temporary or contract roles with no benefits.", score: 0.5 },
    ],
    voices: [
      { icon: "🏠", group: "Calgary Renters", color: "#0ea5e9", text: "Of 124,000 Calgary renter households, 41% exceed the federal 30% affordability threshold. A 3.2% price correction has zero impact on their monthly costs." },
      { icon: "🔨", group: "Construction Workers", color: "#f59e0b", text: "1 in 5 Calgary construction workers now commutes from Airdrie or Cochrane — priced out of the city they're building. The 'correction' doesn't reach them." },
      { icon: "🌿", group: "Indigenous Communities", color: "#8b5cf6", text: "Urban Indigenous housing orgs report zero vacancy in Calgary's 847 Indigenous-specific affordable units. The broader market correction is statistically irrelevant to this population." },
    ],
    calgary: { stat: "First-time buyer affordability gap", value: "$156K", context: "Gap between income-qualified mortgage and median home price in Feb 2026", source: "Open Calgary Housing Dashboard" },
  },
};

function BiasGauge({ score }) {
  const r = 52, cx = 70, cy = 68;
  const pct = score / 100;
  const angle = Math.PI * pct;
  const px = cx + r * Math.cos(Math.PI - angle);
  const py = cy - r * Math.sin(angle);
  const color = score < 35 ? "#22c55e" : score < 60 ? "#f59e0b" : score < 80 ? "#f97316" : "#ef4444";
  const label = score < 35 ? "Low" : score < 60 ? "Moderate" : score < 80 ? "High" : "Extreme";
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg viewBox="0 0 140 82" style={{ width: 140, height: 82 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${px} ${py}`} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        <circle cx={px} cy={py} r={5} fill={color} />
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#0f172a" style={{ fontSize: 22, fontFamily: "'Fraunces',serif", fontWeight: 800 }}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill={color} style={{ fontSize: 8.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function Radar({ factual, framing }) {
  const cx = 85, cy = 85, r = 58;
  const axes = [
    { label: "Factual", val: factual / 100 },
    { label: "Neutral", val: 0.62 },
    { label: "Context", val: 0.48 },
    { label: "Framing", val: framing / 100 },
    { label: "Language", val: 0.71 },
  ];
  const n = axes.length;
  const pts = axes.map((a, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + r * a.val * Math.cos(angle), y: cy + r * a.val * Math.sin(angle), lx: cx + (r + 18) * Math.cos(angle), ly: cy + (r + 18) * Math.sin(angle) };
  });
  const grids = [0.25, 0.5, 0.75, 1].map(lv =>
    axes.map((_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return `${cx + r * lv * Math.cos(a)},${cy + r * lv * Math.sin(a)}`; }).join(" ")
  );
  return (
    <svg viewBox="0 0 170 170" style={{ width: "100%", maxWidth: 170 }}>
      {grids.map((g, i) => <polygon key={i} points={g} fill={i === 3 ? "rgba(20,184,166,0.04)" : "none"} stroke="#f1f5f9" strokeWidth="1" />)}
      {axes.map((_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#f1f5f9" strokeWidth="1" />; })}
      <polygon points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(20,184,166,0.12)" stroke="#14b8a6" strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#14b8a6" />)}
      {pts.map((p, i) => <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" style={{ fontSize: 8, fontFamily: "'JetBrains Mono',monospace" }}>{axes[i].label}</text>)}
    </svg>
  );
}

function MetricBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: "#94a3b8", letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", color: "#334155", fontWeight: 500 }}>{value}</span>
      </div>
      <div style={{ height: 5, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </div>
    </div>
  );
}

function HeatSentence({ text, score }) {
  const [tip, setTip] = useState(false);
  const bias = score < 0.35 ? null : score < 0.55 ? { bg: "#fef9c3", line: "#fde047", label: "Mild — adjective framing" } : score < 0.75 ? { bg: "#ffedd5", line: "#fb923c", label: "Slanted — omitted context" } : { bg: "#fee2e2", line: "#f87171", label: "Extreme — loaded language" };
  return (
    <span
      onMouseEnter={() => bias && setTip(true)}
      onMouseLeave={() => setTip(false)}
      style={{ position: "relative", background: bias ? bias.bg : "transparent", borderBottom: bias ? `2px solid ${bias.line}` : "none", padding: bias ? "1px 3px" : 0, borderRadius: 3, cursor: bias ? "pointer" : "default", lineHeight: 1.95, display: "inline" }}
    >
      {text}{" "}
      {tip && bias && (
        <span style={{ position: "absolute", bottom: "115%", left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", fontSize: 11, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 20, fontFamily: "'JetBrains Mono',monospace", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {bias.label}
        </span>
      )}
    </span>
  );
}

export default function App() {
  const [articleId, setArticleId] = useState("rates");
  const [view, setView] = useState("institutional");
  const [tab, setTab] = useState("heatmap");
  const [calgary, setCalgary] = useState(false);
  const [fading, setFading] = useState(false);

  const a = ARTICLES[articleId];
  const content = view === "institutional" ? a.institutional : a.labor;

  const switchView = (v) => { setFading(true); setTimeout(() => { setView(v); setFading(false); }, 150); };
  const switchArticle = (id) => { setFading(true); setCalgary(false); setTimeout(() => { setArticleId(id); setFading(false); }, 150); };

  const S = {
    app: { display: "grid", gridTemplateColumns: "256px 1fr 288px", height: "100vh", width: "100vw", overflow: "hidden", fontFamily: "'Outfit',sans-serif", color: "#0f172a", background: "#f8fafc" },

    // nav
    nav: { background: "#fff", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", overflow: "hidden" },
    navBrand: { padding: "24px 20px 18px", borderBottom: "1px solid #f1f5f9" },
    brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 3 },
    brandMark: { width: 32, height: 32, background: "#0f172a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Fraunces',serif", fontSize: 14, fontWeight: 800, flexShrink: 0 },
    brandName: { fontFamily: "'Fraunces',serif", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" },
    brandSub: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#94a3b8", letterSpacing: "0.1em" },
    navBody: { flex: 1, overflowY: "auto", padding: "16px 12px 12px" },
    navSectionLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.14em", color: "#cbd5e1", padding: "0 8px", marginBottom: 8, display: "block", textTransform: "uppercase" },
    navFooter: { padding: 14, borderTop: "1px solid #f1f5f9", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#cbd5e1", textAlign: "center", letterSpacing: "0.08em" },

    // main
    main: { background: "#f8fafc", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
    toolbar: { background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "0 28px", display: "flex", alignItems: "center", gap: 16, height: 58, flexShrink: 0 },
    tabBar: { background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "0 28px", display: "flex", alignItems: "center", flexShrink: 0 },
    contentScroll: { flex: 1, overflowY: "auto", padding: 28 },

    // right panel
    panel: { background: "#fff", borderLeft: "1px solid #f1f5f9", display: "flex", flexDirection: "column", overflowY: "auto" },
    panelSection: { padding: "20px 18px", borderBottom: "1px solid #f1f5f9" },
    panelLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.14em", color: "#94a3b8", marginBottom: 14, textTransform: "uppercase", display: "block" },
  };

  return (
    <>
      <FontLoader />
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;width:100%;overflow:hidden;background:#f8fafc}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:99px}
        @keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}
      `}</style>

      <div style={S.app}>

        {/* NAV */}
        <nav style={S.nav}>
          <div style={S.navBrand}>
            <div style={S.brandRow}>
              <div style={S.brandMark}>M</div>
              <span style={S.brandName}>MediaLens</span>
            </div>
            <div style={S.brandSub}>ECONOMIC BIAS ANALYZER · YYC</div>
          </div>
          <div style={S.navBody}>
            <span style={S.navSectionLabel}>Articles</span>
            {Object.values(ARTICLES).map((art) => {
              const sc = art.biasScore < 40 ? "#22c55e" : art.biasScore < 65 ? "#f59e0b" : "#ef4444";
              const isActive = articleId === art.id;
              return (
                <button key={art.id} onClick={() => switchArticle(art.id)} style={{
                  width: "100%", textAlign: "left", background: isActive ? "#f0fdf4" : "transparent",
                  border: `1px solid ${isActive ? "#bbf7d0" : "transparent"}`, borderRadius: 10,
                  padding: "12px 12px", marginBottom: 6, cursor: "pointer", transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", letterSpacing: "0.08em", color: "#22c55e", background: isActive ? "#dcfce7" : "#f0fdf4", border: "1px solid #bbf7d0", padding: "1px 6px", borderRadius: 99 }}>{art.tag}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#94a3b8" }}>{art.outlet}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", fontWeight: isActive ? 600 : 500, color: isActive ? "#0f172a" : "#334155", lineHeight: 1.35, marginBottom: 8 }}>{art.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 3, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${art.biasScore}%`, background: sc, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#94a3b8" }}>Bias {art.biasScore}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={S.navFooter}>v2.1 BETA · CALGARY EDITION</div>
        </nav>

        {/* MAIN */}
        <main style={S.main}>
          {/* Toolbar */}
          <div style={S.toolbar}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 2 }}>{a.outlet} · {a.date}</div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
            </div>

            {/* Perspective toggle */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 99, padding: 3, gap: 2, flexShrink: 0 }}>
              {[["institutional", "🏛 Institutional"], ["labor", "👷 Labor"]].map(([v, lbl]) => (
                <button key={v} onClick={() => switchView(v)} style={{
                  padding: "6px 14px", border: "none", borderRadius: 99, cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: "0.63rem", letterSpacing: "0.06em",
                  background: view === v ? "#fff" : "transparent",
                  color: view === v ? "#0f172a" : "#64748b",
                  boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div style={S.tabBar}>
            {[["heatmap", "◈", "Bias Heatmap"], ["compare", "⇄", "Side-by-Side"], ["voices", "◉", "Missing Voices"]].map(([key, icon, lbl]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: "0.77rem", fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
                color: tab === key ? "#0f172a" : "#94a3b8",
                borderBottom: `2px solid ${tab === key ? "#0f172a" : "transparent"}`,
                marginBottom: -1, transition: "all 0.15s",
              }}><span>{icon}</span>{lbl}</button>
            ))}
          </div>

          {/* Content */}
          <div style={S.contentScroll}>

            {tab === "heatmap" && (
              <>
                <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
                  {[["#fde047", "Mild · adjective framing"], ["#fb923c", "Slanted · omitted context"], ["#f87171", "Extreme · loaded language"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "#64748b", fontFamily: "'JetBrains Mono',monospace" }}>
                      <div style={{ width: 18, height: 4, background: color, borderRadius: 99 }} />{label}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: "0.95rem", color: "#334155", lineHeight: 1.9, fontWeight: 300, opacity: fading ? 0 : 1, transition: "opacity 0.15s" }}>
                  {content.map((s, i) => <HeatSentence key={i} text={s.text} score={s.score} />)}
                </div>
                {view === "labor" && (
                  <div style={{ background: "linear-gradient(to right, #f0fdf4, #f8fafc)", border: "1px solid #bbf7d0", borderRadius: 10, padding: "13px 16px", marginTop: 22, fontSize: "0.82rem", color: "#166534", display: "flex", alignItems: "flex-start", gap: 10, animation: "slideUp 0.3s ease" }}>
                    <span>🔍</span>
                    <span><strong>Missing Voices injected:</strong> Labor perspective reveals 3 structurally excluded groups. See the "Missing Voices" tab for full analysis.</span>
                  </div>
                )}
              </>
            )}

            {tab === "compare" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {[
                  { label: "🏛 INSTITUTIONAL VIEW", color: "#64748b", sentences: a.institutional, isLabor: false },
                  { label: "👷 LABOR VIEW", color: "#16a34a", sentences: a.labor, isLabor: true },
                ].map(({ label, color, sentences, isLabor }) => (
                  <div key={label} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: 20 }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.12em", color, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${isLabor ? "#dcfce7" : "#f1f5f9"}` }}>{label}</div>
                    {sentences.map((s, i) => (
                      <p key={i} style={{ fontSize: "0.83rem", lineHeight: 1.75, color: "#475569", marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${isLabor ? "#bbf7d0" : "#f1f5f9"}` }}>{s.text}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {tab === "voices" && (
              <>
                <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: 18, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.03em", lineHeight: 1.6 }}>
                  Perspectives structurally absent from the standard framing of this story:
                </p>
                {a.voices.map(({ icon, group, color, text }) => (
                  <div key={group} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 12, padding: "16px 18px", marginBottom: 10, display: "flex", gap: 14, animation: "slideUp 0.3s ease" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", color, fontWeight: 500, marginBottom: 5 }}>{group.toUpperCase()}</div>
                      <div style={{ fontSize: "0.84rem", color: "#475569", lineHeight: 1.65 }}>{text}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside style={S.panel}>

          <div style={S.panelSection}>
            <span style={S.panelLabel}>Economic Bias Score</span>
            <BiasGauge score={a.biasScore} key={articleId} />
          </div>

          <div style={S.panelSection}>
            <span style={S.panelLabel}>Score Breakdown</span>
            <MetricBar label="FACTUAL DENSITY" value={a.factualDensity} color="#22c55e" />
            <MetricBar label="FRAMING SCORE" value={a.framingScore} color="#f97316" />
            <MetricBar label="OMISSION RATE" value={a.omissionRate} color="#ef4444" />
            <MetricBar label="LANGUAGE LOAD" value={a.languageLoad} color="#f59e0b" />
          </div>

          <div style={S.panelSection}>
            <span style={S.panelLabel}>Framing Radar</span>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Radar factual={a.factualDensity} framing={a.framingScore} />
            </div>
            <div style={{ textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "#cbd5e1", marginTop: 4, letterSpacing: "0.08em" }}>DistilBERT probability mapping</div>
          </div>

          <div style={{ ...S.panelSection, flex: 1 }}>
            <button onClick={() => setCalgary(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <div style={{ width: 8, height: 8, background: "#22c55e", borderRadius: "50%", flexShrink: 0, animation: "glow 2s infinite" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em", color: "#16a34a", flex: 1 }}>CALGARY REALITY CHECK</span>
              <span style={{ color: "#94a3b8", fontSize: 10 }}>{calgary ? "▲" : "▼"}</span>
            </button>

            {calgary ? (
              <div style={{ marginTop: 14, animation: "slideUp 0.25s ease" }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: "2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>{a.calgary.value}</div>
                <div style={{ fontSize: "0.73rem", color: "#64748b", margin: "4px 0 12px" }}>{a.calgary.stat}</div>
                <div style={{ fontSize: "0.78rem", color: "#334155", lineHeight: 1.55, background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>{a.calgary.context}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "#94a3b8", letterSpacing: "0.06em" }}>Source: {a.calgary.source}</div>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: "0.76rem", color: "#cbd5e1", lineHeight: 1.55 }}>Load local Calgary data to contextualize this national story.</div>
            )}
          </div>

        </aside>
      </div>
    </>
  );
}