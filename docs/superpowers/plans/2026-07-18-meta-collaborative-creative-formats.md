# Meta Collaborative and Standard Creative Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:test-driven-development for every production-code task and superpowers:verification-before-completion before reporting the branch ready.

**Goal:** Extend the four existing Meta create tools so a marketer can safely create standard Meta Ads and advertiser-side Collaborative Ads using single image, video, carousel, catalog, collection, flexible, or existing-post creatives without composing raw Meta payloads.

**Architecture:** Keep the public MCP surface at four create tools. Add canonical marketer-facing types in `src/types.ts`, isolate format validation and Meta payload construction in provider-specific modules, and let `MetaAdsAdapter` translate broker requests into the existing mutation tools. Preserve legacy creative inputs, dry-run/confirmation behavior, structured Meta errors, and `PAUSED` defaults.

**Tech Stack:** TypeScript ESM, strict TypeScript, Meta Graph API through `MetaClient`, MCP broker schemas, Vitest, ESLint, Prettier, tsup.

**Global Constraints:** Never log credentials or signed asset URLs. Do not manage retailer collaboration setup, catalog sharing, catalog-segment creation, or Instant Experience construction. Do not create a tool per format. Do not push or merge without explicit user permission. All new imports use `.js`. All public types are exported from `src/index.ts`. Execute TDD in every task: add one failing test, run it, implement the smallest code, run it again, then commit. Keep all created campaign, ad set, and ad objects `PAUSED` by default.

---

## Marketer-facing outcome

The agent continues to use these four tools:

1. `ads_create_campaign`
2. `ads_create_adset`
3. `ads_create_adcreative`
4. `ads_create_ad`

For creative creation, the marketer chooses `mode` and `creativeFormat`, then supplies only the relevant `creativeSpec`. One ad set can receive several ads, and each ad can point to a creative with a different supported format.

The first release supports this matrix:

| Mode | single image | video | carousel | catalog | collection | flexible | existing post |
|---|---:|---:|---:|---:|---:|---:|---:|
| `standard` | yes | yes | yes | yes | yes | yes | yes |
| `collaborative_ads` | yes | yes | yes | yes | yes | no | no |

`flexible` is rejected for Collaborative Ads because its generic DCO payload conflicts with the product-set flow that caused the original failure. `existing_post` is rejected in Collaborative Ads until Meta exposes a documented advertiser-side catalog attachment contract for that combination. These are local, explicit validation errors—not claims that Meta can never support the combinations.

---

### Task 1: Define the canonical public contract and compatibility rules

**Files:**
- Modify: `src/types.ts`
- Create: `src/providers/meta/creativeFormatCompatibility.ts`
- Modify: `src/index.ts`
- Create: `tests/metaCreativeFormatCompatibility.test.ts`

**Step 1: Write the failing compatibility tests**

Create `tests/metaCreativeFormatCompatibility.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  assertMetaCreativeCompatibility,
  getMetaCreativeRequirements,
} from '../src/providers/meta/creativeFormatCompatibility.js';

describe('Meta creative format compatibility', () => {
  it.each([
    'single_image',
    'video',
    'carousel',
    'catalog',
    'collection',
    'flexible',
    'existing_post',
  ] as const)('allows standard %s', (creativeFormat) => {
    expect(() =>
      assertMetaCreativeCompatibility({ mode: 'standard', creativeFormat })
    ).not.toThrow();
  });

  it.each(['single_image', 'video', 'carousel', 'catalog', 'collection'] as const)(
    'allows collaborative %s',
    (creativeFormat) => {
      expect(() =>
        assertMetaCreativeCompatibility({ mode: 'collaborative_ads', creativeFormat })
      ).not.toThrow();
    }
  );

  it.each(['flexible', 'existing_post'] as const)(
    'rejects collaborative %s with marketer-facing guidance',
    (creativeFormat) => {
      expect(() =>
        assertMetaCreativeCompatibility({ mode: 'collaborative_ads', creativeFormat })
      ).toThrow(/belum didukung.*pilih/i);
    }
  );

  it('requires a product set for collaborative catalog formats', () => {
    expect(
      getMetaCreativeRequirements({ mode: 'collaborative_ads', creativeFormat: 'catalog' })
    ).toContain('productSetId');
  });
});
```

**Step 2: Run the test and confirm the expected failure**

Run:

```bash
npx vitest run tests/metaCreativeFormatCompatibility.test.ts
```

Expected: FAIL because `creativeFormatCompatibility.ts` does not exist.

**Step 3: Add the public discriminated types**

Add to `src/types.ts`:

```typescript
export type MetaAdsMode = 'standard' | 'collaborative_ads';

export type MetaCreativeFormat =
  | 'single_image'
  | 'video'
  | 'carousel'
  | 'catalog'
  | 'collection'
  | 'flexible'
  | 'existing_post';

export interface MetaCreativeCopy {
  primaryText: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  destinationUrl?: string;
}

export interface MetaSingleImageCreativeSpec extends MetaCreativeCopy {
  imageHash: string;
}

export interface MetaVideoCreativeSpec extends MetaCreativeCopy {
  videoId: string;
  thumbnailImageHash?: string;
}

export interface MetaCarouselCard {
  imageHash?: string;
  videoId?: string;
  headline: string;
  description?: string;
  destinationUrl: string;
}

export interface MetaCarouselCreativeSpec extends MetaCreativeCopy {
  cards: MetaCarouselCard[];
}

export interface MetaCatalogCreativeSpec extends MetaCreativeCopy {
  productSetId: string;
  templateUrl?: string;
  fallbackImageHash?: string;
}

export interface MetaCollectionCreativeSpec extends MetaCreativeCopy {
  instantExperienceId: string;
  coverImageHash?: string;
  coverVideoId?: string;
  productSetId?: string;
}

export interface MetaFlexibleCreativeSpec extends MetaCreativeCopy {
  imageHashes?: string[];
  videoIds?: string[];
  primaryTexts: string[];
  headlines?: string[];
  descriptions?: string[];
}

export interface MetaExistingPostCreativeSpec {
  objectStoryId: string;
}

export type MetaCreativeSpec =
  | { creativeFormat: 'single_image'; creativeSpec: MetaSingleImageCreativeSpec }
  | { creativeFormat: 'video'; creativeSpec: MetaVideoCreativeSpec }
  | { creativeFormat: 'carousel'; creativeSpec: MetaCarouselCreativeSpec }
  | { creativeFormat: 'catalog'; creativeSpec: MetaCatalogCreativeSpec }
  | { creativeFormat: 'collection'; creativeSpec: MetaCollectionCreativeSpec }
  | { creativeFormat: 'flexible'; creativeSpec: MetaFlexibleCreativeSpec }
  | { creativeFormat: 'existing_post'; creativeSpec: MetaExistingPostCreativeSpec };

export interface MetaCollaborativeCatalogContext {
  productSetId: string;
  pixelId?: string;
  customEventType?: string;
  destinationUrl?: string;
}
```

Keep these types free from Meta snake_case fields. Advanced legacy records remain supported separately.

**Step 4: Implement the compatibility module**

Create `src/providers/meta/creativeFormatCompatibility.ts`:

```typescript
import type { MetaAdsMode, MetaCreativeFormat } from '../../types.js';

const COLLABORATIVE_FORMATS = new Set<MetaCreativeFormat>([
  'single_image',
  'video',
  'carousel',
  'catalog',
  'collection',
]);

const REQUIREMENTS: Record<MetaCreativeFormat, string[]> = {
  single_image: ['imageHash', 'primaryText', 'destinationUrl'],
  video: ['videoId', 'primaryText', 'destinationUrl'],
  carousel: ['cards'],
  catalog: ['productSetId', 'primaryText'],
  collection: ['instantExperienceId', 'coverImageHash or coverVideoId'],
  flexible: ['imageHashes or videoIds', 'primaryTexts', 'destinationUrl'],
  existing_post: ['objectStoryId'],
};

export function assertMetaCreativeCompatibility(input: {
  mode: MetaAdsMode;
  creativeFormat: MetaCreativeFormat;
}): void {
  if (input.mode === 'collaborative_ads' && !COLLABORATIVE_FORMATS.has(input.creativeFormat)) {
    throw new Error(
      `Format ${input.creativeFormat} belum didukung untuk Collaborative Ads. ` +
        'Pilih single_image, video, carousel, catalog, atau collection.'
    );
  }
}

export function getMetaCreativeRequirements(input: {
  mode: MetaAdsMode;
  creativeFormat: MetaCreativeFormat;
}): string[] {
  const required = [...REQUIREMENTS[input.creativeFormat]];
  if (input.mode === 'collaborative_ads' && !required.includes('productSetId')) {
    required.push('productSetId');
  }
  return required;
}
```

**Step 5: Export the public types and compatibility helpers**

Add explicit exports to `src/index.ts` using `.js` imports. Export public contract types from `src/types.ts` and the two compatibility functions from the new provider module.

**Step 6: Run focused tests and typecheck through the build**

Run:

```bash
npx vitest run tests/metaCreativeFormatCompatibility.test.ts
npm run build
```

Expected: test PASS and build succeeds with no TypeScript errors.

**Step 7: Commit**

```bash
git add src/types.ts src/index.ts src/providers/meta/creativeFormatCompatibility.ts tests/metaCreativeFormatCompatibility.test.ts
git commit -m "feat: define Meta creative format contract"
```

---

### Task 2: Build and validate standard single-image, video, carousel, and existing-post payloads

**Files:**
- Create: `src/providers/meta/buildCreativeFormatPayload.ts`
- Create: `tests/metaCreativeFormatPayload.test.ts`
- Modify: `src/index.ts`

**Step 1: Write exact-payload tests first**

Create `tests/metaCreativeFormatPayload.test.ts` with one case per format. The single-image assertion must be exact:

```typescript
import { describe, expect, it } from 'vitest';
import { buildMetaCreativeFormatPayload } from '../src/providers/meta/buildCreativeFormatPayload.js';

describe('buildMetaCreativeFormatPayload', () => {
  it('builds a standard single-image link creative', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-hash',
          primaryText: 'Belanja sekarang',
          headline: 'Promo Payday',
          destinationUrl: 'https://example.com/payday',
          callToAction: 'SHOP_NOW',
        },
      })
    ).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          image_hash: 'image-hash',
          message: 'Belanja sekarang',
          name: 'Promo Payday',
          link: 'https://example.com/payday',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://example.com/payday' },
          },
        },
      },
    });
  });

  it('builds video_data and keeps the thumbnail optional', () => {
    const result = buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        thumbnailImageHash: 'thumb-1',
        primaryText: 'Tonton produknya',
        destinationUrl: 'https://example.com/video',
        callToAction: 'SHOP_NOW',
      },
    });

    expect(result.object_story_spec).toMatchObject({
      page_id: 'page-1',
      video_data: {
        video_id: 'video-1',
        image_hash: 'thumb-1',
        message: 'Tonton produknya',
      },
    });
  });

  it('requires at least two valid carousel cards', () => {
    expect(() =>
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'carousel',
        creativeSpec: {
          primaryText: 'Pilih produk',
          cards: [
            {
              imageHash: 'one',
              headline: 'Satu',
              destinationUrl: 'https://example.com/one',
            },
          ],
        },
      })
    ).toThrow(/minimal 2 kartu/i);
  });

  it('builds an existing post without requiring pageId in the story body', () => {
    expect(
      buildMetaCreativeFormatPayload({
        mode: 'standard',
        pageId: 'page-1',
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_post-1' },
      })
    ).toEqual({ object_story_id: 'page-1_post-1' });
  });
});
```

Add exact assertions for:

- video CTA link and optional `image_hash`;
- carousel `attachment_style: 'link'` and two `child_attachments`;
- a card with neither `imageHash` nor `videoId` fails locally;
- a card with both media identifiers fails locally;
- blank asset IDs, copy, or URLs fail locally.

**Step 2: Run the test and confirm failure**

Run:

```bash
npx vitest run tests/metaCreativeFormatPayload.test.ts
```

Expected: FAIL because the builder module does not exist.

**Step 3: Implement helpers and the discriminated switch**

Create `src/providers/meta/buildCreativeFormatPayload.ts`. Its public entry point is:

```typescript
import type { MetaAdsMode, MetaCreativeSpec } from '../../types.js';
import { assertMetaCreativeCompatibility } from './creativeFormatCompatibility.js';

export type BuildMetaCreativeFormatPayloadInput = MetaCreativeSpec & {
  mode: MetaAdsMode;
  pageId: string;
  instagramUserId?: string;
  collaborativeProductSetId?: string;
};

export function buildMetaCreativeFormatPayload(
  input: BuildMetaCreativeFormatPayloadInput
): Record<string, unknown> {
  assertMetaCreativeCompatibility(input);

  switch (input.creativeFormat) {
    case 'single_image':
      return buildSingleImage(input);
    case 'video':
      return buildVideo(input);
    case 'carousel':
      return buildCarousel(input);
    case 'catalog':
      return buildCatalog(input);
    case 'collection':
      return buildCollection(input);
    case 'flexible':
      return buildFlexible(input);
    case 'existing_post':
      return buildExistingPost(input);
  }
}
```

In this task, implement `buildSingleImage`, `buildVideo`, `buildCarousel`, and `buildExistingPost`. Define the remaining functions in Tasks 3 and 4 before the branch-wide build is required. To keep this task compilable, add them now as private functions that throw `Unsupported format in this delivery step`, and do not export them. The tests in this task must not exercise those three cases.

Use shared helpers with complete behavior:

```typescript
function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} wajib diisi.`);
  return normalized;
}

function cta(type: string | undefined, destinationUrl: string): Record<string, unknown> {
  return {
    type: type?.trim() || 'LEARN_MORE',
    value: { link: destinationUrl },
  };
}
```

For carousel cards, map image cards to `image_hash`, video cards to `video_id`, and always include `link` and `name`. Put the overall CTA on each card because Meta evaluates each carousel destination independently.

**Step 4: Export the builder**

Export `buildMetaCreativeFormatPayload` and its input type from `src/index.ts`.

**Step 5: Run tests and build**

Run:

```bash
npx vitest run tests/metaCreativeFormatPayload.test.ts
npm run build
```

Expected: all focused tests PASS and build succeeds.

**Step 6: Commit**

```bash
git add src/providers/meta/buildCreativeFormatPayload.ts tests/metaCreativeFormatPayload.test.ts src/index.ts
git commit -m "feat: build standard Meta creative payloads"
```

---

### Task 3: Add catalog context to ad sets and build standard/collaborative catalog creatives

**Files:**
- Modify: `src/tools/createAdSet.ts`
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Modify: `tests/createAdSet.test.ts`
- Modify: `tests/metaCreativeFormatPayload.test.ts`

**Step 1: Add failing ad-set tests**

Append cases to `tests/createAdSet.test.ts`:

```typescript
it('places a collaborative product set in promoted_object', async () => {
  const result = await createAdSet(
    client,
    {
      adAccountId: 'act_1',
      campaignId: 'campaign-1',
      name: 'Shopee Product Set',
      mode: 'collaborative_ads',
      collaborativeCatalog: {
        productSetId: 'product-set-1',
        pixelId: 'pixel-1',
        customEventType: 'PURCHASE',
      },
    },
    { dryRun: true }
  );

  expect(result.preview.promoted_object).toEqual({
    product_set_id: 'product-set-1',
    pixel_id: 'pixel-1',
    custom_event_type: 'PURCHASE',
  });
});

it('rejects collaborative ad sets without a product set before POST', async () => {
  const result = await createAdSet(
    client,
    {
      adAccountId: 'act_1',
      campaignId: 'campaign-1',
      name: 'Missing Product Set',
      mode: 'collaborative_ads',
    },
    { dryRun: true }
  );

  expect(result.status).toBe('failed');
  expect(result.error).toMatch(/product set.*wajib/i);
  expect(client.metaPost).not.toHaveBeenCalled();
});
```

Keep the existing mocked campaign preflight response intact.

**Step 2: Add failing creative payload tests**

Append to `tests/metaCreativeFormatPayload.test.ts`:

```typescript
it('builds a catalog template with top-level product_set_id', () => {
  expect(
    buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Produk pilihan',
        headline: '{{product.name}}',
        destinationUrl: 'https://example.com/products',
        callToAction: 'SHOP_NOW',
      },
    })
  ).toMatchObject({
    product_set_id: 'product-set-1',
    object_story_spec: {
      page_id: 'page-1',
      template_data: {
        message: 'Produk pilihan',
        name: '{{product.name}}',
        link: 'https://example.com/products',
      },
    },
  });
});

it('adds omnichannel_link_spec for collaborative catalog creative', () => {
  const result = buildMetaCreativeFormatPayload({
    mode: 'collaborative_ads',
    pageId: 'page-1',
    collaborativeProductSetId: 'product-set-1',
    creativeFormat: 'catalog',
    creativeSpec: {
      productSetId: 'product-set-1',
      primaryText: 'Belanja di Shopee',
      destinationUrl: 'https://shopee.example/store',
      callToAction: 'SHOP_NOW',
    },
  });

  expect(result).toMatchObject({
    product_set_id: 'product-set-1',
    omnichannel_link_spec: {
      web: { url: 'https://shopee.example/store' },
    },
  });
  expect(result).not.toHaveProperty('asset_feed_spec');
});

it('rejects mismatched collaborative product sets', () => {
  expect(() =>
    buildMetaCreativeFormatPayload({
      mode: 'collaborative_ads',
      pageId: 'page-1',
      collaborativeProductSetId: 'adset-product-set',
      creativeFormat: 'catalog',
      creativeSpec: {
        productSetId: 'creative-product-set',
        primaryText: 'Produk',
        destinationUrl: 'https://example.com',
      },
    })
  ).toThrow(/product set.*harus sama/i);
});
```

Add a table-driven test for Collaborative Ads poster, video, and carousel creatives. Each result must preserve its normal story family and also contain the shared catalog envelope:

```typescript
expect(result).toMatchObject({
  product_set_id: 'product-set-1',
  omnichannel_link_spec: {
    web: { url: expectedDestinationUrl },
  },
});
```

For the three cases, additionally assert `link_data`, `video_data`, and `link_data.child_attachments` respectively. Assert that none contains `asset_feed_spec`. The carousel test uses its top-level `destinationUrl`; if omitted, the builder deterministically uses the first card destination.

**Step 3: Run focused tests and confirm failure**

```bash
npx vitest run tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts
```

Expected: FAIL because mode/catalog inputs and catalog builder are not implemented.

**Step 4: Extend `CreateAdSetOptions` and payload validation**

Import `MetaAdsMode` and `MetaCollaborativeCatalogContext` from `../types.js`, then add:

```typescript
mode?: MetaAdsMode;
collaborativeCatalog?: MetaCollaborativeCatalogContext;
```

Before returning a dry run, reject `mode === 'collaborative_ads'` when `collaborativeCatalog.productSetId` is blank. Build `promoted_object` from the marketer-facing context and merge only non-empty optional fields:

```typescript
const collaborativePromotedObject = options.collaborativeCatalog
  ? {
      product_set_id: options.collaborativeCatalog.productSetId.trim(),
      ...(options.collaborativeCatalog.pixelId?.trim()
        ? { pixel_id: options.collaborativeCatalog.pixelId.trim() }
        : {}),
      ...(options.collaborativeCatalog.customEventType?.trim()
        ? { custom_event_type: options.collaborativeCatalog.customEventType.trim() }
        : {}),
    }
  : undefined;

payload.promoted_object = collaborativePromotedObject ?? options.promotedObject;
```

If both `collaborativeCatalog` and legacy `promotedObject.product_set_id` are supplied, reject mismatched values rather than silently overriding one.

**Step 5: Implement the catalog builder**

Replace the Task 2 catalog stub. The builder must:

- require and normalize `productSetId`;
- produce top-level `product_set_id`;
- use `object_story_spec.template_data`, never `link_data` or generic `asset_feed_spec`;
- add `omnichannel_link_spec.web.url` only in Collaborative Ads;
- require the creative product set to match `collaborativeProductSetId`;
- allow `templateUrl` to become `template_url` when supplied;
- use `fallbackImageHash` as `image_hash` in `template_data` when supplied.

Then add a single `withCollaborativeCatalogContext` wrapper around the result of every allowed Collaborative Ads builder. It must:

```typescript
function withCollaborativeCatalogContext(
  input: BuildMetaCreativeFormatPayloadInput,
  payload: Record<string, unknown>,
  destinationUrl: string
): Record<string, unknown> {
  if (input.mode !== 'collaborative_ads') return payload;

  const productSetId = required(
    input.collaborativeProductSetId,
    'Product set Collaborative Ads'
  );

  return {
    ...payload,
    product_set_id: productSetId,
    omnichannel_link_spec: {
      web: { url: required(destinationUrl, 'Destination URL Collaborative Ads') },
    },
  };
}
```

Apply it to `single_image`, `video`, and `carousel` as well as `catalog`. For catalog, first require `creativeSpec.productSetId` to equal `collaborativeProductSetId`. For carousel, resolve the destination from `creativeSpec.destinationUrl` or the first card. Never add `asset_feed_spec` in this wrapper.

**Step 6: Run tests and build**

```bash
npx vitest run tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts
npm run build
```

Expected: PASS with no network calls in payload tests.

**Step 7: Commit**

```bash
git add src/tools/createAdSet.ts src/providers/meta/buildCreativeFormatPayload.ts tests/createAdSet.test.ts tests/metaCreativeFormatPayload.test.ts
git commit -m "feat: support Meta catalog ad payloads"
```

---

### Task 4: Add Collection/Instant Experience and flexible creative builders

**Files:**
- Modify: `src/providers/meta/buildCreativeFormatPayload.ts`
- Modify: `tests/metaCreativeFormatPayload.test.ts`

**Step 1: Write failing Collection tests**

Append:

```typescript
it('links collection cover media to an existing Instant Experience', () => {
  expect(
    buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'cover-1',
        primaryText: 'Buka koleksi',
        headline: 'Koleksi Payday',
        callToAction: 'SHOP_NOW',
      },
    })
  ).toMatchObject({
    object_story_spec: {
      page_id: 'page-1',
      link_data: {
        link: 'https://fb.com/canvas_doc/canvas-1',
        image_hash: 'cover-1',
        message: 'Buka koleksi',
        name: 'Koleksi Payday',
      },
    },
  });
});

it('requires exactly one Collection cover asset', () => {
  expect(() =>
    buildMetaCreativeFormatPayload({
      mode: 'standard',
      pageId: 'page-1',
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'image-1',
        coverVideoId: 'video-1',
        primaryText: 'Koleksi',
      },
    })
  ).toThrow(/pilih salah satu.*cover/i);
});
```

Add a collaborative Collection case asserting top-level `product_set_id` and `omnichannel_link_spec.web.url`, using the Instant Experience URL as the web destination when no explicit destination is supplied.

**Step 2: Write failing flexible creative tests**

Append:

```typescript
it('builds standard flexible asset_feed_spec', () => {
  const result = buildMetaCreativeFormatPayload({
    mode: 'standard',
    pageId: 'page-1',
    creativeFormat: 'flexible',
    creativeSpec: {
      imageHashes: ['image-1', 'image-2'],
      videoIds: ['video-1'],
      primaryTexts: ['Copy A', 'Copy B'],
      headlines: ['Headline A'],
      destinationUrl: 'https://example.com/flexible',
      callToAction: 'SHOP_NOW',
    },
  });

  expect(result).toMatchObject({
    object_story_spec: { page_id: 'page-1' },
    asset_feed_spec: {
      images: [{ hash: 'image-1' }, { hash: 'image-2' }],
      videos: [{ video_id: 'video-1' }],
      bodies: [{ text: 'Copy A' }, { text: 'Copy B' }],
      titles: [{ text: 'Headline A' }],
      link_urls: [{ website_url: 'https://example.com/flexible' }],
      call_to_action_types: ['SHOP_NOW'],
      ad_formats: ['SINGLE_IMAGE', 'SINGLE_VIDEO'],
    },
  });
});
```

Add cases proving empty media, empty primary text, and Collaborative Ads flexible mode fail locally.

**Step 3: Run focused tests and confirm failure**

```bash
npx vitest run tests/metaCreativeFormatPayload.test.ts
```

Expected: FAIL because the Collection and flexible stubs still throw.

**Step 4: Implement Collection**

Replace the stub. Normalize `instantExperienceId`, construct `https://fb.com/canvas_doc/${encodeURIComponent(id)}`, and map the selected cover through the same link/video story families used by Task 2:

- image cover: `object_story_spec.link_data` with the Canvas URL;
- video cover: `object_story_spec.video_data` with CTA `value.link` set to the Canvas URL;
- Collaborative Ads: require a product set, add top-level `product_set_id`, and add `omnichannel_link_spec.web.url`;
- reject missing or dual cover media before returning the payload.

Do not call Canvas creation endpoints.

**Step 5: Implement flexible creative**

Replace the stub. Remove blank array entries, require at least one image or video and one primary text, build `asset_feed_spec`, and derive `ad_formats` only from media actually present. Include descriptions only when supplied. Keep `object_story_spec` limited to Page/Instagram actor identity; do not nest `asset_feed_spec` inside it.

**Step 6: Run focused tests and build**

```bash
npx vitest run tests/metaCreativeFormatPayload.test.ts
npm run build
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/providers/meta/buildCreativeFormatPayload.ts tests/metaCreativeFormatPayload.test.ts
git commit -m "feat: support Meta collection and flexible creatives"
```

---

### Task 5: Connect the canonical formats to the existing creative tool and Meta adapter

**Files:**
- Modify: `src/tools/createCampaign.ts`
- Modify: `src/tools/createAdCreative.ts`
- Modify: `src/providers/meta/MetaAdsAdapter.ts`
- Modify: `tests/createAdCreative.test.ts`
- Modify: `tests/metaAdsAdapter.test.ts`

**Step 1: Write failing tool integration tests**

Add to `tests/createAdCreative.test.ts`:

```typescript
it('uses creativeFormat and creativeSpec instead of legacy linkData', async () => {
  const result = await createAdCreative(
    client,
    {
      adAccountId: 'act_1',
      name: 'Poster Payday',
      pageId: 'page-1',
      mode: 'standard',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Promo Payday',
          destinationUrl: 'https://example.com',
          callToAction: 'SHOP_NOW',
        },
      },
    },
    { dryRun: true }
  );

  expect(result.preview).toMatchObject({
    name: 'Poster Payday',
    object_story_spec: {
      page_id: 'page-1',
      link_data: { image_hash: 'image-1' },
    },
  });
});
```

Add tests proving:

- canonical fields win only when the canonical pair is complete;
- the adapter rejects public input containing only `creativeFormat` or only `creativeSpec` before POST;
- existing `linkData`, `objectStorySpec`, and `assetFeedSpec` tests remain unchanged and pass;
- a mismatched Collaborative Ads product set returns a structured validation error.

Add adapter tests in `tests/metaAdsAdapter.test.ts` showing request params are forwarded as canonical options rather than flattened into raw records.

**Step 2: Run focused tests and confirm failure**

```bash
npx vitest run tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts
```

Expected: FAIL because the create tool and adapter do not accept canonical format fields.

**Step 3: Add campaign mode metadata without changing Meta campaign payload**

Extend `CreateCampaignOptions` with optional `mode?: MetaAdsMode`. Include the normalized mode in `CreateCampaignResult` as local result metadata, but do not send a made-up `mode` field to Meta. Add one test that dry-run preview contains only supported Meta campaign fields while `result.mode === 'collaborative_ads'`.

**Step 4: Extend `CreateAdCreativeOptions`**

Make `pageId` optional only at the TypeScript interface level so `existing_post` can use `object_story_id`; enforce it for all other canonical formats and all legacy paths that require a Page.

Add:

```typescript
mode?: MetaAdsMode;
creative?: MetaCreativeSpec;
collaborativeProductSetId?: string;
```

The broker keeps marketer-facing `creativeFormat` and `creativeSpec` as separate JSON fields. The adapter validates and combines them into the discriminated `creative` object before calling the typed create tool.

In `buildCreativePayload`, choose exactly one path:

```typescript
if (options.creative) {
  Object.assign(
    payload,
    buildMetaCreativeFormatPayload({
      mode: options.mode ?? 'standard',
      pageId: options.pageId ?? '',
      ...options.creative,
      instagramUserId: options.instagramUserId,
      collaborativeProductSetId: options.collaborativeProductSetId,
    })
  );
} else {
  // Preserve the existing legacy objectStorySpec/linkData behavior unchanged.
}
```

Catch local builder errors and return a `StructuredMutationError` with provider `meta`, code `VALIDATION_ERROR`, and the plain-language message. Do not call Meta for local validation failures.

**Step 5: Parse canonical fields in `MetaAdsAdapter`**

Add strict parser helpers for:

- `mode` enum;
- `creativeFormat` enum;
- object-valued `creativeSpec`;
- object-valued `collaborativeCatalog` on ad sets;
- `collaborativeProductSetId` on creatives.

Implement `parseMetaCreativeSpec(format, value): MetaCreativeSpec` as an exhaustive switch. Each branch validates required scalar/array shapes and returns the corresponding discriminated pair, for example:

```typescript
case 'single_image':
  return {
    creativeFormat: 'single_image',
    creativeSpec: {
      imageHash: requireString(spec.imageHash, 'creativeSpec.imageHash'),
      primaryText: requireString(spec.primaryText, 'creativeSpec.primaryText'),
      destinationUrl: requireString(
        spec.destinationUrl,
        'creativeSpec.destinationUrl'
      ),
      headline: optionalString(spec.headline),
      description: optionalString(spec.description),
      callToAction: optionalString(spec.callToAction),
    },
  };
```

Add equivalent exhaustive branches for the other six formats. Carousel parsing validates every card object; flexible parsing validates string arrays; Collection parsing preserves optional cover fields for the builder's exactly-one validation. This parser must not use `as MetaCreativeSpec` or pass unchecked records into the builder.

Keep the existing legacy parser path. Never stringify canonical `creativeSpec` in the adapter; the builder owns provider serialization.

**Step 6: Run focused tests and build**

```bash
npx vitest run tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/createCampaign.test.ts
npm run build
```

Expected: PASS, including all pre-existing creative tests.

**Step 7: Commit**

```bash
git add src/tools/createCampaign.ts src/tools/createAdCreative.ts src/providers/meta/MetaAdsAdapter.ts tests/createCampaign.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts
git commit -m "feat: integrate Meta creative formats with create tools"
```

---

### Task 6: Extend MCP schemas without adding public tools

**Files:**
- Modify: `src/broker/mcpTools.ts`
- Modify: `tests/mcpServerBuilder.test.ts`

**Step 1: Write failing schema tests**

In `tests/mcpServerBuilder.test.ts`, locate the four existing mutation tool schemas and add assertions:

```typescript
expect(campaignTool.inputSchema.properties).toHaveProperty('mode');
expect(adsetTool.inputSchema.properties).toHaveProperty('collaborativeCatalog');
expect(creativeTool.inputSchema.properties).toHaveProperty('creativeFormat');
expect(creativeTool.inputSchema.properties).toHaveProperty('creativeSpec');
expect(toolNames.filter((name) => name.startsWith('ads_create_'))).toEqual([
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
]);
```

Also assert enum values exactly match the canonical types and descriptions use marketer language.

**Step 2: Run the schema test and confirm failure**

```bash
npx vitest run tests/mcpServerBuilder.test.ts
```

Expected: FAIL because new schema properties are absent.

**Step 3: Extend the existing schemas**

Add:

```typescript
mode: {
  type: 'string',
  enum: ['standard', 'collaborative_ads'],
  description: 'standard untuk iklan Meta biasa; collaborative_ads untuk katalog retailer yang sudah dibagikan.',
}
```

For the creative schema, add `creativeFormat` with all seven enum values and `creativeSpec` as an object whose description explains the fields per format. Keep legacy fields present and mark them as advanced/backward-compatible in descriptions.

Add `collaborativeProductSetId` to the creative schema. Explain that it must match the product set chosen at ad-set level and is required for every Collaborative Ads creative format in this release.

For ad sets, add a typed object schema for `collaborativeCatalog` with required `productSetId` and optional `pixelId`, `customEventType`, and `destinationUrl`.

Do not add a fifth tool, a `cpas` provider, or a retailer setup operation.

**Step 4: Run schema, adapter, and build checks**

```bash
npx vitest run tests/mcpServerBuilder.test.ts tests/metaAdsAdapter.test.ts
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/broker/mcpTools.ts tests/mcpServerBuilder.test.ts
git commit -m "feat: expose Meta creative formats in MCP schemas"
```

---

### Task 7: Add plain-language error guidance and read-back verification

**Files:**
- Modify: `src/types.ts`
- Create: `src/providers/meta/metaCreativeErrorGuidance.ts`
- Modify: `src/tools/createAdCreative.ts`
- Modify: `src/utils/formatMetaWriteError.ts`
- Modify: `tests/formatMetaWriteError.test.ts`
- Create: `tests/metaCreativeErrorGuidance.test.ts`
- Modify: `tests/createAdCreative.test.ts`
- Modify: `src/index.ts`

**Step 1: Write failing guidance tests**

Create `tests/metaCreativeErrorGuidance.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getMetaCreativeErrorGuidance } from '../src/providers/meta/metaCreativeErrorGuidance.js';

describe('getMetaCreativeErrorGuidance', () => {
  it('explains a missing collaborative product-set attachment', () => {
    expect(
      getMetaCreativeErrorGuidance({
        providerCode: '100',
        providerSubcode: '2310068',
        message: 'Invalid parameter',
      })
    ).toMatch(/katalog.*dibagikan|product set/i);
  });

  it('does not replace the original Meta details', () => {
    const guidance = getMetaCreativeErrorGuidance({
      providerCode: '100',
      providerSubcode: '999999',
      message: 'Original Meta message',
    });
    expect(guidance).toMatch(/Meta menolak/i);
  });
});
```

Use a small mapping keyed by known code/subcode combinations. Unknown errors receive neutral guidance; never infer that all API creation is impossible.

**Step 2: Write failing read-back tests**

Add to `tests/createAdCreative.test.ts`:

```typescript
it('reads an executed creative back and reports verification separately', async () => {
  client.metaPost.mockResolvedValueOnce({ id: 'creative-1' });
  client.metaGetObject.mockResolvedValueOnce({
    id: 'creative-1',
    product_set_id: 'product-set-1',
    object_story_spec: { template_data: {} },
    omnichannel_link_spec: { web: { url: 'https://example.com' } },
  });

  const result = await createAdCreative(
    client,
    collaborativeCatalogOptions,
    { dryRun: false, confirmed: true }
  );

  expect(result.status).toBe('executed');
  expect(result.verification).toMatchObject({
    status: 'verified',
    creativeId: 'creative-1',
  });
});

it('keeps successful creation when read-back temporarily fails', async () => {
  client.metaPost.mockResolvedValueOnce({ id: 'creative-1' });
  client.metaGetObject.mockRejectedValueOnce(new Error('temporary read failure'));

  const result = await createAdCreative(
    client,
    standardImageOptions,
    { dryRun: false, confirmed: true }
  );

  expect(result.status).toBe('executed');
  expect(result.id).toBe('creative-1');
  expect(result.verification?.status).toBe('warning');
});
```

**Step 3: Run focused tests and confirm failure**

```bash
npx vitest run tests/metaCreativeErrorGuidance.test.ts tests/createAdCreative.test.ts
```

Expected: FAIL because guidance and verification fields do not exist.

**Step 4: Add verification result types**

Add to `src/types.ts`:

```typescript
export interface MetaCreativeVerification {
  status: 'verified' | 'warning';
  creativeId: string;
  effectiveFormat?: MetaCreativeFormat;
  fields?: Record<string, unknown>;
  warning?: string;
}
```

Add `verification?: MetaCreativeVerification` to `CreateAdCreativeResult`.

Also extend the shared `StructuredMutationError` with optional provider-native text fields so Meta's title and message remain separately inspectable:

```typescript
providerTitle?: string;
providerMessage?: string;
```

Update `formatStructuredMetaWriteError` to populate them from `MetaApiError.userTitle` and `MetaApiError.userMessage`. Add an exact test to `tests/formatMetaWriteError.test.ts` proving provider code, subcode, title, message, and trace ID all survive formatting.

**Step 5: Implement plain-language guidance**

Create `src/providers/meta/metaCreativeErrorGuidance.ts`. Map known local validation codes and Meta subcodes to Indonesian guidance. Return guidance separately, then compose it before the original error string:

```typescript
const original = formatMetaWriteError(error);
const structuredError = formatStructuredMetaWriteError(error);
const guidance = getMetaCreativeErrorGuidance(structuredError);

return {
  ...baseResult,
  status: 'failed',
  error: `${guidance} Detail Meta: ${original}`,
  structuredError,
};
```

Preserve code, subcode, user title, user message, and trace ID in `structuredError` exactly as the existing formatter returns them.

**Step 6: Read the creative back after a successful POST**

After Meta returns an ID, call:

```typescript
client.metaGetObject<Record<string, unknown>>(
  `/${response.id}`,
  {
    fields:
      'id,name,object_story_id,object_story_spec,asset_feed_spec,product_set_id,omnichannel_link_spec,effective_object_story_id',
  },
  maxRetries
)
```

Compare the returned family to the intended format:

- `object_story_id` or `effective_object_story_id` for existing post;
- `asset_feed_spec` for flexible;
- `product_set_id` plus `template_data` for catalog;
- Canvas URL in link/video data for collection;
- `child_attachments` for carousel;
- `video_data` for video;
- `link_data.image_hash` for single image.

Return `verified` when the family matches. If read-back fails or fields are incomplete, return `warning` without changing `status: 'executed'` or removing the creative ID.

Do not perform read-back on dry runs, pending confirmation, deduped results, or failed writes.

**Step 7: Run focused tests and build**

```bash
npx vitest run tests/metaCreativeErrorGuidance.test.ts tests/createAdCreative.test.ts
npm run build
```

Expected: PASS.

**Step 8: Commit**

```bash
git add src/types.ts src/index.ts src/providers/meta/metaCreativeErrorGuidance.ts src/tools/createAdCreative.ts src/utils/formatMetaWriteError.ts tests/formatMetaWriteError.test.ts tests/metaCreativeErrorGuidance.test.ts tests/createAdCreative.test.ts
git commit -m "feat: verify Meta creatives after creation"
```

---

### Task 8: Prove multi-format ad creation, backward compatibility, and security

**Files:**
- Modify: `tests/createAd.test.ts`
- Modify: `tests/metaAdsAdapter.test.ts`
- Modify: `tests/mcpServerBuilder.test.ts`
- Modify: `README.md`

**Step 1: Add a mocked multi-format workflow test**

In `tests/metaAdsAdapter.test.ts`, add a test that creates two creatives under the same `adsetId`—one single image and one video—then creates two ads pointing at the separate creative IDs. Assert:

```typescript
expect(adCreateCalls).toEqual([
  expect.objectContaining({ adsetId: 'adset-1', creativeId: 'creative-image' }),
  expect.objectContaining({ adsetId: 'adset-1', creativeId: 'creative-video' }),
]);
```

This proves the format belongs to the creative/ad level and does not require duplicate ad sets.

**Step 2: Add safety regression tests**

Cover all of these assertions:

- a dry run never calls `metaPost`;
- `dryRun: false` without `confirmed: true` stays pending;
- created campaign, ad set, and ad payloads default to `PAUSED`;
- partial failure retains IDs from already completed calls;
- result/error JSON does not contain `access_token`, `Authorization`, or a token fixture string;
- old simple `linkData` input still builds the same preview as before;
- only the four existing `ads_create_*` tools are exposed.

**Step 3: Run the focused regression set**

```bash
npx vitest run tests/createAd.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
```

Expected: PASS.

**Step 4: Update the existing README, without creating another guide**

Add one concise marketer-facing section to `README.md` containing:

- standard vs Collaborative Ads definitions;
- the seven standard formats and five initially supported Collaborative Ads formats;
- a simple example using the existing four tool names;
- the rule that the retailer must already have shared the catalog/product set;
- Collection reuses an existing Instant Experience ID;
- dry-run, confirmation, and `PAUSED` safety behavior;
- `flexible` and `existing_post` Collaborative Ads limitations.

Do not add a new documentation file.

**Step 5: Run final verification from a clean command sequence**

Run:

```bash
npm run format
npm run lint
npm run build
npm run test
git diff --check
git status --short
```

Expected:

- Prettier completes successfully;
- ESLint reports no errors;
- tsup build succeeds;
- the full Vitest suite passes;
- `git diff --check` prints nothing;
- `git status --short` lists only the intended changed files before the final commit.

If formatting modifies files outside this feature, inspect and revert only those formatter changes with a targeted patch; never discard unrelated user changes.

**Step 6: Commit the verified integration**

```bash
git add README.md tests/createAd.test.ts tests/createAdCreative.test.ts tests/metaAdsAdapter.test.ts tests/mcpServerBuilder.test.ts
git commit -m "test: verify Meta multi-format creation workflow"
```

**Step 7: Verify the committed branch is clean**

Run:

```bash
git diff HEAD --stat
git status --short --branch
```

Expected: `git diff HEAD --stat` prints nothing and the branch reports a clean working tree. Do not push or merge; report the result and wait for explicit permission.

---

## Implementation self-review checklist

Before declaring implementation complete, verify each item explicitly:

- All seven standard formats have exact payload tests.
- Collaborative Ads has exact tests for image, video, carousel, catalog, and collection.
- Collaborative catalog creatives use top-level `product_set_id` and `template_data`.
- Generic Collaborative catalog paths do not include `asset_feed_spec`.
- Ad-set and creative product-set IDs must match.
- Collection accepts an existing Instant Experience ID and does not create Canvas content.
- Several formats can attach to one ad set through separate creatives and ads.
- Legacy creative inputs and all four public tool names remain compatible.
- Local errors are in simple Indonesian; original Meta diagnostics remain structured.
- Dry runs and failed validation perform no provider mutation.
- No credential is logged, returned, or embedded in fixtures.
- Full format, lint, build, and test commands pass.
- No push or merge occurs without explicit permission.

## Reference design

Implementation must remain consistent with `docs/superpowers/specs/2026-07-18-meta-collaborative-creative-formats-design.md`.
