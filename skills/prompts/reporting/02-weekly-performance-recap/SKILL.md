---
name: prompt-weekly-performance-recap
description: Check-in mingguan cepat — apa yang berubah dan perlu perhatian
trigger: "weekly recap", "ringkasan mingguan", "cek minggu ini"
argument-hint: "weekly recap"
---

# Weekly Performance Recap

## Tujuan & Masalah yang Diselesaikan
Template ringan dan cepat untuk check-in mingguan — cukup 5–10 baris yang bisa dikirim via WhatsApp/Telegram. Fokus pada perubahan paling signifikan w/w (week-over-week) dan alert yang butuh perhatian segera. Bukan report komprehensif, tapi radar.

## Platform
Meta, TikTok

## Periode Data
7 hari + compare ke 7 hari sebelumnya

## Metrik & Dimensi
- **Metrik:** spend, ROAS, CPA, CTR, frequency, purchases/leads
- **Dimensi:** account level (aggregate) + campaign level (top perubahan)

## Threshold & Perbandingan
| Tipe | Threshold | Aksi |
|------|-----------|------|
| W/W change (metrik utama) | > 20% | Flag — perlu disebut |
| Frequency | > 3.0 | Fatigue risk — perlu creative refresh |
| Anomali CPA | > 30% w/w | Investigasi penyebab |

## Data yang Dibutuhkan (Tool MCP Calls)

### 1. Tool: ads_get_performance
- provider: "meta"
- level: "account"
- since: "7 hari lalu"
- until: "hari ini"
- metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "frequency", "purchases", "purchase_value", "roas", "cpa"]

### 2. Tool: ads_get_performance (dataset 14 hari untuk w/w compare)
- provider: "meta"
- level: "account"
- since: "14 hari lalu"
- until: "hari ini"
- metrics: ["spend", "purchases", "roas", "cpa", "ctr", "frequency"]

### 3. Tool: ads_get_change_history (apa yang berubah di account)
- provider: "meta"
- since: "7 hari lalu"
- until: "hari ini"

## Struktur Analisis
1. **Summary** — 1 baris: total spend, ROAS, purchases vs last week
2. **Top changes** — 2–3 perubahan paling signifikan w/w
3. **Key risks** — 1–2 hal yang perlu dipantau
4. **Quick wins** — 1–2 rekomendasi cepat

## Format Output
```
📊 *Weekly Recap* — [Account Name]
🗓 [tanggal] — [tanggal]

*Summary:* $X spend | ROAS X.x | X purchases (+/-X% w/w)

*Top Changes:*
• [perubahan 1]
• [perubahan 2]

*⚠️ Key Risks:*
• [risk 1]
• [risk 2]

*⚡ Quick Wins:*
• [win 1]
• [win 2]
```

## Contoh Output (sederhana)
```
📊 *Weekly Recap* — Toko Online Shop
🗓 14 Jul — 21 Jul 2026

*Summary:* $5,200 spend | ROAS 2.8x | 156 purchases (+12% w/w)

*Top Changes:*
• Spend naik 25% w/w — campaign Prospecting diskalakan
• ROAS turun dari 3.2x → 2.8x — retargeting melemah

*⚠️ Key Risks:*
• Retargeting 30d frequency 4.1 — audience fatigue
• CPM naik 18% w/w — auction semakin kompetitif

*⚡ Quick Wins:*
• Refresh creative Retargeting — siapkan 2 variasi baru
• Cut budget Retargeting 20%, alihkan ke LAL 1%
```

## Guardrails
1. **Read-only** — jangan mutasi
2. Ringan dan cepat — jangan overload data
3. Cukup 5–10 baris — cocok untuk chat
4. Setiap perubahan w/w harus disebut +/- persentase
