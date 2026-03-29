import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const FIRESTORE_DOC = "dashboards";
const FIRESTORE_ID = "greenhomesys";

const defaultData = {
  keywords: [],
  posts: [],
  inquiries: [],
};

const formatDate = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};

const getMonthKey = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

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
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
      } catch (e) {
        console.error("Firebase load error:", e);
      }
      setLoading(false);
    })();
  }, []);

  const saveData = useCallback(async (newData) => {
    setData(newData);
    try {
      const docRef = doc(db, FIRESTORE_DOC, FIRESTORE_ID);
      await setDoc(docRef, newData);
    } catch (e) {
      console.error("Firebase save error:", e);
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const addKeyword = () => {
    const { keyword, category, rank, date } = formData;
    if (!keyword) return;
    const newKw = {
      id: Date.now().toString(),
      keyword,
      category: category || "일반",
      history: [{ date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) || 0 }],
    };
    saveData({ ...data, keywords: [...data.keywords, newKw] });
    setModal(null);
    setFormData({});
    showToast("키워드가 추가되었습니다");
  };

  const updateKeywordRank = (id) => {
    const { rank, date } = formData;
    if (!rank) return;
    const keywords = data.keywords.map((k) =>
      k.id === id
        ? { ...k, history: [...k.history, { date: date || new Date().toISOString().slice(0, 10), rank: parseInt(rank) }] }
        : k
    );
    saveData({ ...data, keywords });
    setModal(null);
    setFormData({});
    showToast("순위가 업데이트되었습니다");
  };

  const deleteKeyword = (id) => {
    saveData({ ...data, keywords: data.keywords.filter((k) => k.id !== id) });
    showToast("삭제되었습니다");
  };

  const addPost = () => {
    const { title, keyword, publishDate, views, visitors } = formData;
    if (!title) return;
    const newPost = {
      id: Date.now().toString(),
      title,
      keyword: keyword || "",
      publishDate: publishDate || new Date().toISOString().slice(0, 10),
      stats: [{ date: publishDate || new Date().toISOString().slice(0, 10), views: parseInt(views) || 0, visitors: parseInt(visitors) || 0 }],
    };
    saveData({ ...data, posts: [...data.posts, newPost] });
    setModal(null);
    setFormData({});
    showToast("글이 추가되었습니다");
  };

  const updatePostStats = (id) => {
    const { views, visitors, date } = formData;
    const posts = data.posts.map((p) =>
      p.id === id
        ? {
            ...p,
            stats: [
              ...p.stats,
              { date: date || new Date().toISOString().slice(0, 10), views: parseInt(views) || 0, visitors: parseInt(visitors) || 0 },
            ],
          }
        : p
    );
    saveData({ ...data, posts });
    setModal(null);
    setFormData({});
    showToast("조회수가 업데이트되었습니다");
  };

  const deletePost = (id) => {
    saveData({ ...data, posts: data.posts.filter((p) => p.id !== id) });
    showToast("삭제되었습니다");
  };

  const addInquiry = () => {
    const { date, source, content, converted } = formData;
    const newInq = {
      id: Date.now().toString(),
      date: date || new Date().toISOString().slice(0, 10),
      source: source || "블로그",
      content: content || "",
      converted: converted === "yes",
    };
    saveData({ ...data, inquiries: [...data.inquiries, newInq] });
    setModal(null);
    setFormData({});
    showToast("문의가 추가되었습니다");
  };

  const toggleConversion = (id) => {
    const inquiries = data.inquiries.map((i) => (i.id === id ? { ...i, converted: !i.converted } : i));
    saveData({ ...data, inquiries });
  };

  const deleteInquiry = (id) => {
    saveData({ ...data, inquiries: data.inquiries.filter((i) => i.id !== id) });
    showToast("삭제되었습니다");
  };

  const stats = useMemo(() => {
    const totalPosts = data.posts.length;
    const totalViews = data.posts.reduce((sum, p) => {
      const latest = p.stats[p.stats.length - 1];
      return sum + (latest?.views || 0);
    }, 0);
    const totalVisitors = data.posts.reduce((sum, p) => {
      const latest = p.stats[p.stats.length - 1];
      return sum + (latest?.visitors || 0);
    }, 0);
    const totalInquiries = data.inquiries.length;
    const conversions = data.inquiries.filter((i) => i.converted).length;
    const conversionRate = totalInquiries > 0 ? ((conversions / totalInquiries) * 100).toFixed(1) : "0";
    const inquiryRate = totalVisitors > 0 ? ((totalInquiries / totalVisitors) * 100).toFixed(1) : "0";
    const top5Keywords = [...data.keywords]
      .map((k) => ({ ...k, latestRank: k.history[k.history.length - 1]?.rank || 99 }))
      .sort((a, b) => a.latestRank - b.latestRank)
      .slice(0, 5);
    const page1Keywords = data.keywords.filter((k) => {
      const latest = k.history[k.history.length - 1];
      return latest && latest.rank >= 1 && latest.rank <= 5;
    }).length;
    return { totalPosts, totalViews, totalVisitors, totalInquiries, conversions, conversionRate, inquiryRate, top5Keywords, page1Keywords };
  }, [data]);

  const monthlyReport = useMemo(() => {
    const monthPosts = data.posts.filter((p) => getMonthKey(p.publishDate) === selectedMonth);
    const monthInquiries = data.inquiries.filter((i) => getMonthKey(i.date) === selectedMonth);
    const monthViews = monthPosts.reduce((s, p) => s + (p.stats[p.stats.length - 1]?.views || 0), 0);
    const monthVisitors = monthPosts.reduce((s, p) => s + (p.stats[p.stats.length - 1]?.visitors || 0), 0);
    const monthConversions = monthInquiries.filter((i) => i.converted).length;
    return {
      posts: monthPosts.length,
      views: monthViews,
      visitors: monthVisitors,
      inquiries: monthInquiries.length,
      conversions: monthConversions,
      convRate: monthInquiries.length > 0 ? ((monthConversions / monthInquiries.length) * 100).toFixed(1) : "0",
    };
  }, [data, selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set();
    data.posts.forEach((p) => months.add(getMonthKey(p.publishDate)));
    data.inquiries.forEach((i) => months.add(getMonthKey(i.date)));
    months.add(getMonthKey(new Date()));
    return [...months].sort().reverse();
  }, [data]);

  const resetAll = async () => {
    if (window.confirm("모든 데이터를 초기화하시겠습니까?")) {
      await saveData(defaultData);
      showToast("데이터가 초기화되었습니다");
    }
  };

  if (loading) return <div style={styles.loading}>불러오는 중...</div>;

  const tabs = [
    { id: "overview", label: "종합 현황", icon: "◈" },
    { id: "keywords", label: "키워드 순위", icon: "◎" },
    { id: "posts", label: "글별 성과", icon: "▤" },
    { id: "inquiries", label: "문의 추적", icon: "◉" },
    { id: "report", label: "월간 리포트", icon: "▧" },
  ];

  return (
    <div style={styles.container}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.header}>
        <div>
          <div style={styles.headerBrand}>ONAD AGENCY</div>
          <h1 style={styles.headerTitle}>그린홈시스 블로그 성과 대시보드</h1>
        </div>
        <button onClick={resetAll} style={styles.resetBtn} title="데이터 초기화">↺ 초기화</button>
      </div>

      <div style={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
          >
            <span style={styles.tabIcon}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          <div style={styles.statGrid}>
            {[
              { label: "총 발행 글", value: stats.totalPosts, unit: "건", color: "#2563eb" },
              { label: "총 조회수", value: stats.totalViews.toLocaleString(), unit: "회", color: "#0891b2" },
              { label: "총 방문자", value: stats.totalVisitors.toLocaleString(), unit: "명", color: "#059669" },
              { label: "총 문의", value: stats.totalInquiries, unit: "건", color: "#d97706" },
              { label: "계약 전환", value: stats.conversions, unit: "건", color: "#dc2626" },
              { label: "문의 전환율", value: `${stats.conversionRate}`, unit: "%", color: "#7c3aed" },
            ].map((s, i) => (
              <div key={i} style={{ ...styles.statCard, borderLeft: `4px solid ${s.color}` }}>
                <div style={styles.statLabel}>{s.label}</div>
                <div style={styles.statValue}>
                  {s.value}
                  <span style={styles.statUnit}>{s.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>핵심 지표 해석</h3>
            <div style={styles.insightGrid}>
              <div style={styles.insightCard}>
                <div style={styles.insightLabel}>방문자 → 문의 전환율</div>
                <div style={{ ...styles.insightValue, color: parseFloat(stats.inquiryRate) >= 2 ? "#059669" : "#d97706" }}>
                  {stats.inquiryRate}%
                </div>
                <div style={styles.insightNote}>
                  {parseFloat(stats.inquiryRate) >= 2 ? "업계 평균(1~3%) 이상 — 글의 설득력 양호" : "업계 평균(1~3%) 미달 — CTA 보강 필요"}
                </div>
              </div>
              <div style={styles.insightCard}>
                <div style={styles.insightLabel}>1페이지 노출 키워드</div>
                <div style={{ ...styles.insightValue, color: "#2563eb" }}>
                  {stats.page1Keywords}
                  <span style={styles.insightSub}>/ {data.keywords.length}개</span>
                </div>
                <div style={styles.insightNote}>
                  {data.keywords.length > 0
                    ? `${((stats.page1Keywords / data.keywords.length) * 100).toFixed(0)}% 노출률`
                    : "키워드를 추가해주세요"}
                </div>
              </div>
              <div style={styles.insightCard}>
                <div style={styles.insightLabel}>글당 평균 조회수</div>
                <div style={{ ...styles.insightValue, color: "#0891b2" }}>
                  {stats.totalPosts > 0 ? Math.round(stats.totalViews / stats.totalPosts) : 0}
                  <span style={styles.insightSub}>회</span>
                </div>
                <div style={styles.insightNote}>
                  {stats.totalPosts > 0 && stats.totalViews / stats.totalPosts >= 300
                    ? "건설/인테리어 니치 기준 양호"
                    : "트래픽 확보 필요 — 블로그 지수 성장 중"}
                </div>
              </div>
            </div>
          </div>

          {stats.top5Keywords.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>TOP 키워드 순위</h3>
              <div style={styles.miniTable}>
                {stats.top5Keywords.map((k, i) => (
                  <div key={k.id} style={styles.miniRow}>
                    <span style={styles.miniRankBadge}>{i + 1}</span>
                    <span style={styles.miniKeyword}>{k.keyword}</span>
                    <span style={{ ...styles.miniRank, color: k.latestRank <= 5 ? "#059669" : k.latestRank <= 15 ? "#d97706" : "#dc2626" }}>
                      {k.latestRank}위
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "keywords" && (
        <div>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>키워드별 네이버 순위 추적</h3>
            <button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal("addKeyword"); }} style={styles.addBtn}>+ 키워드 추가</button>
          </div>

          {data.keywords.length === 0 ? (
            <div style={styles.empty}>
              <p>추적 중인 키워드가 없습니다</p>
              <p style={styles.emptyHint}>타겟 키워드를 추가하고 주간 순위를 기록하세요</p>
            </div>
          ) : (
            <div style={styles.cardList}>
              {data.keywords.map((k) => {
                const latest = k.history[k.history.length - 1];
                const prev = k.history.length > 1 ? k.history[k.history.length - 2] : null;
                const diff = prev ? prev.rank - latest.rank : 0;
                return (
                  <div key={k.id} style={styles.kwCard}>
                    <div style={styles.kwTop}>
                      <div>
                        <span style={styles.kwCategory}>{k.category}</span>
                        <div style={styles.kwName}>{k.keyword}</div>
                      </div>
                      <div style={styles.kwRankBox}>
                        <div style={{ ...styles.kwRank, color: latest.rank <= 5 ? "#059669" : latest.rank <= 15 ? "#d97706" : "#94a3b8" }}>
                          {latest.rank > 0 ? `${latest.rank}위` : "미확인"}
                        </div>
                        {diff !== 0 && (
                          <div style={{ ...styles.kwDiff, color: diff > 0 ? "#059669" : "#dc2626" }}>
                            {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                          </div>
                        )}
                      </div>
                    </div>
                    {k.history.length > 1 && (
                      <div style={styles.kwHistory}>
                        {k.history.slice(-5).map((h, i) => (
                          <span key={i} style={styles.kwHistoryItem}>
                            {formatDate(h.date)}: {h.rank}위
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={styles.kwActions}>
                      <button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal({ type: "updateKeyword", id: k.id }); }} style={styles.smallBtn}>순위 업데이트</button>
                      <button onClick={() => deleteKeyword(k.id)} style={styles.deleteBtn}>삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "posts" && (
        <div>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>글별 조회수 · 방문자수</h3>
            <button onClick={() => { setFormData({ publishDate: new Date().toISOString().slice(0, 10) }); setModal("addPost"); }} style={styles.addBtn}>+ 글 추가</button>
          </div>

          {data.posts.length === 0 ? (
            <div style={styles.empty}>
              <p>등록된 글이 없습니다</p>
              <p style={styles.emptyHint}>발행한 블로그 글을 추가하고 성과를 추적하세요</p>
            </div>
          ) : (
            <div style={styles.cardList}>
              {data.posts.map((p) => {
                const latest = p.stats[p.stats.length - 1];
                return (
                  <div key={p.id} style={styles.postCard}>
                    <div style={styles.postTop}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.postTitle}>{p.title}</div>
                        <div style={styles.postMeta}>
                          {p.keyword && <span style={styles.postKeyword}>{p.keyword}</span>}
                          <span>{formatDate(p.publishDate)} 발행</span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.postStats}>
                      <div style={styles.postStatItem}>
                        <div style={styles.postStatLabel}>조회수</div>
                        <div style={styles.postStatValue}>{(latest?.views || 0).toLocaleString()}</div>
                      </div>
                      <div style={styles.postStatItem}>
                        <div style={styles.postStatLabel}>방문자</div>
                        <div style={styles.postStatValue}>{(latest?.visitors || 0).toLocaleString()}</div>
                      </div>
                      <div style={styles.postStatItem}>
                        <div style={styles.postStatLabel}>기록 횟수</div>
                        <div style={styles.postStatValue}>{p.stats.length}회</div>
                      </div>
                    </div>
                    <div style={styles.kwActions}>
                      <button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10) }); setModal({ type: "updatePost", id: p.id }); }} style={styles.smallBtn}>수치 업데이트</button>
                      <button onClick={() => deletePost(p.id)} style={styles.deleteBtn}>삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "inquiries" && (
        <div>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>문의 건수 · 전환 추적</h3>
            <button onClick={() => { setFormData({ date: new Date().toISOString().slice(0, 10), source: "블로그" }); setModal("addInquiry"); }} style={styles.addBtn}>+ 문의 추가</button>
          </div>

          <div style={styles.inquirySummary}>
            <div style={styles.iqSumItem}>
              <span style={styles.iqSumLabel}>총 문의</span>
              <span style={styles.iqSumValue}>{stats.totalInquiries}건</span>
            </div>
            <div style={styles.iqSumDivider} />
            <div style={styles.iqSumItem}>
              <span style={styles.iqSumLabel}>계약 전환</span>
              <span style={{ ...styles.iqSumValue, color: "#059669" }}>{stats.conversions}건</span>
            </div>
            <div style={styles.iqSumDivider} />
            <div style={styles.iqSumItem}>
              <span style={styles.iqSumLabel}>전환율</span>
              <span style={{ ...styles.iqSumValue, color: "#7c3aed" }}>{stats.conversionRate}%</span>
            </div>
          </div>

          {data.inquiries.length === 0 ? (
            <div style={styles.empty}>
              <p>기록된 문의가 없습니다</p>
              <p style={styles.emptyHint}>블로그를 통한 문의가 들어오면 기록하세요</p>
            </div>
          ) : (
            <div style={styles.cardList}>
              {[...data.inquiries].reverse().map((inq) => (
                <div key={inq.id} style={{ ...styles.inqCard, borderLeft: `4px solid ${inq.converted ? "#059669" : "#e2e8f0"}` }}>
                  <div style={styles.inqTop}>
                    <div>
                      <div style={styles.inqDate}>{formatDate(inq.date)}</div>
                      <div style={styles.inqContent}>{inq.content || "(내용 미입력)"}</div>
                      <div style={styles.inqSource}>유입: {inq.source}</div>
                    </div>
                    <div style={styles.inqRight}>
                      <button
                        onClick={() => toggleConversion(inq.id)}
                        style={{ ...styles.convBtn, background: inq.converted ? "#059669" : "#e2e8f0", color: inq.converted ? "#fff" : "#64748b" }}
                      >
                        {inq.converted ? "계약 완료" : "미전환"}
                      </button>
                      <button onClick={() => deleteInquiry(inq.id)} style={styles.deleteBtn}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "report" && (
        <div>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>월간 요약 리포트</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={styles.monthSelect}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m.replace("-", "년 ")}월</option>
              ))}
            </select>
          </div>

          <div style={styles.reportGrid}>
            {[
              { label: "발행 글", value: monthlyReport.posts, unit: "건", icon: "▤" },
              { label: "총 조회수", value: monthlyReport.views.toLocaleString(), unit: "회", icon: "◎" },
              { label: "총 방문자", value: monthlyReport.visitors.toLocaleString(), unit: "명", icon: "◈" },
              { label: "문의 건수", value: monthlyReport.inquiries, unit: "건", icon: "◉" },
              { label: "계약 전환", value: monthlyReport.conversions, unit: "건", icon: "◆" },
              { label: "전환율", value: monthlyReport.convRate, unit: "%", icon: "▧" },
            ].map((item, i) => (
              <div key={i} style={styles.reportCard}>
                <div style={styles.reportIcon}>{item.icon}</div>
                <div style={styles.reportLabel}>{item.label}</div>
                <div style={styles.reportValue}>
                  {item.value}<span style={styles.reportUnit}>{item.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.reportInsight}>
            <h4 style={styles.reportInsightTitle}>이 달의 인사이트</h4>
            <div style={styles.reportInsightContent}>
              {monthlyReport.posts === 0 && monthlyReport.inquiries === 0 ? (
                <p>이 달의 데이터가 아직 없습니다. 글을 발행하고 성과를 기록해주세요.</p>
              ) : (
                <>
                  <p>
                    <strong>{selectedMonth.replace("-", "년 ")}월</strong>에 {monthlyReport.posts}건의 글을 발행하여
                    총 {monthlyReport.visitors.toLocaleString()}명의 방문자를 확보했습니다.
                  </p>
                  {monthlyReport.inquiries > 0 && (
                    <p>
                      문의 {monthlyReport.inquiries}건 중 {monthlyReport.conversions}건이 계약으로 전환되어
                      전환율 {monthlyReport.convRate}%를 기록했습니다.
                      {parseFloat(monthlyReport.convRate) >= 2 ? " 업계 평균 이상의 전환율입니다." : " CTA 구조 보강을 검토하세요."}
                    </p>
                  )}
                  {monthlyReport.posts > 0 && (
                    <p>
                      글당 평균 조회수: {Math.round(monthlyReport.views / monthlyReport.posts)}회.
                      {Math.round(monthlyReport.views / monthlyReport.posts) < 100
                        ? " 블로그 지수가 아직 성장 중입니다. 꾸준한 발행을 유지하세요."
                        : " 트래픽 안정권에 진입하고 있습니다."}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={styles.reportTip}>
            <strong>포트폴리오 활용 팁:</strong> 3개월 이상 누적 데이터가 쌓이면 "블로그 지수 0 → 월 문의 ○건" 스토리로 신규 클라이언트 영업에 활용할 수 있습니다.
          </div>
        </div>
      )}

      {modal && (
        <div style={styles.overlay} onClick={() => { setModal(null); setFormData({}); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {modal === "addKeyword" && (
              <>
                <h3 style={styles.modalTitle}>키워드 추가</h3>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>키워드</label>
                  <input style={styles.input} placeholder="예: 샷시 교체 비용" value={formData.keyword || ""} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>유형</label>
                  <select style={styles.input} value={formData.category || "대형"} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    <option value="대형">대형 키워드</option>
                    <option value="지역+서비스">지역+서비스</option>
                    <option value="롱테일">롱테일</option>
                  </select>
                </div>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>현재 순위</label>
                    <input style={styles.input} type="number" placeholder="0 = 미확인" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>확인일</label>
                    <input style={styles.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                </div>
                <button onClick={addKeyword} style={styles.submitBtn}>추가하기</button>
              </>
            )}
            {modal?.type === "updateKeyword" && (
              <>
                <h3 style={styles.modalTitle}>순위 업데이트</h3>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>현재 순위</label>
                    <input style={styles.input} type="number" value={formData.rank || ""} onChange={(e) => setFormData({ ...formData, rank: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>확인일</label>
                    <input style={styles.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                </div>
                <button onClick={() => updateKeywordRank(modal.id)} style={styles.submitBtn}>업데이트</button>
              </>
            )}
            {modal === "addPost" && (
              <>
                <h3 style={styles.modalTitle}>블로그 글 추가</h3>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>글 제목</label>
                  <input style={styles.input} placeholder="블로그 글 제목" value={formData.title || ""} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>타겟 키워드</label>
                    <input style={styles.input} placeholder="선택" value={formData.keyword || ""} onChange={(e) => setFormData({ ...formData, keyword: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>발행일</label>
                    <input style={styles.input} type="date" value={formData.publishDate || ""} onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })} />
                  </div>
                </div>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>조회수</label>
                    <input style={styles.input} type="number" placeholder="0" value={formData.views || ""} onChange={(e) => setFormData({ ...formData, views: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>방문자수</label>
                    <input style={styles.input} type="number" placeholder="0" value={formData.visitors || ""} onChange={(e) => setFormData({ ...formData, visitors: e.target.value })} />
                  </div>
                </div>
                <button onClick={addPost} style={styles.submitBtn}>추가하기</button>
              </>
            )}
            {modal?.type === "updatePost" && (
              <>
                <h3 style={styles.modalTitle}>수치 업데이트</h3>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>조회수</label>
                    <input style={styles.input} type="number" value={formData.views || ""} onChange={(e) => setFormData({ ...formData, views: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>방문자수</label>
                    <input style={styles.input} type="number" value={formData.visitors || ""} onChange={(e) => setFormData({ ...formData, visitors: e.target.value })} />
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>확인일</label>
                  <input style={styles.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <button onClick={() => updatePostStats(modal.id)} style={styles.submitBtn}>업데이트</button>
              </>
            )}
            {modal === "addInquiry" && (
              <>
                <h3 style={styles.modalTitle}>문의 기록 추가</h3>
                <div style={styles.fieldRow}>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>문의일</label>
                    <input style={styles.input} type="date" value={formData.date || ""} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                  <div style={{ ...styles.fieldGroup, flex: 1 }}>
                    <label style={styles.fieldLabel}>유입 경로</label>
                    <select style={styles.input} value={formData.source || "블로그"} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                      <option value="블로그">블로그</option>
                      <option value="네이버 플레이스">네이버 플레이스</option>
                      <option value="전화">전화</option>
                      <option value="소개">소개</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>문의 내용 (간략)</label>
                  <input style={styles.input} placeholder="예: 30평 아파트 샷시 교체 문의" value={formData.content || ""} onChange={(e) => setFormData({ ...formData, content: e.target.value })} />
                </div>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>계약 전환 여부</label>
                  <select style={styles.input} value={formData.converted || "no"} onChange={(e) => setFormData({ ...formData, converted: e.target.value })}>
                    <option value="no">미전환</option>
                    <option value="yes">계약 완료</option>
                  </select>
                </div>
                <button onClick={addInquiry} style={styles.submitBtn}>추가하기</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif", maxWidth: 800, margin: "0 auto", padding: "16px 16px 40px", background: "#fff", color: "#1e293b", position: "relative", minHeight: "100vh" },
  loading: { padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13, zIndex: 1000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "28px 0 20px", borderBottom: "2px solid #1e293b" },
  headerBrand: { fontSize: 11, letterSpacing: 3, color: "#64748b", fontWeight: 600, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.3 },
  resetBtn: { background: "none", border: "1px solid #cbd5e1", color: "#64748b", padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" },
  tabBar: { display: "flex", gap: 4, padding: "16px 0", overflowX: "auto", borderBottom: "1px solid #e2e8f0" },
  tab: { background: "none", border: "none", padding: "8px 14px", fontSize: 13, color: "#64748b", cursor: "pointer", borderRadius: 6, whiteSpace: "nowrap", fontWeight: 500, transition: "all 0.15s" },
  tabActive: { background: "#0f172a", color: "#fff", fontWeight: 600 },
  tabIcon: { marginRight: 4 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 },
  statCard: { background: "#f8fafc", borderRadius: 10, padding: "16px 18px" },
  statLabel: { fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: 800, color: "#0f172a" },
  statUnit: { fontSize: 13, fontWeight: 500, color: "#94a3b8", marginLeft: 3 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 14 },
  insightGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  insightCard: { background: "#f8fafc", borderRadius: 10, padding: 18, textAlign: "center" },
  insightLabel: { fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 8 },
  insightValue: { fontSize: 28, fontWeight: 800 },
  insightSub: { fontSize: 14, fontWeight: 500, color: "#94a3b8", marginLeft: 2 },
  insightNote: { fontSize: 11, color: "#64748b", marginTop: 8, lineHeight: 1.4 },
  miniTable: { display: "flex", flexDirection: "column", gap: 8 },
  miniRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 },
  miniRankBadge: { width: 22, height: 22, borderRadius: "50%", background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  miniKeyword: { flex: 1, fontSize: 13, fontWeight: 600 },
  miniRank: { fontSize: 14, fontWeight: 700 },
  addBtn: { background: "#0f172a", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  smallBtn: { background: "#f1f5f9", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 12, color: "#334155", cursor: "pointer", fontWeight: 500 },
  deleteBtn: { background: "none", border: "none", padding: "6px 8px", fontSize: 12, color: "#94a3b8", cursor: "pointer" },
  empty: { textAlign: "center", padding: "48px 20px", color: "#94a3b8" },
  emptyHint: { fontSize: 13, marginTop: 8 },
  cardList: { display: "flex", flexDirection: "column", gap: 12 },
  kwCard: { background: "#f8fafc", borderRadius: 10, padding: 18 },
  kwTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  kwCategory: { fontSize: 10, color: "#fff", background: "#64748b", padding: "2px 8px", borderRadius: 4, fontWeight: 600, marginBottom: 6, display: "inline-block" },
  kwName: { fontSize: 15, fontWeight: 700, marginTop: 4 },
  kwRankBox: { textAlign: "right" },
  kwRank: { fontSize: 22, fontWeight: 800 },
  kwDiff: { fontSize: 12, fontWeight: 600, marginTop: 2 },
  kwHistory: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" },
  kwHistoryItem: { fontSize: 11, color: "#64748b", background: "#fff", padding: "3px 8px", borderRadius: 4 },
  kwActions: { display: "flex", gap: 8, marginTop: 12 },
  postCard: { background: "#f8fafc", borderRadius: 10, padding: 18 },
  postTop: { display: "flex", justifyContent: "space-between" },
  postTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  postMeta: { display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#64748b" },
  postKeyword: { background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  postStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0" },
  postStatItem: { textAlign: "center" },
  postStatLabel: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  postStatValue: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  inquirySummary: { display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "18px 0", background: "#f8fafc", borderRadius: 10, marginBottom: 16 },
  iqSumItem: { textAlign: "center" },
  iqSumLabel: { fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 },
  iqSumValue: { fontSize: 20, fontWeight: 800, color: "#0f172a" },
  iqSumDivider: { width: 1, height: 32, background: "#e2e8f0" },
  inqCard: { background: "#f8fafc", borderRadius: 10, padding: 16 },
  inqTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  inqDate: { fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 },
  inqContent: { fontSize: 14, fontWeight: 600 },
  inqSource: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  inqRight: { display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 },
  convBtn: { border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  reportGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 },
  reportCard: { background: "#f8fafc", borderRadius: 10, padding: 20, textAlign: "center" },
  reportIcon: { fontSize: 18, color: "#64748b", marginBottom: 8 },
  reportLabel: { fontSize: 11, color: "#64748b", fontWeight: 500, marginBottom: 8 },
  reportValue: { fontSize: 26, fontWeight: 800, color: "#0f172a" },
  reportUnit: { fontSize: 13, fontWeight: 500, color: "#94a3b8", marginLeft: 2 },
  monthSelect: { padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, color: "#334155", background: "#fff", cursor: "pointer" },
  reportInsight: { marginTop: 24, background: "#f8fafc", borderRadius: 10, padding: 20 },
  reportInsightTitle: { fontSize: 14, fontWeight: 700, margin: "0 0 12px" },
  reportInsightContent: { fontSize: 13, lineHeight: 1.7, color: "#334155" },
  reportTip: { marginTop: 16, padding: 16, background: "#fefce8", borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: "#854d0e", border: "1px solid #fde68a" },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" },
  modalTitle: { fontSize: 17, fontWeight: 700, margin: "0 0 20px" },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 },
  fieldRow: { display: "flex", gap: 12 },
  input: { width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, color: "#1e293b", outline: "none", boxSizing: "border-box", background: "#fff" },
  submitBtn: { width: "100%", padding: "12px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 },
};

export default App;