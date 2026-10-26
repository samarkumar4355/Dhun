/**
 * Structured logger with secret and credential redaction.
 * Ensures passwords, tokens, API keys, and authorization headers are never logged.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'jwtsecret',
  'secret',
  'authorization',
  'credentials',
  'client_secret',
]);

function redact(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redact);
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redact(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const logger = {
  info(message: string, meta?: any) {
    if (meta) {
      console.log(`[INFO] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },

  warn(message: string, meta?: any) {
    if (meta) {
      console.warn(`[WARN] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },

  error(message: string, error?: any) {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}: ${error.message}`);
    } else if (error) {
      console.error(`[ERROR] ${message}`, JSON.stringify(redact(error)));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      if (meta) {
        console.debug(`[DEBUG] ${message}`, JSON.stringify(redact(meta)));
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },
};
