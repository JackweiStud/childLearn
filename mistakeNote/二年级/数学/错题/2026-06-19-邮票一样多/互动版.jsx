import { useState } from "react";

/* ============ 线段图常量 ============ */
const UNIT = 4;        // 1 枚邮票 = 4 像素
const BAR_H = 40;
const BAR_X = 70;
const MING_Y = 90;
const BEN_Y = 190;
const VW = 400;
const VH = 285;

/* ============ 六个步骤的讲解文本 ============ */
const STEPS = [
  {
    chip: "读题", icon: "📖", title: "画两条线段",
    text: "明明有 35 枚，画一条短线段。小本送邮票给明明 → 说明小本本来比明明多，画一条更长的线段。多多少？还不知道，先打个 ? 。",
  },
  {
    chip: "标 18", icon: "✂️", title: "把小本要送出的 18 枚剪开",
    text: "在小本线段的右端，圈出粉色一小段表示要送的 18 枚。剩下的蓝色那段，是送完后还在小本手里的（也是个 ?）。",
  },
  {
    chip: "送过去", icon: "🎁", title: "粉色那段滑到明明那边",
    text: "粉色 18 枚移到明明的右边。明明现在 = 橙 35 + 粉 18。小本只剩蓝色一段。",
  },
  {
    chip: "算 53", icon: "⚖️", title: "两条线一样长了 = 53",
    text: "题目说送完一样多。明明 = 35 + 18 = 53。所以小本剩下的蓝色那段也是 53。两条线一样长 ✓",
  },
  {
    chip: "还回来", icon: "↩️", title: "把 18 还回小本，找回『原来』",
    key: true,
    text: "题目问的是『小本原来』。小本原来 = 现在的 53 + 送出去的 18 = 71 枚！粉色滑回小本的右边。",
  },
  {
    chip: "检验", icon: "✅", title: "倒回去再走一遍",
    text: "小本 71 − 18 = 53。明明 35 + 18 = 53。两人都是 53，一样多 ✓ 答案正确。",
  },
];

/* ============ 每个步骤的线段状态 ============ */
function getDiagram(step) {
  // 公共默认
  const base = {
    mingW: 35,
    benBlueW: 71, benBlueDashed: true, benBlueLabel: "?",
    pink: { visible: false, x: BAR_X + 71 * UNIT, y: BEN_Y, label: "" },
    mingTotal: { value: "35", w: 35 },
    benTotal: { value: "?", w: 71 },
    equality: false,
  };

  if (step === 0) return base;

  if (step === 1) return {
    ...base,
    benBlueW: 53, benBlueLabel: "?",
    pink: { visible: true, x: BAR_X + 53 * UNIT, y: BEN_Y, label: "送 18" },
    benTotal: { value: "?", w: 71 },
  };

  if (step === 2) return {
    ...base,
    benBlueW: 53, benBlueDashed: true, benBlueLabel: "?",
    pink: { visible: true, x: BAR_X + 35 * UNIT, y: MING_Y, label: "18" },
    mingTotal: { value: "35 + 18", w: 53 },
    benTotal: { value: "?", w: 53 },
  };

  if (step === 3) return {
    ...base,
    benBlueW: 53, benBlueDashed: false, benBlueLabel: "53",
    pink: { visible: true, x: BAR_X + 35 * UNIT, y: MING_Y, label: "18" },
    mingTotal: { value: "= 53", w: 53 },
    benTotal: { value: "= 53", w: 53 },
    equality: true,
  };

  if (step === 4) return {
    ...base,
    benBlueW: 53, benBlueDashed: false, benBlueLabel: "53",
    pink: { visible: true, x: BAR_X + 53 * UNIT, y: BEN_Y, label: "还 18" },
    mingTotal: { value: "35", w: 35 },
    benTotal: { value: "53 + 18 = 71", w: 71 },
  };

  if (step === 5) return {
    ...base,
    benBlueW: 53, benBlueDashed: false, benBlueLabel: "53",
    pink: { visible: true, x: BAR_X + 53 * UNIT, y: BEN_Y, label: "18" },
    mingTotal: { value: "35", w: 35 },
    benTotal: { value: "71", w: 71 },
  };

  return base;
}

/* ============ 主线段图 ============ */
function LineDiagram({ step }) {
  const d = getDiagram(step);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="diagram" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.7" fill="#C9D4E5" />
        </pattern>
      </defs>
      <rect width={VW} height={VH} fill="url(#grid)" rx="14" />

      {/* 行标 */}
      <text x={12} y={MING_Y + BAR_H / 2 + 6} className="row-label ming-ink">明明</text>
      <text x={12} y={BEN_Y + BAR_H / 2 + 6} className="row-label ben-ink">小本</text>

      {/* 起点刻度（小竖线表示 0 的位置） */}
      <line x1={BAR_X} y1={MING_Y - 6} x2={BAR_X} y2={BEN_Y + BAR_H + 6}
            stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="2,3" />

      {/* 明明总长标 */}
      <text x={BAR_X + d.mingTotal.w * UNIT / 2} y={MING_Y - 12}
            className="total-label ming-ink">
        {d.mingTotal.value} 枚
      </text>

      {/* 明明 橙色条 */}
      <rect className="bar ming-bar"
            x={BAR_X} y={MING_Y}
            width={d.mingW * UNIT} height={BAR_H}
            rx={7} ry={7}
            fill="#F59E0B" stroke="#B45309" strokeWidth={2} />
      <text x={BAR_X + d.mingW * UNIT / 2} y={MING_Y + BAR_H / 2 + 6}
            className="seg-label">35</text>

      {/* 小本 蓝色条 */}
      <rect className="bar ben-bar"
            x={BAR_X} y={BEN_Y}
            width={d.benBlueW * UNIT} height={BAR_H}
            rx={7} ry={7}
            fill={d.benBlueDashed ? "#E8F1FE" : "#2F7DF6"}
            stroke="#1D4ED8" strokeWidth={2}
            strokeDasharray={d.benBlueDashed ? "5,4" : "none"} />
      <text x={BAR_X + d.benBlueW * UNIT / 2} y={BEN_Y + BAR_H / 2 + 6}
            className="seg-label"
            fill={d.benBlueDashed ? "#1D4ED8" : "#fff"}>
        {d.benBlueLabel}
      </text>

      {/* 小本总长标 */}
      <text x={BAR_X + d.benTotal.w * UNIT / 2} y={BEN_Y + BAR_H + 22}
            className="total-label ben-ink">
        {d.benTotal.value} 枚
      </text>

      {/* 粉色那段：会飞过来飞过去 */}
      <rect className="bar pink-bar"
            x={d.pink.x} y={d.pink.y}
            width={18 * UNIT} height={BAR_H}
            rx={7} ry={7}
            fill="#EC4899" stroke="#BE185D" strokeWidth={2}
            style={{ opacity: d.pink.visible ? 1 : 0 }} />
      <text className="seg-label pink-text"
            x={d.pink.x + 18 * UNIT / 2}
            y={d.pink.y + BAR_H / 2 + 6}
            style={{ opacity: d.pink.visible ? 1 : 0 }}>
        {d.pink.label}
      </text>

      {/* "一样长" 标记 */}
      {d.equality && (
        <g>
          <line x1={BAR_X + 53 * UNIT + 8} y1={MING_Y + BAR_H + 4}
                x2={BAR_X + 53 * UNIT + 8} y2={BEN_Y - 4}
                stroke="#16A34A" strokeWidth={2.5} strokeDasharray="4,3" />
          <rect x={BAR_X + 53 * UNIT + 16} y={(MING_Y + BAR_H + BEN_Y) / 2 - 13}
                width={56} height={24} rx={12} fill="#16A34A" />
          <text x={BAR_X + 53 * UNIT + 44} y={(MING_Y + BAR_H + BEN_Y) / 2 + 4}
                fontSize={13} fontWeight="800" fill="#fff" textAnchor="middle">
            一样长
          </text>
        </g>
      )}
    </svg>
  );
}

/* ============ 另一种看法：差 = 2 × 18 = 36 ============ */
function AlternativeDiagram() {
  // 简化：明明 35，小本 71 = 35 + 18 + 18
  const A = 35, T = 18;
  const x0 = 60;
  return (
    <svg viewBox="0 0 380 200" className="diagram alt" preserveAspectRatio="xMidYMid meet">
      <text x={10} y={56} className="row-label ming-ink">明明</text>
      <text x={10} y={130} className="row-label ben-ink">小本</text>

      {/* 起点对齐线 */}
      <line x1={x0} y1={28} x2={x0} y2={158} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="2,3" />

      {/* 明明 35 */}
      <rect x={x0} y={36} width={A * UNIT} height={36} rx={6}
            fill="#F59E0B" stroke="#B45309" strokeWidth={2} />
      <text x={x0 + A * UNIT / 2} y={59} className="seg-label">35</text>

      {/* 小本 35（前半段，和明明对齐） */}
      <rect x={x0} y={110} width={A * UNIT} height={36} rx={6}
            fill="#2F7DF6" stroke="#1D4ED8" strokeWidth={2} />
      <text x={x0 + A * UNIT / 2} y={133} className="seg-label">35</text>

      {/* 小本 多出的 18 + 18 */}
      <rect x={x0 + A * UNIT} y={110} width={T * UNIT} height={36} rx={6}
            fill="#EC4899" stroke="#BE185D" strokeWidth={2} />
      <text x={x0 + A * UNIT + T * UNIT / 2} y={133} className="seg-label">18</text>

      <rect x={x0 + (A + T) * UNIT} y={110} width={T * UNIT} height={36} rx={6}
            fill="#EC4899" stroke="#BE185D" strokeWidth={2} opacity={0.75} />
      <text x={x0 + (A + T) * UNIT + T * UNIT / 2} y={133} className="seg-label">18</text>

      {/* 多出来的大括号 */}
      <line x1={x0 + A * UNIT} y1={156} x2={x0 + A * UNIT} y2={164}
            stroke="#BE185D" strokeWidth={2} />
      <line x1={x0 + (A + 2 * T) * UNIT} y1={156} x2={x0 + (A + 2 * T) * UNIT} y2={164}
            stroke="#BE185D" strokeWidth={2} />
      <line x1={x0 + A * UNIT} y1={164} x2={x0 + (A + 2 * T) * UNIT} y2={164}
            stroke="#BE185D" strokeWidth={2} />
      <text x={x0 + (A + T) * UNIT} y={181} fontSize={13} fontWeight="800"
            fill="#BE185D" textAnchor="middle">
        多出 36 = 18 + 18
      </text>
    </svg>
  );
}

/* ============ 跟我学 ============ */
function Learn() {
  const [step, setStep] = useState(0);
  const [showAlt, setShowAlt] = useState(false);
  const s = STEPS[step];

  return (
    <div>
      <div className="chips">
        {STEPS.map((st, i) => (
          <button
            key={i}
            className={"chip" + (i === step ? " active" : "") + (i < step ? " done" : "")}
            onClick={() => setStep(i)}
          >
            <span className="chip-num">{i + 1}</span>
            {st.chip}
          </button>
        ))}
      </div>

      <div className="diagram-wrap">
        <LineDiagram step={step} />
      </div>

      <div className={"narration" + (s.key ? " key" : "")}>
        <span className="nar-icon">{s.icon}</span>
        <div className="nar-body">
          <div className="nar-title">
            {s.title}
            {s.key && <span className="keytag">关键</span>}
          </div>
          <div className="nar-text">{s.text}</div>
        </div>
      </div>

      <div className="controls">
        <button className="btn ghost" disabled={step === 0}
                onClick={() => setStep(Math.max(0, step - 1))}>← 上一步</button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep(step + 1)}>下一步 →</button>
        ) : (
          <button className="btn primary" onClick={() => setStep(0)}>↺ 再看一遍</button>
        )}
      </div>

      {step >= 4 && (
        <div className="alt">
          <button className="alt-toggle" onClick={() => setShowAlt(!showAlt)}>
            🔍 另一种看法：直接看出小本比明明多多少 {showAlt ? "▲" : "▼"}
          </button>
          {showAlt && (
            <div className="alt-body">
              <p>把两条线段对齐看：小本的线段比明明的线段长了一截，长出来的那块就是 <b>18 + 18 = 36</b>。</p>
              <AlternativeDiagram />
              <p className="alt-tip">为什么是两个 18？因为小本送出 18（自己 −18），明明收到 18（多 +18），<b>两人之间的差距一下子缩短了 2 × 18 = 36</b>。</p>
              <p>所以小本原来就比明明多 36 → 小本 = 35 + 36 = <b className="hl-pink">71</b> 枚。和我们刚才算的一样 ✓</p>
            </div>
          )}
        </div>
      )}

      <div className="parent-tip">
        家长小提示：让孩子先在纸上跟着画两条线段（明明短、小本长一点）。每一步问他"现在哪一段是粉色？""为什么明明变长了？"——孩子能讲出来，就是真懂了。
      </div>
    </div>
  );
}

/* ============ 练一练 ============ */
function makeProblem() {
  const a = 12 + Math.floor(Math.random() * 29);
  const t = 6 + Math.floor(Math.random() * 15);
  return { a, t };
}

function MiniDiagram({ a, t, stage }) {
  // stage: 0=刚开始 1=送过去后 2=还回来后(显示答案)
  const total = a + 2 * t;
  const unit = Math.min(7, Math.floor(280 / total));
  const x0 = 50;
  const h = 32;
  const y1 = 50, y2 = 130;
  const w = 50 + total * unit + 30;
  const vh = 200;

  const pinkPos = stage === 1
    ? { x: x0 + a * unit, y: y1 }
    : { x: x0 + (a + t) * unit, y: y2 };

  const benBlueW = stage === 0 ? total * unit : (a + t) * unit;
  const benBlueDashed = stage === 0;
  const benLabel = stage === 0 ? "?" : (a + t);
  const benTotalLabel = stage === 0 ? "?" : (stage === 1 ? (a + t) : a + 2 * t);
  const mingTotalLabel = stage === 1 ? (a + t) : a;

  return (
    <svg viewBox={`0 0 ${w} ${vh}`} className="diagram mini" preserveAspectRatio="xMidYMid meet">
      <text x={8} y={y1 + h / 2 + 5} className="row-label ming-ink" style={{ fontSize: 14 }}>明明</text>
      <text x={8} y={y2 + h / 2 + 5} className="row-label ben-ink" style={{ fontSize: 14 }}>小本</text>

      <line x1={x0} y1={y1 - 6} x2={x0} y2={y2 + h + 6}
            stroke="#94A3B8" strokeWidth={1.2} strokeDasharray="2,3" />

      {/* 明明 */}
      <text x={x0 + (stage === 1 ? (a + t) : a) * unit / 2} y={y1 - 8}
            className="total-label ming-ink" style={{ fontSize: 12 }}>
        {mingTotalLabel} 枚
      </text>
      <rect x={x0} y={y1} width={a * unit} height={h} rx={5}
            fill="#F59E0B" stroke="#B45309" strokeWidth={1.8} />
      <text x={x0 + a * unit / 2} y={y1 + h / 2 + 5}
            className="seg-label" style={{ fontSize: 13 }}>{a}</text>

      {/* 小本 */}
      <rect x={x0} y={y2} width={benBlueW} height={h} rx={5}
            fill={benBlueDashed ? "#E8F1FE" : "#2F7DF6"}
            stroke="#1D4ED8" strokeWidth={1.8}
            strokeDasharray={benBlueDashed ? "4,3" : "none"} />
      <text x={x0 + benBlueW / 2} y={y2 + h / 2 + 5}
            className="seg-label" fill={benBlueDashed ? "#1D4ED8" : "#fff"}
            style={{ fontSize: 13 }}>{benLabel}</text>
      <text x={x0 + (stage === 0 ? total : (stage === 1 ? (a + t) : total)) * unit / 2}
            y={y2 + h + 18}
            className="total-label ben-ink" style={{ fontSize: 12 }}>
        {benTotalLabel} 枚
      </text>

      {/* 粉色 */}
      <rect x={pinkPos.x} y={pinkPos.y} width={t * unit} height={h} rx={5}
            fill="#EC4899" stroke="#BE185D" strokeWidth={1.8} />
      <text x={pinkPos.x + t * unit / 2} y={pinkPos.y + h / 2 + 5}
            className="seg-label" style={{ fontSize: 13 }}>{t}</text>
    </svg>
  );
}

function SubStep({ n, question, hint, answer, locked, solved, onSolved }) {
  const [val, setVal] = useState("");
  const [status, setStatus] = useState(null);
  const [showHint, setShowHint] = useState(false);

  function check() {
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) { setStatus("no"); return; }
    if (num === answer) { setStatus("ok"); onSolved(); }
    else { setStatus("no"); }
  }

  if (locked) return (
    <div className="sub locked">
      <span className="sub-num">{n}</span>
      <span className="sub-lock">先答上一题…</span>
    </div>
  );

  return (
    <div className={"sub" + (solved ? " ok" : "")}>
      <div className="sub-q"><span className="sub-num">{n}</span>{question}</div>
      <div className="sub-row">
        <input className="sub-input" inputMode="numeric"
               value={solved ? answer : val}
               disabled={solved}
               onChange={(e) => { setVal(e.target.value.replace(/[^0-9]/g, "")); setStatus(null); }}
               onKeyDown={(e) => { if (e.key === "Enter") check(); }}
               placeholder="?" />
        <span className="sub-unit">枚</span>
        {!solved && <button className="btn small" onClick={check}>检查</button>}
        {solved && <span className="sub-ok">✓</span>}
      </div>
      {!solved && status === "no" && <div className="sub-msg">再想想，差一点点～</div>}
      {!solved && (
        <button className="hint-link" onClick={() => setShowHint(!showHint)}>
          {showHint ? "看线段图：" + hint : "看一眼提示？"}
        </button>
      )}
    </div>
  );
}

function Practice() {
  const [{ a, t }, setProb] = useState(makeProblem);
  const [pstep, setPstep] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const s1 = a + t, s2 = a + t, s3 = a + 2 * t;

  function nextProblem() {
    setProb(makeProblem());
    setPstep(0);
  }

  return (
    <div>
      <div className="prob-card">
        <div className="prob-tag">练习题</div>
        <p className="prob-text">
          明明有 <b className="hl-ming">{a}</b> 枚邮票，小本送他 <b className="hl-pink">{t}</b> 枚后两人一样多。<br />
          小本原来有几枚？
        </p>
        {solvedCount > 0 && (
          <div className="stars">已答对 {solvedCount} 题 {"⭐".repeat(Math.min(solvedCount, 5))}</div>
        )}
      </div>

      <div className="mini-wrap">
        <MiniDiagram a={a} t={t} stage={Math.min(pstep, 2)} />
      </div>

      <SubStep n="①" question={`看线段图，明明收到 ${t} 枚后一共多少？`}
               hint={`明明 ${a} + 粉色 ${t}`} answer={s1}
               locked={false} solved={pstep > 0}
               onSolved={() => setPstep(Math.max(pstep, 1))} />
      <SubStep n="②" question="送完一样多 → 小本现在那段蓝色是多少？"
               hint="和明明一样" answer={s2}
               locked={pstep < 1} solved={pstep > 1}
               onSolved={() => setPstep(Math.max(pstep, 2))} />
      <SubStep n="③" question={`把 ${t} 枚还回小本，他原来有多少？`}
               hint={`蓝色 ${s2} + 粉色 ${t}`} answer={s3}
               locked={pstep < 2} solved={pstep > 2}
               onSolved={() => { setPstep(3); setSolvedCount((c) => c + 1); }} />

      {pstep >= 3 && (
        <div className="win">
          🎉 答对了！小本原来有 <b>{s3}</b> 枚<br />
          <span className="win-check">检验：{a} + {t} = {s1}，{s3} − {t} = {s2} ✓</span>
          <button className="btn primary block" onClick={nextProblem}>再来一题 →</button>
        </div>
      )}
    </div>
  );
}

/* ============ 主组件 ============ */
export default function StampLineSegmentLesson() {
  const [tab, setTab] = useState("learn");
  return (
    <div className="root">
      <style>{CSS}</style>
      <div className="app">
        <header className="header">
          <div className="logo">📏</div>
          <div>
            <h1>邮票一样多 · 线段图</h1>
            <p>用"长短"看数量：明明 35 枚，小本送他 18 枚后两人一样多，小本原来几枚？</p>
          </div>
        </header>

        <div className="tabs">
          <button className={"tab" + (tab === "learn" ? " on" : "")}
                  onClick={() => setTab("learn")}>📐 跟我学</button>
          <button className={"tab" + (tab === "practice" ? " on" : "")}
                  onClick={() => setTab("practice")}>✏️ 练一练</button>
        </div>

        {tab === "learn" ? <Learn /> : <Practice />}
      </div>
    </div>
  );
}

/* ============ 样式 ============ */
const CSS = `
.root{
  --paper:#EFF2F7; --surface:#FFFFFF; --ink:#15233B; --muted:#62718B; --line:#DBE4F0;
  --ming:#F59E0B; --ming-bg:#FEF3D6; --ming-deep:#B45309;
  --ben:#2F7DF6; --ben-bg:#DCEAFE; --ben-deep:#1D4ED8;
  --pink:#EC4899; --pink-bg:#FBDCEC; --pink-deep:#BE185D;
  --ok:#16A34A; --ok-bg:#DCFCE7;
  min-height:100vh; padding:14px;
  background:
    radial-gradient(circle at 0% 0%, #DDE6F7 0, rgba(221,230,247,0) 35%),
    radial-gradient(circle at 100% 10%, #F6E0EC 0, rgba(246,224,236,0) 38%),
    var(--paper);
  font-family:"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif;
  color:var(--ink); -webkit-font-smoothing:antialiased;
}
*{ box-sizing:border-box; }
.app{ max-width:880px; margin:0 auto; }

.header{ display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.logo{ width:54px;height:54px; border-radius:16px; display:grid; place-items:center;
  background:#fff; border:2px solid var(--line); font-size:30px;
  box-shadow:0 6px 16px rgba(47,125,246,.12); flex:none; }
.header h1{ margin:0; font-size:24px; font-weight:800; letter-spacing:.3px; }
.header p{ margin:3px 0 0; font-size:13px; color:var(--muted); line-height:1.55; }

.tabs{ display:flex; gap:8px; margin-bottom:16px; }
.tab{ flex:1; padding:12px; border-radius:14px; border:2px solid var(--line);
  background:#fff; font-size:16px; font-weight:700; color:var(--muted); cursor:pointer;
  font-family:inherit; transition:.15s; }
.tab.on{ background:var(--ink); color:#fff; border-color:var(--ink);
  box-shadow:0 6px 16px rgba(21,35,59,.22); }

/* 步骤条 */
.chips{ display:flex; gap:5px; margin-bottom:14px; flex-wrap:wrap; }
.chip{ flex:1 1 0; min-width:60px; padding:8px 4px; border-radius:12px;
  border:2px solid var(--line); background:#fff; font-size:12.5px; font-weight:700;
  color:var(--muted); cursor:pointer; display:flex; flex-direction:column;
  align-items:center; gap:3px; font-family:inherit; transition:.15s; }
.chip-num{ width:20px; height:20px; border-radius:50%; background:#EEF2F8;
  color:var(--muted); display:grid; place-items:center; font-size:11.5px; }
.chip.active{ border-color:var(--ben); color:var(--ben-deep); background:var(--ben-bg); }
.chip.active .chip-num{ background:var(--ben); color:#fff; }
.chip.done{ border-color:#C8E6CF; color:var(--ok); }
.chip.done .chip-num{ background:var(--ok); color:#fff; }

/* 线段图容器 */
.diagram-wrap{ background:#fff; border:2px solid var(--line); border-radius:18px;
  padding:8px; overflow:hidden; }
.diagram{ width:100%; height:auto; display:block; }
.diagram rect, .diagram text, .diagram line{
  transition: x 0.65s cubic-bezier(.4,0,.2,1),
              y 0.65s cubic-bezier(.4,0,.2,1),
              width 0.65s cubic-bezier(.4,0,.2,1),
              opacity 0.45s ease;
}
.row-label{ font-size:17px; font-weight:800; }
.ming-ink{ fill:var(--ming-deep); }
.ben-ink{ fill:var(--ben-deep); }
.seg-label{ font-size:16px; font-weight:800; fill:#fff; text-anchor:middle;
  pointer-events:none; letter-spacing:.5px; }
.pink-text{ fill:#fff; }
.total-label{ font-size:14.5px; font-weight:800; text-anchor:middle; }

/* 讲解卡 */
.narration{ margin-top:14px; background:#fff; border:2px solid var(--line);
  border-radius:18px; padding:14px; display:flex; gap:12px; align-items:flex-start; }
.narration.key{ border-color:var(--pink); background:linear-gradient(0deg,var(--pink-bg),#fff 70%); }
.nar-icon{ font-size:26px; flex:none; }
.nar-title{ font-size:17px; font-weight:800; margin-bottom:4px; }
.keytag{ font-size:11px; background:var(--pink); color:#fff; padding:2px 8px;
  border-radius:999px; margin-left:8px; vertical-align:middle; font-weight:800; }
.nar-text{ font-size:15px; line-height:1.65; color:#2A3A55; }

/* 按钮 */
.controls{ display:flex; gap:10px; margin-top:14px; }
.btn{ font-family:inherit; font-weight:800; border-radius:14px; cursor:pointer;
  border:2px solid transparent; padding:13px 18px; font-size:16px; transition:.15s; }
.btn.primary{ flex:1; background:var(--ben); color:#fff;
  box-shadow:0 6px 16px rgba(47,125,246,.3); }
.btn.primary:active{ transform:translateY(1px); }
.btn.ghost{ background:#fff; color:var(--muted); border-color:var(--line); }
.btn.ghost:disabled{ opacity:.4; cursor:default; }
.btn.small{ padding:9px 16px; font-size:14px; background:var(--ben); color:#fff; }
.btn.block{ width:100%; margin-top:12px; }

/* 另一种看法 */
.alt{ margin-top:12px; }
.alt-toggle{ width:100%; text-align:left; background:#FFF7E8;
  border:2px solid #F6E0B0; color:var(--ming-deep); font-weight:800;
  padding:11px 14px; border-radius:14px; font-size:14px;
  cursor:pointer; font-family:inherit; }
.alt-body{ background:#fff; border:2px solid var(--line); border-top:none;
  border-radius:0 0 14px 14px; padding:14px; font-size:14px;
  line-height:1.7; color:#2A3A55; }
.alt-body p{ margin:0 0 10px; }
.alt-body .diagram.alt{ background:#FAFBFD; border-radius:10px;
  border:1px dashed var(--line); margin:8px 0; }
.alt-tip{ background:var(--pink-bg); border-radius:10px; padding:9px 12px;
  border-left:4px solid var(--pink); }
.hl-pink{ color:var(--pink-deep); font-size:18px; }
.hl-ming{ color:var(--ming-deep); }

.parent-tip{ margin-top:16px; font-size:12.5px; color:var(--muted);
  line-height:1.6; background:#fff; border:2px dashed var(--line);
  border-radius:14px; padding:11px 13px; }

/* 练习 */
.prob-card{ background:#fff; border:2px solid var(--line); border-radius:18px;
  padding:16px; position:relative; }
.prob-tag{ position:absolute; top:-11px; left:16px; background:var(--ben);
  color:#fff; font-size:12px; font-weight:800; padding:3px 12px; border-radius:999px; }
.prob-text{ margin:6px 0 0; font-size:17px; line-height:1.7; font-weight:600; }
.stars{ margin-top:8px; font-size:13px; font-weight:800; color:var(--ming-deep); }

.mini-wrap{ background:#fff; border:2px solid var(--line); border-radius:14px;
  padding:6px; margin-top:12px; overflow:hidden; }
.diagram.mini rect, .diagram.mini text{
  transition: x 0.5s cubic-bezier(.4,0,.2,1), y 0.5s cubic-bezier(.4,0,.2,1),
              width 0.5s cubic-bezier(.4,0,.2,1), opacity 0.4s ease; }

.sub{ background:#fff; border:2px solid var(--line); border-radius:16px;
  padding:14px; margin-top:12px; }
.sub.ok{ border-color:#C8E6CF; background:linear-gradient(0deg,var(--ok-bg),#fff 80%); }
.sub.locked{ opacity:.5; display:flex; align-items:center; gap:8px; }
.sub-num{ display:inline-grid; place-items:center; width:24px; height:24px;
  border-radius:50%; background:var(--ben-bg); color:var(--ben-deep);
  font-weight:800; font-size:13px; margin-right:8px; }
.sub-lock{ color:var(--muted); font-weight:700; font-size:14px; }
.sub-q{ font-size:15.5px; font-weight:700; line-height:1.55; }
.sub-row{ display:flex; align-items:center; gap:8px; margin-top:11px; }
.sub-input{ width:92px; padding:11px 12px; font-size:20px; font-weight:800;
  text-align:center; border:2px solid var(--line); border-radius:12px;
  font-family:inherit; color:var(--ink); }
.sub-input:focus{ outline:none; border-color:var(--ben); }
.sub-input:disabled{ background:var(--ok-bg); border-color:#C8E6CF; color:var(--ok); }
.sub-unit{ font-size:14px; color:var(--muted); font-weight:700; }
.sub-ok{ color:var(--ok); font-weight:800; font-size:18px; }
.sub-msg{ margin-top:8px; font-size:13px; font-weight:700; color:#DC2626; }
.hint-link{ display:block; margin-top:9px; background:none; border:none; padding:0;
  color:var(--ben-deep); font-weight:700; font-size:13px; cursor:pointer;
  font-family:inherit; text-align:left; }

.win{ margin-top:14px; background:linear-gradient(135deg,#FFF7E8,#FBDCEC);
  border:2px solid var(--pink); border-radius:18px; padding:18px;
  text-align:center; font-size:17px; font-weight:700; line-height:1.7; }
.win b{ font-size:22px; color:var(--pink-deep); }
.win-check{ font-size:13px; color:var(--muted); font-weight:700; }

@media (prefers-reduced-motion: reduce){
  .diagram rect, .diagram text, .diagram line{ transition:none; }
}
`;
