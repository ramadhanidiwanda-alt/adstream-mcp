# AGENTS.md

> Panduan untuk AI agents yang bekerja dengan meta-ads-agent-skill

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29 | **Status Project:** v0.3.0

## 🎯 Ringkasan Cepat (30 Detik)

- TypeScript library + AI skills untuk analisis Meta Ads
- **Read-only operations** (write ops akan datang di v0.4)
- Tech stack: ESM modules, strict TypeScript, Vitest
- **Aturan emas:** Jangan log token, jangan push tanpa izin
- [Mulai Cepat](#-mulai-cepat) | [Task Umum](#-task-umum)

---

## 🧭 Filosofi Project

### Prinsip Desain

1. **Security First** - Token adalah sacred, jangan pernah di-log
2. **Read-Only by Design** - Fokus analisis dulu, automasi belakangan
3. **Type Safety** - Kalau compile sukses, harusnya jalan
4. **Agent-Friendly** - Dibangun untuk AI agents, bukan cuma manusia
5. **Incremental Complexity** - Mulai simple, tambah power bertahap

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
npm run test         # Run tests
npm run build        # Production build
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

### Menambah Tool Baru (Read Operation)

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

### Menambah Analysis Logic

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

## 🎨 Code Style & Conventions

### TypeScript

- **Strict mode enabled** - Semua types harus explicit
- **ESM modules** - Gunakan `import/export`, bukan `require`
- **File extensions** - Selalu gunakan `.js` di import statements (bukan `.ts`)

```typescript
// ✅ Correct
import { MetaClient } from './metaClient.js';

// ❌ Wrong
import { MetaClient } from './metaClient';
```

### Naming Conventions

- **Files:** camelCase (e.g., `metaClient.ts`, `getCampaigns.ts`)
- **Functions:** camelCase (e.g., `getCampaignInsights`, `analyzeCampaignPerformance`)
- **Types/Interfaces:** PascalCase (e.g., `MetaConfig`, `CampaignInsight`)
- **Constants:** UPPER_SNAKE_CASE untuk env vars (e.g., `META_ACCESS_TOKEN`)

### Organisasi Code

**Rules:**
- Semua public APIs harus di-export dari `src/index.ts`
- Types harus didefinisikan di `src/types.ts`
- Jangan buat file baru di root `src/` tanpa alasan kuat
- Tools baru masuk ke `src/tools/`
- Analysis logic masuk ke `src/analysis/`
- Utilities masuk ke `src/utils/`

---

## 🔒 Security Guidelines

### ⚠️ CRITICAL: Access Token Safety

**NEVER log access tokens** - Jangan console.log, jangan error message, jangan dimanapun.

```typescript
// ✅ Correct - Token tidak pernah di-log
const url = new URL(`${this.baseUrl}${path}`);
url.searchParams.append('access_token', this.accessToken);

// ❌ Wrong - JANGAN LOG URL DENGAN TOKEN
console.log('Fetching:', url.toString()); // NEVER DO THIS
```

**Checklist:**
- ❌ NEVER commit `.env` file (sudah ada di `.gitignore`)
- ❌ NEVER hardcode tokens di code
- ✅ ALWAYS gunakan environment variables
- ✅ ALWAYS mask tokens di error messages

### Read-Only Operations Only

Project ini **hanya read-only** (ads_read permission) sampai v0.4.

**JANGAN implement write operations** seperti:
- Pause/resume campaigns
- Update budgets
- Create ads/campaigns
- Upload creatives

Semua recommendations harus include disclaimer bahwa ini suggestion only.

---

## 🧪 Testing

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('featureName', () => {
  it('should handle edge case', () => {
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

## 🌐 Meta Marketing API Guidelines

### API Version

- Default: `v20.0`
- Configurable via `META_API_VERSION` env var
- Update version di `.env.example` jika ada breaking changes

### Common Fields

**Campaign Insights:**
- `campaign_id`, `campaign_name`
- `spend`, `impressions`, `reach`, `clicks`
- `ctr`, `cpc`, `cpm`
- `actions`, `action_values`, `purchase_roas`

**Actions Array:**
- `action_type`: `purchase`, `lead`, `add_to_cart`, `link_click`, etc.
- `value`: string number (parse dengan `parseFloat`)

### Time Ranges

- Format: `YYYY-MM-DD`
- Gunakan `time_range` parameter: `{ since: '2026-05-21', until: '2026-05-28' }`
- Max range: 93 days (Meta API limit)

---

## ⚠️ Error Handling

### MetaApiError

Gunakan custom error class untuk Meta API errors:

```typescript
import { MetaApiError } from './utils/metaError.js';

try {
  const data = await client.metaGet('/path');
} catch (error) {
  if (error instanceof MetaApiError) {
    // Handle Meta API specific error
    console.error(`Meta API Error ${error.code}: ${error.message}`);
  } else {
    // Handle other errors
    throw error;
  }
}
```

**Error Properties:**
- `message`: Error message
- `code`: Meta error code
- `type`: Error type
- `subcode`: Optional subcode
- `fbtraceId`: Optional trace ID untuk debugging

---

## 🛠️ Build & Development

### Commands

```bash
npm run dev          # Watch mode untuk development
npm run build        # Build production bundle
npm run test         # Run tests
npm run test:watch   # Watch mode untuk tests
npm run format       # Format code dengan Prettier
npm run lint         # Lint code dengan ESLint
```

### Build Output

- Output: `dist/`
- Format: ESM only
- Includes: `.js`, `.d.ts`, `.js.map`, `.d.ts.map`
- Entry: `dist/index.js`

### Pre-commit Checklist

1. `npm run format` - Format code
2. `npm run build` - Ensure build works
3. `npm run test` - All tests passing
4. No console.logs in production code
5. No access tokens in code or logs

---

## 🗺️ Roadmap Context

- ✅ v0.1.0 - Foundation (read-only)
- ✅ v0.2.0 - Rule engine (26 templates)
- ✅ v0.3.0 - AI skills layer ← **ANDA DI SINI**
- 🔜 v0.4.0 - Write operations (pause, budget, approval workflow)
- 🔜 v0.5.0 - OAuth flow
- 🔜 v0.6.0 - Multi-account management
- 🎯 v1.0.0 - Production ready (target: Desember 2026)

### Saat Implement Features Baru

- **v0.3:** Focus pada read operations dan analysis
- **v0.4:** Design dengan approval workflow in mind
- **v1.0:** Production-grade error handling dan monitoring

---

## 🐛 Troubleshooting

### Build fails dengan "Cannot find module"

→ Check `.js` extensions di imports (ESM requirement)

```typescript
// ✅ Correct
import { MetaClient } from './metaClient.js';

// ❌ Wrong
import { MetaClient } from './metaClient';
```

### Tests fail dengan "MetaApiError"

→ Mock `MetaClient` di tests, jangan call real API

### Type errors setelah tambah field baru

→ Tambahkan ke `src/types.ts` dan export

### "Access token invalid"

→ Check `.env` file, ensure token punya `ads_read` permission

### Import error di runtime

→ Pastikan `"type": "module"` ada di `package.json`

---

## 📚 Referensi External

- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-api)
- [Insights API Reference](https://developers.facebook.com/docs/marketing-api/insights)
- [Ad Account Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights)
- [TypeScript ESM](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Vitest Documentation](https://vitest.dev)

---

## 🤝 Contributing

Project ini open source (MIT license). Kontribusi welcome!

**Sebelum submit PR:**
1. Run `npm run format && npm run build && npm run test`
2. Pastikan tidak ada tokens di code atau logs
3. Update dokumentasi yang relevan
4. Keep changes focused dan minimal

---

## ❓ Questions?

Jika ada ambiguity:
1. Check existing code patterns di `src/tools/` atau `src/analysis/`
2. Follow TypeScript strict mode - jika compiler complain, fix it
3. Prioritize security - when in doubt, don't log it
4. Keep it simple - ini MVP, jangan over-engineer

---

**Maintained by:** Project owner  
**Scope:** Entire repository  
**Last Updated:** 2026-05-29
