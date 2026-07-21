---
name: prompt-blended-roas-report
description: Satu angka ROAS gabungan dari semua platform — efisiensi total marketing spend
trigger: "blended roas", "roas gabungan", "cross platform roas"
argument-hint: "blended roas"
---

# Blended ROAS Report

## Tujuan & Masalah yang Diselesaikan
Management ingin satu angka: "Apakah total marketing spend kita efisien?" Template ini menggabungkan data spend dan revenue dari semua platform (Meta, TikTok, dan sumber commerce) menjadi satu blended ROAS. Juga membandingkan ROAS antar platform untuk alokasi budget yang lebih cerdas.

## Platform
Meta + TikTok

## Periode Data
7–30 hari

## Metrik & Dimensi
- **Metrik:** spend, purchase_value, ROAS per platform, blended ROAS, total revenue
- **Dimensi:** platform, account

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Blended ROAS vs target | < target | Evaluasi alokasi budget antar platform |
| ROAS antar platform | Gap > 1.0x | Alokasi lebih ke platform dengan ROAS lebih tinggi |
| Platform contribution | < 10% total conversions | Evaluasi apakah platform masih layak |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance (Meta)
- provider: "meta"
- level: "account"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "purchases", "purchase_value", "roas"]

### 2. Tool: tiktok_get_report (TikTok — opsional)
- provider: "tiktok"
- dataLevel: "AUCTION_CAMPAIGN"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- dimensions: []
- metrics: ["spend", "conversions", "conversion_value", "roas"]

### 3. Tool: commerce_get_performance (jika ada data revenue langsung)
- provider: "tiktok_gmv"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["gmv", "revenue"]

## Struktur Analisis
1. **Per platform** — Spend, revenue, ROAS untuk setiap platform
2. **Blended calculation** — Total revenue / Total spend
3. **Comparison** — Platform mana yang paling efisien
4. **Allocation recommendation** — Kemana budget harus dialokasikan

## Format Output
```
# Blended ROAS Report
**Periode:** [tanggal] — [tanggal]

## Per Platform
| Platform | Spend | Revenue | ROAS | % of Total Spend |
|----------|-------|---------|------|-------------------|
| Meta | $X | $Y | X.x | Z% |
| TikTok | $X | $Y | X.x | Z% |
| **Blended** | **$X** | **$Y** | **X.x** | **100%** |

## Analysis
[Analisis perbandingan platform]

## Recommendation
[Alokasi budget ideal]
```

## Contoh Output (sederhana)
```
# Blended ROAS Report
**Periode:** 21 Jun — 21 Jul 2026

| Platform | Spend | Revenue | ROAS | % Spend |
|----------|-------|---------|------|---------|
| Meta | $18,500 | $51,800 | 2.8x | 73% |
| TikTok | $6,800 | $17,000 | 2.5x | 27% |
| **Blended** | **$25,300** | **$68,800** | **2.72x** | **100%** |

## Analysis
Meta outperform TikTok dalam ROAS (2.8x vs 2.5x) dengan porsi spend 73%. 
TikTok tetap penting untuk reach audience berbeda.

## Recommendation
Maintain rasio 70:30 (Meta:TikTok). Naikkan budget TikTok 10% jika ROAS 
bertahan di atas 2.5x selama 2 minggu ke depan.
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Gabung data dari beberapa provider — pastikan periode sama antar platform
3. Jangan paksa TikTok call kalau data kosong — tampilkan "TikTok: data tidak tersedia"
4. Blended ROAS hanya bermakna jika periode sama — jangan gabungkan periode berbeda
5. Beri disclaimer jika data revenue berasal dari platform (bukan actual revenue)
