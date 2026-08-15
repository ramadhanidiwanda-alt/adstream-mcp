# Threads ad identity: nama field, penempatan, dan turunan identitas

## Kenapa dokumen ini ada

Branch `fix/meta-threads-identity-visibility` memperbaiki bug di mana identitas
Threads dikirim ke Meta memakai nama field `threads_profile_id` — field itu
**tidak pernah ada** di Graph API. Meta membuang field yang tidak dikenal
**tanpa error apa pun**: creative tetap sukses dibuat, request mengembalikan
`200 OK`, tapi identitas Threads-nya hilang begitu saja. Tidak ada log,
tidak ada warning, tidak ada sinyal kegagalan di respons — satu-satunya cara
menyadarinya adalah membaca ulang creative dan melihat field yang seharusnya
terisi ternyata kosong.

Bug ini juga menghapus option yang sama secara total di jalur creative utama
(setiap creative yang dibangun lewat `creativeFormat` kehilangan
`threadsProfileId` tanpa peringatan), dan sisi baca diperluas supaya
identitas ini bisa diverifikasi kembali dari luar.

Tidak satu pun dari fakta di bawah ini bisa dibaca ulang dari kode begitu
saja — nama field yang benar, aturan penempatan, dan aturan turunan identitas
semuanya berasal dari dokumentasi Meta dan dari inspeksi data lapangan.
Tanpa catatan ini, kesalahan yang sama akan terulang. Precedent untuk
dokumen jenis ini: `docs/meta/multi-media-ads-missing-text-incident.md`.

---

## Nama field yang benar

| Yang dipakai (salah) | Yang benar di Graph API |
|---|---|
| `threads_profile_id` | `threads_user_id` |

`threads_user_id` adalah field yang benar-benar terdaftar di Meta Ad Creative
reference (tipe `numeric string`). `threads_profile_id` tidak pernah ada.

Karena Meta membuang field creative yang tidak dikenal tanpa error, kesalahan
ini tidak pernah terlihat lewat testing biasa — creative selalu "berhasil"
dibuat. Kode sekarang punya guard eksplisit untuk ini: kalau caller mengirim
`threads_user_id` atau `threads_profile_id` secara raw ke
`ads_create_adcreative`, adapter menolaknya dengan hint yang menunjuk ke
nama parameter MCP yang benar (lihat
`CREATE_AD_CREATIVE_PARAM_HINTS` di `src/providers/meta/MetaAdsAdapter.ts:4285-4287`):

```ts
threads_user_id: 'threadsProfileId',
threads_profile_id:
  'threadsProfileId (catatan: threads_profile_id bukan field Graph API — nama yang benar adalah threads_user_id)',
```

## Parameter MCP tetap `threadsProfileId`

Nama parameter MCP **sengaja tidak diubah** demi kompatibilitas ke belakang —
caller yang sudah memakai `threadsProfileId` tidak perlu migrasi. Yang
berubah hanya nama field di wire, di titik terakhir sebelum payload dikirim
ke Graph API.

| Lapisan | Nama |
|---|---|
| Parameter MCP (`ads_create_adcreative`, `ads_create_ad`, dll.) | `threadsProfileId` |
| Field Graph API di payload | `threads_user_id` |

Pemetaan ini terjadi di helper `socialIdentity`
(`src/providers/meta/buildCreativeFormatPayload.ts:1396-1404`):

```ts
function socialIdentity(
  input: Pick<BuildMetaCreativeFormatPayloadInput, 'instagramUserId' | 'threadsProfileId'>
): Record<string, string> {
  const identity: Record<string, string> = {};
  const instagramUserId = optional(input.instagramUserId, 'instagramUserId');
  if (instagramUserId) identity.instagram_user_id = instagramUserId;
  const threadsUserId = optional(input.threadsProfileId, 'threadsProfileId');
  if (threadsUserId) identity.threads_user_id = threadsUserId;
  return identity;
}
```

Jangan "perbaiki" nama parameter MCP ini menjadi `threadsUserId` — itu bukan
bug, itu keputusan kompatibilitas yang disengaja.

## Penempatan: `object_story_spec` vs level atas

Dokumentasi Meta membedakan `instagram_user_id` dan `threads_user_id`:
`instagram_user_id` wajib berada di dalam `object_story_spec`, sedangkan
`threads_user_id` boleh diletakkan di dalam `object_story_spec` **atau** di
level atas (root) payload API.

Repo ini sekarang memakai **kedua** penempatan itu, tergantung jalur:

| Jalur | Penempatan `threads_user_id` | Alasan |
|---|---|---|
| Sebagian besar format creative (`socialIdentity`, dipakai di banyak builder di `buildCreativeFormatPayload.ts`) | Di dalam `object_story_spec` | Format-format ini memang membangun `object_story_spec` untuk field lain, jadi identitas ikut di sana |
| `creativeSpec.sourceInstagramMediaId` (existing-post / boost media IG yang tidak di-cross-post) | Di level root payload | Jalur ini **tidak membangun `object_story_spec` sama sekali** — tidak ada tempat di dalamnya untuk menaruh identitas |

> Kalau brief atau catatan lama menyebut "penempatan level atas tidak
> didukung" — itu sudah usang. Paragraf ini menggantikannya: kedua
> penempatan valid menurut Meta, dan repo ini memakai keduanya sesuai
> kebutuhan tiap jalur.

Karena ada dua kemungkinan penempatan, **sisi baca mengecek keduanya**:
`evaluateIdentity` di `src/providers/meta/creativeCompliance.ts` membaca
`object_story_spec.threads_user_id` lebih dulu, lalu jatuh ke
`threads_user_id` di root payload sebagai fallback sebelum menyimpulkan
identitasnya benar-benar tidak ada (lihat komentar di
`MetaCreativeComplianceInput`, `src/providers/meta/creativeCompliance.ts:18-27`).

Referensi Meta: [Ad Creative reference](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/).

## Aturan turunan identitas Threads dari Instagram

Pada akun yang Threads-nya terhubung ke Instagram, Meta **menurunkan**
identitas Threads dari `instagram_user_id` — tidak perlu (dan tidak akan
selalu ada) `threads_user_id` eksplisit. Akibatnya, `threads_user_id`
**akan terbaca kosong** meskipun iklan benar-benar tayang di Threads.
**Kosong di sini bukan berarti gagal.**

Bukti lapangan: akun `act_1417353822551653`, rentang `2026-07-13` sampai
`2026-08-15`, breakdown `publisher_platform=threads` /
`platform_position=threads_feed` menunjukkan delivery nyata: Rp5.982 spend,
1.151 impresi, 51 klik, CTR 4,43% — pada creative yang `threads_user_id`-nya
kosong saat dibaca balik.

## Aturan turunan identitas Instagram dari Facebook Page

Ini temuan baru dari investigasi ini, dan paling bernilai untuk didokumentasikan
karena tidak ada di dokumentasi resmi Meta secara eksplisit sejauh yang
ditemukan: creative yang **sama sekali tidak punya** `instagram_user_id`
tetap bisa tayang di Instagram. Meta jatuh ke akun Instagram yang terhubung
ke Facebook Page-nya.

Bukti: dua creative yang dibandingkan pada akun yang sama —
`1922703931759714` (tanpa `instagram_user_id`) dan `2080446776238802`
(dengan `instagram_user_id` = `17841439260136409`) — identik secara
struktural, dan **keduanya** punya `instagram_permalink_url` terisi
(artinya keduanya benar-benar terposting/tayang di Instagram). Instagram
menyerap sekitar 87% belanja akun ini.

Yang hilang di sini **bukan delivery** — delivery tetap jalan lewat fallback
Page. Yang hilang adalah:

- kendali eksplisit atas akun IG mana yang memposting kalau Page terhubung
  ke lebih dari satu kemungkinan, dan
- ketahanan (resilience) bila tautan Instagram di Page itu berubah di
  kemudian hari — creative lama tidak "mengunci" akun IG yang dipakai.

Karena delivery tetap berjalan dan yang hilang hanya kendali eksplisit, audit
kepatuhan memberi status `MANUAL_REVIEW` dengan
`identity.threads_identity_source = 'derived_from_page'` — **bukan** `FAIL`.
Definisi lengkap keempat nilai `threads_identity_source` ada di
`src/broker/types.ts:170-189`:

```ts
export type AdsThreadsIdentitySource =
  | 'explicit'              // threads_user_id di-set langsung
  | 'derived_from_instagram'// tidak ada threads_user_id, tapi instagram_user_id ada
  | 'derived_from_page'     // tidak ada instagram_user_id maupun threads_user_id
  | 'none';                 // tidak berlaku (existing-post NOT_APPLICABLE, atau UNKNOWN)
```

## `instagram_actor_id` bukan `instagram_user_id`

`instagram_actor_id` adalah field lama (legacy) di level Ad Account, dan
**bukan** field yang sama dengan `instagram_user_id`. Hanya
`instagram_user_id` yang menentukan identitas Instagram/Threads pada
`object_story_spec`.

Pada akun live yang diinspeksi selama investigasi ini, `instagram_actor_id`
kembali **kosong**. Jangan pakai field ini sebagai fallback identitas —
field ini tidak reliable untuk tujuan itu dan secara semantik memang bukan
field yang sama.

## Cara verifikasi

1. **`ads_read_creative_full`** — baca seluruh payload creative apa adanya
   dari Meta. Cek `fields_retrieved` untuk memastikan `threads_user_id` dan
   `instagram_user_id` memang diminta dan (kalau ada) terisi.
2. **`ads_get_creatives`** dengan `params.complianceAudit=true` — cek
   `identity.threads_identity_source`. Empat nilainya: `explicit`,
   `derived_from_instagram`, `derived_from_page`, `none`. Status
   `derived_from_instagram` dan `derived_from_page` adalah konfigurasi yang
   sah, bukan kegagalan.
3. **`ads_get_placement_performance`** — untuk membuktikan delivery yang
   sesungguhnya (`publisher_platform=threads` / `platform_position=threads_feed`,
   atau `publisher_platform=instagram`), terlepas dari apa yang terbaca di
   field identitas creative-nya.

## Lihat juga

- `docs/meta/ads_read_creative_full.md` — dokumentasi tool baca creative;
  lihat catatan `threads_user_id sering kosong` di bagian "Field yang Diminta".
- `docs/meta/multi-media-ads-missing-text-incident.md` — precedent untuk
  jenis catatan ini: field yang didokumentasikan Meta tapi tidak dipetakan
  di kode, dan efeknya baru terlihat lewat readback produksi.
