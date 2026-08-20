/**
 * Jalankan perubahan status (pause/resume) lalu BUKTIKAN hasilnya.
 *
 * `POST /{id}` dengan `status` mengembalikan `{"success": true}` begitu Meta
 * menerima permintaannya — itu ack, bukan bukti bahwa objeknya benar-benar
 * berpindah status. Versi sebelumnya melaporkan `success: result.success ?? true`
 * tanpa membaca ulang apa pun, sehingga "API sukses tapi statusnya masih PAUSED"
 * dilaporkan sebagai keberhasilan penuh.
 *
 * Yang menentukan adalah `status` milik objek itu sendiri. `effective_status`
 * dibawa sebagai konteks, bukan sebagai kriteria lulus: sebuah ad set yang sudah
 * benar-benar ACTIVE tetap melaporkan `effective_status: CAMPAIGN_PAUSED` selama
 * campaign induknya paused — itu perilaku benar, bukan kegagalan.
 */
import type { MetaClient } from '../../metaClient.js';
import type { MutateEntityType, MutationOperation, MutationResult } from '../../types.js';

export type RequestedStatus = 'ACTIVE' | 'PAUSED';

export interface StatusReadBack {
  requested: RequestedStatus;
  /** Status objek setelah write, dibaca ulang dari Graph API. */
  status?: string;
  /** Status efektif termasuk pengaruh parent (mis. CAMPAIGN_PAUSED). */
  effectiveStatus?: string;
  /** true hanya bila `status` yang dibaca ulang sama dengan yang diminta. */
  applied: boolean;
  /** Penjelasan saat effective_status berbeda dari status objek sendiri. */
  note?: string;
  /** Terisi bila read-back gagal: status TIDAK terverifikasi. */
  unverified?: string;
}

function describeEffectiveStatus(
  requested: RequestedStatus,
  status: string | undefined,
  effectiveStatus: string | undefined
): string | undefined {
  if (!effectiveStatus || !status) return undefined;
  if (effectiveStatus === status) return undefined;
  if (requested === 'ACTIVE') {
    return `status objek ACTIVE, tetapi effective_status ${effectiveStatus} — objek ini belum tayang karena parent-nya (campaign/ad set) masih paused atau ada pembatas lain. Resume parent-nya juga bila memang mau jalan.`;
  }
  return `status objek ${status}, effective_status ${effectiveStatus}.`;
}

/**
 * POST status ke `/{id}`, lalu baca ulang `status,effective_status`.
 *
 * Read-back yang gagal tidak membatalkan write (mutasinya mungkin sukses) —
 * hasilnya ditandai `unverified` supaya pemanggil tahu bedanya "terbukti
 * berhasil" dan "tidak bisa dibuktikan".
 */
export async function mutateStatusWithReadBack(
  client: MetaClient,
  id: string,
  params: {
    status: RequestedStatus;
    operation: MutationOperation;
    entityType: MutateEntityType;
    maxRetries: number;
  }
): Promise<MutationResult> {
  const { status: requested, operation, entityType, maxRetries } = params;

  const response = await client.metaPost<{ success?: boolean }>(
    `/${id}`,
    { status: requested },
    maxRetries
  );

  // Meta hanya mengirim {"success": true}; ketiadaan field itu bukan kegagalan,
  // tapi juga bukan bukti — pembuktiannya ada di read-back di bawah.
  const acknowledged = response?.success !== false;

  let readBack: StatusReadBack;
  try {
    const current = await client.metaGetObject<Record<string, unknown>>(
      `/${id}`,
      { fields: 'status,effective_status' },
      maxRetries
    );
    const currentStatus = typeof current.status === 'string' ? current.status : undefined;
    const effectiveStatus =
      typeof current.effective_status === 'string' ? current.effective_status : undefined;
    readBack = {
      requested,
      status: currentStatus,
      effectiveStatus,
      applied: currentStatus === requested,
      ...(describeEffectiveStatus(requested, currentStatus, effectiveStatus)
        ? { note: describeEffectiveStatus(requested, currentStatus, effectiveStatus) }
        : {}),
    };
  } catch (error) {
    readBack = {
      requested,
      applied: false,
      unverified: `Read-back gagal (${error instanceof Error ? error.message : String(error)}). Write-nya mungkin sudah berhasil, tapi statusnya tidak terverifikasi — cek ulang di Ads Manager.`,
    };
  }

  // Read-back gagal != mutasi gagal. Yang dianggap gagal hanya bila read-back
  // berhasil DAN menunjukkan status tidak berubah.
  const verifiedMismatch = readBack.unverified === undefined && !readBack.applied;

  return {
    success: acknowledged && !verifiedMismatch,
    id,
    operation,
    entityType,
    response: { ...(response as Record<string, unknown>), read_back: readBack },
    ...(verifiedMismatch
      ? {
          error: `Meta menerima permintaan ${operation} (API ack success), tetapi read-back menunjukkan ${entityType} ${id} masih berstatus ${readBack.status ?? 'tidak diketahui'}, bukan ${requested}. Tidak ada yang berubah — cek permission, batasan billing/review, atau ulangi.`,
        }
      : {}),
  };
}
