# Manage Intent Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required intent-discovery and safety gate before Meta Ads management analysis or write-operation recommendations.

**Architecture:** Keep the behavior in the AI skill layer first, because the immediate goal is conversation quality and user intent alignment before tool calls. Update `skills/meta-ads/manage/SKILL.md` to require a short guided intake and update `skills/meta-ads/shared/preamble.md` so shared setup accurately reflects current read/write capabilities.

**Tech Stack:** Markdown-based Codex/AI skills, existing Meta Ads MCP tool descriptions, shell-based verification with `rg` plus `npm test` and `npm run build`.

## Global Constraints

- Do not create new root-level Markdown files.
- Do not log, expose, or request raw access tokens.
- Keep write operations guarded by dry-run, explicit confirmation, auditability, and no token leakage.
- Campaign-level write operations exist; adset/ad writes are roadmap v0.6.0, not part of this change.
- The discovery gate must help non-technical marketers choose objectives without forcing them to write a full brief.
- The change is skill/documentation only; no TypeScript mutation behavior changes in this task.

---

### Task 1: Add Manage Intent Discovery Gate

**Files:**
- Modify: `skills/meta-ads/manage/SKILL.md`

**Interfaces:**
- Consumes: existing shared setup flow from `../shared/preamble.md`
- Produces: a required pre-tool-call conversational intake for objective, scope, risk tolerance, timeframe, and output mode

- [ ] **Step 1: Add discovery workflow section**

Add a section near the top of `skills/meta-ads/manage/SKILL.md` after setup. It must require the agent to ask at least one clarifying question before analysis or mutation planning unless the user already provided objective, scope, and mode.

- [ ] **Step 2: Provide single-choice objective options**

Include a ready-to-use question like:

```text
Sebelum saya ambil data, tujuan utamanya yang mana?
1. Cari masalah performa
2. Cari peluang scaling
3. Turunkan CPA/CPL
4. Buat laporan cepat
5. Siapkan dry-run perubahan campaign
```

- [ ] **Step 3: Provide multi-select constraints**

Include a constraint checklist the user can answer with multiple choices:

```text
Constraint apa yang harus saya ikuti? Pilih boleh lebih dari satu:
- Jangan ubah budget
- Jangan pause campaign aktif
- Fokus spend terbesar
- Fokus 7/14/30 hari terakhir
- Prioritaskan ROAS/profit
- Prioritaskan lead volume
```

- [ ] **Step 4: Define mode escalation rules**

Document allowed modes: `analyze_only`, `recommend_only`, `dry_run_mutation`, and `execute_after_confirmation`. Require explicit confirmation before execution and prohibit assuming write intent from words like “optimize”.

- [ ] **Step 5: Update guardrails**

Replace the old read-only guardrail with current capability language: analysis is default, campaign writes require dry-run plus confirmation, adset/ad writes remain not implemented until v0.6.0.

### Task 2: Update Shared Preamble Capability Text

**Files:**
- Modify: `skills/meta-ads/shared/preamble.md`

**Interfaces:**
- Consumes: current MCP tool inventory language
- Produces: accurate shared capability framing for read tools and guarded campaign write tools

- [ ] **Step 1: Replace stale read-only statement**

Update “current implementation is read-only” language so it says read operations are default, while campaign-level writes may exist in broker mode with explicit dry-run/confirmation.

- [ ] **Step 2: Add safe write handling**

When users ask for unsupported write operations, instruct the agent to offer analysis or dry-run planning instead of claiming all writes are impossible.

- [ ] **Step 3: Preserve token safety**

Keep the no-token-leak security posture. Do not add examples that include real tokens.

### Task 3: Verify Skill Consistency

**Files:**
- Verify: `skills/meta-ads/manage/SKILL.md`
- Verify: `skills/meta-ads/shared/preamble.md`
- Verify: `docs/superpowers/plans/2026-07-01-manage-intent-discovery.md`

**Interfaces:**
- Consumes: modified Markdown
- Produces: evidence that stale read-only guidance is removed from edited skill paths and project still builds/tests

- [ ] **Step 1: Run stale-language scan**

Run:

```bash
rg -n "current implementation is read-only|This skill is currently read-only|All tools fetch data|there are no mutation operations" skills/meta-ads/manage/SKILL.md skills/meta-ads/shared/preamble.md
```

Expected: no matches.

- [ ] **Step 2: Run discovery-language scan**

Run:

```bash
rg -n "Intent Discovery|analyze_only|recommend_only|dry_run_mutation|execute_after_confirmation|Sebelum saya ambil data" skills/meta-ads/manage/SKILL.md
```

Expected: matches for the new discovery gate and modes.

- [ ] **Step 3: Run project checks**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and build succeeds.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff --stat
git diff -- skills/meta-ads/manage/SKILL.md skills/meta-ads/shared/preamble.md docs/superpowers/plans/2026-07-01-manage-intent-discovery.md
```

Expected: only intended plan and skill documentation changes.
