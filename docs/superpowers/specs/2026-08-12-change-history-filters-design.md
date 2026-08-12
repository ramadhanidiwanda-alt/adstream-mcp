# Change History Filters Design

## Goal

Make the canonical `ads_get_change_history` tool useful for investigating a specific Meta campaign, ad set, ad, or creative, including who changed it and through which application.

## Scope

Keep one canonical, read-only tool. Add optional `objectId`, `eventCategory`, `userId`, `startTime`, `endTime`, `limit`, `cursor`, and `includeDetails` inputs. Preserve the existing `since`, `until`, and `params` compatibility path.

## Design

The Meta adapter continues to call `GET /act_{accountId}/activities`. It passes the explicit filters supported by the public schema and normalizes each activity into the existing change-history envelope. Every row retains snake_case fields and gains camelCase aliases for the public API, application identity, and optional structured `changes` derived from Meta `extra_data`.

`includeDetails` defaults to false. When false, no raw Meta data or `extra_data` is returned. When true, `raw` remains available for compatibility and `changes` exposes safe old/new values when Meta supplies them.

## Errors and Compatibility

Unsupported providers continue to return `NOT_IMPLEMENTED`. Invalid categories and timestamps are rejected at the MCP schema boundary. Existing callers that use `since`, `until`, or `params.limit`/`params.cursor` retain their behavior.

## Tests

Adapter tests will assert request forwarding, application/actor normalization, optional detail handling, and paging. MCP schema tests will assert the new public inputs and their descriptions.
