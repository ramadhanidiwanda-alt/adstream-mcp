# AGENTS.md

Panduan untuk AI agents yang bekerja dengan codebase `meta-ads-agent-skill`.

## Project Overview

**meta-ads-agent-skill** adalah TypeScript library read-only untuk mengakses Meta Marketing API. Project ini didesain untuk AI agents yang perlu membaca dan menganalisis performa Meta Ads campaigns.

**Status:** MVP v0.1.0 - Read-only operations only
**Tech Stack:** TypeScript, Node.js, ESM modules, Zod, Vitest

## Code Style & Conventions

### TypeScript
- **Strict mode enabled** - Semua types harus explicit
- **ESM modules** - Gunakan `import/export`, bukan `require`
- **File extensions** - Selalu gunakan `.js` di import statements (bukan `.ts`)
  ```typescript
  // ✅ Correct
  import { MetaClient } from './metaClient.js';
  
  // ❌ Wrong
  import { MetaClient } from './metaClient';
  ```

### Naming Conventions
- **Files:** camelCase untuk files (e.g., `metaClient.ts`, `getCampaigns.ts`)
- **Functions:** camelCase (e.g., `getCampaignInsights`, `analyzeCampaignPerformance`)
- **Types/Interfaces:** PascalCase (e.g., `MetaConfig`, `CampaignInsight`)
- **Constants:** UPPER_SNAKE_CASE untuk env vars (e.g., `META_ACCESS_TOKEN`)

### Code Organization

```
src/
├── index.ts              # Main export - export semua public APIs
├── metaClient.ts         # Core API client
├── config.ts             # Environment config loader
├── types.ts              # Semua TypeScript types & interfaces
├── tools/                # API wrapper functions (read-only)
├── analysis/             # Analysis & recommendation logic
└── utils/                # Helper functions
```

**Rules:**
- Semua public APIs harus di-export dari `src/index.ts`
- Types harus didefinisikan di `src/types.ts`
- Jangan buat file baru di root `src/` tanpa alasan kuat
- Tools baru masuk ke `src/tools/`
- Analysis logic masuk ke `src/analysis/`
- Utilities masuk ke `src/utils/`

## Security Guidelines

### ⚠️ CRITICAL: Access Token Safety
- **NEVER log access tokens** - Jangan console.log, jangan error message
- **NEVER commit .env** - Sudah ada di .gitignore
- **NEVER hardcode tokens** - Selalu gunakan environment variables

```typescript
// ✅ Correct - Token tidak pernah di-log
const url = new URL(`${this.baseUrl}${path}`);
url.searchParams.append('access_token', this.accessToken);

// ❌ Wrong - Jangan log URL dengan token
console.log('Fetching:', url.toString()); // NEVER DO THIS
```

### Read-Only Operations Only
- Project ini **hanya read-only** (ads_read permission)
- **JANGAN implement write operations** seperti:
  - Pause/resume campaigns
  - Update budgets
  - Create ads/campaigns
  - Upload creatives
- Semua recommendations harus include disclaimer bahwa ini suggestion only

## API Client Pattern

### MetaClient Usage
Semua API calls harus melalui `MetaClient.metaGet()`:

```typescript
const response = await client.metaGet<{ data: Campaign[] }>(
  `/act_${adAccountId}/campaigns`,
  {
    fields: 'id,name,status',
    limit: 100,
  }
);
```

**Rules:**
- Gunakan TypeScript generics untuk response type
- Handle errors dengan try-catch
- Throw `MetaApiError` untuk Meta API errors
- Jangan retry otomatis - biarkan caller yang handle

## Adding New Features

### Adding New Tool
1. Buat file di `src/tools/newTool.ts`
2. Export function dengan clear interface:
   ```typescript
   export interface GetNewDataOptions {
     adAccountId: string;
     // ... other params
   }
   
   export async function getNewData(
     client: MetaClient,
     options: GetNewDataOptions
   ): Promise<NewData[]> {
     // implementation
   }
   ```
3. Export dari `src/index.ts`
4. Tambahkan test di `tests/`

### Adding New Analysis
1. Buat file di `src/analysis/newAnalysis.ts`
2. Input harus dari existing insight types
3. Output harus include clear recommendations
4. Tambahkan disclaimer jika generate action recommendations
5. Export dari `src/index.ts`

### Adding New Types
1. Tambahkan di `src/types.ts`
2. Follow Meta API response structure
3. Gunakan optional fields (`?`) untuk fields yang tidak selalu ada
4. Export dengan `export interface` atau `export type`

## Testing Guidelines

### Test Structure
- Test files di folder `tests/`
- Naming: `[feature].test.ts`
- Gunakan Vitest
- Mock external API calls

```typescript
import { describe, it, expect } from 'vitest';

describe('featureName', () => {
  it('should do something specific', () => {
    // Arrange
    const input = { /* ... */ };
    
    // Act
    const result = functionToTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

**Rules:**
- Test business logic, bukan API calls
- Mock `MetaClient` untuk integration tests
- Focus on edge cases (empty data, missing fields, etc.)
- Jangan test external APIs (Meta API) - itu integration test

## Meta Marketing API Guidelines

### API Version
- Default: `v20.0`
- Configurable via `META_API_VERSION` env var
- Update version di `.env.example` jika ada breaking changes

### Common Fields
**Campaign Insights:**
- `campaign_id`, `campaign_name`
- `spend`, `impressions`, `reach`, `clicks`
- `ctr`, `cpc`, `cpm`
- `actions`, `action_values`, `purchase_roas`

**Actions Array:**
- `action_type`: `purchase`, `lead`, `add_to_cart`, `link_click`, etc.
- `value`: string number (parse dengan `parseFloat`)

### Time Ranges
- Format: `YYYY-MM-DD`
- Gunakan `time_range` parameter: `{ since: '2026-05-21', until: '2026-05-28' }`
- Max range: 93 days (Meta API limit)

## Error Handling

### MetaApiError
Gunakan custom error class untuk Meta API errors:

```typescript
try {
  const data = await client.metaGet('/path');
} catch (error) {
  if (error instanceof MetaApiError) {
    // Handle Meta API specific error
    console.error(`Meta API Error ${error.code}: ${error.message}`);
  } else {
    // Handle other errors
    throw error;
  }
}
```

**Error Properties:**
- `message`: Error message
- `code`: Meta error code
- `type`: Error type
- `subcode`: Optional subcode
- `fbtraceId`: Optional trace ID for debugging

## Build & Development

### Commands
```bash
npm run dev          # Watch mode untuk development
npm run build        # Build production bundle
npm run test         # Run tests
npm run test:watch   # Watch mode untuk tests
npm run format       # Format code dengan Prettier
npm run lint         # Lint code dengan ESLint
```

### Build Output
- Output: `dist/`
- Format: ESM only
- Includes: `.js`, `.d.ts`, `.js.map`, `.d.ts.map`
- Entry: `dist/index.js`

### Pre-commit Checklist
1. `npm run format` - Format code
2. `npm run build` - Ensure build works
3. `npm run test` - All tests passing
4. No console.logs in production code
5. No access tokens in code or logs

## Common Patterns

### Parsing Actions
```typescript
import { parseActionValue } from './utils/parseActions.js';

const purchases = parseActionValue(insight.actions, 'purchase');
const leads = parseActionValue(insight.actions, 'lead');
```

### Formatting Currency
```typescript
import { formatCurrency } from './utils/formatCurrency.js';

const formatted = formatCurrency(1234.56, 'USD'); // "$1,234.56"
```

### Config Loading
```typescript
import { loadConfig } from './config.js';

const config = loadConfig(); // Throws if env vars missing
const client = new MetaClient(config);
```

## Roadmap Context

**Current (v0.1):** Read-only insights
**Next (v0.2):** Advanced rules engine
**Future (v0.3):** MCP server wrapper
**Future (v0.4):** Safe write actions with approval

Saat implement features baru:
- v0.1: Focus on read operations dan analysis
- v0.2: Bisa tambahkan custom rules dan advanced analysis
- v0.3: Prepare untuk MCP integration (jangan couple terlalu tight)
- v0.4: Design dengan approval layer in mind

## Questions?

Jika ada ambiguity:
1. Check existing code patterns di `src/tools/` atau `src/analysis/`
2. Follow TypeScript strict mode - jika compiler complain, fix it
3. Prioritize security - when in doubt, don't log it
4. Keep it simple - ini MVP, jangan over-engineer

## External References

- [Meta Marketing API Docs](https://developers.facebook.com/docs/marketing-api)
- [Insights API Reference](https://developers.facebook.com/docs/marketing-api/insights)
- [Ad Account Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights)

---

**Last Updated:** 2026-05-28
**Scope:** Entire repository
**Maintainer:** Project owner
