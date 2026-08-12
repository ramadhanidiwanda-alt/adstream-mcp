# Meta multi-media ads: missing text incident report

## Status

Fixed in the local working tree; not committed, pushed, or deployed. No live Meta API mutation was made during this investigation.

## Production reproduction supplied for investigation

- Account: **Meena regular**, `act_2086409658377471`.
- Existing ad: `120252417259930415`, named **MID MONTH SALE | POSTER | PLACEMENT 1:1 + 9:16 | 15-17 AGUSTUS 2026**.
- Current inline multi-media creative: `949097914868104`.
- It was created through `ads_create_ad` using `multiMedia` with:
  - primary 1:1 image hash `dc83c36b21608b618107f7e88c0f8499`;
  - another 9:16 image hash `5962cd721db94f092bded081a699b0bb`;
  - the full Mid Month primary-text copy;
  - a headline;
  - a WhatsApp destination; and
  - placement exclusions.
- Readback showed the copy in `object_story_spec.link_data.message`, yet Ads Manager showed **no Primary Text** for the multi-media ad.
- The generated `media_sourcing_spec` contained image hashes, `source`, `opt_in_status`, and placement exclusions only. It did **not** contain the documented root `bodies`, `titles`, or `descriptions`, and did not contain per-media `text_customizations`.
- A normal `single_image` creative renders `link_data.message` in Ads Manager correctly but loses the required independent 1:1 and 9:16 media setup. It is therefore not an acceptable primary fix.
- CPAS is a separate constraint: collaborative omnichannel single-image creative needs `object_store_urls`. This incident does not change that route or its behavior.
- A previous attempt to replace the existing creative with a standard creative returned Meta error code 2 (transient). This investigation deliberately did not retry that mutation or issue any live mutation.

## Root cause and traced payload mapping

The affected route is `ads_create_ad` → `MetaAdsAdapter.createAd` → `createAd` → `buildAdPayload` → `buildMultiMediaCreative`.

Before this fix, `buildMultiMediaCreative` mapped:

```ts
primaryText -> object_story_spec.link_data.message
headline    -> object_story_spec.link_data.name
images      -> media_sourcing_spec.images[] (hash, source, opt_in_status, placement_customizations)
```

It did not map any text to `media_sourcing_spec`. That behavior conflicts with the supplied Meta multi-media reference: global L1 text must be represented at the `media_sourcing_spec` root as `bodies`, `titles`, and `descriptions`; per-media text uses `images[].text_customizations` (and equivalently videos where a video-capable route is implemented).

The implementation did not make an API request during analysis. The diagnosis is based on the deterministic dry-run Graph payload and the existing production readback described above.

## Corrected payload contract

The inline image-only multi-media surface now supports:

| Input | Graph payload |
| --- | --- |
| `multiMedia.primaryText` | `object_story_spec.link_data.message` (preserved) and `media_sourcing_spec.bodies: [{ text }]` |
| `multiMedia.headline` | `object_story_spec.link_data.name` (preserved) and `media_sourcing_spec.titles: [{ text }]` |
| `multiMedia.description` | `object_story_spec.link_data.description` and `media_sourcing_spec.descriptions: [{ text }]` |
| `multiMedia.images[].textCustomizations` | `media_sourcing_spec.images[].text_customizations` |
| `multiMedia.images[].placementExclusions` | `media_sourcing_spec.images[].placement_customizations` (unchanged) |

The public TypeScript contract is:

```ts
interface MetaMultiMediaTextVariant { text: string }

interface MetaMultiMediaTextCustomizations {
  titles?: MetaMultiMediaTextVariant[];
  bodies?: MetaMultiMediaTextVariant[];
  descriptions?: MetaMultiMediaTextVariant[];
}

interface MetaMultiMediaImage {
  imageHash: string;
  placementExclusions?: MetaMultiMediaPlacementExclusion[];
  textCustomizations?: MetaMultiMediaTextCustomizations;
}

interface MetaMultiMediaAdOptions {
  pageId: string;
  instagramUserId?: string;
  destinationUrl: string;
  primaryImageHash: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  callToAction: string;
  images: MetaMultiMediaImage[];
}
```

This is intentionally an exact typed representation of the documented text-object shape rather than an untyped passthrough. Each supplied text variant is trimmed and must be non-empty; an empty `textCustomizations` object is rejected. The MCP Zod and JSON schemas expose the matching `description` and `images[].textCustomizations` inputs.

For backward compatibility, existing callers that only set `primaryText` and/or `headline` still work. Their existing `link_data` fields are retained and the required root L1 arrays are now added. Placement exclusions, media uniqueness validation, 2–10 image bounds, primary-image inclusion, dry-run/confirmation behavior, and source-ad behavior are unchanged.

## Before and after: supplied reproduction shape

Before, the relevant creative shape was effectively:

```json
{
  "object_story_spec": {
    "link_data": {
      "image_hash": "dc83c36b21608b618107f7e88c0f8499",
      "message": "<full Mid Month copy>",
      "name": "<headline>"
    }
  },
  "media_sourcing_spec": {
    "images": [
      {
        "hash": "dc83c36b21608b618107f7e88c0f8499",
        "source": "multi_media",
        "opt_in_status": "opt_in",
        "placement_customizations": ["<preserved placement exclusions>"]
      },
      {
        "hash": "5962cd721db94f092bded081a699b0bb",
        "source": "multi_media",
        "opt_in_status": "opt_in"
      }
    ]
  }
}
```

After, the relevant generated Graph payload is:

```json
{
  "object_story_spec": {
    "link_data": {
      "image_hash": "dc83c36b21608b618107f7e88c0f8499",
      "message": "<full Mid Month copy>",
      "name": "<headline>",
      "description": "<optional description>"
    }
  },
  "media_sourcing_spec": {
    "bodies": [{ "text": "<full Mid Month copy>" }],
    "titles": [{ "text": "<headline>" }],
    "descriptions": [{ "text": "<optional description>" }],
    "images": [
      {
        "hash": "dc83c36b21608b618107f7e88c0f8499",
        "source": "multi_media",
        "opt_in_status": "opt_in",
        "placement_customizations": ["<preserved placement exclusions>"],
        "text_customizations": {
          "bodies": [{ "text": "<optional square-specific primary text>" }],
          "titles": [{ "text": "<optional square-specific headline>" }],
          "descriptions": [{ "text": "<optional square-specific description>" }]
        }
      },
      {
        "hash": "5962cd721db94f092bded081a699b0bb",
        "source": "multi_media",
        "opt_in_status": "opt_in",
        "text_customizations": {
          "bodies": [{ "text": "<optional vertical-specific primary text>" }]
        }
      }
    ]
  }
}
```

The placeholders above intentionally do not invent or persist the full production copy, which was referenced in the supplied reproduction but not supplied as literal text.

## Constraints and scope

- The documented multi-media contract allows up to 10 images and videos combined. This existing `ads_create_ad.multiMedia` route remains an inline **image** route with 2–10 images; this change does not falsely advertise video or mixed-media input support.
- For the image route, the primary image in `object_story_spec.link_data.image_hash` must occur in `media_sourcing_spec.images`; this existing guard remains.
- Each image needs a hash (or URL in Meta's general contract) and `source: "multi_media"`; this route continues to use account image hashes and sends the required source plus `opt_in_status: "opt_in"`.
- Duplicate image hashes are rejected by the local route and by Meta's contract. `related_media` is not added and must not coexist with explicit images/videos.
- Destination customization and crop customization are documented provider capabilities, but they are not added to this narrowly scoped route. The existing placement-customization mapping remains intact.
- Per-media text overrides are only emitted if explicitly supplied. They override L1 root text for that media asset according to the reference.
- CPAS collaborative omnichannel behavior, including the separate `object_store_urls` requirement for single-image creative, is not altered.
- Do not mutate the quoted existing production ad as part of validation. A fresh, reviewed dry-run preview should be used first; execute only after explicit confirmation under the repository's write-safety policy.

## Verification

- Added a focused `createAd` dry-run payload regression using account `act_2086409658377471`, the supplied existing-ad name, the 1:1 and 9:16 image hashes, a WhatsApp CTA, placement exclusions, root L1 copy, and per-image text overrides.
- The regression asserts both preserved `link_data.message/name` and emitted root `media_sourcing_spec.bodies/titles/descriptions`, along with `text_customizations` and placement exclusions.
- `npm test -- tests/createAd.test.ts`: 38 tests passed.
- `npm run typecheck`: passed.
- No live Meta API calls, no change to creative `949097914868104`, no change to ad `120252417259930415`, and no attempt to repeat the prior code-2 mutation.

## Verbatim supplied Meta reference

The following is copied verbatim from the supplied 655-line attachment so that no supplied API contract detail is reduced or omitted from this report.

# Multi-media ads


Multi-media ads allow you to upload up to 10 images and videos within a single ad while maintaining per-media customization for placements, text, cropping, and destinations.

## Before you start

You need to set up your ad campaigns using the general ad setup:

- [Create a campaign](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started#campaign)
- [Create an ad set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started#ad-set-budget)
- [Create the ad or a standalone creative](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started#ad-creative)
- [Enable the ad](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started#book-ad)

### Limitations

- A maximum of 10 media assets (images and videos combined) can be included per ad.
- The primary media in `object_story_spec` must also appear in `media_sourcing_spec`.
- Each image must include a `hash` (or `url`) and `source` field. You can add multiple images in the same `media_sourcing_spec`.
- Each video must include a `video_id` and `source` field. You can add multiple videos in the same `media_sourcing_spec`.
- The API rejects duplicate image hashes or video IDs within the same `media_sourcing_spec`.
- The [`related_media`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative-media-sourcing-spec) field cannot coexist with explicit `images` or `videos` arrays.

## Create a multi-media ad with multiple images

To create a multi-media ad with multiple images, send a `POST` request to the `/act_<AD_ACCOUNT_ID>/ads` endpoint. Your request must include:

- `creative` — an inline creative containing:
    - `object_story_spec` — with `page_id` and [`link_data`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative-link-data) referencing the primary image via `image_hash` (the hash of an image in your ad account's image library)
    - `media_sourcing_spec` — with an `images` array containing all image assets. Each image requires `hash`, `source` set to `"multi_media"`, and `opt_in_status` set to `"opt_in"` to enable related media features.

The primary image referenced in `object_story_spec.link_data.image_hash` must also appear in the `media_sourcing_spec.images` array.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Multi-Media Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        },
        {
          "hash": "<IMAGE_HASH_3>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Create a multi-media ad with multiple videos

To create a multi-media ad with multiple videos, send a `POST` request to the `/act_<AD_ACCOUNT_ID>/ads` endpoint. When the primary media is a video, `object_story_spec` must use [`video_data`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative-video-data) instead of `link_data`.

Each video in the `media_sourcing_spec.videos` array requires:

- `video_id` — the ID of a video uploaded to your ad account
- `original_video_id` — the original video ID reference
- `source` — set to `"multi_media"`
- `opt_in_status` — controls whether the asset participates in related media features. Set to `"opt_in"` to enable.
- `thumbnail_url` — the thumbnail image URL for this video in `media_sourcing_spec`
- `thumbnail_source` — how the thumbnail was generated (for example, `"generated_default"` or `"custom"`)

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Multi-Media Video Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "video_data": {
        "video_id": "<VIDEO_ID_1>",
        "image_url": "https://example.com/thumbnail1.jpg",
        "call_to_action": {
          "type": "LEARN_MORE",
          "value": {"link": "https://www.example.com"}
        }
      }
    },
    "media_sourcing_spec": {
      "videos": [
        {
          "video_id": "<VIDEO_ID_1>",
          "original_video_id": "<VIDEO_ID_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "thumbnail_source": "generated_default",
          "thumbnail_url": "https://example.com/thumbnail1.jpg"
        },
        {
          "video_id": "<VIDEO_ID_2>",
          "original_video_id": "<VIDEO_ID_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "thumbnail_source": "generated_default",
          "thumbnail_url": "https://example.com/thumbnail2.jpg"
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Create a multi-media ad with mixed media

You can combine images and videos in a single multi-media ad. The primary media in `object_story_spec` can be either an image (using `link_data`) or a video (using `video_data`). All other media assets are listed in `media_sourcing_spec`.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Mixed Media Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        }
      ],
      "videos": [
        {
          "video_id": "<VIDEO_ID_1>",
          "original_video_id": "<VIDEO_ID_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "thumbnail_source": "generated_default",
          "thumbnail_url": "https://example.com/thumbnail.jpg"
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Add text customizations

Multi-media ads support two levels of text customization:

- **Global text (L1)** — titles, bodies, and descriptions at the `media_sourcing_spec` root level. These apply across all media assets and allow the system to test different text combinations.
- **Per-media text** — `text_customizations` on each image or video. These override the global text for that specific media asset.

Per-media `text_customizations` accept `titles`, `bodies`, and `descriptions`, each containing objects with a `text` field.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Text Customized Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "text_customizations": {
            "titles": [{"text": "Summer Collection Now Live"}],
            "bodies": [{"text": "Shop our latest summer styles today"}],
            "descriptions": [{"text": "Free shipping on orders over $50"}]
          }
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "text_customizations": {
            "titles": [{"text": "Winter Essentials Are Here"}],
            "bodies": [{"text": "Cozy up with our winter picks"}]
          }
        }
      ],
      "titles": [
        {"text": "Global Headline Option 1"},
        {"text": "Global Headline Option 2"}
      ],
      "bodies": [
        {"text": "Global primary text option 1"},
        {"text": "Global primary text option 2"}
      ],
      "descriptions": [
        {"text": "Global description"}
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Add destination customizations

You can set different destination URLs for each media asset using `destination_customizations`.

Each destination customization requires:

- `url` — the destination URL for this media asset
- `display_url` (optional) — the display URL shown to the user

This allows each image or video in the ad to link to a different landing page.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Destination Customized Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "destination_customizations": [
            {
              "url": "https://www.example.com/summer-sale",
              "display_url": "example.com/summer-sale"
            }
          ]
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "destination_customizations": [
            {
              "url": "https://www.example.com/winter-sale",
              "display_url": "example.com/winter-sale"
            }
          ]
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Add placement customizations

You can exclude specific media assets from specific placements using `placement_customizations` on each image or video.

Each placement customization requires:

- `publisher_platform` — the platform to customize. Valid values: `facebook`, `instagram`, `audience_network`, `messenger`, `whatsapp`, `threads`.
- `placement_exclusions` — an array of placement positions to exclude for that platform (for example, `"right_hand_column"`, `"story"`, `"reels"`).

Placement exclusion positions must be valid for the specified publisher platform. See [Placement Targeting](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/placement-targeting) for valid platforms and positions.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Placement Customized Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "placement_customizations": [
            {
              "publisher_platform": "facebook",
              "placement_exclusions": ["right_hand_column"]
            },
            {
              "publisher_platform": "instagram",
              "placement_exclusions": ["story", "reels"]
            }
          ]
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Add image crop customizations

You can set manual crop coordinates per image for specific aspect ratios using `image_crops`. See [Image Crops](https://developers.facebook.com/documentation/ads-commerce/marketing-api/image-crops) for supported aspect ratios and coordinate formats.

Each crop spec requires:

- `type` — the crop type. Valid values: `manual`, `auto_crop`, `smart_crop`, `super_crop`.
- `crop_spec` — a dictionary where keys are aspect ratios (for example, `"100x100"` for 1:1) and values are arrays of two coordinate points representing the top-left `[x, y]` and bottom-right `[x, y]` of the crop rectangle.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Cropped Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "image_crops": [
            {
              "type": "manual",
              "crop_spec": {
                "100x100": [[316, 0], [1472, 1156]],
                "191x100": [[0, 100], [1920, 1100]]
              }
            }
          ]
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "image_crops": [
            {
              "type": "manual",
              "crop_spec": {
                "100x100": [[0, 0], [1080, 1080]]
              }
            }
          ]
        }
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Create a multi-media ad with combined customizations

You can combine all customization types — text, placement, destination, and crops — on each media asset within a single ad. This example shows a mixed media ad (image + video) with all customizations applied.

### Example request

```
curl -X POST "https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/ads" \
  -F 'name=My Fully Customized Multi-Media Ad' \
  -F 'adset_id=<AD_SET_ID>' \
  -F 'status=PAUSED' \
  -F 'creative={
    "object_story_spec": {
      "page_id": "<PAGE_ID>",
      "link_data": {
        "link": "https://www.example.com",
        "image_hash": "<IMAGE_HASH_1>"
      }
    },
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "text_customizations": {
            "titles": [{"text": "Summer Collection Now Live"}],
            "bodies": [{"text": "Shop our latest summer styles"}],
            "descriptions": [{"text": "Free shipping on orders over $50"}]
          },
          "destination_customizations": [
            {
              "url": "https://www.example.com/summer",
              "display_url": "example.com/summer"
            }
          ],
          "placement_customizations": [
            {
              "publisher_platform": "facebook",
              "placement_exclusions": ["right_hand_column"]
            }
          ],
          "image_crops": [
            {
              "type": "manual",
              "crop_spec": {
                "100x100": [[316, 0], [1472, 1156]]
              }
            }
          ]
        }
      ],
      "videos": [
        {
          "video_id": "<VIDEO_ID_1>",
          "original_video_id": "<VIDEO_ID_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "thumbnail_source": "generated_default",
          "thumbnail_url": "https://example.com/thumbnail.jpg",
          "text_customizations": {
            "titles": [{"text": "Watch Our Latest Video"}],
            "bodies": [{"text": "See what is new this season"}]
          },
          "destination_customizations": [
            {
              "url": "https://www.example.com/video-landing",
              "display_url": "example.com/video-landing"
            }
          ],
          "placement_customizations": [
            {
              "publisher_platform": "instagram",
              "placement_exclusions": ["story"]
            }
          ]
        }
      ],
      "titles": [
        {"text": "Global Headline 1"},
        {"text": "Global Headline 2"}
      ],
      "bodies": [
        {"text": "Global primary text 1"},
        {"text": "Global primary text 2"}
      ],
      "descriptions": [
        {"text": "Global description"}
      ]
    }
  }' \
  -F 'access_token=<ACCESS_TOKEN>'
```

On success, your app receives a JSON response with the ad ID.

```json
{
  "id": "<AD_ID>"
}
```

## Read a multi-media ad

To read the multi-media configuration of an ad, send a `GET` request to the `/<AD_ID>` endpoint with `creative{media_sourcing_spec}` in the `fields` parameter.

### Example request

```
curl -G \
  -d 'fields=creative{media_sourcing_spec}' \
  -d 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v25.0/<AD_ID>/
```

### Response

```json
{
  "creative": {
    "media_sourcing_spec": {
      "images": [
        {
          "hash": "<IMAGE_HASH_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "text_customizations": {
            "titles": [{"text": "Summer Collection Now Live"}],
            "bodies": [{"text": "Shop our latest summer styles"}],
            "descriptions": [{"text": "Free shipping on orders over $50"}]
          },
          "destination_customizations": [
            {
              "url": "https://www.example.com/summer",
              "display_url": "example.com/summer"
            }
          ],
          "placement_customizations": [
            {
              "publisher_platform": "facebook",
              "placement_exclusions": ["right_hand_column"]
            }
          ],
          "image_crops": [
            {
              "type": "manual",
              "crop_spec": {
                "100x100": [[316, 0], [1472, 1156]]
              }
            }
          ]
        },
        {
          "hash": "<IMAGE_HASH_2>",
          "source": "multi_media",
          "opt_in_status": "opt_in"
        }
      ],
      "videos": [
        {
          "video_id": "<VIDEO_ID_1>",
          "original_video_id": "<VIDEO_ID_1>",
          "source": "multi_media",
          "opt_in_status": "opt_in",
          "thumbnail_source": "generated_default",
          "thumbnail_url": "https://example.com/thumbnail.jpg",
          "text_customizations": {
            "titles": [{"text": "Watch Our Latest Video"}],
            "bodies": [{"text": "See what is new this season"}]
          }
        }
      ],
      "titles": [
        {"text": "Global Headline 1"},
        {"text": "Global Headline 2"}
      ],
      "bodies": [
        {"text": "Global primary text 1"},
        {"text": "Global primary text 2"}
      ],
      "descriptions": [
        {"text": "Global description"}
      ]
    }
  },
  "id": "<AD_ID>"
}
```

## See also

- [Ad Creative](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative)
- [Ad Group](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup)
- [Ad Creative Object Story Spec](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-creative-object-story-spec)
