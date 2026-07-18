# ads_read_creative_full

## Tujuan

**Reverse engineering tool** untuk membaca **seluruh konfigurasi** sebuah Meta Ad Creative.

Tool ini mengembalikan **semua field** dari endpoint Graph API `GET /{creative_id}?fields=...` tanpa filter — sehingga payload yang dikembalikan adalah representasi **asli dari Meta**.

### Kegunaan

- **Reverse engineering fitur baru Meta Ads**: CTWA, Carousel, Collection, DCO, Catalog Sales, Advantage+ Creative, dll.
- **Meng-inspeksi creative yang sudah berjalan** di Meta Ads Manager untuk melihat konfigurasi persisnya.
- **Referensi implementasi MCP**: jadikan payload asli sebagai referensi saat membuat tool create/update creative.
- **Audit & debugging**: lihat nilai aktual `object_story_spec`, `asset_feed_spec`, `page_welcome_message`, `tracking_specs`, dll.

---

## Cara Kerja

1. Panggil `GET /{creative_id}?fields=[semua field yang dikenal]`
2. Jika request pertama gagal (URL terlalu panjang / field limit), fallback ke **dua request paralel** dan merge hasilnya.
3. Kembalikan seluruh payload dalam format JSON lengkap.

### Field yang Diminta

| Kategori | Field |
|----------|-------|
| **Core Identity** | `id`, `name`, `status`, `object_type`, `object_story_id`, `effective_object_story_id` |
| **Ad Account** | `actor_id`, `instagram_actor_id`, `instagram_permalink_url` |
| **Compliance** | `authorization_category`, `destination_type` |
| **Assets** | `thumbnail_url`, `title`, `body`, `link`, `url_tags`, `image_hash`, `image_url`, `video_id` |
| **Structured Data** | `object_story_spec`, `asset_feed_spec`, `call_to_action`, `page_welcome_message` |
| **Dynamic Creative** | `degrees_of_freedom_spec`, `asset_customization_rules`, `contextual_multi_ads` |
| **Tracking** | `tracking_specs`, `branded_content` |
| **Raw Data** | `template_data`, `link_data`, `photo_data`, `video_data` |

---

## Contoh Request

```
GET /v21.0/{creative_id}?fields=id,name,status,object_type,object_story_spec,asset_feed_spec,...
```

---

## Contoh Response

### Creative POSTER (Link Ad)

```json
{
  "id": "120330899389530268",
  "name": "CTWA Test Creative",
  "status": "ACTIVE",
  "object_type": "SHARE",
  "object_story_spec": {
    "page_id": "123456789",
    "link_data": {
      "link": "https://example.com/landing",
      "message": "Primary ad text here",
      "name": "Headline here",
      "description": "Description text",
      "call_to_action": {
        "type": "WHATSAPP_MESSAGE"
      },
      "image_hash": "abc123def456"
    }
  },
  "page_welcome_message": "Halo, ada yang bisa dibantu?",
  "call_to_action": {
    "type": "WHATSAPP_MESSAGE"
  },
  "image_hash": "abc123def456",
  "thumbnail_url": "https://example.com/thumb.jpg",
  "title": "Headline here",
  "body": "Primary ad text here",
  "link": "https://example.com/landing",
  "destination_type": "WEBSITE"
}
```

### Creative Dynamic (Advantage+ / DCO)

```json
{
  "id": "120330899389530269",
  "name": "DCO Test",
  "status": "ACTIVE",
  "object_type": "SHARE",
  "asset_feed_spec": {
    "ad_formats": ["AUTOMATIC_FORMAT"],
    "bodies": [
      { "text": "Variant 1 body" },
      { "text": "Variant 2 body" }
    ],
    "titles": [
      { "text": "Headline A" },
      { "text": "Headline B" }
    ],
    "link_urls": [
      { "website_url": "https://example.com/shop" }
    ],
    "call_to_action_types": ["SHOP_NOW"],
    "images": [
      { "hash": "hash1" },
      { "hash": "hash2" }
    ]
  },
  "degrees_of_freedom_spec": {
    "creative_feature_settings": {
      "adaptive_assets": true,
      "autoflow": true,
      "ad_creative_feature_3": true,
      "ad_creative_feature_5": true,
      "ad_creative_feature_6": true
    },
    "degrees_of_freedom": [
      "ad_creative_feature_3",
      "ad_creative_feature_5",
      "ad_creative_feature_6",
      "adaptive_assets",
      "autoflow"
    ]
  }
}
```

---

## Analisis Coverage Field

### Selalu Tersedia

| Field | Keterangan |
|-------|-----------|
| `id` | Selalu ada |
| `name` | Nama creative |
| `status` | ACTIVE / PAUSED / ARCHIVED |
| `object_type` | Tipe object (SHARE, PHOTO, STATUS, dll) |

### Hanya Muncul pada Tipe Creative Tertentu

| Field | Muncul Pada |
|-------|-------------|
| `object_story_spec` | Semua creative kecuali Dynamic Creative murni |
| `asset_feed_spec` | Dynamic Creative / Advantage+ Creative |
| `asset_customization_rules` | Dynamic Creative dengan aturan kustom |
| `degrees_of_freedom_spec` | Dynamic Creative / Advantage+ |
| `page_welcome_message` | CTWA (Click to WhatsApp) creative |
| `call_to_action.type = WHATSAPP_MESSAGE` | CTWA creative |
| `link_data` | Link ad / Carousel |
| `video_data` | Video ad |
| `photo_data` | Photo ad |
| `branded_content` | Branded content ads |
| `contextual_multi_ads` | Multi-ad creative |
| `instagram_actor_id` | Jika creative diposting ke Instagram |
| `instagram_permalink_url` | Jika creative sudah live di Instagram |
| `template_data` | Template-based creative |
| `url_tags` | Jika URL tags dikonfigurasi |
| `tracking_specs` | Jika tracking spec dikonfigurasi |

### Belum Bisa Diambil via Graph API (atau Tidak Konsisten)

| Field | Status |
|-------|--------|
| `preview_creative_id` | Tidak tersedia di read, hanya saat create |
| `object_story_spec.video_data.video_id` | Perlu akses ke `/video_id` terpisah |
| `recommendations` | Tidak ada di endpoint creative read |
| `creative optimization details` | Ada di `/ads` level, bukan `/creative` |
| `adcreatives_feedback` | Endpoint terpisah |
| `insights` | Perlu endpoint insights terpisah |

---

## Penggunaan untuk Reverse Engineering

### Workflow yang Direkomendasikan

1. **Buat iklan** langsung di Meta Ads Manager (UI)
2. **Cari creative ID** via:
   - `ads_list_advideos` — daftar video
   - `ads_get_ad_creative_mapping` — mapping ad → creative
   - Buka Meta Ads Manager → pilih iklan → lihat creative ID di URL
3. **Jalankan** `ads_read_creative_full` dengan creative ID tersebut
4. **Simpan payload** sebagai JSON referensi
5. **Gunakan payload** sebagai referensi implementasi tool MCP

### Contoh CTWA Reverse Engineering

```javascript
// Langkah 1: Buat CTWA iklan di Meta Ads Manager
// Langkah 2: Dapatkan creative_id (misal: 120330899389530268)
// Langkah 3: Jalankan:
//   tool: ads_read_creative_full
//   args: { creativeId: "120330899389530268" }
// Langkah 4: Lihat payload → object_story_spec + page_welcome_message
// Langkah 5: Implementasi tool createAdCreative dengan payload yang sama
```

---

## Catatan Teknis

- Tool ini **read-only** — tidak mengubah apapun.
- Tidak memerlukan `adAccountId` — cukup `creativeId`.
- Meta API field limit: tidak ada batasan ketat per-request, tapi URL length limited (~8K chars). Field list kita ~400 chars — aman.
- Jika field tidak tersedia untuk creative tertentu, field tersebut tidak muncul di response (Meta tidak mengembalikan `null` untuk field yang tidak relevan).
- Field `ad_format` (preview) tidak termasuk — gunakan `ads_get_ad_preview` untuk itu.
