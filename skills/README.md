# Meta Ads Skills for AI Agents

This directory contains markdown-based skills that AI agents can read and execute. These skills provide a simpler, more AI-native way to interact with Meta Ads compared to the TypeScript library.

## What are Skills?

Skills are markdown files that contain:
- **Instructions** for AI agents on how to perform tasks
- **Heuristics** for interpreting data and making decisions
- **Benchmarks** for comparing performance
- **Decision trees** for common scenarios

AI agents read these files and execute the logic themselves, rather than calling hard-coded functions.

## Available Skills

### `/meta-ads-audit`

**Purpose:** Comprehensive account audit and business context setup

**When to use:**
- First time analyzing a Meta Ads account
- Setting up business context (AOV, profit margin, brand voice)
- Quarterly health checks
- When business context is >90 days old

**What it does:**
- Pulls campaign, ad set, and ad performance data
- Scores account health across 5 dimensions
- Identifies top 3 optimization opportunities
- Saves business context and personas for future analysis
- Creates account baseline for anomaly detection

**Output:** Detailed audit report with scorecard and actionable recommendations

### `/meta-ads-manage`

**Purpose:** Ongoing performance analysis and recommendations

**When to use:**
- Daily/weekly performance checks
- "How are my campaigns doing?"
- "Where am I wasting money?"
- "What should I scale?"
- Specific campaign analysis

**What it does:**
- Analyzes campaign performance
- Detects creative fatigue
- Identifies wasted spend
- Recommends scaling opportunities
- Provides daily performance reports

**Output:** Natural language analysis with specific, dollar-denominated recommendations

## How to Use

### For AI Agents (Claude, etc.)

1. Read `meta-ads/shared/preamble.md` first (handles setup)
2. Read the appropriate skill file (`audit/SKILL.md` or `manage/SKILL.md`)
3. Follow the instructions step-by-step
4. Call MCP tools as needed
5. Generate output according to the skill's format

### For End Users

Simply ask your AI agent:
- "Audit my Meta ads" → triggers `/meta-ads-audit`
- "How are my campaigns doing?" → triggers `/meta-ads-manage`
- "Show me yesterday's performance" → triggers daily report

## Architecture

```
skills/meta-ads/
├── audit/
│   └── SKILL.md              # Audit skill (comprehensive analysis)
├── manage/
│   └── SKILL.md              # Management skill (ongoing analysis)
└── shared/
    ├── preamble.md           # Setup logic (MCP detection, config)
    ├── meta-math.md          # Formulas and benchmarks
    └── references/
        ├── analysis-heuristics.md    # Decision trees
        └── creative-fatigue.md       # Fatigue diagnosis
```

## Data Persistence

Skills persist data to `{data_dir}` (either `.meta-ads/` locally or `~/.meta-ads/` globally):

- **business-context.json** — Business info, AOV, profit margin, brand voice
- **personas.json** — Customer personas derived from data
- **account-baseline.json** — Rolling averages for anomaly detection

This allows AI agents to "remember" context across sessions and provide more accurate, personalized recommendations.

## Comparison: Skills vs Library

| Aspect | Skills (this folder) | Library (src/) |
|--------|---------------------|----------------|
| Target user | End users (marketers) | Developers |
| Interface | Natural language | TypeScript API |
| Setup | Zero code | npm install + coding |
| Logic | AI interprets markdown | Hard-coded functions |
| Updates | Edit markdown | Edit code, rebuild, republish |
| Flexibility | AI adapts to context | Fixed behavior |
| Maintenance | Low (just markdown) | High (code + tests) |

## MCP Server Requirement

Skills require an MCP server that provides Meta Ads tools. Options:

1. **Your built-in MCP server** (see `mcp-server/`)
2. **NotFair's hosted MCP** (https://notfair.co/api/mcp/meta_ads)
3. **Custom MCP server** (any server with Meta Ads tools)

Skills auto-detect which MCP server is available and adapt accordingly.

## Extending Skills

To add new skills:

1. Create a new folder under `skills/meta-ads/`
2. Add a `SKILL.md` file with frontmatter:
   ```markdown
   ---
   name: skill-name
   description: What this skill does
   argument-hint: "<what user should provide>"
   ---
   ```
3. Write step-by-step instructions for AI agents
4. Reference shared resources (`../shared/preamble.md`, `../shared/meta-math.md`)
5. Test with your AI agent

## Philosophy

**Skills are instructions, not code.**

Instead of writing:
```typescript
if (insight.ctr < 1.0) {
  recommendations.push('Low CTR detected');
}
```

Write:
```markdown
When link CTR is below industry benchmark:
- E-commerce: < 0.8% is poor
- Lead gen: < 1.0% is poor
- Recommend creative refresh
```

The AI agent reads the markdown and executes the logic contextually.

## Benefits

1. **Easier to maintain** — Edit markdown, not code
2. **Faster to iterate** — No compile/build/deploy cycle
3. **More flexible** — AI adapts to edge cases
4. **Better for end users** — Natural language interface
5. **Context-aware** — AI uses business context automatically

## Limitations

1. **Requires AI agent** — Can't run standalone
2. **Less deterministic** — AI interpretation may vary
3. **Harder to test** — No unit tests for markdown
4. **Depends on MCP server** — Needs external tool provider

## Next Steps

- Add more reference guides (audience strategy, campaign structure)
- Add seasonal playbooks (Q4, holidays, etc.)
- Add industry-specific templates (e-commerce, lead gen, B2B)
- Add creative testing frameworks
- Add budget forecasting tools

## Questions?

See `AGENTS.md` in the project root for coding conventions and project context.
