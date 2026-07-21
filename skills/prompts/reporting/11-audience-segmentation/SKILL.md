---
name: prompt-audience-segmentation
description: Breakdown performa berdasarkan segmentasi audiens (demografi, placement, region)
trigger: "audience segmentation", "segmentasi audiens", "demografi performa"
argument-hint: "audience segmentation"
---

# Audience Segmentation Report

## Tujuan & Masalah yang Diselesaikan
Tidak semua segment audiens performanya sama. Template ini membreakdown performa iklan berdasarkan demografi (age, gender), placement (feed, story, reels), device, dan region. Tujuannya mengidentifikasi segment mana yang paling efisien (target scaling) dan mana yang boros (target optimasi atau exclusion).

## Platform
Meta

## Periode Data
30 hari

## Metrik & Dimensi
- **Metrik:** spend, ROAS, CPA, CTR, CVR per segment
- **Dimensi:** age, gender, placement, impression_device, region (breakdowns)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| ROAS per segment | Bandingkan dengan account avg | Scale segment di atas rata-rata |
| CPA per segment | > 2x account avg | Evaluasi — cut atau optimasi |
| CPM per segment | > 2x account avg | Segment mahal — evaluasi relevansi |
| Sample size | < 500 impressions | Jangan interpretasi — terlalu kecil |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance
- provider: "meta"
- level: "campaign"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "purchases", "purchase_value", "roas", "cpa"]
- breakdowns: ["age", "gender"]

### 2. Tool: ads_get_performance (placement)
- provider: "meta"
- level: "campaign"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "ctr", "cpm", "roas", "cpa"]
- breakdowns: ["placement"]

### 3. Tool: ads_get_performance (device)
- provider: "meta"
- level: "campaign"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "ctr", "cpm", "roas"]
- breakdowns: ["impression_device"]

### 4. Tool: ads_get_performance (region — opsional)
- provider: "meta"
- level: "campaign"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "roas", "cpa"]
- breakdowns: ["region"]

### 5. Tool: ads_read_adset_full (untuk konteks targeting)
- provider: "meta"
- params: {}

## Struktur Analisis
1. **Demografi** — Performa per age group + gender
2. **Placement** — Performa per placement (feed, story, reels, marketplace, dll)
3. **Device** — Performa per device (iOS, Android, desktop)
4. **Region** — Performa per region/kota (jika tersedia)
5. **Comparison** — Segment mana yang outperformed / underperformed
6. **Rekomendasi** — Targeting adjustment

## Format Output
```
# Audience Segmentation Report
**Periode:** [30 hari terakhir]

## Demografi
| Age | Gender | Spend | ROAS | CPA | CTR | CPM |
|-----|--------|-------|------|-----|-----|-----|
| 18-24 | All | $X | X.x | $Y | X% | $Z |
| 25-34 | All | $X | X.x | $Y | X% | $Z |
| ... | ... | ... | ... | ... | ... | ... |

## Placement
| Placement | Spend | ROAS | CPA | CPM |
|-----------|-------|------|-----|-----|
| Feed | $X | X.x | $Y | $Z |
| Story | $X | X.x | $Y | $Z |
| Reels | $X | X.x | $Y | $Z |

## Device
| Device | Spend | ROAS | CPM |
|--------|-------|------|-----|
| iOS | $X | X.x | $Z |
| Android | $X | X.x | $Z |

## Recommendations
1. [Rekomendasi targeting]
2. [Rekomendasi placement]
3. [Rekomendasi device exclusion]
```

## Contoh Output (sederhana)
```
# Audience Segmentation Report
**Periode:** 21 Jun — 21 Jul 2026

## Demografi
| Age | Spend | ROAS | CPA | CTR |
|-----|-------|------|-----|-----|
| 18-24 | $2,100 | 1.8x | $35 | 0.9% |
| 25-34 | $6,800 | 3.5x | $15 | 2.2% |
| 35-44 | $4,200 | 2.8x | $18 | 1.8% |
| 45-54 | $1,800 | 1.2x | $42 | 0.7% |
| 55+ | $600 | 0.8x | $58 | 0.5% |

## Placement
| Placement | Spend | ROAS | CPM |
|-----------|-------|------|-----|
| Feed | $8,500 | 3.2x | $8.50 |
| Story | $3,200 | 2.1x | $12.00 |
| Reels | $2,800 | 1.5x | $15.50 |

## Recommendations
1. Scale age 25-44 — ROAS 3x+ dengan CPA terendah
2. Turunkan budget age 45+ — ROAS di bawah 1.5x
3. Alokasi lebih ke Feed placement — ROAS 3.2x vs Reels 1.5x
4. Evaluasi Reels — CPM tertinggi tapi ROAS terendah
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Data breakdown bisa besar — batasi segment yang signifikan secara statistik
3. **Jangan over-interpretasi sample kecil** — minimal 500 impressions per segment
4. Jangan rekomendasi age exclusion tanpa data konversi yang cukup
5. Region breakdown opsional — hanya jika user butuh
