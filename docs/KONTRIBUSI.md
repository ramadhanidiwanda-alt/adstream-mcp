# Panduan Kontribusi

> Cara berkontribusi ke adstream-mcp

**Versi:** 1.0 | **Terakhir Diupdate:** 2026-05-29

## 🤝 Selamat Datang!

Terima kasih sudah tertarik berkontribusi! Project ini open source (MIT license) dan welcome kontribusi dari siapa saja.

## 🎯 Cara Berkontribusi

### 1. Report Bugs

**Sebelum report bug:**
- [ ] Check existing issues
- [ ] Pastikan bukan user error
- [ ] Reproduce di clean environment

**Bug report harus include:**
- Deskripsi jelas tentang bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, package version)
- Error messages (mask tokens!)
- Code snippet (jika relevan)

**Template:**
```markdown
## Bug Description
[Deskripsi singkat]

## Steps to Reproduce
1. ...
2. ...
3. ...

## Expected Behavior
[Apa yang seharusnya terjadi]

## Actual Behavior
[Apa yang terjadi]

## Environment
- OS: macOS 14.0
- Node: v20.10.0
- Package: v0.3.0

## Error Message
```
[Error message di sini - MASK TOKENS!]
```

## Code Snippet
```typescript
// Code yang reproduce bug
```
```

### 2. Suggest Features

**Feature request harus include:**
- Use case yang jelas
- Kenapa feature ini penting
- Proposed API (jika ada)
- Alternative solutions yang sudah dicoba

**Template:**
```markdown
## Feature Description
[Deskripsi singkat]

## Use Case
[Kenapa feature ini dibutuhkan]

## Proposed API
```typescript
// Example usage
```

## Alternatives
[Alternative solutions yang sudah dicoba]

## Additional Context
[Context tambahan]
```

### 3. Submit Pull Requests

**Sebelum submit PR:**
- [ ] Fork repository
- [ ] Create feature branch
- [ ] Write tests
- [ ] Update documentation
- [ ] Run `npm run format && npm run build && npm run test`
- [ ] Commit dengan conventional commits

**PR checklist:**
- [ ] Clear title dan description
- [ ] Link ke related issue
- [ ] Tests passing
- [ ] Coverage tidak turun
- [ ] Documentation updated
- [ ] No breaking changes (atau documented)
- [ ] Changelog updated

## 🌿 Git Workflow

### Branch Naming

```bash
# Feature
git checkout -b feature/add-new-tool

# Bug fix
git checkout -b fix/handle-empty-response

# Documentation
git checkout -b docs/update-readme

# Refactor
git checkout -b refactor/simplify-error-handling
```

### Commit Messages

Gunakan [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(<scope>): <subject>

# Examples
feat(tools): add getCreatives function
fix(analysis): handle missing ROAS field
docs(readme): update installation steps
refactor(client): simplify error handling
test(rules): add edge case tests
chore(deps): update dependencies
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code refactor (no behavior change)
- `test` - Add/update tests
- `chore` - Maintenance (deps, config, etc)
- `perf` - Performance improvement
- `style` - Code style (formatting, etc)

**Scopes:**
- `tools` - src/tools/
- `analysis` - src/analysis/
- `rules` - src/rules/
- `client` - src/metaClient.ts
- `types` - src/types.ts
- `utils` - src/utils/
- `skills` - skills/
- `mcp` - mcp-server/
- `docs` - Documentation

### PR Process

1. **Fork & Clone**
```bash
git clone https://github.com/YOUR_USERNAME/adstream-mcp.git
cd adstream-mcp
npm install
```

2. **Create Branch**
```bash
git checkout -b feature/your-feature
```

3. **Make Changes**
```bash
# Edit files
# Add tests
# Update docs
```

4. **Test**
```bash
npm run format
npm run build
npm run test
```

5. **Commit**
```bash
git add .
git commit -m "feat(tools): add new tool"
```

6. **Push**
```bash
git push origin feature/your-feature
```

7. **Create PR**
- Go to GitHub
- Click "New Pull Request"
- Fill template
- Submit

## 📝 Code Style

### TypeScript

```typescript
// ✅ Good
export interface GetCampaignsOptions {
  adAccountId: string;
  limit?: number;
}

export async function getCampaigns(
  client: MetaClient,
  options: GetCampaignsOptions
): Promise<Campaign[]> {
  // Implementation
}

// ❌ Bad
export async function getCampaigns(client, options) {
  // No types
}
```

### Naming

```typescript
// ✅ Good
const campaignInsights = await getCampaignInsights(client, options);
const totalSpend = calculateTotalSpend(insights);

// ❌ Bad
const ci = await getCampaignInsights(client, options);
const ts = calculateTotalSpend(insights);
```

### Comments

```typescript
// ✅ Good - Explain WHY, not WHAT
// Use daily_budget instead of lifetime_budget for better control
const budget = campaign.daily_budget;

// ❌ Bad - Obvious comment
// Get the budget
const budget = campaign.daily_budget;
```

### Error Handling

```typescript
// ✅ Good
try {
  const data = await client.metaGet('/path');
  return data;
} catch (error) {
  if (error instanceof MetaApiError) {
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
  throw error;
}

// ❌ Bad
try {
  const data = await client.metaGet('/path');
  return data;
} catch (error) {
  console.error(error); // Don't just log
  return null; // Don't swallow errors
}
```

## 🧪 Testing Requirements

### Unit Tests

```typescript
// ✅ Good - Test business logic
describe('analyzeCampaignPerformance', () => {
  it('harus detect low ROAS', () => {
    const insights = [{ spend: '1000', purchase_roas: [{ value: '0.5' }] }];
    const result = analyzeCampaignPerformance(insights);
    expect(result.findings).toContain('Low ROAS');
  });
});

// ❌ Bad - Test implementation details
describe('analyzeCampaignPerformance', () => {
  it('harus call parseFloat', () => {
    // Don't test internal implementation
  });
});
```

### Coverage

- New features harus include tests
- Bug fixes harus include regression tests
- Coverage tidak boleh turun
- Target: 80%+ overall

## 📚 Documentation Requirements

### Code Documentation

```typescript
/**
 * Fetch campaigns dari Meta Ads account
 * 
 * @param client - MetaClient instance
 * @param options - Options untuk query
 * @returns Array of campaigns
 * @throws MetaApiError jika API call gagal
 * 
 * @example
 * ```typescript
 * const campaigns = await getCampaigns(client, {
 *   adAccountId: 'act_123456789',
 *   limit: 50
 * });
 * ```
 */
export async function getCampaigns(
  client: MetaClient,
  options: GetCampaignsOptions
): Promise<Campaign[]> {
  // Implementation
}
```

### README Updates

Jika menambah feature baru, update:
- [ ] README.md - Usage examples
- [ ] CHANGELOG.md - Version history
- [ ] AGENTS.md - Agent guidelines (jika relevan)

## 🔒 Security Requirements

### Token Safety

```typescript
// ✅ Good
const url = new URL(path);
url.searchParams.append('access_token', token);
// Don't log url

// ❌ Bad
console.log('URL:', url.toString()); // Exposes token!
```

### Input Validation

```typescript
// ✅ Good
export function validateAdAccountId(id: string): void {
  if (!id.startsWith('act_')) {
    throw new Error('Invalid ad account ID format');
  }
}

// ❌ Bad
export function getAccount(id: string) {
  // No validation
  return client.metaGet(`/${id}/...`);
}
```

## 🚀 Release Process

### Versioning

Gunakan [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0) - Breaking changes
- **MINOR** (0.1.0) - New features (backward compatible)
- **PATCH** (0.0.1) - Bug fixes

### Changelog

Update `CHANGELOG.md`:

```markdown
## [0.4.0] - 2026-06-15

### Added
- Write operations (pause, budget updates)
- Approval workflow
- Audit logging

### Changed
- Improved error messages
- Updated dependencies

### Fixed
- Handle missing ROAS field
- Fix type error in analysis

### Security
- Add input validation
- Mask tokens in logs
```

## 💬 Communication

### GitHub Issues

- Use untuk bug reports dan feature requests
- Search existing issues dulu
- Use labels (bug, enhancement, question, etc)
- Be respectful dan constructive

### Pull Requests

- Link ke related issue
- Clear description
- Screenshots/videos jika UI changes
- Respond to review comments
- Be patient

### Code Reviews

**Sebagai Reviewer:**
- Be constructive
- Explain WHY, not just WHAT
- Suggest alternatives
- Approve jika LGTM

**Sebagai Author:**
- Be open to feedback
- Ask questions jika unclear
- Make requested changes
- Thank reviewers

## 🎓 Learning Resources

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Meta Marketing API
- [Marketing API Docs](https://developers.facebook.com/docs/marketing-api)
- [Insights API](https://developers.facebook.com/docs/marketing-api/insights)

### Testing
- [Vitest Documentation](https://vitest.dev)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Git
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Best Practices](https://www.git-tower.com/learn/git/ebook/en/command-line/appendix/best-practices)

## 🙏 Recognition

Contributors akan di-list di:
- README.md (Contributors section)
- CHANGELOG.md (per release)
- GitHub contributors page

## 📧 Contact

- **Issues:** [GitHub Issues](https://github.com/ramadhanidiwanda-alt/adstream-mcp/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ramadhanidiwanda-alt/adstream-mcp/discussions)

---

**Terima kasih sudah berkontribusi! 🎉**

**Kembali ke:** [AGENTS.md](../AGENTS.md)
