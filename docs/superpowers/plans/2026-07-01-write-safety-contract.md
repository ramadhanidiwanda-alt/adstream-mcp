# Write Safety Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a reusable safety contract that all current and future Meta Ads write operations must follow before v0.6.0 expands mutations to adset/ad levels.

**Architecture:** Keep this as a documentation and planning contract first, anchored to existing campaign mutation behavior. The contract becomes the implementation checklist for future TypeScript changes in tools, broker adapters, MCP schemas, tests, and AI skills.

**Tech Stack:** Markdown documentation, existing TypeScript campaign mutation workflow, AdsBroker permission policy, Vitest validation, tsup build verification.

## Global Constraints

- Do not add new write behavior in this task.
- Do not weaken existing campaign write safety.
- Do not expose or log provider tokens, Meta access tokens, Connection Keys, OAuth tokens, authorization headers, or URLs containing `access_token`.
- Campaign writes remain the only supported mutation surface today.
- Adset/ad writes remain planned for v0.6.0 and must be implemented behind the contract in a later task.
- Unsupported operations must fail closed.

---

### Task 1: Document the Write Safety Contract

**Files:**
- Create: `docs/WRITE_SAFETY_CONTRACT.md`

**Interfaces:**
- Consumes: `src/tools/campaignMutations.ts`, `src/broker/AdsBroker.ts`, `src/types.ts`, `src/broker/types.ts`
- Produces: reusable write lifecycle, confirmation, audit, permission, budget, and redaction requirements

- [ ] **Step 1: Capture current supported mutations**

Document campaign pause, resume, budget update, and rename as the only supported write operations today.

- [ ] **Step 2: Define unsupported operations**

List adset/ad writes, targeting changes, creative upload, creation, batch, and rollback as unsupported until implemented and tested.

- [ ] **Step 3: Define required lifecycle**

Specify intent discovery, permission check, preview, dry run, explicit confirmation, exact execution, audit result, and sanitized response.

- [ ] **Step 4: Define audit and redaction rules**

Require `timestamp`, `operation`, `entityType`, `entityId`, `before`, `after`, `fields`, `status`, and sanitized `error` when failed.

- [ ] **Step 5: Define v0.6.0 gate**

List the tests and implementation guarantees required before adset/ad writes are exposed.

### Task 2: Preserve an Implementation Plan

**Files:**
- Create: `docs/superpowers/plans/2026-07-01-write-safety-contract.md`

**Interfaces:**
- Consumes: user request for a pre-v0.6 safety contract
- Produces: durable plan for reviewers and future agents

- [ ] **Step 1: Write plan header**

Use the standard superpowers plan header with goal, architecture, tech stack, and global constraints.

- [ ] **Step 2: Break work into reviewable tasks**

Document contract creation, roadmap/skill cross-reference, and verification as independent tasks.

- [ ] **Step 3: Include exact verification commands**

Include scans for safety terms plus `npm test` and `npm run build`.

### Task 3: Cross-Reference the Contract

**Files:**
- Modify: `ROADMAP.md`
- Modify: `skills/meta-ads/manage/SKILL.md`

**Interfaces:**
- Consumes: `docs/WRITE_SAFETY_CONTRACT.md`
- Produces: visible link from the active v0.6.0 roadmap and manage-skill mutation guardrails

- [ ] **Step 1: Add roadmap prerequisite**

Add the write safety contract as a v0.6.0 prerequisite before adset/ad write implementation.

- [ ] **Step 2: Add manage skill reference**

Point guarded write operations to the write safety contract for detailed lifecycle and confirmation requirements.

### Task 4: Verify Contract Consistency

**Files:**
- Verify: `docs/WRITE_SAFETY_CONTRACT.md`
- Verify: `docs/superpowers/plans/2026-07-01-write-safety-contract.md`
- Verify: `ROADMAP.md`
- Verify: `skills/meta-ads/manage/SKILL.md`

**Interfaces:**
- Consumes: edited docs
- Produces: fresh verification evidence

- [ ] **Step 1: Run safety term scan**

Run:

```bash
rg -n "Write Safety Contract|dry_run_mutation|execute_after_confirmation|WRITE_NOT_ALLOWED|Unsupported operations must fail closed|v0.6.0 Implementation Gate" docs/WRITE_SAFETY_CONTRACT.md docs/superpowers/plans/2026-07-01-write-safety-contract.md ROADMAP.md skills/meta-ads/manage/SKILL.md
```

Expected: matches in the contract, plan, roadmap, and skill file.

- [ ] **Step 2: Run secret scanner on new docs**

Run:

```bash
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/docs/superpowers/plans"
cp docs/WRITE_SAFETY_CONTRACT.md "$TMPDIR/docs/WRITE_SAFETY_CONTRACT.md"
cp docs/superpowers/plans/2026-07-01-write-safety-contract.md "$TMPDIR/docs/superpowers/plans/2026-07-01-write-safety-contract.md"
gitleaks detect --no-git --source "$TMPDIR" --redact
rm -rf "$TMPDIR"
```

Expected: no leaks found.

- [ ] **Step 3: Run project checks**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds.
