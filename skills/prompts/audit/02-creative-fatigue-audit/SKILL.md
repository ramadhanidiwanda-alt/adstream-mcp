---
name: prompt-creative-fatigue-audit
description: Mendeteksi creative fatigue sebelum performa drop signifikan
trigger: "creative fatigue", "cegah fatigue", "refresh creative"
argument-hint: "creative fatigue"
---

# Creative Fatigue Audit

## Tujuan & Masalah yang Diselesaikan
Mendeteksi creative fatigue sedini mungkin — sebelum CTR dan ROAS turun drastis. Template ini menghitung fatigue score setiap creative berdasarkan frequency, CTR trend, CPM trend, dan usia creative. Output berupa prioritas refresh: creative mana yang harus diganti duluan.

## Platform
Meta, TikTok

## Periode Data
7–30 hari + trend w/w untuk CTR dan CPM

## Metrik & Dimensi
- **Metrik:** frequency, CTR, CPM, CVR, impressions, creative age (hari sejak tayang)
- **Dimensi:** ad_id, creative_id, date

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Frequency | > 3.0 | Fatigue terdeteksi — refresh segera |
| CTR turun w/w | > 20% | Creative kehilangan relevansi |
| CPM naik w/w | > 30% | Auction saturation |
| Creative age | > 14 hari tanpa refresh | Risiko fatigue meningkat |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_creatives
- provider: "meta"
- level: "ad"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "ad"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpm", "frequency", "purchases", "cvr"]
- breakdowns: ["date"]

### 3. Tool: ads_get_ad_creative_mapping (untuk mapping ad → creative)
- provider: "meta"

### 4. Tool: ads_list_adimages (opsional — untuk preview)
- provider: "meta"

### 5. Tool: ads_list_advideos (opsional — untuk preview video)
- provider: "meta"

## Struktur Analisis
1. **Daftar creative** — Kumpulkan semua active creatives + usia (hari sejak tayang)
2. **Frequency analysis** — Hitung frequency per creative
3. **CTR trend** — Bandingkan CTR 7 hari terakhir vs 7 hari sebelumnya
4. **CPM trend** — Bandingkan CPM 7 hari terakhir vs 7 hari sebelumnya
5. **Fatigue score** — Komposit: frequency + CTR decline + CPM increase + usia
6. **Prioritas refresh** — Rank creative by fatigue score (tertinggi = prioritas)

## Format Output
```
# Creative Fatigue Audit
**Periode:** [tanggal] — [tanggal]

## Fatigue Scorecard
| Rank | Creative Name | Frequency | CTR Δ w/w | CPM Δ w/w | Age (days) | Fatigue Score |
|------|--------------|-----------|-----------|-----------|------------|---------------|
| 1 | [name] | 4.5 | -25% | +35% | 21 | 🔴 Critical |
| 2 | [name] | 3.8 | -18% | +22% | 18 | 🟠 High |
| ... | ... | ... | ... | ... | ... | ... |

## Prioritas Refresh
1. **[Creative Name]** — Fatigue skor tertinggi — [alasan]
2. **[Creative Name]** — [alasan]
3. ...

## Rekomendasi
- [Rekomendasi jumlah creative baru yang dibutuhkan]
- [Saran format/angle berdasarkan creative terbaik]
```

## Contoh Output (sederhana)
```
# Creative Fatigue Audit
**Periode:** 1 Jul — 21 Jul 2026

## Fatigue Scorecard
| Rank | Creative Name | Frequency | CTR Δ w/w | CPM Δ w/w | Age | Score |
|------|--------------|-----------|-----------|-----------|-----|-------|
| 1 | "Diskon 50% — Video" | 4.8 | -32% | +41% | 25 | 🔴 |
| 2 | "Testimoni 2 — Image" | 3.9 | -21% | +28% | 18 | 🟠 |
| 3 | "New Arrival — Carousel" | 2.1 | -5% | +8% | 10 | 🟢 |

## Prioritas Refresh
1. "Diskon 50% — Video" — frequency 4.8, CTR turun 32%, usia 25 hari. Ganti segera.
2. "Testimoni 2 — Image" — fatigue mulai terlihat. Siapkan pengganti dalam 5-7 hari.

## Rekomendasi
Buat minimum 3 creative baru minggu ini. Gunakan angle testimoni (CTR tertinggi di creative lain).
```

## Guardrails
1. **Read-only** — jangan pause/archive creative, rekomendasi saja
2. Fatigue score adalah indikator — bukan kepastian. Beberapa creative dengan frequency tinggi tetap konversi baik
3. Jangan rekomendasi scaling ke creative baru tanpa data — cukup identifikasi mana yang perlu refresh
