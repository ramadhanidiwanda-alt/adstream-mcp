---
name: prompt-meta-adset-deep-dive
description: Menganalisis konfigurasi dan performa satu ad set Meta secara detail
trigger: "deep dive ad set", "analisis ad set", "cek targeting ad set"
argument-hint: "<ad_set_id>"
---

# Deep Dive Ad Set Meta

## Tujuan & Masalah yang Diselesaikan
Template ini digunakan untuk membedah satu ad set Meta secara menyeluruh — dari konfigurasi targeting, budget, bidding, hingga performa di setiap placement dan device. Cocok ketika ada ad set yang performanya anjlok, spending tidak efisien, atau perlu dievaluasi sebelum scaling. Output berupa diagnosis konkrit + action items.

## Platform
Meta

## Periode Data
7–30 hari (sesuai konteks analisis)

## Metrik & Dimensi
- **Metrik utama:** spend, impressions, clicks, CTR, CPC, CPM, frequency, purchases, leads, CPA
- **Dimensi/breakdowns:** ad_set_id, campaign_id, date, placement, device

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Frequency | > 3.0 | Creative fatigue — refresh atau perluas audience |
| CTR | < industry benchmark (lihat meta-math.md) | Masalah creative atau audience mismatch |
| CPA | > break-even | Stop atau turunkan budget |
| CPM naik w/w | > 30% | Saturation atau auction pressure |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_read_adset_full
- provider: "meta"
- adsetId: "[dari user]"
- params: {}

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "adset"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "leads", "cpa"]
- breakdowns: ["date", "placement", "impression_device"]

### 3. Tool: ads_get_creatives (jika perlu audit creative)
- provider: "meta"
- level: "ad"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"

## Struktur Analisis
1. **Config dump** — Tampilkan konfigurasi lengkap ad set: targeting (age, gender, interests, geos, custom audiences), budget & schedule, bid strategy, optimization goal, placements
2. **Performance overview** — Ringkasan performa periode: spend total, ROAS/CPA, CTR, frequency
3. **Targeting audit** — Apakah terlalu sempit/lebar? Apakah ada audience overlap dengan ad set lain?
4. **Placement audit** — Breakdown per placement: mana yang boros, mana yang efisien
5. **Device audit** — Breakdown per device: iOS vs Android vs desktop, CPM berbeda signifikan?
6. **Trend harian** — Apakah ada hari tertentu yang anomali?
7. **Rekomendasi** — Action items berdasarkan temuan

## Format Output
```
# Deep Dive: [Nama Ad Set]
**Ad Set ID:** [id]

## Konfigurasi
| Parameter | Value |
|-----------|-------|
| Budget | [daily/lifetime + jumlah] |
| Optimization | [goal] |
| Bid Strategy | [strategy] |
| Targeting | [ringkasan] |
| Placements | [Advantage+ / Manual] |

## Performa ([periode])
| Metrik | Value |
|--------|-------|
| Spend | $X |
| ROAS | X.x |
| CPA | $X |
| CTR | X.x% |
| Frequency | X.x |

## Diagnosis
[Temuan + bukti + rekomendasi]

## Action Items
1. [Action] — [dampak]
2. [Action] — [dampak]
```

## Contoh Output (sederhana)
```
# Deep Dive: Ad Set Retargeting — Purchase 30d
**Ad Set ID:** 2384600000001

## Konfigurasi
| Parameter | Value |
|-----------|-------|
| Budget | Daily $50 |
| Optimization | Purchases |
| Bid Strategy | Lowest cost |
| Targeting | Custom Audience: Purchasers 30d, age 25-55, ID only |
| Placements | Advantage+ (all) |

## Performa (7 hari terakhir)
| Metrik | Value |
|--------|-------|
| Spend | $350 |
| ROAS | 1.2x |
| CPA | $25 |
| CTR | 0.8% |
| Frequency | 4.2 |

## Diagnosis
Frequency 4.2 + CTR 0.8% = audience fatigue. Audience hanya 5.000 orang — terlalu kecil untuk daily budget $50.

## Action Items
1. Perluas audience — gabung dengan LAL 1% — estimated recovery ke frequency 2.0
2. Turunkan daily budget ke $30 selama refresh creative
3. Buat 2-3 creative baru dalam 7 hari
```

## Guardrails
1. **Read-only** — jangan mutate apapun
2. Butuh `ad_set_id` spesifik dari user — jangan tebak
3. Jangan rekomendasi scaling tanpa data unit economics (AOV, margin)
4. Jika targeting configuration kosong/null, catat sebagai temuan
