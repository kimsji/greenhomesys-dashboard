import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const FIRESTORE_DOC = "dashboards";
const FIRESTORE_ID = "greenhomesys";

const defaultData = {
  keywords: [],
  posts: [],
  inquiries: [],
  blogStats: [],
  competitors: [],
  goals: [],
  todos: [],
};

const formatDate = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};
const shortDate = (d) => { const date = new Date(d); return `${date.getMonth() + 1}/${date.getDate()}`; };
const getMonthKey = (d) => { const date = new Date(d); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const monthLabel = (m) => m.replace("-", "년 ") + "월";

// ── SVG Charts ──
function LineChart({ data, dataKey, color, height = 140, label }) {
  if (!data || data.length < 2) return <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>데이터 2개 이상 필요</div>;
  const w = 500, pad = { t: 20, r: 20, b: 30, l: 45 }, cW = w - pad.l - pad.r, cH = height - pad.t - pad.b;
  const vals = data.map((d) => d[dataKey] || 0), max = Math.max(...vals, 1), min = Math.min(...vals, 0), range = max - min || 1;
  const pts = data.map((d, i) => ({ x: pad.l + (i / (data.length - 1)) * cW, y: pad.t + cH - ((vals[i] - min) / range) * cH, v: vals[i], date: d.date }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${pad.t + cH} L ${pts[0].x} ${pad.t + cH} Z`;
  const gV = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  return (
    <div style={{ marginBottom: 4 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</div>}
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto" }}>
        {gV.map((v, i) => { const y = pad.t + cH - ((v - min) / range) * cH; return (<g key={i}><line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" /><text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v)}</text></g>); })}
        <defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>
        <path d={area} fill={`url(#g-${dataKey})`} /><path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
        {pts.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((p, i) => <text key={i} x={p.x} y={pad.t + cH + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{shortDate(p.date)}</text>)}
      </svg>
    </div>
  );
}

function MultiLineChart({ data, lines, height = 160, label }) {
  if (!data || data.length < 2) return <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>데이터 2개 이상 필요</div>;
  const w = 500, pad = { t: 20, r: 20, b: 30, l: 45 }, cW = w - pad.l - pad.r, cH = height - pad.t - pad.b;
  const allV = lines.flatMap((l) => data.map((d) => d[l.key] || 0)), max = Math.max(...allV, 1), min = Math.min(...allV, 0), range = max - min || 1;
  const gV = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  return (
    <div style={{ marginBottom: 4 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</div>}
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto" }}>
        {gV.map((v, i) => { const y = pad.t + cH - ((v - min) / range) * cH; return (<g key={i}><line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" /><text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(v)}</text></g>); })}
        {lines.map((ln) => { const pts = data.map((d, i) => ({ x: pad.l + (i / (data.length - 1)) * cW, y: pad.t + cH - (((d[ln.key] || 0) - min) / range) * cH })); const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "); return (<g key={ln.key}><path d={path} fill="none" stroke={ln.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={ln.color} strokeWidth="2" />)}</g>); })}
        {data.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((d, i) => { const idx = data.indexOf(d); const x = pad.l + (idx / (data.length - 1)) * cW; return <text key={i} x={x} y={pad.t + cH + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{shortDate(d.date)}</text>; })}
      </svg>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>{lines.map((l) => <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />{l.label}</div>)}</div>
    </div>
  );
}

function RankChart({ data, height = 120 }) {
  if (!data || data.length < 1) return null;
  const w = 500, pad = { t: 20, r: 20, b: 30, l: 45 }, cW = w - pad.l - pad.r, cH = height - pad.t - pad.b;
  const maxR = Math.max(...data.map((d) => d.rank), 20);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height: "auto" }}>
      {[1, 5, 10, 15, 20].filter((v) => v <= maxR + 5).map((v) => { const y = pad.t + (v / (maxR + 2)) * cH; return (<g key={v}><line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke={v === 5 ? "#bbf7d0" : "#e2e8f0"} strokeWidth={v === 5 ? 2 : 1} /><text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill={v === 5 ? "#059669" : "#94a3b8"}>{v}위</text></g>); })}
      {data.length > 1 && <path d={data.map((d, i) => { const x = pad.l + (i / (data.length - 1)) * cW; const y = pad.t + (d.rank / (maxR + 2)) * cH; return `${i === 0 ? "M" : "L"} ${x} ${y}`; }).join(" ")} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />}
      {data.map((d, i) => { const x = pad.l + (i / (data.length - 1 || 1)) * cW; const y = pad.t + (d.rank / (maxR + 2)) * cH; const c = d.rank <= 5 ? "#059669" : d.rank <= 15 ? "#d97706" : "#dc2626"; return (<g key={i}><circle cx={x} cy={y} r="4" fill="#fff" stroke={c} strokeWidth="2.5" /><text x={x} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{d.rank}</text><text x={x} y={pad.t + cH + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{shortDate(d.date)}</text></g>); })}
    </svg>
  );
}

// ── Progress Bar ──
function ProgressBar({ current, target, color = "#2563eb" }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? "#059669" : "#334155", minWidth: 42, textAlign: "right" }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function App() {
  const [data, setData] = useState(defaultData);
  const [activeTab, setActiveTab] = useState("overview");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setData({ ...defaultData, ...docSnap.data() });
      } catch (e) { console.error("Firebase load error:", e); }
      setLoading(false);
    })();
  }, []);

  const saveData = useCallback(async (nd) => {
    setData(nd);
    try { await setDoc(doc(db, FIRESTORE_DOC, FIRESTORE_ID), nd); } catch (e) { console.error("Firebase save error:", e); }
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // ── Blog Stats ──
  const addBlogStat = () => {
    const { date, visitors, neighbors } = formData;
    if (!date) return;
    const existing = (data.blogStats || []).filter((s) => s.date !== date);
    const ns = [...existing, { date, visitors: parseInt(visitors) || 0, neighbors: parseInt(neighbors) || 0 }].sort((a, b) => a.date.localeCompare(b.date));
    saveData({ ...data, blogStats: ns }); setModal(null); setFormData({}); showToast("블로그 현황 기록됨");
  };
  const deleteBlogStat = (date) => { saveData({ ...data, blogStats: (data.blogStats || []).filter((s) => s.date !== date) }); showToast("삭제됨"); };

  // ── Keywords (with search volume) ──
  const addKeyword = () => {
    const { keyword, category, rank, date, searchVolume } = formData;
    if (!keyword) return;
    const nk = { id: Date.now().toString(), keyword, category: category || "일반", searchVolume: parseInt(searchVolume) || 0, history: [{ date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) || 0 }] };
    saveData({ ...data, keywords: [...data.keywords, nk] }); setModal(null); setFormData({}); showToast("키워드 추가됨");
  };
  const updateKeywordRank = (id) => {
    const { rank, date } = formData; if (!rank) return;
    const kws = data.keywords.map((k) => k.id === id ? { ...k, history: [...k.history, { date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) }] } : k);
    saveData({ ...data, keywords: kws }); setModal(null); setFormData({}); showToast("순위 업데이트됨");
  };
  const deleteKeyword = (id) => { saveData({ ...data, keywords: data.keywords.filter((k) => k.id !== id) }); showToast("삭제됨"); };

  // ── Posts (with tags & memo) ──
  const addPost = () => {
    const { title, keyword, publishDate, views, visitors, tags, memo } = formData;
    if (!title) return;
    const np = { id: Date.now().toString(), title, keyword: keyword || "", publishDate: publishDate || new Date().toISOString().slice(0, 10), tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [], memo: memo || "", stats: [{ date: publishDate || new Date().toISOString().slice(0, 10), views: parseInt(views) || 0, visitors: parseInt(visitors) || 0 }] };
    saveData({ ...data, posts: [...data.posts, np] }); setModal(null); setFormData({}); showToast("글 추가됨");
  };
  const updatePostStats = (id) => {
    const { views, visitors, date } = formData;
    const posts = data.posts.map((p) => p.id === id ? { ...p, stats: [...p.stats, { date: date || new Date().toISOString().slice(0, 10), views: parseInt(views) || 0, visitors: parseInt(visitors) || 0 }] } : p);
    saveData({ ...data, posts }); setModal(null); setFormData({}); showToast("수치 업데이트됨");
  };
  const deletePost = (id) => { saveData({ ...data, posts: data.posts.filter((p) => p.id !== id) }); showToast("삭제됨"); };

  // ── Inquiries (with source post) ──
  const addInquiry = () => {
    const { date, source, content, converted, sourcePost } = formData;
    const ni = { id: Date.now().toString(), date: date || new Date().toISOString().slice(0, 10), source: source || "블로그", content: content || "", converted: converted === "yes", sourcePost: sourcePost || "" };
    saveData({ ...data, inquiries: [...data.inquiries, ni] }); setModal(null); setFormData({}); showToast("문의 추가됨");
  };
  const toggleConversion = (id) => { saveData({ ...data, inquiries: data.inquiries.map((i) => i.id === id ? { ...i, converted: !i.converted } : i) }); };
  const deleteInquiry = (id) => { saveData({ ...data, inquiries: data.inquiries.filter((i) => i.id !== id) }); showToast("삭제됨"); };

  // ── Competitors ──
  const addCompetitor = () => {
    const { name, keyword, rank, date } = formData;
    if (!name || !keyword) return;
    const nc = { id: Date.now().toString(), name, keyword, history: [{ date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) || 0 }] };
    saveData({ ...data, competitors: [...(data.competitors || []), nc] }); setModal(null); setFormData({}); showToast("경쟁사 추가됨");
  };
  const updateCompetitorRank = (id) => {
    const { rank, date } = formData; if (!rank) return;
    const comps = (data.competitors || []).map((c) => c.id === id ? { ...c, history: [...c.history, { date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) }] } : c);
    saveData({ ...data, competitors: comps }); setModal(null); setFormData({}); showToast("경쟁사 순위 업데이트됨");
  };
  const deleteCompetitor = (id) => { saveData({ ...data, competitors: (data.competitors || []).filter((c) => c.id !== id) }); showToast("삭제됨"); };

  // ── Goals ──
  const addGoal = () => {
    const { month, targetVisitors, targetInquiries, targetPosts } = formData;
    if (!month) return;
    const existing = (data.goals || []).filter((g) => g.month !== month);
    const ng = [...existing, { month, targetVisitors: parseInt(targetVisitors) || 0, targetInquiries: parseInt(targetInquiries) || 0, targetPosts: parseInt(targetPosts) || 0 }];
    saveData({ ...data, goals: ng }); setModal(null); setFormData({}); showToast("목표 설정됨");
  };

  // ── Todos ──
  const addTodo = () => {
    const { content, dueDate } = formData;
    if (!content) return;
    const nt = { id: Date.now().toString(), content, dueDate: dueDate || "", done: false, createdAt: new Date().toISOString().slice(0, 10) };
    saveData({ ...data, todos: [...(data.todos || []), nt] }); setModal(null); setFormData({}); showToast("할일 추가됨");
  };
  const toggleTodo = (id) => { saveData({ ...data, todos: (data.todos || []).map((t) => t.id === id ? { ...t, done: !t.done } : t) }); };
  const deleteTodo = (id) => { saveData({ ...data, todos: (data.todos || []).filter((t) => t.id !== id) }); showToast("삭제됨"); };

  // ── CSV Export ──
  const exportCSV = () => {
    let csv = "유형,항목,날짜,값1,값2,비고\n";
    (data.blogStats || []).forEach((b) => { csv += `블로그현황,방문자/이웃,${b.date},${b.visitors},${b.neighbors},\n`; });
    data.keywords.forEach((k) => { k.history.forEach((h) => { csv += `키워드,${k.keyword},${h.date},${h.rank},${k.searchVolume || 0},${k.category}\n`; }); });
    data.posts.forEach((p) => { const l = p.stats[p.stats.length - 1]; csv += `글,${p.title},${p.publishDate},${l?.views || 0},${l?.visitors || 0},${(p.tags || []).join("/")}\n`; });
    data.inquiries.forEach((q) => { csv += `문의,${q.content},${q.date},${q.converted ? "전환" : "미전환"},${q.source},${q.sourcePost || ""}\n`; });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `greenhomesys_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    showToast("CSV 다운로드 완료");
  };

  // ── Computed ──
  const stats = useMemo(() => {
    const totalPosts = data.posts.length;
    const totalViews = data.posts.reduce((s, p) => s + (p.stats[p.stats.length - 1]?.views || 0), 0);
    const totalVisitors = data.posts.reduce((s, p) => s + (p.stats[p.stats.length - 1]?.visitors || 0), 0);
    const totalInquiries = data.inquiries.length;
    const conversions = data.inquiries.filter((i) => i.converted).length;
    const conversionRate = totalInquiries > 0 ? ((conversions / totalInquiries) * 100).toFixed(1) : "0";
    const top5Keywords = [...data.keywords].map((k) => ({ ...k, latestRank: k.history[k.history.length - 1]?.rank || 99 })).sort((a, b) => a.latestRank - b.latestRank).slice(0, 5);
    const page1Keywords = data.keywords.filter((k) => { const l = k.history[k.history.length - 1]; return l && l.rank >= 1 && l.rank <= 5; }).length;
    const blogStats = data.blogStats || [];
    const latestBlog = blogStats.length > 0 ? blogStats[blogStats.length - 1] : null;
    return { totalPosts, totalViews, totalVisitors, totalInquiries, conversions, conversionRate, top5Keywords, page1Keywords, latestBlog, blogStats };
  }, [data]);

  // ── Growth Story ──
  const growthStory = useMemo(() => {
    const bs = data.blogStats || [];
    if (bs.length < 2) return null;
    const first = bs[0], last = bs[bs.length - 1];
    const vGrowth = first.visitors > 0 ? (((last.visitors - first.visitors) / first.visitors) * 100).toFixed(0) : last.visitors > 0 ? "∞" : "0";
    const nGrowth = last.neighbors - first.neighbors;
    const days = Math.ceil((new Date(last.date) - new Date(first.date)) / 86400000);
    return { firstDate: first.date, lastDate: last.date, days, firstVisitors: first.visitors, lastVisitors: last.visitors, vGrowth, nGrowth, firstNeighbors: first.neighbors, lastNeighbors: last.neighbors, page1Keywords: stats.page1Keywords, totalKeywords: data.keywords.length, totalInquiries: stats.totalInquiries, conversions: stats.conversions };
  }, [data, stats]);

  // ── Monthly Goal ──
  const currentGoal = useMemo(() => {
    const g = (data.goals || []).find((g) => g.month === selectedMonth);
    if (!g) return null;
    const mPosts = data.posts.filter((p) => getMonthKey(p.publishDate) === selectedMonth).length;
    const mBs = (data.blogStats || []).filter((b) => getMonthKey(b.date) === selectedMonth);
    const mVisitors = mBs.length > 0 ? mBs.reduce((s, b) => s + b.visitors, 0) : 0;
    const mInquiries = data.inquiries.filter((i) => getMonthKey(i.date) === selectedMonth).length;
    return { ...g, currentVisitors: mVisitors, currentInquiries: mInquiries, currentPosts: mPosts };
  }, [data, selectedMonth]);

  const monthlyReport = useMemo(() => {
    const mp = data.posts.filter((p) => getMonthKey(p.publishDate) === selectedMonth);
    const mi = data.inquiries.filter((i) => getMonthKey(i.date) === selectedMonth);
    const mbs = (data.blogStats || []).filter((s) => getMonthKey(s.date) === selectedMonth);
    const mV = mp.reduce((s, p) => s + (p.stats[p.stats.length - 1]?.views || 0), 0);
    const avgV = mbs.length > 0 ? Math.round(mbs.reduce((s, b) => s + b.visitors, 0) / mbs.length) : 0;
    const mc = mi.filter((i) => i.converted).length;
    return { posts: mp.length, views: mV, inquiries: mi.length, conversions: mc, convRate: mi.length > 0 ? ((mc / mi.length) * 100).toFixed(1) : "0", avgDailyVisitors: avgV, latestNeighbors: mbs.length > 0 ? mbs[mbs.length - 1].neighbors : 0 };
  }, [data, selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set();
    data.posts.forEach((p) => months.add(getMonthKey(p.publishDate)));
    data.inquiries.forEach((i) => months.add(getMonthKey(i.date)));
    (data.blogStats || []).forEach((s) => months.add(getMonthKey(s.date)));
    (data.goals || []).forEach((g) => months.add(g.month));
    months.add(getMonthKey(new Date()));
    return [...months].sort().reverse();
  }, [data]);

  const resetAll = async () => { if (window.confirm("모든 데이터를 초기화하시겠습니까?")) { await saveData(defaultData); showToast("초기화 완료"); } };

  if (loading) return <div style={z.loading}>불러오는 중...</div>;

  const tabs = [
    { id: "overview", label: "종합", icon: "◈" },
    { id: "blogstats", label: "블로그", icon: "◇" },
    { id: "keywords", label: "키워드", icon: "◎" },
    { id: "posts", label: "글 성과", icon: "▤" },
    { id: "inquiries", label: "문의", icon: "◉" },
    { id: "goals", label: "목표", icon: "◆" },
    { id: "competitors", label: "경쟁", icon: "⊞" },
    { id: "todos", label: "할일", icon: "☐" },
    { id: "report", label: "리포트", icon: "▧" },
  ];

  return (
    <div style={z.container}>
      {toast && <div style={z.toast}>{toast}</div>}
      <div style={z.header}>
        <div>
          <div style={z.headerBrand}>ONAD AGENCY</div>
          <h1 style={z.headerTitle}>그린홈시스 블로그 성과 대시보드</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCSV} style={z.resetBtn}>⬇ CSV</button>
          <button onClick={resetAll} style={z.resetBtn}>↺ 초기화</button>
        </div>
      </div>

      <div style={z.tabBar}>{tabs.map((t) => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ ...z.tab, ...(activeTab === t.id ? z.tabActive : {}) }}><span style={z.tabIcon}>{t.icon}</span>{t.label}</button>)}</div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === "overview" && (
        <div>
          <div style={z.statGrid}>
            {[
              { l: "발행 글", v: stats.totalPosts, u: "건", c: "#2563eb" },
              { l: "총 조회수", v: stats.totalViews.toLocaleString(), u: "회", c: "#0891b2" },
              { l: "총 문의", v: stats.totalInquiries, u: "건", c: "#d97706" },
              { l: "계약 전환", v: stats.conversions, u: "건", c: "#dc2626" },
              { l: "전환율", v: stats.conversionRate, u: "%", c: "#7c3aed" },
              { l: "이웃수", v: stats.latestBlog?.neighbors || 0, u: "명", c: "#059669" },
            ].map((item, i) => <div key={i} style={{ ...z.statCard, borderLeft: `4px solid ${item.c}` }}><div style={z.statLabel}>{item.l}</div><div style={z.statValue}>{item.v}<span style={z.statUnit}>{item.u}</span></div></div>)}
          </div>

          {stats.blogStats.length >= 2 && (
            <div style={z.section}><h3 style={z.sectionTitle}>블로그 방문자 추이</h3><div style={z.chartCard}>
              <MultiLineChart data={stats.blogStats.slice(-14)} lines={[{ key: "visitors", color: "#2563eb", label: "방문자" }, { key: "neighbors", color: "#059669", label: "이웃" }]} height={160} />
            </div></div>
          )}

          {growthStory && (
            <div style={z.section}><h3 style={z.sectionTitle}>성장 스토리</h3>
              <div style={{ ...z.chartCard, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#166534", marginBottom: 10 }}>{growthStory.days}일간의 성장 기록</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: "#334155" }}>
                  <p style={{ margin: "0 0 6px" }}>일일 방문자: {growthStory.firstVisitors}명 → {growthStory.lastVisitors}명 ({growthStory.vGrowth}% 증가)</p>
                  <p style={{ margin: "0 0 6px" }}>이웃수: {growthStory.firstNeighbors}명 → {growthStory.lastNeighbors}명 (+{growthStory.nGrowth}명)</p>
                  {growthStory.totalKeywords > 0 && <p style={{ margin: "0 0 6px" }}>1페이지 노출 키워드: {growthStory.page1Keywords}/{growthStory.totalKeywords}개</p>}
                  {growthStory.totalInquiries > 0 && <p style={{ margin: 0 }}>총 문의 {growthStory.totalInquiries}건, 계약 {growthStory.conversions}건</p>}
                </div>
              </div>
            </div>
          )}

          {stats.top5Keywords.length > 0 && (
            <div style={z.section}><h3 style={z.sectionTitle}>TOP 키워드</h3><div style={z.miniTable}>{stats.top5Keywords.map((k, i) => (
              <div key={k.id} style={z.miniRow}><span style={z.miniRankBadge}>{i + 1}</span><span style={z.miniKeyword}>{k.keyword}{k.searchVolume > 0 && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>월{k.searchVolume.toLocaleString()}</span>}</span><span style={{ ...z.miniRank, color: k.latestRank <= 5 ? "#059669" : k.latestRank <= 15 ? "#d97706" : "#dc2626" }}>{k.latestRank}위</span></div>
            ))}</div></div>
          )}
        </div>
      )}

      {/* ═══ BLOG STATS ═══ */}
      {activeTab === "blogstats" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>블로그 방문자수 · 이웃수</h3><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal("addBlogStat"); }} style={z.addBtn}>+ 기록</button></div>
          {(data.blogStats || []).length >= 2 && <div style={z.chartCard}><MultiLineChart data={(data.blogStats || []).slice(-30)} lines={[{ key: "visitors", color: "#2563eb", label: "방문자" }, { key: "neighbors", color: "#059669", label: "이웃" }]} height={180} /></div>}
          {(data.blogStats || []).length === 0 ? <div style={z.empty}><p>기록이 없습니다</p><p style={z.emptyHint}>매일 또는 매주 블로그 방문자수와 이웃수를 기록하세요</p></div> : (
            <div style={z.cardList}>{[...(data.blogStats || [])].reverse().slice(0, 20).map((bs) => (
              <div key={bs.date} style={z.blogStatRow}><span style={z.blogStatDate}>{formatDate(bs.date)}</span><div style={z.blogStatValues}><span style={z.blogStatItem}><span style={z.dot1} />방문자 {bs.visitors}</span><span style={z.blogStatItem}><span style={z.dot2} />이웃 {bs.neighbors}</span></div><button onClick={() => deleteBlogStat(bs.date)} style={z.deleteBtn}>삭제</button></div>
            ))}</div>
          )}
        </div>
      )}

      {/* ═══ KEYWORDS ═══ */}
      {activeTab === "keywords" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>키워드별 네이버 순위</h3><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal("addKeyword"); }} style={z.addBtn}>+ 추가</button></div>
          {data.keywords.length === 0 ? <div style={z.empty}><p>키워드를 추가하세요</p></div> : (
            <div style={z.cardList}>{data.keywords.map((k) => {
              const latest = k.history[k.history.length - 1]; const prev = k.history.length > 1 ? k.history[k.history.length - 2] : null; const diff = prev ? prev.rank - latest.rank : 0;
              return (
                <div key={k.id} style={z.kwCard}>
                  <div style={z.kwTop}>
                    <div><span style={z.kwCategory}>{k.category}</span><div style={z.kwName}>{k.keyword}</div>{k.searchVolume > 0 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>월간 검색량: {k.searchVolume.toLocaleString()}</div>}</div>
                    <div style={z.kwRankBox}><div style={{ ...z.kwRank, color: latest.rank <= 5 ? "#059669" : latest.rank <= 15 ? "#d97706" : "#94a3b8" }}>{latest.rank > 0 ? `${latest.rank}위` : "미확인"}</div>{diff !== 0 && <div style={{ ...z.kwDiff, color: diff > 0 ? "#059669" : "#dc2626" }}>{diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}</div>}</div>
                  </div>
                  {k.history.length >= 2 && <div style={{ ...z.chartCard, marginTop: 12 }}><RankChart data={k.history.slice(-10)} /></div>}
                  <div style={z.kwActions}><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal({ type: "updateKeyword", id: k.id }); }} style={z.smallBtn}>순위 업데이트</button><button onClick={() => deleteKeyword(k.id)} style={z.deleteBtn}>삭제</button></div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}

      {/* ═══ POSTS ═══ */}
      {activeTab === "posts" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>글별 성과</h3><button onClick={() => { setFormData({ publishDate: new Date().toISOString().slice(0, 10) }); setModal("addPost"); }} style={z.addBtn}>+ 추가</button></div>
          {data.posts.length === 0 ? <div style={z.empty}><p>글을 추가하세요</p></div> : (
            <div style={z.cardList}>{data.posts.map((p) => {
              const latest = p.stats[p.stats.length - 1];
              const linkedInquiries = data.inquiries.filter((i) => i.sourcePost === p.id);
              return (
                <div key={p.id} style={z.postCard}>
                  <div style={z.postTitle}>{p.title}</div>
                  <div style={z.postMeta}>
                    {p.keyword && <span style={z.postKeyword}>{p.keyword}</span>}
                    {(p.tags || []).map((t, i) => <span key={i} style={z.postTag}>{t}</span>)}
                    <span>{formatDate(p.publishDate)}</span>
                  </div>
                  {p.memo && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>메모: {p.memo}</div>}
                  <div style={z.postStats}>
                    <div style={z.postStatItem}><div style={z.postStatLabel}>조회수</div><div style={z.postStatValue}>{(latest?.views || 0).toLocaleString()}</div></div>
                    <div style={z.postStatItem}><div style={z.postStatLabel}>방문자</div><div style={z.postStatValue}>{(latest?.visitors || 0).toLocaleString()}</div></div>
                    <div style={z.postStatItem}><div style={z.postStatLabel}>문의</div><div style={{ ...z.postStatValue, color: linkedInquiries.length > 0 ? "#d97706" : "#0f172a" }}>{linkedInquiries.length}건</div></div>
                  </div>
                  {p.stats.length >= 2 && <div style={{ ...z.chartCard, marginTop: 10 }}><MultiLineChart data={p.stats.slice(-10)} lines={[{ key: "views", color: "#0891b2", label: "조회수" }, { key: "visitors", color: "#2563eb", label: "방문자" }]} height={110} /></div>}
                  <div style={z.kwActions}><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal({ type: "updatePost", id: p.id }); }} style={z.smallBtn}>수치 업데이트</button><button onClick={() => deletePost(p.id)} style={z.deleteBtn}>삭제</button></div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}

      {/* ═══ INQUIRIES ═══ */}
      {activeTab === "inquiries" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>문의 · 전환 추적</h3><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10), source: "블로그" }); setModal("addInquiry"); }} style={z.addBtn}>+ 추가</button></div>
          <div style={z.inquirySummary}>
            <div style={z.iqSumItem}><span style={z.iqSumLabel}>총 문의</span><span style={z.iqSumValue}>{stats.totalInquiries}건</span></div>
            <div style={z.iqSumDivider} />
            <div style={z.iqSumItem}><span style={z.iqSumLabel}>전환</span><span style={{ ...z.iqSumValue, color: "#059669" }}>{stats.conversions}건</span></div>
            <div style={z.iqSumDivider} />
            <div style={z.iqSumItem}><span style={z.iqSumLabel}>전환율</span><span style={{ ...z.iqSumValue, color: "#7c3aed" }}>{stats.conversionRate}%</span></div>
          </div>
          {data.inquiries.length === 0 ? <div style={z.empty}><p>기록된 문의가 없습니다</p></div> : (
            <div style={z.cardList}>{[...data.inquiries].reverse().map((inq) => {
              const srcPost = data.posts.find((p) => p.id === inq.sourcePost);
              return (
                <div key={inq.id} style={{ ...z.inqCard, borderLeft: `4px solid ${inq.converted ? "#059669" : "#e2e8f0"}` }}>
                  <div style={z.inqTop}>
                    <div>
                      <div style={z.inqDate}>{formatDate(inq.date)}</div>
                      <div style={z.inqContent}>{inq.content || "(미입력)"}</div>
                      <div style={z.inqSource}>유입: {inq.source}{srcPost && <span> · 글: {srcPost.title}</span>}</div>
                    </div>
                    <div style={z.inqRight}>
                      <button onClick={() => toggleConversion(inq.id)} style={{ ...z.convBtn, background: inq.converted ? "#059669" : "#e2e8f0", color: inq.converted ? "#fff" : "#64748b" }}>{inq.converted ? "계약완료" : "미전환"}</button>
                      <button onClick={() => deleteInquiry(inq.id)} style={z.deleteBtn}>삭제</button>
                    </div>
                  </div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}

      {/* ═══ GOALS ═══ */}
      {activeTab === "goals" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>월간 목표 & 달성률</h3><button onClick={() => { setFormData({ month: getMonthKey(new Date()) }); setModal("addGoal"); }} style={z.addBtn}>+ 목표 설정</button></div>
          <div style={{ marginBottom: 12 }}><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={z.monthSelect}>{availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></div>
          {currentGoal ? (
            <div style={z.chartCard}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{monthLabel(selectedMonth)} 목표</div>
              {currentGoal.targetPosts > 0 && <div style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span>발행 글</span><span>{currentGoal.currentPosts} / {currentGoal.targetPosts}건</span></div><ProgressBar current={currentGoal.currentPosts} target={currentGoal.targetPosts} color="#2563eb" /></div>}
              {currentGoal.targetVisitors > 0 && <div style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span>총 방문자</span><span>{currentGoal.currentVisitors.toLocaleString()} / {currentGoal.targetVisitors.toLocaleString()}</span></div><ProgressBar current={currentGoal.currentVisitors} target={currentGoal.targetVisitors} color="#059669" /></div>}
              {currentGoal.targetInquiries > 0 && <div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span>문의 건수</span><span>{currentGoal.currentInquiries} / {currentGoal.targetInquiries}건</span></div><ProgressBar current={currentGoal.currentInquiries} target={currentGoal.targetInquiries} color="#d97706" /></div>}
            </div>
          ) : <div style={z.empty}><p>{monthLabel(selectedMonth)}의 목표가 없습니다</p><p style={z.emptyHint}>목표를 설정하면 달성률을 자동 계산합니다</p></div>}

          {growthStory && (
            <div style={{ marginTop: 20, ...z.chartCard, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#166534", marginBottom: 10 }}>성장 스토리 ({growthStory.days}일)</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: "#334155" }}>
                <p style={{ margin: "0 0 4px" }}>방문자 {growthStory.firstVisitors} → {growthStory.lastVisitors}명 ({growthStory.vGrowth}%↑)</p>
                <p style={{ margin: "0 0 4px" }}>이웃 {growthStory.firstNeighbors} → {growthStory.lastNeighbors}명 (+{growthStory.nGrowth})</p>
                {growthStory.totalInquiries > 0 && <p style={{ margin: 0 }}>문의 {growthStory.totalInquiries}건 · 계약 {growthStory.conversions}건</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ COMPETITORS ═══ */}
      {activeTab === "competitors" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>경쟁 블로그 벤치마크</h3><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal("addCompetitor"); }} style={z.addBtn}>+ 추가</button></div>
          {(data.competitors || []).length === 0 ? <div style={z.empty}><p>경쟁사를 추가하세요</p><p style={z.emptyHint}>같은 키워드의 경쟁 블로그 순위를 비교 추적합니다</p></div> : (
            <div style={z.cardList}>{(data.competitors || []).map((c) => {
              const latest = c.history[c.history.length - 1];
              const myKw = data.keywords.find((k) => k.keyword === c.keyword);
              const myRank = myKw ? myKw.history[myKw.history.length - 1]?.rank : null;
              return (
                <div key={c.id} style={z.kwCard}>
                  <div style={z.kwTop}>
                    <div><div style={{ fontSize: 11, color: "#94a3b8" }}>{c.keyword}</div><div style={z.kwName}>{c.name}</div></div>
                    <div style={z.kwRankBox}><div style={{ fontSize: 18, fontWeight: 800, color: "#64748b" }}>{latest.rank}위</div>{myRank && <div style={{ fontSize: 11, color: myRank < latest.rank ? "#059669" : "#dc2626", marginTop: 2 }}>우리: {myRank}위</div>}</div>
                  </div>
                  {c.history.length >= 2 && <div style={{ ...z.chartCard, marginTop: 12 }}><RankChart data={c.history.slice(-10)} /></div>}
                  <div style={z.kwActions}><button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal({ type: "updateCompetitor", id: c.id }); }} style={z.smallBtn}>순위 업데이트</button><button onClick={() => deleteCompetitor(c.id)} style={z.deleteBtn}>삭제</button></div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}

      {/* ═══ TODOS ═══ */}
      {activeTab === "todos" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>할일 메모</h3><button onClick={() => { setFormData({}); setModal("addTodo"); }} style={z.addBtn}>+ 추가</button></div>
          {(data.todos || []).length === 0 ? <div style={z.empty}><p>할일이 없습니다</p></div> : (
            <div style={z.cardList}>{(data.todos || []).filter((t) => !t.done).map((t) => (
              <div key={t.id} style={z.todoRow}>
                <button onClick={() => toggleTodo(t.id)} style={z.todoCheck}>☐</button>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t.content}</div>{t.dueDate && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>기한: {formatDate(t.dueDate)}</div>}</div>
                <button onClick={() => deleteTodo(t.id)} style={z.deleteBtn}>삭제</button>
              </div>
            ))}
            {(data.todos || []).filter((t) => t.done).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>완료됨</div>
                {(data.todos || []).filter((t) => t.done).map((t) => (
                  <div key={t.id} style={{ ...z.todoRow, opacity: 0.5 }}>
                    <button onClick={() => toggleTodo(t.id)} style={{ ...z.todoCheck, color: "#059669" }}>☑</button>
                    <div style={{ flex: 1, textDecoration: "line-through" }}><div style={{ fontSize: 14 }}>{t.content}</div></div>
                    <button onClick={() => deleteTodo(t.id)} style={z.deleteBtn}>삭제</button>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* ═══ REPORT ═══ */}
      {activeTab === "report" && (
        <div>
          <div style={z.sectionHeader}><h3 style={z.sectionTitle}>월간 리포트</h3><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={z.monthSelect}>{availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></div>
          <div style={z.reportGrid}>
            {[
              { l: "발행", v: monthlyReport.posts, u: "건" }, { l: "조회수", v: monthlyReport.views.toLocaleString(), u: "회" }, { l: "문의", v: monthlyReport.inquiries, u: "건" },
              { l: "전환", v: monthlyReport.conversions, u: "건" }, { l: "일평균 방문", v: monthlyReport.avgDailyVisitors, u: "명" }, { l: "이웃", v: monthlyReport.latestNeighbors, u: "명" },
            ].map((i, idx) => <div key={idx} style={z.reportCard}><div style={z.reportLabel}>{i.l}</div><div style={z.reportValue}>{i.v}<span style={z.reportUnit}>{i.u}</span></div></div>)}
          </div>
          {currentGoal && (
            <div style={{ ...z.chartCard, marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>목표 달성률</div>
              {currentGoal.targetPosts > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, marginBottom: 4 }}>발행: {currentGoal.currentPosts}/{currentGoal.targetPosts}</div><ProgressBar current={currentGoal.currentPosts} target={currentGoal.targetPosts} color="#2563eb" /></div>}
              {currentGoal.targetVisitors > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, marginBottom: 4 }}>방문자: {currentGoal.currentVisitors}/{currentGoal.targetVisitors}</div><ProgressBar current={currentGoal.currentVisitors} target={currentGoal.targetVisitors} color="#059669" /></div>}
              {currentGoal.targetInquiries > 0 && <div><div style={{ fontSize: 12, marginBottom: 4 }}>문의: {currentGoal.currentInquiries}/{currentGoal.targetInquiries}</div><ProgressBar current={currentGoal.currentInquiries} target={currentGoal.targetInquiries} color="#d97706" /></div>}
            </div>
          )}
          <div style={z.reportInsight}><h4 style={z.reportInsightTitle}>인사이트</h4><div style={z.reportInsightContent}>
            {monthlyReport.posts === 0 && monthlyReport.inquiries === 0 && monthlyReport.avgDailyVisitors === 0 ? <p>데이터가 없습니다.</p> : <>
              {monthlyReport.avgDailyVisitors > 0 && <p>일평균 {monthlyReport.avgDailyVisitors}명 방문.{monthlyReport.avgDailyVisitors >= 100 ? " 안정권 진입 중." : " 지수 성장 중."}</p>}
              {monthlyReport.posts > 0 && <p>{monthlyReport.posts}건 발행, 글당 평균 {Math.round(monthlyReport.views / monthlyReport.posts)}뷰.</p>}
              {monthlyReport.inquiries > 0 && <p>문의 {monthlyReport.inquiries}건 중 {monthlyReport.conversions}건 전환 ({monthlyReport.convRate}%).</p>}
            </>}
          </div></div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      {modal && (
        <div style={z.overlay} onClick={() => { setModal(null); setFormData({}); }}>
          <div style={z.modal} onClick={(e) => e.stopPropagation()}>

            {modal === "addBlogStat" && <>
              <h3 style={z.modalTitle}>블로그 현황 기록</h3>
              <div style={z.fieldGroup}><label style={z.fl}>날짜</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>방문자수</label><input style={z.input} type="number" placeholder="0" value={formData.visitors || ""} onChange={(e) => setFormData({ ...formData, visitors: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>이웃수</label><input style={z.input} type="number" placeholder="0" value={formData.neighbors || ""} onChange={(e) => setFormData({ ...formData, neighbors: e.target.value })} /></div></div>
              <button onClick={addBlogStat} style={z.submitBtn}>기록하기</button>
            </>}

            {modal === "addKeyword" && <>
              <h3 style={z.modalTitle}>키워드 추가</h3>
              <div style={z.fieldGroup}><label style={z.fl}>키워드</label><input style={z.input} placeholder="예: 샷시 교체 비용" value={formData.keyword || ""} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} /></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>유형</label><select style={z.input} value={formData.category || "대형"} onChange={(e) => setFormData({ ...formData, category: e.target.value })}><option value="대형">대형</option><option value="지역+서비스">지역+서비스</option><option value="롱테일">롱테일</option></select></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>월간 검색량</label><input style={z.input} type="number" placeholder="0" value={formData.searchVolume || ""} onChange={(e) => setFormData({ ...formData, searchVolume: e.target.value })} /></div></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>현재 순위</label><input style={z.input} type="number" placeholder="0" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>확인일</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div></div>
              <button onClick={addKeyword} style={z.submitBtn}>추가</button>
            </>}

            {modal?.type === "updateKeyword" && <>
              <h3 style={z.modalTitle}>순위 업데이트</h3>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>순위</label><input style={z.input} type="number" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>확인일</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div></div>
              <button onClick={() => updateKeywordRank(modal.id)} style={z.submitBtn}>업데이트</button>
            </>}

            {modal === "addPost" && <>
              <h3 style={z.modalTitle}>글 추가</h3>
              <div style={z.fieldGroup}><label style={z.fl}>제목</label><input style={z.input} placeholder="블로그 글 제목" value={formData.title || ""} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>타겟 키워드</label><input style={z.input} placeholder="선택" value={formData.keyword || ""} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>발행일</label><input style={z.input} type="date" value={formData.publishDate || ""} onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })} /></div></div>
              <div style={z.fieldGroup}><label style={z.fl}>태그 (쉼표로 구분)</label><input style={z.input} placeholder="예: 시공사례, 비용비교, 후기" value={formData.tags || ""} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} /></div>
              <div style={z.fieldGroup}><label style={z.fl}>메모</label><input style={z.input} placeholder="이 글에 대한 메모" value={formData.memo || ""} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} /></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>조회수</label><input style={z.input} type="number" placeholder="0" value={formData.views || ""} onChange={(e) => setFormData({ ...formData, views: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>방문자수</label><input style={z.input} type="number" placeholder="0" value={formData.visitors || ""} onChange={(e) => setFormData({ ...formData, visitors: e.target.value })} /></div></div>
              <button onClick={addPost} style={z.submitBtn}>추가</button>
            </>}

            {modal?.type === "updatePost" && <>
              <h3 style={z.modalTitle}>수치 업데이트</h3>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>조회수</label><input style={z.input} type="number" value={formData.views || ""} onChange={(e) => setFormData({ ...formData, views: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>방문자</label><input style={z.input} type="number" value={formData.visitors || ""} onChange={(e) => setFormData({ ...formData, visitors: e.target.value })} /></div></div>
              <div style={z.fieldGroup}><label style={z.fl}>확인일</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
              <button onClick={() => updatePostStats(modal.id)} style={z.submitBtn}>업데이트</button>
            </>}

            {modal === "addInquiry" && <>
              <h3 style={z.modalTitle}>문의 기록</h3>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>날짜</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>유입 경로</label><select style={z.input} value={formData.source || "블로그"} onChange={(e) => setFormData({ ...formData, source: e.target.value })}><option value="블로그">블로그</option><option value="네이버 플레이스">네이버 플레이스</option><option value="전화">전화</option><option value="소개">소개</option><option value="기타">기타</option></select></div></div>
              <div style={z.fieldGroup}><label style={z.fl}>문의 내용</label><input style={z.input} placeholder="예: 30평 아파트 샷시 교체" value={formData.content || ""} onChange={(e) => setFormData({ ...formData, content: e.target.value })} /></div>
              <div style={z.fieldGroup}><label style={z.fl}>유입 글 (어떤 글 보고 왔는지)</label><select style={z.input} value={formData.sourcePost || ""} onChange={(e) => setFormData({ ...formData, sourcePost: e.target.value })}><option value="">모르겠음</option>{data.posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
              <div style={z.fieldGroup}><label style={z.fl}>전환 여부</label><select style={z.input} value={formData.converted || "no"} onChange={(e) => setFormData({ ...formData, converted: e.target.value })}><option value="no">미전환</option><option value="yes">계약완료</option></select></div>
              <button onClick={addInquiry} style={z.submitBtn}>추가</button>
            </>}

            {modal === "addGoal" && <>
              <h3 style={z.modalTitle}>월간 목표 설정</h3>
              <div style={z.fieldGroup}><label style={z.fl}>목표 월</label><select style={z.input} value={formData.month || getMonthKey(new Date())} onChange={(e) => setFormData({ ...formData, month: e.target.value })}>{availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>목표 발행 글</label><input style={z.input} type="number" placeholder="0" value={formData.targetPosts || ""} onChange={(e) => setFormData({ ...formData, targetPosts: e.target.value })} /></div></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>목표 방문자</label><input style={z.input} type="number" placeholder="0" value={formData.targetVisitors || ""} onChange={(e) => setFormData({ ...formData, targetVisitors: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>목표 문의</label><input style={z.input} type="number" placeholder="0" value={formData.targetInquiries || ""} onChange={(e) => setFormData({ ...formData, targetInquiries: e.target.value })} /></div></div>
              <button onClick={addGoal} style={z.submitBtn}>설정</button>
            </>}

            {modal === "addCompetitor" && <>
              <h3 style={z.modalTitle}>경쟁사 추가</h3>
              <div style={z.fieldGroup}><label style={z.fl}>경쟁사/블로그 이름</label><input style={z.input} placeholder="예: ○○인테리어" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div style={z.fieldGroup}><label style={z.fl}>비교 키워드</label><input style={z.input} placeholder="예: 샷시 교체 비용" value={formData.keyword || ""} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} /></div>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>현재 순위</label><input style={z.input} type="number" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>확인일</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div></div>
              <button onClick={addCompetitor} style={z.submitBtn}>추가</button>
            </>}

            {modal?.type === "updateCompetitor" && <>
              <h3 style={z.modalTitle}>경쟁사 순위 업데이트</h3>
              <div style={z.fieldRow}><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>순위</label><input style={z.input} type="number" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} /></div><div style={{ ...z.fieldGroup, flex: 1 }}><label style={z.fl}>확인일</label><input style={z.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div></div>
              <button onClick={() => updateCompetitorRank(modal.id)} style={z.submitBtn}>업데이트</button>
            </>}

            {modal === "addTodo" && <>
              <h3 style={z.modalTitle}>할일 추가</h3>
              <div style={z.fieldGroup}><label style={z.fl}>내용</label><input style={z.input} placeholder="예: 키워드 순위 체크" value={formData.content || ""} onChange={(e) => setFormData({ ...formData, content: e.target.value })} /></div>
              <div style={z.fieldGroup}><label style={z.fl}>기한 (선택)</label><input style={z.input} type="date" value={formData.dueDate || ""} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} /></div>
              <button onClick={addTodo} style={z.submitBtn}>추가</button>
            </>}

          </div>
        </div>
      )}
    </div>
  );
}

const z = {
  container: { fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif", maxWidth: 800, margin: "0 auto", padding: "16px 16px 40px", background: "#fff", color: "#1e293b", position: "relative", minHeight: "100vh" },
  loading: { padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, zIndex: 1000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 0 16px", borderBottom: "2px solid #1e293b" },
  headerBrand: { fontSize: 11, letterSpacing: 3, color: "#64748b", fontWeight: 600, marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.3 },
  resetBtn: { background: "none", border: "1px solid #cbd5e1", color: "#64748b", padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" },
  tabBar: { display: "flex", gap: 2, padding: "12px 0", overflowX: "auto", borderBottom: "1px solid #e2e8f0" },
  tab: { background: "none", border: "none", padding: "7px 10px", fontSize: 11, color: "#64748b", cursor: "pointer", borderRadius: 6, whiteSpace: "nowrap", fontWeight: 500 },
  tabActive: { background: "#0f172a", color: "#fff", fontWeight: 600 },
  tabIcon: { marginRight: 2 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 },
  statCard: { background: "#f8fafc", borderRadius: 10, padding: "12px 14px" },
  statLabel: { fontSize: 10, color: "#64748b", fontWeight: 500, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 800, color: "#0f172a" },
  statUnit: { fontSize: 11, fontWeight: 500, color: "#94a3b8", marginLeft: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 10px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 12 },
  chartCard: { background: "#f8fafc", borderRadius: 10, padding: "14px 10px", marginBottom: 10 },
  miniTable: { display: "flex", flexDirection: "column", gap: 6 },
  miniRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 8 },
  miniRankBadge: { width: 20, height: 20, borderRadius: "50%", background: "#0f172a", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  miniKeyword: { flex: 1, fontSize: 13, fontWeight: 600 },
  miniRank: { fontSize: 13, fontWeight: 700 },
  addBtn: { background: "#0f172a", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  smallBtn: { background: "#f1f5f9", border: "none", padding: "5px 10px", borderRadius: 6, fontSize: 11, color: "#334155", cursor: "pointer", fontWeight: 500 },
  deleteBtn: { background: "none", border: "none", padding: "5px 6px", fontSize: 11, color: "#94a3b8", cursor: "pointer" },
  empty: { textAlign: "center", padding: "40px 20px", color: "#94a3b8" },
  emptyHint: { fontSize: 12, marginTop: 6 },
  cardList: { display: "flex", flexDirection: "column", gap: 10 },
  kwCard: { background: "#f8fafc", borderRadius: 10, padding: 16 },
  kwTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  kwCategory: { fontSize: 10, color: "#fff", background: "#64748b", padding: "2px 7px", borderRadius: 4, fontWeight: 600, display: "inline-block" },
  kwName: { fontSize: 14, fontWeight: 700, marginTop: 3 },
  kwRankBox: { textAlign: "right" },
  kwRank: { fontSize: 20, fontWeight: 800 },
  kwDiff: { fontSize: 11, fontWeight: 600, marginTop: 2 },
  kwActions: { display: "flex", gap: 6, marginTop: 10 },
  postCard: { background: "#f8fafc", borderRadius: 10, padding: 16 },
  postTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  postMeta: { display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "#64748b", flexWrap: "wrap" },
  postKeyword: { background: "#e0f2fe", color: "#0369a1", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600 },
  postTag: { background: "#f1f5f9", color: "#475569", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 500 },
  postStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" },
  postStatItem: { textAlign: "center" },
  postStatLabel: { fontSize: 10, color: "#64748b", marginBottom: 3 },
  postStatValue: { fontSize: 16, fontWeight: 800, color: "#0f172a" },
  inquirySummary: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 0", background: "#f8fafc", borderRadius: 10, marginBottom: 12 },
  iqSumItem: { textAlign: "center" },
  iqSumLabel: { fontSize: 10, color: "#64748b", display: "block", marginBottom: 3 },
  iqSumValue: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  iqSumDivider: { width: 1, height: 28, background: "#e2e8f0" },
  inqCard: { background: "#f8fafc", borderRadius: 10, padding: 14 },
  inqTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  inqDate: { fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 },
  inqContent: { fontSize: 13, fontWeight: 600 },
  inqSource: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  inqRight: { display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 },
  convBtn: { border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" },
  reportGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 },
  reportCard: { background: "#f8fafc", borderRadius: 10, padding: 16, textAlign: "center" },
  reportLabel: { fontSize: 10, color: "#64748b", fontWeight: 500, marginBottom: 6 },
  reportValue: { fontSize: 22, fontWeight: 800, color: "#0f172a" },
  reportUnit: { fontSize: 11, fontWeight: 500, color: "#94a3b8", marginLeft: 2 },
  monthSelect: { padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, color: "#334155", background: "#fff", cursor: "pointer" },
  reportInsight: { marginTop: 20, background: "#f8fafc", borderRadius: 10, padding: 18 },
  reportInsightTitle: { fontSize: 13, fontWeight: 700, margin: "0 0 10px" },
  reportInsightContent: { fontSize: 12, lineHeight: 1.7, color: "#334155" },
  blogStatRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 },
  blogStatDate: { fontSize: 11, fontWeight: 600, color: "#334155", minWidth: 72 },
  blogStatValues: { flex: 1, display: "flex", gap: 14 },
  blogStatItem: { fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5 },
  dot1: { width: 7, height: 7, borderRadius: "50%", background: "#2563eb", display: "inline-block" },
  dot2: { width: 7, height: 7, borderRadius: "50%", background: "#059669", display: "inline-block" },
  todoRow: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", borderRadius: 8 },
  todoCheck: { background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 0, color: "#334155" },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" },
  modalTitle: { fontSize: 16, fontWeight: 700, margin: "0 0 16px" },
  fieldGroup: { marginBottom: 12 },
  fl: { display: "block", fontSize: 11, fontWeight: 600, color: "#334155", marginBottom: 5 },
  fieldRow: { display: "flex", gap: 10 },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, color: "#1e293b", outline: "none", boxSizing: "border-box", background: "#fff" },
  submitBtn: { width: "100%", padding: "11px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6 },
};

export default App;