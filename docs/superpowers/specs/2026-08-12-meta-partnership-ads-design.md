# Meta Partnership Ads — Design

**Tanggal:** 2026-08-12
**Status:** Disetujui untuk implementation plan
**Branch:** `feat/meta-partnership-ads`

## Masalah

adstream-mcp belum bisa membuat **Meta Partnership Ads** — iklan yang tayang membawa dua identitas di header (brand + kreator/partner) dan memakai sinyal dari kedua akun untuk ranking. Ini kapabilitas provider yang tidak punya rumah sama sekali di repo saat ini.

Istilah `collaborative_ads` yang sudah ada di repo (`MetaAdsMode`, `createCpasCatalogCampaignBundle`) merujuk ke **CPAS / Collaborative Ads** — katalog retailer yang di-share. Itu hal yang sepenuhnya berbeda dan tidak boleh dicampur. Fitur ini memakai istilah **partnership** secara konsisten untuk menghindari tabrakan makna.

## Sumber kebenaran

Seluruh desain ini diturunkan dari dokumentasi resmi Meta (diakses 2026-08-12 lewat konektor Meta Developer Tools):

- [Partnership Ads API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads)
- [Partnership Ads Advertisable Content API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/content-discovery-api)
- [Partnership Ads Creation](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation)
- [Boost Existing Instagram Media as Partnership Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/boost-existing-post)
- [Instagram Partnership Ads with a New Ad Creative](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/use-new-creative)
- [Facebook partnership ads with a new ad creative](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ads-creation/new-fb-creative)
- [Partnership Ad Codes](https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/ad-codes)

## Cakupan

**Termasuk:**

1. Discovery konten partner (Instagram + Facebook, satu endpoint)
2. Boost konten kreator yang sudah ada — lewat media ID maupun partnership ad code
3. Creative baru dual-identity — brand atau kreator sebagai identitas primer

**Tidak termasuk:**

- Pembuatan/penghapusan partnership ad code (`POST`/`DELETE /{ig-media-id}/partnership_ad_code`). Itu operasi dari sisi **akun kreator** dan butuh token kreator dengan scope `instagram_branded_content_creator`. adstream-mcp saat ini melayani sisi brand/advertiser. Ad code tetap **dikonsumsi** oleh fitur ini, hanya tidak diterbitkan olehnya.
- Konfigurasi lanjutan partnership ads (placement asset customization, Advantage+ catalog, testimonial, lead gen). Semuanya dibangun di atas fondasi yang sama dan bisa menyusul setelah fondasi ini terbukti.

## Keputusan arsitektur

**Satu tool publik baru, plus satu add-on lintas-format pada tool yang sudah ada.**

Field partnership (`facebook_branded_content`, `instagram_branded_content`, `branded_content`) bersifat **ortogonal terhadap `creativeFormat`** — pola yang sama persis dengan `collaborativeAppSpec` yang sudah ada di repo. Karena itu partnership diperlakukan sebagai add-on pada `ads_create_adcreative`, bukan tool tersendiri.

Alternatif yang ditolak:

- **Tool `ads_create_partnership_ad` yang berdiri sendiri** — menduplikasi logika creative yang sudah matang (CTA, messaging destination, opt-out enhancements, error guidance) dan menciptakan risiko drift setiap kali `createAdCreative` berubah.
- **Bundle end-to-end campaign → adset → ad** — campaign dan ad set partnership ads tidak berbeda dari iklan biasa; bundle hanya membungkus ulang tool yang sudah ada.

Keputusan ini sejalan dengan *MCP Tool Design Decision Rules* di AGENTS.md: jangan buat tool publik baru kalau kebutuhannya bisa dipenuhi tool yang ada.

## Komponen

### 1. `ads_list_partnership_content` — tool read baru

`GET /{business-id}/partnership-ads-advertisable-content`

Endpoint terpadu ini menggantikan dua endpoint lama yang **dihapus 1 Desember 2026**: `/{ig-user-id}/branded_content_advertisable_medias` dan `/partnership-ads/{sponsor-page-id}/advertisable-posts`. Implementasi tidak boleh memakai endpoint lama.

**Input**

| Param | Wajib | Catatan |
|---|---|---|
| `businessId` | ya | Mengikuti pola `ads_list_catalogs` dan `ads_list_whatsapp_accounts` |
| `fbPageId` | salah satu | Kalau keduanya diisi, Meta mensyaratkan kedua akun sudah ter-link |
| `igUserId` | salah satu | |
| `creatorUsername` | tidak | Filter per kreator |
| `adCodes` | tidak | Maksimal 50 |
| `platform` | tidak | `INSTAGRAM` \| `FACEBOOK` |
| `mediaType` | tidak | `IMAGE` \| `VIDEO` \| `CAROUSEL` \| `LINK` |
| `postType` | tidak | `FEED` \| `STORY` \| `REEL` |
| `limit` | tidak | 1–50, default 25 |
| `cursor` | tidak | Dipetakan ke `after` milik Meta |

**Output** — dinormalisasi ke camelCase, mengikuti pola `InstagramMediaResult`:

`contentId`, `platform`, `mediaType`, `postType`, `caption`, `permalink`, `creationTime`, `author { displayName, igUserId, fbPageId, profilePictureUrl }`, `isRecommended`, `adUsage` (`NEVER_USED` \| `ACTIVE` \| `PREVIOUSLY_USED`), `partnershipInfo[] { adEligibility, taggedPartner, permissionStatus, permissionType, adCode, contentTypes }`, `organicInsights { likes, comments, views, reach, shares, interaction, saves }`.

Catatan API: hanya `content_id` yang dikembalikan secara default; semua field lain harus diminta lewat parameter `fields`. Implementasi mengirim daftar field lengkap di atas.

**Tanpa skoring, tanpa ranking, tanpa rekomendasi turunan.** Ranking "konten mana yang layak di-boost" adalah pekerjaan skill/agent, sesuai larangan eksplisit di AGENTS.md terhadap tool inti untuk recommendations dan KPI scoring. Field `isRecommended` diteruskan apa adanya karena itu penilaian Meta, bukan penilaian kita.

### 2. Add-on `partnership` pada `ads_create_adcreative`

```ts
export interface MetaPartnershipSpec {
  /** Page ID partner/kreator. Identitas partner, bukan selalu sponsor — lihat resolusi identitas. */
  partnerPageId?: string;
  /** IG user ID partner/kreator → instagram_branded_content.sponsor_id saat primaryIdentity 'advertiser' */
  partnerInstagramId?: string;
  /** IG user ID brand/advertiser → instagram_branded_content.sponsor_id saat primaryIdentity 'creator' */
  brandInstagramId?: string;
  /** Handle siapa yang muncul sebagai pengirim iklan. Default 'advertiser'. */
  primaryIdentity?: 'advertiser' | 'creator';
  /** Partnership ad code dari kreator → branded_content.instagram_boost_post_access_token */
  adCode?: string;
  /** → branded_content.ad_format. Wajib bila adCode diisi. */
  adFormat?: string;
}
```

Field dinamai menurut **peran** (`partner*`), bukan menurut posisi payload (`sponsor*`). Alasannya: mana yang menjadi `sponsor_page_id` di payload Meta berbalik tergantung `primaryIdentity`. Kalau field diberi nama `sponsorPageId`, artinya berubah-ubah tergantung field lain — sumber kesalahan pakai yang mudah dihindari lewat penamaan.

**Resolusi identitas** — `pageId` di level creative adalah Page brand, `partnerPageId` adalah Page kreator:

| `primaryIdentity` | `page_id` / `object_id` | `facebook_branded_content.sponsor_page_id` | `instagram_branded_content.sponsor_id` |
|---|---|---|---|
| `advertiser` (default) | `pageId` (brand) | `partnerPageId` (kreator) | `partnerInstagramId` (kreator) |
| `creator` | `partnerPageId` (kreator) | `pageId` (brand) | `brandInstagramId` (brand) |

`sponsor_*` **selalu** berarti identitas **sekunder**, di sisi Facebook maupun Instagram — bukan selalu kreator. Contoh creator-primary di dokumentasi Meta mengirim `facebook_branded_content.sponsor_page_id` dan `instagram_branded_content.sponsor_id` dua-duanya berisi identitas advertiser, sementara `object_story_spec.page_id` berisi Page kreator. Klaim di revisi awal spec ini ("`sponsor_id` selalu diisi `partnerInstagramId`; Meta tidak menyediakan pembalikan yang setara di sisi Instagram") **salah** dan sudah dikoreksi.

Konsekuensinya:

- `partnerInstagramId` **ditolak** bersama `primaryIdentity: 'creator'`. Meta menurunkan akun Instagram kreator dari Page kreator yang dikirim pada `object_story_spec.page_id`, jadi mengirim keduanya adalah sinyal identitas yang saling bertentangan. Ditolak dengan pesan yang menyebut kedua field, tidak dibuang diam-diam.
- `brandInstagramId` **ditolak** pada `primaryIdentity: 'advertiser'` dengan alasan cermin: di sana sponsornya kreator.
- `primaryIdentity: 'creator'` **tanpa** `brandInstagramId` tetap sah — Meta menautkan akun IG advertiser dari `sponsor_page_id`. Kasus ini membawa catatan tambahan pada hasil, satu gaya dengan catatan tautan akun.

**Pemetaan ke payload Graph**

| Jalur | Field yang dikirim |
|---|---|
| Boost via media ID | `object_id` (hasil resolusi identitas), `source_instagram_media_id`, `instagram_user_id`, `facebook_branded_content`, `instagram_branded_content`, plus `branded_content { ad_format }` bila `adFormat` diisi — contoh Meta pada jalur ini memang mengirim `branded_content` tanpa ad code |
| Boost post Facebook via `objectStoryId` | `object_story_id`, `facebook_branded_content`, `instagram_branded_content`. **Tanpa** `object_id`: post ID sudah meng-anchor Page-nya, jadi `object_id` kedua hanya menghasilkan dua Page yang mengklaim creative yang sama. Kombinasi ini belum diverifikasi terhadap API live |
| Boost via ad code | `object_id` (hasil resolusi identitas), `branded_content { instagram_boost_post_access_token, ad_format }`, `facebook_branded_content`, `instagram_branded_content`. **Tanpa** `object_story_id` dan **tanpa** `source_instagram_media_id`: ad code itu sendiri yang menjadi referensi konten, jadi `existing_post` pada jalur ini sah tanpa keduanya. |
| Creative baru dual-identity | `object_story_spec.page_id` (hasil resolusi identitas), `facebook_branded_content`, `instagram_branded_content` |

`primaryIdentity` bukan sekadar tukar posisi — ini yang menentukan handle siapa yang tampil sebagai pengirim iklan.

**Isolasi:** seluruh logika ini tinggal di modul baru `src/providers/meta/buildPartnershipFields.ts` — satu fungsi murni yang menerima `MetaPartnershipSpec` plus konteks format dan mengembalikan potongan payload. `buildCreativeFormatPayload.ts` (1259 baris) hanya memanggilnya, mengikuti pola `buildOmnichannelLinkFields` yang sudah ada di file itu. Bisa diuji penuh tanpa menyentuh Meta API.

**Format yang didukung:** `existing_post`, `single_image`, `video`, `carousel`.

**Format yang menolak `partnership`:** `catalog`, `collection`, `placement_image`, `placement_customized_ctwa`, `flexible` — ditolak dengan pesan yang menyebut nama formatnya, tidak diabaikan diam-diam. Ini konvensi yang sudah dipegang repo (lihat penolakan field creativeSpec di luar daftar per format).

Jalur boost sudah setengah tersedia: `buildExistingPost` di `buildCreativeFormatPayload.ts:584` sudah menangani `source_instagram_media_id` bersama `instagram_user_id`. Yang ditambahkan hanya lapisan identitas partnership dan `object_id`.

### 3. `ads_get_capabilities`

Melaporkan dukungan partnership ads per provider, sehingga keterbatasan provider terekspos lewat capabilities alih-alih lewat tool khusus per-provider (AGENTS.md, MCP Tool Design Decision Rule nomor 3).

## Validasi

Ditegakkan sebelum request dikirim ke Meta, supaya kegagalan datang dengan sebab yang jelas:

1. `pageId` **wajib** setiap kali `partnership` dipakai. Ad creative selalu di-anchor ke sebuah Facebook Page lewat `object_id`/`object_story_spec.page_id`, bahkan untuk partnership ad yang murni tayang di Instagram. Tanpa validasi ini, Meta menolak dengan error yang tidak menyebut sebab sebenarnya.
2. `partnership` wajib berisi minimal satu dari `partnerPageId` atau `partnerInstagramId`.
3. `adCode` tanpa `adFormat` ditolak — `branded_content.ad_format` adalah field wajib pada jalur ad code.
4. `adCode` bersamaan dengan `sourceInstagramMediaId` ditolak: keduanya adalah dua jalur boost yang berbeda, mengirim keduanya membuat sumber konten ambigu.
5. `primaryIdentity: 'creator'` tanpa `partnerPageId` ditolak — tidak ada Page ID kreator yang bisa dipasang sebagai identitas primer.
6. `partnerInstagramId` bersamaan dengan `primaryIdentity: 'creator'` ditolak — Meta menurunkan akun IG kreator dari Page kreator pada `object_story_spec.page_id`; mengirim keduanya membuat identitas kreator ambigu.
7. `brandInstagramId` pada `primaryIdentity: 'advertiser'` ditolak — pada arah itu sponsornya kreator, jadi field sponsor sisi Instagram adalah `partnerInstagramId`.
8. `partnership` bersamaan dengan `mode: 'collaborative_ads'` (CPAS) ditolak — katalog retailer yang di-share tidak punya identitas kreator, dan Meta tidak mendokumentasikan `omnichannel_link_spec` bersama field branded content.
9. `partnership` bersamaan dengan `standardAppSpec` ditolak — creative app-install tidak punya bentuk partnership yang terdokumentasi.

## Perilaku yang wajib disurfacekan

**Pending delivery.** Dokumentasi Meta: iklan yang dipublish tanpa izin kemitraan tetap diterima, tapi masuk *pending delivery state* sampai kreator menyetujui permintaan izin. Artinya `ads_create_ad` bisa mengembalikan sukses padahal iklan tidak tayang.

Karena itu hasil creative partnership membawa `permissionNote` yang menjelaskan kondisi ini setiap kali `partnership` dipakai. Sukses yang menyesatkan lebih berbahaya daripada gagal yang jelas.

**Ketergantungan tautan akun.** Bila hanya `partnerInstagramId` yang diisi, Meta otomatis me-link Page Facebook terkait — tapi bila tidak ada hard link antara akun IG dan Page FB, iklan tidak dikirim ke platform yang tidak ter-link. Hasil dry-run memuat catatan ini agar user tidak menyimpulkan jangkauan lintas-platform dari field yang terisi.

## Permission

Scope yang dibutuhkan, dan hampir pasti belum ada pada token yang beredar sekarang:

| Scope | Keperluan |
|---|---|
| `ads_management`, `business_management` | Dasar |
| `instagram_basic` | Wajib untuk semua jalur Instagram |
| `instagram_branded_content_ads_brand` | Konten kemitraan Instagram |
| `facebook_branded_content_ads_brand` | Konten kemitraan Facebook |
| `pages_read_engagement`, `pages_show_list`, `create_ads` | Akses Page dan pembuatan iklan |

Untuk discovery, minimal satu dari dua scope branded content harus ada; hanya satu berarti hasil terbatas ke platform itu saja.

Selain scope, dibutuhkan **Page access token dengan role ADVERTISE** pada Page yang ter-link ke akun IG profesional.

**Jebakan yang ditangani secara khusus:** `instagram_branded_content_ads_brand` tanpa `instagram_basic` pada akun IG yang sama menghasilkan **403**, bukan pesan yang menjelaskan. `metaCreativeErrorGuidance` diperluas untuk memetakan 403 dan `#200` pada jalur partnership menjadi pesan yang menyebut scope mana yang kurang.

## Write safety

Tidak ada jalur mutasi baru. `createAdCreative` sudah menegakkan `dry_run` → `pending_confirmation` → `executed` lengkap dengan preview payload. Field partnership ikut masuk ke preview itu apa adanya, sehingga user melihat Page ID siapa yang menjadi identitas primer **sebelum** eksekusi — salah `primaryIdentity` berarti iklan tayang dari handle yang salah.

## Testing

Unit test murni tanpa memanggil Meta API, sesuai panduan testing repo:

- `tests/metaPartnershipFields.test.ts`
  - pemetaan ketiga jalur (media ID, ad code, dual-identity baru)
  - `primaryIdentity: 'creator'` menaruh Page ID kreator di `page_id`/`object_id`
  - kelima aturan validasi di atas, masing-masing dengan pesan yang menyebut field penyebabnya
  - penolakan pada format tak didukung menyebut nama format
- `tests/listPartnershipContent.test.ts`
  - normalisasi snake_case → camelCase
  - `partnershipInfo` kosong dan `organicInsights` bernilai null
  - paginasi cursor
  - penolakan bila `fbPageId` dan `igUserId` dua-duanya kosong
- `tests/mcpServerBuilder.test.ts` — tambahan assert bahwa `ads_list_partnership_content` terdaftar dengan skema yang benar

## Titik sentuh

Tool read baru (mengikuti jalur `ads_list_instagram_media`):

`src/tools/listPartnershipContent.ts` → `src/index.ts` → `src/broker/types.ts` → `src/broker/AdsBroker.ts` → `src/providers/meta/MetaAdsAdapter.ts` → `src/broker/mcpTools.ts` → `src/mcp/createServer.ts`

Add-on creative:

`src/types.ts` → `src/providers/meta/buildPartnershipFields.ts` (baru) → `src/providers/meta/buildCreativeFormatPayload.ts` → `src/tools/createAdCreative.ts` → `src/broker/mcpTools.ts` → `src/mcp/createServer.ts` → `src/providers/meta/metaCreativeErrorGuidance.ts`

## Open item

**Nilai enum `branded_content.ad_format` tidak dipublikasikan Meta.** Dokumentasi resmi hanya menulis `<AD_FORMAT_TYPE>` tanpa mendaftar nilainya.

Penanganan: terima sebagai string bebas, validasi hanya "tidak boleh kosong bila `adCode` diisi", biarkan Meta yang menolak nilai yang salah, lalu tangkap error itu di `metaCreativeErrorGuidance` agar pesannya berguna. Nilai enum tidak ditebak. Bila verifikasi live nanti mengungkap daftar nilainya, enum bisa dipersempit sebagai perubahan terpisah.
