# 📍 Lokasi Project

**Project:** meta-ads-agent-skill
**Lokasi:** `/Users/macbook/Projects/meta-ads-agent-skill`
**Status:** ✅ Ready to use
**Tanggal:** 2026-05-28

## Quick Access

```bash
cd ~/Projects/meta-ads-agent-skill
```

## Struktur Lengkap

```
/Users/macbook/Projects/meta-ads-agent-skill/
├── src/                    # Source code
│   ├── index.ts           # Main export
│   ├── metaClient.ts      # API client
│   ├── config.ts          # Config loader
│   ├── types.ts           # TypeScript types
│   ├── tools/             # 6 tools (getAdAccounts, getCampaigns, dll)
│   ├── analysis/          # 2 analyzers
│   └── utils/             # 3 utilities
├── examples/              # 2 contoh penggunaan
├── tests/                 # Test suite
├── dist/                  # Build output
├── README.md              # Dokumentasi lengkap
├── LICENSE                # MIT License
└── package.json           # NPM config

Total: 32 files
```

## Commands

```bash
# Masuk ke folder project
cd ~/Projects/meta-ads-agent-skill

# Install dependencies (sudah terinstall)
npm install

# Build
npm run build

# Test
npm run test

# Run examples (perlu .env dulu)
npm run example:daily-report
npm run example:campaign-audit
```

## Setup untuk Digunakan

1. Copy `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` dengan credentials Meta Ads kamu:
   ```env
   META_ACCESS_TOKEN=your_token_here
   META_AD_ACCOUNT_ID=act_123456789
   META_API_VERSION=v20.0
   ```

3. Run example:
   ```bash
   npm run example:daily-report
   ```

## Push ke GitHub

```bash
cd ~/Projects/meta-ads-agent-skill
git init
git add .
git commit -m "Initial commit: MVP v0.1.0"
git remote add origin https://github.com/username/meta-ads-agent-skill.git
git push -u origin main
```

---

✅ Project siap digunakan dan di-push ke GitHub!
