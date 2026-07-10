"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  ExternalLink,
  MessageCircleMore,
  Music2,
  RefreshCcw,
  SearchX,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AnalyzedComment,
  Category,
  DashboardAlert,
  DashboardSummary,
  PaginatedResponse,
  Platform,
  PostSummary,
  Sentiment,
  TrendPoint,
} from "@/lib/dashboard";

type PlatformFilter = "all" | Platform;
type DatePreset = "7d" | "30d" | "90d" | "all";
type SentimentFilter = "all" | Sentiment;
type CategoryFilter = "all" | Category;

const sentimentMeta: Record<Sentiment, { label: string; color: string }> = {
  positive: { label: "Positif", color: "#718a70" },
  negative: { label: "Negatif", color: "#b85d54" },
  neutral: { label: "Netral", color: "#9b9188" },
};

const categoryLabels: Record<Category, string> = {
  pertanyaan_produk: "Pertanyaan produk",
  komplain: "Komplain",
  pujian: "Pujian",
  spam: "Spam",
  lainnya: "Lainnya",
};

const dateLabels: Record<DatePreset, string> = {
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  all: "Semua waktu",
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Sesi dashboard berakhir");
  }
  if (!response.ok) throw new Error(body.error ?? "Data dashboard gagal dimuat");
  return body as T;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function compactCaption(value: string | null, fallback = "Post tanpa caption") {
  const caption = value?.trim() || fallback;
  return caption.length > 76 ? `${caption.slice(0, 76)}…` : caption;
}

function getDateRange(preset: DatePreset): Record<string, string> {
  if (preset === "all") return {};
  const days = Number.parseInt(preset, 10);
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { date_from: from.toISOString(), date_to: new Date().toISOString() };
}

function PlatformMark({ platform }: { platform: Platform }) {
  return platform === "ig" ? <Camera size={15} /> : <Music2 size={15} />;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <SearchX size={24} strokeWidth={1.5} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Memuat dashboard">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-filter" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-lead" />
        <div className="skeleton skeleton-metrics" />
      </div>
      <div className="skeleton-grid">
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [postId, setPostId] = useState("all");
  const [commentSentiment, setCommentSentiment] = useState<SentimentFilter>("all");
  const [commentCategory, setCommentCategory] = useState<CategoryFilter>("all");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postOptions, setPostOptions] = useState<PostSummary[]>([]);
  const [comments, setComments] = useState<AnalyzedComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [handlingAlert, setHandlingAlert] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page_size: "100" });
    if (platform !== "all") params.set("platform", platform);

    fetchJson<PaginatedResponse<PostSummary>>(`/api/dashboard/posts?${params}`, controller.signal)
      .then((response) => setPostOptions(response.data))
      .catch((optionsError) => {
        if (optionsError instanceof DOMException && optionsError.name === "AbortError") return;
        setError(optionsError instanceof Error ? optionsError.message : "Daftar post gagal dimuat");
      });

    return () => controller.abort();
  }, [platform]);

  useEffect(() => {
    const controller = new AbortController();
    const baseParams = new URLSearchParams(getDateRange(datePreset));
    if (platform !== "all") baseParams.set("platform", platform);
    if (postId !== "all") baseParams.set("post_id", postId);

    const summaryParams = new URLSearchParams(baseParams);
    const trendParams = new URLSearchParams(baseParams);
    trendParams.set("period", datePreset === "90d" ? "week" : "day");
    const postParams = new URLSearchParams(baseParams);
    postParams.set("page_size", "12");
    const commentParams = new URLSearchParams(baseParams);
    commentParams.set("page_size", "12");
    if (commentSentiment !== "all") commentParams.set("sentiment", commentSentiment);
    if (commentCategory !== "all") commentParams.set("category", commentCategory);
    const alertParams = new URLSearchParams(baseParams);
    alertParams.set("status", "pending");
    alertParams.set("page_size", "8");

    setError("");
    Promise.all([
      fetchJson<DashboardSummary>(`/api/dashboard/summary?${summaryParams}`, controller.signal),
      fetchJson<{ data: TrendPoint[] }>(`/api/dashboard/trends?${trendParams}`, controller.signal),
      fetchJson<PaginatedResponse<PostSummary>>(`/api/dashboard/posts?${postParams}`, controller.signal),
      fetchJson<PaginatedResponse<AnalyzedComment>>(`/api/dashboard/comments?${commentParams}`, controller.signal),
      fetchJson<PaginatedResponse<DashboardAlert>>(`/api/dashboard/alerts?${alertParams}`, controller.signal),
    ])
      .then(([summaryData, trendData, postData, commentData, alertData]) => {
        setSummary(summaryData);
        setTrends(trendData.data);
        setPosts(postData.data);
        setComments(commentData.data);
        setCommentTotal(commentData.total);
        setAlerts(alertData.data);
      })
      .catch((dashboardError) => {
        if (dashboardError instanceof DOMException && dashboardError.name === "AbortError") return;
        setError(dashboardError instanceof Error ? dashboardError.message : "Dashboard gagal dimuat");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [platform, datePreset, postId, commentSentiment, commentCategory, refreshKey]);

  async function markHandled(alertId: string) {
    setHandlingAlert(alertId);
    setError("");
    try {
      const response = await fetch(`/api/alerts/${alertId}/handle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled_by: "Tim Markom" }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) window.location.assign("/login");
      if (!response.ok) throw new Error(body.error ?? "Alert gagal diperbarui");
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      setSummary((current) => current ? { ...current, pending_alerts: Math.max(0, current.pending_alerts - 1) } : current);
    } catch (handleError) {
      setError(handleError instanceof Error ? handleError.message : "Alert gagal diperbarui");
    } finally {
      setHandlingAlert(null);
    }
  }

  function refreshDashboard() {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
  }

  function changePlatform(value: PlatformFilter) {
    setPlatform(value);
    setPostId("all");
  }

  if (loading) return <DashboardSkeleton />;

  const analyzed = summary?.total_analyzed ?? 0;
  const positiveRate = analyzed > 0 ? ((summary?.sentiment_counts.positive ?? 0) / analyzed) * 100 : 0;
  const analyzedRate = (summary?.total_comments ?? 0) > 0 ? (analyzed / (summary?.total_comments ?? 1)) * 100 : 0;
  const pieData = (Object.keys(sentimentMeta) as Sentiment[]).map((sentiment) => ({
    name: sentimentMeta[sentiment].label,
    value: summary?.sentiment_counts[sentiment] ?? 0,
    color: sentimentMeta[sentiment].color,
  }));

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Listening room · {dateLabels[datePreset]}</p>
          <h1>Suara pelanggan,<br /><em>terlihat lebih jelas.</em></h1>
          <p className="heading-copy">Pantau reputasi Beauty Kendari dan prioritaskan percakapan yang perlu respons cepat.</p>
        </div>
        <div className="heading-actions">
          <span className="last-sync">
            <span className="status-dot" />
            Sinkron terakhir <strong>{formatDate(summary?.last_scraped_at ?? null, true)}</strong>
          </span>
          <button className="secondary-button" type="button" onClick={refreshDashboard} disabled={refreshing}>
            <RefreshCcw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Memuat" : "Perbarui"}
          </button>
        </div>
      </header>

      <section className="filter-bar" aria-label="Filter dashboard">
        <div className="platform-toggle" aria-label="Pilih platform">
          {(["all", "ig", "tiktok"] as PlatformFilter[]).map((value) => (
            <button key={value} type="button" className={platform === value ? "active" : ""} onClick={() => changePlatform(value)}>
              {value === "ig" && <Camera size={15} />}
              {value === "tiktok" && <Music2 size={15} />}
              {value === "all" ? "Semua" : value === "ig" ? "Instagram" : "TikTok"}
            </button>
          ))}
        </div>
        <label className="select-control">
          <CalendarDays size={16} />
          <span className="sr-only">Rentang tanggal</span>
          <select value={datePreset} onChange={(event) => setDatePreset(event.target.value as DatePreset)}>
            {(Object.keys(dateLabels) as DatePreset[]).map((value) => <option key={value} value={value}>{dateLabels[value]}</option>)}
          </select>
        </label>
        <label className="select-control post-select">
          <span className="sr-only">Pilih post</span>
          <select value={postId} onChange={(event) => setPostId(event.target.value)}>
            <option value="all">Semua post</option>
            {postOptions.map((post) => <option key={post.id} value={post.id}>{post.platform.toUpperCase()} · {compactCaption(post.caption)}</option>)}
          </select>
        </label>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={refreshDashboard}>Coba lagi</button>
        </div>
      )}

      <section id="ringkasan" className="overview-grid scroll-section">
        <article className="pulse-card">
          <div className="card-kicker"><Sparkles size={16} /> Sentiment pulse</div>
          <div className="pulse-score">
            <strong>{positiveRate.toFixed(1)}<small>%</small></strong>
            <span>percakapan positif</span>
          </div>
          <div className="pulse-scale" aria-label={`${positiveRate.toFixed(1)} persen komentar positif`}>
            <span style={{ width: `${positiveRate}%` }} />
          </div>
          <p>{analyzed > 0 ? `${formatNumber(summary?.sentiment_counts.positive ?? 0)} dari ${formatNumber(analyzed)} komentar teranalisis memberi sinyal positif.` : "Belum ada komentar teranalisis pada rentang ini."}</p>
          <div className="platform-counts">
            <span><Camera size={15} /> {formatNumber(summary?.platforms.ig ?? 0)} post</span>
            <span><Music2 size={15} /> {formatNumber(summary?.platforms.tiktok ?? 0)} post</span>
          </div>
        </article>

        <div className="metric-board">
          <article>
            <span>Total post</span>
            <strong>{formatNumber(summary?.total_posts ?? 0)}</strong>
            <small>konten terpantau</small>
          </article>
          <article>
            <span>Komentar masuk</span>
            <strong>{formatNumber(summary?.total_comments ?? 0)}</strong>
            <small>{analyzedRate.toFixed(0)}% sudah dianalisis</small>
          </article>
          <article className="negative-metric">
            <span>Sentimen negatif</span>
            <strong>{formatNumber(summary?.sentiment_counts.negative ?? 0)}</strong>
            <small>perlu perhatian</small>
          </article>
          <article className="alert-metric">
            <span>Alert tertunda</span>
            <strong>{formatNumber(summary?.pending_alerts ?? 0)}</strong>
            <small>antrean Tim Markom</small>
          </article>
        </div>
      </section>

      <section className="insight-grid">
        <article className="chart-panel trend-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Gerak percakapan</p>
              <h2>Tren sentimen</h2>
            </div>
            <span>{datePreset === "90d" ? "per minggu" : "per hari"}</span>
          </div>
          {trends.length > 0 ? (
            <div className="chart-wrap" role="img" aria-label="Grafik tren sentimen positif, negatif, dan netral">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#e8e0d9" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(value))} tick={{ fill: "#776d66", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#776d66", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(value) => formatDate(String(value))} contentStyle={{ border: "1px solid #e1d7cf", borderRadius: 10, boxShadow: "0 12px 36px rgba(60, 43, 35, .1)" }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 18 }} />
                  <Line type="monotone" dataKey="positive" name="Positif" stroke={sentimentMeta.positive.color} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="negative" name="Negatif" stroke={sentimentMeta.negative.color} strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="neutral" name="Netral" stroke={sentimentMeta.neutral.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Belum ada tren" description="Data sentimen akan muncul setelah komentar dianalisis." />}
        </article>

        <article className="chart-panel distribution-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Komposisi</p>
              <h2>Distribusi</h2>
            </div>
            <CircleGauge size={20} />
          </div>
          {analyzed > 0 ? (
            <>
              <div className="donut-wrap" role="img" aria-label="Diagram distribusi sentimen">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={67} outerRadius={91} paddingAngle={3} stroke="none">
                      {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: "1px solid #e1d7cf", borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{formatNumber(analyzed)}</strong><span>dianalisis</span></div>
              </div>
              <div className="distribution-list">
                {pieData.map((entry) => (
                  <div key={entry.name}>
                    <span><i style={{ background: entry.color }} />{entry.name}</span>
                    <strong>{formatNumber(entry.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState title="Belum ada distribusi" description="Jalankan analisis untuk melihat komposisi sentimen." />}
        </article>
      </section>

      <section id="posts" className="content-section scroll-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performa konten</p>
            <h2>Post yang sedang dibicarakan</h2>
          </div>
          <span className="section-count">{posts.length} ditampilkan</span>
        </div>
        {posts.length > 0 ? (
          <div className="table-shell">
            <table className="data-table posts-table">
              <thead><tr><th>Post</th><th>Diposting</th><th>Komentar</th><th>Komposisi sentimen</th><th><span className="sr-only">Buka post</span></th></tr></thead>
              <tbody>
                {posts.map((post) => {
                  const total = post.positive + post.negative + post.neutral;
                  return (
                    <tr key={post.id}>
                      <td data-label="Post">
                        <div className="post-identity">
                          <span className={`platform-mark ${post.platform}`}><PlatformMark platform={post.platform} /></span>
                          <div><strong>{compactCaption(post.caption)}</strong><small>@{post.account_name}</small></div>
                        </div>
                      </td>
                      <td data-label="Diposting">{formatDate(post.posted_at)}</td>
                      <td data-label="Komentar"><strong className="tabular">{formatNumber(post.comment_count)}</strong></td>
                      <td data-label="Sentimen">
                        {total > 0 ? (
                          <div className="sentiment-stack" aria-label={`${post.positive} positif, ${post.negative} negatif, ${post.neutral} netral`}>
                            <div><span className="positive" style={{ width: `${(post.positive / total) * 100}%` }} /><span className="negative" style={{ width: `${(post.negative / total) * 100}%` }} /><span className="neutral" style={{ width: `${(post.neutral / total) * 100}%` }} /></div>
                            <small>{post.positive} pos · {post.negative} neg · {post.neutral} net</small>
                          </div>
                        ) : <span className="muted">Belum dianalisis</span>}
                      </td>
                      <td><a className="table-link" href={post.post_url} target="_blank" rel="noreferrer" aria-label="Buka post"><ArrowUpRight size={17} /></a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Post tidak ditemukan" description="Ubah filter atau tunggu proses discovery berikutnya." />}
      </section>

      <section id="komentar" className="content-section scroll-section">
        <div className="section-heading comment-heading">
          <div>
            <p className="eyebrow">Kotak masuk analisis</p>
            <h2>Komentar pelanggan</h2>
          </div>
          <div className="inline-filters">
            <label className="select-control">
              <span className="sr-only">Filter sentimen</span>
              <select value={commentSentiment} onChange={(event) => setCommentSentiment(event.target.value as SentimentFilter)}>
                <option value="all">Semua sentimen</option>
                <option value="negative">Negatif</option><option value="positive">Positif</option><option value="neutral">Netral</option>
              </select>
            </label>
            <label className="select-control">
              <span className="sr-only">Filter kategori</span>
              <select value={commentCategory} onChange={(event) => setCommentCategory(event.target.value as CategoryFilter)}>
                <option value="all">Semua kategori</option>
                {(Object.keys(categoryLabels) as Category[]).map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <p className="section-summary">Menampilkan {comments.length} dari {formatNumber(commentTotal)} komentar sesuai filter.</p>
        {comments.length > 0 ? (
          <div className="comment-list">
            {comments.map((comment) => (
              <article className="comment-row" key={comment.id}>
                <div className="comment-person">
                  <div className="avatar-placeholder">{comment.username.slice(0, 2).toUpperCase()}</div>
                  <div><strong>@{comment.username}</strong><span><PlatformMark platform={comment.post.platform} /> {comment.post.platform === "ig" ? "Instagram" : "TikTok"} · {formatDate(comment.commented_at)}</span></div>
                </div>
                <div className="comment-body">
                  <p>“{comment.comment_text}”</p>
                  {comment.summary_reason && <small>{comment.summary_reason}</small>}
                </div>
                <div className="comment-meta">
                  <span className={`sentiment-badge ${comment.sentiment}`}><i />{sentimentMeta[comment.sentiment].label}</span>
                  <span>{categoryLabels[comment.category]}</span>
                  <strong>{Math.round(comment.confidence * 100)}% yakin</strong>
                </div>
                <a href={comment.post.post_url} target="_blank" rel="noreferrer" aria-label="Buka post sumber"><ExternalLink size={16} /></a>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Tidak ada komentar" description="Tidak ada hasil yang cocok dengan kombinasi filter ini." />}
      </section>

      <section id="alerts" className="content-section alert-section scroll-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Prioritas respons</p>
            <h2>Alert untuk Tim Markom</h2>
          </div>
          <span className="alert-count"><AlertTriangle size={15} /> {alerts.length} tertunda</span>
        </div>
        {alerts.length > 0 ? (
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className="alert-row" key={alert.id}>
                <span className="alert-indicator"><AlertTriangle size={18} /></span>
                <div className="alert-content">
                  <div><strong>@{alert.comment.username}</strong><span>{categoryLabels[alert.comment.category]} · {Math.round(alert.comment.confidence * 100)}% confidence</span></div>
                  <p>“{alert.comment.comment_text}”</p>
                  <small>Dibuat {formatDate(alert.created_at, true)} · {alert.comment.post.platform === "ig" ? "Instagram" : "TikTok"}</small>
                </div>
                <a className="text-link" href={alert.comment.post.post_url} target="_blank" rel="noreferrer">Lihat sumber <ExternalLink size={14} /></a>
                <button className="handled-button" type="button" disabled={handlingAlert === alert.id} onClick={() => markHandled(alert.id)}>
                  {handlingAlert === alert.id ? <RefreshCcw size={15} className="spin" /> : <Check size={16} />}
                  {handlingAlert === alert.id ? "Menyimpan" : "Sudah ditangani"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="all-clear">
            <span><Check size={23} /></span>
            <div><strong>Antrean Markom bersih</strong><p>Tidak ada komentar negatif ber-confidence tinggi yang menunggu tindak lanjut.</p></div>
            <ChevronRight size={18} />
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        <span>Beauty Kendari sentiment desk</span>
        <span><MessageCircleMore size={14} /> Data komentar disimpan untuk analisis historis</span>
      </footer>
    </div>
  );
}
