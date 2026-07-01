# Panduan Testing

> Best practices untuk testing adstream-mcp

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29

## 🧪 Testing Philosophy

### Prinsip Utama

1. **Test Business Logic, Bukan API Calls**
   - Focus pada analysis dan rules
   - Mock external dependencies
   - No real Meta API calls di unit tests

2. **Type Safety adalah First Line of Defense**
   - TypeScript catch banyak bugs di compile time
   - Runtime tests untuk business logic
   - Integration tests untuk API contracts

3. **Fast Feedback Loop**
   - Unit tests harus cepat (<1s)
   - Integration tests boleh lambat (mock API)
   - E2E tests jarang (real API, sandbox account)

4. **Test Edge Cases**
   - Empty data
   - Missing fields
   - Null values
   - Invalid input
   - API errors

## 🏗️ Testing Layers

### Layer 1: Unit Tests

**Target:** Business logic di `src/analysis/` dan `src/rules/`

**Tools:** Vitest

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { analyzeCampaignPerformance } from '../src/analysis/analyzeCampaignPerformance.js';

describe('analyzeCampaignPerformance', () => {
  it('harus detect low ROAS', () => {
    const insights = [
      {
        campaign_id: '123',
        campaign_name: 'Test Campaign',
        spend: '1000',
        purchase_roas: [{ value: '0.5' }], // Low ROAS
      }
    ];
    
    const result = analyzeCampaignPerformance(insights);
    
    expect(result.findings).toContain('Low ROAS detected');
    expect(result.severity).toBe('critical');
  });
  
  it('harus handle empty insights', () => {
    const result = analyzeCampaignPerformance([]);
    
    expect(result.findings).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });
  
  it('harus handle missing ROAS field', () => {
    const insights = [
      {
        campaign_id: '123',
        campaign_name: 'Test Campaign',
        spend: '1000',
        // No purchase_roas field
      }
    ];
    
    const result = analyzeCampaignPerformance(insights);
    
    expect(result.findings).toContain('ROAS data not available');
  });
});
```

**Checklist:**
- [ ] Test happy path
- [ ] Test edge cases (empty, null, undefined)
- [ ] Test error conditions
- [ ] Test boundary values
- [ ] No external dependencies

### Layer 2: Integration Tests

**Target:** Tools di `src/tools/` dengan mocked `MetaClient`

**Tools:** Vitest + Mock

**Pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { getCampaigns } from '../src/tools/getCampaigns.js';
import { MetaClient } from '../src/metaClient.js';

describe('getCampaigns', () => {
  it('harus return campaigns dari API', async () => {
    // Mock MetaClient
    const mockClient = {
      metaGet: vi.fn().mockResolvedValue({
        data: [
          { id: '123', name: 'Campaign 1', status: 'ACTIVE' },
          { id: '456', name: 'Campaign 2', status: 'PAUSED' },
        ]
      })
    } as unknown as MetaClient;
    
    const campaigns = await getCampaigns(mockClient, {
      adAccountId: 'act_123456789'
    });
    
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0].name).toBe('Campaign 1');
    expect(mockClient.metaGet).toHaveBeenCalledWith(
      '/act_123456789/campaigns',
      expect.any(Object)
    );
  });
  
  it('harus handle API error', async () => {
    const mockClient = {
      metaGet: vi.fn().mockRejectedValue(
        new Error('API Error')
      )
    } as unknown as MetaClient;
    
    await expect(
      getCampaigns(mockClient, { adAccountId: 'act_123' })
    ).rejects.toThrow('API Error');
  });
});
```

**Checklist:**
- [ ] Mock external dependencies
- [ ] Test API contract (params, response)
- [ ] Test error handling
- [ ] Test retry logic (jika ada)
- [ ] No real API calls

### Layer 3: E2E Tests (Future)

**Target:** Real Meta API calls dengan sandbox account

**Tools:** Vitest + Real API

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { MetaClient } from '../src/metaClient.js';
import { loadConfig } from '../src/config.js';
import { getCampaigns } from '../src/tools/getCampaigns.js';

describe('E2E: getCampaigns', () => {
  it('harus fetch real campaigns', async () => {
    const config = loadConfig();
    const client = new MetaClient(config);
    
    const campaigns = await getCampaigns(client, {
      adAccountId: process.env.META_AD_ACCOUNT_ID!
    });
    
    expect(campaigns).toBeDefined();
    expect(Array.isArray(campaigns)).toBe(true);
  }, 10000); // 10s timeout
});
```

**Checklist:**
- [ ] Use sandbox ad account
- [ ] Use test tokens (not production)
- [ ] Run di CI/CD only
- [ ] Longer timeouts
- [ ] Clean up test data

## 🛠️ Testing Tools

### Vitest

**Kenapa Vitest?**
- Fast (Vite-powered)
- ESM native
- TypeScript support
- Compatible dengan Jest API
- Better DX

**Config:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
      ],
    },
  },
});
```

### Mock Patterns

**Mock MetaClient:**
```typescript
import { vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';

const mockClient: MetaClient = {
  metaGet: vi.fn(),
} as any;
```

**Mock Environment Variables:**
```typescript
import { vi } from 'vitest';

vi.stubEnv('META_ACCESS_TOKEN', 'test_token');
vi.stubEnv('META_AD_ACCOUNT_ID', 'act_123');
```

**Mock Fetch:**
```typescript
import { vi } from 'vitest';

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: [] }),
});
```

## 📊 Test Coverage

### Target Coverage

- **Overall:** 80%+
- **Business Logic:** 90%+
- **Utils:** 95%+
- **Tools:** 70%+ (banyak API calls)

### Check Coverage

```bash
npm run test -- --coverage
```

**Output:**
```
File                | % Stmts | % Branch | % Funcs | % Lines
--------------------|---------|----------|---------|--------
All files           |   82.5  |   75.3   |   88.2  |   82.1
 src/               |   78.9  |   70.1   |   85.0  |   78.5
  analysis/         |   92.3  |   88.7   |   95.0  |   92.0
  rules/            |   90.1  |   85.2   |   92.5  |   89.8
  tools/            |   68.5  |   60.3   |   75.0  |   68.2
  utils/            |   95.2  |   92.1   |   98.0  |   95.0
```

### Coverage Goals

**High Priority (90%+):**
- `src/analysis/` - Business logic critical
- `src/rules/` - Rule engine critical
- `src/utils/` - Shared utilities

**Medium Priority (70%+):**
- `src/tools/` - API wrappers (banyak mock)
- `src/config.ts` - Config loader

**Low Priority (50%+):**
- `src/metaClient.ts` - Mostly HTTP (integration test)
- `mcp-server/` - MCP wrapper (E2E test)

## 🎯 Testing Strategies

### Strategy 1: Test-Driven Development (TDD)

**Process:**
1. Write failing test
2. Implement minimal code
3. Make test pass
4. Refactor
5. Repeat

**Example:**
```typescript
// Step 1: Write test
describe('parseActionValue', () => {
  it('harus extract purchase value', () => {
    const actions = [
      { action_type: 'purchase', value: '10' },
      { action_type: 'lead', value: '5' },
    ];
    
    expect(parseActionValue(actions, 'purchase')).toBe(10);
  });
});

// Step 2: Implement
export function parseActionValue(
  actions: Action[] | undefined,
  actionType: string
): number {
  if (!actions) return 0;
  const action = actions.find(a => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

// Step 3: Test passes ✅
```

### Strategy 2: Snapshot Testing

**Use case:** Complex objects yang jarang berubah

```typescript
import { expect, it } from 'vitest';

it('harus generate correct report structure', () => {
  const report = generateDailyReport(insights);
  
  expect(report).toMatchSnapshot();
});
```

**Checklist:**
- [ ] Use untuk stable APIs
- [ ] Review snapshots di PR
- [ ] Update snapshots dengan `--update`
- [ ] Don't snapshot dynamic data (timestamps, IDs)

### Strategy 3: Property-Based Testing (Future)

**Use case:** Test dengan random inputs

```typescript
import { fc, test } from '@fast-check/vitest';

test.prop([fc.array(fc.integer())])('sum harus commutative', (arr) => {
  const sum1 = arr.reduce((a, b) => a + b, 0);
  const sum2 = arr.reverse().reduce((a, b) => a + b, 0);
  expect(sum1).toBe(sum2);
});
```

## 🐛 Testing Edge Cases

### Empty Data

```typescript
it('harus handle empty array', () => {
  expect(analyzeCampaignPerformance([])).toEqual({
    findings: [],
    recommendations: [],
  });
});
```

### Missing Fields

```typescript
it('harus handle missing ROAS', () => {
  const insight = {
    campaign_id: '123',
    spend: '1000',
    // No purchase_roas
  };
  
  expect(() => analyzeCampaignPerformance([insight])).not.toThrow();
});
```

### Null/Undefined

```typescript
it('harus handle null actions', () => {
  const insight = {
    campaign_id: '123',
    actions: null,
  };
  
  expect(parseActionValue(insight.actions, 'purchase')).toBe(0);
});
```

### Invalid Input

```typescript
it('harus throw pada invalid ad account ID', () => {
  expect(() => validateAdAccountId('invalid')).toThrow();
  expect(() => validateAdAccountId('act_abc')).toThrow();
  expect(() => validateAdAccountId('123456')).toThrow();
});
```

### API Errors

```typescript
it('harus handle 401 Unauthorized', async () => {
  mockClient.metaGet.mockRejectedValue(
    new MetaApiError('Invalid token', 401, 'OAuthException')
  );
  
  await expect(getCampaigns(mockClient, options)).rejects.toThrow(
    'Invalid token'
  );
});
```

## 🚀 Running Tests

### Commands

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test -- --coverage

# Specific file
npm run test src/analysis/analyzeCampaignPerformance.test.ts

# Specific test
npm run test -t "harus detect low ROAS"

# Update snapshots
npm run test -- --update
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v3
```

## 📝 Testing Checklist

### Before Commit

- [ ] All tests passing
- [ ] Coverage tidak turun
- [ ] No console.logs di tests
- [ ] No skipped tests (`it.skip`)
- [ ] No focused tests (`it.only`)

### Before PR

- [ ] Add tests untuk new features
- [ ] Update tests untuk bug fixes
- [ ] Test edge cases
- [ ] Check coverage report
- [ ] Review snapshots

### Before Release

- [ ] All tests passing
- [ ] Coverage target met (80%+)
- [ ] E2E tests passing (jika ada)
- [ ] Performance tests passing (jika ada)
- [ ] Security tests passing (jika ada)

---

**Kembali ke:** [AGENTS.md](../AGENTS.md)
