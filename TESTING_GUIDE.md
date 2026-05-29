# 🧪 Testing Guide - Meta Ads Agent Skill di Codex

**Tanggal:** 2026-05-29  
**Lokasi Skill:** `/Users/macbook/Projects/meta-ads-agent-skill`

---

## 📋 Prerequisites

### 1. Meta Access Token
Anda perlu Meta Access Token dengan permission `ads_read`.

**Cara dapat token:**
1. Buka https://developers.facebook.com/tools/explorer
2. Pilih Meta App Anda (atau buat baru)
3. Klik "Permissions" → Add `ads_read`
4. Klik "Generate Access Token"
5. Copy token (format: `EAAxxxxxxxxxx`)

### 2. Ad Account ID
1. Buka https://business.facebook.com/adsmanager
2. Lihat URL: `https://business.facebook.com/adsmanager/manage/campaigns?act=123456789`
3. Ad Account ID Anda: `act_123456789`

---

## 🚀 Setup Step-by-Step

### Step 1: Set Environment Variables

**Option A: Temporary (untuk testing)**
```bash
# Di terminal yang sama dengan Codex
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
export META_API_VERSION="v20.0"

# Verify
echo $META_ACCESS_TOKEN
echo $META_AD_ACCOUNT_ID
```

**Option B: Permanent (recommended)**
```bash
# Edit ~/.zshrc
nano ~/.zshrc

# Tambahkan di akhir file:
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"
export META_API_VERSION="v20.0"

# Save (Ctrl+O, Enter, Ctrl+X)

# Reload
source ~/.zshrc

# Verify
echo $META_ACCESS_TOKEN
```

---

### Step 2: Verify Skill Location

```bash
# Cek SKILL.md ada
ls -la /Users/macbook/Projects/meta-ads-agent-skill/SKILL.md

# Cek isi SKILL.md
head -20 /Users/macbook/Projects/meta-ads-agent-skill/SKILL.md
```

**Expected output:**
```
# Meta Ads Agent Skill

AI-powered Meta (Facebook) Ads analysis and reporting toolkit...
```

---

### Step 3: Build Skill (jika belum)

```bash
cd /Users/macbook/Projects/meta-ads-agent-skill
npm install
npm run build
```

**Expected output:**
```
✅ Build success in ~200ms
```

---

## 🧪 Testing Scenarios

### Test 1: Basic Token Validation

**Test manual dulu sebelum pakai Codex:**

```bash
cd /Users/macbook/Projects/meta-ads-agent-skill

# Test dengan Node.js
node -e "
import { loadConfig, validateTokenFormat, maskToken } from './dist/index.js';

try {
  const config = loadConfig();
  console.log('✅ Config loaded successfully');
  console.log('Token valid:', validateTokenFormat(config.accessToken));
  console.log('Token (masked):', maskToken(config.accessToken));
  console.log('Account ID:', config.adAccountId);
} catch (error) {
  console.error('❌ Error:', error.message);
}
"
```

**Expected output:**
```
✅ Config loaded successfully
Token valid: true
Token (masked): EAAxxxxxxx...
Account ID: act_123456789
```

**Jika error:**
- `META_ACCESS_TOKEN is required` → Set environment variable
- `Invalid Meta access token format` → Token harus mulai dengan `EAA`
- `Invalid ad account ID format` → Account ID harus mulai dengan `act_`

---

### Test 2: Test API Connection

```bash
cd /Users/macbook/Projects/meta-ads-agent-skill

# Run example script
npm run example:daily-report
```

**Expected output:**
```
Generating daily report for 2026-05-28 to 2026-05-29...

{
  "summary": {
    "totalSpend": 4500,
    "totalImpressions": 150000,
    ...
  }
}
```

**Jika error:**
- `Invalid OAuth access token` → Token expired atau invalid
- `Ad account not found` → Account ID salah atau no access
- `Network error` → Check internet connection

---

### Test 3: Testing di Codex CLI

**Sekarang test dengan Codex:**

#### 3.1. Start Codex Session

```bash
# Pastikan environment variables sudah set
echo $META_ACCESS_TOKEN
echo $META_AD_ACCOUNT_ID

# Start Codex di folder skill
cd /Users/macbook/Projects/meta-ads-agent-skill
codex
```

#### 3.2. Test Prompt 1 - Simple Query

**Prompt:**
```
Check my Meta Ads performance from yesterday
```

**Expected Behavior:**
1. Codex detects "Meta Ads" keyword
2. Codex loads SKILL.md
3. Codex calls `generateDailyReport()`
4. Codex responds with summary

**Expected Response:**
```
I'll generate a daily report for your Meta Ads campaigns from yesterday.

[Codex calls generateDailyReport with yesterday's date]

Here's your performance summary for May 28, 2026:
- Total Spend: $4,500
- Total Clicks: 12,000
- Average CTR: 0.8%
- Average CPC: $0.38

Issues found:
1. [HIGH] Summer Sale Campaign - High spend but low CTR
   Action: Test new ad creatives

Want me to analyze any specific campaign in detail?
```

---

#### 3.3. Test Prompt 2 - Campaign Audit

**Prompt:**
```
Audit all my Meta Ads campaigns from last week
```

**Expected Behavior:**
1. Codex calculates last 7 days
2. Codex calls `getCampaignInsights()`
3. Codex calls `analyzeCampaignPerformance()`
4. Codex applies rule engine
5. Codex responds with structured report

**Expected Response:**
```
I'll fetch and analyze your campaigns from the last 7 days.

[Codex calls getCampaignInsights]
[Codex calls analyzeCampaignPerformance]

Campaign Audit Report (May 22-28, 2026):

Analyzed: 12 campaigns
Total Spend: $31,500

🚨 High Priority Issues (3 campaigns):
1. Summer Sale Campaign
   - Triggered Rules: High Spend Low CTR, Creative Fatigue
   - Spend: $8,500 | CTR: 0.4% | CPC: $0.85
   - Actions: Refresh creatives, test new audiences

2. Product Launch Campaign
   - Triggered Rules: Expensive Conversions
   - Spend: $6,200 | Cost per Purchase: $124
   - Actions: Optimize landing page, review targeting

⚠️ Medium Priority (4 campaigns):
[...]

✅ Good Performance (5 campaigns):
[...]

Would you like me to dive deeper into any specific campaign?
```

---

#### 3.4. Test Prompt 3 - Custom Analysis

**Prompt:**
```
Show me all Meta Ads campaigns with CTR below 0.5% and spend above $1000
```

**Expected Behavior:**
1. Codex calls `getCampaignInsights()`
2. Codex filters by CTR < 0.5% AND spend > $1000
3. Codex applies relevant rules
4. Codex responds with filtered results

**Expected Response:**
```
I'll fetch campaign insights and filter by your criteria.

[Codex calls getCampaignInsights]

Found 3 campaigns matching your criteria (CTR < 0.5%, Spend > $1000):

1. Campaign A
   - CTR: 0.3%
   - Spend: $2,100
   - CPC: $0.70
   - Issue: Low engagement, high cost
   - Recommendation: Test new creatives or pause

2. Campaign B
   - CTR: 0.4%
   - Spend: $1,800
   - CPC: $0.45
   - Issue: Creative fatigue
   - Recommendation: Refresh ad creative

3. Campaign C
   - CTR: 0.45%
   - Spend: $1,200
   - CPC: $0.38
   - Issue: Targeting too broad
   - Recommendation: Narrow audience targeting

Want me to generate optimization recommendations for these campaigns?
```

---

#### 3.5. Test Prompt 4 - Rule Engine

**Prompt:**
```
Analyze my Meta Ads campaigns with e-commerce rules
```

**Expected Behavior:**
1. Codex calls `getCampaignInsights()`
2. Codex applies `ecommerceRules` (6 rules)
3. Codex responds with rule-based analysis

**Expected Response:**
```
I'll analyze your campaigns using e-commerce optimization rules.

[Codex calls getCampaignInsights]
[Codex applies ecommerceRules]

E-commerce Rule Analysis:

Applied 6 e-commerce rules:
✅ High Spend Low ROAS
✅ High Spend Low Purchases
✅ Expensive Conversions
✅ Good CTR Low Conversions
✅ Scaling Opportunity
✅ Low Spend Testing Phase

Results:

🚨 High Priority (2 campaigns):
1. Summer Sale - High Spend Low ROAS
   - Spend: $8,500 | ROAS: 1.2x
   - Action: Optimize product targeting or pause

2. Product Launch - Expensive Conversions
   - Cost per Purchase: $124
   - Action: Improve landing page conversion rate

💡 Scaling Opportunities (1 campaign):
1. Brand Campaign
   - ROAS: 4.5x | CTR: 2.1%
   - Action: Increase budget by 20-30%

Want detailed recommendations for any campaign?
```

---

## 🐛 Troubleshooting

### Issue 1: Codex tidak detect skill

**Symptom:**
```
Codex responds generically without calling Meta Ads tools
```

**Solution:**
```bash
# 1. Verify SKILL.md exists
ls -la /Users/macbook/Projects/meta-ads-agent-skill/SKILL.md

# 2. Check Codex can access the file
cat /Users/macbook/Projects/meta-ads-agent-skill/SKILL.md | head -20

# 3. Try explicit prompt
codex
> Use the Meta Ads skill to check my campaign performance
```

---

### Issue 2: Environment variables tidak terbaca

**Symptom:**
```
Error: META_ACCESS_TOKEN is required
```

**Solution:**
```bash
# 1. Check variables in current shell
echo $META_ACCESS_TOKEN
echo $META_AD_ACCOUNT_ID

# 2. If empty, set them
export META_ACCESS_TOKEN="EAAxxxxxxxxxx"
export META_AD_ACCOUNT_ID="act_123456789"

# 3. Restart Codex in same terminal
codex
```

---

### Issue 3: Token invalid atau expired

**Symptom:**
```
Error: Invalid OAuth access token
```

**Solution:**
```bash
# 1. Generate new token
# Go to: https://developers.facebook.com/tools/explorer
# Generate new token with ads_read permission

# 2. Update environment variable
export META_ACCESS_TOKEN="NEW_TOKEN_HERE"

# 3. Test manually first
cd /Users/macbook/Projects/meta-ads-agent-skill
npm run example:daily-report
```

---

### Issue 4: No data returned

**Symptom:**
```
Report shows empty or no campaigns
```

**Possible Causes:**
1. **No campaigns in date range** → Try wider date range
2. **Wrong ad account ID** → Verify account ID
3. **No permission** → Check token has ads_read permission
4. **Account has no data** → Use test account with data

**Solution:**
```bash
# Test with different date range
codex
> Show me Meta Ads campaigns from last 30 days
```

---

## ✅ Success Criteria

Skill berfungsi dengan baik jika:

1. ✅ Environment variables terbaca
2. ✅ Token validation berhasil
3. ✅ API connection berhasil (manual test)
4. ✅ Codex detect keyword "Meta Ads"
5. ✅ Codex load SKILL.md
6. ✅ Codex call appropriate tools
7. ✅ Codex respond dengan natural language
8. ✅ Data dari Meta API muncul di response

---

## 📊 Test Checklist

```
[ ] Environment variables set
[ ] Token validated (manual test)
[ ] API connection works (npm run example:daily-report)
[ ] SKILL.md exists and readable
[ ] Codex started in correct directory
[ ] Test Prompt 1: Daily report ✅
[ ] Test Prompt 2: Campaign audit ✅
[ ] Test Prompt 3: Custom filter ✅
[ ] Test Prompt 4: Rule engine ✅
[ ] Error handling works correctly
```

---

## 🎯 Next Steps After Testing

Jika semua test berhasil:

1. ✅ Document any issues found
2. ✅ Share feedback or improvements
3. ✅ Use skill for real campaign analysis
4. ✅ Explore other prompts and workflows

Jika ada issues:
1. Check troubleshooting section
2. Verify all prerequisites
3. Test manually first (npm run example:*)
4. Open issue di GitHub dengan error details

---

## 📞 Need Help?

**Documentation:**
- SKILL.md - Skill definition
- README.md - Setup guide
- INTEGRATION_COMPLETE.md - Integration guide

**Support:**
- GitHub Issues: https://github.com/ramadhanidiwanda-alt/meta-ads-agent-skill/issues
- Check logs for error details
- Test manually before using Codex

---

**Happy Testing!** 🚀
