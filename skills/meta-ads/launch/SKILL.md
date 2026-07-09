---
name: meta-ads-launch
description: Safely draft and launch Meta Ads ecommerce sales campaigns. Use when the user wants to create, set up, launch, or build a Meta/Facebook/Instagram sales campaign end-to-end.
argument-hint: "<product/offer and ecommerce launch goal>"
---

# Meta Ads — Safe Ecommerce Launch

This skill creates a safe ecommerce sales launch plan and, when supported by the MCP server, drafts a PAUSED Meta campaign bundle: campaign, ad set, creative, and ad.

## Setup

Follow `../shared/preamble.md` first for MCP detection, config resolution, account selection, and write-safety workflow.

## Hard Safety Rules

- Never execute on the first message. Always collect launch inputs, run dry-run preview, then ask for explicit confirmation.
- Default every created Meta entity to `PAUSED`.
- Use `OUTCOME_SALES`, `OFFSITE_CONVERSIONS`, `IMPRESSIONS`, and `PURCHASE` for the MVP unless the user explicitly asks for a different ecommerce event.
- Do not invent business claims, discounts, targeting restrictions, compliance categories, page IDs, pixel IDs, image hashes, or landing URLs.
- If the offer may fall under credit, employment, housing, social issues, elections, or politics, require the correct `specialAdCategories` instead of defaulting to `[]`.
- Never expose access tokens, provider tokens, connection keys, or authorization headers.

## Required Inputs

Ask one question at a time until all required fields are known:

1. Product or offer being promoted
2. Destination URL
3. Meta Page ID
4. Pixel ID and confirmation that Purchase event is installed
5. Daily budget in account minor units or clear currency amount to convert manually
6. Target country/countries
7. Creative asset — can be:
   - An uploaded Meta `imageHash` or `videoId` (existing)
   - A **local file path** (`imageFilePath` or `videoFilePath`) — the tool auto-uploads before creating the creative
8. Primary text and headline
9. Special ad category applicability

## Launch Modes

| Mode | Allowed behavior |
|------|------------------|
| `draft_only` | Prepare structure and copy, no tool call |
| `dry_run_launch` | Call individual create tools with `dryRun: true` or use `ads_create_ecommerce_campaign_bundle` with `dryRun: true` |
| `execute_after_confirmation` | Execute the confirmed tools with `dryRun: false` and `confirmed: true` only after the user approves the dry-run preview |

## Launch Paths

### Path A — Bundle Tool (Quickest)

Use `ads_create_ecommerce_campaign_bundle` when the user has all inputs ready. This creates campaign + ad set + creative + ad in one call:

1. Dry-run with `dryRun: true`
2. Show the full preview
3. Execute with `dryRun: false, confirmed: true`

### Path B — Individual Tools (For Custom Setups)

When you need fine-grained control (e.g., reuse an existing creative, use a specific ad set):

1. `ads_create_campaign` — create campaign (PAUSED)
2. `ads_create_adset` — create ad set under the campaign (PAUSED). Pre-flight checks will validate CBO/bid strategy against the campaign.
3. If using a local file: `ads_upload_image` or `ads_upload_video` — upload media first
4. `ads_create_adcreative` — create creative using uploaded hash/video ID
5. `ads_create_ad` — link ad set and creative
6. Show summary of all created entities
7. User can later activate by setting status to ACTIVE via update tools

**Pre-flight reminder:** When creating an ad set, the tool will automatically check the parent campaign's bid strategy. If the campaign uses `COST_CAP` or `LOWEST_COST_WITH_BID_CAP`, you must provide `bidAmount` (in cents). Example: `bidAmount: 500000` for Rp5.000.

## Dry-Run Checklist

Before execution, show:

- Campaign name, objective, buying type, status, and special ad categories
- Ad set budget, optimization goal, billing event, pixel, event, geo targeting, and status
- Creative page, URL, CTA, primary text, headline, description, and asset reference
- Ad name and status
- Clear warning that the result creates PAUSED entities only

## Confirmation Wording

Require a separate confirmation after preview, for example:

```text
Saya approve untuk membuat campaign bundle PAUSED ini di account <accountId>.
```

If the confirmation is vague, ask again. Execute only the exact previewed bundle.

## Creative-to-Campaign Workflow (Local File)

When the user has a local creative file (image/video) instead of a pre-uploaded hash:

**Step 1 — Upload creative (if file path is provided)**

Use `ads_upload_image` or `ads_upload_video`:

```text
- Image: ads_upload_image with filePath="/path/to/image.jpg"
- Video: ads_upload_video with filePath="/path/to/video.mp4"
```

Supported formats:
- Images: `.jpg`, `.jpeg`, `.png` (max 30 MB)
- Videos: `.mp4`, `.mov`, `.avi`, `.wmv` (max 1 GB)

**Step 2 — Use filePath directly in bundle creation**

Instead of uploading separately, you can pass `imageFilePath` or `videoFilePath` directly to `ads_create_ecommerce_campaign_bundle` — the tool will auto-upload before creating the creative.

**Step 3 — Verify**

After execution, confirm the `image_hash` or `video_id` was returned and the campaign bundle was created with PAUSED status.

**Local vs Remote MCP:**
- **Local (stdio):** File path refers to the machine running the MCP server (your laptop).
- **Remote (HTTP/SSE):** File path refers to the server machine. Place files in `/data/uploads/` directory (mounted volume).
