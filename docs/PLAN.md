# Master Plan — Adstream MCP (Cuan Insight Ads MCP Connector Hub)

> **Status Dokumen:** v2 (living document)
> **Terakhir Diupdate:** 2026-07-01
> **Versi Repo Saat Ini:** v0.6.0
> **Repo:** `adstream-mcp` (github.com/ramadhanidiwanda-alt/adstream-mcp)
> **Pemilik:** Project owner + maintainers
> **Scope:** Seluruh repository

Dokumen ini adalah rencana komprehensif untuk mentransformasi repo dari **Meta Ads toolkit** menjadi **client-agnostic, multi-platform Ads + Commerce MCP Connector Hub** untuk Cuan Insight, tetap open source (MIT).

Dokumen ini melengkapi (tidak menggantikan) `ROADMAP.md`, `docs/PROJECT_STATUS.md`, dan `docs/WRITE_SAFETY_CONTRACT.md`. Jika ada konflik, urutan otoritas: `docs/WRITE_SAFETY_CONTRACT.md` (keamanan) > `docs/PROJECT_STATUS.md` (status aktual) > `docs/PLAN.md` (arah) > `ROADMAP.md` (historis).

---

## 0. Keputusan Terkunci (Locked Decisions)

Keputusan owner per 2026-07-01. Ini mengunci urutan Fase 3–6 dan menutup open questions lama.

1. **Nama & brand** — Repo sudah rebrand menjadi `adstream-mcp` (lokal + GitHub). Rebrand dianggap **selesai**; tinggal sinkronisasi metadata paket (lihat Fase 0).
2. **Meta CPAS** — **Tidak** dibuat provider terpisah. CPAS tetap di adapter Meta sebagai mode/flag (catalog/partner ads).
3. **Prioritas platform berikutnya** — Setelah report engine: **Google Ads dulu**, baru marketplace Indonesia (izin API marketplace lebih sulit/lambat).
4. **Scope marketplace** — **Paralel**, kejar mana yang izin API-nya keluar lebih dulu (Shopee/Tokopedia/Lazada tidak diurutkan kaku).
5. **Create ads** — Urutan provider: **Meta → TikTok → sisanya menyusul**.
6. **Report & data surface** — **Dipisah**: `ads report` boleh berisi ringkasan audit/rekomendasi, sedangkan `commerce/GMV` diprioritaskan sebagai **normalized data JSON** agar AI client yang membuat analisa, laporan, dan rekomendasi.
7. **Multi-tenant RBAC** — **RBAC minimal disiapkan sebelum create ads** (read-only vs write-allowed per Connection Key + isolasi akun/tenant). RBAC lengkap (role custom, audit granular) di fase hardening.

---

## 1. Visi & Definisi Sukses

### 1.1 Visi

Menjadi **satu MCP server open source** yang memungkinkan AI agent apa pun (Claude, Codex, Cursor, OpenAI Responses, dsb.) untuk:

1. **Membaca** data performa iklan dan commerce di semua platform besar.
2. **Menganalisa** performa lintas platform dengan metrik yang ternormalisasi.
3. **Menyediakan data siap-analisa** untuk laporan harian/mingguan/audit/executive; MCP fokus pada JSON ternormalisasi, AI client fokus pada narasi.
4. **Membuat & mengubah iklan** dengan approval workflow dan safety guard yang ketat.
5. **Menjadi credential control plane** via Cuan Insight (token tidak pernah disimpan lokal).

Target platform akhir:

- **Ads:** Meta (termasuk CPAS sebagai mode), TikTok (reguler), TikTok GMV Max, Google Ads.
- **Marketplace / Commerce Ads Indonesia:** Shopee Ads, Tokopedia (TopAds), Lazada Sponsored, Blibli, dan marketplace lain sesuai izin API.

### 1.2 Target Pengguna

- **Primary:** End user non-teknis ("end user goblok") — marketer/UMKM yang butuh insight & aksi tanpa ribet.
- **Secondary:** Developer & agency yang integrasi via TypeScript library + MCP.
- **Tertiary:** Platform (Cuan Insight) sebagai credential + orchestration layer.

### 1.3 Definisi Sukses (Outcome, bukan output)

- Satu agent bisa menjawab: *"Audit semua iklan saya di semua platform minggu ini, buat laporan, dan sarankan aksi"* dalam satu percakapan.
- Menambah platform baru = implement 1 adapter + 1 credential mapping, tanpa mengubah broker/tool surface.
- Tidak ada satu pun token/secret bocor ke log, response, atau audit.
- Write & create operations selalu melewati dry-run → confirm → execute → audit.

---

## 2. Kondisi Saat Ini (Baseline Audit)

> Ringkasan dari audit 2026-07-02. Build sukses, 460 tests passing (38 files) setelah RBAC minimal foundation.

### 2.1 Sudah Kuat

- **Broker abstraction**: `AdsBroker`, `ProviderRegistry`, `CredentialResolver`, normalized `AdsMetricRecord` (`src/broker/`).
- **Generic MCP tools** `ads_*`: accounts, campaigns, performance (account/campaign/adset/ad/creative/placement), write (pause/resume/budget/rename) (`src/broker/mcpTools.ts`).
- **Credential authority = Cuan Insight**: local & remote mode, Connection Key, OAuth store (memory + Supabase) (`docs/PROJECT_STATUS.md`).
- **Transport**: stdio, SSE, Streamable HTTP dengan bearer/OAuth gating (`mcp-server/src/http.ts`).
- **Safety**: redaction (`redactErrorMessage`, `redactTokenLikeValues`), strip `raw`, credential-aware permission policy, `docs/WRITE_SAFETY_CONTRACT.md`.
- **Providers**: Meta (read + campaign write, CPAS mode), TikTok (regular read + GMV Max commerce), Google Ads (read foundation).

### 2.2 Gap Utama

| Area | Kondisi | Dampak |
|---|---|---|
| Provider IDs | `meta`, `tiktok`, `google` sudah masuk broker/provider registry | Marketplace belum masuk sampai izin API tersedia |
| Report engine | `ads_generate_report` sudah menghasilkan summary/audit account/campaign | Perlu reuse rule engine lama agar rekomendasi makin kaya |
| Cross-provider | Cross-provider report sudah mendukung partial failure dan mixed currency warning | Perlu perluasan fixture/path Google |
| TikTok adapter | account/campaign/adgroup/ad + placement performance implemented; GMV Max exposed via commerce data tool | TikTok regular + GMV read parity sudah masuk Fase 3 |
| Create ads | Belum ada (hanya campaign-level mutate) | "Membuat iklan" belum didukung |
| Commerce model | `CommerceRecord` + `commerce_get_performance provider=tiktok_gmv` sudah ada | Marketplace Indonesia masih menunggu izin API |
| Paket metadata | `package.json` sudah memakai `adstream-mcp` | Perlu dipertahankan konsisten di semua docs dan examples |
| Roadmap | `ROADMAP.md` tertinggal dari status aktual | Sinkronisasi perlu |
| Tool surface | Campuran `ads_*`, `meta_*`, `tiktok_*` | Perlu strategi stable vs legacy |
| RBAC | RBAC minimal awal: provider/account/scope read gating + default deny write | Perlu write/create scope policy lebih granular sebelum create ads |

### 2.3 Prinsip yang Dipertahankan

1. **Keamanan pertama** — token sacred, tidak pernah di-log.
2. **Client-agnostic** — bukan Claude-only.
3. **Type safety** — strict TS, ESM `.js` imports.
4. **Ramah agent** — tool + skill deskriptif.
5. **Kompleksitas bertahap** — read → analyze → report → write → create.

---

## 3. Arsitektur Target

### 3.1 Layer

```
AI Client (Claude / Codex / Cursor / Responses)
        │  MCP (stdio | SSE | Streamable HTTP)
        ▼
MCP Server (mcp-server/)  ── tool surface: ads_*/commerce_* (stable), *_legacy (compat)
        │
        ▼
Broker Layer (src/broker/)
  ├─ CredentialResolver ── Cuan Insight (Connection Key / OAuth) | ENV (local)
  ├─ ProviderRegistry ──── dynamic provider registration + capability matrix
  ├─ ReportEngine ──────── ads report & commerce report, single + cross-provider (NEW)
  ├─ AnalysisEngine ────── rules + heuristics + anomaly (existing, expand)
  ├─ AccessPolicy ──────── RBAC minimal: read/write + isolasi akun/tenant (NEW)
  └─ AuditLog ──────────── write/create audit trail (expand)
        │
        ▼
Provider Adapters (src/providers/<provider>/)
  ├─ meta/         (ads + cpas mode)
  ├─ tiktok/       (ads + gmv max)
  ├─ google/       (NEW)
  ├─ shopee/       (NEW, commerce)
  ├─ tokopedia/    (NEW, commerce)
  └─ lazada/       (NEW, commerce)
        │
        ▼
Provider APIs (Meta Graph, TikTok Business, Google Ads, Marketplace APIs)
```

### 3.2 Kontrak Inti (harus stabil sebelum ekspansi)

- **`AdsProviderAdapter`** — interface adapter (baca/tulis/laporan) yang setiap provider implement.
- **`AdsMetricRecord`** — schema metrik ternormalisasi lintas platform (ads).
- **`CommerceRecord`** (NEW) — schema commerce ternormalisasi (order/GMV/SKU/live/voucher) untuk marketplace & GMV Max; output utama commerce adalah JSON data, bukan narasi rekomendasi.
- **`CredentialContext`** — kontrak kredensial dengan `source` dan `provider`.
- **`AccessPolicy`** (NEW) — RBAC minimal: apakah kredensial boleh read/write/create + batas akun/tenant.
- **Write/Create lifecycle** — sesuai `docs/WRITE_SAFETY_CONTRACT.md`.

### 3.3 Provider Capability Matrix (rencana)

Setiap adapter mengekspos `capabilities` sehingga broker dan agent tahu apa yang didukung tanpa trial-error.

| Capability | meta | meta_cpas* | tiktok | tiktok_gmv | google | shopee | tokopedia | lazada |
|---|---|---|---|---|---|---|---|---|
| list_accounts | ✅ | ✅ | ✅ | ▶ | ✅ | ▶ | ▶ | ▶ |
| read_performance | ✅ | ✅ | ✅ | ✅ | ✅ | ▶ | ▶ | ▶ |
| placement_performance | ✅ | ✅ | ✅ | n/a | ▶ | ▶ | ▶ | ▶ |
| ads_report | ⬜ | ⬜ | ⬜ | n/a | ⬜ | ⬜ | ⬜ | ⬜ |
| commerce_data | n/a | n/a | ✅ | ✅ | n/a | ▶ | ▶ | ▶ |
| write_campaign | ✅ | ▶ | ⬜ | ⬜ | ▶ | ▶ | ▶ | ▶ |
| create_ad | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

`* meta_cpas` = mode di dalam adapter Meta, bukan provider terpisah.
Legenda: ✅ ada · 🟡 partial · ⬜ belum · ▶ direncanakan · n/a tidak relevan.

---

## 4. Rencana Rilis Bertahap

Prinsip urutan (sesuai keputusan §0): **stabilkan fondasi → report engine → cross-provider → TikTok parity + CPAS → Google Ads → RBAC minimal + write/create (Meta→TikTok) → marketplace/commerce → hardening**. Setiap fase punya exit criteria yang dapat diverifikasi.

### Fase 0 — Sinkronisasi & Fondasi (Target: Juli 2026)

**Goal:** Repo jujur dengan dirinya sendiri dan siap ekspansi tanpa breaking.

- [x] Sinkronkan brand: update `package.json` `name`/`description`/`repository.url` ke `adstream-mcp`; sesuaikan README.
- [x] Sinkronkan `ROADMAP.md` dengan `docs/PROJECT_STATUS.md` (OAuth sudah ada, TikTok sudah ada).
- [x] Definisikan **Provider Capability Matrix** sebagai kode (`capabilities` per adapter dipakai broker untuk gating).
- [x] Tambah `docs/PROVIDER_ONBOARDING.md`: langkah baku menambah provider baru.
- [x] Tandai tool surface: `ads_*`/`commerce_*` = stable public; `meta_*`/`tiktok_*` = legacy/debug.

**Exit:** build + test hijau; brand metadata konsisten; matrix capability dipakai broker; dokumen onboarding ada.

### Fase 1 — Report Engine (Target: Juli–Agustus 2026)

**Goal:** `ads_generate_report` benar-benar menghasilkan laporan, single-provider dulu. Ads report dan commerce report dipisah sejak desain.

- [x] Implement `ReportEngine` di `src/broker/` (input: provider, range, level, format, `report_kind: ads|commerce`).
- [x] Format laporan ads: `summary`, `daily`, `audit`, `executive` (mulai 1–2 dulu).
- [x] Output ternormalisasi + ringkasan naratif (findings, recommendations, disclaimer).
- [x] `ads_generate_report` memanggil `ReportEngine` (hapus `NOT_IMPLEMENTED`).
- [ ] Reuse `analyzeCampaignPerformance`, `recommendActions`, `RuleEngine`.
- [x] Tests: report Meta account + campaign level.

**Exit:** `ads_generate_report` mengembalikan laporan Meta (data test), tercakup test.

### Fase 2 — Cross-Provider Aggregation (Target: Agustus 2026)

**Goal:** Satu laporan menggabungkan >1 provider.

- [x] Implement multi-provider read di `AdsBroker` (hapus `NOT_IMPLEMENTED` cross-provider).
- [x] Strategi agregasi: normalisasi ke `AdsMetricRecord`, satukan by level, hitung total.
- [x] Penanganan partial failure: satu provider gagal tidak menggagalkan seluruh laporan (`errors[]` per provider).
- [x] Currency handling: normalisasi/anotasi mata uang berbeda (jangan salah jumlah).
- [x] Tests: Meta + TikTok gabungan.

**Exit:** laporan lintas Meta+TikTok dengan total & per-provider breakdown, partial failure aman.

### Fase 3 — TikTok Parity + Meta CPAS (Target: September 2026)

**Goal:** TikTok setara Meta; aktifkan CPAS sebagai mode Meta.

- [x] TikTok `getAccountPerformance` real (bukan stub).
- [x] TikTok `getPlacementPerformance` real via TikTok report attribute metric `placement_type`.
- [x] Normalisasi GMV Max ke `CommerceRecord` (masuk `commerce_get_performance`, bukan ads report).
- [x] Expose `commerce_get_performance` untuk TikTok GMV Max: records + totals + metadata + warnings, tanpa findings/recommendations naratif.
- [x] **Meta CPAS sebagai mode** di adapter Meta (catalog/partner ads), bukan provider terpisah — `params.mode='cpas'` + normalisasi catalog/product metadata.
- [x] Tests parity untuk TikTok read + GMV Max data tool.
- [x] CPAS smoke test untuk request mode + normalisasi catalog metadata.

**Exit:** TikTok read setara Meta; CPAS mode read jalan; GMV Max tersedia sebagai normalized commerce JSON.

### Fase 4 — Google Ads Provider (Target: September–Oktober 2026)

**Goal:** Provider ads besar ketiga (didahulukan sebelum marketplace).

- [x] `src/providers/google/` adapter foundation (read: account/campaign/adgroup/ad).
- [x] Google Ads REST client supports OAuth access token + developer token inputs; hosted Cuan Insight credential rollout tetap bergantung konfigurasi provider.
- [x] Normalizer Google → `AdsMetricRecord`.
- [x] Register di provider registry + capability matrix.
- [x] Tests: normalizer + adapter + factory + MCP schema.

**Exit:** `ads_get_*_performance provider=google` tersedia untuk client-injected/credential-backed Google Ads client; production credential rollout perlu konfigurasi Cuan Insight Google scopes/developer token.

### Fase 5 — RBAC Minimal + Write Ekspansi + Create (Target: Oktober–November 2026)

**Goal:** Adset/ad write + create ads (Meta→TikTok), dengan RBAC minimal terpasang lebih dulu.

- [ ] **RBAC minimal (prasyarat sebelum create):**
  - [x] Credential-aware read gating: provider harus cocok, akun harus masuk `allowedAccountIds`/`accountId`, scope harus memuat `ads.read`/`ads.write`/`ads.admin` jika scopes dikirim.
  - [x] Default deny write tetap aktif (`WRITE_NOT_ALLOWED`) sampai policy write eksplisit dikonfigurasi.
  - [ ] `AccessPolicy` create/write granular: read-only vs write-allowed vs create-allowed per Connection Key.
  - [ ] Isolasi tenant penuh dari Cuan Insight: org/workspace/provider/account/scope mapping eksplisit.
  - [ ] Gating create di broker sebelum eksekusi; error aman (`CREATE_NOT_ALLOWED`).
- [ ] Adset/ad: pause/resume/budget/rename (lanjutan ROADMAP v0.6.0) sesuai `WRITE_SAFETY_CONTRACT`.
- [ ] Batch ops + rollback + rate limit + whitelist/blacklist.
- [ ] **Create ads** (fase paling sensitif, urutan Meta → TikTok):
  - [ ] Kontrak `ads_create_*` dengan preview wajib, asset validation, policy check.
  - [ ] Dry-run menghasilkan preview objek yang akan dibuat (tanpa membuat).
  - [ ] Confirm eksplisit + audit entry lengkap.
  - [ ] Mulai dari Meta, lalu TikTok, sisanya menyusul.
- [ ] Skills `manage/SKILL.md` diperluas untuk write + create dengan guardrail.

**Exit:** create Meta ad via dry-run→confirm→execute→audit dengan RBAC minimal aktif; tidak ada secret di audit.

### Fase 6 — Marketplace / Commerce Indonesia (Target: November 2026–Q1 2027)

**Goal:** Shopee/Tokopedia/Lazada Ads + commerce model. Paralel, kejar izin API yang keluar duluan.

- [x] Definisikan `CommerceRecord` (GMV, orders, SKU, voucher, live, affiliate, store).
- [ ] Adapter `shopee/`, `tokopedia/`, `lazada/` — read dulu, dikerjakan paralel sesuai ketersediaan izin API.
- [ ] Credential mapping marketplace di Cuan Insight (per-shop, per-region).
- [x] `CommerceReportEngine` foundation (terpisah dari ads report) — aggregation layer untuk GMV/order/spend, bukan narasi utama.
- [x] `commerce_get_performance provider=tiktok_gmv` sebagai data connector ternormalisasi pertama.
- [ ] Write/create marketplace ads = fase lanjutan setelah read stabil.

**Exit:** minimal 1 marketplace read + normalized commerce data jalan end-to-end.

### Fase 7 — Hardening & Production (Target: Q1–Q2 2027)

**Goal:** Stabil, cepat, aman untuk multi-tenant.

- [ ] Caching + rate-limit lintas provider.
- [ ] Observability: structured logs (tanpa secret), metrics, trace id.
- [ ] Coverage target ≥ 90% pada broker + adapters.
- [ ] **RBAC lengkap**: role custom, audit granular, per-scope permission (upgrade dari RBAC minimal Fase 5).
- [ ] Complete API reference + migration guide + provider docs.

**Exit:** load/soak test lulus; audit keamanan lulus; docs lengkap.

---

## 5. Workstream Lintas Fase

Berjalan paralel, bukan sekuensial.

### 5.1 Keamanan (selalu P0)

- Semua path baru wajib lewat `redactErrorMessage`/`redactTokenLikeValues`.
- Tidak ada token di log/response/audit/URL. Test regresi redaction per provider.
- Setiap write/create mengikuti `docs/WRITE_SAFETY_CONTRACT.md`.
- RBAC minimal wajib aktif sebelum create ads (Fase 5).
- Secret scanning (gitleaks) tetap di CI.

### 5.2 Testing & Kualitas

- Unit test untuk setiap normalizer + adapter (mock API).
- Contract test: setiap adapter memenuhi `AdsProviderAdapter`.
- Report snapshot test (ads report & commerce report).
- Jangan test API eksternal langsung (integration test terpisah, opsional, di-skip default).

### 5.3 Dokumentasi

- `docs/PROVIDER_ONBOARDING.md` (baru).
- Update `docs/ARSITEKTUR.md` untuk multi-provider + report engine + RBAC.
- Per-provider doc singkat (auth, batasan, capability).
- Skills: perluas audit/manage agar provider-agnostic.

### 5.4 Developer Experience

- Contoh baru per provider di `examples/`.
- Template adapter (scaffold) agar kontributor cepat menambah provider.
- Type export konsisten dari `src/index.ts`.

---

## 6. Model Data — Rencana Evolusi

### 6.1 Ads (existing, perluas)

`AdsMetricRecord` sudah kaya (delivery/clicks/conversions/commerce/leads/video/engagement/creative/diagnostics). Rencana:

- Tambah anotasi `currency` konsisten di level record untuk agregasi lintas mata uang.
- Tambah `provider_context` opsional (mis. CPAS catalog id, GMV Max store id).

### 6.2 Commerce (baru untuk marketplace + GMV Max)

`CommerceRecord` diusulkan berisi:

- `store` (id, name, region, platform)
- `gmv`, `orders`, `units_sold`, `aov`
- `ad_spend`, `roas_commerce` (GMV/spend)
- `sku`/`product` breakdown opsional
- `live`/`affiliate`/`voucher` context opsional
- `time`, `provider`, `raw` (di-strip sebelum response)

Keputusan: **jangan paksakan commerce ke `AdsMetricRecord`**; buat tipe terpisah dengan mapper ke commerce report.

---

## 7. Tool Surface (MCP) — Rencana

### 7.1 Stable (`ads_*`, `commerce_*`)

Pertahankan & perluas: `ads_list_accounts`, `ads_list_campaigns`, `ads_get_*_performance`, `ads_get_placement_performance`, `ads_generate_report`, write tools; tambah `commerce_*` untuk marketplace/GMV.

### 7.2 Baru (rencana)

- `ads_generate_report` (aktifkan) + parameter `format`, `providers[]`, `report_kind`.
- `commerce_get_performance` (marketplace + GMV Max).
- `commerce_generate_report` (terpisah dari ads report).
- `ads_create_*` (Fase 5, guarded, Meta→TikTok).

### 7.3 Legacy (`meta_*`, `tiktok_*`)

- Tandai legacy/debug di deskripsi tool.
- Rencana deprecation bertahap setelah `ads_*`/`commerce_*` menutup semua kebutuhan.
- Jangan hapus tanpa jalur migrasi.

---

## 8. Metrik Keberhasilan

| Kategori | Target Menengah | Target Jangka Panjang |
|---|---|---|
| Provider read | Meta+TikTok+Google | +≥1 marketplace |
| Report | Ads report + cross-provider | + commerce report |
| Create ads | Meta | +TikTok, lalu lainnya |
| Safety | 0 secret leak + RBAC minimal | 0 leak + RBAC lengkap |
| Coverage | ≥ 80% broker/adapter | ≥ 90% |
| Onboarding provider | ≤ 1 adapter + mapping | Scaffold + docs |
| Adopsi | Jalan di ≥3 MCP client | Marketplace komunitas skill |

---

## 9. Keputusan yang Sudah Ditutup

Bagian ini dulunya "Open Questions"; sekarang terjawab (lihat §0).

1. Rebrand → **selesai** menjadi `adstream-mcp`.
2. Meta CPAS → **mode di adapter Meta**, bukan provider terpisah.
3. Prioritas berikutnya → **Google Ads dulu**, lalu marketplace.
4. Scope marketplace → **paralel**, kejar izin API tercepat.
5. Create ads → **Meta → TikTok → sisanya**.
6. Report → **ads report & commerce report dipisah**.
7. RBAC → **minimal sebelum create ads**, lengkap di hardening.

Pertanyaan baru yang mungkin muncul nanti dicatat kembali di sini sebagai open questions.

---

## 10. Cara Menambah Provider Baru (ringkas)

1. Tambah id provider ke daftar provider + capability matrix.
2. Buat `src/providers/<provider>/<Provider>AdsAdapter.ts` yang implement `AdsProviderAdapter`.
3. Buat `normalizer.ts` → map response provider ke `AdsMetricRecord`/`CommerceRecord`.
4. Daftarkan di `src/broker/factory.ts` (`createDefaultProviderRegistry`).
5. Tambah credential mapping di Cuan Insight + resolver.
6. Export tipe publik dari `src/index.ts`.
7. Tulis unit test (normalizer + adapter mock) di `tests/`.
8. Update dokumen provider + capability matrix.

Detail baku akan hidup di `docs/PROVIDER_ONBOARDING.md` (Fase 0).

---

## 11. Referensi Internal

- `ROADMAP.md` — riwayat rilis & prioritas historis.
- `docs/PROJECT_STATUS.md` — status implementasi aktual.
- `docs/WRITE_SAFETY_CONTRACT.md` — kontrak keamanan write/create.
- `docs/ARSITEKTUR.md` — arsitektur detail.
- `docs/CUAN_INSIGHT_CONNECTION_KEY_COMPATIBILITY.md` — kompatibilitas Connection Key.
- `docs/REMOTE_MCP_TRANSPORT_DESIGN.md` — desain transport remote.
- `AGENTS.md` — aturan kerja untuk AI agents.

---

**Catatan:** Dokumen ini adalah *living document*. Perubahan besar arah harus memperbarui §0 (keputusan), §4 (rencana rilis), lalu disinkronkan ke `ROADMAP.md` dan `docs/PROJECT_STATUS.md`.
