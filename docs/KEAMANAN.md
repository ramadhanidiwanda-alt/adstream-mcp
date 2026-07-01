# Panduan Keamanan

> Security best practices untuk adstream-mcp

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29

## 🔒 Prinsip Keamanan

### 1. Token adalah Sacred

Access tokens adalah kunci ke ad accounts yang bisa berisi jutaan rupiah budget. Treat them like passwords.

**JANGAN PERNAH:**
- ❌ Log tokens ke console
- ❌ Include tokens di error messages
- ❌ Commit tokens ke git
- ❌ Hardcode tokens di code
- ❌ Share tokens via chat/email
- ❌ Store tokens di plaintext files (kecuali `.env` yang di-gitignore)

**SELALU:**
- ✅ Gunakan environment variables
- ✅ Mask tokens di logs
- ✅ Rotate tokens secara berkala
- ✅ Use minimum required permissions
- ✅ Revoke tokens yang tidak dipakai

### 2. Read-Only by Design

Project ini sengaja read-only di v0.3 untuk minimize risk.

**Kenapa?**
- Tidak bisa accidentally pause campaigns
- Tidak bisa accidentally change budgets
- Tidak bisa accidentally delete ads
- Easier untuk test dan debug
- Lower barrier untuk adoption

**Write operations (v0.4) akan include:**
- Approval workflow
- Audit logging
- Rollback capability
- Dry-run mode

### 3. Principle of Least Privilege

Gunakan permission minimal yang dibutuhkan.

**Current (v0.3):**
- Permission: `ads_read`
- Scope: Read campaign data only

**Future (v0.4):**
- Permission: `ads_management`
- Scope: Read + write campaign data
- Requires: Approval workflow

## 🛡️ Token Management

### Environment Variables

```bash
# .env (NEVER commit this file)
META_ACCESS_TOKEN="EAAxxxxxxxxxxxxx"
META_AD_ACCOUNT_ID="act_123456789"
META_API_VERSION="v20.0"
```

**Checklist:**
- ✅ `.env` ada di `.gitignore`
- ✅ `.env.example` tidak contain real tokens
- ✅ Production tokens berbeda dari development
- ✅ Tokens di-rotate setiap 60 hari

### Config Loading

```typescript
// src/config.ts
import { config } from 'dotenv';

config(); // Load .env

export interface MetaConfig {
  accessToken: string;
  apiVersion: string;
}

export function loadConfig(): MetaConfig {
  const accessToken = process.env.META_ACCESS_TOKEN;
  
  if (!accessToken) {
    throw new Error('META_ACCESS_TOKEN is required');
  }
  
  return {
    accessToken,
    apiVersion: process.env.META_API_VERSION || 'v20.0',
  };
}
```

**Prinsip:**
- Fail fast jika token missing
- No default tokens
- No fallback ke hardcoded values

### Token Usage

```typescript
// src/metaClient.ts
export class MetaClient {
  private accessToken: string; // Private field
  
  constructor(config: MetaConfig) {
    this.accessToken = config.accessToken;
  }
  
  async metaGet<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    // Add token to query params (HTTPS only)
    url.searchParams.append('access_token', this.accessToken);
    
    // ❌ NEVER log the URL
    // console.log('Fetching:', url.toString()); // NEVER DO THIS
    
    const response = await fetch(url.toString());
    // ...
  }
}
```

**Prinsip:**
- Token di private field
- Token tidak pernah di-return
- Token tidak pernah di-log
- Token hanya di URL query param (HTTPS)

### Error Handling

```typescript
// src/utils/metaError.ts
export class MetaApiError extends Error {
  constructor(
    message: string,
    public code: number,
    public type: string,
    public subcode?: number,
    public fbtraceId?: string
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

// Usage
try {
  const data = await client.metaGet('/path');
} catch (error) {
  if (error instanceof MetaApiError) {
    // ✅ Safe - no token in error
    console.error(`Meta API Error ${error.code}: ${error.message}`);
    console.error(`Trace ID: ${error.fbtraceId}`);
  } else {
    // ❌ Don't log raw error (might contain URL with token)
    console.error('Unexpected error:', error.message);
  }
}
```

**Prinsip:**
- Custom error class
- No URL in error messages
- No token in error messages
- Include trace ID untuk debugging

## 🔐 API Security

### HTTPS Only

```typescript
// src/metaClient.ts
export class MetaClient {
  private baseUrl = 'https://graph.facebook.com'; // HTTPS only
  
  constructor(config: MetaConfig) {
    // Validate HTTPS
    if (!this.baseUrl.startsWith('https://')) {
      throw new Error('API base URL must use HTTPS');
    }
  }
}
```

**Kenapa HTTPS?**
- Encrypt token in transit
- Prevent man-in-the-middle attacks
- Meta API requires HTTPS

### Request Validation

```typescript
// Validate ad account ID format
export function validateAdAccountId(id: string): void {
  if (!id.startsWith('act_')) {
    throw new Error('Ad account ID must start with "act_"');
  }
  
  const numericPart = id.slice(4);
  if (!/^\d+$/.test(numericPart)) {
    throw new Error('Ad account ID must contain only digits after "act_"');
  }
}
```

**Prinsip:**
- Validate input sebelum API call
- Fail fast dengan clear error messages
- Prevent injection attacks

### Response Validation

```typescript
// Use Zod for runtime validation (future)
import { z } from 'zod';

const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED']),
  daily_budget: z.string().optional(),
});

// Validate response
const campaigns = CampaignSchema.array().parse(response.data);
```

**Prinsip:**
- Don't trust API responses
- Validate types at runtime
- Fail fast jika response invalid

## 🚨 Common Security Pitfalls

### ❌ Pitfall 1: Logging URLs

```typescript
// ❌ BAD - Token exposed in logs
const url = `https://graph.facebook.com/v20.0/me?access_token=${token}`;
console.log('Fetching:', url);

// ✅ GOOD - Token not logged
const url = new URL('https://graph.facebook.com/v20.0/me');
url.searchParams.append('access_token', token);
// Don't log url.toString()
```

### ❌ Pitfall 2: Error Messages

```typescript
// ❌ BAD - Token might be in error.message
try {
  await fetch(url);
} catch (error) {
  console.error('Fetch failed:', error);
}

// ✅ GOOD - Custom error without sensitive data
try {
  await fetch(url);
} catch (error) {
  throw new MetaApiError('API request failed', 500, 'NetworkError');
}
```

### ❌ Pitfall 3: Git Commits

```bash
# ❌ BAD - .env committed
git add .env
git commit -m "Add config"

# ✅ GOOD - .env in .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .gitignore"
```

### ❌ Pitfall 4: Hardcoded Tokens

```typescript
// ❌ BAD - Token in code
const token = "EAAxxxxxxxxxxxxx";

// ✅ GOOD - Token from environment
const token = process.env.META_ACCESS_TOKEN;
if (!token) throw new Error('Token required');
```

### ❌ Pitfall 5: Overly Permissive Tokens

```typescript
// ❌ BAD - ads_management permission untuk read-only app
// Permissions: ads_management, pages_manage_ads, business_management

// ✅ GOOD - Minimal permission
// Permissions: ads_read
```

## 🔍 Security Checklist

### Development

- [ ] `.env` ada di `.gitignore`
- [ ] No hardcoded tokens di code
- [ ] No console.log dengan tokens
- [ ] Error messages tidak expose tokens
- [ ] HTTPS only untuk API calls
- [ ] Input validation untuk semua user input
- [ ] Type validation untuk API responses

### Testing

- [ ] Mock tokens di tests (jangan real tokens)
- [ ] Test error handling tanpa expose tokens
- [ ] Test dengan invalid tokens
- [ ] Test dengan expired tokens
- [ ] Test dengan wrong permissions

### Production

- [ ] Rotate tokens setiap 60 hari
- [ ] Monitor untuk suspicious activity
- [ ] Revoke unused tokens
- [ ] Use separate tokens untuk dev/staging/prod
- [ ] Audit logs untuk token usage
- [ ] Rate limit awareness

### Code Review

- [ ] No tokens di code
- [ ] No tokens di logs
- [ ] No tokens di error messages
- [ ] No tokens di git history
- [ ] Proper error handling
- [ ] Input validation
- [ ] HTTPS only

## 🚀 Future Security Features (v0.4+)

### Approval Workflow

```typescript
// Write operations require approval
const result = await pauseCampaign(client, {
  campaignId: 'xxx',
  requireApproval: true, // Default true
});

// User must approve via CLI/UI
// "Pause campaign 'Summer Sale'? [y/N]"
```

### Audit Logging

```typescript
// All write operations logged
{
  timestamp: '2026-05-29T09:18:39Z',
  action: 'pause_campaign',
  campaignId: 'xxx',
  userId: 'agent-123',
  approved: true,
  result: 'success'
}
```

### Rollback Capability

```typescript
// Undo last action
await rollbackLastAction(client);

// Restore campaign state
await restoreCampaignState(client, {
  campaignId: 'xxx',
  timestamp: '2026-05-29T08:00:00Z'
});
```

### OAuth Flow

```typescript
// Secure token management
const oauth = new MetaOAuth({
  clientId: process.env.META_APP_ID,
  clientSecret: process.env.META_APP_SECRET,
  redirectUri: 'http://localhost:3000/callback'
});

// Get authorization URL
const authUrl = oauth.getAuthorizationUrl();

// Exchange code for token
const token = await oauth.getAccessToken(code);

// Refresh token
const newToken = await oauth.refreshAccessToken(refreshToken);
```

---

**Kembali ke:** [AGENTS.md](../AGENTS.md)
