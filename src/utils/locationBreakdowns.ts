import { LOCATION_BREAKDOWNS, type LocationBreakdown } from '../types.js';

export function normalizeLocationBreakdowns(value: unknown): LocationBreakdown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const rawBreakdowns = Array.isArray(value) ? value : [value];
  const breakdowns = rawBreakdowns.filter((item): item is LocationBreakdown => {
    return typeof item === 'string' && LOCATION_BREAKDOWNS.includes(item as LocationBreakdown);
  });

  return breakdowns.length ? [...new Set(breakdowns)] : undefined;
}

export function assertLocationBreakdowns(value: unknown): LocationBreakdown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const rawBreakdowns = Array.isArray(value) ? value : [value];
  const invalid = rawBreakdowns.filter((item) => {
    return typeof item !== 'string' || !LOCATION_BREAKDOWNS.includes(item as LocationBreakdown);
  });

  if (invalid.length) {
    throw new Error(`Invalid location breakdown: ${invalid.join(', ')}`);
  }

  return normalizeLocationBreakdowns(value);
}
