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
    {
      name: 'Profile',
      description:
        'View and edit profiles, manage followers/following, follow requests, ' +
        'blocking, pinned posts, suggestions, and user search',
    },
    {
      name: 'Search',
      description:
        'Unified and scoped search (posts, videos, hashtags, users), the explore ' +
        'feed, hashtag feeds, and per-user search history',
    },
    {
      name: 'Settings',
      description:
        'Account credentials (password, email, phone), privacy defaults, security ' +
        'overview, and active session management',
    },
    {
      name: 'Post',
      description: 'Create, edit, delete, and read posts, including multi-photo uploads',
    },
    {
      name: 'Admin · Auth',
      description:
        'Admin-panel authentication. Uses a dedicated AdminUser identity, fully ' +
        'separate from end-user Supabase auth and signed with the admin JWT secret. ' +
        'Powers the moderation console login, session check, and logout.',
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
      adminBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Admin-panel JWT returned from POST /admin/auth/login (signed with ' +
          'ADMIN_JWT_SECRET). Distinct from the user-facing Supabase token above.',
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

      // ── Shared ────────────────────────────────────────────────────────────
      PaginationMeta: {
        type: 'object',
        description: 'Present on list endpoints under the top-level `meta` key.',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 137 },
          totalPages: { type: 'integer', example: 7 },
          hasNextPage: { type: 'boolean', example: true },
          hasPreviousPage: { type: 'boolean', example: false },
        },
      },

      // ── Enums (mirror prisma/schema.prisma) ───────────────────────────────
      Gender: {
        type: 'string',
        enum: ['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER'],
      },
      RelationshipStatus: {
        type: 'string',
        enum: [
          'SINGLE',
          'IN_A_RELATIONSHIP',
          'ENGAGED',
          'MARRIED',
          'COMPLICATED',
          'NOT_SPECIFIED',
        ],
      },
      VisibilityLevel: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] },
      MessagePermission: { type: 'string', enum: ['EVERYONE', 'FOLLOWERS', 'NOBODY'] },
      FollowStatus: { type: 'string', enum: ['ACCEPTED', 'PENDING'] },
      PostType: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'COVER_PHOTO'] },
      PostPrivacy: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] },
      SearchType: {
        type: 'string',
        enum: ['ALL', 'USERS', 'POSTS', 'VIDEOS', 'SHORTS', 'HASHTAGS'],
      },
      ExploreCategory: {
        type: 'string',
        enum: [
          'MUSIC',
          'SPORTS',
          'GAMING',
          'EDUCATION',
          'COMEDY',
          'NEWS',
          'TRAVEL',
          'FOOD',
          'TECH',
        ],
      },
      AdminRole: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
      AdminStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },

      // ── Profile models ────────────────────────────────────────────────────
      BasicUserInfo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', nullable: true, example: 'jane_doe' },
          fullName: { type: 'string', nullable: true, example: 'Jane Doe' },
          avatarUrl: { type: 'string', nullable: true },
          isFollowing: { type: 'boolean' },
          isFollowingBack: { type: 'boolean' },
        },
      },
      NotificationActor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', nullable: true, example: 'jane_doe' },
          fullName: { type: 'string', nullable: true, example: 'Jane Doe' },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
      NotificationView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: {
            type: 'string',
            enum: ['FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED'],
          },
          actor: { $ref: '#/components/schemas/NotificationActor' },
          entityId: { type: 'string', format: 'uuid', nullable: true },
          message: { type: 'string', nullable: true, example: 'started following you' },
          isRead: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ProfileView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', nullable: true },
          fullName: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          coverUrl: { type: 'string', nullable: true },
          website: { type: 'string', nullable: true },
          dateOfBirth: { type: 'string', format: 'date', nullable: true },
          gender: { allOf: [{ $ref: '#/components/schemas/Gender' }], nullable: true },
          relationshipStatus: {
            allOf: [{ $ref: '#/components/schemas/RelationshipStatus' }],
            nullable: true,
          },
          location: { type: 'string', nullable: true },
          followerCount: { type: 'integer', example: 1280 },
          followingCount: { type: 'integer', example: 312 },
          postCount: { type: 'integer', example: 48 },
          isFollowing: { type: 'boolean' },
          isOwnProfile: { type: 'boolean' },
          isPrivate: { type: 'boolean' },
          followStatus: {
            allOf: [{ $ref: '#/components/schemas/FollowStatus' }],
            nullable: true,
          },
        },
      },
      ProfileIntro: {
        type: 'object',
        properties: {
          work: { type: 'string', nullable: true },
          education: { type: 'string', nullable: true },
          currentCity: { type: 'string', nullable: true },
          hometown: { type: 'string', nullable: true },
          relationshipStatus: {
            allOf: [{ $ref: '#/components/schemas/RelationshipStatus' }],
            nullable: true,
          },
          joinedDate: { type: 'string', format: 'date-time' },
        },
      },
      PostMediaView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          position: { type: 'integer', example: 0 },
        },
      },
      PostView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          content: { type: 'string', nullable: true },
          postType: { $ref: '#/components/schemas/PostType' },
          privacy: { $ref: '#/components/schemas/PostPrivacy' },
          category: {
            allOf: [{ $ref: '#/components/schemas/ExploreCategory' }],
            nullable: true,
          },
          mediaUrl: { type: 'string', nullable: true },
          thumbnailUrl: { type: 'string', nullable: true },
          media: { type: 'array', items: { $ref: '#/components/schemas/PostMediaView' } },
          viewCount: { type: 'integer', example: 0 },
          isLongFormVideo: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PrivacySettingsView: {
        type: 'object',
        properties: {
          isPrivate: { type: 'boolean' },
          postsVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
          messagesFrom: { $ref: '#/components/schemas/MessagePermission' },
          followersListVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
          followingListVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
        },
      },
      FriendCardUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', nullable: true, example: 'jane_doe' },
          fullName: { type: 'string', nullable: true, example: 'Jane Doe' },
          avatarUrl: { type: 'string', nullable: true },
          isFollowing: { type: 'boolean' },
          isOnline: { type: 'boolean' },
          lastSeen: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      FollowRequestView: {
        type: 'object',
        properties: {
          requester: { $ref: '#/components/schemas/FriendCardUser' },
          mutualFriends: { type: 'integer', example: 3 },
          requestedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserSuggestion: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/FriendCardUser' },
          mutualCount: { type: 'integer', example: 4 },
          reason: {
            type: 'string',
            enum: ['mutual_followers', 'contacts', 'location'],
          },
        },
      },

      // ── Search models ─────────────────────────────────────────────────────
      SearchPostView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          author: { $ref: '#/components/schemas/BasicUserInfo' },
          content: { type: 'string', nullable: true },
          title: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          postType: { $ref: '#/components/schemas/PostType' },
          privacy: { $ref: '#/components/schemas/PostPrivacy' },
          mediaUrl: { type: 'string', nullable: true },
          thumbnailUrl: { type: 'string', nullable: true },
          isLongFormVideo: { type: 'boolean' },
          viewCount: { type: 'integer', example: 5230 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      HashtagView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'travel' },
          postCount: { type: 'integer', example: 842 },
        },
      },
      SearchHistoryView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          query: { type: 'string', example: 'sunset photography' },
          searchType: { $ref: '#/components/schemas/SearchType' },
          searchedAt: { type: 'string', format: 'date-time' },
        },
      },
      UnifiedSearchResult: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: { $ref: '#/components/schemas/SearchType' },
          users: { type: 'array', items: { $ref: '#/components/schemas/BasicUserInfo' } },
          posts: { type: 'array', items: { $ref: '#/components/schemas/SearchPostView' } },
          videos: { type: 'array', items: { $ref: '#/components/schemas/SearchPostView' } },
          shorts: { type: 'array', items: { $ref: '#/components/schemas/SearchPostView' } },
          hashtags: { type: 'array', items: { $ref: '#/components/schemas/HashtagView' } },
        },
      },
      ExploreItemView: {
        allOf: [
          { $ref: '#/components/schemas/SearchPostView' },
          {
            type: 'object',
            properties: {
              category: {
                allOf: [{ $ref: '#/components/schemas/ExploreCategory' }],
                nullable: true,
              },
              trendingScore: { type: 'number', example: 97.4 },
            },
          },
        ],
      },

      // ── Settings models ───────────────────────────────────────────────────
      AccountInfoView: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          accountCreatedAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      SecurityOverviewView: {
        type: 'object',
        properties: {
          twoFactorEnabled: { type: 'boolean' },
          activeSessionCount: { type: 'integer', example: 3 },
          lastPasswordChangeAt: { type: 'string', format: 'date-time', nullable: true },
          lastLogin: {
            type: 'object',
            properties: {
              at: { type: 'string', format: 'date-time', nullable: true },
              location: { type: 'string', nullable: true },
              device: { type: 'string', nullable: true },
            },
          },
        },
      },
      SessionView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deviceName: { type: 'string', example: 'iPhone 15 — Safari' },
          location: { type: 'string', nullable: true, example: 'Dhaka, BD' },
          ipAddress: { type: 'string', nullable: true },
          isCurrent: { type: 'boolean' },
          lastActiveAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Request bodies — Profile ──────────────────────────────────────────
      UpdateProfileRequest: {
        type: 'object',
        description: 'All fields optional; only provided fields are updated.',
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 100, example: 'Jane Doe' },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            pattern: '^[a-zA-Z0-9_]+$',
            example: 'jane_doe',
          },
          bio: { type: 'string', maxLength: 500 },
          website: { type: 'string', format: 'uri', maxLength: 255 },
          dateOfBirth: { type: 'string', format: 'date', example: '1995-08-21' },
          gender: { $ref: '#/components/schemas/Gender' },
          relationshipStatus: { $ref: '#/components/schemas/RelationshipStatus' },
          location: { type: 'string', maxLength: 255 },
        },
      },
      UpdateIntroRequest: {
        type: 'object',
        description: 'All fields optional; only provided fields are updated.',
        properties: {
          work: { type: 'string', maxLength: 255 },
          education: { type: 'string', maxLength: 255 },
          currentCity: { type: 'string', maxLength: 255 },
          hometown: { type: 'string', maxLength: 255 },
          relationshipStatus: { $ref: '#/components/schemas/RelationshipStatus' },
        },
      },
      UpdatePrivacyRequest: {
        type: 'object',
        description: 'All fields optional; only provided fields are updated.',
        properties: {
          isPrivate: { type: 'boolean' },
          postsVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
          messagesFrom: { $ref: '#/components/schemas/MessagePermission' },
          followersListVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
          followingListVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
        },
      },
      UploadCoverRequest: {
        type: 'object',
        required: ['coverUrl'],
        properties: {
          coverUrl: {
            type: 'string',
            format: 'uri',
            maxLength: 2048,
            example: 'https://cdn.arsu.app/covers/abc.jpg',
          },
        },
      },

      // ── Request bodies — Search ───────────────────────────────────────────
      SaveSearchHistoryRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 2, example: 'sunset photography' },
          searchType: { $ref: '#/components/schemas/SearchType' },
        },
      },

      // ── Request bodies — Settings ─────────────────────────────────────────
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', format: 'password', minLength: 8 },
          newPassword: { type: 'string', format: 'password', minLength: 8 },
        },
      },
      ChangeEmailRequest: {
        type: 'object',
        required: ['newEmail'],
        properties: {
          newEmail: { type: 'string', format: 'email', example: 'new@example.com' },
        },
      },
      ChangePhoneRequest: {
        type: 'object',
        required: ['newPhone'],
        properties: {
          newPhone: { type: 'string', minLength: 7, example: '+1 555-123-4567' },
        },
      },
      VerifyOtpRequest: {
        type: 'object',
        required: ['otp'],
        properties: {
          otp: {
            type: 'string',
            minLength: 6,
            maxLength: 6,
            description: '6-digit verification code sent to the new email/phone.',
            example: '123456',
          },
        },
      },
      UpdatePostPrivacyRequest: {
        type: 'object',
        required: ['postsVisibility'],
        properties: {
          postsVisibility: { $ref: '#/components/schemas/VisibilityLevel' },
        },
      },
      UpdateMessagePrivacyRequest: {
        type: 'object',
        required: ['messagesFrom'],
        properties: {
          messagesFrom: { $ref: '#/components/schemas/MessagePermission' },
        },
      },

      // ── Request bodies — Post ─────────────────────────────────────────────
      CreatePostRequest: {
        type: 'object',
        properties: {
          content: { type: 'string', maxLength: 5000 },
          privacy: { $ref: '#/components/schemas/PostPrivacy' },
          category: { $ref: '#/components/schemas/ExploreCategory' },
          images: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'Up to 10 image files (JPEG, PNG, WebP, GIF; 5 MB each).',
          },
        },
      },
      UpdatePostRequest: {
        type: 'object',
        description:
          'All fields optional; only provided fields are updated. Photos cannot be changed.',
        properties: {
          content: { type: 'string', maxLength: 5000 },
          privacy: { $ref: '#/components/schemas/PostPrivacy' },
          category: { $ref: '#/components/schemas/ExploreCategory' },
        },
      },

      // ── Admin · Auth ──────────────────────────────────────────────────────
      AdminView: {
        type: 'object',
        description: 'API-facing admin identity; timestamps are ISO 8601 strings.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', example: 'admin@arsu.app' },
          fullName: { type: 'string', example: 'Super Admin' },
          role: { $ref: '#/components/schemas/AdminRole' },
          status: { $ref: '#/components/schemas/AdminStatus' },
          lastActiveAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminLoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@arsu.app' },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            maxLength: 200,
            example: 'ChangeMe123!',
          },
        },
      },
      AdminLoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged in' },
          data: {
            type: 'object',
            properties: {
              token: {
                type: 'string',
                description: 'Admin JWT — send as a `Bearer` token on subsequent admin requests.',
              },
              admin: { $ref: '#/components/schemas/AdminView' },
            },
          },
        },
      },
      AdminMeResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: '#/components/schemas/AdminView' },
        },
      },
      AdminLogoutResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged out' },
          data: {
            type: 'object',
            properties: { success: { type: 'boolean', example: true } },
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
