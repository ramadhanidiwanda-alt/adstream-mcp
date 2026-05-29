# AGENTS.md

> Panduan untuk AI agents yang bekerja dengan meta-ads-agent-skill

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29 | **Status Project:** v0.3.0

## 🎯 Ringkasan Cepat (30 Detik)

- TypeScript library + AI skills untuk analisis Meta Ads
- **Operasi read-only** (write ops akan datang di v0.4)
- Tech stack: Modul ESM, strict TypeScript, Vitest
- **Aturan emas:** Jangan log token, jangan push tanpa izin
- [Mulai Cepat](#-mulai-cepat) | [Task Umum](#-task-umum)

---

## 🧭 Filosofi Project

### Prinsip Desain

1. **Keamanan Pertama** - Token adalah sacred, jangan pernah di-log
2. **Read-Only by Design** - Fokus analisis dulu, automasi belakangan
3. **Type Safety** - Kalau compile sukses, harusnya jalan
4. **Ramah untuk Agent** - Dibangun untuk AI agents, bukan cuma manusia
5. **Kompleksitas Bertahap** - Mulai simple, tambah power bertahap

### Mengapa Ini Penting?

Project ini menjembatani akses programmatic (TypeScript library) dengan natural language (AI skills). Agents butuh code patterns DAN business context sekaligus.

**Target User:** "End user goblok" (non-technical marketers) yang butuh insight tanpa ribet.

---

## ⛔ Aturan Ketat — WAJIB DIPATUHI

### 🔴 Jangan Pernah Lakukan Ini

- ❌ Log access tokens (console, errors, dimanapun)
- ❌ Buat file .md baru tanpa tanya user dulu
- ❌ `git push` tanpa izin eksplisit dari user
- ❌ Implement write operations (pause, budget, create)
- ❌ Over-generate artifacts (jawab di text, jangan bikin file)

### ✅ Selalu Lakukan Ini

- ✅ Gunakan extension `.js` di imports (requirement ESM)
- ✅ Export semua public APIs dari `src/index.ts`
- ✅ Tambahkan types ke `src/types.ts`
- ✅ Tulis tests untuk fitur baru
- ✅ Tanya sebelum buat file baru

**Alasan:** Repo ini punya terlalu banyak file .md noise dari sesi sebelumnya. Jangan tambah sampah lagi.

---

## 🏗️ Arsitektur

```
src/
├── index.ts           # Public API surface
├── metaClient.ts      # HTTP client (read-only)
├── types.ts           # Semua TypeScript types
├── tools/             # 6 fungsi read
│   ├── getAdAccounts.ts
│   ├── getCampaigns.ts
│   ├── getCampaignInsights.ts
│   ├── getAdsetInsights.ts
│   ├── getAdsInsights.ts
│   └── generateDailyReport.ts
├── analysis/          # Business logic
│   ├── analyzeCampaignPerformance.ts
│   └── recommendActions.ts
├── rules/             # Rule engine (26 templates)
│   ├── engine.ts
│   ├── types.ts
│   └── templates/
│       ├── ecommerce.ts
│       ├── leadgen.ts
│       ├── brand.ts
│       └── general.ts
└── utils/             # Helper functions

skills/meta-ads/       # AI skills (markdown)
├── audit/SKILL.md     # Performance auditing
├── manage/SKILL.md    # Campaign management
└── shared/            # Shared context
    ├── preamble.md
    ├── meta-math.md
    └── references.md

mcp-server/            # MCP wrapper
└── src/index.ts
```

### Konsep Kunci

- **Tools** = API wrappers (getCampaigns, getInsights)
- **Analysis** = Business logic (recommendations, anomaly detection)
- **Rules** = Configurable thresholds (ROAS, CTR, spend)
- **Skills** = Natural language interface untuk agents

---

## 🚀 Mulai Cepat

### Untuk Perubahan Code

```bash
npm install
npm run dev          # Watch mode untuk development
npm run test         # Jalankan tests
npm run build        # Build production
```

### Untuk Fitur Baru

1. Baca existing code di `src/tools/` atau `src/analysis/`
2. Tambahkan types ke `src/types.ts`
3. Implement di folder yang sesuai
4. Export dari `src/index.ts`
5. Tambahkan tests di `tests/`

### Untuk AI Skills

1. Baca `skills/meta-ads/shared/preamble.md` dulu
2. Gunakan existing skills sebagai template
3. Follow struktur markdown yang ada
4. Test dengan real Meta Ads data

---

## 📋 Task Umum

### Menambah Tool Baru (Operasi Read)

```typescript
// src/tools/getNewData.ts
export interface GetNewDataOptions {
  adAccountId: string;
  // ... params lain
}

export async function getNewData(
  client: MetaClient,
  options: GetNewDataOptions
): Promise<NewData[]> {
  const response = await client.metaGet<{ data: NewData[] }>(
    `/act_${options.adAccountId}/endpoint`,
    {
      fields: 'id,name,status',
      limit: 100,
    }
  );
  return response.data;
}
```

**Langkah selanjutnya:**
1. Export dari `src/index.ts`
2. Tambahkan interface ke `src/types.ts`
3. Tulis test di `tests/getNewData.test.ts`

### Menambah Logic Analysis

```typescript
// src/analysis/newAnalysis.ts
import type { CampaignInsight } from '../types.js';

export interface AnalysisResult {
  findings: string[];
  recommendations: string[];
  disclaimer: string;
}

export function analyzeNewMetric(insights: CampaignInsight[]): AnalysisResult {
  // Business logic di sini
  return {
    findings: ['Finding 1', 'Finding 2'],
    recommendations: ['Recommendation 1'],
    disclaimer: 'Ini hanya saran - review sebelum bertindak'
  };
}
```

**Jangan lupa:**
- Input harus dari existing insight types
- Output harus include clear recommendations
- Tambahkan disclaimer jika generate action recommendations

### Bekerja dengan Meta API

```typescript
// ✅ Pattern yang benar
const campaigns = await client.metaGet<{ data: Campaign[] }>(
  `/act_${adAccountId}/campaigns`,
  {
    fields: 'id,name,status,daily_budget',
    limit: 100,
  }
);

// Parse actions
import { parseActionValue } from './utils/parseActions.js';
const purchases = parseActionValue(insight.actions, 'purchase');

// Format currency
import { formatCurrency } from './utils/formatCurrency.js';
const formatted = formatCurrency(1234.56, 'IDR'); // "Rp 1.234,56"
```

---

## 🎨 Gaya Code & Konvensi

### Aturan TypeScript

- **Strict mode enabled** - Semua types harus explicit
- **Modul ESM** - Gunakan `import/export`, bukan `require`
- **Ekstensi file** - Selalu gunakan `.js` di import statements (bukan `.ts`)

```typescript
// ✅ Benar
import { MetaClient } from './metaClient.js';

// ❌ Salah
import { MetaClient } from './metaClient';
```

### Konvensi Penamaan

- **File:** camelCase (contoh: `metaClient.ts`, `getCampaigns.ts`)
- **Fungsi:** camelCase (contoh: `getCampaignInsights`, `analyzeCampaignPerformance`)
- **Types/Interfaces:** PascalCase (contoh: `MetaConfig`, `CampaignInsight`)
- **Konstanta:** UPPER_SNAKE_CASE untuk env vars (contoh: `META_ACCESS_TOKEN`)

### Organisasi Code

**Aturan:**
- Semua public APIs harus di-export dari `src/index.ts`
- Types harus didefinisikan di `src/types.ts`
- Jangan buat file baru di root `src/` tanpa alasan kuat
- Tools baru masuk ke `src/tools/`
- Analysis logic masuk ke `src/analysis/`
- Utilities masuk ke `src/utils/`

---

## 🔒 Panduan Keamanan

### ⚠️ CRITICAL: Keamanan Access Token

**JANGAN PERNAH log access tokens** - Jangan console.log, jangan error message, jangan dimanapun.

```typescript
// ✅ Benar - Token tidak pernah di-log
const url = new URL(`${this.baseUrl}${path}`);
url.searchParams.append('access_token', this.accessToken);

// ❌ Salah - JANGAN LOG URL DENGAN TOKEN
console.log('Fetching:', url.toString()); // NEVER DO THIS
```

**Checklist:**
- ❌ JANGAN PERNAH commit file `.env` (sudah ada di `.gitignore`)
- ❌ JANGAN PERNAH hardcode tokens di code
- ✅ SELALU gunakan environment variables
- ✅ SELALU mask tokens di error messages

### Hanya Operasi Read-Only

Project ini **hanya read-only** (ads_read permission) sampai v0.4.

**JANGAN implement write operations** seperti:
- Pause/resume campaigns
- Update budgets
- Create ads/campaigns
- Upload creatives

Semua recommendations harus include disclaimer bahwa ini suggestion only.

---

## 🧪 Pengujian

### Struktur Test

```typescript
import { describe, it, expect } from 'vitest';

describe('featureName', () => {
  it('harus handle edge case', () => {
    // Arrange
    const input = { /* ... */ };
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toMatchObject(expected);
  });
});
```

**Focus pada:**
- Business logic, bukan API calls
- Edge cases (empty data, missing fields, null values)
- Type safety (TypeScript should catch most bugs)

**Jangan test:**
- External APIs (Meta API) - itu integration test
- Third-party libraries - assume they work

---

## 🌐 Panduan Meta Marketing API

### Versi API

- Default: `v20.0`
- Configurable via `META_API_VERSION` env var
- Update version di `.env.example` jika ada breaking changes

### Field Umum

**Campaign Insights:**
- `campaign_id`, `campaign_name`
- `spend`, `impressions`, `reach`, `clicks`
- `ctr`, `cpc`, `cpm`
- `actions`, `action_values`, `purchase_roas`

**Actions Array:**
- `action_type`: `purchase`, `lead`, `add_to_cart`, `link_click`, dll
- `value`: string number (parse dengan `parseFloat`)

### Time Ranges

- Format: `YYYY-MM-DD`
- Gunakan `time_range` parameter: `{ since: '2026-05-21', until: '2026-05-28' }`
- Max range: 93 hari (limit Meta API)

---

## ⚠️ Penanganan Error

### MetaApiError

Gunakan custom error class untuk Meta API errors:

```typescript
import { MetaApiError } from './utils/metaError.js';

try {
  const data = await client.metaGet('/path');
} catch (error) {
  if (error instanceof MetaApiError) {
    // Handle error spesifik Meta API
    console.error(`Meta API Error ${error.code}: ${error.message}`);
  } else {
    // Handle errors lainnya
    throw error;
  }
}
```

**Properti Error:**
- `message`: Pesan error
- `code`: Kode error Meta
- `type`: Tipe error
- `subcode`: Subcode opsional
- `fbtraceId`: Trace ID opsional untuk debugging

---

## 🛠️ Build & Pengembangan

### Perintah

```bash
npm run dev          # Watch mode untuk development
npm run build        # Build production bundle
npm run test         # Jalankan tests
npm run test:watch   # Watch mode untuk tests
npm run format       # Format code dengan Prettier
npm run lint         # Lint code dengan ESLint
```

### Output Build

- Output: `dist/`
- Format: ESM only
- Includes: `.js`, `.d.ts`, `.js.map`, `.d.ts.map`
- Entry: `dist/index.js`

### Checklist Pre-commit

1. `npm run format` - Format code
2. `npm run build` - Pastikan build works
3. `npm run test` - Semua tests passing
4. Tidak ada console.logs di production code
5. Tidak ada access tokens di code atau logs

---

## 🗺️ Konteks Roadmap

- ✅ v0.1.0 - Foundation (read-only)
- ✅ v0.2.0 - Rule engine (26 templates)
- ✅ v0.3.0 - AI skills layer ← **ANDA DI SINI**
- 🔜 v0.4.0 - Write operations (pause, budget, approval workflow)
- 🔜 v0.5.0 - OAuth flow
- 🔜 v0.6.0 - Multi-account management
- 🎯 v1.0.0 - Production ready (target: Desember 2026)

### Saat Mengimplementasi Fitur Baru

- **v0.3:** Focus pada read operations dan analysis
- **v0.4:** Design dengan approval workflow in mind
- **v1.0:** Production-grade error handling dan monitoring

---

## 🐛 Troubleshooting

### Build gagal dengan "Cannot find module"

→ Check ekstensi `.js` di imports (requirement ESM)

```typescript
// ✅ Benar
import { MetaClient } from './metaClient.js';

// ❌ Salah
import { MetaClient } from './metaClient';
```

### Test gagal dengan "MetaApiError"

→ Mock `MetaClient` di tests, jangan call real API

### Error type setelah tambah field baru

→ Tambahkan ke `src/types.ts` dan export

### "Access token invalid"

→ Check file `.env`, pastikan token punya permission `ads_read`

### Error import di runtime

→ Pastikan `"type": "module"` ada di `package.json`

---

## 📚 Referensi External

- [Dokumentasi Meta Marketing API](https://developers.facebook.com/docs/marketing-api)
- [Referensi Insights API](https://developers.facebook.com/docs/marketing-api/insights)
- [Ad Account Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights)
- [TypeScript ESM](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Dokumentasi Vitest](https://vitest.dev)

---

## 🤝 Kontribusi

Project ini open source (MIT license). Kontribusi welcome!

**Sebelum submit PR:**
1. Jalankan `npm run format && npm run build && npm run test`
2. Pastikan tidak ada tokens di code atau logs
3. Update dokumentasi yang relevan
4. Keep changes focused dan minimal

---

## ❓ Ada Pertanyaan?

Jika ada ambiguity:
1. Check existing code patterns di `src/tools/` atau `src/analysis/`
2. Follow TypeScript strict mode - jika compiler complain, fix it
3. Prioritize security - when in doubt, don't log it
4. Keep it simple - ini MVP, jangan over-engineer

---

**Maintained by:** Project owner  
**Scope:** Entire repository  
**Last Updated:** 2026-05-29
