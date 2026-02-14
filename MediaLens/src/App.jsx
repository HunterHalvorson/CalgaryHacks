import { useState, useEffect, useRef } from "react";

// ─── Radar Chart (SVG-based) ──────────────────────────────────────────────────
function RadarChart({ factualDensity, framingScore }) {
  const cx = 80, cy = 80, r = 55;
  const metrics = [
    { label: "Factual", value: factualDensity / 100 },
    { label: "Neutral", value: 0.62 },
    { label: "Context", value: 0.48 },
    { label: "Framing", value: framingScore / 100 },
    { label: "Language", value: 0.71 },
  ];
  const n = metrics.length;
  const points = metrics.map((m, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + r * m.value * Math.cos(angle),
      y: cy + r * m.value * Math.sin(angle),
      lx: cx + (r + 18) * Math.cos(angle),
      ly: cy + (r + 18) * Math.sin(angle),
    };
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 160 160" style={{ width: 160, height: 160 }}>
      {gridLevels.map((lv) => {
        const gpts = metrics
          .map((_, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            return `${cx + r * lv * Math.cos(angle)},${cy + r * lv * Math.sin(angle)}`;
          })
          .join(" ");
        return (
          <polygon key={lv} points={gpts} fill="none" stroke="#2a3a2a" strokeWidth="1" />
        );
      })}
      {metrics.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="#2a3a2a"
            strokeWidth="1"
          />
        );
      })}
      <polygon points={polygon} fill="rgba(180,230,80,0.25)" stroke="#b4e650" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#b4e650" />
      ))}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#8aaa50"
          style={{ fontSize: "7px", fontFamily: "'DM Mono', monospace" }}
        >
          {metrics[i].label}
        </text>
      ))}
    </svg>
  );
}

// ─── Heatmap sentence renderer ────────────────────────────────────────────────
function getBiasColor(score) {
  if (score < 0.3) return { bg: "transparent", label: null };
  if (score < 0.5) return { bg: "rgba(255,220,0,0.28)", label: "mild" };
  if (score < 0.75) return { bg: "rgba(255,140,0,0.32)", label: "slanted" };
  return { bg: "rgba(220,50,30,0.38)", label: "extreme" };
}

function HeatmapText({ sentences }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ lineHeight: 1.85, fontSize: "0.93rem", color: "#c8d8b0" }}>
      {sentences.map((s, i) => {
        const { bg, label } = getBiasColor(s.score);
        const isHov = hovered === i;
        return (
          <span
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: bg,
              borderRadius: 3,
              padding: "1px 2px",
              cursor: label ? "pointer" : "default",
              position: "relative",
              transition: "background 0.2s",
              outline: isHov && label ? "1.5px solid rgba(180,230,80,0.6)" : "none",
            }}
          >
            {s.text}{" "}
            {isHov && label && (
              <span
                style={{
                  position: "absolute",
                  bottom: "120%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#0d1f0d",
                  border: "1px solid #2a4a2a",
                  color: "#b4e650",
                  fontSize: "0.72rem",
                  padding: "4px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  zIndex: 10,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.04em",
                }}
              >
                {label === "mild" && "⚠ MILD — adjective framing"}
                {label === "slanted" && "🟠 SLANTED — omitted context"}
                {label === "extreme" && "🔴 EXTREME — loaded language"}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Score arc ────────────────────────────────────────────────────────────────
function BiasArc({ score }) {
  const r = 38, cx = 50, cy = 52;
  const arc = Math.PI;
  const startX = cx - r, startY = cy;
  const endX = cx + r, endY = cy;
  const sweep = score / 100;
  const angle = Math.PI * sweep;
  const px = cx + r * Math.cos(Math.PI - angle);
  const py = cy - r * Math.sin(angle);
  const color =
    score < 30 ? "#b4e650" : score < 60 ? "#f0c040" : score < 80 ? "#f07030" : "#e03030";
  const label =
    score < 30 ? "LOW" : score < 60 ? "MODERATE" : score < 80 ? "HIGH" : "EXTREME";
  return (
    <svg viewBox="0 0 100 60" style={{ width: 130, height: 78 }}>
      <path
        d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`}
        fill="none"
        stroke="#1a2e1a"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${px} ${py}`}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <circle cx={px} cy={py} r="5" fill={color} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} style={{ fontSize: "13px", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
        {score}
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fill={color} style={{ fontSize: "6.5px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em" }}>
        {label}
      </text>
    </svg>
  );
}

// ─── Mock article data ────────────────────────────────────────────────────────
const ARTICLES = {
  rates: {
    title: "Bank of Canada Holds Rate at 3.25%",
    outlet: "Financial Post",
    date: "Feb 14, 2026",
    institutionalContent: [
      { text: "The Bank of Canada maintained its benchmark interest rate at 3.25% on Wednesday, a decision widely praised by financial markets as prudent stewardship.", score: 0.55 },
      { text: "Major bank stocks surged following the announcement, with RBC and TD posting their strongest single-day gains in three months.", score: 0.3 },
      { text: "Economists noted the move signals confidence in inflation-control mechanisms and bodes well for the upcoming fiscal quarter.", score: 0.72 },
      { text: "The central bank cited strong employment figures and robust GDP growth as key factors in its decision.", score: 0.45 },
      { text: "Analysts from Bay Street unanimously welcomed the policy continuity, calling it a win for economic stability.", score: 0.82 },
    ],
    laborContent: [
      { text: "The Bank of Canada maintained its benchmark interest rate at 3.25% on Wednesday, a decision that provides no relief to Canadians struggling with record mortgage costs.", score: 0.55 },
      { text: "Bank stocks surged, but the announcement means average Calgary homeowners will continue paying $2,200 more annually in interest than they were in 2021.", score: 0.3 },
      { text: "Economists noted the move signals confidence in Canada's financial sector, though real wages have declined 4.3% when adjusted for inflation since the rate cycle began.", score: 0.72 },
      { text: "The central bank cited employment figures — but excluded the 140,000 Canadians who left the workforce entirely, no longer counted as unemployed.", score: 0.45 },
      { text: "Bay Street welcomed policy continuity; tenant advocacy groups called it 'another quarter of inaction' on housing affordability.", score: 0.82 },
    ],
    missingVoices: {
      renters: "In Calgary, average rent hit $1,920/month in January — up 31% since 2021. The rate hold means landlords with variable mortgages face no cost relief, pressure often transferred to tenants at renewal.",
      workers: "Alberta's gig economy workers — 18% of Calgary's workforce — have no access to employment insurance and are excluded from 'strong employment' statistics cited by the Bank.",
      indigenous: "First Nations communities in Treaty 7 territory, already facing 24% unemployment rates, are structurally excluded from monetary policy benefits that flow primarily through home equity and institutional investment.",
    },
    biasScore: 74,
    factualDensity: 62,
    framingScore: 78,
    calgaryData: {
      stat: "Calgary mortgage delinquency rate",
      value: "0.41%",
      context: "Up 38% year-over-year — highest since 2016 oil crash",
      source: "CMHC Q4 2025 Report",
    },
  },
  housing: {
    title: "Calgary Housing Market Sees 'Healthy Correction'",
    outlet: "Calgary Herald",
    date: "Feb 12, 2026",
    institutionalContent: [
      { text: "Calgary's real estate market experienced a healthy correction in January, with benchmark prices falling 3.2% from their October peak.", score: 0.65 },
      { text: "Real estate industry professionals described the adjustment as a normalization after years of pandemic-driven demand.", score: 0.7 },
      { text: "Inventory levels rose to 4.2 months of supply, approaching the balanced market threshold of 5–6 months.", score: 0.2 },
      { text: "Analysts from major brokerages expect a soft landing as the spring market approaches, with renewed buyer confidence anticipated.", score: 0.6 },
      { text: "The City of Calgary's economic development office highlighted the resilience of Alberta's diversified economy as a stabilizing force.", score: 0.5 },
    ],
    laborContent: [
      { text: "Calgary housing prices fell 3.2% in January — offering minimal relief to buyers priced out after a 48% run-up since 2020.", score: 0.65 },
      { text: "Real estate brokers called it a 'normalization' — the same firms that projected 12% annual gains through 2026 just eight months ago.", score: 0.7 },
      { text: "Inventory rose to 4.2 months, but 67% of new listings are priced above $600,000 — beyond the reach of Calgary's median household income of $98,000.", score: 0.2 },
      { text: "Analysts predict a 'spring recovery,' language that historically correlates with renewed pressure on first-time buyers, not existing homeowners.", score: 0.6 },
      { text: "The City's 'diversified economy' framing omits that 34% of Calgary jobs added since 2022 are in temporary or contract roles.", score: 0.5 },
    ],
    missingVoices: {
      renters: "Of Calgary's 124,000 renter households, 41% spend over 30% of income on housing (the federal affordability threshold). A 3.2% price drop has zero impact on their monthly costs.",
      workers: "Construction tradespeople report housing insecurity themselves — 1 in 5 Calgary construction workers commutes from Airdrie or Cochrane due to unaffordable city rents.",
      indigenous: "Urban Indigenous housing orgs report zero vacancy in Calgary's 847 Indigenous-specific affordable units. The broader market correction is statistically irrelevant to this population.",
    },
    biasScore: 68,
    factualDensity: 55,
    framingScore: 71,
    calgaryData: {
      stat: "Calgary first-time buyer affordability gap",
      value: "$156,000",
      context: "Median gap between what income qualifies for and median home price (Feb 2026)",
      source: "Open Calgary Housing Dashboard",
    },
  },
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedArticle, setSelectedArticle] = useState("rates");
  const [wealthClass, setWealthClass] = useState("institutional");
  const [activeTab, setActiveTab] = useState("heatmap");
  const [showCalgary, setShowCalgary] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [toggleAnim, setToggleAnim] = useState(false);

  const article = ARTICLES[selectedArticle];
  const content =
    wealthClass === "institutional" ? article.institutionalContent : article.laborContent;

  const handleClassToggle = (cls) => {
    setToggleAnim(true);
    setTimeout(() => {
      setWealthClass(cls);
      setAnimKey((k) => k + 1);
      setToggleAnim(false);
    }, 180);
  };

  useEffect(() => {
    setShowCalgary(false);
  }, [selectedArticle]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700;900&family=Sora:wght@300;400;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #080f08;
          color: #c8d8b0;
          font-family: 'Sora', sans-serif;
          min-height: 100vh;
        }

        .root {
          min-height: 100vh;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, #0f280f 0%, #080f08 60%);
        }

        /* Noise overlay */
        .root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.5;
          z-index: 0;
        }

        .container {
          max-width: 980px;
          margin: 0 auto;
          padding: 0 24px 60px;
          position: relative;
          z-index: 1;
        }

        /* Header */
        .header {
          padding: 36px 0 28px;
          border-bottom: 1px solid #1a2e1a;
          display: flex;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 32px;
        }
        .logo-mark {
          width: 44px;
          height: 44px;
          background: #b4e650;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Mono', monospace;
          font-size: 1.1rem;
          color: #080f08;
          font-weight: 500;
          flex-shrink: 0;
          letter-spacing: -0.05em;
        }
        .header-text h1 {
          font-family: 'Playfair Display', serif;
          font-size: 1.7rem;
          font-weight: 900;
          color: #eaf4cc;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .header-text p {
          font-size: 0.78rem;
          color: #6a8a50;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.08em;
          margin-top: 5px;
        }
        .header-badge {
          margin-left: auto;
          font-family: 'DM Mono', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: #b4e650;
          border: 1px solid #2a4a2a;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(180,230,80,0.07);
        }

        /* Article selector */
        .article-selector {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
        }
        .article-btn {
          flex: 1;
          background: #0d1f0d;
          border: 1px solid #1a2e1a;
          border-radius: 10px;
          padding: 14px 16px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .article-btn.active {
          border-color: #3a6a1a;
          background: #111f0d;
        }
        .article-btn:hover { border-color: #2a5a1a; }
        .article-btn .ab-outlet {
          font-family: 'DM Mono', monospace;
          font-size: 0.67rem;
          color: #5a8a40;
          letter-spacing: 0.1em;
          margin-bottom: 4px;
        }
        .article-btn .ab-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #c8d8b0;
          line-height: 1.3;
        }

        /* Main grid */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 20px;
        }

        /* Panel */
        .panel {
          background: #0b1a0b;
          border: 1px solid #1a2e1a;
          border-radius: 14px;
          overflow: hidden;
        }
        .panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid #1a2e1a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .panel-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          color: #4a7a30;
        }
        .panel-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: #c8d8b0;
          flex: 1;
        }

        /* Wealth toggle */
        .wealth-toggle {
          display: flex;
          background: #080f08;
          border: 1px solid #1a2e1a;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .wt-btn {
          flex: 1;
          padding: 9px 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 0.72rem;
          letter-spacing: 0.09em;
          color: #4a7a30;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .wt-btn.active {
          background: #b4e650;
          color: #080f08;
          font-weight: 500;
        }
        .wt-btn:not(.active):hover { color: #8aaa50; }

        /* Article content area */
        .article-content {
          padding: 22px 24px;
          transition: opacity 0.18s;
        }
        .article-content.fading { opacity: 0; }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 2px;
          background: #080f08;
          border-radius: 8px;
          padding: 3px;
          margin-bottom: 18px;
        }
        .tab-btn {
          flex: 1;
          padding: 7px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          color: #4a7a30;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tab-btn.active {
          background: #1a2e1a;
          color: #b4e650;
        }

        /* Missing Voices */
        .missing-voices {
          margin-top: 24px;
          border-top: 1px solid #1a2e1a;
          padding-top: 20px;
          animation: fadeIn 0.35s ease;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .mv-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }
        .mv-header-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          color: #b4e650;
          background: rgba(180,230,80,0.1);
          border: 1px solid rgba(180,230,80,0.2);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .mv-card {
          background: #0d1a0d;
          border: 1px solid #1e3a1e;
          border-left: 3px solid;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 10px;
          font-size: 0.83rem;
          color: #a8c890;
          line-height: 1.6;
        }
        .mv-card .mv-voice {
          font-family: 'DM Mono', monospace;
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
          font-weight: 500;
        }

        /* Right sidebar */
        .sidebar { display: flex; flex-direction: column; gap: 16px; }

        /* Score card */
        .score-card {
          background: #0b1a0b;
          border: 1px solid #1a2e1a;
          border-radius: 14px;
          padding: 20px;
        }
        .sc-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          color: #4a7a30;
          margin-bottom: 12px;
        }
        .sc-arc-row {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }
        .sc-metrics {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        .sc-metric-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sc-metric-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          color: #5a8a40;
          width: 80px;
          flex-shrink: 0;
        }
        .sc-bar-track {
          flex: 1;
          height: 4px;
          background: #1a2e1a;
          border-radius: 2px;
          overflow: hidden;
        }
        .sc-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.8s ease;
        }
        .sc-metric-val {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          color: #7aaa50;
          width: 28px;
          text-align: right;
        }

        /* Radar card */
        .radar-card {
          background: #0b1a0b;
          border: 1px solid #1a2e1a;
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .radar-card .rc-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          color: #4a7a30;
          margin-bottom: 10px;
          align-self: flex-start;
        }

        /* Calgary card */
        .calgary-card {
          background: #0b1a0b;
          border: 1px solid #1a2e1a;
          border-radius: 14px;
          padding: 18px 20px;
        }
        .calgary-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 0.67rem;
          letter-spacing: 0.1em;
          color: #b4e650;
          background: none;
          border: none;
          padding: 0;
          width: 100%;
          text-align: left;
          margin-bottom: 0;
        }
        .calgary-trigger .ct-dot {
          width: 8px; height: 8px;
          background: #b4e650;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(180,230,80,0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(180,230,80,0); }
        }
        .calgary-data {
          margin-top: 14px;
          animation: fadeIn 0.3s ease;
        }
        .cd-stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 700;
          color: #b4e650;
          line-height: 1;
          margin-bottom: 4px;
        }
        .cd-stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 0.67rem;
          color: #6a8a50;
          letter-spacing: 0.07em;
          margin-bottom: 8px;
        }
        .cd-context {
          font-size: 0.8rem;
          color: #a8c890;
          line-height: 1.5;
          border-top: 1px solid #1a2e1a;
          padding-top: 10px;
          margin-top: 10px;
        }
        .cd-source {
          font-family: 'DM Mono', monospace;
          font-size: 0.62rem;
          color: #4a7a30;
          margin-top: 8px;
          letter-spacing: 0.06em;
        }

        /* Legend */
        .legend {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: 'DM Mono', monospace;
          font-size: 0.65rem;
          color: #5a8a40;
        }
        .legend-dot {
          width: 10px; height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        @media (max-width: 700px) {
          .main-grid { grid-template-columns: 1fr; }
          .sidebar { flex-direction: row; flex-wrap: wrap; }
          .score-card, .radar-card, .calgary-card { flex: 1 1 200px; }
        }
      `}</style>

      <div className="root">
        <div className="container">

          {/* Header */}
          <header className="header">
            <div className="logo-mark">ML</div>
            <div className="header-text">
              <h1>MediaLens</h1>
              <p>ECONOMIC BIAS ANALYZER · CALGARY EDITION</p>
            </div>
            <div className="header-badge">v2.1 · BETA</div>
          </header>

          {/* Article Selector */}
          <div className="article-selector">
            {Object.entries(ARTICLES).map(([key, a]) => (
              <button
                key={key}
                className={`article-btn ${selectedArticle === key ? "active" : ""}`}
                onClick={() => { setSelectedArticle(key); setAnimKey((k) => k + 1); }}
              >
                <div className="ab-outlet">{a.outlet} · {a.date}</div>
                <div className="ab-title">{a.title}</div>
              </button>
            ))}
          </div>

          <div className="main-grid">
            {/* Left: Article panel */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-label">ANALYSIS TARGET</div>
                  <div className="panel-title">{article.title}</div>
                </div>
              </div>

              <div style={{ padding: "16px 20px 0" }}>
                {/* Wealth class toggle */}
                <div className="wealth-toggle">
                  <button
                    className={`wt-btn ${wealthClass === "institutional" ? "active" : ""}`}
                    onClick={() => handleClassToggle("institutional")}
                  >
                    🏛 INSTITUTIONAL VIEW
                  </button>
                  <button
                    className={`wt-btn ${wealthClass === "labor" ? "active" : ""}`}
                    onClick={() => handleClassToggle("labor")}
                  >
                    👷 LABOR VIEW
                  </button>
                </div>

                {/* Tabs */}
                <div className="tabs">
                  {["heatmap", "compare", "voices"].map((t) => (
                    <button
                      key={t}
                      className={`tab-btn ${activeTab === t ? "active" : ""}`}
                      onClick={() => setActiveTab(t)}
                    >
                      {t === "heatmap" && "⬥ BIAS HEATMAP"}
                      {t === "compare" && "⬦ SIDE-BY-SIDE"}
                      {t === "voices" && "◈ MISSING VOICES"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`article-content ${toggleAnim ? "fading" : ""}`} key={animKey}>
                {activeTab === "heatmap" && (
                  <>
                    <div className="legend">
                      <div className="legend-item">
                        <div className="legend-dot" style={{ background: "rgba(255,220,0,0.4)" }} />
                        MILD · adjectives
                      </div>
                      <div className="legend-item">
                        <div className="legend-dot" style={{ background: "rgba(255,140,0,0.45)" }} />
                        SLANTED · omission
                      </div>
                      <div className="legend-item">
                        <div className="legend-dot" style={{ background: "rgba(220,50,30,0.45)" }} />
                        EXTREME · loaded
                      </div>
                    </div>
                    <HeatmapText sentences={content} />
                  </>
                )}

                {activeTab === "compare" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { label: "🏛 INSTITUTIONAL", data: article.institutionalContent, border: "#2a5a4a" },
                      { label: "👷 LABOR", data: article.laborContent, border: "#b4e650" },
                    ].map(({ label, data, border }) => (
                      <div key={label}>
                        <div style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: "0.66rem",
                          letterSpacing: "0.12em",
                          color: border === "#b4e650" ? "#b4e650" : "#5a8a70",
                          marginBottom: 10,
                          paddingBottom: 6,
                          borderBottom: `1px solid ${border}30`,
                        }}>
                          {label}
                        </div>
                        {data.map((s, i) => (
                          <p key={i} style={{
                            fontSize: "0.8rem",
                            lineHeight: 1.7,
                            color: "#a8c890",
                            marginBottom: 10,
                            paddingLeft: 8,
                            borderLeft: `2px solid ${border}40`,
                          }}>
                            {s.text}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "voices" && (
                  <>
                    <p style={{ fontSize: "0.82rem", color: "#6a8a50", marginBottom: 16, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em", lineHeight: 1.5 }}>
                      Perspectives structurally excluded from the {wealthClass === "institutional" ? "institutional" : "standard labor"} framing:
                    </p>
                    {[
                      { key: "renters", icon: "🏠", color: "#60b4a0", label: "CALGARY RENTERS" },
                      { key: "workers", icon: "⚙️", color: "#b4a060", label: "GIG / CONTRACT WORKERS" },
                      { key: "indigenous", icon: "🌿", color: "#a080c0", label: "INDIGENOUS COMMUNITIES" },
                    ].map(({ key, icon, color, label }) => (
                      <div key={key} className="mv-card" style={{ borderLeftColor: color }}>
                        <div className="mv-voice" style={{ color }}>
                          {icon} {label}
                        </div>
                        {article.missingVoices[key]}
                      </div>
                    ))}
                  </>
                )}

                {activeTab !== "voices" && wealthClass === "labor" && (
                  <div className="missing-voices">
                    <div className="mv-header">
                      <div className="mv-header-label">+ MISSING VOICES INJECTED</div>
                      <span style={{ fontSize: "0.75rem", color: "#5a8a40" }}>3 excluded perspectives</span>
                    </div>
                    <div className="mv-card" style={{ borderLeftColor: "#b4e650" }}>
                      <div className="mv-voice" style={{ color: "#b4e650" }}>🏠 CALGARY RENTERS</div>
                      {article.missingVoices.renters}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="sidebar">

              {/* Bias Score */}
              <div className="score-card">
                <div className="sc-label">ECONOMIC BIAS SCORE</div>
                <div className="sc-arc-row">
                  <BiasArc score={article.biasScore} key={selectedArticle} />
                </div>
                <div className="sc-metrics">
                  {[
                    { label: "Factual density", value: article.factualDensity, color: "#b4e650" },
                    { label: "Framing score", value: article.framingScore, color: "#f09030" },
                    { label: "Omission rate", value: 58, color: "#e06030" },
                    { label: "Language load", value: 44, color: "#f0c040" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="sc-metric-row">
                      <div className="sc-metric-label">{label}</div>
                      <div className="sc-bar-track">
                        <div
                          className="sc-bar-fill"
                          style={{ width: `${value}%`, background: color }}
                        />
                      </div>
                      <div className="sc-metric-val">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar */}
              <div className="radar-card">
                <div className="rc-label">FRAMING RADAR</div>
                <RadarChart
                  factualDensity={article.factualDensity}
                  framingScore={article.framingScore}
                />
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: "0.62rem",
                  color: "#4a7a30",
                  textAlign: "center",
                  marginTop: 6,
                  letterSpacing: "0.07em",
                }}>
                  DistilBERT probability mapping
                </div>
              </div>

              {/* Calgary Reality Check */}
              <div className="calgary-card">
                <button
                  className="calgary-trigger"
                  onClick={() => setShowCalgary((v) => !v)}
                >
                  <div className="ct-dot" />
                  CALGARY REALITY CHECK
                  <span style={{ marginLeft: "auto", opacity: 0.5 }}>
                    {showCalgary ? "▲" : "▼"}
                  </span>
                </button>
                {showCalgary && (
                  <div className="calgary-data">
                    <div className="cd-stat-value">{article.calgaryData.value}</div>
                    <div className="cd-stat-label">{article.calgaryData.stat}</div>
                    <div className="cd-context">{article.calgaryData.context}</div>
                    <div className="cd-source">↳ {article.calgaryData.source}</div>
                  </div>
                )}
                {!showCalgary && (
                  <div style={{
                    marginTop: 10,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "0.7rem",
                    color: "#3a6a2a",
                    lineHeight: 1.5,
                  }}>
                    Tap to load local Calgary data that contextualizes this story.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid #1a2e1a",
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.65rem",
              color: "#3a5a2a",
              letterSpacing: "0.1em",
            }}>
              SOURCES: Open Calgary API · CMHC · Statistics Canada · Alberta Economic Dashboard
            </div>
            <div style={{
              marginLeft: "auto",
              fontFamily: "'DM Mono', monospace",
              fontSize: "0.65rem",
              color: "#3a5a2a",
              letterSpacing: "0.08em",
            }}>
              MEDIALENS · CALGARY EDITION · {new Date().getFullYear()}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}