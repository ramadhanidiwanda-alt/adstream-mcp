export type MetaLaunchWorkflow =
  | 'whatsapp_sales'
  | 'website_sales'
  | 'lead_generation'
  | 'cpas_catalog_sales'
  | 'creative_testing'
  | 'existing_post';

export interface LaunchReadinessOptions {
  workflow?: string;
  productOrOffer?: string;
  pageId?: string;
  pixelId?: string;
  destinationUrl?: string;
  dailyBudget?: number;
  countries?: string[];
  primaryText?: string;
  headline?: string;
  imageHash?: string;
  videoId?: string;
  imageFilePath?: string;
  videoFilePath?: string;
  creativeId?: string;
  existingPostId?: string;
  whatsappPhoneNumberId?: string;
  productSetId?: string;
  catalogId?: string;
  businessId?: string;
  specialAdCategories?: string[];
  writesEnabled?: boolean;
}

export interface LaunchReadinessCheck {
  key: string;
  label: string;
  status: 'ready' | 'missing' | 'warning';
  help: string;
}

export interface LaunchReadinessResult {
  ready: boolean;
  workflow: MetaLaunchWorkflow;
  recommendedWorkflow: MetaLaunchWorkflow;
  writesEnabled: boolean;
  missing: string[];
  nextQuestions: string[];
  checks: LaunchReadinessCheck[];
  warnings: string[];
  summary: string;
}

const WORKFLOWS = new Set<MetaLaunchWorkflow>([
  'whatsapp_sales',
  'website_sales',
  'lead_generation',
  'cpas_catalog_sales',
  'creative_testing',
  'existing_post',
]);

export function checkLaunchReadiness(options: LaunchReadinessOptions): LaunchReadinessResult {
  const workflow = normalizeWorkflow(options.workflow);
  const missing = new Set<string>();
  const warnings: string[] = [];
  const checks: LaunchReadinessCheck[] = [];

  if (options.writesEnabled !== true) {
    warnings.push('Write tools belum aktif. Set ADSTREAM_ENABLE_WRITES=true sebelum execute.');
  }

  requireField(
    checks,
    missing,
    'productOrOffer',
    'Produk/offer',
    options.productOrOffer,
    'Produk atau penawaran apa yang mau diiklankan?'
  );
  requireField(
    checks,
    missing,
    'pageId',
    'Facebook Page',
    options.pageId,
    'Page Facebook mana yang mau dipakai untuk iklan ini?'
  );
  requireField(
    checks,
    missing,
    'dailyBudget',
    'Budget harian',
    options.dailyBudget,
    'Budget harian berapa?'
  );
  requireField(
    checks,
    missing,
    'countries',
    'Negara target',
    options.countries?.length ? 'set' : undefined,
    'Target negara mana?'
  );

  if (workflow === 'existing_post') {
    requireField(
      checks,
      missing,
      'existingPostId',
      'Existing post',
      options.existingPostId ?? options.creativeId,
      'Postingan/creative existing mana yang mau dipakai?'
    );
  } else {
    requireField(
      checks,
      missing,
      'destinationUrl',
      'URL tujuan',
      options.destinationUrl,
      'Tujuan iklan mau ke URL mana?'
    );
    requireField(
      checks,
      missing,
      'primaryText',
      'Primary text',
      options.primaryText,
      'Teks utama iklannya apa?'
    );
    requireField(
      checks,
      missing,
      'headline',
      'Headline',
      options.headline,
      'Headline iklannya apa?'
    );
    requireCreativeAsset(checks, missing, options);
  }

  if (workflow === 'whatsapp_sales') {
    requireField(
      checks,
      missing,
      'whatsappPhoneNumberId',
      'Nomor WhatsApp',
      options.whatsappPhoneNumberId,
      'Nomor WhatsApp bisnis mana yang dipakai?'
    );
  }

  if (workflow === 'website_sales' || workflow === 'cpas_catalog_sales') {
    requireField(
      checks,
      missing,
      'pixelId',
      'Meta Pixel',
      options.pixelId,
      'Pixel Meta mana yang dipakai untuk optimasi purchase/lead?'
    );
  }

  if (workflow === 'cpas_catalog_sales') {
    requireField(
      checks,
      missing,
      'businessId',
      'Business ID',
      options.businessId,
      'Business Manager mana yang memiliki catalog CPAS?'
    );
    requireField(
      checks,
      missing,
      'catalogId',
      'Catalog',
      options.catalogId,
      'Catalog CPAS mana yang mau dipakai?'
    );
    requireField(
      checks,
      missing,
      'productSetId',
      'Product set',
      options.productSetId,
      'Product set CPAS mana yang mau diiklankan?'
    );
  }

  if (!options.specialAdCategories) {
    warnings.push(
      'Belum ada konfirmasi special ad category. Tanyakan apakah offer terkait kredit, pekerjaan, rumah, isu sosial, pemilu, atau politik.'
    );
  }

  const missingList = [...missing];
  const nextQuestions = missingList.map(questionForMissing);

  return {
    ready: missingList.length === 0 && options.writesEnabled === true,
    workflow,
    recommendedWorkflow: workflow,
    writesEnabled: options.writesEnabled === true,
    missing: missingList,
    nextQuestions,
    checks,
    warnings,
    summary:
      missingList.length === 0
        ? 'Siap dry-run. Semua informasi wajib sudah tersedia.'
        : `Belum siap dibuat. Ada ${missingList.length} informasi yang masih kurang.`,
  };
}

function normalizeWorkflow(value: string | undefined): MetaLaunchWorkflow {
  if (value && WORKFLOWS.has(value as MetaLaunchWorkflow)) return value as MetaLaunchWorkflow;
  return 'website_sales';
}

function requireField(
  checks: LaunchReadinessCheck[],
  missing: Set<string>,
  key: string,
  label: string,
  value: unknown,
  help: string
): void {
  const ready =
    typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  if (!ready) missing.add(key);
  checks.push({ key, label, status: ready ? 'ready' : 'missing', help });
}

function requireCreativeAsset(
  checks: LaunchReadinessCheck[],
  missing: Set<string>,
  options: LaunchReadinessOptions
): void {
  const hasAsset = Boolean(
    options.imageHash?.trim() ||
    options.videoId?.trim() ||
    options.imageFilePath?.trim() ||
    options.videoFilePath?.trim()
  );
  if (!hasAsset) missing.add('creativeAsset');
  checks.push({
    key: 'creativeAsset',
    label: 'Creative asset',
    status: hasAsset ? 'ready' : 'missing',
    help: 'Pakai gambar/video mana? Bisa file lokal, image hash, atau video ID.',
  });
}

function questionForMissing(key: string): string {
  const questions: Record<string, string> = {
    productOrOffer: 'Produk atau penawaran apa yang mau diiklankan?',
    pageId: 'Page Facebook mana yang mau dipakai untuk iklan ini?',
    dailyBudget: 'Budget harian berapa?',
    countries: 'Target negara mana?',
    destinationUrl: 'Tujuan iklan mau ke URL mana?',
    primaryText: 'Teks utama iklannya apa?',
    headline: 'Headline iklannya apa?',
    creativeAsset: 'Pakai gambar/video mana? Bisa kirim file lokal, image hash, atau video ID.',
    whatsappPhoneNumberId: 'Nomor WhatsApp bisnis mana yang dipakai?',
    pixelId: 'Pixel Meta mana yang dipakai untuk optimasi?',
    businessId: 'Business Manager mana yang memiliki catalog CPAS?',
    catalogId: 'Catalog CPAS mana yang mau dipakai?',
    productSetId: 'Product set CPAS mana yang mau diiklankan?',
    existingPostId: 'Postingan existing mana yang mau dipakai?',
  };
  return questions[key] ?? `Mohon isi ${key}.`;
}
