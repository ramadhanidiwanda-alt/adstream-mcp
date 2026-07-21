---
name: prompt-promo-postmortem
description: Evaluasi performa promo/sales event — apa yang berhasil dan tidak
trigger: "promo post mortem", "evaluasi promo", "post mortem event"
argument-hint: "promo postmortem"
---

# Promo Post-Mortem

## Tujuan & Masalah yang Diselesaikan
Setelah promo atau sales event selesai, perlu evaluasi: apakah promo mencapai target? Apa yang berhasil dan tidak? Template ini membandingkan performa selama periode promo dengan baseline (periode non-promo yang sama panjangnya), membreakdown per campaign, dan memberikan learnings untuk promo berikutnya.

## Platform
Meta, TikTok

## Periode Data
Periode promo spesifik + compare ke periode baseline (pre-promo sama panjang)

## Metrik & Dimensi
- **Metrik:** spend, ROAS, CPA, conversions, CTR, frequency, CPM — vs baseline
- **Dimensi:** campaign level, date

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Vs baseline | ROAS, CPA, conversions | Bandingkan promo vs non-promo |
| Vs target promo | Target promo spesifik | Flag jika tidak tercapai |
| Frequency | > 4.0 selama promo | Audience terlalu sering terpapar |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance (periode promo)
- provider: "meta"
- level: "account"
- since: "[start promo]"
- until: "[end promo]"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]

### 2. Tool: ads_get_performance (periode baseline — sama panjang)
- provider: "meta"
- level: "account"
- since: "[start baseline]"
- until: "[end baseline]"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpm", "purchases", "purchase_value", "roas", "cpa"]

### 3. Tool: ads_get_performance (campaign breakdown)
- provider: "meta"
- level: "campaign"
- since: "[start promo]"
- until: "[end promo]"
- metrics: ["spend", "roas", "ctr", "purchases", "cpa"]

### 4. Tool: ads_get_change_history
- provider: "meta"
- since: "[start promo]"
- until: "[end promo]"

## Struktur Analisis
1. **Promo overview** — Nama promo, periode, total spend, target
2. **Performance vs baseline** — Bandingkan metrik utama promo vs non-promo
3. **Campaign breakdown** — Campaign mana yang perform terbaik selama promo
4. **Learnings** — Apa yang berhasil? Apa yang tidak?
5. **Next time** — Rekomendasi untuk promo berikutnya

## Format Output
```
# Promo Post-Mortem: [Nama Promo]
**Periode:** [tanggal] — [tanggal]

## Overview
| Metrik | Promo | Baseline | Δ |
|--------|-------|----------|---|
| Spend | $X | $Y | +/-Z% |
| ROAS | X.x | Y.y | +/-Z% |
| Conversions | X | Y | +/-Z% |
| CPA | $X | $Y | +/-Z% |
| CTR | X% | Y% | +/-Z% |

## Campaign Performance During Promo
| Campaign | Spend | ROAS | CPA | Conversions |
|----------|-------|------|-----|-------------|
| [name] | $X | X.x | $Y | Z |

## What Worked ✅
1. [Temuan positif]

## What Didn't Work ❌
1. [Temuan negatif]

## Learnings for Next Promo
1. [Rekomendasi]
2. [Rekomendasi]
```

## Contoh Output (sederhana)
```
# Promo Post-Mortem: Harbolnas 7.7
**Periode:** 7 Jul — 14 Jul 2026

## Overview
| Metrik | Promo | Baseline | Δ |
|--------|-------|----------|---|
| Spend | $8,200 | $4,100 | +100% |
| ROAS | 2.1x | 3.5x | -40% |
| Conversions | 410 | 144 | +185% |
| CPA | $20 | $28 | -29% |

## What Worked ✅
- CPA turun 29% — promo berhasil efisiensi cost per conversion
- Volume conversions naik 185% — traffic besar

## What Didn't Work ❌
- ROAS turun 40% — diskon besar menekan revenue per conversion
- Frequency 4.5 — audience fatigue karena terlalu banyak frekuensi iklan

## Learnings
1. Scale back frequency cap — batasi 3 impressions per orang
2. Segmen audience: non-customer untuk promo, customer untuk regular
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Pastikan periode baseline valid — sama panjang dengan promo
3. Jangan bandingkan promo dengan non-promo tanpa disclaimer tentang perbedaan diskon/offer
4. Jangan rekomendasi tanpa evidence dari data
