import type { MetaAdsMode, MetaCreativeFormat } from '../../types.js';

const COLLABORATIVE_FORMATS = new Set<MetaCreativeFormat>([
  'single_image',
  'video',
  'carousel',
  'catalog',
  'collection',
]);

const REQUIREMENTS: Record<MetaCreativeFormat, string[]> = {
  single_image: ['imageHash', 'primaryText', 'destinationUrl'],
  video: ['videoId', 'primaryText', 'destinationUrl'],
  carousel: ['cards'],
  catalog: ['productSetId', 'primaryText'],
  collection: ['instantExperienceId', 'coverImageHash or coverVideoId'],
  flexible: ['imageHashes or videoIds', 'primaryTexts', 'destinationUrl'],
  existing_post: ['objectStoryId'],
};

export function assertMetaCreativeCompatibility(input: {
  mode: MetaAdsMode;
  creativeFormat: MetaCreativeFormat;
}): void {
  if (input.mode === 'collaborative_ads' && !COLLABORATIVE_FORMATS.has(input.creativeFormat)) {
    throw new Error(
      `Format ${input.creativeFormat} belum didukung untuk Collaborative Ads. ` +
        'Pilih single_image, video, carousel, catalog, atau collection.'
    );
  }
}

export function getMetaCreativeRequirements(input: {
  mode: MetaAdsMode;
  creativeFormat: MetaCreativeFormat;
}): string[] {
  const required = [...REQUIREMENTS[input.creativeFormat]];
  if (input.mode === 'collaborative_ads' && !required.includes('productSetId')) {
    required.push('productSetId');
  }
  return required;
}
