# Meta Placement Assets Design

## Tujuan

Memungkinkan satu iklan Meta menggunakan dua media dengan ukuran berbeda: media 1:1 untuk Feed dan media 9:16 untuk Story/Reels. Fitur harus mudah digunakan oleh marketer tanpa menulis payload Meta mentah.

## Temuan Acuan

Iklan acuan `120250938682580394` di akun `2326988574277142` menggunakan satu ad dengan media 1080×1080 dan 1080×1920. Meta Ads Manager menyimpan hubungan ini melalui `media_sourcing_spec`, tetapi Marketing API menolak pembacaan field tersebut untuk aplikasi saat ini dengan error capability code 3 pada v23, v24, dan v25.

Iklan AI `120250938965160394` hanya menyimpan image hash 1:1. Creative tersebut tidak memiliki `media_sourcing_spec`, `asset_feed_spec`, `platform_customizations`, atau `portrait_customizations`, sehingga tidak mempunyai media 9:16 khusus Story/Reels.

## Pendekatan

Gunakan jalur Marketing API yang tersedia: `asset_feed_spec` dengan asset label dan `asset_customization_rules`. Sistem tidak akan mencoba menulis `media_sourcing_spec` yang dibatasi Meta.

Input canonical untuk creative placement berisi:

- `feedImageHash`: media 1:1 untuk Facebook dan Instagram Feed.
- `verticalImageHash`: media 9:16 untuk Facebook/Instagram Story dan Reels.
- Primary text, headline, destination, CTA, Page, dan identitas Instagram yang sudah tersedia pada creative.
- Untuk Click-to-WhatsApp, CTA, welcome message, dan destination WhatsApp yang sudah tersedia tetap dipertahankan.

Payload Meta akan berisi dua image asset berlabel dan aturan berikut:

- Label Feed dipakai untuk placement Feed Facebook dan Instagram.
- Label Vertical dipakai untuk Story dan Reels Facebook dan Instagram.
- Creative tetap menghasilkan satu ad object.

## Batas Fitur

Versi pertama hanya mendukung dua image hash: Feed 1:1 dan Story/Reels 9:16. Video, carousel, katalog, dan lebih dari dua kelompok placement tidak ditambahkan dalam perubahan ini.

Fitur tidak mengaktifkan campaign, ad set, atau ad secara otomatis. Meta dapat menyimpan creative asset dengan status `ACTIVE`, tetapi creative tersebut tidak membelanjakan dana tanpa ad aktif. Pengujian live selalu membuat ad `PAUSED`.

## Validasi

Sebelum request dikirim, sistem harus menolak input jika:

- Salah satu image hash kosong.
- Kedua image hash sama.
- Primary text atau destination wajib tidak tersedia.
- Aturan placement tidak dapat dibentuk lengkap.

Setelah creative dibuat, read-back harus memastikan `asset_feed_spec` tersedia dan mengandung dua image label serta aturan Feed dan Vertical. Jika Meta menghapus atau mengubah aturan tersebut, operasi dilaporkan gagal verifikasi dan ad tidak dibuat.

## Alur Data

1. Marketer memberikan image hash Feed dan Vertical beserta copy iklan.
2. Adapter memvalidasi input canonical.
3. Builder menghasilkan `object_story_spec` dan `asset_feed_spec` berlabel.
4. Creative dibuat dalam keadaan aman melalui alur dry-run dan konfirmasi yang sudah ada.
5. Sistem membaca kembali creative dan memeriksa dua media serta aturan placement.
6. Ad dibuat `PAUSED` hanya jika verifikasi creative berhasil.
7. Preview Feed, Story, dan Reels diperiksa pada validasi live.

## Penanganan Error

- Error input dijelaskan dengan bahasa sederhana dan menyebut field yang harus diperbaiki.
- Penolakan Meta tidak di-retry jika termasuk validation atau capability error.
- Respons tidak boleh menampilkan access token atau signed media URL.
- Creative yang gagal verifikasi tidak boleh dilanjutkan menjadi ad.

## Pengujian

- Unit test payload dua image beserta label dan aturan placement.
- Unit test penolakan hash kosong dan hash yang sama.
- Adapter test untuk parsing input dan meneruskan payload tanpa kehilangan data.
- Schema test agar input tersedia melalui MCP.
- Read-back test untuk memastikan dua label dan aturan placement benar-benar tersimpan.
- Full test, build, lint, dan secret scan sebelum commit implementasi.
- Satu live smoke test `PAUSED` pada ad set `120250937731970394`, menggunakan image hash `805c8528e3b1ccdd5bd227716ac84712` dan `8d6190c2538401e052cdd4b23e39c83a`.

## Kriteria Selesai

- Satu creative memiliki media Feed dan Vertical dengan aturan placement eksplisit.
- Satu ad `PAUSED` berhasil dibuat dari creative tersebut.
- Preview Feed memakai media 1:1 dan preview Story/Reels memakai media 9:16.
- Tidak ada objek aktif yang diubah.
- Semua tes dan pemeriksaan keamanan lulus.
