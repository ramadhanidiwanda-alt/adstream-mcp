---
name: prompt-top-10-opportunities
description: Prioritasi 10 action items teratas yang paling berdampak jika dioptimasi
trigger: "top opportunities", "peluang terbaik", "prioritas optimasi"
argument-hint: "top opportunities"
---

# Top 10 Opportunities

## Tujuan & Masalah yang Diselesaikan
Dari sekian banyak metrik dan campaign, mana yang paling mendesak untuk ditindaklanjuti? Template ini merangking 10 peluang optimasi teratas berdasarkan impact potensial — mengkombinasikan besaran spend, deviasi dari target, dan estimated dollar impact. Output berupa prioritized action list yang siap eksekusi.

## Platform
Meta, TikTok

## Periode Data
7–30 hari

## Metrik & Dimensi
- **Metrik:** spend, ROAS, CPA, CTR, frequency, CPM
- **Dimensi:** campaign, ad set, ad

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| ROAS | < target | Investigasi — cut budget atau optimasi |
| High spend + low ROAS | top 20% spend + ROAS bottom 20% | Prioritas #1 untuk optimasi |
| Low spend + high ROAS | bottom 20% spend + ROAS top 20% | Scaling opportunity |
| Frequency | > 3.0 | Creative fatigue — refresh |
| CTR w/w | turun > 20% | Alert — ada yang berubah |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance
- provider: "meta"
- level: "campaign"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]
- breakdowns: []

### 2. Tool: ads_get_performance (level ad set untuk detail)
- provider: "meta"
- level: "adset"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"
- metrics: ["spend", "roas", "cpa", "ctr", "frequency"]

### 3. Tool: meta_analyze_with_rules (opsional — untuk rule-based insight)
- provider: "meta"
- adAccountId: "[account_id]"
- since: "YYYY-MM-DD"
- until: "YYYY-MM-DD"

## Struktur Analisis
1. **Kumpulkan data** — Performa semua level (campaign, ad set, ad)
2. **Identifikasi masalah** — Cari campaign/ad set dengan:
   - ROAS rendah + spend tinggi (waste)
   - ROAS tinggi + spend rendah (scaling opportunity)
   - Frequency tinggi + CTR turun (fatigue)
   - CPA > break-even
3. **Ranking** — Urutkan 10 teratas berdasarkan estimated dollar impact
4. **Output** — Tiap baris: problem → evidence → $ impact → action

## Format Output
```
# Top 10 Opportunities
**Account:** [Nama Akun]
**Periode:** [tanggal] — [tanggal]

| # | Opportunity | Problem | Evidence | Est. Impact/Month | Action |
|---|------------|---------|----------|-------------------|--------|
| 1 | [title] | [problem] | [metric] | $X | [action] |
| 2 | [title] | [problem] | [metric] | $Y | [action] |
...
```

## Contoh Output (sederhana)
```
# Top 10 Opportunities
**Account:** Toko Online Shop
**Periode:** 14 Jul — 21 Jul 2026

| # | Opportunity | Problem | Est. Impact | Action |
|---|------------|---------|-------------|--------|
| 1 | Scale LAL 1% | ROAS 4.2x, spend $200/hr → budget $500/hr | +$2,800/bln | Naikkan budget 2x |
| 2 | Cut Retargeting 30d | ROAS 1.1x, spend $800/hr | -$480/bln | Turunkan budget 40% |
| 3 | Refresh creative Video A | Freq 4.5, CTR -25% w/w | -$320/bln | Ganti creative |
```

## Guardrails
1. **Read-only** — jangan mutasi apapun
2. Jangan berikan **false precision** — semua $ impact adalah "estimated"
3. Pastikan setiap opportunity punya evidence metrik yang jelas
4. Jangan masukkan opportunity tanpa data spend minimal 7 hari
