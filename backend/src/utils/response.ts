import type { Response } from 'express';

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  [key: string]: any;
}

export function sendSuccess<T>(res: Response, data: T, meta?: ApiResponseMeta, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code?: string,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: code || 'ERROR',
      details,
    },
  });
}

/**
 * Safely extracts a single string parameter from Express req.params.
 */
export function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
}
