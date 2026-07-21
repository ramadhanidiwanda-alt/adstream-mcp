---
name: prompt-client-monthly-recap
description: Report bulanan siap kirim ke klien — eksekutif dan profesional
trigger: "client monthly recap", "laporan bulanan klien", "monthly recap klien"
argument-hint: "client monthly recap"
---

# Client Monthly Recap

## Tujuan & Masalah yang Diselesaikan
Report bulanan yang siap dikirim ke klien — bahasa profesional, fokus pada outcomes, bukan jargon teknis. Menjawab pertanyaan: "Apakah uang yang kita keluarkan memberikan hasil?" Dilengkapi executive summary, dashboard metrik kunci, breakdown campaign, creative highlights, dan rekomendasi.

## Platform
Meta, TikTok

## Periode Data
30 hari + compare ke bulan sebelumnya

## Metrik & Dimensi
- **Metrik:** Total spend, blended ROAS, total conversions, AOV, CPA, cost per lead, M/M change
- **Dimensi:** Account, campaign, creative (highlights only)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Target vs actual | Deviasi > 20% | Flag di executive summary |
| M/M comparison | Semua metrik | Sebutkan tren |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_account_info
- provider: "meta"

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "account"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]

### 3. Tool: ads_get_performance (data M/M — 60 hari)
- provider: "meta"
- level: "account"
- since: "60 hari lalu"
- until: "hari ini"
- metrics: ["spend", "purchases", "purchase_value", "roas", "cpa"]

### 4. Tool: ads_get_performance
- provider: "meta"
- level: "campaign"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "roas", "cpa", "purchases"]

### 5. Tool: ads_get_creatives (top/bottom creative)
- provider: "meta"
- level: "ad"
- since: "30 hari lalu"
- until: "hari ini"

### 6. Tool: ads_get_change_history
- provider: "meta"
- since: "30 hari lalu"
- until: "hari ini"

## Struktur Analisis
1. **Executive summary** — Paragraf ringkas: total spend, ROAS, highlight bulan ini
2. **Key metrics dashboard** — Tabel metrik utama vs target dan M/M
3. **Campaign breakdown** — Performa per campaign
4. **Creative highlights** — Top 3 creative by ROAS
5. **Changes & milestones** — Perubahan signifikan selama bulan
6. **Recommendations** — 3-5 rekomendasi untuk bulan depan

## Format Output
```
# Monthly Recap — [Nama Klien]
**Bulan:** [Bulan] [Tahun]
**Disiapkan:** [tanggal]

## Executive Summary
[Paragraf ringkas — maksimal 5 baris]

## Key Metrics
| Metrik | Bulan Ini | Bulan Lalu | Target | Status |
|--------|-----------|------------|--------|--------|
| Total Spend | $X | $Y | $Z | ✅/⚠️ |
| ROAS | X.x | Y.y | Z.z | ✅/⚠️ |
| Conversions | X | Y | Z | ✅/⚠️ |
| CPA | $X | $Y | $Z | ✅/⚠️ |

## Campaign Performance
| Campaign | Spend | ROAS | CPA | Conversions |
|----------|-------|------|-----|-------------|
| [name] | $X | X.x | $Y | Z |

## Creative Highlights
**Top Performers:** [nama creative] — ROAS X.x

## Recommendations for Next Month
1. ...
2. ...
```

## Contoh Output (sederhana)
```
# Monthly Recap — Toko Online Shop
**Bulan:** Juli 2026

## Executive Summary
Total spend $18,500 dengan ROAS 2.8x — sedikit di bawah target 3.0x namun lebih efisien dari bulan lalu (2.5x). Conversions naik 22% M/M.

## Key Metrics
| Metrik | Jul 2026 | Jun 2026 | Target | Status |
|--------|----------|----------|--------|--------|
| Spend | $18,500 | $15,200 | $20,000 | ✅ |
| ROAS | 2.8x | 2.5x | 3.0x | ⚠️ |
| Conversions | 520 | 426 | 500 | ✅ |

## Recommendations
1. Alokasi budget lebih besar ke campaign Prospecting (ROAS 3.5x)
2. Refresh creative Retargeting yang mulai fatigue
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Bahasa profesional, siap kirim — jangan pakai bahasa internal/teknis
3. Jangan sebut "ad set" — cukup "campaign" atau "iklan"
4. Pastikan angka M/M comparison akurat — periode sama panjang
5. Setiap rekomendasi harus actionable, bukan generik
