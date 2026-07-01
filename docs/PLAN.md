# Master Plan — Cuan Insight Ads MCP Connector Hub

> **Status Dokumen:** Draft v1 (living document)
> **Terakhir Diupdate:** 2026-07-01
> **Versi Repo Saat Ini:** v0.5.2
> **Pemilik:** Project owner + maintainers
> **Scope:** Seluruh repository (`meta-ads-agent-skill` → menuju `cuan-insight-ads-mcp`)

Dokumen ini adalah rencana komprehensif untuk mentransformasi repo dari **Meta Ads toolkit** menjadi **client-agnostic, multi-platform Ads + Commerce MCP Connector Hub** untuk Cuan Insight, tetap open source (MIT).

Dokumen ini melengkapi (tidak menggantikan) `ROADMAP.md`, `docs/PROJECT_STATUS.md`, dan `docs/WRITE_SAFETY_CONTRACT.md`. Jika ada konflik, urutan otoritas: `docs/WRITE_SAFETY_CONTRACT.md` (keamanan) > `docs/PROJECT_STATUS.md` (status aktual) > `docs/PLAN.md` (arah) > `ROADMAP.md` (historis).

---

## 1. Visi & Definisi Sukses

### 1.1 Visi

Menjadi **satu MCP server open source** yang memungkinkan AI agent apa pun (Claude, Codex, Cursor, OpenAI Responses, dsb.) untuk:

1. **Membaca** data performa iklan dan commerce di semua platform besar.
2. **Menganalisa** performa lintas platform dengan metrik yang ternormalisasi.
3. **Membuat laporan** (harian, mingguan, audit, executive, lintas platform).
4. **Membuat & mengubah iklan** dengan approval workflow dan safety guard yang ketat.
5. **Menjadi credential control plane** via Cuan Insight (token tidak pernah disimpan lokal).

Target platform akhir:

- **Ads:** Meta, Meta CPAS, TikTok (reguler), TikTok GMV Max, Google Ads.
- **Marketplace / Commerce Ads Indonesia:** Shopee Ads, Tokopedia (TopAds), Lazada Sponsored, Blibli, dan marketplace lain sesuai permintaan pasar.

### 1.2 Target Pengguna

- **Primary:** End user non-teknis ("end user goblok") — marketer/UMKM yang butuh insight & aksi tanpa ribet.
- **Secondary:** Developer & agency yang integrasi via TypeScript library + MCP.
- **Tertiary:** Platform (Cuan Insight) sebagai credential + orchestration layer.

### 1.3 Definisi Sukses (Outcome, bukan output)

- Satu agent bisa menjawab: *"Audit semua iklan saya di semua platform minggu ini, buat laporan, dan sarankan aksi"* dalam satu percakapan.
- Menambah platform baru = implement 1 adapter + 1 credential mapping, tanpa mengubah broker/tool surface.
- Tidak ada satu pun token/secret bocor ke log, response, atau audit.
- Write operations selalu melewati dry-run → confirm → execute → audit.

---

## 2. Kondisi Saat Ini (Baseline Audit)

> Ringkasan dari audit 2026-07-01. Build sukses, 429 tests passing (33 files).

### 2.1 Sudah Kuat

- **Broker abstraction**: `AdsBroker`, `ProviderRegistry`, `CredentialResolver`, normalized `AdsMetricRecord` (`src/broker/`).
- **Generic MCP tools** `ads_*`: accounts, campaigns, performance (account/campaign/adset/ad/creative/placement), write (pause/resume/budget/rename) (`src/broker/mcpTools.ts`).
- **Credential authority = Cuan Insight**: local & remote mode, Connection Key, OAuth store (memory + Supabase) (`docs/PROJECT_STATUS.md`).
- **Transport**: stdio, SSE, Streamable HTTP dengan bearer/OAuth gating (`mcp-server/src/http.ts`).
- **Safety**: redaction (`redactErrorMessage`, `redactTokenLikeValues`), strip `raw`, write permission policy, `docs/WRITE_SAFETY_CONTRACT.md`.
- **Providers**: Meta (read + campaign write), TikTok (campaign list, report, GMV Max, location) — partial.

### 2.2 Gap Utama

| Area | Kondisi | Dampak |
|---|---|---|
| Provider IDs | Hardcoded `meta`, `tiktok` (`src/broker/types.ts`) | Belum bisa Google/Shopee/marketplace |
| Report engine | `ads_generate_report` → `NOT_IMPLEMENTED` (`src/broker/AdsBroker.ts`) | Capability laporan belum ada |
| Cross-provider | Multi-provider request → `NOT_IMPLEMENTED` | Belum ada laporan lintas platform |
| TikTok adapter | `getAccountPerformance`/`getPlacementPerformance` stub | TikTok belum setara Meta |
| Create ads | Belum ada (hanya campaign-level mutate) | "Membuat iklan" belum didukung |
| Commerce model | `AdsMetricRecord` fokus ads, belum commerce (GMV/order/SKU/live) | Marketplace belum ter-model |
| Naming | Package `meta-ads-agent-skill` | Membingungkan untuk multi-platform |
| Roadmap | `ROADMAP.md` tertinggal dari status aktual | Sinkronisasi perlu |
| Tool surface | Campuran `ads_*`, `meta_*`, `tiktok_*` | Perlu strategi stable vs legacy |

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
MCP Server (mcp-server/)  ── tool surface: ads_* (stable), *_legacy (compat)
        │
        ▼
Broker Layer (src/broker/)
  ├─ CredentialResolver ── Cuan Insight (Connection Key / OAuth) | ENV (local)
  ├─ ProviderRegistry ──── dynamic provider registration
  ├─ ReportEngine ──────── single & cross-provider reports (NEW)
  ├─ AnalysisEngine ────── rules + heuristics + anomaly (existing, expand)
  └─ AuditLog ──────────── write audit trail (expand)
        │
        ▼
Provider Adapters (src/providers/<provider>/)
  ├─ meta/         (ads + cpas)
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
- **`CommerceRecord`** (NEW) — schema commerce ternormalisasi (order/GMV/SKU/live/voucher) untuk marketplace.
- **`CredentialContext`** — kontrak kredensial dengan `source` dan `provider`.
- **Write lifecycle** — sesuai `docs/WRITE_SAFETY_CONTRACT.md`.

### 3.3 Provider Capability Matrix (rencana)

Setiap adapter mengekspos `capabilities` sehingga broker dan agent tahu apa yang didukung tanpa trial-error.

| Capability | meta | meta_cpas | tiktok | tiktok_gmv | google | shopee | tokopedia | lazada |
|---|---|---|---|---|---|---|---|---|
| list_accounts | ✅ | ▶ | ✅ | ▶ | ▶ | ▶ | ▶ | ▶ |
| read_performance | ✅ | ▶ | 🟡 | 🟡 | ▶ | ▶ | ▶ | ▶ |
| placement_performance | ✅ | ▶ | ⬜ | ⬜ | ▶ | ▶ | ▶ | ▶ |
| generate_report | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| write_campaign | ✅ | ▶ | ⬜ | ⬜ | ▶ | ▶ | ▶ | ▶ |
| create_ad | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| commerce_metrics | n/a | n/a | 🟡 | 🟡 | n/a | ▶ | ▶ | ▶ |

Legenda: ✅ ada · 🟡 partial · ⬜ belum · ▶ direncanakan · n/a tidak relevan.

---

## 4. Rencana Rilis Bertahap

Prinsip urutan: **stabilkan fondasi → laporan → provider read → provider write → create → commerce → hardening**. Setiap fase punya exit criteria yang dapat diverifikasi (build hijau, test, no secret leak).

### Fase 0 — Sinkronisasi & Fondasi (Target: Juli 2026)

**Goal:** Repo jujur dengan dirinya sendiri dan siap ekspansi tanpa breaking.

- [ ] Sinkronkan `ROADMAP.md` dengan `docs/PROJECT_STATUS.md` (OAuth sudah ada, TikTok sudah ada).
- [ ] Tetapkan strategi penamaan: keputusan rebrand `meta-ads-agent-skill` → `cuan-insight-ads-mcp` (atau alias paket). **Open question, lihat §9.**
- [ ] Definisikan **Provider Capability Matrix** sebagai kode (`capabilities` per adapter dipakai broker untuk gating).
- [ ] Tambah `docs/PROVIDER_ONBOARDING.md`: langkah baku menambah provider baru.
- [ ] Tandai tool surface: `ads_*` = stable public; `meta_*`/`tiktok_*` = legacy/debug (dokumentasikan, jangan hapus dulu).

**Exit:** build + test hijau; matrix capability dipakai broker; dokumen onboarding ada.

### Fase 1 — Report Engine (Target: Juli–Agustus 2026)

**Goal:** `ads_generate_report` benar-benar menghasilkan laporan, single-provider dulu.

- [ ] Implement `ReportEngine` di `src/broker/` (input: provider, range, level, format).
- [ ] Format laporan: `summary`, `daily`, `audit`, `executive` (mulai dari 1–2 dulu).
- [ ] Output ternormalisasi + ringkasan naratif (findings, recommendations, disclaimer).
- [ ] `ads_generate_report` memanggil `ReportEngine` (hapus `NOT_IMPLEMENTED`).
- [ ] Reuse `analyzeCampaignPerformance`, `recommendActions`, `RuleEngine`.
- [ ] Tests: report Meta account + campaign level.

**Exit:** `ads_generate_report` mengembalikan laporan Meta nyata (dry data test), tercakup test.

### Fase 2 — Cross-Provider Aggregation (Target: Agustus 2026)

**Goal:** Satu laporan menggabungkan >1 provider.

- [ ] Implement multi-provider read di `AdsBroker` (hapus `NOT_IMPLEMENTED` cross-provider).
- [ ] Strategi agregasi: normalisasi ke `AdsMetricRecord`, satukan by level, hitung total.
- [ ] Penanganan partial failure: satu provider gagal tidak menggagalkan seluruh laporan (report `errors[]` per provider).
- [ ] Currency handling: normalisasi/anotasi mata uang berbeda (jangan salah jumlah).
- [ ] Tests: Meta + TikTok gabungan.

**Exit:** laporan lintas Meta+TikTok dengan total & per-provider breakdown, partial failure aman.

### Fase 3 — TikTok Parity + Meta CPAS (Target: September 2026)

**Goal:** TikTok setara Meta; tambah Meta CPAS.

- [ ] TikTok `getAccountPerformance` real (bukan stub).
- [ ] TikTok `getPlacementPerformance`.
- [ ] Normalisasi GMV Max ke commerce-aware fields.
- [ ] Meta CPAS sebagai mode/provider (catalog-based, partner ads) — evaluasi apakah provider terpisah atau flag di Meta adapter (**open question §9**).
- [ ] Tests parity untuk TikTok read + CPAS smoke.

**Exit:** TikTok read setara Meta; CPAS minimal read jalan.

### Fase 4 — Google Ads Provider (Target: September–Oktober 2026)

**Goal:** Provider ads besar ketiga.

- [ ] `src/providers/google/` adapter (read: account/campaign/adgroup/ad).
- [ ] Google Ads auth via Cuan Insight (OAuth + developer token) — resolusi kredensial, bukan simpan lokal.
- [ ] Normalizer Google → `AdsMetricRecord`.
- [ ] Register di provider registry + capability matrix.
- [ ] Tests: normalizer + adapter (mock).

**Exit:** `ads_get_*_performance provider=google` jalan; masuk cross-provider report.

### Fase 5 — Write Ekspansi + Create (Target: Oktober–November 2026)

**Goal:** Adset/ad write + create ads (paling berisiko, safety maksimal).

- [ ] Adset/ad: pause/resume/budget/rename (lanjutan ROADMAP v0.6.0) sesuai `WRITE_SAFETY_CONTRACT`.
- [ ] Batch ops + rollback + rate limit + whitelist/blacklist.
- [ ] **Create ads** (fase paling sensitif):
  - [ ] Kontrak `create_*` dengan preview wajib, asset validation, policy check.
  - [ ] Dry-run menghasilkan preview objek yang akan dibuat (tanpa membuat).
  - [ ] Confirm eksplisit + audit entry lengkap.
  - [ ] Mulai dari 1 provider (Meta) sebelum generalisasi.
- [ ] Skills `manage/SKILL.md` diperluas untuk write + create dengan guardrail.

**Exit:** create Meta ad via dry-run→confirm→execute→audit, tidak ada secret di audit.

### Fase 6 — Marketplace / Commerce Indonesia (Target: November 2026–Q1 2027)

**Goal:** Shopee/Tokopedia/Lazada Ads + commerce model.

- [ ] Definisikan `CommerceRecord` (GMV, orders, SKU, voucher, live, affiliate, store).
- [ ] Adapter `shopee/` (Shopee Ads / Seller Center) — read dulu.
- [ ] Adapter `tokopedia/` (TopAds), `lazada/` (Sponsored) — read dulu.
- [ ] Credential mapping marketplace di Cuan Insight (per-shop, per-region).
- [ ] Report engine commerce-aware (blend ads spend vs actual GMV).
- [ ] Write/create marketplace ads = fase lanjutan setelah read stabil.

**Exit:** minimal 1 marketplace read + commerce report jalan end-to-end.

### Fase 7 — Hardening & Production (Target: Q1–Q2 2027)

**Goal:** Stabil, cepat, aman untuk multi-tenant.

- [ ] Caching + rate-limit lintas provider.
- [ ] Observability: structured logs (tanpa secret), metrics, trace id.
- [ ] Coverage target ≥ 90% pada broker + adapters.
- [ ] RBAC/multi-tenant guard di remote mode.
- [ ] Complete API reference + migration guide + provider docs.

**Exit:** load/soak test lulus; audit keamanan lulus; docs lengkap.

---

## 5. Workstream Lintas Fase

Berjalan paralel, bukan sekuensial.

### 5.1 Keamanan (selalu P0)

- Semua path baru wajib lewat `redactErrorMessage`/`redactTokenLikeValues`.
- Tidak ada token di log/response/audit/URL. Test regresi redaction per provider.
- Setiap write/create mengikuti `docs/WRITE_SAFETY_CONTRACT.md`.
- Secret scanning (gitleaks) tetap di CI.

### 5.2 Testing & Kualitas

- Unit test untuk setiap normalizer + adapter (mock API).
- Contract test: setiap adapter memenuhi `AdsProviderAdapter`.
- Report snapshot test.
- Jangan test API eksternal langsung (integration test terpisah, opsional, di-skip default).

### 5.3 Dokumentasi

- `docs/PROVIDER_ONBOARDING.md` (baru).
- Update `docs/ARSITEKTUR.md` untuk multi-provider + report engine.
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

### 6.2 Commerce (baru untuk marketplace)

`CommerceRecord` diusulkan berisi:

- `store` (id, name, region, platform)
- `gmv`, `orders`, `units_sold`, `aov`
- `ad_spend`, `roas_commerce` (GMV/spend)
- `sku`/`product` breakdown opsional
- `live`/`affiliate`/`voucher` context opsional
- `time`, `provider`, `raw` (di-strip sebelum response)

Keputusan: **jangan paksakan commerce ke `AdsMetricRecord`**; buat tipe terpisah dengan mapper ke laporan gabungan.

---

## 7. Tool Surface (MCP) — Rencana

### 7.1 Stable (`ads_*`)

Pertahankan & perluas: `ads_list_accounts`, `ads_list_campaigns`, `ads_get_*_performance`, `ads_get_placement_performance`, `ads_generate_report`, write tools.

### 7.2 Baru (rencana)

- `ads_generate_report` (aktifkan) + parameter `format`, `providers[]`.
- `commerce_get_performance` (marketplace).
- `commerce_generate_report`.
- `ads_create_*` (fase 5, guarded).

### 7.3 Legacy (`meta_*`, `tiktok_*`)

- Tandai legacy/debug di deskripsi tool.
- Rencana deprecation bertahap setelah `ads_*` menutup semua kebutuhan.
- Jangan hapus tanpa jalur migrasi.

---

## 8. Metrik Keberhasilan

| Kategori | Target Menengah | Target Jangka Panjang |
|---|---|---|
| Provider read | Meta+TikTok+Google | +≥1 marketplace |
| Report | Single + cross-provider | Commerce-aware |
| Safety | 0 secret leak | 0 secret leak + audit lengkap |
| Coverage | ≥ 80% broker/adapter | ≥ 90% |
| Onboarding provider | ≤ 1 adapter + mapping | Scaffold + docs |
| Adopsi | Jalan di ≥3 MCP client | Marketplace komunitas skill |

---

## 9. Open Questions (perlu keputusan owner)

1. **Rebrand paket**: `meta-ads-agent-skill` → `cuan-insight-ads-mcp`? (npm rename + alias, atau tetap nama lama?)
2. **Meta CPAS**: provider terpisah (`meta_cpas`) atau flag mode di Meta adapter?
3. **Prioritas platform berikutnya**: Google Ads dulu atau marketplace Indonesia dulu setelah report engine?
4. **Marketplace scope**: Shopee dulu, atau paralel Shopee+Tokopedia+Lazada?
5. **Create ads**: mulai dari Meta saja, atau desain generik lintas provider sejak awal?
6. **Commerce vs Ads report**: satu laporan gabungan atau dua jenis laporan terpisah?
7. **Multi-tenant RBAC**: kapan wajib (sebelum marketplace atau saat hardening)?

Jawaban atas pertanyaan ini akan mengunci urutan Fase 3–6.

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

**Catatan:** Dokumen ini adalah *living document*. Perubahan besar arah harus memperbarui §4 (rencana rilis) dan §9 (open questions), lalu disinkronkan ke `ROADMAP.md` dan `docs/PROJECT_STATUS.md`.
