# AGENTS.md — adstream-mcp

> Panduan untuk AI agents yang bekerja dengan **adstream-mcp**

**Versi:** 1.1 | **Terakhir Diupdate:** 2026-07-21 | **Status Project:** v0.6.0

## 🎯 Ringkasan Cepat (30 Detik)

- Multi-provider MCP connector hub: **Meta Ads**, **TikTok Ads**, **Google Ads** + Commerce (TikTok GMV)
- **Read & Write operations** — campaign, adset, ad, creative (create/update/pause/resume/archive)
- Tech stack: Modul ESM, strict TypeScript, Vitest, MCP protocol
- **Aturan emas:** Jangan log token, jangan push tanpa izin, **tanya sebelum execute write ops**
- [Mulai Cepat](#-mulai-cepat) | [Struktur Folder](#-arsitektur) | [Write Safety](#-panduan-write-operations)

---

> **Strategic Context:**
> adstream-mcp is the open-source MCP execution layer for Cuan Insight — an organization-level credential control plane. Cuan Insight stores provider tokens; this MCP server resolves them at runtime and calls provider APIs directly. Connection Keys are organization-rooted but scoped by workspace/provider/account/scope. Do not design this as Claude-only; it must remain client-agnostic. See [docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md](./docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md) for details.

## 🧭 Filosofi Project

### Prinsip Desain

1. **Keamanan Pertama** — Token adalah sacred, jangan pernah di-log
2. **Safety Before Mutations** — Semua write ops lewat dry-run → confirm → execute → audit
3. **Multi-Provider** — Meta, TikTok, Google dengan adapter pattern seragam
4. **Type Safety** — Kalau compile sukses, harusnya jalan
5. **Ramah untuk Agent** — Dibangun untuk AI agents, bukan cuma manusia
6. **Kompleksitas Bertahap** — Mulai simple, tambah power bertahap

### Mengapa Ini Penting?

Project ini menjembatani akses programmatic (TypeScript library + MCP) dengan natural language (AI skills). Agents butuh code patterns DAN business context sekaligus.

**Target User:** Marketers dan developers yang butuh insight + action tanpa ribet.

---

## ⛔ Aturan Ketat — WAJIB DIPATUHI

### 🔴 Jangan Pernah Lakukan Ini

- ❌ Log access tokens (console, errors, dimanapun)
- ❌ Jangan commit file `.env` (sudah di `.gitignore`)
- ❌ Jangan hardcode tokens di code
- ❌ Buat file .md baru tanpa tanya user dulu
- ❌ `git push` tanpa izin eksplisit dari user
- ❌ Over-generate artifacts (jawab di text, jangan bikin file)

### ✅ Selalu Lakukan Ini

- ✅ **Gunakan pola dry-run dulu** sebelum execute write ops (lihat [panduan write](#-panduan-write-operations))
- ✅ **Minta konfirmasi user** sebelum perubahan destruktif (pause, archive, budget turun >50%)
- ✅ Gunakan extension `.js` di imports (requirement ESM)
- ✅ Export semua public APIs dari `src/index.ts`
- ✅ Tambahkan types ke `src/types.ts`
- ✅ Tulis tests untuk fitur baru
- ✅ Tanya sebelum buat file baru
- ✅ Sebelum memberi rekomendasi yang bergantung pada API/library/platform eksternal, baca dokumentasi resmi relevan lebih dulu

**Alasan:** Repo ini punya terlalu banyak file .md noise dari sesi sebelumnya. Jangan tambah sampah lagi.

---

## 🏗️ Arsitektur

```
src/
├── index.ts              # Public API surface — exports semua tools, types, adapters
├── metaClient.ts         # Meta Graph API HTTP client (read + write via metaPost())
├── tiktokClient.ts       # TikTok Ads HTTP client
├── types.ts              # Semua TypeScript types + Zod schemas
├── config.ts             # Environment-based config loader
│
├── broker/               # AdsBroker — orchestrator + MCP tool definitions
│   ├── AdsBroker.ts      # Multi-provider broker (credential resolution, routing)
│   ├── mcpTools.ts       # ~90KB — semua MCP tool definitions (read + write)
│   ├── types.ts          # Broker-level types
│   ├── config.ts         # Broker config
│   ├── credentials.ts    # Cuan Insight credential resolution
│   ├── factory.ts        # Provider adapter factory
│   ├── providerRegistry.ts
│   ├── reportEngine.ts   # Normalized report engine
│   ├── contentMatrix.ts  # Content/performance matrix
│   ├── commerceReportEngine.ts
│   ├── commerceTools.ts  # Commerce (GMV) tools
│   ├── cuanInsight.ts / cuanInsightClient.ts
│   └── remoteAuth.ts     # Remote auth helpers
│
├── providers/            # Provider adapters — setiap provider punya adapter sendiri
│   ├── meta/
│   │   ├── MetaAdsAdapter.ts      # ~128KB — adapter utama Meta (read + write)
│   │   ├── normalizer.ts          # Meta → normalized format
│   │   ├── buildCreativeFormatPayload.ts
│   │   ├── creativeCompliance.ts
│   │   ├── creativeFormatCompatibility.ts
│   │   ├── metaCreativeErrorGuidance.ts
│   │   └── omnichannelAdCompatibility.ts
│   ├── tiktok/
│   │   ├── TikTokAdsAdapter.ts    # ~41KB
│   │   ├── normalizer.ts
│   │   └── gmvMaxNormalizer.ts
│   └── google/
│       ├── GoogleAdsAdapter.ts    # ~17KB
│       └── normalizer.ts
│
├── tools/                # Implementasi tool individual (read + write)
│   ├── Read tools:
│   │   ├── getAdAccounts.ts, getCampaigns.ts, getAccountInfo.ts
│   │   ├── getCampaignInsights.ts, getAdsetInsights.ts, getAdsInsights.ts
│   │   ├── getAccountInsights.ts, getLocationInsights.ts
│   │   ├── getAdPreview.ts, getAdCreativeMapping.ts, getAdDestinations.ts
│   │   ├── getTargetingOptions.ts, getTikTokReport.ts, getTikTokCampaigns.ts
│   │   ├── getTikTokLocationInsights.ts, getGmvMaxReport.ts
│   │   ├── listAdImages.ts, listAdVideos.ts, listPages.ts
│   │   ├── listInstagramAccounts.ts, listThreadsProfiles.ts
│   │   ├── listWhatsAppAccounts.ts, listWhatsAppMessageTemplates.ts
│   │   ├── listWhatsAppPhoneNumbers.ts, listCatalogs.ts, listPixels.ts
│   │   ├── listProductSets.ts, generateDailyReport.ts
│   │   ├── readAdSetFull.ts, readAdCreativeFull.ts
│   │   └── getMetaPlacementPerformance.ts
│   ├── Write tools — Campaign:
│   │   ├── createCampaign.ts
│   │   ├── pauseCampaign.ts, resumeCampaign.ts
│   │   ├── renameCampaign.ts, updateCampaign.ts
│   │   └── updateCampaignBudget.ts
│   ├── Write tools — Ad Set:
│   │   ├── createAdSet.ts, cloneAdSet.ts
│   │   ├── pauseAdSet.ts, resumeAdSet.ts
│   │   ├── updateAdSet.ts
│   │   └── checkLaunchReadiness.ts
│   ├── Write tools — Ad:
│   │   ├── createAd.ts, cloneUiAd.ts
│   │   ├── pauseAd.ts, resumeAd.ts
│   │   ├── updateAd.ts, archiveAd.ts
│   │   └── uploadImage.ts, uploadVideo.ts
│   ├── Write tools — Creative:
│   │   ├── createAdCreative.ts
│   │   └── readAdCreativeFull.ts
│   ├── Write tools — Bundle:
│   │   └── createEcommerceCampaignBundle.ts
│   └── TikTok write tools:
│       └── tiktok/
│           ├── createTikTokCampaign.ts
│           ├── createTikTokAdGroup.ts
│           ├── createTikTokAd.ts
│           ├── createTikTokSmartPlus.ts
│           └── createTikTokGmvMax.ts
│
├── mcp/                  # MCP server entry
│   ├── index.ts          # Entry point
│   ├── createServer.ts   # MCP server setup (~60KB)
│   ├── http.ts           # HTTP transport (~52KB)
│   ├── oauthStore.ts / oauthStoreSupabase.ts  # OAuth storage
│   └── authorizeForm.ts  # OAuth authorize form
│
├── analysis/             # Business logic
│   ├── analyzeCampaignPerformance.ts
│   ├── analyzePlacementPerformance.ts
│   ├── recommendActions.ts
│   └── summarizeLocationInsights.ts
│
├── rules/                # Rule engine (26 templates)
│   ├── engine.ts
│   ├── types.ts
│   └── templates/ (ecommerce, leadgen, brand, general)
│
└── utils/                # Helper functions

skills/meta-ads/          # AI skills (markdown)
├── audit/SKILL.md        # Performance auditing
├── manage/SKILL.md       # Campaign management (read + write)
└── shared/               # Shared context
    ├── preamble.md
    ├── meta-math.md
    └── references.md
```

### Konsep Kunci

- **Broker** = Multi-provider orchestrator — resolve credentials, route calls ke adapter yang tepat
- **Adapters** = Provider-specific implementation (MetaAdsAdapter, TikTokAdsAdapter, GoogleAdsAdapter)
- **Tools** = API wrappers individual (read: getCampaigns, write: pauseCampaign, createAdSet)
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

## 📋 Panduan Write Operations

### Workflow Aman: dry-run → confirm → execute → audit

Semua write operations WAJIB mengikuti pola ini:

```typescript
// 1. DRY RUN — tampilkan apa yang akan dilakukan
const dryRunResult = {
  action: 'pauseCampaign',
  campaignId: '120330000000000001',
  campaignName: 'Promo Ramadhan - ACTIVE',
  currentStatus: 'ACTIVE',
  newStatus: 'PAUSED',
  impact: 'Menghentikan spending ~Rp 500rb/hari'
};

// 2. KONFIRMASI — tanya user sebelum execute
// "Saya akan pause campaign 'Promo Ramadhan'. Setuju? (yes/no)"

// 3. EXECUTE — jalankan setelah mendapat izin
const result = await client.metaPost(
  `/act_${adAccountId}/campaigns`,
  { id: campaignId, status: 'PAUSED' }
);

// 4. AUDIT — verifikasi hasil
const verify = await client.metaGet(
  `/act_${adAccountId}/campaigns`,
  { fields: 'id,name,status' }
);
```

### Safety Guards

 Guard | Deskripsi |
-------|-----------|
 Max 200% budget increase | Tidak bisa naikkan budget >2x tanpa approval manual |
 Dry-run mandatory | Tidak bisa execute tanpa dry-run dulu |
 Confirm before destructive | Pause, archive, budget turun >50% harus konfirmasi |
 Batch rate limit | Max X perubahan per jam |
 Blacklist | Campaign tertentu tidak boleh disentuh |

### Write Tools yang Tersedia

**Campaign:** pauseCampaign, resumeCampaign, renameCampaign, updateCampaign, updateCampaignBudget, createCampaign

**Ad Set:** pauseAdSet, resumeAdSet, updateAdSet, createAdSet, cloneAdSet

**Ad:** pauseAd, resumeAd, updateAd, createAd, archiveAd, cloneUiAd

**Creative:** createAdCreative

**Media:** uploadImage, uploadVideo

**Bundle:** createEcommerceCampaignBundle

**TikTok:** createTikTokCampaign, createTikTokAdGroup, createTikTokAd, createTikTokSmartPlus, createTikTokGmvMax

**Read tools (reverse engineering):** readAdSetFull, readAdCreativeFull

### Menambah Tool Baru

```typescript
// src/tools/read: extends MetaClient.metaGet
// src/tools/write: extends MetaClient.metaPost

// Contoh tool read baru:
export async function getNewData(
  client: MetaClient,
  options: GetNewDataOptions
): Promise<NewData[]> {
  const response = await client.metaGet<{ data: NewData[] }>(
    `/act_${options.adAccountId}/endpoint`,
    { fields: 'id,name,status', limit: 100 }
  );
  return response.data;
}

// Contoh tool write baru:
export async function updateSomething(
  client: MetaClient,
  params: UpdateParams
): Promise<{ success: boolean }> {
  const response = await client.metaPost<{ success: boolean }>(
    `/${params.id}`,
    params.payload
  );
  return response;
}
```

**Langkah selanjutnya:**
1. Export dari `src/index.ts`
2. Tambahkan interface ke `src/types.ts`
3. Tulis test di `tests/*.test.ts`
4. Daftarkan di `src/broker/mcpTools.ts` jika perlu MCP tool baru

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

### Panduan Write Safety — Jangan Asal Execute

Project ini sudah memiliki **write operations lengkap** (v0.5+). Tapi dengan kekuatan besar datang tanggung jawab besar.

**WAJIB lakukan ini sebelum write ops:**
1. ✅ **Dry-run dulu** — tampilkan apa yang berubah, jangan langsung execute
2. ✅ **Minta konfirmasi user** — tunggu "yes" tertulis
3. ✅ **Gunakan safety guards** — jangan bypass max budget increase
4. ✅ **Verifikasi hasil** — pastikan perubahan sesuai ekspektasi
5. ✅ **Mask token di semua log** — token tidak boleh muncul di output manapun

**Jangan lakukan ini:**
- ❌ Execute write ops tanpa dry-run
- ❌ Naikkan budget >200% tanpa approval manual
- ❌ Lupa verifikasi status setelah mutation

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

- Default: `v22.0`
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
4. `git diff HEAD --stat` - Kosong (semua perubahan sudah di-commit)
5. Tidak ada console.logs di production code
6. Tidak ada access tokens di code atau logs

### Checklist Sebelum Merge

1. `git diff HEAD --stat` — output harus kosong
2. `git status` — harus "nothing to commit, working tree clean"
3. `npm run build` — harus sukses
4. `npm run test` — semua tests harus passing
5. Baru jalankan `git checkout main && git merge <branch>`
6. Setelah merge, verifikasi lagi: `git diff HEAD --stat` kosong
7. Jika `Already up to date` tapi file masih modified → perubahan belum commit di branch sumber

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

### Dokumentasi Project

- [Arsitektur](docs/ARSITEKTUR.md) - Deep dive tentang desain dan struktur
- [Keamanan](docs/KEAMANAN.md) - Security best practices dan token management
- [Testing](docs/TESTING.md) - Panduan testing dan coverage
- [Kontribusi](docs/KONTRIBUSI.md) - Cara berkontribusi ke project

### Dokumentasi External

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

## MCP Tool Design Decision Rules

Before adding any new public MCP tool, ask:

1. Is this truly a new provider capability, or only a report/analysis workflow that AI/skills should perform?
2. Can the need be satisfied by `ads_get_performance` with the right `level`, `dimensions`, `breakdowns`, `filters`, `metrics`, `limit`, and `cursor`?
3. Can `ads_get_capabilities` expose the provider limitation instead of creating a provider-specific tool?
4. Does provider-native complexity belong in an adapter behind the canonical public schema?
5. Does the operation mutate provider state and therefore belong in the separate opt-in write surface?

Do not create a new public tool if the need can be met by `ads_get_performance` with explicit canonical parameters. Do not add MCP-core tools for daily reports, weekly reports, creative audits, recommendations, KPI scoring, or top/bottom rankings; implement those as AI/skill workflows over data tools.

New public analytics inputs should prefer these names: `provider`, `accountId`, `since`, `until`, `level`, `metrics`, `dimensions`, `breakdowns`, `filters`, `sortBy`, `sortDirection`, `limit`, and `cursor`. Provider-native names such as `adAccountId`, `advertiserId`, `startDate`, and `endDate` may remain in legacy APIs or internal adapters, but should not be introduced as the default public MCP contract.

---

## 📋 Local Agent Config

Setiap agent yang bekerja di repo ini WAJIB:

1. **Cek config lokal** di urutan:
   - `.agent-config.yaml` di folder ini
   - `.local/agent-config.yaml` di folder ini
2. **Jika ada** — ikuti rules delegation-nya (task pattern → model)
3. **Prioritas model China** — nggak perlu OpenAI/Anthropic
4. **Jika tidak ada** — pakai default:
   - `deepseek-v4-flash` untuk daily ($0.14)
   - `deepseek-v4-pro` untuk task berat ($0.43)

Config di `.local/` sudah di gitignore — aman buat disimpan.
