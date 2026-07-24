import type { MetaCreativeFormat } from '../types.js';
import {
  resolveMetaObjectiveLaunchSpec,
  type MetaConversionLocation,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';
import type { MetaLaunchWorkflow } from './checkLaunchReadiness.js';

export interface LaunchPreset {
  workflow: MetaLaunchWorkflow;
  label: string;
  mode: 'standard' | 'collaborative_ads';
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  destinationType?: string;
  optimizationGoal: string;
  billingEvent: string;
  defaultCallToAction?: string;
  creativeFormats: readonly MetaCreativeFormat[];
  requiredInputs: readonly string[];
  recommendedTools: readonly string[];
  safetyNotes: readonly string[];
}

interface LaunchPresetDefinition {
  label: string;
  mode: 'standard' | 'collaborative_ads';
  objective: MetaOdaxObjective;
  conversionLocation: MetaConversionLocation;
  recommendedTools: readonly string[];
  safetyNotes: readonly string[];
}

const CREATE_TOOLS = [
  'ads_check_launch_readiness',
  'ads_create_campaign',
  'ads_create_adset',
  'ads_create_adcreative',
  'ads_create_ad',
] as const;

const PRESETS: Record<MetaLaunchWorkflow, LaunchPresetDefinition> = {
  awareness: {
    label: 'Bangun Awareness',
    mode: 'standard',
    objective: 'OUTCOME_AWARENESS',
    conversionLocation: 'AWARENESS',
    recommendedTools: CREATE_TOOLS,
    safetyNotes: ['Use dry-run preview before execute; created entities remain PAUSED.'],
  },
  traffic_website: {
    label: 'Traffic ke Website',
    mode: 'standard',
    objective: 'OUTCOME_TRAFFIC',
    conversionLocation: 'WEBSITE',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages'],
    safetyNotes: ['Verify the landing page URL before the dry-run.'],
  },
  engagement_post: {
    label: 'Engagement Existing Post',
    mode: 'standard',
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'POST',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages'],
    safetyNotes: ['Use an existing object_story_id; do not invent post IDs.'],
  },
  engagement_video: {
    label: 'Video Engagement',
    mode: 'standard',
    objective: 'OUTCOME_ENGAGEMENT',
    conversionLocation: 'VIDEO',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_advideos'],
    safetyNotes: ['Use a reviewed Meta video ID before creating the creative.'],
  },
  leads_website: {
    label: 'Leads ke Website',
    mode: 'standard',
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'WEBSITE',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages', 'ads_list_pixels'],
    safetyNotes: ['Confirm whether special ad categories apply before launching lead ads.'],
  },
  leads_instant_form: {
    label: 'Leads dengan Instant Form',
    mode: 'standard',
    objective: 'OUTCOME_LEADS',
    conversionLocation: 'INSTANT_FORM',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages'],
    safetyNotes: ['Use a published Meta lead form owned by the selected Page.'],
  },
  app_installs: {
    label: 'App Installs',
    mode: 'standard',
    objective: 'OUTCOME_APP_PROMOTION',
    conversionLocation: 'APP',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages'],
    safetyNotes: ['Verify the app ID and store URL before the dry-run.'],
  },
  sales_website: {
    label: 'Sales ke Website',
    mode: 'standard',
    objective: 'OUTCOME_SALES',
    conversionLocation: 'WEBSITE',
    recommendedTools: [...CREATE_TOOLS, 'ads_list_pages', 'ads_list_pixels'],
    safetyNotes: ['Use dry-run preview before execute; created entities remain PAUSED.'],
  },
  sales_catalog: {
    label: 'Sales dengan Catalog',
    mode: 'collaborative_ads',
    objective: 'OUTCOME_SALES',
    conversionLocation: 'CATALOG',
    recommendedTools: [
      ...CREATE_TOOLS,
      'ads_list_catalogs',
      'ads_list_product_sets',
      'ads_list_pages',
    ],
    safetyNotes: [
      'Catalog and product-set sharing must already be configured in Meta; this connector only uses accessible IDs.',
    ],
  },
};

export const LEGACY_WORKFLOW_ALIASES = {
  website_sales: 'sales_website',
  lead_generation: 'leads_website',
  existing_post: 'engagement_post',
  cpas_catalog_sales: 'sales_catalog',
} as const;

const DEPRECATED_WORKFLOW_ALIASES = {
  whatsapp_sales: 'sales_website',
  creative_testing: 'sales_website',
} as const;

export function getLaunchPreset(workflow: string | undefined): LaunchPreset {
  const normalized = normalizeWorkflow(workflow);
  const preset = PRESETS[normalized];
  const resolvedSpec = resolveMetaObjectiveLaunchSpec({
    objective: preset.objective,
    conversionLocation: preset.conversionLocation,
  });

  return {
    workflow: normalized,
    label: preset.label,
    mode: preset.mode,
    objective: resolvedSpec.objective,
    conversionLocation: resolvedSpec.conversionLocation,
    destinationType: resolvedSpec.destinationType,
    optimizationGoal: resolvedSpec.optimizationGoal,
    billingEvent: resolvedSpec.billingEvent,
    defaultCallToAction: resolvedSpec.defaultCallToAction,
    creativeFormats: resolvedSpec.supportedCreativeFormats,
    requiredInputs: resolvedSpec.requiredInputs,
    recommendedTools: preset.recommendedTools,
    safetyNotes: preset.safetyNotes,
  };
}

export function inferLaunchWorkflow(intent: string): MetaLaunchWorkflow {
  const text = intent.toLowerCase();
  if (/(awareness|brand baru|jangkauan|reach)/i.test(text)) return 'awareness';
  if (/(traffic|kunjungan|visit)/i.test(text)) return 'traffic_website';
  if (/(boost|postingan|existing post|post existing)/i.test(text)) return 'engagement_post';
  if (/(video|thruplay|tonton)/i.test(text)) return 'engagement_video';
  if (/(instant form|lead form|form leads)/i.test(text)) return 'leads_instant_form';
  if (/(lead|leads|daftar)/i.test(text)) return 'leads_website';
  if (/(app install|install aplikasi|instal aplikasi)/i.test(text)) return 'app_installs';
  if (/(cpas|catalog|katalog|product set|produk set)/i.test(text)) return 'sales_catalog';
  return 'sales_website';
}

export function normalizeWorkflow(workflow: string | undefined): MetaLaunchWorkflow {
  if (workflow && workflow in PRESETS) return workflow as MetaLaunchWorkflow;
  if (workflow && workflow in LEGACY_WORKFLOW_ALIASES) {
    return LEGACY_WORKFLOW_ALIASES[workflow as keyof typeof LEGACY_WORKFLOW_ALIASES];
  }
  if (workflow && workflow in DEPRECATED_WORKFLOW_ALIASES) {
    return DEPRECATED_WORKFLOW_ALIASES[workflow as keyof typeof DEPRECATED_WORKFLOW_ALIASES];
  }
  return 'sales_website';
}

export function getWorkflowDeprecationWarning(workflow: string | undefined): string | undefined {
  if (workflow && workflow in DEPRECATED_WORKFLOW_ALIASES) {
    return `${workflow} is deprecated and is not a canonical Meta v25 baseline workflow; use ${normalizeWorkflow(workflow)} instead.`;
  }
  return undefined;
}
