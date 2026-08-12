# Change History Filters Design

## Goal

Make the canonical `ads_get_change_history` tool useful for investigating a specific Meta campaign, ad set, ad, or creative, including who changed it and through which application.

## Scope

Keep one canonical, read-only tool. Add optional `objectId`, `eventCategory`, `userId`, `startTime`, `endTime`, `limit`, `cursor`, and `includeDetails` inputs. Preserve the existing `since`, `until`, and `params` compatibility path.

## Design

The Meta adapter continues to call `GET /act_{accountId}/activities` and normalizes each activity into the existing change-history envelope. Every row retains snake_case fields and gains camelCase aliases for the public API, application identity, and optional structured `changes` derived from Meta `extra_data`.

Public inputs map onto the parameters Meta actually documents for the activities edge (`since`, `until`, `category`, `uid`, `limit`, `after`):

| Public input | Meta parameter |
| --- | --- |
| `startTime` / `since` | `since` |
| `endTime` / `until` | `until` |
| `eventCategory` | `category` (Meta enum, upper case) |
| `userId` | `uid` |
| `limit` | `limit` |
| `cursor` | `after` |
| `objectId` | ad set edge when available, otherwise a filtered account scan |
| `maxScanPages` | none — bounds the fallback scan |

`objectId` is routed by capability rather than by declared object type, because an ID alone does not reveal what it points at:

1. Try `GET /{objectId}/activities`. Ad sets have this edge and Meta filters there server side, so one request answers the question.
2. Meta rejects the edge on every other object type with `(#100) Tried accessing nonexisting field (activities)`. That specific rejection — and only that one — falls back to scanning the account feed and filtering locally. Other errors propagate untouched.

The fallback scan pages automatically so a caller does not have to. Page size is 500 because Meta charges far less per row for large pages (500 rows in ~3.8s versus ~10s for five 100-row pages), and `maxScanPages` (default 2, max 25) bounds one call at roughly seven seconds. The response reports `OBJECT_ID_FILTERED_CLIENT_SIDE` with the number of pages scanned, adds `CHANGE_HISTORY_SCAN_INCOMPLETE` when the cap was reached before satisfying `limit`, and returns the cursor to continue from.

Verified live against `act_1417353822551653` on v25.0 (read-only), because the docs page for the account edge claims it takes no parameters at all:

- `category` **is** honored server side (20 rows unfiltered vs 4 for `BUDGET`), so the documented enum is passed through.
- `object_id` and `add_children` are **ignored** — the same 20 rows come back — which is why `objectId` must be filtered client side.
- `/{adset_id}/activities` **works** and returns only that ad set's rows, and honors `category` too. `/{campaign_id}/activities` and `/{ad_id}/activities` both fail with `(#100) Tried accessing nonexisting field (activities)`, matching the node reference which lists the edge on ad sets only.
- Without `since`/`until` Meta returns only about one week (20 rows here). A year-wide range returned 2500 rows across 25 pages without exhausting, reaching back only to 12 May 2026 — history is deep, but it only arrives through paging.
- `extra_data` arrives as a JSON string using the flat `{old_value,new_value}` shape, with values already localized by Meta (`"Aktif"` / `"Tidak aktif"`), and omits `old_value` on creation-style events such as `ad_account_billing_charge`.

`includeDetails` defaults to false and controls only `changes`, which parses Meta's JSON-encoded `extra_data` (both the flat `{old_value,new_value}` shape and the nested per-field map). Raw activity payloads stay behind the existing `includeRaw` flag, so nothing raw is returned by default.

## Errors and Compatibility

Unsupported providers continue to return `NOT_IMPLEMENTED`. Invalid categories and timestamps are rejected at the MCP schema boundary. Existing callers that use `since`, `until`, or `params.limit`/`params.cursor` retain their behavior.

## Tests

Adapter tests assert documented request forwarding, application/actor normalization, both `extra_data` shapes, detail opt-in, client-side `objectId` filtering, and legacy paging. MCP schema tests assert the new public inputs and the Meta category enum.

## References

- [Ad Account Activities](https://developers.facebook.com/docs/marketing-api/reference/ad-account/activities/)
- [Ad Activity node fields](https://developers.facebook.com/docs/marketing-api/reference/ad-activity/) — `actor_id`, `actor_name`, `application_id`, `application_name`, `extra_data` (string)
- [Ad Set Activities parameters](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/activities/) — documented `category`, `uid`, `since`, `until`, `limit`, `after`
