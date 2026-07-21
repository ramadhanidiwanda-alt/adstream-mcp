# Arsitektur adstream-mcp

> Deep dive tentang desain dan struktur project

**Versi:** 2.0 | **Terakhir Diupdate:** 2026-07-21

## 🏗️ Struktur Project

```
adstream-mcp/
├── src/                    # TypeScript source
│   ├── index.ts           # Entry point + MCP server bootstrap
│   ├── types.ts           # Shared TypeScript types & interfaces
│   ├── config.ts          # Environment config loader
│   ├── broker/            # AdsBroker — MCP tool definitions, provider routing, types
│   │   ├── AdsBroker.ts          # Core broker (orchestrates provider + tools)
│   │   ├── mcpTools.ts           # MCP tool registration
│   │   ├── providerRegistry.ts   # Provider adapter registration
│   │   ├── factory.ts            # Factory functions
│   │   ├── contentMatrix.ts      # Content matrix engine
│   │   ├── reportEngine.ts       # Report generation engine
│   │   ├── commerceReportEngine.ts
│   │   ├── commerceTools.ts
│   │   ├── cuanInsight.ts
│   │   ├── cuanInsightClient.ts
│   │   ├── credentials.ts
│   │   ├── remoteAuth.ts
│   │   ├── config.ts
│   │   └── types.ts
│   ├── providers/          # Provider adapters (normalized interface)
│   │   ├── meta/           # Meta Ads adapter
│   │   │   ├── MetaAdsAdapter.ts
│   │   │   ├── normalizer.ts
│   │   │   ├── creativeCompliance.ts
│   │   │   ├── creativeFormatCompatibility.ts
│   │   │   ├── buildCreativeFormatPayload.ts
│   │   │   └── metaCreativeErrorGuidance.ts
│   │   ├── tiktok/         # TikTok Ads adapter
│   │   │   ├── TikTokAdsAdapter.ts
│   │   │   ├── normalizer.ts
│   │   │   └── gmvMaxNormalizer.ts
│   │   └── google/         # Google Ads adapter
│   │       ├── GoogleAdsAdapter.ts
│   │       └── normalizer.ts
│   ├── tools/              # Individual tool implementations (read + write)
│   │   ├── (read tools)    # getPerformance, getCreatives, getCapabilities, dsb.
│   │   ├── (write tools)   # createCampaign, createAdSet, createAd, update*, pause*, resume*, dsb.
│   │   └── tiktok/         # TikTok-specific write tools
│   ├── mcp/                # MCP server (transport, HTTP, auth)
│   │   ├── index.ts
│   │   ├── createServer.ts
│   │   ├── http.ts
│   │   ├── authorizeForm.ts
│   │   ├── oauthStore.ts
│   │   └── oauthStoreSupabase.ts
│   ├── analysis/           # Business logic (legacy — akan dipindah bertahap)
│   ├── rules/              # Rule engine templates (legacy — akan dipindah bertahap)
│   └── utils/              # Helper functions
├── skills/                 # AI skills (markdown)
│   └── meta-ads/
│       ├── audit/         # Performance auditing
│       ├── manage/        # Campaign management
│       └── shared/        # Shared context
├── tests/                 # Test files
├── __test_real__/         # Real API integration tests
└── docs/                  # Documentation (folder ini)
```

## 🧩 Layer Architecture

### Layer 1: Broker (`src/broker/`)

**Tanggung jawab:**
- **AdsBroker** — Central orchestrator yang meneruskan request dari MCP tools ke provider adapter yang sesuai
- **MCP Tools** — Registrasi semua tool definitions (read + write) untuk MCP protocol
- **Provider Registry** — Mapping provider → adapter (Meta, TikTok, Google)
- **Report Engine** — Normalisasi data lintas provider untuk report generik
- **Content Matrix** — Ad-hoc performance grouping

**Key classes:**
- `AdsBroker` — Entry point broker, delegasi ke provider berdasarkan `provider` parameter
- `MCPTools` — Mendaftarkan seluruh tool ke MCP server
- `ProviderRegistry` — Menyimpan dan lookup adapter per provider

**Prinsip:**
- Provider-agnostic interface
- Satu broker untuk semua MCP tools
- Normalisasi data dilakukan di adapter, bukan di broker

### Layer 2: Providers (`src/providers/`)

**Tanggung jawab:**
- Implementasi adapter untuk masing-masing platform (Meta, TikTok, Google)
- Normalisasi response API ke format internal yang seragam
- Handle auth, rate limit, dan error spesifik platform

**Adapter saat ini:**
| Provider | Adapter | Status |
|----------|---------|--------|
| Meta | `MetaAdsAdapter` | ✅ Mature |
| TikTok | `TikTokAdsAdapter` | ✅ Active |
| Google | `GoogleAdsAdapter` | 🚧 Early |

**Pattern adapter:**
```typescript
export interface AdsProviderAdapter {
  getPerformance(
    params: PerformanceParams
  ): Promise<PerformanceResponse>;
  getCreatives(params: CreativeParams): Promise<CreativeResponse>;
  // ... methods lain
}
```

### Layer 3: Tools (`src/tools/`)

**Tanggung jawab:**
- Implementasi individual tool functions
- Parameter validation & transformation
- Baik read tools (query data) maupun write tools (mutasi campaign)

**Kategori tools:**
- **Read tools** — `getPerformance`, `getCreatives`, `getCapabilities`, `getChangeHistory`, dsb.
- **Write tools** — `createCampaign`, `createAdSet`, `createAd`, `updateCampaign`, `pauseAd`, `resumeAd`, `deleteAd`, `renameCampaign`, `updateCampaignBudget`, `updateAdSet`, `updateAd`, `uploadImage`, `uploadVideo`, dsb.
- **TikTok-specific** — `createTikTokCampaign`, `createTikTokAdGroup`, `createTikTokAd`, `createTikTokGmvMax`, `createTikTokSmartPlus`

**Pattern:**
```typescript
export async function getPerformance(
  broker: AdsBroker,
  params: PerformanceParams
): Promise<PerformanceResponse> {
  return broker.execute('getPerformance', params);
}
```

### Layer 4: MCP Server (`src/mcp/`)

**Tanggung jawab:**
- Setup HTTP/SSE transport
- OAuth flow (authorize + callback)
- Server lifecycle management

**Komponen:**
- `createServer.ts` — Factory untuk MCP server instance
- `http.ts` — HTTP transport layer
- `authorizeForm.ts` — OAuth authorization form
- `oauthStore.ts` / `oauthStoreSupabase.ts` — Token storage

### Layer 5: AI Skills (`skills/meta-ads/`)

**Tanggung jawab:**
- Natural language interface
- Business context untuk agents
- Workflow guidance

**2 Skills saat ini:**
1. `audit/SKILL.md` — Performance auditing workflow
2. `manage/SKILL.md` — Campaign management workflow

**Shared context:**
- `preamble.md` — Introduction dan context
- `meta-math.md` — Metric calculations
- `references.md` — Common patterns

## 🔄 Data Flow

```
User/Agent
    ↓
AI Skills (natural language)
    ↓
MCP Tools (tool definitions)
    ↓
AdsBroker (orchestrator)
    ↓
Provider Adapter (normalized call)
    ↓
Provider API (Meta/TikTok/Google)
    ↓
Provider Adapter (normalized response)
    ↓
AdsBroker → Tools
    ↓
User/Agent (insights)
```

## 🎯 Design Decisions

### Mengapa TypeScript?

- Type safety untuk API responses
- Better IDE support
- Easier refactoring
- Self-documenting code

### Mengapa Provider Adapter Pattern?

- Isolasi perbedaan API tiap platform
- Normalisasi data di satu tempat
- Mudah menambah provider baru
- Testing independen per platform

### Mengapa Single Broker Architecture?

- Satu entry point untuk semua MCP tools
- Provider routing transparan
- Consistent error handling
- Future-proof untuk multi-provider reporting

### Mengapa Separate Skills Layer?

- Decouple natural language dari code
- Easier untuk non-technical contributors
- AI agents butuh business context
- Markdown lebih mudah di-maintain

## 🔐 Security Architecture

### Token Management

```
Environment Variable (.env)
    ↓
Config Loader (config.ts)
    ↓
Provider Adapter (private field)
    ↓
URL/Auth Header (never logged)
    ↓
Provider API
```

**Prinsip:**
- Token tidak pernah di-log
- Token tidak pernah di-return
- Token tidak pernah di-expose di error messages
- OAuth tokens disimpan di Supabase (production) atau file (development)

### Permission Model

**Current:**
- Meta: `ads_read` + `ads_management` untuk write tools
- TikTok: `STANDARD` + `GMV_MAX` untuk commerce
- Google: Standard OAuth scopes

## 📊 Performance Considerations

### API Rate Limits

Setiap provider punya rate limit sendiri:
- **Meta API:** 200 calls/hour/user, 4800 calls/hour/app
- **TikTok API:** 100 calls/second per advertiser
- **Google API:** Berdasarkan quota project

**Strategy:**
- No automatic retry (caller decides)
- Batch requests when possible
- Provider adapter handle rate limit headers

### Memory Usage

- Stream large responses (future)
- Limit default page size (100 items)
- No in-memory caching (stateless)

### Type Safety Overhead

- Compile-time only
- Zero runtime overhead
- Better DX worth the build step

## 🧪 Testing Strategy

### Unit Tests

- Business logic di `src/analysis/`
- Rule engine di `src/rules/`
- Utilities di `src/utils/`
- Provider normalizer

### Integration Tests

- Mock provider adapter
- Test tools dengan fake responses
- Test broker routing
- No real API calls (kecuali `__test_real__/`)

### E2E Tests (`__test_real__/`)

- Real API calls ke Meta/TikTok
- Sandbox/specific ad account
- Manual trigger (not in CI)

## 🚀 Extensibility

### Menambah Provider Baru

1. Buat folder di `src/providers/newProvider/`
2. Implement `AdsProviderAdapter` interface
3. Buat normalizer untuk response API
4. Daftarkan di `providerRegistry.ts`
5. Tambahkan test

### Menambah Tool Baru

1. Buat file di `src/tools/newTool.ts`
2. Gunakan `AdsBroker` untuk akses provider
3. Daftarkan tool di `mcpTools.ts`
4. Export dari `src/index.ts`
5. Tambahkan test

### Menambah AI Skill

1. Buat folder di `skills/meta-ads/newSkill/`
2. Buat `SKILL.md` dengan workflow
3. Reference shared context
4. Test dengan real agent

### Menambah Adapter Method

1. Tambahkan method di `AdsProviderAdapter` interface
2. Implementasi di tiap provider adapter
3. Tambahkan tool wrapper di `src/tools/`
4. Daftarkan di MCP tools

## 🔮 Future Architecture (v2.0+)

### Planned Additions

1. **Multi-Provider Reporting** (v2.1)
   - Cross-platform performance comparison
   - Unified metrics normalization
   - Combined dashboards

2. **Bulk Operations** (v2.2)
   - Batch campaign creation/update
   - Bulk pause/resume
   - CSV import/export

3. **OAuth Refresh** (v2.3)
   - Automatic token refresh
   - Multi-user support
   - Secure token storage via Supabase

4. **AI-Driven Optimization** (v3.0)
   - Automated bid adjustment
   - Smart budget allocation
   - Anomaly detection & alerting

---

**Kembali ke:** [AGENTS.md](../AGENTS.md)
