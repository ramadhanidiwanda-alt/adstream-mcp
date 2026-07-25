import {
  resolveTikTokObjectiveLaunchSpec,
  type TikTokObjective,
  type TikTokObjectiveLaunchSpec,
} from '../providers/tiktok/objectiveLaunchMatrix.js';

export interface TikTokLaunchReadinessOptions {
  objectiveType: TikTokObjective;
  optimizationGoal?: string;
  advertiserId?: string;
  campaignName?: string;
  dailyBudget?: number;
  adgroupName?: string;
  identityId?: string;
  identityType?: string;
  videoId?: string;
  imageId?: string;
  imageFilePath?: string;
  videoFilePath?: string;
  landingPageUrl?: string;
  callToAction?: string;
  appId?: string;
  promotionType?: string;
  pixelId?: string;
  optimizationEvent?: string;
  instantFormPageId?: string;
  catalogId?: string;
  storeId?: string;
  productSource?: string;
  itemGroupIds?: string[];
  writesEnabled?: boolean;
}

export interface TikTokLaunchReadinessCheck {
  key: string;
  label: string;
  status: 'ready' | 'missing';
  help: string;
}

export interface TikTokLaunchReadinessResult {
  ready: boolean;
  objectiveKey: TikTokObjectiveLaunchSpec['key'];
  objectiveType: TikTokObjective;
  creationOrder: ['ads_create_campaign', 'ads_create_adset', 'ads_create_ad'];
  writesEnabled: boolean;
  missing: string[];
  nextQuestions: string[];
  checks: TikTokLaunchReadinessCheck[];
  warnings: string[];
  summary: string;
}

const CREATION_ORDER: TikTokLaunchReadinessResult['creationOrder'] = [
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_ad',
];

const FIELD_MAP: Record<string, keyof TikTokLaunchReadinessOptions> = {
  advertiserId: 'advertiserId',
  campaignName: 'campaignName',
  dailyBudget: 'dailyBudget',
  adgroupName: 'adgroupName',
  identityId: 'identityId',
  identityType: 'identityType',
  landingPageUrl: 'landingPageUrl',
  callToAction: 'callToAction',
  appId: 'appId',
  promotionType: 'promotionType',
  pixelId: 'pixelId',
  optimizationEvent: 'optimizationEvent',
  instantFormPageId: 'instantFormPageId',
  catalogId: 'catalogId',
  itemGroupIds: 'itemGroupIds',
};

export function checkTikTokLaunchReadiness(
  options: TikTokLaunchReadinessOptions
): TikTokLaunchReadinessResult {
  const spec = resolveTikTokObjectiveLaunchSpec({
    objectiveType: options.objectiveType,
    optimizationGoal: options.optimizationGoal,
  });

  const missing = new Set<string>();
  const warnings: string[] = [];
  const checks: TikTokLaunchReadinessCheck[] = [];

  if (options.writesEnabled !== true) {
    warnings.push('Write tools belum aktif. Set ADSTREAM_ENABLE_WRITES=true sebelum execute.');
  }

  for (const requiredInput of spec.requiredInputs) {
    requireInput(checks, missing, requiredInput, options);
  }

  const missingList = [...missing];

  return {
    ready: missingList.length === 0 && options.writesEnabled === true,
    objectiveKey: spec.key,
    objectiveType: spec.objectiveType,
    creationOrder: CREATION_ORDER,
    writesEnabled: options.writesEnabled === true,
    missing: missingList,
    nextQuestions: missingList.map(questionForMissing),
    checks,
    warnings,
    summary:
      missingList.length === 0
        ? 'Siap dry-run. Semua informasi wajib untuk objective ini sudah tersedia.'
        : `Belum siap dibuat. Ada ${missingList.length} informasi yang masih kurang.`,
  };
}

function requireInput(
  checks: TikTokLaunchReadinessCheck[],
  missing: Set<string>,
  key: string,
  options: TikTokLaunchReadinessOptions
): void {
  const value = inputValue(key, options);
  const ready = Array.isArray(value)
    ? value.length > 0
    : typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  if (!ready) missing.add(key);
  checks.push({ key, label: labelForMissing(key), status: ready ? 'ready' : 'missing', help: questionForMissing(key) });
}

function inputValue(key: string, options: TikTokLaunchReadinessOptions): unknown {
  if (key === 'creativeAsset') {
    return (
      options.imageId?.trim() ||
      options.videoId?.trim() ||
      options.imageFilePath?.trim() ||
      options.videoFilePath?.trim()
    );
  }
  const mapped = FIELD_MAP[key];
  return mapped ? options[mapped] : undefined;
}

function labelForMissing(key: string): string {
  const labels: Record<string, string> = {
    advertiserId: 'TikTok Advertiser ID',
    campaignName: 'Nama campaign',
    dailyBudget: 'Budget harian',
    adgroupName: 'Nama ad group',
    identityId: 'TikTok Identity',
    identityType: 'Tipe Identity',
    creativeAsset: 'Creative asset',
    landingPageUrl: 'URL tujuan',
    callToAction: 'Call to action',
    appId: 'App ID',
    promotionType: 'Tipe promosi app (APP_INSTALL/APP_RETARGETING)',
    pixelId: 'TikTok Pixel',
    optimizationEvent: 'Event optimasi',
    instantFormPageId: 'Instant Form (page_id)',
    catalogId: 'Catalog',
    itemGroupIds: 'Produk (item_group_ids)',
  };
  return labels[key] ?? key;
}

function questionForMissing(key: string): string {
  const questions: Record<string, string> = {
    advertiserId: 'TikTok Advertiser ID mana yang mau dipakai?',
    campaignName: 'Nama campaign-nya apa?',
    dailyBudget: 'Budget harian berapa?',
    adgroupName: 'Nama ad group-nya apa?',
    identityId: 'TikTok Identity (akun yang tampil sebagai pengiklan) mana yang dipakai?',
    identityType: 'Tipe Identity-nya apa (mis. CUSTOMIZED_USER)?',
    creativeAsset: 'Pakai video/gambar mana? Bisa kirim file lokal, video ID, atau image ID.',
    landingPageUrl: 'Iklan mau mengarah ke URL mana?',
    callToAction: 'Call to action-nya apa (mis. SHOP_NOW, LEARN_MORE, SIGN_UP)?',
    appId: 'App ID TikTok mana yang mau dipromosikan?',
    promotionType: 'Ini APP_INSTALL (install baru) atau APP_RETARGETING?',
    pixelId: 'TikTok Pixel mana yang dipakai untuk optimasi konversi?',
    optimizationEvent: 'Event konversi mana yang mau dioptimasi (mis. COMPLETE_PAYMENT)?',
    instantFormPageId: 'Instant Form (page_id) mana yang mau dipakai untuk lead generation?',
    catalogId: 'Catalog TikTok Shop mana yang mau dipakai?',
    itemGroupIds: 'Produk mana (item_group_ids) yang mau diiklankan dari catalog?',
  };
  return questions[key] ?? `Mohon isi ${key}.`;
}
