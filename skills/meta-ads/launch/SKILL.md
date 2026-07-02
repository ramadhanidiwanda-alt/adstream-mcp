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
7. Creative asset reference, currently an uploaded Meta `imageHash`
8. Primary text and headline
9. Special ad category applicability

## Launch Modes

| Mode | Allowed behavior |
|---|---|
| `draft_only` | Prepare structure and copy, no tool call |
| `dry_run_launch` | Call `ads_create_ecommerce_campaign_bundle` with `dryRun: true` |
| `execute_after_confirmation` | Call the same tool with `dryRun: false` and `confirmed: true` only after the user approves the dry-run preview |

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
