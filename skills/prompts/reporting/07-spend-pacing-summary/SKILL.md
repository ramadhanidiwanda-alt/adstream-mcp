---
name: prompt-spend-pacing-summary
description: Tracking realisasi budget vs plan — hindari overspend/underspend
trigger: "spend pacing", "cek budget", "pacing summary"
argument-hint: "spend pacing"
---

# Spend Pacing Summary

## Tujuan & Masalah yang Diselesaikan
Memastikan budget bulanan tidak overspend atau underspend. Template ini membandingkan realisasi spend harian terhadap target budget per campaign, menghitung pacing %, dan memberikan alert ketika pacing keluar jalur. Juga merekomendasikan realokasi budget dari campaign underspend ke yang overspend.

## Platform
Meta, TikTok

## Periode Data
7–30 hari (month-to-date)

## Metrik & Dimensi
- **Metrik:** budget (daily/lifetime), spend to date, remaining budget, daily spend rata-rata, pacing %, days remaining
- **Dimensi:** campaign_id, campaign_name, budget_type (daily/lifetime)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| Pacing | < 80% | Underspend — alokasi ke campaign lain |
| Pacing | > 120% | Overspend risk — naikkan budget atau kurangi daily |
| Days remaining | < 7 hari + pacing > 100% | Aman — sisa budget cukup |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance
- provider: "meta"
- level: "campaign"
- since: "awal bulan"
- until: "hari ini"
- metrics: ["spend", "impressions"]

### 2. Tool: ads_list_campaigns
- provider: "meta"
- params: { limit: 50 }

## Struktur Analisis
1. **Kumpulkan data budget** — Dari campaign list: daily_budget, lifetime_budget, start/end date
2. **Hitung pacing** — spend_to_date / (budget_harian × hari_berjalan) untuk daily budget
3. **Alert** — Campaign mana yang pacing < 80% atau > 120%
4. **Reallocation recommendation** — Pindahkan budget dari underspend ke overspend

## Format Output
```
# Spend Pacing Summary — [Bulan] [Tahun]
**Tanggal:** [hari ini]
**MTD Spend:** $X dari $Y ([Z]% pacing)

## Campaign Pacing
| Campaign | Budget | MTD Spend | Pacing | Status |
|----------|--------|-----------|--------|--------|
| [name] | $X/day | $Y | 95% | ✅ On track |
| [name] | $X/lifetime | $Y | 135% | 🔴 Overspend |
| [name] | $X/day | $Y | 65% | 🟡 Underspend |

## Alerts
🔴 **Overspend:** [campaign] — daily $X → actual $Y/hari. Naikkan budget atau turunkan daily.
🟡 **Underspend:** [campaign] — hanya 65% pacing. Alokasi $Z ke campaign lain.

## Reallocation Recommendation
Pindahkan $X/minggu dari [campaign underspend] ke [campaign overspend dengan ROAS baik]
```

## Contoh Output (sederhana)
```
# Spend Pacing Summary — Juli 2026
**Tanggal:** 21 Jul 2026
**MTD Spend:** $12,400 dari $18,500 (67% pacing)

## Campaign Pacing
| Campaign | Budget | MTD Spend | Pacing | Status |
|----------|--------|-----------|--------|--------|
| Prospecting | $100/day | $2,100 | 100% | ✅ |
| Retargeting | $80/day | $1,680 | 100% | ✅ |
| Branding | $200/day | $2,800 | 67% | 🟡 Underspend |
| Promo Jul | $3,000 LT | $2,850 | 95% | ✅ |

## Reallocation
Pindahkan $40/hari dari Branding ke Prospecting — Prospecting ROAS 3.5x lebih baik.
```

## Guardrails
1. **Read-only** — jangan ubah budget campaign
2. Bedakan daily vs lifetime budget — cara hitung pacing berbeda
3. Jangan rekomendasi realokasi tanpa melihat performa ROAS
4. Pastikan data budget dari campaign list — jangan asumsi
