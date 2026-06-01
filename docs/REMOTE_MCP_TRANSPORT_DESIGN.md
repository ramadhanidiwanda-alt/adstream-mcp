# Remote MCP Transport Design

## 1. Summary

This document defines the proposed remote MCP transport design for the Ads MCP Broker.

The goal is to let Cuan Insight users connect an MCP-compatible AI client to a hosted remote MCP URL while preserving the current local/self-hosted workflow.

This is a design contract only. It does not implement a production remote MCP server.

## 2. Transport Recommendation

### Remote mode

Use MCP Streamable HTTP for remote hosted MCP connections.

Recommended remote client configuration:

```text
url: <remote-mcp-url>
transport: streamable-http
headers:
  Authorization: Bearer <remote-mcp-token>
  X-Cuan-Workspace-Id: <workspace-id>
```

Why Streamable HTTP:

- It is the preferred MCP transport for remote clients.
- It supports authenticated HTTP headers.
- It avoids requiring a local process on the user's machine.
- It allows Cuan Insight to operate a managed MCP endpoint.
- It keeps remote auth, rate limits, request tracing, and workspace validation at the HTTP boundary.

Legacy HTTP/SSE should only be considered later if a target client requires backward compatibility.

### Local/self-hosted mode

Keep stdio as the default local transport.

Why stdio remains the default locally:

- The current MCP server already runs over stdio.
- Local MCP clients commonly launch local tools as stdio processes.
- Local users can keep using environment variables for credentials.
- No Cuan Insight account is required.
- No remote auth headers are required.

## 3. Remote Flow

1. User signs in to Cuan Insight.
2. User connects Meta Ads and/or TikTok Ads inside Cuan Insight.
3. Cuan Insight stores provider credentials and provider account mappings.
4. Cuan Insight issues a remote MCP token or session credential.
5. User configures an MCP-compatible AI client with `<remote-mcp-url>`.
6. AI client sends an MCP request over Streamable HTTP.
7. Remote MCP transport validates the `Authorization` header.
8. Remote MCP transport resolves request context, including user and workspace identity.
9. Ads MCP Broker receives a tool call with a remote credential resolver.
10. Broker requests scoped read credentials from Cuan Insight through the credential client contract.
11. Cuan Insight validates user, workspace, plan, scopes, and ad account access.
12. Cuan Insight returns short-lived provider credentials for allowed read-only access.
13. Provider adapter calls the official provider API.
14. Broker normalizes the provider response.
15. Broker redacts raw/token-like values.
16. Remote MCP transport returns the MCP tool result to the client.

## 4. Local/Self-Hosted Flow

1. Developer installs and runs the MCP server locally or through Docker.
2. Developer provides provider credentials through environment variables.
3. MCP-compatible AI client launches or connects to the local stdio server.
4. AI client calls an MCP tool.
5. Broker resolves credentials through the environment credential provider.
6. Provider adapter calls the official provider API.
7. Broker normalizes the provider response.
8. Broker redacts raw/token-like values.
9. Local stdio server returns the MCP tool result to the client.

Local mode must remain useful without Cuan Insight and must keep the same read-only constraints.

## 5. Minimal Auth Contract

### Client to remote MCP transport

Remote MCP requests should use HTTP headers.

Required:

```text
Authorization: Bearer <remote-mcp-token>
```

Recommended:

```text
X-Cuan-Workspace-Id: <workspace-id>
X-Request-Id: <request-id>
```

Header semantics:

- `Authorization`: authenticates the remote MCP caller. The broker must never log or return this value.
- `X-Cuan-Workspace-Id`: selects workspace when the remote MCP token is not bound to exactly one workspace.
- `X-Request-Id`: enables trace correlation without exposing secrets.

If a token is bound to one workspace, `X-Cuan-Workspace-Id` may be optional. If a token can access multiple workspaces, `X-Cuan-Workspace-Id` should be required.

### Remote MCP transport to broker

The HTTP transport should build a per-request context and inject it into the remote credential resolver.

Required context:

```ts
interface RemoteMcpRequestContext {
  callerToken: string;
  workspaceId?: string;
  requestId?: string;
}
```

### Broker to Cuan Insight credential resolver

The existing credential contract should stay the boundary for resolving provider credentials.

```ts
interface CuanInsightCredentialResolveRequest {
  provider: 'meta' | 'tiktok';
  accountId?: string;
  workspaceId?: string;
  callerToken?: string;
  requestedScopes?: ReadonlyArray<'read'>;
  params?: Record<string, unknown>;
}
```

Rules:

- `requestedScopes` must be `['read']` in this phase.
- `callerToken` must come from `Authorization` after `Bearer ` parsing.
- `workspaceId` must come from validated request context.
- Provider tokens returned by Cuan Insight must be short-lived.
- Provider tokens must never be stored by the MCP repo.

## 6. Responsibility Split

### Cuan Insight SaaS owns

- User login.
- Workspace membership.
- Plan and billing enforcement.
- Meta Ads OAuth.
- TikTok Ads OAuth.
- Provider token storage.
- Provider account mapping.
- Remote MCP token issuance.
- Remote MCP token revocation.
- Source-of-truth permission checks.
- Usage limits and quota decisions.

### Ads MCP Broker repo owns

- MCP server runtime contract.
- Local stdio entrypoint.
- Future remote transport adapter boundary.
- MCP tool definitions.
- AdsBroker orchestration.
- CredentialResolver abstraction.
- Cuan Insight credential client contract.
- Environment credential provider.
- Provider registry for `meta` and `tiktok` only.
- Provider adapters.
- Normalized metrics schema.
- Read-only policy enforcement.
- Token redaction.
- Safe MCP responses.

The MCP repo must not own user login, OAuth, billing, provider token storage, or Cuan Insight dashboard behavior.

## 7. Validation Rules

### Transport-level validation

- Reject missing `Authorization` header in remote mode.
- Reject malformed bearer token format.
- Require `X-Cuan-Workspace-Id` when token is not workspace-bound.
- Preserve `X-Request-Id` for tracing when present.
- Never log secret-bearing headers.

### Broker-level validation

- Allow only `meta` and `tiktok` providers.
- Reject unknown providers.
- Keep all operations read-only.
- Request only `read` scope from Cuan Insight.
- Reject provider/access mismatches returned by Cuan Insight.
- Reject account mismatch between requested account and returned provider access.
- Reject expired provider credentials.
- Reject missing provider credentials.
- Strip `raw` response fields before returning MCP results.
- Redact token-like values from errors and responses.

### Cuan Insight validation

- Validate remote MCP token.
- Resolve user identity.
- Resolve workspace identity.
- Check user workspace membership.
- Check plan and usage limits.
- Check provider account mapping.
- Check requested provider and account access.
- Return only short-lived read credentials.

## 8. Proposed Files for Later Implementation

These files are proposed for a later implementation phase. They should not be created as part of this design-only phase unless explicitly approved.

```text
mcp-server/src/createServer.ts
mcp-server/src/stdio.ts
mcp-server/src/http.ts
src/broker/remoteAuth.ts
src/broker/remoteTransportTypes.ts
src/broker/remoteCredentialClient.ts
tests/broker/remoteAuth.test.ts
tests/broker/remoteCredentialResolver.test.ts
```

Proposed purpose:

- `mcp-server/src/createServer.ts`: shared MCP server/tool registration independent of transport.
- `mcp-server/src/stdio.ts`: local stdio entrypoint preserving current behavior.
- `mcp-server/src/http.ts`: future Streamable HTTP entrypoint, gated until production-ready.
- `src/broker/remoteAuth.ts`: parse and validate remote auth headers.
- `src/broker/remoteTransportTypes.ts`: shared remote request context types.
- `src/broker/remoteCredentialClient.ts`: future HTTP client implementation for the Cuan Insight credential contract.
- `tests/broker/remoteAuth.test.ts`: header parsing and redaction tests.
- `tests/broker/remoteCredentialResolver.test.ts`: remote resolver contract tests with fake Cuan Insight client.

## 9. Risks

- MCP SDK transport APIs may require an SDK upgrade before Streamable HTTP is implemented.
- Remote MCP client support may differ across clients.
- Workspace resolution can be ambiguous if one token can access multiple workspaces.
- Improper logging could leak `Authorization` or provider credentials.
- Mixing legacy `meta_*` tools with remote broker mode could create inconsistent auth behavior if not separated carefully.
- Rate limiting must be enforced by Cuan Insight or remote transport before provider APIs are called.
- Provider tokens must remain short-lived to reduce blast radius.
- Future write operations require a separate approval workflow and must not reuse this read-only contract without revision.

## 10. Implementation Phases

### Phase 1 — Design contract

- Add this document.
- Add a PRD pointer to this document.
- Make no source code changes.
- Make no transport runtime changes.

### Phase 2 — Server composition refactor

- Extract shared MCP server/tool registration.
- Preserve stdio behavior exactly.
- Add tests proving existing tool list and behavior remain stable.

### Phase 3 — Remote auth contracts

- Add request context types.
- Add header parsing helpers.
- Add redaction tests.
- Use fake tokens only.

### Phase 4 — Remote credential resolver wiring

- Add remote resolver factory.
- Use injected fake Cuan Insight credential client in tests.
- Do not call real Cuan Insight API yet.

### Phase 5 — Non-production Streamable HTTP skeleton

- Add Streamable HTTP entrypoint behind explicit configuration.
- Keep it disabled by default.
- Keep local stdio default.
- Do not deploy as production remote MCP.

### Phase 6 — Production readiness

- Add real Cuan Insight credential API client after SaaS contract exists.
- Add rate limiting and tracing.
- Add operational logging with redaction.
- Add deployment documentation.
- Run compatibility checks with target MCP clients.

## 11. Explicit Non-Goals

- No production remote MCP server in this phase.
- No HTTP server implementation in this phase.
- No changes to `mcp-server/src/index.ts` in this phase.
- No changes to MCP tools in this phase.
- No changes to legacy `meta_*` behavior.
- No changes to `ads_*` behavior.
- No hardcoded Cuan Insight domain.
- No real Cuan Insight API call.
- No OAuth implementation.
- No billing implementation.
- No TikTok real API implementation expansion.
- No write operations.
- No providers beyond `meta` and `tiktok`.
- No tag or release.


## 12. Phase 3 Implementation Status

Phase 3 (Remote auth contracts) has been completed:

- Added `src/broker/remoteAuth.ts` with remote MCP auth helper contracts
- Implemented `parseRemoteMcpAuthHeaders()` for parsing Authorization Bearer tokens
- Implemented `buildCuanInsightCredentialRequestFromRemoteContext()` for building credential requests
- Added comprehensive tests in `tests/broker/remoteAuth.test.ts`
- Exported remote auth helpers from `src/index.ts`

### Remote Auth Contract

The remote auth helper provides:

- `RemoteMcpAuthHeaders` - HTTP header interface for remote MCP requests
- `RemoteMcpRequestContext` - Parsed request context with caller token, workspace ID, and request ID
- `RemoteMcpAuthErrorCode` - Safe error codes for auth failures
- `parseRemoteMcpAuthHeaders()` - Parse and validate Authorization Bearer token and optional headers
- `buildCuanInsightCredentialRequestFromRemoteContext()` - Build Cuan Insight credential resolve request

### Security Rules

- Authorization header is required and must use Bearer scheme
- Caller token is extracted but never logged or included in error messages
- Workspace ID and Request ID are optional
- Provider must be 'meta' or 'tiktok'
- Requested scopes are always ['read'] in this phase

### Next Steps

Phase 4 will add remote credential resolver wiring with injected fake Cuan Insight credential client in tests.

## 13. Phase 5 Implementation Status (Non-Production Skeleton)

Phase 5 (Non-production Streamable HTTP skeleton) has been partially completed:

- Added `mcp-server/src/http.ts` as experimental HTTP/SSE entrypoint
- Added `tests/httpSkeleton.test.ts` with 9 tests for config and security
- HTTP skeleton is disabled by default and requires explicit `ENABLE_EXPERIMENTAL_HTTP_MCP=true`

### SDK Transport Audit Result

**MCP SDK Version:** 0.5.0

**Available Transports:**
- ✅ stdio (production-ready, default)
- ✅ SSE (Server-Sent Events, available but not Streamable HTTP)
- ❌ Streamable HTTP (NOT available in this SDK version)

**Decision:** Use SSE transport as a non-production placeholder until SDK supports Streamable HTTP.

### HTTP Skeleton Characteristics

**Status:** Experimental, non-production, fail-fast by default

**Transport:** SSE (Server-Sent Events) - NOT Streamable HTTP

**Activation:**
- Requires `ENABLE_EXPERIMENTAL_HTTP_MCP=true`
- Without flag, fails fast with clear error message
- Stdio remains the default and recommended transport

**Configuration:**
- `MCP_HTTP_HOST` - Default: `127.0.0.1` (localhost only)
- `MCP_HTTP_PORT` - Default: `3000`
- `MCP_HTTP_ENDPOINT` - Default: `/message`

**Endpoints:**
- `GET /sse` - SSE connection endpoint
- `POST /message?sessionId=<id>` - Message endpoint
- `GET /health` - Health check (returns experimental status)

**Security:**
- Binds to localhost by default (not 0.0.0.0)
- Does not log Authorization headers
- Does not expose tokens in responses
- Read-only operations only
- No production auth/rate limiting/monitoring

**Limitations:**
- Not production-ready
- No real Cuan Insight API integration
- No remote auth header parsing (contract exists but not wired)
- No workspace resolution
- No plan limits enforcement
- Session management is basic (in-memory Map)

### Next Steps

**Before Production:**
1. Upgrade MCP SDK when Streamable HTTP transport is available
2. Wire remote auth helpers (`parseRemoteMcpAuthHeaders`) into HTTP transport
3. Inject Cuan Insight credential client for remote mode
4. Add rate limiting and request tracing
5. Add operational logging with token redaction
6. Add deployment documentation
7. Run compatibility checks with target MCP clients

**Current Recommendation:**
- Use stdio for all production deployments
- HTTP skeleton is for design validation only
- Do not expose HTTP endpoint publicly
- Do not use for real user traffic
