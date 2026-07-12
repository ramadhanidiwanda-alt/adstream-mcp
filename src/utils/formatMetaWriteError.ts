import { MetaApiError } from './metaError.js';

/**
 * Build a descriptive error message from a Meta write failure.
 *
 * Meta often returns a generic "Invalid parameter" message while the actionable
 * detail lives in error_user_title / error_subcode. This helper surfaces that
 * detail without leaking tokens.
 */
export function formatMetaWriteError(error: unknown): string {
  if (error instanceof MetaApiError) {
    const parts: string[] = [error.message];
    if (error.userTitle) parts.push(`(${error.userTitle})`);
    if (error.userMessage && error.userMessage !== error.userTitle) parts.push(error.userMessage);
    if (error.subcode) parts.push(`[subcode ${error.subcode}]`);
    return parts.join(' ');
  }
  return error instanceof Error ? error.message : String(error);
}
