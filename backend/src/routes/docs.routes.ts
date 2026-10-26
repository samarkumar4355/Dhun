import { Router, type Request, type Response } from 'express';

const router = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Dhun Music Platform API',
    version: '1.0.0',
    description:
      'High-fidelity lossless music streaming, catalog management, and offline synchronization platform backend.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Root',
    },
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'displayName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  displayName: { type: 'string', minLength: 2 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User successfully registered' },
          400: { description: 'Validation failed or email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User authenticated, returns access and refresh tokens' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/tracks': {
      get: {
        summary: 'List tracks',
        tags: ['Tracks'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'lossless', in: 'query', schema: { type: 'boolean' } },
          { name: 'genre', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated list of tracks with metadata and lyrics status' },
        },
      },
    },
    '/tracks/{id}': {
      get: {
        summary: 'Get track details by ID',
        tags: ['Tracks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Track details including preserved lyrics or null if unavailable' },
          404: { description: 'Track not found' },
        },
      },
    },
    '/tracks/{id}/playback': {
      get: {
        summary: 'Get track playback authorization and stream URL',
        tags: ['Playback'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Authorized playback stream information' },
        },
      },
    },
    '/tracks/{id}/stream': {
      get: {
        summary: 'Stream track audio with HTTP Range support',
        tags: ['Playback'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'Range', in: 'header', schema: { type: 'string' }, description: 'bytes=start-end' },
        ],
        responses: {
          200: { description: 'Full audio stream' },
          206: { description: 'Partial content stream for seeking' },
        },
      },
    },
    '/tracks/{id}/lyrics': {
      get: {
        summary: 'Get track lyrics',
        tags: ['Tracks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Preserved plain-text lyrics or null' },
        },
      },
    },
    '/search': {
      get: {
        summary: 'Unified search across tracks, artists, albums, genres, and playlists',
        tags: ['Search'],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', default: 'all' } },
          { name: 'lossless', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'Search results grouped by entity' },
        },
      },
    },
    '/sync/download-manifest': {
      post: {
        summary: 'Generate offline download manifest for tracks',
        tags: ['Sync'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['trackIds'],
                properties: {
                  trackIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Verified download manifest with checksums and stream URLs' },
        },
      },
    },
  },
};

/**
 * GET /api/v1/openapi.json
 */
router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

/**
 * GET /api/v1/docs
 * Interactive OpenAPI UI via Swagger / Redoc CDN.
 */
router.get('/docs', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Dhun API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background-color: #0f1015; color: #fff; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
  </script>
</body>
</html>
  `);
});

export default router;
