# PRD: Sistem Analisis Sentimen Komentar IG & TikTok — Beauty Kendari

**Versi:** 1.0 (Draft)
**Pemilik:** Ari — ABS Group / Beauty Kendari
**Status:** Draft awal untuk direview

---

## 1. Latar Belakang

Beauty Kendari aktif memposting konten promosi/produk di Instagram dan TikTok. Komentar dari audiens di kedua platform ini adalah sumber insight yang belum dimanfaatkan — mengandung sentimen pelanggan (puas/kecewa), pertanyaan produk, komplain, dan indikasi minat beli. Saat ini tidak ada sistem yang memantau atau menganalisis komentar ini secara sistematis.

## 2. Tujuan (Goals)

1. Mengumpulkan komentar dari postingan IG & TikTok Beauty Kendari secara otomatis.
2. Mengklasifikasikan sentimen tiap komentar (positif / negatif / netral) menggunakan LLM.
3. Menyajikan insight dalam dashboard agar tim marketing/CS bisa memantau reputasi & respons audiens per post, per waktu.
4. Deteksi dini komentar negatif/komplain agar bisa direspons cepat oleh CS.

## 3. Non-Goals (Di luar scope MVP)

- Tidak membalas komentar secara otomatis (no auto-reply).
- Tidak menganalisis DM/pesan pribadi.
- Tidak mencakup platform lain (Facebook, dll) di fase awal.
- Tidak melakukan analisis sentimen terhadap caption/konten post itu sendiri (fokus di komentar).

## 4. User & Role

| Role | Kebutuhan |
|---|---|
| Admin/Marketing | Lihat tren sentimen per post/brand, export laporan |
| Tim Markom | Lihat komentar negatif terbaru untuk direspons manual, terima alert |
| Owner/Manajemen | Ringkasan mingguan performa sentimen |

## 5. Alur Sistem (High-Level Flow)

```
[IG/TikTok Post] 
      │  (polling terjadwal, cron ~15-30 menit)
      ▼
[Scraper Service] ──► simpan raw comment ──► [Supabase: raw_comments]
      │
      ▼
[Preprocessing] (bersihkan mention/URL/emoji, filter spam)
      │
      ▼
[LLM Classification via 9router] (sentimen + kategori + confidence)
      │
      ▼
[Supabase: comments_analyzed]
      │
      ▼
[Dashboard Next.js] ── alert komentar negatif ──► [Notifikasi CS: WA/Telegram via n8n?]
```

## 6. Fitur MVP

### 6.1 Scraper Module
- **Auto-discovery post**: scraper mengambil semua post baru dari akun IG & TikTok Beauty Kendari secara otomatis (bukan input manual per URL) — cek post baru tiap kali cron jalan.
- Scraping komentar: username, isi komentar, timestamp, jumlah like (jika ada).
- Jadwal polling via cron (GitHub Actions atau n8n, konsisten dengan stack existing Ari):
  - Cek post baru: tiap 15-30 menit (near real-time untuk deteksi post baru)
  - Re-scrape komentar per post: berkala selama post masih "aktif" (misal 7 hari pertama sejak posting, karena komentar biasanya terus masuk selama periode ini), lalu turunkan frekuensi setelahnya
- Deduplikasi — komentar yang sudah pernah diambil tidak diproses ulang.
- Rate-limit & rotasi (pakai proxy yang sudah ada — Webshare) untuk hindari block.
- Volume per post relatif kecil (rata-rata puluhan, maksimal ~100 komentar saat post ramai) — ini artinya *auto-discovery + re-scrape berkala* jauh lebih feasible dari sisi cost/rate-limit dibanding awalnya diasumsikan, dan tidak butuh infrastruktur scraping berat.

### 6.2 Preprocessing
- Bersihkan mention (@user), URL, emoji berlebih.
- Normalisasi slang umum Bahasa Indonesia (opsional, bisa diserahkan ke LLM langsung).
- Filter komentar spam (giveaway bot, "follow back", dll) sebelum masuk ke LLM — hemat cost.

### 6.3 Sentiment Classification (LLM via 9router)
- Setiap komentar dikirim ke LLM dengan prompt terstruktur, output JSON:
  - `sentiment`: positive / negative / neutral
  - `category`: pertanyaan produk / komplain / pujian / spam / lainnya
  - `confidence`: skor
  - `summary_reason`: alasan singkat (opsional, buat debugging)
- Batch processing untuk efisiensi (kirim beberapa komentar sekaligus per call, bukan 1-1).
- Fallback model jika 9router/provider utama error (sesuai pola round-robin yang sudah dipakai Ari).

### 6.4 Dashboard (Next.js + Supabase)
- Ringkasan sentimen per post (pie/bar chart: % positif/negatif/netral).
- Tren sentimen dari waktu ke waktu (line chart).
- Daftar komentar negatif terbaru (prioritas tinggi, untuk ditindaklanjuti CS).
- Filter per akun (IG/TikTok), per rentang tanggal, per post.
- Tandai komentar sebagai "sudah ditindaklanjuti".

### 6.5 Alerting
- Jika ada komentar negatif dengan confidence tinggi → kirim notifikasi ke WA/Telegram **tim markom** via n8n (konsisten dengan infra existing).
- Karena volume komentar per post kecil (<100), alert bisa granular per komentar tanpa risiko notifikasi banjir/spam.

## 7. Data Model (Draft — Supabase)

**`posts`**
- id, platform (ig/tiktok), post_url, caption, posted_at, account_name

**`raw_comments`**
- id, post_id (FK), username, comment_text, commented_at, scraped_at, is_processed

**`comments_analyzed`**
- id, raw_comment_id (FK), sentiment, category, confidence, summary_reason, analyzed_at

**`alerts`** (opsional)
- id, comment_id (FK), status (pending/handled), handled_by, handled_at

## 8. Tech Stack (usulan, konsisten dengan stack Ari)

- **Scraper:** Apify Free Plan (Actor Instagram Comment Scraper & TikTok Comment Scraper)
- **Scheduler:** GitHub Actions cron / n8n
- **Backend/API:** Next.js API routes atau Cloudflare Worker
- **Database:** Supabase (Postgres)
- **LLM:** mimo-v2.5 pro dari Xiaomi
- **Dashboard:** Next.js + shadcn/ui + Recharts
- **Notifikasi:** n8n → WA/Telegram

## 9. Pertimbangan Teknis & Risiko

| Risiko | Mitigasi |
|---|---|
| IG/TikTok deteksi & block scraper | Rotasi proxy (Webshare), rate-limit polling, gunakan Apify (sudah handle anti-block) |
| "Real-time" sebenarnya tidak feasible tanpa API resmi | Set ekspektasi: near real-time via polling 15-30 menit |
| Biaya LLM | Risiko rendah — volume komentar per post kecil (<100), tapi tetap filter spam sebelum kirim ke LLM untuk efisiensi |
| Akurasi sentimen untuk bahasa gaul/sarkas | Prompt engineering + review manual sample secara berkala |
| Perubahan struktur HTML IG/TikTok (scraper rawan patah) | Monitoring health-check scraper, alert jika gagal berturut-turut |

## 10. Metrik Keberhasilan (Success Metrics)

- % komentar berhasil ter-scrape vs total komentar aktual (target >90%)
- Waktu rata-rata dari komentar masuk → terklasifikasi (target <30 menit)
- Akurasi klasifikasi sentimen (validasi sample manual, target >85%)
- Waktu respons CS terhadap komentar negatif (before/after sistem ini ada)

## 11. Roadmap Fase

**Fase 1 (MVP):**
- Scraper dengan auto-discovery post baru + jadwal cron dasar
- Klasifikasi sentimen via LLM (9router)
- Dashboard basic: list komentar + chart sederhana per post

**Fase 2:**
- Alerting komentar negatif ke tim markom via WA/Telegram (n8n)
- Fitur "tandai sudah ditindaklanjuti" di dashboard

**Fase 3:**
- Analisis kategori lebih detail (per produk/brand yang disebut)
- Laporan ringkasan mingguan otomatis untuk manajemen

## 12. Keputusan (Resolved)

| Pertanyaan | Keputusan |
|---|---|
| Post mana yang dipantau | Semua post baru secara otomatis (auto-discovery), rentang aktif mingguan-bulanan |
| Penanggung jawab tindak lanjut komentar negatif | Tim Markom |
| Volume komentar per post | Kecil — biasanya sedikit, maksimal ~100 saat post ramai. Scraping & biaya LLM tidak jadi risiko besar |
| Retensi data | Perlu disimpan jangka panjang (tidak rolling delete) — cocok untuk analisis tren historis |
| Metode scraping | **Apify Free Plan** — $5 kredit gratis/bulan, tanpa kartu kredit, cukup untuk volume kecil di MVP. Upgrade ke Starter ($29/bulan) hanya jika nanti scale up signifikan. Catatan: kredit tidak roll over antar bulan, jadi perlu monitoring usage |
| Akses dashboard | Cukup 1 akun shared dulu di MVP (belum perlu multi-user/role-based login) |

## 13. Open Questions (Sisa)

Semua open question utama sudah terjawab. PRD ini siap masuk ke tahap desain teknis.

---

*Draft PRD v1.2 — siap lanjut ke desain teknis: arsitektur scraper (pilih Actor Apify untuk IG & TikTok), skema database final, dan desain prompt untuk LLM classification.*
