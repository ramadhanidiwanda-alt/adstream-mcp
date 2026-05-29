# Perbandingan: meta-ads-agent-skill vs pipeboard-co/meta-ads-mcp

**Date:** 2026-05-29  
**Your Project:** meta-ads-agent-skill v0.3.0  
**Their Project:** pipeboard-co/meta-ads-mcp v1.0.112

---

## 🎯 TL;DR: Perbedaan Utama

| Aspek | Your Project | Pipeboard Meta Ads MCP |
|-------|--------------|------------------------|
| **Bahasa** | TypeScript | Python |
| **Fokus** | Library + Skills (hybrid) | MCP Server (cloud-hosted) |
| **Target** | Developers + End users | End users (marketers) |
| **Deployment** | Self-hosted | Cloud-hosted (pipeboard.co) |
| **Write Operations** | ❌ Read-only (v0.3) | ✅ Full write (pause, budget, create) |
| **Tools** | 6 read tools | 42 tools (read + write) |
| **Business Model** | Open source (MIT) | BUSL-1.1 (commercial) |
| **Multi-platform** | ❌ Meta only | ✅ 5 platforms (230+ tools) |
| **Auth** | Manual token | OAuth via pipeboard.co |
| **Lines of Code** | ~1,909 TS + ~1,318 MD | ~9,886 Python |

---

## 📊 Detailed Comparison

### 1. Architecture

**Your Project:**
```
meta-ads-agent-skill/
├── src/                    # TypeScript library
│   ├── metaClient.ts
│   ├── tools/ (6 functions)
│   ├── analysis/
│   ├── rules/ (26 templates)
│   └── utils/
├── skills/                 # AI skills (markdown)
│   └── meta-ads/
│       ├── audit/SKILL.md
│       ├── manage/SKILL.md
│       └── shared/
└── mcp-server/             # MCP wrapper
    └── src/index.ts

Total: ~1,909 lines TypeScript + ~1,318 lines markdown
```

**Pipeboard:**
```
meta-ads-mcp/
└── meta_ads_mcp/
    └── core/
        ├── accounts.py
        ├── ads.py (166KB!)
        ├── adsets.py
        ├── campaigns.py
        ├── insights.py
        ├── targeting.py
        ├── auth.py
        └── ... (21 Python files)

Total: ~9,886 lines Python
```

---

### 2. Features Comparison

#### Your Project (v0.3.0)

**Read Operations (6 tools):**
- ✅ getAdAccounts
- ✅ getCampaigns
- ✅ getCampaignInsights
- ✅ getAdsetInsights
- ✅ getAdsInsights
- ✅ generateDailyReport

**Analysis Features:**
- ✅ Rule engine (26 templates)
- ✅ Performance analysis
- ✅ Recommendations
- ✅ AI Skills layer (audit, manage)
- ✅ Business context persistence
- ✅ Anomaly detection
- ✅ Creative fatigue diagnosis

**Write Operations:**
- ❌ None (read-only in v0.3)
- 🔜 Coming in v0.4.0

#### Pipeboard (v1.0.112)

**Read Operations (15+ tools):**
- ✅ Get ad accounts
- ✅ Get campaigns
- ✅ Get ad sets
- ✅ Get ads
- ✅ Get insights
- ✅ Get creatives
- ✅ Get pages
- ✅ Search interests
- ✅ Search behaviors
- ✅ Search demographics
- ✅ Search geo locations
- ✅ Get targeting options
- ✅ Validate interests
- ✅ Get interest suggestions
- ✅ Generic search

**Write Operations (27+ tools):**
- ✅ Create campaigns
- ✅ Update campaigns
- ✅ Pause/enable campaigns
- ✅ Create ad sets
- ✅ Update ad sets
- ✅ Pause/enable ad sets
- ✅ Create ads
- ✅ Update ads
- ✅ Pause/enable ads
- ✅ Upload images
- ✅ Upload videos
- ✅ Create creatives
- ✅ Update budgets
- ✅ Create budget schedules
- ✅ Duplicate campaigns/ad sets/ads
- ✅ Batch operations
- ✅ And more...

**Total: 42 tools**

---

### 3. Business Model

**Your Project:**
- License: MIT (fully open source)
- Free forever
- Self-hosted
- No commercial restrictions
- Community-driven

**Pipeboard:**
- License: BUSL-1.1 (Business Source License)
- Free to use, but cannot offer as competing hosted service
- Becomes Apache 2.0 on January 1, 2029
- Commercial product (pipeboard.co)
- Part of larger ecosystem (5 platforms)

---

### 4. Deployment Model

**Your Project:**
- Self-hosted MCP server
- Runs locally on user's machine
- User manages tokens
- User controls everything
- No external dependencies (except Meta API)

**Pipeboard:**
- Cloud-hosted MCP server
- Runs at `https://meta-ads.mcp.pipeboard.co/`
- OAuth via pipeboard.co
- Managed service
- Part of Pipeboard ecosystem

---

### 5. Multi-Platform Support

**Your Project:**
- ❌ Meta Ads only
- 🔜 Could expand in future

**Pipeboard:**
- ✅ Meta Ads (42 tools)
- ✅ Google Ads (59 tools)
- ✅ TikTok Ads (59 tools)
- ✅ Snap Ads (37 tools)
- ✅ Reddit Ads (33 tools)
- **Total: 230+ tools across 5 platforms**
- One auth for all platforms

---

### 6. Authentication

**Your Project:**
```bash
# Manual token setup
export META_ACCESS_TOKEN="EAAxxxxx..."
export META_AD_ACCOUNT_ID="act_123456789"
```

**Pipeboard:**
```bash
# OAuth via browser
# Sign in at pipeboard.co
# Token managed automatically
# No manual token handling
```

---

### 7. Code Complexity

**Your Project:**
- TypeScript (type-safe)
- ~1,909 lines code
- ~1,318 lines markdown (skills)
- Clean, modular structure
- Easy to understand

**Pipeboard:**
- Python
- ~9,886 lines code
- Single `ads.py` file is 166KB!
- More complex (handles 42 tools)
- Production-grade

---

### 8. Target Audience

**Your Project:**
- Primary: Developers (TypeScript library)
- Secondary: End users (AI skills)
- Hybrid approach

**Pipeboard:**
- Primary: End users (marketers)
- Secondary: Developers (via CLI)
- Cloud-first approach

---

### 9. Unique Features

**Your Project:**
- ✅ TypeScript library (programmatic access)
- ✅ Rule engine (26 templates)
- ✅ AI Skills layer (markdown-based)
- ✅ Business context persistence
- ✅ Anomaly detection
- ✅ Creative fatigue diagnosis
- ✅ Industry benchmarks
- ✅ Dollar-denominated recommendations
- ✅ Self-hosted (full control)

**Pipeboard:**
- ✅ Full write operations
- ✅ Creative upload (images, videos)
- ✅ Campaign creation
- ✅ Targeting tools (interests, behaviors, demographics)
- ✅ Batch operations
- ✅ Multi-platform (5 ad platforms)
- ✅ Managed service (no setup)
- ✅ Pipeboard CLI (Go binary)
- ✅ Production-ready write operations

---

## 🆚 Head-to-Head Comparison

### Strengths of Your Project

1. **TypeScript Library**
   - Full programmatic control
   - Type-safe
   - Can be embedded in other projects

2. **AI Skills Layer**
   - Markdown-based instructions
   - AI interprets heuristics
   - Easy to update (no code changes)

3. **Rule Engine**
   - 26 pre-built templates
   - Custom rules
   - Flexible evaluation

4. **Analysis Features**
   - Business context persistence
   - Anomaly detection
   - Creative fatigue diagnosis
   - Industry benchmarks
   - Dollar-denominated recommendations

5. **Self-Hosted**
   - Full control
   - No external dependencies
   - Privacy-focused

6. **Open Source (MIT)**
   - Truly free
   - No restrictions
   - Community-driven

### Strengths of Pipeboard

1. **Full Write Operations**
   - Create campaigns, ad sets, ads
   - Upload creatives
   - Update budgets
   - Pause/enable
   - Production-ready

2. **More Tools**
   - 42 tools vs your 6 tools
   - Comprehensive coverage
   - Targeting tools

3. **Multi-Platform**
   - 5 ad platforms (230+ tools)
   - One auth for all
   - Cross-platform analysis

4. **Managed Service**
   - No setup required
   - OAuth handled
   - Always up-to-date

5. **Production-Grade**
   - Battle-tested
   - ~10k lines of code
   - Commercial product

6. **Pipeboard CLI**
   - Go binary (fast)
   - Shell-friendly
   - All platforms in one binary

---

## 💡 Key Insights

### 1. Different Philosophy

**Your Project:**
- "Build a library that developers can use"
- "Add skills layer for end users"
- "Self-hosted, full control"

**Pipeboard:**
- "Build a managed service"
- "Make it easy for marketers"
- "Cloud-hosted, no setup"

### 2. Different Scope

**Your Project:**
- Meta Ads only
- Read-only (v0.3)
- Analysis-focused

**Pipeboard:**
- 5 ad platforms
- Full read/write
- Operations-focused

### 3. Different Business Model

**Your Project:**
- Open source (MIT)
- Free forever
- Community-driven

**Pipeboard:**
- BUSL-1.1 (commercial)
- Free to use, but restricted
- Commercial product

---

## 🎯 Which One to Choose?

### Choose Your Project If:

- ✅ You want full control (self-hosted)
- ✅ You need TypeScript library
- ✅ You want to customize everything
- ✅ You prefer open source (MIT)
- ✅ You want AI skills layer
- ✅ You need rule engine
- ✅ You want analysis features
- ✅ You're okay with read-only (for now)
- ✅ You want to learn and contribute

### Choose Pipeboard If:

- ✅ You need write operations NOW
- ✅ You want managed service (no setup)
- ✅ You need multi-platform (5 platforms)
- ✅ You want 230+ tools
- ✅ You prefer OAuth (no manual tokens)
- ✅ You need creative upload
- ✅ You need campaign creation
- ✅ You want production-ready solution
- ✅ You're willing to use commercial product

---

## 🚀 Roadmap Comparison

### Your Project Roadmap

- ✅ v0.1.0 - Foundation (read-only)
- ✅ v0.2.0 - Rule engine
- ✅ v0.3.0 - AI skills layer
- 🔜 v0.4.0 - Write operations
- 🔜 v0.5.0 - OAuth
- 🔜 v0.6.0 - Multi-account
- 🔜 v1.0.0 - Production ready

**Timeline:** 8 months to v1.0.0

### Pipeboard Status

- ✅ v1.0.112 - Already production
- ✅ Full write operations
- ✅ Multi-platform
- ✅ OAuth
- ✅ 230+ tools
- ✅ Commercial product

**Status:** Already at v1.0+

---

## 📊 Feature Matrix

| Feature | Your Project | Pipeboard |
|---------|--------------|-----------|
| **Read Operations** | ✅ 6 tools | ✅ 15+ tools |
| **Write Operations** | ❌ v0.3 (🔜 v0.4) | ✅ 27+ tools |
| **TypeScript Library** | ✅ | ❌ |
| **Python Library** | ❌ | ✅ |
| **AI Skills Layer** | ✅ | ❌ |
| **Rule Engine** | ✅ 26 templates | ❌ |
| **Analysis Features** | ✅ Advanced | ❌ |
| **Business Context** | ✅ | ❌ |
| **Anomaly Detection** | ✅ | ❌ |
| **Creative Upload** | ❌ | ✅ |
| **Campaign Creation** | ❌ | ✅ |
| **Targeting Tools** | ❌ | ✅ |
| **Multi-Platform** | ❌ Meta only | ✅ 5 platforms |
| **Self-Hosted** | ✅ | ❌ |
| **Cloud-Hosted** | ❌ | ✅ |
| **OAuth** | 🔜 v0.5 | ✅ |
| **Manual Token** | ✅ | ❌ |
| **Open Source** | ✅ MIT | ⚠️ BUSL-1.1 |
| **CLI** | ❌ | ✅ Go binary |
| **Lines of Code** | ~3,227 | ~9,886 |

---

## 🎓 Lessons Learned

### What Pipeboard Does Better

1. **Write Operations** - They have full CRUD, you don't (yet)
2. **Multi-Platform** - 5 platforms vs your 1
3. **Managed Service** - No setup vs your self-hosted
4. **Production-Ready** - v1.0+ vs your v0.3
5. **More Tools** - 42 vs your 6

### What You Do Better

1. **TypeScript Library** - They don't have this
2. **AI Skills Layer** - They don't have this
3. **Rule Engine** - They don't have this
4. **Analysis Features** - More advanced than theirs
5. **Open Source** - MIT vs their BUSL-1.1
6. **Self-Hosted** - Full control vs their cloud-only

---

## 💡 Strategic Positioning

### Your Unique Value Proposition

**"The only open-source Meta Ads toolkit with AI-native skills and advanced analysis"**

- ✅ TypeScript library (programmatic)
- ✅ AI skills (natural language)
- ✅ Rule engine (customizable)
- ✅ Advanced analysis (context-aware)
- ✅ Self-hosted (full control)
- ✅ MIT license (truly free)

### Pipeboard's Value Proposition

**"The easiest way to manage ads across 5 platforms with AI"**

- ✅ Managed service (no setup)
- ✅ Multi-platform (230+ tools)
- ✅ Full write operations
- ✅ Production-ready
- ✅ Commercial support

---

## 🎯 Recommendation

**Your project is NOT competing with Pipeboard.**

You serve different audiences:

**Your Project:**
- Developers who want control
- Users who want analysis
- Users who want self-hosted
- Users who want open source

**Pipeboard:**
- Marketers who want easy
- Users who need write ops
- Users who want multi-platform
- Users who want managed service

**You can coexist!**

In fact, you could even **complement** each other:
- Your analysis features + their write operations
- Your self-hosted + their cloud option
- Your open source + their commercial

---

## 📝 Action Items for Your Project

Based on this comparison, here's what you should prioritize:

### High Priority (v0.4.0)

1. **Write Operations** - This is the biggest gap
   - Pause/enable campaigns
   - Update budgets
   - Basic mutations

### Medium Priority (v0.5.0)

2. **OAuth Flow** - Easier than manual tokens
3. **More Read Tools** - Match their 15+ read tools

### Low Priority (Future)

4. **Multi-Platform** - Only if there's demand
5. **Creative Upload** - Nice to have

### Keep Your Unique Features

- ✅ TypeScript library
- ✅ AI skills layer
- ✅ Rule engine
- ✅ Analysis features
- ✅ Self-hosted option

---

## 🎉 Conclusion

**Your project is DIFFERENT, not WORSE.**

- Pipeboard: Commercial, cloud-hosted, multi-platform, write-heavy
- Your project: Open source, self-hosted, single-platform, analysis-heavy

**Both have value!**

Your unique strengths:
- TypeScript library
- AI skills layer
- Rule engine
- Advanced analysis
- MIT license

Focus on these, and you'll have a strong position in the market! 🚀

---

**Version:** Comparison v1.0  
**Date:** 2026-05-29  
**Status:** Complete
