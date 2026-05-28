# 🚀 Push to GitHub Instructions

## Step 1: Create GitHub Repository

1. Buka https://github.com/new
2. Repository name: `meta-ads-agent-skill`
3. Description: `Read-only Meta Ads insights toolkit for AI agents`
4. Visibility: **Public** (untuk open source)
5. **JANGAN** initialize dengan README, .gitignore, atau license (sudah ada)
6. Click **Create repository**

## Step 2: Add Remote dan Push

Setelah repository dibuat, jalankan commands ini:

```bash
cd ~/Projects/meta-ads-agent-skill

# Add remote (ganti USERNAME dengan GitHub username kamu)
git remote add origin https://github.com/USERNAME/meta-ads-agent-skill.git

# Atau jika pakai SSH:
# git remote add origin git@github.com:USERNAME/meta-ads-agent-skill.git

# Push ke GitHub
git branch -M main
git push -u origin main
```

## Step 3: Add Topics (Optional tapi Recommended)

Di GitHub repository page:
1. Click ⚙️ (Settings) atau "Add topics"
2. Tambahkan topics:
   - `meta-ads`
   - `facebook-ads`
   - `marketing-api`
   - `ai-agent`
   - `typescript`
   - `read-only`
   - `insights`
   - `nodejs`

## Step 4: Verify

Setelah push berhasil, verify:
- ✅ README.md tampil dengan baik
- ✅ AGENTS.md ada dan readable
- ✅ License badge (MIT)
- ✅ All files uploaded (35 files)

## Quick Command Summary

```bash
# 1. Create repo di GitHub dulu
# 2. Kemudian:
git remote add origin https://github.com/USERNAME/meta-ads-agent-skill.git
git branch -M main
git push -u origin main
```

## Troubleshooting

**Error: remote origin already exists**
```bash
git remote remove origin
git remote add origin https://github.com/USERNAME/meta-ads-agent-skill.git
```

**Error: authentication failed**
- Pastikan sudah login ke GitHub
- Atau gunakan Personal Access Token
- Atau setup SSH key

---

✅ Commit sudah dibuat: `41131e0`
✅ 35 files ready to push
✅ Siap untuk open source release!
