import type { MetaCreativeFormat } from '../types.js';
import {
  resolveMetaObjectiveLaunchSpec,
  type MetaConversionLocation,
  type MetaMessagingDestination,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';
import {
  getLaunchPreset,
  getWorkflowAliasWarning,
  getWorkflowDeprecationWarning,
} from './launchPresets.js';

export type MetaLaunchWorkflow =
  | 'awareness'
  | 'traffic_website'
  | 'engagement_post'
  | 'engagement_video'
  | 'engagement_messaging'
  | 'leads_website'
  | 'leads_instant_form'
  | 'app_installs'
  | 'sales_website'
  | 'sales_messaging'
  | 'sales_catalog';

export const META_LAUNCH_WORKFLOWS = [
  'awareness',
  'traffic_website',
  'engagement_post',
  'engagement_video',
  'engagement_messaging',
  'leads_website',
  'leads_instant_form',
  'app_installs',
  'sales_website',
  'sales_messaging',
  'sales_catalog',
] as const satisfies readonly MetaLaunchWorkflow[];

/**
 * Accepted MCP input values. Output and documentation use META_LAUNCH_WORKFLOWS;
 * the trailing aliases are normalized before readiness is evaluated.
 */
export const META_LAUNCH_WORKFLOW_INPUT_VALUES = [
  ...META_LAUNCH_WORKFLOWS,
  'website_sales',
  'lead_generation',
  'existing_post',
  'cpas_catalog_sales',
  'whatsapp_sales',
  'creative_testing',
] as const;

export interface LaunchReadinessOptions {
  workflow?: string;
  objective?: MetaOdaxObjective;
  conversionLocation?: MetaConversionLocation;
  optimizationGoal?: string;
  creativeFormat?: MetaCreativeFormat;
  apiVersion?: string;
  /** Which inbox a click-to-message launch opens. Required for the messaging workflow. */
  messagingDestination?: MetaMessagingDestination;
  productOrOffer?: string;
  pageId?: string;
  pixelId?: string;
  whatsappPhoneNumber?: string;
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
  /**
   * Partnership ad code dari kreator. Referensi konten alternatif untuk
   * creativeFormat existing_post: pada jalur ini tidak ada post ID sama sekali,
   * ad code itu sendiri yang menunjuk kontennya. Mengisi ini memenuhi kebutuhan
   * existingPostId.
   */
  partnershipAdCode?: string;
  sourceAdId?: string;
  whatsappPhoneNumberId?: string;
  productSetId?: string;
  catalogId?: string;
  businessId?: string;
  specialAdCategories?: string[];
  leadFormId?: string;
  applicationId?: string;
  objectStoreUrl?: string;
  appDeepLinkUrl?: string;
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
  recommendedTools: string[];
  creationOrder: [
    'ads_create_campaign',
    'ads_create_adset',
    'ads_create_adcreative',
    'ads_create_ad',
  ];
  verificationTools: ['ads_list_campaigns', 'ads_read_adset_full', 'ads_read_creative_full'];
  activationOrder: ['ads_resume_campaign', 'ads_resume_adset', 'ads_resume_ad'];
  requiresSecondActivationApproval: true;
  writesEnabled: boolean;
  missing: string[];
  nextQuestions: string[];
  checks: LaunchReadinessCheck[];
  warnings: string[];
  resolvedSpec?: {
    key: string;
    objective: MetaOdaxObjective;
    conversionLocation: MetaConversionLocation;
    optimizationGoal: string;
    billingEvent: string;
    destinationType?: string;
    defaultCallToAction?: string;
    supportedCreativeFormats: readonly MetaCreativeFormat[];
  };
  summary: string;
}

const CREATION_ORDER: LaunchReadinessResult['creationOrder'] = [
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
];

const VERIFICATION_TOOLS: LaunchReadinessResult['verificationTools'] = [
  'ads_list_campaigns',
  'ads_read_adset_full',
  'ads_read_creative_full',
];

const ACTIVATION_ORDER: LaunchReadinessResult['activationOrder'] = [
  'ads_resume_campaign',
  'ads_resume_adset',
  'ads_resume_ad',
];

/**
 * `existing_post` bukan nama workflow, melainkan nama creativeFormat yang diterima
 * sebagai alias historis dan menormalisasi ke engagement_post (ON_POST). Begitu
 * pemanggil ikut menyebut inbox tujuannya, maksudnya tidak ambigu lagi: itu launch
 * click-to-message, bukan boost engagement. Lihat getWorkflowAliasWarning().
 */
function resolveWorkflowInput(options: LaunchReadinessOptions): string | undefined {
  if (options.workflow === 'existing_post' && options.messagingDestination !== undefined) {
    return 'engagement_messaging';
  }
  return options.workflow;
}

export function checkLaunchReadiness(options: LaunchReadinessOptions): LaunchReadinessResult {
  const preset = getLaunchPreset(resolveWorkflowInput(options));
  const resolvedSpec = resolveMetaObjectiveLaunchSpec({
    objective: options.objective ?? preset.objective,
    conversionLocation: options.conversionLocation ?? preset.conversionLocation,
    optimizationGoal: options.optimizationGoal,
    creativeFormat: options.creativeFormat,
    apiVersion: options.apiVersion,
    messagingDestination: options.messagingDestination,
  });
  const workflow = resolvedSpec.key;
  const missing = new Set<string>();
  const warnings: string[] = [];
  const checks: LaunchReadinessCheck[] = [];

  if (options.writesEnabled !== true) {
    warnings.push('Write tools belum aktif. Set ADSTREAM_ENABLE_WRITES=true sebelum execute.');
  }
  const deprecationWarning = getWorkflowDeprecationWarning(options.workflow);
  if (deprecationWarning) warnings.push(deprecationWarning);
  const aliasWarning = getWorkflowAliasWarning(options.workflow, resolvedSpec.key);
  if (aliasWarning) warnings.push(aliasWarning);
  if (
    resolvedSpec.key === 'engagement_messaging' &&
    resolvedSpec.optimizationGoal === 'CONVERSATIONS'
  ) {
    warnings.push(
      'optimizationGoal CONVERSATIONS hanya menerima jendela atribusi 1 hari. Saat mengklon ad set, isi attributionSpec [{ event_type: "CLICK_THROUGH", window_days: 1 }] — attribution_spec sumber yang lebih panjang ditolak Meta dengan subcode 1885423.'
    );
  }
  if (resolvedSpec.key === 'app_installs') {
    warnings.push(
      'SDK/MMP dan setup app-event tidak dapat dibuktikan oleh connector; verifikasi keduanya di Meta Events Manager sebelum execute.'
    );
  }
  warnings.push(
    'Jika marketer memberi opsi headline/caption/copy/image/video, default-nya testing manual: buat beberapa creative/ad manual terpisah atau carousel jika memang formatnya carousel. Yang dinonaktifkan di MCP ini adalah asset_feed_spec TANPA asset_customization_rules (jalur Dynamic Creative, Meta yang memilih aset); assetFeedSpec dengan asset_customization_rules tetap boleh untuk asset customization per placement/language/segment.'
  );
  for (const requiredInput of resolvedSpec.requiredInputs) {
    requireInput(checks, missing, requiredInput, options);
  }

  const missingList = [...missing];
  return {
    ready: missingList.length === 0 && options.writesEnabled === true,
    workflow,
    recommendedWorkflow: workflow,
    recommendedTools: [...preset.recommendedTools],
    creationOrder: CREATION_ORDER,
    verificationTools: VERIFICATION_TOOLS,
    activationOrder: ACTIVATION_ORDER,
    requiresSecondActivationApproval: true,
    writesEnabled: options.writesEnabled === true,
    missing: missingList,
    nextQuestions: missingList.map(questionForMissing),
    checks,
    warnings,
    resolvedSpec: {
      key: resolvedSpec.key,
      objective: resolvedSpec.objective,
      conversionLocation: resolvedSpec.conversionLocation,
      optimizationGoal: resolvedSpec.optimizationGoal,
      billingEvent: resolvedSpec.billingEvent,
      destinationType: resolvedSpec.destinationType,
      defaultCallToAction: resolvedSpec.defaultCallToAction,
      supportedCreativeFormats: resolvedSpec.supportedCreativeFormats,
    },
    summary:
      missingList.length === 0
        ? 'Siap dry-run. Semua informasi wajib sudah tersedia.'
        : `Belum siap dibuat. Ada ${missingList.length} informasi yang masih kurang.`,
  };
}

function requireInput(
  checks: LaunchReadinessCheck[],
  missing: Set<string>,
  key: string,
  options: LaunchReadinessOptions
): void {
  const value = inputValue(key, options);
  const ready =
    typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  if (!ready) missing.add(key);
  checks.push({
    key,
    label: labelForMissing(key),
    status: ready ? 'ready' : 'missing',
    help: questionForMissing(key),
  });
}

function inputValue(key: string, options: LaunchReadinessOptions): unknown {
  if (key === 'creativeAsset') {
    return (
      options.imageHash?.trim() ||
      options.videoId?.trim() ||
      options.imageFilePath?.trim() ||
      options.videoFilePath?.trim()
    );
  }
  if (key === 'countries') return options.countries?.length ? 'set' : undefined;
  // Jalur partnership ad code tidak punya post ID: ad code-lah referensi kontennya,
  // dan ads_create_adcreative menerimanya. Tanpa cabang ini readiness check menuntut
  // existingPostId yang memang tidak akan pernah ada, sehingga dua tool saling
  // bertentangan untuk launch yang sama.
  if (key === 'existingPostId') {
    return options.existingPostId?.trim() || options.partnershipAdCode?.trim();
  }
  return options[key as keyof LaunchReadinessOptions];
}

function labelForMissing(key: string): string {
  const labels: Record<string, string> = {
    pageId: 'Facebook Page',
    pixelId: 'Meta Pixel',
    whatsappPhoneNumber: 'Nomor WhatsApp',
    destinationUrl: 'URL tujuan',
    dailyBudget: 'Budget harian',
    countries: 'Negara target',
    primaryText: 'Primary text',
    headline: 'Headline',
    creativeAsset: 'Creative asset',
    existingPostId: 'Existing post',
    sourceAdId: 'Source UI ad',
    videoId: 'Video',
    leadFormId: 'Instant Form',
    messagingDestination: 'Tujuan pesan',
    applicationId: 'Application ID',
    objectStoreUrl: 'Store URL',
    businessId: 'Business ID',
    catalogId: 'Catalog',
    productSetId: 'Product set',
    specialAdCategories: 'Special ad categories',
  };
  return labels[key] ?? key;
}

function questionForMissing(key: string): string {
  const questions: Record<string, string> = {
    pageId: 'Page Facebook mana yang mau dipakai untuk iklan ini?',
    pixelId: 'Pixel Meta mana yang dipakai untuk optimasi?',
    whatsappPhoneNumber:
      'Nomor WhatsApp display mana yang dipakai di ad set? Pakai format digit internasional, misalnya 6285156583372.',
    destinationUrl: 'Tujuan iklan mau ke URL mana?',
    dailyBudget: 'Budget harian berapa?',
    countries: 'Target negara mana?',
    primaryText: 'Teks utama iklannya apa?',
    headline: 'Headline iklannya apa?',
    creativeAsset: 'Pakai gambar/video mana? Bisa kirim file lokal, image hash, atau video ID.',
    existingPostId:
      'Postingan existing mana yang mau dipakai? Untuk partnership ads tanpa post ID, isi partnershipAdCode (ad code dari kreator) sebagai gantinya.',
    sourceAdId:
      'Source UI ad mana yang dibuat di Ads Manager untuk konten ini? Pakai ad ID sumber agar ads_clone_ui_ad bisa preserve state CTWA.',
    videoId: 'Video Meta mana yang mau dipakai?',
    leadFormId: 'Instant Form mana yang mau dipakai?',
    messagingDestination:
      'Pesan masuk ke mana: INSTAGRAM_DIRECT, MESSENGER, WHATSAPP, atau kombinasi MESSAGING_* (mis. MESSAGING_INSTAGRAM_DIRECT_WHATSAPP)?',
    applicationId: 'Application ID mana yang mau dipromosikan?',
    objectStoreUrl: 'Store URL aplikasi mana yang mau dipakai?',
    businessId: 'Business Manager mana yang memiliki catalog?',
    catalogId: 'Catalog mana yang mau dipakai?',
    productSetId: 'Product set mana yang mau diiklankan?',
    specialAdCategories:
      'Apakah offer terkait kredit, pekerjaan, rumah, isu sosial, pemilu, atau politik? Isi [] bila tidak ada.',
  };
  return questions[key] ?? `Mohon isi ${key}.`;
}
