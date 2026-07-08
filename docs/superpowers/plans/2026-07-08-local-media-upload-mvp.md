# Local Media Upload MVP — Implementation Plan

> **Untuk agentic workers:** Gunakan `subagent-driven-development` untuk implementasi task-by-task.
>
> **Status:** Planning — belum ada implementasi.
> **Target rilis:** Sebagai bagian dari adstream-mcp v0.7.0 atau v0.6.x berikutnya.

---

## A. PRD — Product Requirement Document

### A.1 Problem Statement

Agen / marketer punya file creative (gambar/video) di laptop. Mau bikin campaign Meta Ads via AI agent (Claude Desktop, Cline, dll). Tapi:

1. **Gap workflow:** MCP tool `ads_create_ecommerce_campaign_bundle` butuh `imageHash` / `videoId` — tapi nggak ada tool untuk dapetin hash dari file lokal.
2. **Manual detour:** User harus upload ke Ads Manager dulu, copy hash, baru balik ke AI agent. Workflow jadi patah.
3. **Gap kompetitif:** Official Meta MCP juga belum support upload lokal. Ini celah yang bisa jadi pembeda Adstream MCP.

### A.2 Target User

- **Primary:** Marketer / agency yang pake Claude Desktop / Cline + MCP lokal (stdio mode).
- **Secondary:** Power user yang pake remote MCP (Cuan Insight hosted) — fase 2.

### A.3 User Story

```
Sebagai seorang performance marketer,
Saya ingin mengupload file creative dari laptop langsung ke Meta Ads Library via MCP,
Sehingga saya bisa langsung membuat campaign baru tanpa harus buka Ads Manager.
```

### A.4 Success Metrics

| Metric | Target |
|---|---|
| Upload image berhasil | ✅ `image_hash` kembali dalam < 5 detik (file < 1MB) |
| Upload video berhasil | ✅ `video_id` kembali dalam < 30 detik (file < 10MB) |
| End-to-end: upload → create campaign | ✅ 1 sesi MCP tanpa buka browser |
| Error rate upload | < 5% (file valid) |

### A.5 Scope

**In Scope (MVP):**
- Upload image dari local filesystem → `/act_{id}/adimages` → dapat `image_hash`
- Upload video dari local filesystem → `/act_{id}/advideos` → dapat `video_id`
- Validasi file: tipe, ukuran, existence
- Error handling yang jelas buat user
- Update `createEcommerceCampaignBundle` supaya bisa terima `filePath` sebagai alternatif `imageHash`/`videoId`
- Testing: unit test + integrasi mock

**Out of Scope (fase berikutnya):**
- Upload via base64 string (bukan file path)
- Remote mode (Cuan Insight hosted) — file dari client jarak jauh
- Progress bar / chunked upload untuk video besar
- Thumbnail generation
- Batch upload
- Face swap / creative editing

---

## B. Implementation Plan

### Global Constraints

- Gunakan `.js` extension di TypeScript imports.
- Jangan log file path absolut yang mengandung username, token, atau credential.
- Ikuti pattern `metaGet` / `metaPost` yang sudah ada di `MetaClient`.
- File upload via `multipart/form-data` menggunakan `fetch` API (Node 18+ native).
- Semua tool baru harus `ads_*` (namespaced, bukan `meta_*`).
- File maksimum: gambar 30MB, video 1GB (Meta limit).
- Validasi tipe file sebelum upload: `image/jpeg`, `image/png`, `video/mp4`, `video/mov`.

---

### Task 1: Tambah `metaUploadMultipart` di MetaClient

**Files:**
- Modify: `src/metaClient.ts`
- Test: `tests/metaClient.test.ts` (atau file baru)

**Deskripsi:**
Tambahkan method baru `metaUploadMultipart` yang:
1. Nerima `path` (endpoint Meta), `filePath` (lokal), `fieldName` (nama field multipart), dan `additionalFields` (opsional params lain).
2. Baca file dari `filePath` pake `fs.readFileSync` atau stream.
3. Kirim POST dengan `Content-Type: multipart/form-data` menggunakan `FormData` native.
4. Handle rate limit (429) dengan retry sama seperti `metaPost`.
5. Return response dari Meta (`{ images: ... }` atau `{ id: ... }`).

**Pattern:**
```typescript
async metaUploadMultipart<T = Record<string, unknown>>(
  path: string,
  filePath: string,
  fieldName: string,
  additionalFields?: Record<string, string>,
  maxRetries?: number
): Promise<T>
```

**Test cases:**
- Upload file valid → return expected shape
- Upload file tidak ada → error jelas
- Upload file terlalu besar → error
- Tipe file tidak didukung → error
- Rate limit → retry sukses
- Rate limit habis → error

---

### Task 2: Buat Tool `uploadImage`

**Files:**
- Create: `src/tools/uploadImage.ts`
- Test: `tests/uploadImage.test.ts`

**Deskripsi:**
Tool untuk upload gambar ke Meta Ads Image Library.

**Interface:**
```typescript
export interface UploadImageOptions {
  adAccountId: string;
  filePath: string;
}

export interface UploadImageResult {
  operation: 'upload_image';
  status: 'executed' | 'failed';
  image_hash?: string;
  url?: string;
  filename?: string;
  error?: string;
}
```

**Flow:**
1. Validasi file exists
2. Validasi tipe file (jpg, png)
3. Validasi ukuran file (< 30MB)
4. Panggil `client.metaUploadMultipart` ke `/act_{id}/adimages`
5. Parse response — Meta return `{ images: { filename: { hash, url } } }`
6. Return `image_hash` dan `url`

**Test cases:**
- Upload valid → `image_hash` terisi
- File tidak ada → error
- Tipe file salah → error
- Ukuran terlalu besar → error

---

### Task 3: Buat Tool `uploadVideo`

**Files:**
- Create: `src/tools/uploadVideo.ts`
- Test: `tests/uploadVideo.test.ts`

**Deskripsi:**
Tool untuk upload video ke Meta Ads Video Library.

**Interface:**
```typescript
export interface UploadVideoOptions {
  adAccountId: string;
  filePath: string;
  title?: string;
  description?: string;
}

export interface UploadVideoResult {
  operation: 'upload_video';
  status: 'uploading' | 'executed' | 'failed';
  video_id?: string;
  title?: string;
  error?: string;
}
```

**Flow:**
1. Validasi file exists
2. Validasi tipe file (mp4, mov)
3. Validasi ukuran file (< 1GB — kasih warning untuk > 100MB)
4. Panggil `client.metaUploadMultipart` ke `/act_{id}/advideos`
5. Meta return `{ id: "video_id" }`
6. Return `video_id`
7. **Catatan:** Meta processing video bisa async. Untuk MVP, return langsung setelah upload (status `uploading` berarti video sedang diproses). Fase berikutnya bisa polling status.

**Test cases:**
- Upload valid → `video_id` terisi
- File tidak ada → error
- Tipe file salah → error
- Upload dengan title → title terkirim

---

### Task 4: Update `createEcommerceCampaignBundle` — Dukung File Path

**Files:**
- Modify: `src/tools/createEcommerceCampaignBundle.ts`
- Modify: `mcp-server/src/createServer.ts` (schema)
- Test: `tests/createEcommerceCampaignBundle.test.ts`

**Deskripsi:**
Tambahkan opsi `imageFilePath` / `videoFilePath` di payload. Kalau diisi, auto-upload dulu, baru pake hash/ID hasil upload untuk creative.

**Interface tambahan:**
```typescript
// Di EcommerceCampaignBundlePayload:
imageFilePath?: string;  // alternatif imageHash
videoFilePath?: string;  // alternatif videoId
```

**Flow baru:**
1. Cek: apakah `imageFilePath` diisi?
2. Kalau iya → panggil internal upload dulu → dapat `image_hash`
3. Kalau `imageHash` juga diisi → prioritaskan `imageHash` (sudah siap pakai)
4. Lanjut seperti biasa dengan `image_hash` / `video_id`

**Perubahan di createServer.ts schema:**
Tambahkan field opsional `imageFilePath` dan `videoFilePath` di `ecommerceLaunchInputSchema`.

**Dry-run tetap aman:**
- Dry-run cukup validasi file exists, bukan beneran upload.
- Upload beneran cuma terjadi saat `dryRun=false` dan `confirmed=true`.

---

### Task 5: Daftarkan MCP Tools Baru

**Files:**
- Modify: `src/broker/mcpTools.ts` — tambah `ads_upload_image`, `ads_upload_video`
- Modify: `src/broker/AdsBroker.ts` — tambah method `uploadImage`, `uploadVideo`
- Modify: `src/broker/types.ts` — tambah interface UploadImage/Video result
- Modify: `src/providers/meta/MetaAdsAdapter.ts` — implementasi upload
- Modify: `mcp-server/src/createServer.ts` — register tool schemas

**Deskripsi:**
Ikuti pattern MCP tool registration yang sudah ada.

**Tool definitions:**
```typescript
{
  name: 'ads_upload_image',
  description: 'Upload a local image file to Meta Ads Image Library. Returns image_hash for use in creative creation.',
  inputSchema: createAdsInputSchema(['filePath']),
}
{
  name: 'ads_upload_video',
  description: 'Upload a local video file to Meta Ads Video Library. Returns video_id for use in creative creation.',
  inputSchema: createAdsInputSchema(['filePath']),
}
```

---

### Task 6: Update Write Safety Contract

**Files:**
- Modify: `docs/WRITE_SAFETY_CONTRACT.md`

**Deskripsi:**
Tandai media upload sebagai write operation yang sudah didukung, dengan catatan:
- Upload tidak perlu dry-run (tidak ada preview meaningful — file sudah di tangan user)
- Tapi tetap butuh confirmation kalau dijalankan dalam konteks campaign bundle creation
- File validation sebelum upload
- Tidak ada audit entry untuk upload standalone (cukup return result)

---

### Task 7: Verify Build & Test

**Files:**
- No code changes.

**Steps:**
1. `npm run build` — harus sukses
2. `npm run test` — semua test existing + baru harus PASS
3. Manual smoke test dengan file gambar real (opsional, kalau ada Meta credential)

---

## C. File Changes Summary

| File | Action |
|---|---|
| `src/metaClient.ts` | **Modify** — tambah `metaUploadMultipart` |
| `src/tools/uploadImage.ts` | **Create** — tool upload image |
| `src/tools/uploadVideo.ts` | **Create** — tool upload video |
| `src/tools/createEcommerceCampaignBundle.ts` | **Modify** — dukung `imageFilePath`/`videoFilePath` |
| `src/broker/mcpTools.ts` | **Modify** — tambah tool definitions |
| `src/broker/AdsBroker.ts` | **Modify** — tambah upload methods |
| `src/broker/types.ts` | **Modify** — tambah result types |
| `src/providers/meta/MetaAdsAdapter.ts` | **Modify** — implementasi upload |
| `mcp-server/src/createServer.ts` | **Modify** — register tools + update schema |
| `docs/WRITE_SAFETY_CONTRACT.md` | **Modify** — update status |
| `tests/uploadImage.test.ts` | **Create** |
| `tests/uploadVideo.test.ts` | **Create** |
| `tests/metaClient.test.ts` | **Modify** — tambah test multipart |
| `tests/createEcommerceCampaignBundle.test.ts` | **Modify** — tambah test filePath flow |

---

## D. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| File besar timeout | Upload gagal | Set timeout tinggi (>120s untuk video), kasih warning untuk file > 100MB |
| Meta API reject file | Creative gagal | Validasi tipe & ukuran di client-side dulu. Error messaging jelas: aspect ratio, resolusi, durasi. |
| File path berbeda OS | Path not found | Cross-platform test. Dokumentasi path format per OS. |
| `FormData` + `fetch` bug di Node <18 | Runtime error | Wajibkan Node 18+. Cek `process.version` di awal. |
| Video processing delay | User pikir gagal | Return status `uploading` dengan estimasi. Jangan blocking. |

---

## E. Execution Sequence (Rekomendasi)

1. Task 1 → Task 2 → Task 3 (dependensi: upload butuh MetaClient dulu)
2. Task 4 (dependensi: uploadImage/uploadVideo)
3. Task 5 (dependensi: semua tool sudah ada)
4. Task 6 (dependensi: tool sudah jalan)
5. Task 7 (dependensi: semua sudah diimplementasi)

---

## F. Referensi Meta API

- **Image upload:** `POST /act_{ad_account_id}/adimages` — `multipart/form-data` dengan field `filename`
  - Response: `{ "images": { "filename": { "hash": "...", "url": "..." } } }`
  - Docs: https://developers.facebook.com/docs/marketing-api/reference/ad-account/adimages/

- **Video upload:** `POST /act_{ad_account_id}/advideos` — `multipart/form-data` dengan field `source` (file) atau `file_url`
  - Response: `{ "id": "video_id" }`
  - Docs: https://developers.facebook.com/docs/marketing-api/reference/ad-account/advideos/

- **Required permission:** `ads_management`
