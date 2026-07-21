---
name: prompt-monthly-trend-analysis
description: Identifikasi pattern jangka panjang — seasonal, growth, decline
trigger: "monthly trend", "trend analysis", "analisis tren bulanan"
argument-hint: "monthly trend analysis"
---

# Monthly Trend Analysis

## Tujuan & Masalah yang Diselesaikan
Memahami arah bisnis dari data 90 hari: apakah performa sedang naik, turun, atau flat? Template ini membreakdown metrik per bulan, mendeteksi seasonal patterns, dan memberikan implikasi strategis. Bukan sekadar "bulan ini spend lebih besar" — tapi kenapa dan apa yang harus dilakukan.

## Platform
Meta, TikTok

## Periode Data
90 hari + breakdown M/M

## Metrik & Dimensi
- **Metrik:** spend, ROAS, CPA, CPM, CTR, conversions per bulan
- **Dimensi:** date (monthly), campaign

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| M/M change | Semua metrik | Flag tren naik/turun |
| Seasonal benchmark | Dibanding bulan yang sama tahun lalu (jika ada) | Validasi seasonal pattern |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance (data harian 90 hari)
- provider: "meta"
- level: "account"
- since: "90 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]
- breakdowns: ["date"]

### 2. Tool: ads_get_performance (campaign-level untuk breakdown)
- provider: "meta"
- level: "campaign"
- since: "90 hari lalu"
- until: "hari ini"
- metrics: ["spend", "roas", "purchases", "cpa"]

### 3. Tool: ads_get_change_history
- provider: "meta"
- since: "90 hari lalu"
- until: "hari ini"

## Struktur Analisis
1. **Trend overview per metrik** — Visual/text tren spend, ROAS, CPA, CPM, CTR per bulan
2. **Seasonal pattern** — Apakah ada pola berulang? (misal: akhir bulan selalu naik)
3. **Campaign contribution** — Campaign mana yang mendorong tren?
4. **Strategic implications** — Apa arti tren ini untuk strategi ke depan?
5. **Recommendations** — 2-3 rekomendasi berdasarkan tren

## Format Output
```
# Monthly Trend Analysis
**Akun:** [Nama Akun]
**Periode:** [3 bulan terakhir]

## Trend Overview

| Metrik | Bulan -2 | Bulan -1 | Bulan Ini | Trend |
|--------|----------|----------|-----------|-------|
| Spend | $X | $Y | $Z | ↗️/↘️/➡️ |
| ROAS | X.x | Y.y | Z.z | ↗️/↘️/➡️ |
| CPA | $X | $Y | $Z | ↗️/↘️/➡️ |
| CPM | $X | $Y | $Z | ↗️/↘️/➡️ |
| Conversions | X | Y | Z | ↗️/↘️/➡️ |

## Key Insights
1. [Insight 1 — dengan data]
2. [Insight 2 — dengan data]
3. [Insight 3 — dengan data]

## Strategic Implications
[Paragraf implikasi strategis]

## Recommendations
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]
```

## Contoh Output (sederhana)
```
# Monthly Trend Analysis
**Akun:** Toko Online Shop
**Periode:** Mei — Juli 2026

| Metrik | May | Jun | Jul | Trend |
|--------|-----|-----|-----|-------|
| Spend | $12k | $15k | $18k | ↗️ |
| ROAS | 3.1x | 2.5x | 2.8x | ↘️ lalu ↗️ |
| CPA | $14 | $22 | $19 | ↗️ lalu ↘️ |
| CPM | $8.5 | $11.2 | $10.8 | ↗️ |

## Key Insights
1. CPM naik 27% dari May ke Jun — kemungkinan masuk musim kompetitif
2. ROAS turun di Jun tapi recovery di Jul — setelah refresh creative
3. CPA tertinggi di Jun bersamaan dengan CPM tertinggi — correlation

## Recommendations
1. Antisipasi kenaikan CPM seasonal — siapkan creative lebih banyak
2. Lanjutkan refresh creative rutin tiap 3 minggu
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Butuh data multi-bulan — jangan interpretasi berlebihan dari 2 bulan data
3. Minimal 3 bulan data untuk trend yang berarti
4. Jangan berspekulasi tentang seasonal tanpa data tahun sebelumnya — tulis "belum cukup data"
