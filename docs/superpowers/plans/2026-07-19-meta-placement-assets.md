# Meta Placement Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat satu creative Meta yang memetakan image 1:1 ke Feed dan image 9:16 ke Story/Reels, lalu hanya membuat ad `PAUSED` setelah read-back placement terverifikasi.

**Architecture:** Tambahkan format canonical `placement_image` agar marketer tidak perlu menyusun payload Meta mentah. Builder menerjemahkannya menjadi `asset_feed_spec` berlabel dan `asset_customization_rules`; adapter, schema MCP, dan verifikasi read-back meneruskan serta memeriksa kontrak yang sama.

**Tech Stack:** TypeScript ESM, Zod, Meta Marketing API v23+, Vitest, tsup, ESLint.

## Global Constraints

- Hanya dua image hash: Feed 1:1 dan Story/Reels 9:16.
- Tidak menambahkan video, carousel, katalog, atau kelompok placement tambahan.
- Tidak mengubah campaign, ad set, atau ad aktif.
- Live smoke test membuat ad `PAUSED` pada ad set `120250937731970394`.
- Access token dan signed media URL tidak boleh muncul di code, commit, atau output pengguna.

---

### Task 1: Canonical Placement Image Payload

**Files:**
- Modify: `src/types.ts`
- Modify: `src/providers/meta/creativeFormatCompatibility.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Test: `tests/metaCreativeFormatPayload.test.ts`
- Test: `tests/metaCreativeFormatCompatibility.test.ts`

**Interfaces:**
- Produces: `MetaPlacementImageCreativeSpec` dengan `feedImageHash`, `verticalImageHash`, `primaryText`, `headline`, `destinationUrl`, `callToAction`, dan `pageWelcomeMessage` opsional.
- Produces: `creativeFormat: 'placement_image'` pada `MetaCreativeSpec`.

- [ ] **Step 1: Write failing payload tests**

```typescript
it('maps feed and vertical images to explicit Meta placements', () => {
  const result = buildMetaCreativeFormatPayload({
    mode: 'standard',
    pageId: 'page-1',
    instagramUserId: 'ig-1',
    creativeFormat: 'placement_image',
    creativeSpec: {
      feedImageHash: 'feed-hash',
      verticalImageHash: 'vertical-hash',
      primaryText: 'Payday Glowday',
      headline: 'PAYDAY GLOWDAY',
      destinationUrl: 'https://api.whatsapp.com/send',
      callToAction: 'WHATSAPP_MESSAGE',
      pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
    },
  });

  expect(result).toMatchObject({
    object_story_spec: { page_id: 'page-1', instagram_user_id: 'ig-1' },
    asset_feed_spec: {
      ad_formats: ['SINGLE_IMAGE'],
      images: [
        { hash: 'feed-hash', adlabels: [{ name: 'placement_feed_1_1' }] },
        { hash: 'vertical-hash', adlabels: [{ name: 'placement_vertical_9_16' }] },
      ],
      additional_data: {
        is_click_to_message: true,
        page_welcome_message: '{"type":"VISUAL_EDITOR"}',
      },
    },
  });
});

it('rejects identical feed and vertical image hashes', () => {
  expect(() =>
    buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'same-hash',
        verticalImageHash: 'same-hash',
        primaryText: 'Copy',
        headline: 'Headline',
        destinationUrl: 'https://example.com',
      },
    })
  ).toThrow(/harus berbeda/i);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/metaCreativeFormatPayload.test.ts tests/metaCreativeFormatCompatibility.test.ts`

Expected: FAIL because `placement_image` and its builder do not exist.

- [ ] **Step 3: Add the canonical type and builder**

```typescript
export interface MetaPlacementImageCreativeSpec extends MetaCreativeCopy {
  feedImageHash: string;
  verticalImageHash: string;
  headline: string;
  destinationUrl: string;
  pageWelcomeMessage?: string;
}
```

Implement `buildPlacementImage()` with these exact placement families:

```typescript
const placementRules = [
  {
    image_label: { name: 'placement_feed_1_1' },
    customization_spec: {
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed'],
      instagram_positions: ['stream'],
    },
  },
  {
    image_label: { name: 'placement_vertical_9_16' },
    customization_spec: {
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['facebook_reels', 'story'],
      instagram_positions: ['reels', 'story'],
    },
  },
];
```

Reject blank hashes and equal normalized hashes. Add `placement_image` to standard requirements and keep it unsupported for Collaborative Ads in this release.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/metaCreativeFormatPayload.test.ts tests/metaCreativeFormatCompatibility.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/providers/meta/creativeFormatCompatibility.ts src/providers/meta/buildCreativeFormatPayload.ts tests/metaCreativeFormatPayload.test.ts tests/metaCreativeFormatCompatibility.test.ts
git commit -m "feat: build placement-specific Meta image creatives"
```

### Task 2: Adapter and MCP Input Surface

**Files:**
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `src/mcp/createServer.ts`
- Modify: `src/broker/mcpTools.ts`
- Test: `tests/metaAdsAdapter.test.ts`
- Test: `tests/mcpServerBuilder.test.ts`

**Interfaces:**
- Consumes: `MetaPlacementImageCreativeSpec` and `creativeFormat: 'placement_image'` from Task 1.
- Produces: MCP input that accepts `feedImageHash`, `verticalImageHash`, and `pageWelcomeMessage` within `creativeSpec`.

- [ ] **Step 1: Write failing adapter and schema tests**

```typescript
expect(creativeTool?.inputSchema.properties.creativeFormat.enum).toContain('placement_image');

expect(receivedOptions?.creative).toEqual({
  creativeFormat: 'placement_image',
  creativeSpec: expect.objectContaining({
    feedImageHash: 'feed-hash',
    verticalImageHash: 'vertical-hash',
    pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
  }),
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts`

Expected: FAIL because the parser and schemas reject `placement_image`.

- [ ] **Step 3: Parse and expose the new format**

Add `placement_image` to both MCP enums and marketer-facing descriptions. Add this parser branch:

```typescript
case 'placement_image':
  return {
    creativeFormat: 'placement_image',
    creativeSpec: {
      feedImageHash: requireString(spec.feedImageHash, 'creativeSpec.feedImageHash'),
      verticalImageHash: requireString(spec.verticalImageHash, 'creativeSpec.verticalImageHash'),
      primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
      headline: requireString(spec.headline, 'creativeSpec.headline'),
      destinationUrl: requireString(spec.destinationUrl, 'creativeSpec.destinationUrl'),
      description: optionalString(spec.description, 'creativeSpec.description'),
      callToAction: optionalString(spec.callToAction, 'creativeSpec.callToAction'),
      pageWelcomeMessage: optionalString(
        spec.pageWelcomeMessage,
        'creativeSpec.pageWelcomeMessage'
      ),
    },
  };
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/providers/meta/MetaAdsAdapter.ts src/mcp/createServer.ts src/broker/mcpTools.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
git commit -m "feat: expose placement image creative inputs"
```

### Task 3: Strict Placement Read-Back Verification

**Files:**
- Modify: `src/types.ts`
- Modify: `src/tools/createAdCreative.ts`
- Test: `tests/createAdCreative.test.ts`

**Interfaces:**
- Consumes: created `placement_image` creative and its `asset_feed_spec`.
- Produces: `placementImageCount`, `placementRuleCount`, `hasFeedPlacementRule`, and `hasVerticalPlacementRule`.
- Produces: failed response with the created creative ID when Meta strips required placement rules.

- [ ] **Step 1: Write failing verification tests**

```typescript
expect(result.verification).toMatchObject({
  status: 'verified',
  summary: {
    placementImageCount: 2,
    placementRuleCount: 2,
    hasFeedPlacementRule: true,
    hasVerticalPlacementRule: true,
  },
});

expect(unverifiedResult).toMatchObject({
  status: 'failed',
  executed: true,
  id: 'creative-1',
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run tests/createAdCreative.test.ts`

Expected: FAIL because placement-specific verification does not exist.

- [ ] **Step 3: Implement strict verification**

Read `asset_feed_spec.images[].adlabels` and `asset_customization_rules[]`. A Feed rule must reference `placement_feed_1_1`; a Vertical rule must reference `placement_vertical_9_16` and include both Story and Reels families. For `placement_image`, return `status: 'failed'`, `executed: true`, the creative ID, and a simple actionable error when verification is not `verified`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npx vitest run tests/createAdCreative.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/tools/createAdCreative.ts tests/createAdCreative.test.ts
git commit -m "fix: block ads when placement mapping is unverified"
```

### Task 4: Full Verification and PAUSED Live Smoke Test

**Files:**
- Modify only if live Meta returns a reproducible payload compatibility error covered by a new failing test.

**Interfaces:**
- Consumes: public MCP creative/ad creation flow.
- Produces: one verified creative and one `PAUSED` ad under ad set `120250937731970394`.

- [ ] **Step 1: Run repository verification**

```bash
npm test -- --run
npm run build
npm run lint
git diff --check
gitleaks git --no-banner --redact --log-opts='--all'
```

Expected: 0 failed tests, build exit 0, lint 0 errors, diff check clean, and no leaks.

- [ ] **Step 2: Run dry-run with real placement assets**

Use account `2326988574277142`, Page `100338525395228`, Instagram user `17841421517309865`, Feed hash `805c8528e3b1ccdd5bd227716ac84712`, Vertical hash `8d6190c2538401e052cdd4b23e39c83a`, CTA `WHATSAPP_MESSAGE`, and the copy/welcome message from ad `120250938682580394`.

Expected: preview contains two labels and two placement rules; no API write occurs.

- [ ] **Step 3: Create and verify one live creative**

Execute only after the dry-run preview matches the plan. Require placement verification status `verified`.

Expected: creative ID returned and verification status `verified`.

- [ ] **Step 4: Create one PAUSED ad**

Create the ad under `120250937731970394` with a name prefixed `CODEX TEST | PLACEMENT 1:1+9:16`. Never request `ACTIVE`.

Expected: new ad has `status=PAUSED` and `effective_status=PAUSED` or `IN_PROCESS` followed by `PAUSED`.

- [ ] **Step 5: Verify placement previews**

Generate `MOBILE_FEED_STANDARD`, `INSTAGRAM_STORY`, and `INSTAGRAM_REELS` previews.

Expected: Feed uses 1:1; Story and Reels use 9:16. If preview or read-back is ambiguous, report the limitation and do not activate the ad.

- [ ] **Step 6: Commit any test-backed compatibility fix**

If no compatibility fix was needed, skip this commit. Otherwise commit only the failing test and minimal fix:

```bash
git add src/providers/meta/buildCreativeFormatPayload.ts tests/metaCreativeFormatPayload.test.ts
git commit -m "fix: align Meta placement payload with live API"
```
