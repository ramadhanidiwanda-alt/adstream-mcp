# Read Ad Set Full Design

## Tujuan

Menambahkan tool MCP read-only `ads_read_adset_full` yang membaca konfigurasi lengkap ad set Meta: targeting (custom audience, geo, umur, gender, placement), budget, bid strategy, optimization goal, dan jadwal. Tool ini melengkapi `ads_read_creative_full` yang sudah ada, sehingga AI dapat mereplikasi ad set yang sudah berjalan tanpa membuka Meta Ads Manager.

## Latar Belakang

Connector saat ini hanya membaca performa ad set (`ads_get_performance` level `adset`), bukan konfigurasinya. Kasus nyata: user ingin membuat ad set promo baru dengan targeting yang sama seperti ad set promo sebelumnya, tetapi AI tidak punya jalur untuk membaca targeting tersebut. Pola solusi sudah ada di repo: `ads_read_creative_full` membaca semua field creative dari Graph API dengan field batching agar field yang ditolak tidak menggagalkan seluruh respons.

## Kontrak Tool

Nama tool: `ads_read_adset_full`. Provider: `meta` saja.

Input:

- `accountId` (wajib): account id, menerima bentuk dengan atau tanpa prefix `act_`.
- `adsetId` (opsional): baca satu ad set lengkap.
- `campaignId` (opsional): baca semua ad set di bawah campaign tersebut.
- Tanpa `adsetId` dan `campaignId`: baca semua ad set di account.
- `limit` (opsional, default 25) dan `cursor` (opsional): pagination untuk mode campaign dan account.

Jika `adsetId` dan `campaignId` dua-duanya diisi, `adsetId` menang dan `campaignId` diabaikan dengan warning di respons.

Output mengikuti pola `ads_read_creative_full`:

- Mode satu ad set: `{ operation, status, adset_id, adset, fields_retrieved, fields_missing }`.
- Mode daftar: `{ operation, status, adsets: [...], fields_retrieved, fields_missing, paging }` dengan `nextCursor` bila masih ada halaman berikutnya.

## Field yang Dibaca

Single ad set dibaca via `GET /{adset_id}?fields=...` dengan field batching independen (pola `FIELD_BATCHES` dari `readAdCreativeFull.ts`):

- Batch inti: `id, name, status, effective_status, campaign_id, created_time, updated_time`.
- Batch budget: `daily_budget, lifetime_budget, budget_remaining`.
- Batch bidding: `bid_strategy, bid_amount, bid_constraints, billing_event, optimization_goal`.
- Batch targeting: `targeting` (berisi custom_audiences dengan id+name, excluded_custom_audiences, geo_locations, age_min, age_max, genders, publisher_platforms, facebook_positions, instagram_positions, flexible_spec, dan lainnya — dikembalikan mentah tanpa filtering).
- Batch tujuan: `promoted_object, destination_type, attribution_spec`.
- Batch jadwal: `start_time, end_time, adset_schedule`.
- Batch lain: `is_dynamic_creative, frequency_control_specs, pacing_type, multi_optimization_goal_weight, dsa_beneficiary, dsa_payor`.

Mode daftar dibaca via `GET /act_{account_id}/adsets` atau `GET /{campaign_id}/adsets` dengan parameter `fields` berisi gabungan field yang sama, plus `limit` dan `after`. Karena endpoint list tidak bisa batching per field, jika request list gagal karena kombinasi field, adapter memakai fallback: ulangi dengan field inti + `targeting` saja, dan laporkan field yang di-drop lewat `fields_missing`.

## Arsitektur

Mengikuti pola `ads_read_creative_full` persis:

1. `src/tools/readAdSetFull.ts` — helper library: `readAdSetFull(client, { adsetId })` untuk single read dengan field batching, dan `listAdSetsFull(client, { accountId | campaignId, limit, cursor })` untuk mode daftar. Ekspor `ADSET_FULL_FIELDS` agar adapter dan test memakai daftar field yang sama.
2. `MetaAdsAdapter` — method operasi baru `read_adset_full` yang memvalidasi param, memanggil helper, dan membungkus hasil dalam envelope `{ ok, provider, data }` standar.
3. `src/broker/mcpTools.ts` — definisi tool `ads_read_adset_full` dengan schema input dan deskripsi yang menjelaskan ketiga mode.
4. `src/mcp/createServer.ts` — registrasi tool. Terdaftar sebagai read tool, TIDAK berada di balik `ADSTREAM_ENABLE_WRITES` (konsisten dengan `ads_read_creative_full`).

## Keamanan

- Read-only murni; tidak ada mutasi.
- Error Meta di-redact dengan `redactErrorMessage` / `redactTokenLikeValues` sebelum dikembalikan.
- Respons tidak boleh memuat access token atau signed URL sensitif; field ad set tidak mengandung keduanya secara alami.

## Penanganan Error

- `accountId` kosong pada mode account-list: error `MISSING_ACCOUNT_ID` dengan pesan yang menjelaskan field yang harus diisi.
- Ad set tidak ditemukan / tanpa izin: teruskan error Meta yang sudah di-redact dengan `status: "failed"`.
- Field yang ditolak Meta pada mode single: batch tersebut dilewati dan field masuk `fields_missing`; batch lain tetap dikembalikan.
- Error jaringan/transien mengikuti retry bawaan `MetaClient`; validation error Meta tidak di-retry.

## Pengujian

Mengikuti pola test `ads_read_creative_full` yang ada:

- Unit test `readAdSetFull`: merge hasil batch, batch gagal masuk `fields_missing`, seluruh batch gagal menghasilkan error.
- Unit test `listAdSetsFull`: bentuk path per mode (account vs campaign), pagination cursor, fallback field saat list ditolak.
- Adapter test: routing `adsetId` vs `campaignId` vs account mode, prioritas `adsetId` + warning, normalisasi `act_` prefix, envelope error.
- Schema/registrasi test di `mcpServerBuilder` dan `mcpAdsTools`: tool terdaftar sebagai read tool dan tersedia tanpa `ADSTREAM_ENABLE_WRITES`.

## Kriteria Selesai

- `ads_read_adset_full` tersedia via MCP tanpa flag writes.
- Mode single mengembalikan targeting lengkap ad set nyata (diverifikasi live read-only terhadap ad set `30D | MID MONT JULI`, id `120250499282510071`).
- Mode campaign mengembalikan daftar ad set `CONV | EVENT | 2026` dengan targeting masing-masing.
- Seluruh test, lint, dan build lulus.
