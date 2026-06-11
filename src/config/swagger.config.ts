import path from 'path';
import { Application } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.config';
import { logger } from '../common/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Swagger / OpenAPI configuration
// ─────────────────────────────────────────────────────────────────────────────
// The spec is assembled from JSDoc @openapi blocks co-located on each module's
// route file. NOTE: tsconfig has `removeComments: true`, so JSDoc is stripped
// from the compiled `dist` output — the scanner therefore targets the `src`
// route files, which is correct for local/dev. For production docs, either ship
// `src`, set `removeComments: false`, or pre-generate a static spec.
// ─────────────────────────────────────────────────────────────────────────────

const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'ARSU Mobile App API',
    version: '1.0.0',
    description:
      'REST API for the ARSU mobile application. Authentication is delegated ' +
      'to Supabase Auth; protected endpoints expect a Supabase access token ' +
      'sent as a Bearer token in the `Authorization` header.',
    contact: { name: 'ARSU Team' },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}/${env.API_PREFIX}`,
      description: 'Local development',
    },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'User registration, login, logout, and password reset via Supabase Auth',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token returned from login/signup',
      },
    },
    schemas: {
      EmailSignupRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            maxLength: 72,
            example: 'S3curePassw0rd',
          },
        },
      },
      EmailLoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', format: 'password', example: 'S3curePassw0rd' },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
        },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['email', 'token', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          token: {
            type: 'string',
            description: 'The recovery code from the forgot-password email (6-digit OTP).',
            example: '123456',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            maxLength: 72,
            example: 'S3curePassw0rd',
          },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: {
            type: 'string',
            description: 'The refresh_token from the session returned by login/signup.',
            example: 'v1.MR2x9d...',
          },
        },
      },
      SupabaseUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', example: 'authenticated' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      SupabaseSession: {
        type: 'object',
        nullable: true,
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          token_type: { type: 'string', example: 'bearer' },
          expires_in: { type: 'integer', example: 3600 },
          expires_at: { type: 'integer', example: 1735689600 },
        },
      },
      AuthSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/SupabaseUser' },
              session: { $ref: '#/components/schemas/SupabaseSession' },
            },
          },
        },
      },
      MessageResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged out successfully' },
          data: { type: 'object', nullable: true, example: null },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Invalid email or password' },
          errors: {
            type: 'object',
            nullable: true,
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [path.resolve(process.cwd(), 'src/modules/**/*.routes.ts')],
});

/**
 * Mount Swagger UI and the raw OpenAPI JSON on the app.
 *   - UI:   /{API_PREFIX}/docs
 *   - JSON: /{API_PREFIX}/docs.json
 */
export function setupSwagger(app: Application): void {
  const base = `/${env.API_PREFIX}/docs`;

  app.get(`${base}.json`, (_req, res) => {
    res.json(swaggerSpec);
  });

  app.use(
    base,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'ARSU API Docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  logger.info(`📚 API docs available at ${base}`);
}
