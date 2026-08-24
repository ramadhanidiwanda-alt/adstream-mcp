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
 *
 * Saat `effective_status` berbeda dari `status`, penyebabnya DIBACA, bukan ditebak:
 * status parent diambil dari Graph API sebelum disebut sebagai penyebab, dan
 * `issues_info` ikut dibawa supaya penolakan asinkron Meta terlihat di sini.
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
  /**
   * `issues_info` milik Meta, terbawa apa adanya bila ada. Di sinilah penolakan
   * asinkron muncul (mis. HARD_ERROR 1487891 "Materi Iklan Tidak Valid untuk
   * Tujuan") — sebuah objek bisa berstatus ACTIVE dan tetap tidak akan tayang.
   */
  issues?: Array<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readIssues(raw: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const issues = raw.filter(isRecord);
  return issues.length > 0 ? issues : undefined;
}

/** Ringkas issues_info jadi satu kalimat yang menyebut kode dan ringkasan Meta. */
function summarizeIssues(issues: Array<Record<string, unknown>> | undefined): string | undefined {
  if (!issues) return undefined;

  const parts = issues.map((issue) => {
    const code = issue.error_code === undefined ? undefined : String(issue.error_code);
    const type = typeof issue.error_type === 'string' ? issue.error_type : undefined;
    const summary =
      typeof issue.error_summary === 'string'
        ? issue.error_summary
        : typeof issue.error_message === 'string'
          ? issue.error_message
          : undefined;
    return [code ? `error_code ${code}` : undefined, type, summary]
      .filter((part): part is string => Boolean(part))
      .join(' — ');
  });

  return `Meta melaporkan issues_info: ${parts.join('; ')}.`;
}

/** Parent yang bisa menahan tayangnya sebuah objek. */
interface ParentStatus {
  level: 'campaign' | 'adset';
  id?: string;
  name?: string;
  status?: string;
}

const PARENT_LABEL: Readonly<Record<ParentStatus['level'], string>> = {
  campaign: 'campaign',
  adset: 'ad set',
};

/**
 * Field expansion untuk membaca parent dalam satu panggilan. Campaign tidak punya
 * parent yang bisa menahannya, jadi tidak ada read sama sekali untuk tipe itu.
 */
const PARENT_FIELDS: Readonly<Record<MutateEntityType, string | undefined>> = {
  campaign: undefined,
  adset: 'campaign{id,name,status}',
  ad: 'adset{id,name,status},campaign{id,name,status}',
};

function readParent(raw: unknown, level: ParentStatus['level']): ParentStatus | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    level,
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    ...(typeof raw.status === 'string' ? { status: raw.status } : {}),
  };
}

/**
 * Baca status parent SEBELUM menyalahkannya. Sebelum ini, note read-back menuduh
 * "parent-nya masih paused" untuk setiap effective_status yang berbeda dari status,
 * tanpa pernah membaca parent — dan pada insiden 2026-08-24 tuduhan itu salah:
 * ad set dan campaign dua-duanya ACTIVE, yang bermasalah materinya sendiri.
 *
 * `undefined` berarti TIDAK DIKETAHUI (read gagal), array kosong berarti memang
 * tidak ada parent. Keduanya menghasilkan kalimat yang berbeda.
 */
async function readParentStatuses(
  client: MetaClient,
  id: string,
  entityType: MutateEntityType,
  maxRetries: number
): Promise<ParentStatus[] | undefined> {
  const fields = PARENT_FIELDS[entityType];
  if (!fields) return [];

  try {
    const raw = await client.metaGetObject<Record<string, unknown>>(
      `/${id}`,
      { fields },
      maxRetries
    );
    return [readParent(raw.adset, 'adset'), readParent(raw.campaign, 'campaign')].filter(
      (parent): parent is ParentStatus => parent !== undefined
    );
  } catch {
    return undefined;
  }
}

function describeParent(parent: ParentStatus): string {
  const name = parent.name ? ` "${parent.name}"` : '';
  return `${PARENT_LABEL[parent.level]}${name} ${parent.status ?? 'status tidak diketahui'}`;
}

/**
 * Kalimat penyebab, dipilih dari apa yang benar-benar terbaca — bukan dugaan.
 */
function describeBlockingCause(parents: ParentStatus[] | undefined): string {
  if (parents === undefined) {
    return 'Status parent (campaign/ad set) tidak berhasil dibaca, jadi penyebabnya belum pasti: bisa parent yang belum jalan, bisa pembatas lain. Cek di Ads Manager.';
  }

  const blocking = parents.filter(
    (parent) => parent.status !== undefined && parent.status !== 'ACTIVE'
  );
  if (blocking.length > 0) {
    return `Parent-nya belum jalan: ${blocking.map(describeParent).join(', ')}. Resume parent itu juga bila memang mau tayang.`;
  }

  if (parents.length === 0) {
    return 'Objek ini tidak punya parent yang bisa menahannya, jadi penyebabnya ada pada objek ini sendiri (mis. review Meta, materi ditolak, atau jadwal).';
  }

  return `Parent-nya sudah ACTIVE (${parents.map(describeParent).join(', ')}), jadi penyebabnya ada pada objek ini sendiri (mis. masih diproses, review Meta, materi ditolak, atau jadwal) — bukan karena parent paused.`;
}

function describeEffectiveStatus(
  requested: RequestedStatus,
  status: string | undefined,
  effectiveStatus: string | undefined,
  issues: Array<Record<string, unknown>> | undefined,
  parents: ParentStatus[] | undefined
): string | undefined {
  if (!effectiveStatus || !status) return undefined;
  if (effectiveStatus === status) return undefined;

  const base =
    requested === 'ACTIVE'
      ? `status objek ACTIVE, tetapi effective_status ${effectiveStatus} — objek ini belum tayang. ${describeBlockingCause(parents)}`
      : `status objek ${status}, effective_status ${effectiveStatus}.`;

  const issueSummary = summarizeIssues(issues);
  return issueSummary ? `${base} ${issueSummary}` : base;
}

/**
 * Baca status plus `issues_info`. Meta menolak sebagian field per tipe objek dan
 * per versi API dengan `(#100) Tried accessing nonexisting field`; kalau itu terjadi,
 * ulangi tanpa `issues_info` supaya read-back tetap terverifikasi. Kehilangan konteks
 * issues jauh lebih ringan daripada melaporkan status sebagai tidak terverifikasi.
 */
async function readStatusFields(
  client: MetaClient,
  id: string,
  maxRetries: number
): Promise<Record<string, unknown>> {
  try {
    return await client.metaGetObject<Record<string, unknown>>(
      `/${id}`,
      { fields: 'status,effective_status,issues_info' },
      maxRetries
    );
  } catch {
    return client.metaGetObject<Record<string, unknown>>(
      `/${id}`,
      { fields: 'status,effective_status' },
      maxRetries
    );
  }
}

/**
 * POST status ke `/{id}`, lalu baca ulang `status,effective_status,issues_info`.
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
    const current = await readStatusFields(client, id, maxRetries);
    const currentStatus = typeof current.status === 'string' ? current.status : undefined;
    const effectiveStatus =
      typeof current.effective_status === 'string' ? current.effective_status : undefined;
    const issues = readIssues(current.issues_info);
    // Parent hanya dibaca saat memang akan dijelaskan; jalur normal tetap satu read.
    const diverged =
      currentStatus !== undefined &&
      effectiveStatus !== undefined &&
      effectiveStatus !== currentStatus;
    const parents =
      diverged && requested === 'ACTIVE'
        ? await readParentStatuses(client, id, entityType, maxRetries)
        : undefined;
    const note = describeEffectiveStatus(
      requested,
      currentStatus,
      effectiveStatus,
      issues,
      parents
    );
    readBack = {
      requested,
      status: currentStatus,
      effectiveStatus,
      applied: currentStatus === requested,
      ...(note ? { note } : {}),
      ...(issues ? { issues } : {}),
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
