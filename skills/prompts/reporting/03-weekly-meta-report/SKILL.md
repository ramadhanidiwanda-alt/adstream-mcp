---
name: prompt-weekly-meta-report
description: Report Meta mingguan komprehensif dari level account sampai creative
trigger: "weekly meta report", "laporan meta mingguan", "report mingguan"
argument-hint: "weekly meta report"
---

# Weekly Meta Report

## Tujuan & Masalah yang Diselesaikan
Report Meta mingguan paling lengkap — dari level account, campaign, ad set, hingga creative. Cocok untuk stakeholder yang ingin visibilitas penuh: berapa spend, bagaimana performa setiap campaign, creative mana yang bekerja, dan apa yang berubah selama seminggu terakhir.

## Platform
Meta

## Periode Data
7 hari

## Metrik & Dimensi
- **Metrik:** spend, impressions, reach, clicks, CTR, CPC, CPM, frequency, purchases, leads, purchase_value, ROAS
- **Dimensi:** account, campaign, ad set, ad (creative)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| W/W comparison | Semua metrik | Flag perubahan > 20% |
| Frequency | > 3.0 | Creative fatigue |
| ROAS vs target | < target × 0.8 | Investigasi |
| Spend vs budget | > 120% pacing | Overspend risk |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_account_info
- provider: "meta"

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "account"
- since: "7 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "leads", "purchase_value", "roas"]

### 3. Tool: ads_get_performance
- provider: "meta"
- level: "campaign"
- since: "7 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]
- breakdowns: []

### 4. Tool: ads_get_performance
- provider: "meta"
- level: "ad"
- since: "7 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpm", "frequency", "purchases", "roas"]

### 5. Tool: ads_get_change_history
- provider: "meta"
- since: "7 hari lalu"
- until: "hari ini"

### 6. Tool: ads_get_creatives (opsional)
- provider: "meta"
- level: "ad"
- since: "7 hari lalu"
- until: "hari ini"

## Struktur Analisis
1. **Account level** — Ringkasan performa aggregate: spend, ROAS, purchases
2. **Campaign breakdown** — Tabel performa per campaign + perbandingan w/w
3. **Ad set highlights** — Top/bottom performing ad sets
4. **Creative insights** — Creative dengan CTR/ROAS terbaik dan terendah
5. **Change log** — Perubahan yang terjadi selama minggu ini
6. **Rekomendasi** — Action items

## Format Output
```
# Weekly Meta Report — [Nama Akun]
**Periode:** [tanggal] — [tanggal]

## Account Overview
| Metrik | This Week | Last Week | Δ |
|--------|-----------|-----------|---|
| Spend | $X | $Y | +/-Z% |
| ROAS | X.x | Y.y | +/-Z% |
| Purchases | X | Y | +/-Z% |

## Campaign Performance
| Campaign | Spend | ROAS | CPA | Frequency | Δ Spend | Δ ROAS |
|----------|-------|------|-----|-----------|---------|--------|
| ... | ... | ... | ... | ... | ... | ... |

## Creative Insights
**Top 3 Creative by ROAS:**
1. [Name] — ROAS X.x — spend $Y
2. ...

**Bottom 3 Creative by ROAS:**
1. [Name] — ROAS X.x — spend $Y
2. ...

## Change Log
- [Date]: [change description]

## Recommendations
1. ...
2. ...
```

## Contoh Output (sederhana)
```
# Weekly Meta Report — Toko Online Shop
**Periode:** 14 Jul — 21 Jul 2026

## Account Overview
| Metrik | This Week | Last Week | Δ |
|--------|-----------|-----------|---|
| Spend | $5,200 | $4,150 | +25% |
| ROAS | 2.8x | 3.2x | -12% |
| Purchases | 156 | 139 | +12% |

## Campaign Performance
| Campaign | Spend | ROAS | CPA | Freq | Δ ROAS |
|----------|-------|------|-----|------|--------|
| Prospecting | $2,800 | 3.5x | $18 | 1.8 | +8% |
| Retargeting | $1,500 | 1.5x | $38 | 4.2 | -22% |

## Recommendations
1. Refresh Retargeting creative (frequency 4.2)
2. Scale Prospecting LAL 1% (ROAS 3.5x, masih rendah frequency)
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Report paling komprehensif — butuh multiple MCP calls
3. Pastikan w/w comparison menggunakan periode yang sama panjangnya
4. Jangan tampilkan creative tanpa minimal 500 impressions
