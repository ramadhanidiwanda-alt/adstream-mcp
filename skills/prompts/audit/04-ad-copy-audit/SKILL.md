---
name: prompt-ad-copy-audit
description: Menganalisis pola copy iklan yang bekerja berdasarkan data performa
trigger: "ad copy audit", "analisis copy", "copy performance"
argument-hint: "ad copy audit"
---

# Ad Copy Audit

## Tujuan & Masalah yang Diselesaikan
Tidak semua copy iklan diciptakan sama. Template ini mengelompokkan creative berdasarkan variant copy (primary text, headline, CTA, struktur pesan), membandingkan performa antar variant, dan mengidentifikasi pola copy yang paling efektif untuk audience tertentu. Hasilnya berupa winning formula yang bisa direplikasi.

## Platform
Meta, TikTok

## Periode Data
30–90 hari (semakin panjang semakin baik untuk pattern recognition)

## Metrik & Dimensi
- **Metrik:** CTR, CVR, ROAS per copy variant, engagement rate (likes, shares, comments)
- **Dimensi:** ad_id, creative_id, primary_text, headline, call_to_action

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| CTR beda antar variant | Signifikan (>15%) | Pakai variant dengan CTR tertinggi sebagai template |
| ROAS antar variant | > 20% gap | Alokasi budget ke variant dengan ROAS tertinggi |
| CTR vs benchmark | < benchmark industri | Copy masalah — perlu rewrite |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_creatives
- provider: "meta"
- level: "ad"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- params: { limit: 200 }

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "ad"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "impressions", "clicks", "ctr", "cvr", "purchases", "purchase_value", "roas"]

## Struktur Analisis
1. **Kumpulkan creative copy** — Ekstrak primary_text, headline, description, call_to_action dari setiap creative
2. **Group by variant** — Kelompokkan berdasarkan pola copy (misal: diskon vs testimoni vs problem-solution)
3. **Hitung performa per variant** — CTR avg, CVR avg, ROAS avg per grup
4. **Identifikasi pola** — Copy mana yang outperform? Apa kesamaan dari top performers?
5. **Rekomendasi** — Winning formula + contoh implementasi

## Format Output
```
# Ad Copy Audit
**Periode:** [tanggal] — [tanggal]

## Copy Variant Performance
| Variant | # Ads | Avg CTR | Avg CVR | Avg ROAS | Total Spend |
|---------|-------|---------|---------|----------|-------------|
| Testimonial | 5 | 2.1% | 3.2% | 3.8x | $1,200 |
| Diskon 50% | 4 | 1.8% | 2.8% | 2.5x | $2,100 |
| Problem-Solution | 3 | 1.5% | 1.9% | 1.8x | $890 |
| New Arrival | 6 | 0.9% | 1.2% | 1.1x | $3,400 |

## Winning Pattern
[Deskripsi pola copy yang paling efektif]

## Recommendations
1. [Rekomendasi]
2. [Rekomendasi]
3. [Rekomendasi]
```

## Contoh Output (sederhana)
```
# Ad Copy Audit
**Periode:** 1 Jun — 21 Jul 2026

## Copy Variant Performance
| Variant | # Ads | Avg CTR | Avg CVR | Avg ROAS | Total Spend |
|---------|-------|---------|---------|----------|-------------|
| Testimonial | 5 | 2.1% | 3.2% | 3.8x | $1,200 |
| Diskon 50% | 4 | 1.8% | 2.8% | 2.5x | $2,100 |

## Winning Pattern
Testimonial dengan format "[nama] — [hasil] — [rekomendasi]" outperform diskon 20% dalam ROAS. Gunakan foto real customer.

## Recommendations
1. Buat 5 creative testimonial baru dengan format yang sama
2. Hentikan variant "New Arrival" (ROAS 1.1x)
3. A/B test: testimonial panjang (3 paragraf) vs pendek (1 paragraf)
```

## Guardrails
1. **Read-only** — jangan pause ad/creative
2. Copy analysis bersifat **pattern recognition** — bukan guarantee. Correlation ≠ causation
3. Jangan rekomendasi hapus creative tanpa data performa minimum (min. 1.000 impressions)
4. Pastikan sampel cukup — jangan analisis variant dengan < 3 ads
