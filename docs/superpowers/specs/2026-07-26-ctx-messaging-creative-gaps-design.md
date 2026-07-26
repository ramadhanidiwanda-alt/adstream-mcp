# CTX / Messaging Creative Gaps — Design

Tanggal: 2026-07-26
Branch: `fix/ctx-messaging-creative-gaps`

## Latar

Sebuah iklan Click-to-Instagram-Direct (CTX) dibuat lewat connector ini untuk akun
`act_2326988574277142`. Dry-run hijau, `verification.status === 'verified'`, tetapi
iklan tayang dengan tombol CTA mati dan tanpa welcome message. Penyebabnya: jalur
`existing_post` menerima `appDestination` dan `pageWelcomeMessage`, lalu membuang
keduanya tanpa error, sementara validasinya justru mewajibkan `destinationUrl` —
bentuk `call_to_action.value.link` yang persis membuat tombol messaging tidak
berfungsi.

Kegagalan tidak terdeteksi oleh tool mana pun. Yang menemukannya adalah manusia yang
membuka Ads Manager.

## Prinsip

**Field yang tidak dipetakan ke Graph API harus melempar error, bukan lolos diam-diam.**
Dry-run hijau harus berarti payload lengkap. Ini sudah dijanjikan deskripsi
`ads_create_adcreative` untuk `params` (lewat `assertKnownParams`) tetapi tidak
diterapkan pada `creativeSpec` — di situlah kegagalan terjadi.

Konsekuensi yang diterima secara sadar: sebagian pemanggilan yang selama ini "lolos"
akan mulai gagal di dry-run. Itu tujuannya.

## Referensi Meta

- Click to Instagram: https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-instagram/
- Destination Type: https://developers.facebook.com/docs/marketing-api/adset/destination_type/
- Ad preview `ad_format`: https://developers.facebook.com/docs/marketing-api/reference/adgroup/previews/

Bentuk wajib CTX:

```json
"call_to_action": { "type": "INSTAGRAM_MESSAGE", "value": { "app_destination": "INSTAGRAM_DIRECT" } }
```

`value` hanya butuh `app_destination`; **tidak ada** `link`.

`page_welcome_message` adalah objek JSON (VISUAL_EDITOR), bukan string. Untuk creative
berbasis existing post, Meta menyimpan `call_to_action` dan `page_welcome_message` di
**akar creative** — dikonfirmasi dengan membaca creative buatan Ads Manager UI
`4464079023828872`, yang sama sekali tidak punya `object_story_spec`.

`metaClient.metaPost` sudah men-`JSON.stringify` setiap nilai objek di level atas
sebelum form-encode, jadi objek `page_welcome_message` aman dikirim apa adanya.

---

## A. Bug 1 + 2 + 3 — integritas field creative (inti)

### A1. `src/types.ts`

```ts
export type MetaPageWelcomeMessage = string | Record<string, unknown>;
export type MetaAppDestination = 'INSTAGRAM_DIRECT' | 'MESSENGER' | 'WHATSAPP';
```

- `pageWelcomeMessage?: string` → `pageWelcomeMessage?: MetaPageWelcomeMessage` pada
  keempat spec yang sudah punya field itu (single_image, video, placement_image,
  placement_customized_ctwa). String dipertahankan supaya jalur legacy WhatsApp tidak
  putus.
- `MetaExistingPostCreativeSpec` bertambah `appDestination?: MetaAppDestination` dan
  `pageWelcomeMessage?: MetaPageWelcomeMessage`.

### A2. `src/providers/meta/buildCreativeFormatPayload.ts`

Konstanta baru:

```ts
const MESSAGING_CTA_TYPES = new Set(['INSTAGRAM_MESSAGE', 'MESSAGE_PAGE', 'WHATSAPP_MESSAGE']);
```

`cta()` menerima parameter `appDestination`:

- `appDestination` terisi → `{ type, value: { app_destination } }`, tanpa `link`.
- `appDestination` + `destinationUrl` terisi bersamaan → **error**. Itu tepat bentuk
  yang membuat tombol mati; menerima keduanya berarti mengulang bug hari ini.
- CTA messaging tanpa `appDestination` → `{ type }` saja. Ini memperluas perilaku yang
  sudah ada untuk `WHATSAPP_MESSAGE` ke `INSTAGRAM_MESSAGE` dan `MESSAGE_PAGE`.
- CTA non-messaging → perilaku lama (`value.link` wajib).

`buildExistingPost()`:

- `destinationUrl` **tidak lagi wajib** untuk CTA messaging (Bug 2). Untuk CTA
  non-messaging tetap wajib, tidak berubah.
- `page_welcome_message` ditulis ke **akar payload**, bukan `object_story_spec`.
- Guard baru, dua-duanya melempar error:
  - `pageWelcomeMessage` tanpa CTA messaging → tidak akan dipakai Meta, jadi tolak.
  - `appDestination` tanpa `callToAction` → tidak ada tempat mengirimnya, jadi tolak.
- Cabang lama "`destinationUrl` tanpa `callToAction`/`collaborativeAppSpec` → error"
  tetap ada.

### A3. `MetaAdsAdapter.parseMetaCreativeSpec` — hentikan silent drop

Ini akar sistemiknya. `parseMetaCreativeSpec` memilih field per nama dan membuang
sisanya tanpa sepatah kata pun.

- Tabel `CREATIVE_SPEC_FIELDS: Record<MetaCreativeFormat, ReadonlySet<string>>` yang
  mendaftarkan field sah tiap format, berdampingan dengan tipe di `types.ts`.
- `assertKnownCreativeSpecFields(format, spec)` dipanggil di awal
  `parseMetaCreativeSpec`, memakai kembali pola `assertKnownParams` yang sudah ada.
- Pesan error menyebut format yang dipakai. Kalau key-nya sah tapi milik format lain,
  pesan menyebutkan format mana — itu kesalahan yang paling sering terjadi.
- Hint memetakan ejaan Graph mentah ke field bertipe: `app_destination`,
  `page_welcome_message`, `source_instagram_media_id`, `object_story_id`, `image_hash`,
  `video_id`, `call_to_action`, `link`, `lead_gen_form_id`, `product_set_id`.
- `destinationMode` disuntikkan `withResolvedObjectiveDestinationMode` **setelah**
  parsing, jadi tidak perlu masuk daftar. `parseMetaCreativeSpec` hanya punya satu
  pemanggil (`MetaAdsAdapter.ts:1621`), jadi jangkauannya terkendali.
- Parser baru `parsePageWelcomeMessage(value, path)` menerima string atau objek dan
  menolak tipe lain.

### A4. Permukaan skema

`appDestination` dan `pageWelcomeMessage` didokumentasikan pada `creativeSpec`
existing_post di **dua** permukaan: JSON Schema `src/broker/mcpTools.ts` dan Zod
`src/mcp/createServer.ts`. Deskripsi memuat contoh bentuk CTX yang benar dan menyatakan
`destinationUrl` tidak dipakai untuk CTA messaging.

---

## B. Bug 4 — cross-check CTA vs destination

Pre-flight ketiga di `src/tools/createAd.ts`, sepola dengan pemeriksaan omnichannel dan
placement yang sudah ada, dengan flag `skipMessagingDestinationCheck`.

Baca `destination_type` ad set dan `call_to_action` creative, lalu cocokkan:

| `destination_type` ad set | CTA creative yang diterima |
|---|---|
| `INSTAGRAM_DIRECT` | `INSTAGRAM_MESSAGE` |
| `MESSENGER` | `MESSAGE_PAGE` |
| `WHATSAPP` | `WHATSAPP_MESSAGE` |
| `MESSAGING_INSTAGRAM_DIRECT_MESSENGER` | salah satu dari dua di atas |
| `MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP` | salah satu dari ketiganya |
| `MESSAGING_INSTAGRAM_DIRECT_WHATSAPP` | `INSTAGRAM_MESSAGE` atau `WHATSAPP_MESSAGE` |
| `MESSAGING_MESSENGER_WHATSAPP` | `MESSAGE_PAGE` atau `WHATSAPP_MESSAGE` |

Ad set messaging dengan CTA non-messaging (mis. `LEARN_MORE`) juga ditolak.
`call_to_action.value.app_destination` ikut diperiksa terhadap `destination_type` yang
sama. Ad set non-messaging tidak diperiksa sama sekali — tidak ada aturan yang bisa
ditegakkan dengan yakin di sana.

---

## C. Bug 5 — `ads_clone_adset` override `attribution_spec`

`attribution_spec` ikut tersalin dari sumber dan tidak bisa ditimpa. Sumber dengan
CLICK_THROUGH 7 hari + `optimization_goal: CONVERSATIONS` ditolak Meta (subcode
1885423, "nilai yang didukung adalah jendela atribusi 1 hari"), tanpa jalan keluar di
dalam tool.

- `CloneAdSetOptions.attributionSpec?: Array<Record<string, unknown>> | null`
- `buildCloneAdSetPayload`: terisi → dipakai; `null` atau `[]` → `attribution_spec`
  warisan sumber dibuang seluruhnya; `undefined` → perilaku lama (menyalin sumber).
- Adapter mem-parse `params.attributionSpec`. Ejaan `attribution_spec` ditolak dengan
  hint yang menunjuk ke ejaan yang benar, bukan diterima diam-diam.
- Dua permukaan skema ikut diperbarui.

---

## D. Bug 6 — filter `adSetId` pada `ads_get_ad_creative_mapping`

Temuan setelah menelusuri kode: dukungan `adSetId`/`campaignId` **sudah ada** di
`src/tools/getAdCreativeMapping.ts` dan `MetaAdsAdapter.getAdCreativeMapping`, mendarat
di commit `8b1d944` (2026-07-24) — dua hari sebelum insiden. `extractParams` juga
meng-hoist argumen level atas ke `params`, jadi tidak ada yang dibuang di jalur itu.
Kemungkinan besar server MCP yang dipakai saat insiden menjalankan build lama.

Yang tetap salah dan diperbaiki di sini: deskripsi tool masih menyebut `adIds[]` saja,
sehingga tidak ada cara mengetahui filter itu tersedia. Perbaikan:

- Deskripsi (dua permukaan) mendokumentasikan `campaignId`, `adSetId`, `filtering`,
  `limit`, `cursor`.
- Test regresi yang menegaskan `adSetId` benar-benar menghasilkan permintaan ke edge
  `/{adset_id}/ads`, supaya kemampuan ini tidak hilang lagi tanpa ketahuan.

Tidak ada perubahan perilaku runtime pada bug ini — itu dicatat jujur di sini agar
tidak terkesan diperbaiki padahal hanya didokumentasikan.

---

## E. Bug 7 — enum `destinationType` creative

`CreativeDestinationType` bertambah empat nilai multi-destinasi dari dokumentasi
Destination Type: `MESSAGING_INSTAGRAM_DIRECT_MESSENGER`,
`MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP`, `MESSAGING_INSTAGRAM_DIRECT_WHATSAPP`,
`MESSAGING_MESSENGER_WHATSAPP`.

Special-case yang memaksa CTA `WHATSAPP_MESSAGE` tetap berlaku hanya untuk `'WHATSAPP'`
persis, supaya kombinasi multi-destinasi tidak dipaksa ke WhatsApp.

Nilai engagement (`ON_POST`, `ON_VIDEO`, dst.) sengaja **tidak** ditambahkan: enum ini
adalah field creative yang menyetir tipe CTA, bukan `destination_type` milik ad set.

---

## F. Bug 8 — enum `ads_get_ad_preview`

Diverifikasi ke referensi resmi `GET /{ad_id}/previews`: **seluruh sepuluh** nilai pada
`AD_PREVIEW_FORMATS` saat ini salah eja, bukan hanya `INSTAGRAM_FEED`. Tidak satu pun
muncul di enum Meta.

`AD_PREVIEW_FORMATS` diganti dengan daftar resmi lengkap (78 nilai). Ejaan lama ditolak
dengan hint yang memetakan ke ejaan yang benar, bukan dipetakan diam-diam:

| Lama (tidak valid) | Benar |
|---|---|
| `DESKTOP_FEED` | `DESKTOP_FEED_STANDARD` |
| `MOBILE_FEED` | `MOBILE_FEED_STANDARD` |
| `INSTAGRAM_FEED` | `INSTAGRAM_STANDARD` |
| `INSTAGRAM_EXPLORE` | `INSTAGRAM_EXPLORE_GRID_HOME` |
| `INSTAGRAM_STORIES` | `INSTAGRAM_STORY` |
| `INSTAGRAM_REELS` | tetap valid |
| `FACEBOOK_STORIES` | `FACEBOOK_STORY_MOBILE` |
| `MESSENGER_INBOX` | `MESSENGER_MOBILE_INBOX_MEDIA` |
| `MARKETPLACE` | `MARKETPLACE_MOBILE` |
| `REWARDS_PLATFORM` | `AUDIENCE_NETWORK_REWARDED_VIDEO` |
| `FACEBOOK_REELS` | `FACEBOOK_REELS_MOBILE` |

---

## G. Bug 9 — workflow messaging / CTX di launch matrix

`OUTCOME_ENGAGEMENT` hanya mengenal `POST` dan `VIDEO`, sehingga CTX diarahkan ke
`engagement_post` dengan `destinationType: ON_POST` — boost like/komentar, bukan
click-to-message.

- `META_CONVERSION_LOCATIONS` bertambah `'MESSAGING'`.
- Baris matrix baru `engagement_messaging`: `OUTCOME_ENGAGEMENT` + `MESSAGING`,
  `optimizationGoal: CONVERSATIONS`, `billingEvent: IMPRESSIONS`,
  `promotedObjectKind: 'page'`, `destinationMode: 'NONE'`, format yang didukung
  `existing_post` / `single_image` / `video`, `defaultCallToAction` mengikuti
  `messagingDestination`.
- Satu baris tidak bisa memuat lima `destination_type`, jadi ditambahkan input wajib
  `messagingDestination` yang menentukan `resolvedSpec.destinationType`.
  `resolveMetaObjectiveLaunchSpec` menerimanya sebagai field opsional pada request.
- `requiredInputsByCreativeFormat.existing_post` menghilangkan `creativeAsset` /
  `primaryText` / `headline` (post sudah membawa materinya sendiri) dan **tidak**
  mewajibkan `destinationUrl` — berbeda dari baris website, karena CTA messaging tidak
  memakainya.
- Preset `engagement_messaging` memuat `ads_clone_ui_ad` dan `ads_list_instagram_media`
  di `recommendedTools`. `ads_clone_ui_ad` adalah satu-satunya jalur yang berhasil pada
  insiden ini karena menyalin ad buatan UI tanpa menimpa creative, sehingga setup
  UI-only ikut utuh.
- Warning bawaan pada baris ini: `CONVERSATIONS` mewajibkan jendela atribusi 1 hari,
  merujuk ke `attributionSpec` dari Bug 5.
- Alias `whatsapp_sales` yang saat ini salah arah ke `sales_website` dialihkan ke
  workflow messaging ini.
- `inferLaunchWorkflow` mengenali kata kunci CTX/DM/WhatsApp sebelum aturan lain.

---

## H. Bug 10 — `ads_update_ad` dry-run `success: false`

`success` berarti "tidak ada error": `dry_run` → `true`, `pending_confirmation` →
`false` (itu penolakan), `executed` → `true`, `failed` → `false`.

---

## Verifikasi

Semua pengujian memakai mock client dan dry-run. **Tidak ada write ke akun Meta klien**
— `act_2326988574277142` sedang menjalankan campaign aktif.

1. Dry-run CTX pada jalur `existing_post` menghasilkan payload dengan
   `call_to_action.value.app_destination` dan `page_welcome_message` utuh, dan tanpa
   `call_to_action.value.link`.
2. Test table-driven yang menyuntikkan satu key asing ke `creativeSpec` untuk
   **kesembilan** format dan gagal bila error tidak dilempar. Ini test yang secara
   langsung menangkap kelas bug hari ini.
3. `destinationUrl` tidak lagi wajib untuk CTA messaging; tetap wajib untuk
   non-messaging.
4. Cross-check destination: `INSTAGRAM_DIRECT` + `MESSAGE_PAGE` ditolak,
   `INSTAGRAM_DIRECT` + `INSTAGRAM_MESSAGE` lolos.
5. `attributionSpec` menimpa nilai sumber; `null` menghapusnya; `undefined` menyalin.
6. `adSetId` menghasilkan permintaan ke edge `/{adset_id}/ads`.
7. Enum preview lama ditolak dengan hint; enum baru diterima.
8. `engagement_messaging` menghasilkan `destinationType` sesuai `messagingDestination`.
9. `ads_update_ad` dry-run mengembalikan `success: true`.

Selain itu: `npm run typecheck`, `npm run typecheck:tests`, `npm run lint`,
`npm test`, `npm run format`.
