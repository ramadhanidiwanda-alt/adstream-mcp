---
name: prompt-creative-performance-report
description: Analisis mendalam performa creative — mana yang menghasilkan dan mana yang buang budget
trigger: "creative performance", "report kreatif", "performa iklan"
argument-hint: "creative performance report"
---

# Creative Performance Report

## Tujuan & Masalah yang Diselesaikan
Template paling komprehensif untuk menganalisis performa creative. Mengidentifikasi top 3 creative paling efisien (untuk discale), bottom 3 yang boros budget (untuk di-pause atau refresh), dan creative yang mulai menunjukkan fatigue. Juga menganalisis metrik video (view rate, watch time) jika format video tersedia.

## Platform
Meta, TikTok

## Periode Data
30 hari

## Metrik & Dimensi
- **Metrik:** spend, impressions, CTR, CVR, ROAS, frequency, video_view_rate, avg_watch_time
- **Dimensi:** ad_id, creative_id, creative_name, format (image/video/carousel)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Top 3 ROAS | Highest ROAS | Scale — tambah budget |
| Bottom 3 ROAS | Lowest ROAS + spend > $100 | Pause atau refresh |
| Frequency | > 3.0 | Fatigue — siapkan pengganti |
| CTR vs campaign avg | < 50% campaign avg | Underperformer |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_creatives
- provider: "meta"
- level: "ad"
- since: "30 hari lalu"
- until: "hari ini"
- params: { limit: 200 }

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "ad"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpm", "frequency", "purchases", "purchase_value", "roas", "cvr"]

### 3. Tool: ads_get_ad_creative_mapping
- provider: "meta"

### 4. Tool: ads_get_video_source (jika ada video creative)
- provider: "meta"

## Struktur Analisis
1. **Top performers** — 3 creative dengan ROAS tertinggi — analisa kenapa
2. **Bottom performers** — 3 creative dengan ROAS terendah (min. spend $100) — analisa kenapa
3. **Fatigue analysis** — Creative dengan frequency > 3.0 dan CTR turun
4. **Creative insights** — Pola dari top performers (format, angle, warna, CTA)
5. **Recommendations** — Action items untuk optimasi creative

## Format Output
```
# Creative Performance Report
**Periode:** [30 hari terakhir]

## Top 3 Performers
| # | Creative | Format | Spend | ROAS | CTR | Insights |
|---|----------|--------|-------|------|-----|----------|
| 1 | [name] | [img/vid] | $X | X.x | X% | [insight] |
| 2 | [name] | [img/vid] | $X | X.x | X% | [insight] |
| 3 | [name] | [img/vid] | $X | X.x | X% | [insight] |

## Bottom 3 Performers
| # | Creative | Format | Spend | ROAS | CTR | Issue |
|---|----------|--------|-------|------|-----|-------|
| 1 | [name] | [img/vid] | $X | X.x | X% | [issue] |

## Fatigue Watch
| Creative | Frequency | CTR Δ | Status |
|----------|-----------|-------|--------|
| [name] | 4.2 | -22% | 🔴 Ganti segera |
| [name] | 3.5 | -15% | 🟠 Siapkan backup |

## Recommendations
1. [Action]
2. [Action]
```

## Contoh Output (sederhana)
```
# Creative Performance Report
**Periode:** 21 Jun — 21 Jul 2026

## Top 3
| # | Creative | Format | Spend | ROAS | CTR |
|---|----------|--------|-------|------|-----|
| 1 | Testimonial — Andi | Video | $450 | 5.2x | 2.8% |
| 2 | Diskon 50% — Carousel | Carousel | $780 | 4.1x | 2.1% |
| 3 | Tutorial Pakai — Video | Video | $320 | 3.9x | 2.5% |

## Bottom 3
| # | Creative | Spend | ROAS | Issue |
|---|----------|-------|------|-------|
| 1 | Banner Baru — Image | $890 | 0.8x | CTR 0.4%, tidak relevan |
| 2 | Promo Akhir Bulan | $560 | 1.1x | Copy terlalu panjang |

## Recommendations
1. Scale creative Testimonial — tambah budget 2x
2. Pause Banner Baru — ganti dengan variasi testimonial baru
3. Refresh Promo Akhir Bulan — pendekkan headline
```

## Guardrails
1. **Read-only** — jangan pause/archive
2. Jangan bilang "pasti" untuk attribution — correlation, not causation
3. Minimal threshold untuk bottom performers: minimal $100 spend
4. Jangan tampilkan creative dengan < 500 impressions — tidak representatif
