# Plan: Ad Creation Tools Full Suite (v0.7.0)

**Branch:** `feat/ad-create-tools-full-suite`
**Target Version:** v0.7.0
**Last Updated:** 2026-07-10

---

## Executive Summary

Menambahkan **7 tools baru** untuk end-to-end ad creation di Meta Ads, plus refactor existing `createEcommerceCampaignBundle` agar lebih modular.

Saat ini cuma ada 1 tool create: `ads_create_ecommerce_campaign_bundle` yang hardcode untuk ecommerce SALES. Tidak bisa bikin campaign untuk traffic, engagement, leads, awareness, dll.

### Tools Baru

| # | Tool | Fungsi |
|---|------|--------|
| 1 | `ads_create_campaign` | Bikin campaign dengan objective APAPUN |
| 2 | `ads_create_adset` | Bikin adset dengan targeting fleksibel |
| 3 | `ads_create_adcreative` | Bikin creative standalone (image/video + copy) |
| 4 | `ads_create_ad` | Bikin ad yang link creative + adset |
| 5 | `ads_archive_ad` | Arsipkan/soft-delete ad |
| 6 | `ads_update_adset` | Update targeting/budget adset |
| 7 | `ads_get_targeting_options` | Explore targeting sebelum bikin adset |

### Refactor

| # | File | Perubahan |
|---|------|-----------|
| 8 | `createEcommerceCampaignBundle.ts` | Refactor jadi wrapper yang panggil 4 create tools baru |
| 9 | `AdsBroker.ts` | Tambah `AdapterCreateMethod` type + 7 method baru |
| 10 | `types.ts` | Tambah result types untuk setiap tool baru |
| 11 | `MetaAdsAdapter.ts` | Implement 7 method baru |
| 12 | `mcpTools.ts` | Daftar 7 tool definitions + routing |
| 13 | `index.ts` | Export semua tool baru |
| 14 | `createServer.ts` | Zod schemas untuk 7 tools baru |

---

## Architecture

### Data Flow

```
AI Agent / MCP Client
  ↓ (tool call)
createServer.ts (Zod validation)
  ↓
handleAdsMcpToolCall (mcpTools.ts routing)
  ↓
AdsBroker.executeWrite (permission check + credential resolve)
  ↓
MetaAdsAdapter method
  ↓
Tool function (e.g. createCampaign.ts)
  ↓
MetaClient.metaPost (HTTP POST to Graph API)
  ↓
Meta Graph API
```

### Safety Contract

Semua mutation tools baru wajib mengikuti pola:
1. **Dry-run preview** — preview payload tanpa eksekusi
2. **Explicit confirmation** — `confirmed: true` required
3. **Audit logging** — return full payload + response
4. **Retry with backoff** — 3 retries on 429
5. **PAUSED by default** — semua entity dibuat PAUSED

---

## Phase 1 — New Tool: `ads_create_campaign`

### File Baru: `src/tools/createCampaign.ts`

**Meta API Endpoint:** `POST /act_{ad_account_id}/campaigns`

```typescript
export interface CreateCampaignOptions {
  adAccountId: string;
  name: string;
  objective: MetaCampaignObjective;
  status?: CampaignStatus;       // default: PAUSED
  specialAdCategories?: string[];
  buyType?: 'AUCTION' | 'RESERVED';
  dailyBudget?: number;          // minor units
  lifetimeBudget?: number;
  bidStrategy?: string;
}

export type MetaCampaignObjective =
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_APP_PROMOTION'
  | 'OUTCOME_CONVERSATIONS'
  | 'OUTCOME_RESHARES'
  | 'OUTCOME_VALUE'
  | 'OUTCOME_VIDEO_VIEWS'
  | 'OUTCOME_POST_ENGAGEMENT'
  | 'OUTCOME_LANDING_PAGE_VIEWS'
  | 'OUTCOME_REACH'
  | 'OUTCOME_MESSAGES'
  | 'OUTCOME_THRUPLAY';

export interface CreateCampaignResult {
  operation: 'create_campaign';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}
```

### File Baru: `src/tools/getCampaignObjectives.ts` (opsional, untuk referensi)

Menyediakan daftar objectives + deskripsi yang bisa dipilih.

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `CreateCampaignResult` type |
| `src/broker/AdsBroker.ts` | Tambah `createCampaign` method + `AdapterCreateMethod` type |
| `src/broker/mcpTools.ts` | Tambah `ads_create_campaign` tool definition + routing |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement `createCampaign` |
| `src/index.ts` | Export `createCampaign` |
| `mcp-server/src/createServer.ts` | Zod schema untuk `ads_create_campaign` |
| `src/providers/tiktok/TikTokAdsAdapter.ts` | Tambah `createCampaign` (NOT_IMPLEMENTED) |
| `src/providers/google/GoogleAdsAdapter.ts` | Tambah `createCampaign` (NOT_IMPLEMENTED) |

---

## Phase 2 — New Tool: `ads_create_adset`

### File Baru: `src/tools/createAdSet.ts`

**Meta API Endpoint:** `POST /act_{ad_account_id}/adsets`

```typescript
export interface CreateAdSetOptions {
  adAccountId: string;
  campaignId: string;
  name: string;
  status?: CampaignStatus;
  dailyBudget?: number;
  lifetimeBudget?: number;
  billingEvent?: 'IMPRESSIONS' | 'LINK_CLICKS' | 'PAGE_LIKES' | 'POST_ENGAGEMENT' | 'VIDEO_VIEWS' | 'LEADS' | 'APP_INSTALLS' | 'MESSAGE_RESPONSES' | 'RSVP' | 'THRUPLAY' | 'PURCHASE' | 'LISTING_INTERACTION' | 'OFFSITE_CONVERSIONS' | 'ON_INSTALL' | 'ONSITE_CONVERSIONS' | 'QUALITY_CALL' | 'REACH' | 'SOCIAL_IMPRESSIONS' | 'VALUE' | 'LANDING_PAGE_VIEWS';
  optimizationGoal?: string;
  bidStrategy?: string;
  targeting?: AdSetTargeting;
  promotedObject?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
}

export interface AdSetTargeting {
  geoLocations?: {
    countries?: string[];
    regions?: Array<{ key: string }>;
    cities?: Array<{ key: string }>;
    zips?: Array<{ key: string }>;
    locationTypes?: Array<'home' | 'recent' | 'travel_in' | 'traveling'>;
  };
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  messengerPositions?: string[];
  marketplacePositions?: string[];
  devicePlatforms?: string[];
  flexibleSpec?: Array<Record<string, unknown>>;
  exclusions?: Record<string, unknown>;
  targetingOptimization?: string;
}

export interface CreateAdSetResult {
  operation: 'create_adset';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `CreateAdSetResult` type |
| `src/broker/AdsBroker.ts` | Tambah `createAdSet` method |
| `src/broker/mcpTools.ts` | Tambah `ads_create_adset` tool definition |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement `createAdSet` |
| `src/index.ts` | Export `createAdSet` |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google adapter | NOT_IMPLEMENTED stub |

---

## Phase 3 — New Tool: `ads_create_adcreative`

### File Baru: `src/tools/createAdCreative.ts`

**Meta API Endpoint:** `POST /act_{ad_account_id}/adcreatives`

```typescript
export interface CreateAdCreativeOptions {
  adAccountId: string;
  name: string;
  pageId: string;
  // Link ad (most common)
  linkData?: {
    link: string;
    message: string;
    name?: string;             // headline
    description?: string;
    imageHash?: string;
    videoId?: string;
    callToAction: {
      type: string;
      value: { link: string };
    };
    attachmentStyle?: string;
    multiShareOptimized?: boolean;
    childAttachments?: Array<Record<string, unknown>>;
  };
  // OR video ad
  videoData?: {
    videoId: string;
    message?: string;
    imageHash?: string;
    callToAction?: {
      type: string;
      value: { link?: string };
    };
  };
  // OR carousel
  assetFeedSpec?: {
    images?: Array<{ hash: string }>;
    videos?: Array<{ video_id: string }>;
    linkUrls?: Array<{ website_url: string }>;
    callToActionTypes?: Array<{ type: string }>;
    descriptions?: Array<{ text: string }>;
    multiShareOptimized?: boolean;
    childAttachments?: Array<Record<string, unknown>>;
  };
  degreesOfFreedomSpec?: Record<string, unknown>;
  urlTags?: string;
  instagramUserId?: string;
  objectStorySpec?: Record<string, unknown>;  // raw passthrough for complex creatives
}

export interface CreateAdCreativeResult {
  operation: 'create_adcreative';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `CreateAdCreativeResult` type |
| `src/broker/AdsBroker.ts` | Tambah `createAdCreative` method |
| `src/broker/mcpTools.ts` | Tambah `ads_create_adcreative` tool definition |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement |
| `src/index.ts` | Export |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google | NOT_IMPLEMENTED stub |

---

## Phase 4 — New Tool: `ads_create_ad`

### File Baru: `src/tools/createAd.ts`

**Meta API Endpoint:** `POST /act_{ad_account_id}/ads`

```typescript
export interface CreateAdOptions {
  adAccountId: string;
  name: string;
  adSetId: string;
  creativeId: string;           // refer to existing creative
  status?: CampaignStatus;
  trackingSpecs?: Array<Record<string, unknown>>;
  adLabels?: Array<{ name: string }>;
  creativeSpec?: Record<string, unknown>;  // alternative: inline creative
}

export interface CreateAdResult {
  operation: 'create_ad';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `CreateAdResult` type |
| `src/broker/AdsBroker.ts` | Tambah `createAd` method |
| `src/broker/mcpTools.ts` | Tambah `ads_create_ad` tool definition |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement |
| `src/index.ts` | Export |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google | NOT_IMPLEMENTED stub |

---

## Phase 5 — New Tool: `ads_archive_ad`

### File Baru: `src/tools/archiveAd.ts`

**Meta API Endpoint:** `POST /{ad_id}?status=ARCHIVED`

```typescript
export interface ArchiveAdOptions {
  adId: string;
}

export interface ArchiveAdResult {
  operation: 'archive_ad';
  status: 'executed' | 'failed';
  success: boolean;
  id?: string;
  error?: string;
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `ArchiveAdResult` type |
| `src/broker/AdsBroker.ts` | Tambah `archiveAd` method |
| `src/broker/mcpTools.ts` | Tambah tool definition + routing |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement |
| `src/index.ts` | Export |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google | NOT_IMPLEMENTED stub |

---

## Phase 6 — New Tool: `ads_update_adset`

### File Baru: `src/tools/updateAdSet.ts`

**Meta API Endpoint:** `POST /{ad_set_id}`

```typescript
export interface UpdateAdSetOptions {
  adSetId: string;
  name?: string;
  status?: CampaignStatus;
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidStrategy?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  targeting?: AdSetTargeting;
  startTime?: string;
  endTime?: string;
}

export interface UpdateAdSetResult {
  operation: 'update_adset';
  status: 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah `UpdateAdSetResult` type |
| `src/broker/AdsBroker.ts` | Tambah `updateAdSet` method |
| `src/broker/mcpTools.ts` | Tambah tool definition + routing |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement |
| `src/index.ts` | Export |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google | NOT_IMPLEMENTED stub |

---

## Phase 7 — New Tool: `ads_get_targeting_options`

### File Baru: `src/tools/getTargetingOptions.ts`

**Meta API Endpoint:** `GET /act_{ad_account_id}/targetingbrowse` atau `GET /search?type=adinterest`

```typescript
export interface GetTargetingOptionsOptions {
  adAccountId: string;
  type: 'interests' | 'behaviors' | 'demographics' | 'industries' | 'life_events' | 'family_statuses' | 'education_statuses' | 'college_years' | 'income' | 'relationship_statuses' | 'work_employers' | 'work_positions' | 'work_job_titles';
  query?: string;           // search keyword
  limit?: number;
  cursor?: string;
}

export interface TargetingOption {
  id: string;
  name: string;
  type: string;
  path?: string[];
  audienceSizeLowerBound?: number;
  audienceSizeUpperBound?: number;
  description?: string;
  topic?: string;
}

export interface GetTargetingOptionsResult {
  operation: 'get_targeting_options';
  data: TargetingOption[];
  paging: {
    nextCursor: string | null;
  };
}
```

### Yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `src/broker/types.ts` | Tambah type |
| `src/broker/AdsBroker.ts` | Method `getTargetingOptions` |
| `src/broker/mcpTools.ts` | Tambah tool definition |
| `src/providers/meta/MetaAdsAdapter.ts` | Implement |
| `src/index.ts` | Export |
| `mcp-server/src/createServer.ts` | Zod schema |
| TikTok + Google | NOT_IMPLEMENTED stub |

---

## Phase 8 — Refactor `createEcommerceCampaignBundle`

### Perubahan di `src/tools/createEcommerceCampaignBundle.ts`

Alih-alih langsung panggil `metaPost`, bundle tool ini akan panggil 4 create tools baru secara berurutan:

```typescript
const campaignResult = await createCampaign(client, { ... });
const campaignId = campaignResult.id;

const adSetResult = await createAdSet(client, {
  campaignId,
  ...bundlePayload,
});
const adSetId = adSetResult.id;

// Upload + create creative
const creativeResult = await createAdCreative(client, { ... });
const creativeId = creativeResult.id;

const adResult = await createAd(client, {
  adSetId,
  creativeId,
  ...bundlePayload,
});
```

**Keuntungan:**
- Bundle tool jadi wrapper, bukan duplikasi logic
- Setiap entity tetap bisa dibuat standalone
- Preview dan dry-run lebih granular

---

## Phase 9 — Tests

### Test Files Baru

| File | Isi |
|------|-----|
| `tests/createCampaign.test.ts` | Unit test create campaign |
| `tests/createAdSet.test.ts` | Unit test create adset |
| `tests/createAdCreative.test.ts` | Unit test create creative |
| `tests/createAd.test.ts` | Unit test create ad |
| `tests/archiveAd.test.ts` | Unit test archive ad |
| `tests/updateAdSet.test.ts` | Unit test update adset |
| `tests/getTargetingOptions.test.ts` | Unit test targeting options |
| `tests/mcpAdCreateTools.test.ts` | Integration test: semua create tools via broker |

### Yang Perlu Diupdate

| File | Perubahan |
|------|-----------|
| `tests/mcpServerBuilder.test.ts` | Update tool count dari 41 → 48 |
| `tests/mcpAdsTools.test.ts` | Tambah test untuk tools baru |

---

## Action Plan — Urutan Pengerjaan

Setiap phase = 1 commit.

```
Phase 1: ads_create_campaign
├── src/tools/createCampaign.ts (BARU)
├── src/broker/types.ts + AdsBroker.ts
├── src/broker/mcpTools.ts
├── src/providers/meta/MetaAdsAdapter.ts
├── src/index.ts
├── mcp-server/src/createServer.ts
├── providers/tiktok + google (stub)
└── tests/createCampaign.test.ts (BARU)

Phase 2: ads_create_adset
├── src/tools/createAdSet.ts (BARU)
├── + semua file modifikasi seperti Phase 1

Phase 3: ads_create_adcreative
├── src/tools/createAdCreative.ts (BARU)
├── + semua file modifikasi

Phase 4: ads_create_ad
├── src/tools/createAd.ts (BARU)
├── + semua file modifikasi

Phase 5: ads_archive_ad
├── src/tools/archiveAd.ts (BARU)
├── + semua file modifikasi

Phase 6: ads_update_adset
├── src/tools/updateAdSet.ts (BARU)
├── + semua file modifikasi

Phase 7: ads_get_targeting_options
├── src/tools/getTargetingOptions.ts (BARU)
├── + semua file modifikasi

Phase 8: Refactor createEcommerceCampaignBundle
├── src/tools/createEcommerceCampaignBundle.ts (MODIF)
├── tests/createEcommerceCampaignBundle.test.ts (BARU)

Phase 9: Tests & Final
├── tests/mcpServerBuilder.test.ts (update tool count 41→48)
├── tests/mcpAdsTools.test.ts (tambah test)
├── tests/mcpAdCreateTools.test.ts (BARU)
├── ROADMAP.md (update)
├── CHANGELOG.md (update)
├── Build + test + fix
└── PR ke main
```

### Perintah Build & Test

```bash
# Setiap selesai phase
npm run build
npm run test
npm run format
git add -A
git commit -m "feat: add ads_create_campaign tool"
```

### Checklist Final

- [ ] `npm run build` sukses (tsc compile)
- [ ] `npm run test` semua passing
- [ ] Tool count test diupdate (41 → 48)
- [ ] Tidak ada token leaks
- [ ] `git diff HEAD --stat` clean
- [ ] Semua export dari `src/index.ts`
- [ ] TikTok + Google adapter punya NOT_IMPLEMENTED stub
- [ ] Zod schema valid di `createServer.ts`
- [ ] Safety contract: dry-run + confirmation + audit + retry

---

## Tool Count Calculation

| Kategori | Jumlah |
|----------|--------|
| Existing ADS tools | 27 |
| Existing Commerce tools | 1 |
| Legacy Meta tools | 9 |
| Legacy TikTok tools | 4 |
| **Total existing** | **41** |
| **Tools baru** | **+7** |
| **Total baru** | **48** |

*(Test di `mcpServerBuilder.test.ts` line 136 perlu diupdate dari 41 ke 48)*
