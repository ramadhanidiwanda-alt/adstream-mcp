---
name: prompt-audience-overlap-audit
description: Mendeteksi overlapping audience antar ad set dalam satu campaign
trigger: "audience overlap", "cek overlap", "tabrak audiens"
argument-hint: "audience overlap"
---

# Audience Overlap Audit

## Tujuan & Masalah yang Diselesaikan
Ad set dalam satu campaign yang menarget audience serupa saling berkompetisi di lelang — menaikkan CPM dan menurunkan efisiensi. Template ini mendeteksi overlap berdasarkan konfigurasi targeting (custom audiences, interests, demografi) dan memperkirakan wasted spend akibat kanibalisasi audience.

## Platform
Meta

## Periode Data
Point-in-time (30 hari terakhir untuk konteks data performa)

## Metrik & Dimensi
- **Metrik:** Reach overlap % (estimasi), frequency impact, estimated wasted spend
- **Dimensi:** campaign_id, ad_set_id, targeting configuration

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Overlap audiens | > 20–30% | Perlu konsolidasi ad set |
| Frequency naik | > 3.0 akibat overlap | Prioritaskan konsolidasi |
| Estimated wasted spend | > 10% budget | Segera restruktur |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_read_adset_full (untuk setiap ad set dalam campaign)
- provider: "meta"
- campaignId: "[campaign_id atau dari user]"
- params: {}

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "adset"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "impressions", "reach", "frequency", "cpm", "ctr", "purchases", "cpa"]

## Struktur Analisis
1. **List ad set** — Kumpulkan semua ad set dalam campaign target
2. **Ekstrak targeting config** — Untuk setiap ad set: custom audiences, interests, age, gender, geos, placements
3. **Deteksi overlap manual** — Cocokkan similarity antar targeting:
   - Custom audience yang sama
   - Interest segments yang tumpang tindih
   - Geo targeting yang identik
   - Demografi yang serupa
4. **Hitung dampak** — Estimasi wasted spend: (overlap% × total spend)
5. **Rekomendasi konsolidasi** — Ad set mana yang bisa digabung

## Format Output
```
# Audience Overlap Audit
**Campaign:** [Nama Campaign]

## Overlap Matrix
| Ad Set A | Ad Set B | Overlap Score | Wasted Spend (est.) |
|----------|----------|---------------|---------------------|
| [name] | [name] | High / Med / Low | $X |
| [name] | [name] | High / Med / Low | $Y |

## Detail Overlap
### High Overlap: [Ad Set A] ↔ [Ad Set B]
- **Targeting A:** [ringkasan]
- **Targeting B:** [ringkasan]
- **Similarity:** [alasan overlap]
- **Impact:** frequency [X] vs [Y], wasted ~$Z

## Rekomendasi Konsolidasi
1. Gabung [Ad Set A] + [Ad Set B] → bedakan dengan creative angle berbeda
2. Pisahkan [Ad Set C] → targeting terlalu berbeda dari yang lain
3. [Rekomendasi lainnya]
```

## Contoh Output (sederhana)
```
# Audience Overlap Audit
**Campaign:** Prospecting — Purchase

## Overlap Matrix
| Ad Set A | Ad Set B | Overlap | Wasted |
|----------|----------|---------|--------|
| Interest: Fashion | Interest: Luxe | High | ~$210 |
| LAL: Purchasers 1% | Retargeting 30d | High | ~$350 |
| LAL: Purchasers 1% | Interest: Fashion | Low | ~$40 |

## Detail Overlap
### High: LAL Purchasers 1% ↔ Retargeting 30d
Keduanya menarget orang yang sudah pernah beli. LAL 1% mengandung ~40% orang yang sama dengan Retargeting 30d.

## Rekomendasi
1. Gabung Retargeting 30d + LAL Purchasers 1% → satu ad set Retargeting with creative rotation
2. Pisahkan Interest: Fashion → bedakan dengan creative angle "new collection"
```

## Guardrails
1. **⚠️ Keterbatasan tool:** MCP saat ini belum punya overlap detection langsung. Analisis dilakukan manual dari data targeting config — beri disclaimer
2. **Read-only** — jangan gabung/pause ad set
3. Overlap score adalah estimasi — jangan berikan false precision
4. Butuh campaign_id atau daftar ad set dari user
