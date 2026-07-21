---
name: prompt-account-snapshot
description: Satu halaman overview kondisi account — cukup untuk briefing singkat
trigger: "account snapshot", "overview akun", "cek kondisi akun"
argument-hint: "account snapshot"
---

# Account Snapshot

## Tujuan & Masalah yang Diselesaikan
Briefing satu halaman tentang kondisi account — cepat dibaca, cukup untuk meeting singkat atau check-in harian. Berisi total spend, ROAS, CPA, jumlah active campaign, top campaign, dan alert jika ada yang perlu diperhatikan. Bukan deep dive — cukup overview yang actionable.

## Platform
Meta (+ TikTok opsional)

## Periode Data
30 hari

## Metrik & Dimensi
- **Metrik:** Total spend, ROAS, CPA, conversions, active campaigns, top campaign by spend/conversions
- **Dimensi:** Account level (aggregate) + campaign top 3

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| ROAS vs target | < target × 0.8 | Alert — perlu investigasi |
| CPA | > unit economics break-even | Alert — rugi |
| Frequency aggregate | > 3.0 | Fatigue risk — perlu refresh |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_account_info
- provider: "meta"

### 2. Tool: ads_get_performance
- provider: "meta"
- level: "account"
- since: "30 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "leads", "purchase_value", "roas", "cpa"]

### 3. Tool: ads_list_campaigns
- provider: "meta"
- params: { limit: 50 }

## Struktur Analisis
1. **Account info** — Nama akun, currency, timezone, status
2. **Key metrics** — Total spend, ROAS, CPA, conversions
3. **Campaign summary** — Jumlah active/paused campaigns, top 3 by spend
4. **Alerts** — Hal yang perlu perhatian segera

## Format Output
```
# 📊 Account Snapshot — [Nama Akun]
**Periode:** [30 hari terakhir]

## Account Info
| Item | Value |
|------|-------|
| Account ID | [id] |
| Currency | [currency] |
| Timezone | [timezone] |
| Status | [active/disabled] |

## Key Metrics (30d)
| Metrik | Value |
|--------|-------|
| Total Spend | $X |
| ROAS | X.x |
| CPA | $X |
| Conversions | X |
| Frequency | X.x |

## Campaigns
| Status | Count |
|--------|-------|
| Active | X |
| Paused | Y |

**Top 3 Campaigns by Spend:**
1. [Name] — $X — ROAS X.x
2. [Name] — $Y — ROAS Y.y
3. [Name] — $Z — ROAS Z.z

## ⚠️ Alerts
• [Alert 1]
• [Alert 2]
```

## Contoh Output (sederhana)
```
# 📊 Account Snapshot — Toko Online Shop
**Periode:** 21 Jun — 21 Jul 2026

## Key Metrics
| Metrik | Value |
|--------|-------|
| Total Spend | $18,500 |
| ROAS | 2.8x |
| CPA | $19 |
| Conversions | 520 |
| Frequency | 2.4 |

## Campaigns
**Active:** 8 | **Paused:** 2

**Top 3:**
1. Prospecting LAL — $5,200 — ROAS 3.5x
2. Retargeting 30d — $4,800 — ROAS 1.5x
3. Brand Awareness — $3,100 — ROAS 0.8x

## ⚠️ Alerts
• Retargeting 30d frequency 4.2 — perlu refresh creative
• Brand Awareness ROAS 0.8x — evaluasi tujuan campaign
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Cukup overview — jangan overload data
3. Jangan bahas detail ad set/creative — cukup campaign level
4. Setiap alert harus spesifik — "ada masalah" tidak cukup
