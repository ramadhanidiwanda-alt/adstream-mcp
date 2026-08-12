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
| `objectId` | none — filtered client side |

Meta documents no object filter on the account activities edge, and the `activities` edge does not exist on the campaign or ad nodes, so `objectId` is applied to the fetched rows and the response carries an `OBJECT_ID_FILTERED_CLIENT_SIDE` warning telling the caller to keep paging when a page comes back empty.

`includeDetails` defaults to false and controls only `changes`, which parses Meta's JSON-encoded `extra_data` (both the flat `{old_value,new_value}` shape and the nested per-field map). Raw activity payloads stay behind the existing `includeRaw` flag, so nothing raw is returned by default.

## Errors and Compatibility

Unsupported providers continue to return `NOT_IMPLEMENTED`. Invalid categories and timestamps are rejected at the MCP schema boundary. Existing callers that use `since`, `until`, or `params.limit`/`params.cursor` retain their behavior.

## Tests

Adapter tests assert documented request forwarding, application/actor normalization, both `extra_data` shapes, detail opt-in, client-side `objectId` filtering, and legacy paging. MCP schema tests assert the new public inputs and the Meta category enum.

## References

- [Ad Account Activities](https://developers.facebook.com/docs/marketing-api/reference/ad-account/activities/)
- [Ad Activity node fields](https://developers.facebook.com/docs/marketing-api/reference/ad-activity/) — `actor_id`, `actor_name`, `application_id`, `application_name`, `extra_data` (string)
- [Ad Set Activities parameters](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/activities/) — documented `category`, `uid`, `since`, `until`, `limit`, `after`
