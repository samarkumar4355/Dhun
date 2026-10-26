import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { sendError } from '../utils/response.js';

interface RequestValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Express middleware to validate request body, query, and params using Zod.
 */
export function validate(schema: RequestValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        const parsedQuery = await schema.query.parseAsync(req.query);
        req.query = parsedQuery as any;
      }
      if (schema.params) {
        const parsedParams = await schema.params.parseAsync(req.params);
        req.params = parsedParams as any;
      }
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const details = (err.issues || []).map((e: any) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        const message = details[0]?.message || 'Validation error';
        return sendError(res, message, 400, 'VALIDATION_FAILED', details);
      }
      return sendError(res, 'Invalid request data', 400, 'BAD_REQUEST');
    }
  };
}
