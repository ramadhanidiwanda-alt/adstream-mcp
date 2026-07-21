# Meta Omnichannel Video/Existing-Post Creative Design

## Tujuan

Memungkinkan `ads_create_adcreative` membuat creative `video`, `single_image`, dan `existing_post` yang bisa dipasang ke ad set omnichannel/CPAS (`promoted_object.omnichannel_object` dengan `app` + `pixel`, dipakai untuk CPAS Shopee/Tokopedia), tanpa mewajibkan `mode: 'collaborative_ads'` atau product set katalog yang tidak relevan untuk skenario ini.

## Temuan Acuan

Akun `act_662014947775593` ("CPAS SHOPEE PNP Beauty"), ad set `120250770728520071` ("30D | PUR | PAYDAY GLOWDAY 25-27 JULI") memakai `promoted_object.omnichannel_object` berisi `app` dan `pixel` — bukan `product_set_id`. Memasang ad video/existing_post ke ad set ini gagal di Graph API asli dengan dua error tergantung bentuk `call_to_action` creative:

- Subcode `2446455`: `applink_treatment` wajib diisi di creative.
- Subcode `1359187`: `call_to_action` creative wajib punya `object_store_urls`.

Investigasi kode menunjukkan mekanisme omnichannel sudah ada (`collaborativeAppSpec`, `MetaCollaborativeAppSpec`, `buildOmnichannelLinkFields()`), tetapi pemasangannya tidak konsisten antar format:

- `cta()` sudah menyertakan `object_store_urls` kapan pun `collaborativeAppSpec` dikirim, terlepas dari `mode` — dikonfirmasi lewat dry-run `creativeFormat: video`, `mode: standard`, dengan `collaborativeAppSpec`. Subcode `1359187` sebenarnya sudah teratasi untuk `video`/`single_image` hari ini.
- `applink_treatment` + `omnichannel_link_spec` hanya ditambahkan lewat `withCollaborativeCatalogContext()`, yang digerbangi `mode === 'collaborative_ads'`. Gerbang itu juga mewajibkan `collaborativeProductSetId` tanpa syarat — dikonfirmasi lewat dry-run `mode: collaborative_ads` + `video` yang gagal dengan "Product set Collaborative Ads wajib diisi", walau `video` tidak pernah memakai product set itu di payload-nya.
- `placement_image` sudah menerapkan pola yang benar: menambahkan `buildOmnichannelLinkFields()` langsung berdasarkan ada/tidaknya `collaborativeAppSpec`, tanpa syarat `mode` atau product set.
- `existing_post` (`buildExistingPost()`) sama sekali tidak memakai `collaborativeAppSpec`, dan `MetaExistingPostCreativeSpec` tidak punya `destinationUrl` untuk membentuk `omnichannel_link_spec.web.url`.

## Pendekatan

Perubahan bersifat aditif — tidak menyentuh jalur `mode: 'collaborative_ads'` yang sudah ada untuk `catalog`/`collection` (masih mewajibkan product set, tidak berubah), dan tidak mengubah perilaku ad set tanpa `promoted_object.omnichannel_object` (creative tanpa `collaborativeAppSpec` sama sekali tidak terpengaruh).

1. **`buildVideo` dan `buildSingleImage`**: setelah payload dasar terbentuk, jika `input.mode !== 'collaborative_ads'` dan `input.collaborativeAppSpec` ada, gabungkan `buildOmnichannelLinkFields(destinationUrl, collaborativeAppSpec, applinkTreatment)` langsung ke payload — meniru pola `placement_image`. Saat `mode === 'collaborative_ads'`, jalur lama (`withCollaborativeCatalogContext`, mewajibkan product set) tetap dipakai apa adanya untuk menjaga kompatibilitas mundur skenario Collaborative Ads berbasis katalog yang sudah ada.

2. **`buildExistingPost`**: tambahkan `destinationUrl?: string` opsional ke `MetaExistingPostCreativeSpec`. Jika `collaborativeAppSpec` dikirim, `destinationUrl` menjadi wajib (dipakai untuk `omnichannel_link_spec.web.url`), lalu gabungkan `buildOmnichannelLinkFields()` ke payload seperti format lain.

3. **`applink_treatment` jadi bisa dikonfigurasi**: tambahkan `applinkTreatment?: MetaApplinkTreatment` opsional pada creative spec (`video`, `single_image`, `existing_post`), dengan enum sesuai dokumentasi Meta: `deeplink_with_appstore_fallback`, `deeplink_with_web_fallback`, `web_only`, `deeplink_disabled`. `buildOmnichannelLinkFields()` menerima override ini sebagai parameter ketiga; kalau tidak diisi, default tetap `'automatic'` seperti perilaku hari ini (tidak breaking untuk caller `collaborative_ads` yang sudah ada).

4. **Skema JSON (`mcpTools.ts`)**: tambahkan `applinkTreatment` sebagai properti eksplisit pada `creativeSpec`, dan perluas deskripsi format `existing_post` untuk menyebut `destinationUrl` opsional/wajib-bersyarat plus catatan keterbatasan di bawah.

## Batas Fitur (Non-Goal)

- Jalur `flexible` (Advantage+/Dynamic Creative Optimization) tidak disentuh sama sekali.
- Perilaku `mode: 'collaborative_ads'` untuk `catalog`/`collection` (termasuk kewajiban `collaborativeProductSetId`) tidak berubah.
- `carousel`, `placement_customized_ctwa` tidak mendapat perubahan — di luar cakupan yang diminta.
- **Keterbatasan `existing_post`**: field `omnichannel_link_spec`/`applink_treatment` ada di level creative dan bisa ditambahkan lewat perubahan ini. Namun `object_store_urls` pada subcode `1359187` melekat pada `call_to_action` milik **post** yang direferensikan (`object_story_id`), yang sudah dipatenkan saat post itu pertama kali dipublikasikan. Mereferensikan post lama lewat `existing_post` kemungkinan besar **tidak** bisa memperbaiki CTA yang sudah telanjur tidak punya `object_store_urls`. Perubahan ini tetap menambahkan wiring-nya (berguna kalau post sumber sudah dibuat lewat builder `video` yang sudah diperbaiki), tapi skema akan mencantumkan catatan peringatan ini secara eksplisit. Caller CPAS omnichannel disarankan memakai `creativeFormat: video` langsung, bukan `existing_post`, untuk memastikan kepatuhan penuh.

## Alur Data

1. Caller mengirim `creativeFormat: video` (atau `single_image`/`existing_post`) beserta `collaborativeAppSpec` (identitas app Shopee/Tokopedia) dan (untuk `existing_post`) `destinationUrl`.
2. `buildMetaCreativeFormatPayload` memanggil builder format yang sesuai.
3. Builder menyusun `object_story_spec`/`object_story_id` seperti biasa, termasuk `call_to_action.value.object_store_urls` (sudah berjalan hari ini lewat `cta()`).
4. Jika `collaborativeAppSpec` ada dan `mode` bukan `collaborative_ads`, builder menambahkan `applink_treatment` + `omnichannel_link_spec` ke payload level teratas.
5. Payload dikirim lewat alur dry-run/konfirmasi yang sudah ada — tidak ada perubahan pada flow eksekusi, retry, atau verifikasi read-back.

## Penanganan Error

- Kalau `collaborativeAppSpec` dikirim untuk `existing_post` tanpa `destinationUrl`, lempar error validasi jelas ("destinationUrl wajib diisi untuk existing_post ber-omnichannel.") sebelum request dikirim ke Meta — konsisten dengan pola `required()` yang sudah dipakai di file ini.
- `applinkTreatment` yang bukan salah satu dari 4 nilai enum didokumentasikan akan lolos ke Meta apa adanya (tidak divalidasi lokal secara ketat) dan Meta yang menolak — konsisten dengan pola CTA type free-string yang sudah ada di codebase ini.
- Tidak ada perubahan pada penanganan error Meta (`formatStructuredMetaWriteError`, `getMetaCreativeErrorGuidance`) — subcode `2446455`/`1359187` sudah punya pemetaan guidance yang ada atau akan tetap jatuh ke pesan generik Meta.

## Pengujian

- Unit test `buildCreativeFormatPayload`: `video`/`single_image` dengan `collaborativeAppSpec` di `mode: standard` menghasilkan `applink_treatment` + `omnichannel_link_spec` di payload teratas, dan `mode: collaborative_ads` tanpa product set tetap gagal seperti sekarang (regresi negatif).
- Unit test `applinkTreatment` override: nilai custom terpakai; kalau tidak diisi, default `'automatic'`.
- Unit test `existing_post` + `collaborativeAppSpec`: `destinationUrl` hadir → payload berisi `object_story_id` + `omnichannel_link_spec`; `destinationUrl` hilang → error validasi.
- Regression test: `video`/`single_image`/`existing_post` tanpa `collaborativeAppSpec` sama sekali menghasilkan payload identik dengan sebelum perubahan (tidak ada field baru muncul).
- Schema test (`mcpTools.ts`) memastikan `applinkTreatment` dan deskripsi `existing_post` yang diperbarui muncul di JSON schema tool.
- Dry-run smoke test manual terhadap ad set `120250770728520071` (sudah dilakukan sebagian selama riset) untuk memverifikasi payload akhir sebelum implementasi dianggap selesai; live create tetap butuh persetujuan eksplisit pengguna sebelum dijalankan.

## Kriteria Selesai

- `ads_create_adcreative` dengan `creativeFormat: video` + `collaborativeAppSpec` di ad set omnichannel CPAS menghasilkan payload yang mengandung `applink_treatment`, `omnichannel_link_spec`, dan `object_store_urls` tanpa perlu `mode: collaborative_ads` atau product set.
- Perilaku `catalog`/`collection` via `mode: collaborative_ads` tidak berubah.
- Ad set/creative tanpa `omnichannel_object` tidak menerima field baru apa pun (payload identik seperti sebelum perubahan).
- Semua unit test baru dan yang sudah ada lulus, build dan lint bersih.
