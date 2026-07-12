import type { MetaErrorResponse } from '../types.js';

export class MetaApiError extends Error {
  public code: number;
  public type: string;
  public subcode?: number;
  public userTitle?: string;
  public userMessage?: string;
  public fbtraceId?: string;

  constructor(errorResponse: MetaErrorResponse['error']) {
    super(errorResponse.message);
    this.name = 'MetaApiError';
    this.code = errorResponse.code;
    this.type = errorResponse.type;
    this.subcode = errorResponse.error_subcode;
    this.userTitle = errorResponse.error_user_title;
    this.userMessage = errorResponse.error_user_msg;
    this.fbtraceId = errorResponse.fbtrace_id;
  }
}

export function isMetaErrorResponse(data: any): data is MetaErrorResponse {
  return data && typeof data === 'object' && 'error' in data;
}
