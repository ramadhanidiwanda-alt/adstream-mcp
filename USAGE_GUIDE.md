# Usage Guide: meta-ads-agent-skill for AI Agents

**Target:** AI Agents (Claude Code, Claude Desktop, atau MCP-compatible agents)  
**Version:** v0.3.0  
**Last Updated:** 2026-05-29

---

## 🎯 Overview

Ada 2 cara menggunakan repo ini:

1. **Skills Mode** (Zero Code) - Untuk end users via AI agent
2. **Library Mode** (Programmatic) - Untuk developers via TypeScript

Guide ini fokus pada **Skills Mode** untuk AI agents.

---

## 📋 Prerequisites

1. **AI Agent** yang support MCP (Model Context Protocol)
   - Claude Code (CLI)
   - Claude Desktop
   - Atau MCP-compatible agent lainnya

2. **Meta Access Token**
   - Bisa dari Graph API Explorer (60 hari)
   - Atau System User Token (permanent)

3. **Meta Ad Account ID**
   - Format: `act_123456789`

---

## 🚀 Setup untuk Claude Code (CLI)

### Step 1: Install Package

```bash
# Global install (recommended)
npm install -g meta-ads-agent-skill

# Or local install
cd your-project
npm install meta-ads-agent-skill
```

### Step 2: Configure MCP Server

Buat atau edit `.mcp.json` di project root:

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "node",
      "args": [
        "/usr/local/lib/node_modules/meta-ads-agent-skill/mcp-server/dist/index.js"
      ],
      "env": {
        "META_ACCESS_TOKEN": "${META_ACCESS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    }
  }
}
```

**Note:** Path bisa berbeda tergantung instalasi. Cek dengan:
```bash
npm list -g meta-ads-agent-skill
```

### Step 3: Set Environment Variables

```bash
# Option 1: Export di terminal
export META_ACCESS_TOKEN="EAAxxxxx..."
export META_AD_ACCOUNT_ID="act_123456789"

# Option 2: Buat .env file
echo 'META_ACCESS_TOKEN=EAAxxxxx...' > .env
echo 'META_AD_ACCOUNT_ID=act_123456789' >> .env
```

### Step 4: Restart Claude Code

Restart Claude Code untuk load MCP server.

### Step 5: Test

Buka Claude Code dan ketik:

```
You: Audit my Meta ads
```

Claude akan:
1. Read skills/meta-ads/shared/preamble.md
2. Detect MCP server
3. Load config
4. Read skills/meta-ads/audit/SKILL.md
5. Call MCP tools
6. Generate comprehensive audit report

---

## 🖥️ Setup untuk Claude Desktop

### Step 1: Install Package

```bash
npm install -g meta-ads-agent-skill
```

### Step 2: Configure Claude Desktop

Edit Claude Desktop config file:

**macOS:**
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add MCP server:

```json
{
  "mcpServers": {
    "meta-ads-agent-skill": {
      "command": "node",
      "args": [
        "/usr/local/lib/node_modules/meta-ads-agent-skill/mcp-server/dist/index.js"
      ],
      "env": {
        "META_ACCESS_TOKEN": "EAAxxxxx...",
        "META_AD_ACCOUNT_ID": "act_123456789"
      }
    }
  }
}
```

**Important:** Ganti path sesuai instalasi Anda.

### Step 3: Restart Claude Desktop

Quit dan buka lagi Claude Desktop.

### Step 4: Test

Di Claude Desktop, ketik:

```
You: Audit my Meta ads
```

---

## 💬 Usage Examples

### 1. Comprehensive Audit

```
You: Audit my Meta ads
```

**What AI Does:**
- Pulls all campaigns (last 90 days)
- Pulls insights (last 30 days)
- Analyzes performance
- Generates scorecard (5 dimensions, 0-5 each)
- Identifies top 3 issues
- Provides dollar-denominated recommendations
- Saves business context

**Output:**
- Account overview
- Performance summary
- Scorecard
- Top 3 critical issues
- Detailed findings
- Action plan with expected impact

---

### 2. Daily Performance Check

```
You: How are my campaigns doing?
```

**What AI Does:**
- Pulls recent performance data
- Compares to baseline
- Identifies anomalies
- Provides quick summary

**Output:**
- Performance overview
- Top performers
- Underperformers
- Anomalies detected
- Quick recommendations

---

### 3. Show Yesterday's Performance

```
You: Show me yesterday's performance
```

**What AI Does:**
- Pulls yesterday's data
- Compares to 30-day average
- Highlights changes

**Output:**
- Daily summary
- Spend, conversions, ROAS
- Anomalies vs baseline
- Quick wins

---

### 4. Find Wasted Spend

```
You: Where am I wasting money?
```

**What AI Does:**
- Analyzes all campaigns
- Calculates profitability
- Identifies negative ROI
- Sorts by dollar impact

**Output:**
- Total waste per month
- Top offending campaigns
- Specific issues
- Expected savings if fixed

---

### 5. Scaling Opportunities

```
You: What should I scale?
```

**What AI Does:**
- Finds profitable campaigns
- Checks frequency/CPM health
- Calculates headroom
- Recommends budget increases

**Output:**
- Top scaling candidates
- Current vs recommended budget
- Expected gains
- Cautions (if any)

---

### 6. Specific Campaign Analysis

```
You: Analyze campaign "Summer Sale 2026"
```

**What AI Does:**
- Deep-dive specific campaign
- Pulls ad set and ad data
- Checks creative fatigue
- Calculates profitability

**Output:**
- Campaign performance
- Key metrics vs benchmarks
- Issues found
- Specific recommendations

---

## 🔧 Troubleshooting

### Issue 1: "No Meta Ads MCP server detected"

**Cause:** MCP server tidak terdeteksi

**Fix:**
```bash
# 1. Check .mcp.json exists
cat .mcp.json

# 2. Check path correct
which node
npm list -g meta-ads-agent-skill

# 3. Restart AI agent
```

---

### Issue 2: "Access token invalid"

**Cause:** Token expired atau salah

**Fix:**
```bash
# Get new token from Graph API Explorer
# https://developers.facebook.com/tools/explorer

# Update environment variable
export META_ACCESS_TOKEN="new_token_here"
```

---

### Issue 3: "Ad account not found"

**Cause:** Account ID salah atau tidak punya akses

**Fix:**
```bash
# 1. Check format (must include act_ prefix)
export META_AD_ACCOUNT_ID="act_123456789"

# 2. List available accounts
curl "https://graph.facebook.com/v20.0/me/adaccounts?access_token=YOUR_TOKEN"

# 3. Verify access in Meta Business Manager
```

---

## 📁 File Structure

Ketika AI agent membaca skills, struktur yang diakses:

```
node_modules/meta-ads-agent-skill/
├── skills/
│   └── meta-ads/
│       ├── audit/
│       │   └── SKILL.md
│       ├── manage/
│       │   └── SKILL.md
│       └── shared/
│           ├── preamble.md
│           ├── meta-math.md
│           └── references/
│               ├── analysis-heuristics.md
│               └── creative-fatigue.md
└── mcp-server/
    └── dist/
        └── index.js
```

---

## 🎓 How It Works

### Flow Diagram

```
User Question
    ↓
AI Agent (Claude)
    ↓
Read skills/meta-ads/shared/preamble.md
    ↓
Detect MCP Server (meta-ads-agent-skill)
    ↓
Load Config (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID)
    ↓
Read Appropriate Skill
    ├─ audit/SKILL.md (for "Audit my Meta ads")
    └─ manage/SKILL.md (for "How are my campaigns?")
    ↓
Call MCP Tools
    ├─ getCampaigns
    ├─ getCampaignInsights
    ├─ getAdsetInsights
    └─ getAdsInsights
    ↓
Read References
    ├─ meta-math.md (benchmarks)
    ├─ analysis-heuristics.md (decision trees)
    └─ creative-fatigue.md (fatigue diagnosis)
    ↓
Generate Report
    ├─ Scorecard
    ├─ Top 3 Issues
    ├─ Recommendations
    └─ Expected Impact
    ↓
Save Context (optional)
    ├─ .meta-ads/business-context.json
    ├─ .meta-ads/personas.json
    └─ .meta-ads/account-baseline.json
    ↓
Return to User
```

---

## 💾 Data Persistence

AI agent akan menyimpan data di:

**Project-local** (jika `.meta-ads.json` exists):
```
your-project/
└── .meta-ads/
    ├── business-context.json
    ├── personas.json
    └── account-baseline.json
```

**Global** (jika tidak ada project config):
```
~/.meta-ads/
├── business-context.json
├── personas.json
└── account-baseline.json
```

**Important:** Add `.meta-ads/` to `.gitignore`!

---

## 🔐 Security Best Practices

### 1. Never Commit Tokens

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".meta-ads.json" >> .gitignore
echo ".meta-ads/" >> .gitignore
```

### 2. Use System User Token (Production)

For production or autonomous agents:
- Create System User in Meta Business Manager
- Generate permanent token
- Assign "Analyst" role to ad account

### 3. Rotate Tokens Regularly

Check token expiry and rotate every 60-90 days.

---

## 📚 Additional Resources

- **Main README:** README.md
- **Skills Overview:** skills/README.md
- **Quick Start:** QUICK_START_SKILLS.md
- **Migration Guide:** SKILL_MIGRATION.md
- **Roadmap:** ROADMAP.md

---

## ❓ FAQ

**Q: Do I need to code?**  
A: No! Just ask questions in natural language.

**Q: Can AI make changes automatically?**  
A: Not yet (read-only in v0.3). Write operations coming in v0.4.

**Q: How does AI know my business?**  
A: After first audit, it saves business-context.json with your info.

**Q: Can I use this for multiple ad accounts?**  
A: Yes, configure multiple MCP servers.

**Q: Is my data safe?**  
A: Yes. Everything runs locally. No data sent to external servers (except Meta API).

---

**Version:** v0.3.0  
**Last Updated:** 2026-05-29  
**Status:** Production Ready ✅
