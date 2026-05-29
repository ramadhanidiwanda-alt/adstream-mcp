# Arsitektur meta-ads-agent-skill

> Deep dive tentang desain dan struktur project

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29

## 🏗️ Struktur Project

```
meta-ads-agent-skill/
├── src/                    # TypeScript library
│   ├── index.ts           # Public API surface
│   ├── metaClient.ts      # HTTP client (read-only)
│   ├── config.ts          # Environment config loader
│   ├── types.ts           # Semua TypeScript types
│   ├── tools/             # 6 fungsi read
│   ├── analysis/          # Business logic
│   ├── rules/             # Rule engine (26 templates)
│   └── utils/             # Helper functions
├── skills/                 # AI skills (markdown)
│   └── meta-ads/
│       ├── audit/         # Performance auditing
│       ├── manage/        # Campaign management
│       └── shared/        # Shared context
├── mcp-server/            # MCP wrapper
│   └── src/index.ts
├── tests/                 # Test files
└── docs/                  # Documentation (folder ini)
```

## 🧩 Layer Architecture

### Layer 1: Core Client (`metaClient.ts`)

**Tanggung jawab:**
- HTTP communication dengan Meta Marketing API
- Token management (tidak pernah di-log)
- Error handling (throw `MetaApiError`)
- Rate limiting awareness

**Key methods:**
- `metaGet<T>(path, params)` - GET request dengan type safety

**Prinsip:**
- Read-only by design
- No retry logic (caller decides)
- Type-safe responses

### Layer 2: Tools (`src/tools/`)

**Tanggung jawab:**
- Wrapper functions untuk Meta API endpoints
- Parameter validation
- Response transformation

**6 Tools saat ini:**
1. `getAdAccounts` - List ad accounts
2. `getCampaigns` - List campaigns
3. `getCampaignInsights` - Campaign performance data
4. `getAdsetInsights` - Ad set performance data
5. `getAdsInsights` - Individual ad performance data
6. `generateDailyReport` - Aggregated daily report

**Pattern:**
```typescript
export interface GetXOptions {
  adAccountId: string;
  // ... specific params
}

export async function getX(
  client: MetaClient,
  options: GetXOptions
): Promise<X[]> {
  // Implementation
}
```

### Layer 3: Analysis (`src/analysis/`)

**Tanggung jawab:**
- Business logic untuk performance analysis
- Anomaly detection
- Recommendation generation

**2 Modules saat ini:**
1. `analyzeCampaignPerformance` - Analyze campaign metrics
2. `recommendActions` - Generate actionable recommendations

**Prinsip:**
- Input dari insight types
- Output include disclaimer
- No side effects

### Layer 4: Rules Engine (`src/rules/`)

**Tanggung jawab:**
- Configurable thresholds
- Business-specific rules
- Template management

**26 Rule templates:**
- E-commerce (8 rules)
- Lead generation (7 rules)
- Brand awareness (6 rules)
- General (5 rules)

**Pattern:**
```typescript
export interface Rule {
  id: string;
  name: string;
  category: 'ecommerce' | 'leadgen' | 'brand' | 'general';
  condition: (insight: CampaignInsight) => boolean;
  recommendation: string;
  severity: 'critical' | 'warning' | 'info';
}
```

### Layer 5: AI Skills (`skills/meta-ads/`)

**Tanggung jawab:**
- Natural language interface
- Business context untuk agents
- Workflow guidance

**2 Skills saat ini:**
1. `audit/SKILL.md` - Performance auditing workflow
2. `manage/SKILL.md` - Campaign management workflow

**Shared context:**
- `preamble.md` - Introduction dan context
- `meta-math.md` - Metric calculations
- `references.md` - Common patterns

## 🔄 Data Flow

```
User/Agent
    ↓
AI Skills (natural language)
    ↓
Tools (function calls)
    ↓
MetaClient (HTTP)
    ↓
Meta Marketing API
    ↓
MetaClient (response)
    ↓
Analysis (business logic)
    ↓
Rules Engine (recommendations)
    ↓
User/Agent (insights)
```

## 🎯 Design Decisions

### Mengapa TypeScript?

- Type safety untuk API responses
- Better IDE support
- Easier refactoring
- Self-documenting code

### Mengapa ESM?

- Modern JavaScript standard
- Better tree-shaking
- Native browser support (future)
- Aligns dengan Node.js direction

### Mengapa Read-Only First?

- Safer untuk MVP
- Easier to test
- Lower risk
- Write operations butuh approval workflow (v0.4)

### Mengapa Separate Skills Layer?

- Decouple natural language dari code
- Easier untuk non-technical contributors
- AI agents butuh business context
- Markdown lebih mudah di-maintain

### Mengapa Rule Engine?

- Configurable tanpa code changes
- Business users bisa customize
- Easier A/B testing
- Scalable untuk multiple verticals

## 🔐 Security Architecture

### Token Management

```
Environment Variable (.env)
    ↓
Config Loader (config.ts)
    ↓
MetaClient (private field)
    ↓
URL Query Param (never logged)
    ↓
Meta API
```

**Prinsip:**
- Token tidak pernah di-log
- Token tidak pernah di-return
- Token tidak pernah di-expose di error messages

### Read-Only Constraint

**Current (v0.3):**
- Permission: `ads_read`
- Operations: GET only
- No mutations

**Future (v0.4):**
- Permission: `ads_management`
- Operations: POST, PUT, DELETE
- Approval workflow required

## 📊 Performance Considerations

### API Rate Limits

Meta API rate limits:
- 200 calls per hour per user
- 4800 calls per hour per app

**Strategy:**
- No automatic retry
- Caller decides retry logic
- Batch requests when possible

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

### Integration Tests

- Mock `MetaClient`
- Test tools dengan fake responses
- No real API calls

### E2E Tests (future)

- Real Meta API calls
- Sandbox ad account
- CI/CD integration

## 🚀 Extensibility

### Menambah Tool Baru

1. Buat file di `src/tools/newTool.ts`
2. Define interface untuk options
3. Implement function dengan `MetaClient`
4. Export dari `src/index.ts`
5. Tambahkan test

### Menambah Analysis Module

1. Buat file di `src/analysis/newAnalysis.ts`
2. Input dari existing insight types
3. Output include recommendations
4. Export dari `src/index.ts`
5. Tambahkan test

### Menambah Rule Template

1. Buat file di `src/rules/templates/newTemplate.ts`
2. Define rules dengan pattern yang ada
3. Export dari `src/rules/templates/index.ts`
4. Update rule engine

### Menambah AI Skill

1. Buat folder di `skills/meta-ads/newSkill/`
2. Buat `SKILL.md` dengan workflow
3. Reference shared context
4. Test dengan real agent

## 🔮 Future Architecture (v1.0)

### Planned Additions

1. **Write Operations Layer** (v0.4)
   - Approval workflow
   - Audit logging
   - Rollback capability

2. **OAuth Layer** (v0.5)
   - Token refresh
   - Multi-user support
   - Secure token storage

3. **Multi-Account Layer** (v0.6)
   - Account switching
   - Bulk operations
   - Cross-account reporting

4. **Monitoring Layer** (v1.0)
   - Error tracking
   - Performance metrics
   - Usage analytics

---

**Kembali ke:** [AGENTS.md](../AGENTS.md)
