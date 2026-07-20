# Meta UI Ad Clone Notes

## Context

This note documents the July 2026 Meena Beauty CTWA debugging case where an ad built in Ads Manager preserved:

- a visible WhatsApp business phone selection at ad level;
- multiple media creatives customized by placement;
- Click-to-WhatsApp delivery under the same ad set.

The equivalent ad created through the current API creative flow did not show the WhatsApp phone selector in Ads Manager, even though the ad set had `promoted_object.whatsapp_phone_number`.

## What Was Observed

Working UI source ad:

- Ad ID: `120251882117740415`
- Creative ID: `1024837329955126`
- Ad set ID: `120251877326190415`

Pure clone test:

- Source ad ID: `120251882117740415`
- Clone ad ID: `120251883871090415`
- Result in Ads Manager: WhatsApp phone and placement customizations were preserved.

Clone with creative override:

- Source ad ID: `120251882117740415`
- Override creative ID: `1590272759360414`
- Clone ad ID: `120251883857020415`
- Result in Ads Manager: WhatsApp phone/placement UI state was not preserved.

API-created creative/ad tests:

- Creating a fresh creative and linking it to the ad set did not reproduce the Ads Manager UI phone selector.
- Sending read-back-looking fields such as `app_destination`, `DOF_MESSAGING_DESTINATION`, or `call_to_actions` directly during create was rejected or routed into a Dynamic Creative-style path.

## Why This Happens

The preserved behavior appears to live in Ads Manager composer state attached to the ad clone flow, not in ordinary writable `AdCreative.object_story_spec` alone.

Meta's public Ad Creative reference documents `platform_customizations` for replacing media on specific placements, and `page_welcome_message` for CTM ads. It also exposes fields such as `media_sourcing_spec` and `creative_sourcing_spec`, but in this account/app those fields can require additional capability and are not always readable or writable through the standard tool path.

Important implication: if a caller clones an Ads Manager-created ad and also passes a new `creative`, Meta treats it as a new API-defined ad creative attachment and drops the UI-only state.

## Supported Tool Path

Use `ads_clone_ui_ad` for this specific class of Meta ad:

- source ad was created in Ads Manager;
- source ad already has the desired WhatsApp phone selector and placement customization;
- the goal is to preserve that UI-only state in a PAUSED duplicate;
- caller does not need to replace the creative during the clone call.

The tool intentionally does not accept `creativeId` from callers. During
execution it reads `creative{id}` from the source ad, then calls the ordinary ad
creation endpoint (`POST /act_{accountId}/ads`) with both `source_ad_id` and the
resolved `creative_id`. Sending only `source_ad_id` is insufficient because
Meta rejects it with `(#100) The parameter creative is required`.

Session-log reconstruction confirmed that the original successful CTWA clone
used this exact create-ad payload, not `POST /{sourceAdId}/copies`:

```json
{
  "name": "POSTER BENAR - PURE CLONE UI FIELD TEST (PAUSED)",
  "adset_id": "120251877326190415",
  "status": "PAUSED",
  "source_ad_id": "120251882117740415",
  "creative": { "creative_id": "1024837329955126" }
}
```

The Ad Copies edge produced object-specific capability and schedule-validation
errors during later tests, so it is no longer the implementation path for
`ads_clone_ui_ad`.

Further Meena duplicate probes showed the source objects belong to ad account
`2048143749352525` (`Ramadhani Mataru (Read-Only)`), not the writable
`157465417761872` account used in earlier calls. Read/mutate-by-object-ID calls
can still partially work, but create/copy operations that require the owning ad
account fail:

- ad set clone under `act_157465417761872`: campaign/account mismatch;
- ad set clone under `act_2048143749352525`: no write permission for the ad account;
- campaign copy probe under `2048143749352525`: blocked mutation for read-only ad account;
- ad copy under `act_2048143749352525`: copy edge reached but blocked by app capability.

Historical cross-account Ad Copies probes showed source-specific validation
failures:

- account `1417353822551653`: ad copies were blocked because the ad account did
  not have access to the Instagram actor used by the source creative;
- account `2326988574277142`: ad copies were blocked because the source creative
  used deprecated standard-enhancement setup that Meta now requires to be
  expressed as individual creative features.

Live CTWA replay validation on 2026-07-20:

- account ID: `2086409658377471`
- source ad ID: `120251883871090415`
- destination ad set ID: `120251877326190415`
- resolved creative ID: `1024837329955126`
- cloned ad ID: `120251889532360415`
- result: clone created successfully as `PAUSED`; read-back showed the expected
  campaign, ad set, creative, and pending-review state

Required inputs:

- `accountId`
- `sourceAdId`
- `adSetId`
- `name`

Default behavior:

- `dryRun=true`
- `status=PAUSED`
- requires `confirmed=true` when `dryRun=false`

## Current Limitation

This is not a from-scratch builder for the Ads Manager UI composer state. It is
a guarded source-backed creation path that reuses the source creative and
source-ad relationship.

To support from-scratch creation later, first find a Meta-supported write payload that reproduces the UI-only WhatsApp phone selector and per-placement media setup without relying on `source_ad_id`. Do not assume read-back fields are valid create fields; the July 2026 tests showed several of them are not accepted as create payload.
