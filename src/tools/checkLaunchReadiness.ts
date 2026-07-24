import type { MetaCreativeFormat } from '../types.js';
import {
  resolveMetaObjectiveLaunchSpec,
  type MetaConversionLocation,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { getLaunchPreset, getWorkflowDeprecationWarning } from './launchPresets.js';

export type MetaLaunchWorkflow =
  | 'awareness'
  | 'traffic_website'
  | 'engagement_post'
  | 'engagement_video'
  | 'leads_website'
  | 'leads_instant_form'
  | 'app_installs'
  | 'sales_website'
  | 'sales_catalog';

export const META_LAUNCH_WORKFLOWS = [
  'awareness',
  'traffic_website',
  'engagement_post',
  'engagement_video',
  'leads_website',
  'leads_instant_form',
  'app_installs',
  'sales_website',
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

export function checkLaunchReadiness(options: LaunchReadinessOptions): LaunchReadinessResult {
  const preset = getLaunchPreset(options.workflow);
  const resolvedSpec = resolveMetaObjectiveLaunchSpec({
    objective: options.objective ?? preset.objective,
    conversionLocation: options.conversionLocation ?? preset.conversionLocation,
    optimizationGoal: options.optimizationGoal,
    creativeFormat: options.creativeFormat,
    apiVersion: options.apiVersion,
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

  for (const requiredInput of resolvedSpec.requiredInputs) {
    requireInput(checks, missing, requiredInput, options);
  }

  const missingList = [...missing];
  return {
    ready: missingList.length === 0 && options.writesEnabled === true,
    workflow,
    recommendedWorkflow: workflow,
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
  return options[key as keyof LaunchReadinessOptions];
}

function labelForMissing(key: string): string {
  const labels: Record<string, string> = {
    pageId: 'Facebook Page',
    pixelId: 'Meta Pixel',
    destinationUrl: 'URL tujuan',
    dailyBudget: 'Budget harian',
    countries: 'Negara target',
    primaryText: 'Primary text',
    headline: 'Headline',
    creativeAsset: 'Creative asset',
    existingPostId: 'Existing post',
    videoId: 'Video',
    leadFormId: 'Instant Form',
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
    destinationUrl: 'Tujuan iklan mau ke URL mana?',
    dailyBudget: 'Budget harian berapa?',
    countries: 'Target negara mana?',
    primaryText: 'Teks utama iklannya apa?',
    headline: 'Headline iklannya apa?',
    creativeAsset: 'Pakai gambar/video mana? Bisa kirim file lokal, image hash, atau video ID.',
    existingPostId: 'Postingan existing mana yang mau dipakai?',
    videoId: 'Video Meta mana yang mau dipakai?',
    leadFormId: 'Instant Form mana yang mau dipakai?',
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
