# Post Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal Facebook-style Post module — create (with multi-photo upload), edit, delete, get-one, and list-by-author — with viewer-aware privacy and auto-extracted hashtags, built TDD.

**Architecture:** New `src/modules/post/` following the repo's layered convention (routes → controller → service → repository → dto → types), plus a reusable Supabase Storage helper in `src/common/storage/` and a multer upload middleware in `src/common/middleware/`. A new `PostMedia` child table stores multiple photos; the existing `Post.mediaUrl` is mirrored to the first photo for backward compatibility with the profile/search modules. The backend receives image bytes (multipart), uploads them to a public `post-media` bucket via the service-role client, and stores the public URLs.

**Tech Stack:** Node 20+, Express 5, TypeScript, Prisma 6 (PostgreSQL), Supabase Storage, multer 2, Jest 30 + ts-jest + supertest, class-validator/class-transformer.

**Reference spec:** `docs/superpowers/specs/2026-06-14-post-endpoint-design.md`

---

## Conventions every task relies on (read once)

- **Run all tests:** `npm test`. Run one file: `npx jest <path> -v`.
- **Errors** (thrown in services, formatted by the global handler):
  `NotFoundError('Post')`→404, `UnauthorizedError(msg)`→401, `ForbiddenError(msg)`→403,
  `BadRequestError(msg)`→400, `UnprocessableEntityError`→422 (raised by `validateBody`/`validateQuery`).
- **Auth on `req`:** guards set `req.user.sub` (the user id). `supabaseAuthGuard` (required) throws 401; `optionalSupabaseAuthGuard` attaches user when a token is present, else continues.
- **Response envelope:** `sendSuccess(res, data, { statusCode?, message?, meta? })` → `{ success:true, data, message?, meta? }`.
- **Pagination:** `parsePaginationParams(req.query)` → `{ page, limit }`; `buildPaginationMeta(total, page, limit)` → meta object.
- **Prisma client:** `import { prisma } from '../../prisma';`
- **Repositories are NOT unit-tested** in this codebase (e.g. there is no `profile.repository.spec.ts`); they are mocked inside service specs. TDD here targets DTOs, the hashtag util, the storage helper, the service, and the routes. The repository, types, controller, and middleware are implementation files exercised through those tests.

---

## Task 1: Add the multer dependency

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install multer (Express-5 compatible) and its types**

Run:
```bash
npm install multer@^2.0.0
npm install -D @types/multer
```

- [ ] **Step 2: Verify the project still compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: exits 0 (no errors).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add multer for post image uploads"
```

---

## Task 2: Add the PostMedia table, migration, and storage bucket

**Files:**
- Modify: `prisma/schema.prisma` (Post model relations + new `PostMedia` model)

- [ ] **Step 1: Add the `media` relation to the `Post` model**

In `prisma/schema.prisma`, inside `model Post`, change the relations block from:

```prisma
  author    Profile       @relation("AuthorPosts", fields: [authorId], references: [id], onDelete: Cascade)
  pinnedBy  Profile?      @relation("PinnedPost")
  hashtags  PostHashtag[]
```

to:

```prisma
  author    Profile       @relation("AuthorPosts", fields: [authorId], references: [id], onDelete: Cascade)
  pinnedBy  Profile?      @relation("PinnedPost")
  hashtags  PostHashtag[]
  media     PostMedia[]
```

- [ ] **Step 2: Add the `PostMedia` model**

Immediately after the `model Post { ... }` block (before `/// Normalized hashtag registry...`), add:

```prisma
/// Ordered photos attached to a post (Facebook-album style).
model PostMedia {
  id        String   @id @default(uuid()) @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  url       String
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_media")
}
```

- [ ] **Step 3: Generate and apply the migration**

Run: `npm run migration:generate:local -- --name add_post_media`
Expected: a new folder under `prisma/migrations/<timestamp>_add_post_media/` is created, the `post_media` table is created in the database, and the Prisma client is regenerated.

(If it reports drift or asks to reset, STOP and surface the output — do not reset the database.)

- [ ] **Step 4: Confirm the Prisma client has the new model**

Run: `node -e "const{PrismaClient}=require('@prisma/client');console.log(typeof new PrismaClient().postMedia)"`
Expected: prints `object` (the `postMedia` delegate exists).

- [ ] **Step 5: Create the public `post-media` storage bucket**

Using the Supabase MCP `execute_sql` tool, run:

```sql
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;
```

This makes the bucket public (anyone with a stored URL can read) while the backend writes via the service-role client (which bypasses storage RLS, so no extra policies are needed).

(If running headless without MCP access, create the bucket in the Supabase dashboard: Storage → New bucket → name `post-media`, Public = on.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(post): add PostMedia table and migration"
```

---

## Task 3: Post DTOs (create / update / list)

**Files:**
- Create: `src/modules/post/dto/create-post.dto.ts`
- Create: `src/modules/post/dto/update-post.dto.ts`
- Create: `src/modules/post/dto/list-posts.dto.ts`
- Test: `src/modules/post/dto/create-post.dto.spec.ts`
- Test: `src/modules/post/dto/update-post.dto.spec.ts`
- Test: `src/modules/post/dto/list-posts.dto.spec.ts`

- [ ] **Step 1: Write the failing DTO specs**

`src/modules/post/dto/create-post.dto.spec.ts`:
```typescript
import { CreatePostDto } from './create-post.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('CreatePostDto', () => {
  it('accepts content only', async () => {
    const errors = await validateDto(CreatePostDto, { content: 'hello world' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload (photos may be the only content)', async () => {
    const errors = await validateDto(CreatePostDto, {});
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid privacy value', async () => {
    const errors = await validateDto(CreatePostDto, { privacy: 'SECRET' });
    expect(errors.some((e) => e.property === 'privacy')).toBe(true);
  });

  it('rejects content longer than 5000 chars', async () => {
    const errors = await validateDto(CreatePostDto, { content: 'a'.repeat(5001) });
    expect(errors.some((e) => e.property === 'content')).toBe(true);
  });
});
```

`src/modules/post/dto/update-post.dto.spec.ts`:
```typescript
import { UpdatePostDto } from './update-post.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('UpdatePostDto', () => {
  it('accepts a partial update', async () => {
    const errors = await validateDto(UpdatePostDto, { content: 'edited' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a privacy-only update', async () => {
    const errors = await validateDto(UpdatePostDto, { privacy: 'ONLY_ME' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid privacy value', async () => {
    const errors = await validateDto(UpdatePostDto, { privacy: 'NOPE' });
    expect(errors.some((e) => e.property === 'privacy')).toBe(true);
  });
});
```

`src/modules/post/dto/list-posts.dto.spec.ts`:
```typescript
import { ListPostsDto } from './list-posts.dto';
import { validateDto } from '../../../../test/helpers/validate-dto';

describe('ListPostsDto', () => {
  it('accepts a valid authorId', async () => {
    const errors = await validateDto(ListPostsDto, {
      authorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(errors).toHaveLength(0);
  });

  it('requires authorId', async () => {
    const errors = await validateDto(ListPostsDto, {});
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });

  it('rejects a non-uuid authorId', async () => {
    const errors = await validateDto(ListPostsDto, { authorId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'authorId')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the specs to verify they fail**

Run: `npx jest src/modules/post/dto -v`
Expected: FAIL — cannot find the DTO modules.

- [ ] **Step 3: Implement the DTOs**

`src/modules/post/dto/create-post.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExploreCategory, PostPrivacy } from '@prisma/client';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(PostPrivacy)
  privacy?: PostPrivacy;

  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;
}
```

`src/modules/post/dto/update-post.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExploreCategory, PostPrivacy } from '@prisma/client';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(PostPrivacy)
  privacy?: PostPrivacy;

  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;
}
```

`src/modules/post/dto/list-posts.dto.ts`:
```typescript
import { IsOptional, IsUUID } from 'class-validator';

export class ListPostsDto {
  @IsUUID('4', { message: 'authorId must be a valid UUID' })
  authorId!: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
```

- [ ] **Step 4: Run the specs to verify they pass**

Run: `npx jest src/modules/post/dto -v`
Expected: PASS (all three files).

- [ ] **Step 5: Commit**

```bash
git add src/modules/post/dto
git commit -m "feat(post): add create/update/list DTOs with validation"
```

---

## Task 4: Hashtag extraction utility

**Files:**
- Create: `src/modules/post/hashtag.util.ts`
- Test: `src/modules/post/hashtag.util.spec.ts`

- [ ] **Step 1: Write the failing test**

`src/modules/post/hashtag.util.spec.ts`:
```typescript
import { extractHashtags } from './hashtag.util';

describe('extractHashtags', () => {
  it('extracts unique, lowercased tags', () => {
    expect(extractHashtags('Love #Coding and #coding and #Travel')).toEqual([
      'coding',
      'travel',
    ]);
  });

  it('returns [] for null or empty content', () => {
    expect(extractHashtags(null)).toEqual([]);
    expect(extractHashtags('')).toEqual([]);
  });

  it('ignores a lone # and trailing punctuation', () => {
    expect(extractHashtags('a # b #c! #d.')).toEqual(['c', 'd']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/modules/post/hashtag.util.spec.ts -v`
Expected: FAIL — cannot find `./hashtag.util`.

- [ ] **Step 3: Implement the utility**

`src/modules/post/hashtag.util.ts`:
```typescript
/**
 * Extract unique, lowercased hashtag names (without the leading '#') from post
 * text. `#Coding` and `#coding` collapse to one tag; lone '#' and punctuation
 * are ignored.
 */
export function extractHashtags(content: string | null | undefined): string[] {
  if (!content) return [];
  const matches = content.match(/#(\w+)/g) ?? [];
  const tags = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(tags)];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/modules/post/hashtag.util.spec.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/post/hashtag.util.ts src/modules/post/hashtag.util.spec.ts
git commit -m "feat(post): add hashtag extraction utility"
```

---

## Task 5: Supabase Storage helper

**Files:**
- Create: `src/common/storage/storage.service.ts`
- Create: `src/common/storage/__mocks__/storage.service.ts`
- Test: `src/common/storage/storage.service.spec.ts`
- Modify: `src/config/env.config.ts` (add `SUPABASE_POST_MEDIA_BUCKET`)
- Modify: `src/config/__mocks__/supabase.config.ts` (add a `storage` mock)
- Modify: `test/jest.setup-env.ts` (set the bucket name for hermetic tests)
- Modify: `.env.example` (document the new variable)

- [ ] **Step 1: Add the env variable**

In `src/config/env.config.ts`, inside the `// Supabase` group (after `SUPABASE_SERVICE_ROLE_KEY`), add:
```typescript
  SUPABASE_POST_MEDIA_BUCKET: optionalEnv('SUPABASE_POST_MEDIA_BUCKET', 'post-media'),
```

In `.env.example`, under the Supabase section, add:
```
SUPABASE_POST_MEDIA_BUCKET=post-media
```

In `test/jest.setup-env.ts`, add after the other `process.env.SUPABASE_*` lines:
```typescript
process.env.SUPABASE_POST_MEDIA_BUCKET ??= 'post-media';
```

- [ ] **Step 2: Extend the Supabase manual mock with storage**

Replace the contents of `src/config/__mocks__/supabase.config.ts` with:
```typescript
// Manual Jest mock for the Supabase config module. The Supabase SDK is the one
// unavoidable external boundary, so specs stub it here. Specs opt in with a bare
// `jest.mock('../../config/supabase.config')` and reach for the jest.fn()s they need.
export const supabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    verifyOtp: jest.fn(),
    refreshSession: jest.fn(),
  },
};

// A single shared bucket object so `from()` returns the same handle every call,
// which lets storage specs assert on `.upload` / `.getPublicUrl` / `.remove`.
const storageBucket = {
  upload: jest.fn(),
  getPublicUrl: jest.fn(),
  remove: jest.fn(),
};

export const supabaseAdmin = {
  auth: {
    getUser: jest.fn(),
    admin: {
      signOut: jest.fn(),
      updateUserById: jest.fn(),
    },
  },
  storage: {
    from: jest.fn(() => storageBucket),
  },
};
```

- [ ] **Step 3: Write the failing storage spec**

`src/common/storage/storage.service.spec.ts`:
```typescript
jest.mock('../../config/supabase.config');

import { supabaseAdmin } from '../../config/supabase.config';
import { deleteImages, uploadImage } from './storage.service';

const bucket = (supabaseAdmin.storage.from as jest.Mock)('post-media');
const mockUpload = bucket.upload as jest.Mock;
const mockGetPublicUrl = bucket.getPublicUrl as jest.Mock;
const mockRemove = bucket.remove as jest.Mock;

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('storage.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('uploadImage', () => {
    it('uploads the bytes and returns the public URL', async () => {
      mockUpload.mockResolvedValue({ data: { path: 'p' }, error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/post-media/u/a.jpg' },
      });

      const url = await uploadImage(Buffer.from('img'), 'image/jpeg', USER_ID);

      expect(url).toBe(
        'https://x.supabase.co/storage/v1/object/public/post-media/u/a.jpg',
      );
      expect(mockUpload).toHaveBeenCalledTimes(1);
      const [path, , opts] = mockUpload.mock.calls[0];
      expect(path).toMatch(new RegExp(`^${USER_ID}/.+\\.jpg$`));
      expect(opts).toMatchObject({ contentType: 'image/jpeg' });
    });

    it('throws when the upload fails', async () => {
      mockUpload.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await expect(
        uploadImage(Buffer.from('img'), 'image/png', USER_ID),
      ).rejects.toThrow(/upload failed/i);
    });
  });

  describe('deleteImages', () => {
    it('maps public URLs back to object paths and removes them', async () => {
      mockRemove.mockResolvedValue({ data: [], error: null });
      await deleteImages([
        'https://x.supabase.co/storage/v1/object/public/post-media/user1/a.jpg',
      ]);
      expect(mockRemove).toHaveBeenCalledWith(['user1/a.jpg']);
    });

    it('does nothing for an empty list', async () => {
      await deleteImages([]);
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 4: Run the spec to verify it fails**

Run: `npx jest src/common/storage/storage.service.spec.ts -v`
Expected: FAIL — cannot find `./storage.service`.

- [ ] **Step 5: Implement the storage helper**

`src/common/storage/storage.service.ts`:
```typescript
import { randomUUID } from 'crypto';
import { env } from '../../config/env.config';
import { supabaseAdmin } from '../../config/supabase.config';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Upload image bytes to the post-media bucket and return the public URL. */
export async function uploadImage(
  buffer: Buffer,
  mimetype: string,
  userId: string,
): Promise<string> {
  const ext = MIME_EXT[mimetype] ?? 'bin';
  const path = `${userId}/${randomUUID()}.${ext}`;
  const bucket = env.SUPABASE_POST_MEDIA_BUCKET;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Best-effort removal of stored images, given their public URLs. */
export async function deleteImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const bucket = env.SUPABASE_POST_MEDIA_BUCKET;
  const marker = `/object/public/${bucket}/`;

  const paths = urls
    .map((url) => {
      const i = url.indexOf(marker);
      return i === -1 ? null : url.slice(i + marker.length);
    })
    .filter((p): p is string => p !== null);

  if (paths.length === 0) return;
  await supabaseAdmin.storage.from(bucket).remove(paths);
}
```

- [ ] **Step 6: Add the manual mock used by the service spec (Task 7)**

`src/common/storage/__mocks__/storage.service.ts`:
```typescript
export const uploadImage = jest.fn();
export const deleteImages = jest.fn();
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `npx jest src/common/storage/storage.service.spec.ts -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/common/storage src/config/env.config.ts src/config/__mocks__/supabase.config.ts test/jest.setup-env.ts .env.example
git commit -m "feat(storage): add Supabase post-media upload/delete helper"
```

---

## Task 6: Post types and repository

**Files:**
- Create: `src/modules/post/post.types.ts`
- Create: `src/modules/post/post.repository.ts`

(No spec — repositories are mocked in the service spec, matching the existing codebase.)

- [ ] **Step 1: Implement the view types**

`src/modules/post/post.types.ts`:
```typescript
import type { ExploreCategory, PostPrivacy, PostType } from '@prisma/client';

export interface PostMediaView {
  id: string;
  url: string;
  position: number;
}

export interface PostView {
  id: string;
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  media: PostMediaView[];
  viewCount: number;
  isLongFormVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  content?: string;
  privacy?: PostPrivacy;
  category?: ExploreCategory;
  images: Array<{ buffer: Buffer; mimetype: string }>;
}

export interface UpdatePostInput {
  content?: string;
  privacy?: PostPrivacy;
  category?: ExploreCategory;
}
```

- [ ] **Step 2: Implement the repository**

`src/modules/post/post.repository.ts`:
```typescript
import type { ExploreCategory, PostPrivacy, PostType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const mediaInclude = {
  media: { orderBy: { position: 'asc' } },
} satisfies Prisma.PostInclude;

export async function createPost(input: {
  authorId: string;
  content: string | null;
  postType: PostType;
  privacy: PostPrivacy;
  category: ExploreCategory | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaUrls: string[];
}) {
  return prisma.post.create({
    data: {
      authorId: input.authorId,
      content: input.content,
      postType: input.postType,
      privacy: input.privacy,
      category: input.category,
      mediaUrl: input.mediaUrl,
      thumbnailUrl: input.thumbnailUrl,
      media: {
        create: input.mediaUrls.map((url, position) => ({ url, position })),
      },
    },
    include: mediaInclude,
  });
}

export async function findPostById(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: mediaInclude,
  });
}

export async function updatePost(
  postId: string,
  data: {
    content?: string | null;
    privacy?: PostPrivacy;
    category?: ExploreCategory | null;
  },
) {
  return prisma.post.update({
    where: { id: postId },
    data,
    include: mediaInclude,
  });
}

export async function deletePost(postId: string): Promise<void> {
  await prisma.post.delete({ where: { id: postId } });
}

export async function listPostsByAuthor(
  authorId: string,
  where: Prisma.PostWhereInput,
  skip: number,
  take: number,
) {
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where: { authorId, ...where },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: mediaInclude,
    }),
    prisma.post.count({ where: { authorId, ...where } }),
  ]);
  return { rows, total };
}

/**
 * Reconcile a post's hashtag links to exactly `tagNames`, keeping
 * Hashtag.postCount accurate. Passing [] removes all links (used on delete).
 */
export async function syncPostHashtags(postId: string, tagNames: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.postHashtag.findMany({
      where: { postId },
      include: { hashtag: { select: { id: true, name: true } } },
    });
    const existingNames = new Set(existing.map((e) => e.hashtag.name));
    const newNames = new Set(tagNames);

    for (const link of existing) {
      if (newNames.has(link.hashtag.name)) continue;
      await tx.postHashtag.delete({
        where: { postId_hashtagId: { postId, hashtagId: link.hashtagId } },
      });
      await tx.hashtag.update({
        where: { id: link.hashtagId },
        data: { postCount: { decrement: 1 } },
      });
    }

    for (const name of tagNames) {
      if (existingNames.has(name)) continue;
      const hashtag = await tx.hashtag.upsert({
        where: { name },
        create: { name, postCount: 1 },
        update: { postCount: { increment: 1 } },
      });
      await tx.postHashtag.create({ data: { postId, hashtagId: hashtag.id } });
    }
  });
}

export async function findBlockBetween(userA: string, userB: string) {
  return prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
}

export async function isAcceptedFollower(viewerId: string, authorId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: authorId } },
  });
  return row?.status === 'ACCEPTED';
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/modules/post/post.types.ts src/modules/post/post.repository.ts
git commit -m "feat(post): add view types and repository"
```

---

## Task 7: Post service (TDD)

**Files:**
- Create: `src/modules/post/post.service.ts`
- Test: `src/modules/post/post.service.spec.ts`

- [ ] **Step 1: Write the failing service spec**

`src/modules/post/post.service.spec.ts`:
```typescript
jest.mock('./post.repository');
jest.mock('../../common/storage/storage.service');

import * as repo from './post.repository';
import * as storage from '../../common/storage/storage.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import {
  createPost,
  deletePost,
  getPostById,
  listPostsByAuthor,
  updatePost,
} from './post.service';

const mockCreatePost = repo.createPost as jest.Mock;
const mockFindPostById = repo.findPostById as jest.Mock;
const mockUpdatePost = repo.updatePost as jest.Mock;
const mockDeletePost = repo.deletePost as jest.Mock;
const mockListPostsByAuthor = repo.listPostsByAuthor as jest.Mock;
const mockSyncPostHashtags = repo.syncPostHashtags as jest.Mock;
const mockFindBlockBetween = repo.findBlockBetween as jest.Mock;
const mockIsAcceptedFollower = repo.isAcceptedFollower as jest.Mock;
const mockUploadImage = storage.uploadImage as jest.Mock;
const mockDeleteImages = storage.deleteImages as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

const basePost = {
  id: POST_ID,
  authorId: USER_A,
  content: 'hello',
  postType: 'TEXT',
  privacy: 'PUBLIC',
  category: null,
  mediaUrl: null,
  thumbnailUrl: null,
  media: [],
  viewCount: 0,
  isLongFormVideo: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('post.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createPost', () => {
    it('creates a TEXT post and extracts hashtags', async () => {
      mockCreatePost.mockResolvedValue({ ...basePost, content: 'hi #World' });

      const result = await createPost(USER_A, { content: 'hi #World', images: [] });

      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: USER_A, postType: 'TEXT', mediaUrl: null }),
      );
      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, ['world']);
      expect(result.id).toBe(POST_ID);
    });

    it('uploads images, sets postType IMAGE, and mirrors the first URL', async () => {
      mockUploadImage
        .mockResolvedValueOnce('https://cdn/a.jpg')
        .mockResolvedValueOnce('https://cdn/b.jpg');
      mockCreatePost.mockResolvedValue({
        ...basePost,
        postType: 'IMAGE',
        mediaUrl: 'https://cdn/a.jpg',
        media: [
          { id: 'm1', url: 'https://cdn/a.jpg', position: 0 },
          { id: 'm2', url: 'https://cdn/b.jpg', position: 1 },
        ],
      });

      const result = await createPost(USER_A, {
        images: [
          { buffer: Buffer.from('a'), mimetype: 'image/jpeg' },
          { buffer: Buffer.from('b'), mimetype: 'image/png' },
        ],
      });

      expect(mockUploadImage).toHaveBeenCalledTimes(2);
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          postType: 'IMAGE',
          mediaUrl: 'https://cdn/a.jpg',
          thumbnailUrl: 'https://cdn/a.jpg',
          mediaUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
        }),
      );
      expect(result.media).toHaveLength(2);
    });

    it('rejects a post with neither text nor images', async () => {
      await expect(createPost(USER_A, { images: [] })).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });
  });

  describe('getPostById', () => {
    it('returns a public post to an anonymous viewer', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, privacy: 'PUBLIC' });
      const result = await getPostById(POST_ID, undefined);
      expect(result.id).toBe(POST_ID);
    });

    it('404s a missing post', async () => {
      mockFindPostById.mockResolvedValue(null);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('404s an ONLY_ME post for a non-owner', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'ONLY_ME' });
      mockFindBlockBetween.mockResolvedValue(null);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('404s a FOLLOWERS post for a non-follower', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'FOLLOWERS' });
      mockFindBlockBetween.mockResolvedValue(null);
      mockIsAcceptedFollower.mockResolvedValue(false);
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns a FOLLOWERS post to an accepted follower', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'FOLLOWERS' });
      mockFindBlockBetween.mockResolvedValue(null);
      mockIsAcceptedFollower.mockResolvedValue(true);
      const result = await getPostById(POST_ID, USER_A);
      expect(result.id).toBe(POST_ID);
    });

    it('404s when the viewer is blocked', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B, privacy: 'PUBLIC' });
      mockFindBlockBetween.mockResolvedValue({ id: 'b1' });
      await expect(getPostById(POST_ID, USER_A)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('listPostsByAuthor', () => {
    it('lists posts with pagination meta', async () => {
      mockListPostsByAuthor.mockResolvedValue({ rows: [basePost], total: 1 });
      const result = await listPostsByAuthor(USER_A, USER_A, 1, 20);
      expect(result.posts).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns an empty page when the viewer is blocked', async () => {
      mockFindBlockBetween.mockResolvedValue({ id: 'b1' });
      const result = await listPostsByAuthor(USER_B, USER_A, 1, 20);
      expect(result.posts).toEqual([]);
      expect(mockListPostsByAuthor).not.toHaveBeenCalled();
    });
  });

  describe('updatePost', () => {
    it('rejects editing someone else’s post', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B });
      await expect(
        updatePost(POST_ID, USER_A, { content: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('updates content and re-syncs hashtags', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_A });
      mockUpdatePost.mockResolvedValue({ ...basePost, content: 'new #tag' });

      const result = await updatePost(POST_ID, USER_A, { content: 'new #tag' });

      expect(mockUpdatePost).toHaveBeenCalledWith(POST_ID, { content: 'new #tag' });
      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, ['tag']);
      expect(result.content).toBe('new #tag');
    });

    it('rejects an empty update', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_A });
      await expect(updatePost(POST_ID, USER_A, {})).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });
  });

  describe('deletePost', () => {
    it('deletes an own post, clears hashtags, and removes images', async () => {
      mockFindPostById.mockResolvedValue({
        ...basePost,
        authorId: USER_A,
        media: [{ id: 'm1', url: 'https://cdn/a.jpg', position: 0 }],
      });

      await deletePost(POST_ID, USER_A);

      expect(mockSyncPostHashtags).toHaveBeenCalledWith(POST_ID, []);
      expect(mockDeletePost).toHaveBeenCalledWith(POST_ID);
      expect(mockDeleteImages).toHaveBeenCalledWith(['https://cdn/a.jpg']);
    });

    it('rejects deleting someone else’s post', async () => {
      mockFindPostById.mockResolvedValue({ ...basePost, authorId: USER_B });
      await expect(deletePost(POST_ID, USER_A)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest src/modules/post/post.service.spec.ts -v`
Expected: FAIL — cannot find `./post.service`.

- [ ] **Step 3: Implement the service**

`src/modules/post/post.service.ts`:
```typescript
import type { ExploreCategory, PostPrivacy, Prisma } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors';
import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as storage from '../../common/storage/storage.service';
import { extractHashtags } from './hashtag.util';
import * as repo from './post.repository';
import type { CreatePostInput, PostView, UpdatePostInput } from './post.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertValidUuid(id: string): void {
  if (!UUID_REGEX.test(id)) throw new BadRequestError('Invalid ID format');
}

type PostWithMedia = NonNullable<Awaited<ReturnType<typeof repo.findPostById>>>;

function mapPost(post: PostWithMedia): PostView {
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    postType: post.postType,
    privacy: post.privacy,
    category: post.category,
    mediaUrl: post.mediaUrl,
    thumbnailUrl: post.thumbnailUrl,
    media: post.media.map((m) => ({ id: m.id, url: m.url, position: m.position })),
    viewCount: post.viewCount,
    isLongFormVideo: post.isLongFormVideo,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

async function ensureCanView(post: PostWithMedia, viewerId: string | undefined): Promise<void> {
  if (post.authorId === viewerId) return; // owner always sees their own posts

  if (viewerId) {
    const block = await repo.findBlockBetween(viewerId, post.authorId);
    if (block) throw new NotFoundError('Post');
  }

  if (post.privacy === 'PUBLIC') return;
  if (post.privacy === 'ONLY_ME') throw new NotFoundError('Post');

  // FOLLOWERS
  if (!viewerId) throw new NotFoundError('Post');
  const isFollower = await repo.isAcceptedFollower(viewerId, post.authorId);
  if (!isFollower) throw new NotFoundError('Post');
}

function buildPrivacyFilter(isOwner: boolean, isFollower: boolean): Prisma.PostWhereInput {
  if (isOwner) return {};
  const allowed: PostPrivacy[] = ['PUBLIC'];
  if (isFollower) allowed.push('FOLLOWERS');
  return { privacy: { in: allowed } };
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<PostView> {
  const content = input.content?.trim() || null;
  const hasImages = input.images.length > 0;
  if (!content && !hasImages) {
    throw new BadRequestError('A post must have text or at least one image');
  }

  const mediaUrls: string[] = [];
  for (const image of input.images) {
    const url = await storage.uploadImage(image.buffer, image.mimetype, authorId);
    mediaUrls.push(url);
  }

  const post = await repo.createPost({
    authorId,
    content,
    postType: hasImages ? 'IMAGE' : 'TEXT',
    privacy: input.privacy ?? 'PUBLIC',
    category: input.category ?? null,
    mediaUrl: mediaUrls[0] ?? null,
    thumbnailUrl: mediaUrls[0] ?? null,
    mediaUrls,
  });

  await repo.syncPostHashtags(post.id, extractHashtags(content));

  return mapPost(post);
}

export async function getPostById(postId: string, viewerId: string | undefined): Promise<PostView> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  await ensureCanView(post, viewerId);
  return mapPost(post);
}

export async function listPostsByAuthor(
  authorId: string,
  viewerId: string | undefined,
  page: number,
  limit: number,
): Promise<{ posts: PostView[]; meta: PaginationMeta }> {
  assertValidUuid(authorId);
  const isOwner = viewerId === authorId;

  if (!isOwner && viewerId) {
    const block = await repo.findBlockBetween(viewerId, authorId);
    if (block) return { posts: [], meta: buildPaginationMeta(0, page, limit) };
  }

  const isFollower =
    !isOwner && viewerId ? await repo.isAcceptedFollower(viewerId, authorId) : isOwner;

  const where = buildPrivacyFilter(isOwner, isFollower);
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listPostsByAuthor(authorId, where, skip, limit);

  return { posts: rows.map(mapPost), meta: buildPaginationMeta(total, page, limit) };
}

export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
): Promise<PostView> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');

  const data: { content?: string | null; privacy?: PostPrivacy; category?: ExploreCategory | null } = {};
  if (input.content !== undefined) data.content = input.content.trim() || null;
  if (input.privacy !== undefined) data.privacy = input.privacy;
  if (input.category !== undefined) data.category = input.category;

  if (Object.keys(data).length === 0) {
    throw new BadRequestError('No fields to update');
  }

  const updated = await repo.updatePost(postId, data);

  if (input.content !== undefined) {
    await repo.syncPostHashtags(postId, extractHashtags(data.content ?? null));
  }

  return mapPost(updated);
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  assertValidUuid(postId);
  const post = await repo.findPostById(postId);
  if (!post) throw new NotFoundError('Post');
  if (post.authorId !== userId) throw new ForbiddenError('You can only delete your own posts');

  await repo.syncPostHashtags(postId, []); // decrement hashtag counts before cascade
  await repo.deletePost(postId);
  await storage.deleteImages(post.media.map((m) => m.url));
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest src/modules/post/post.service.spec.ts -v`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/modules/post/post.service.ts src/modules/post/post.service.spec.ts
git commit -m "feat(post): add service with privacy, hashtags, and image handling"
```

---

## Task 8: Upload middleware, controller, routes (TDD on routes)

**Files:**
- Create: `src/common/middleware/upload.middleware.ts`
- Create: `src/modules/post/post.controller.ts`
- Create: `src/modules/post/post.routes.ts`
- Test: `src/modules/post/post.routes.spec.ts`

- [ ] **Step 1: Implement the upload middleware**

`src/common/middleware/upload.middleware.ts`:
```typescript
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
  },
});

/** Parse up to 10 image files from the `images` multipart field into req.files. */
export function uploadPostImages(req: Request, res: Response, next: NextFunction): void {
  upload.array('images', MAX_FILES)(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Each image must be 5 MB or smaller'
            : err.code === 'LIMIT_FILE_COUNT'
              ? `You can upload at most ${MAX_FILES} images`
              : 'Image upload failed';
        return next(new BadRequestError(message));
      }
      return next(err);
    }
    next();
  });
}
```

- [ ] **Step 2: Implement the controller**

`src/modules/post/post.controller.ts`:
```typescript
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import * as postService from './post.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

function getViewerId(req: Request): string | undefined {
  return req.user?.sub;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function createPost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as CreatePostDto;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const post = await postService.createPost(userId, {
    content: body.content,
    privacy: body.privacy,
    category: body.category,
    images: files.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
  });

  sendSuccess(res, post, { statusCode: 201, message: 'Post created successfully' });
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await postService.getPostById(param(req, 'id'), getViewerId(req));
  sendSuccess(res, post);
}

export async function listPosts(req: Request, res: Response): Promise<void> {
  const authorId = String(req.query.authorId ?? '');
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await postService.listPostsByAuthor(authorId, getViewerId(req), page, limit);
  sendSuccess(res, result.posts, { meta: result.meta });
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const post = await postService.updatePost(param(req, 'id'), userId, req.body as UpdatePostDto);
  sendSuccess(res, post, { message: 'Post updated successfully' });
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  await postService.deletePost(param(req, 'id'), userId);
  sendSuccess(res, { id: param(req, 'id') }, { message: 'Post deleted successfully' });
}
```

- [ ] **Step 3: Implement the routes (with OpenAPI JSDoc)**

`src/modules/post/post.routes.ts`:
```typescript
import { Router } from 'express';
import { optionalSupabaseAuthGuard, supabaseAuthGuard } from '../../common/guards';
import { validateBody, validateQuery } from '../../common/middleware/validate.middleware';
import { uploadPostImages } from '../../common/middleware/upload.middleware';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsDto } from './dto/list-posts.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import * as postController from './post.controller';

// ─────────────────────────────────────────────────────────────────────────────
// Post Routes — mounted at /api/v1/posts
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

/**
 * @openapi
 * /posts:
 *   post:
 *     tags: [Post]
 *     summary: Create a post (text and/or photos)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/CreatePostRequest' }
 *     responses:
 *       '201':
 *         description: Post created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Post created successfully' }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '422':
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   get:
 *     tags: [Post]
 *     summary: List a user's posts (viewer-aware, paginated)
 *     description: Authentication is optional; supplying a token reveals follower-only posts you may see.
 *     parameters:
 *       - in: query
 *         name: authorId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       '200':
 *         description: The author's visible posts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PostView' }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *       '422':
 *         description: Validation failed (missing or invalid authorId).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/', supabaseAuthGuard, uploadPostImages, validateBody(CreatePostDto), postController.createPost);
router.get('/', validateQuery(ListPostsDto), optionalSupabaseAuthGuard, postController.listPosts);

/**
 * @openapi
 * /posts/{id}:
 *   get:
 *     tags: [Post]
 *     summary: Get a single post (viewer-aware)
 *     description: Authentication is optional. Posts hidden from the viewer return 404.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: The post.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '404':
 *         description: Post not found or not visible.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   patch:
 *     tags: [Post]
 *     summary: Edit a post (text / privacy / category)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdatePostRequest' }
 *     responses:
 *       '200':
 *         description: Post updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Post updated successfully' }
 *                 data: { $ref: '#/components/schemas/PostView' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '403':
 *         description: Not the post owner.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   delete:
 *     tags: [Post]
 *     summary: Delete a post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Post deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MessageResponse' }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '403':
 *         description: Not the post owner.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       '404':
 *         description: Post not found.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:id', optionalSupabaseAuthGuard, postController.getPost);
router.patch('/:id', supabaseAuthGuard, validateBody(UpdatePostDto), postController.updatePost);
router.delete('/:id', supabaseAuthGuard, postController.deletePost);

export { router as postRouter };
```

- [ ] **Step 4: Write the failing routes spec**

`src/modules/post/post.routes.spec.ts`:
```typescript
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('../../config/supabase.config');
jest.mock('./post.service');

jest.mock('../../common/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/env.config', () => ({
  env: { NODE_ENV: 'test' },
}));

import { supabaseAdmin } from '../../config/supabase.config';
import { errorHandler } from '../../common/middleware/error-handler.middleware';
import * as postService from './post.service';
import { postRouter } from './post.routes';

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock;
const mockCreatePost = postService.createPost as jest.Mock;
const mockGetPostById = postService.getPostById as jest.Mock;
const mockListPostsByAuthor = postService.listPostsByAuthor as jest.Mock;
const mockUpdatePost = postService.updatePost as jest.Mock;
const mockDeletePost = postService.deletePost as jest.Mock;

const USER_A = '11111111-1111-4111-8111-111111111111';
const POST_ID = '33333333-3333-4333-8333-333333333333';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/posts', postRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function authAs(userId: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: 'user@example.com', role: 'authenticated' } },
    error: null,
  });
}

describe('POST /api/v1/posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/posts').field('content', 'hi');
    expect(res.status).toBe(401);
    expect(mockCreatePost).not.toHaveBeenCalled();
  });

  it('creates a post for an authenticated user', async () => {
    authAs(USER_A);
    mockCreatePost.mockResolvedValue({ id: POST_ID, content: 'hi' });

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer t')
      .field('content', 'hi');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('hi');
    expect(mockCreatePost).toHaveBeenCalled();
  });

  it('rejects a non-image upload with 400', async () => {
    authAs(USER_A);
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', 'Bearer t')
      .attach('images', Buffer.from('%PDF-1.4'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(mockCreatePost).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a post without auth', async () => {
    mockGetPostById.mockResolvedValue({ id: POST_ID, content: 'hi' });
    const res = await request(app).get(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(POST_ID);
  });
});

describe('GET /api/v1/posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 422 when authorId is missing', async () => {
    const res = await request(app).get('/api/v1/posts');
    expect(res.status).toBe(422);
    expect(mockListPostsByAuthor).not.toHaveBeenCalled();
  });

  it('lists posts by author', async () => {
    mockListPostsByAuthor.mockResolvedValue({
      posts: [{ id: POST_ID }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const res = await request(app).get('/api/v1/posts').query({ authorId: USER_A });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('PATCH /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`/api/v1/posts/${POST_ID}`).send({ content: 'x' });
    expect(res.status).toBe(401);
    expect(mockUpdatePost).not.toHaveBeenCalled();
  });

  it('updates a post for the owner', async () => {
    authAs(USER_A);
    mockUpdatePost.mockResolvedValue({ id: POST_ID, content: 'x' });

    const res = await request(app)
      .patch(`/api/v1/posts/${POST_ID}`)
      .set('Authorization', 'Bearer t')
      .send({ content: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('x');
    expect(mockUpdatePost).toHaveBeenCalledWith(POST_ID, USER_A, { content: 'x' });
  });
});

describe('DELETE /api/v1/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).delete(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(401);
    expect(mockDeletePost).not.toHaveBeenCalled();
  });

  it('deletes a post for the owner', async () => {
    authAs(USER_A);
    mockDeletePost.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/v1/posts/${POST_ID}`)
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(mockDeletePost).toHaveBeenCalledWith(POST_ID, USER_A);
  });
});
```

- [ ] **Step 5: Run the routes spec to verify it passes**

Run: `npx jest src/modules/post/post.routes.spec.ts -v`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/common/middleware/upload.middleware.ts src/modules/post/post.controller.ts src/modules/post/post.routes.ts src/modules/post/post.routes.spec.ts
git commit -m "feat(post): add upload middleware, controller, and routes"
```

---

## Task 9: Register the router and document it in Swagger

**Files:**
- Modify: `src/routes/index.ts`
- Modify: `src/config/swagger.config.ts`

- [ ] **Step 1: Mount the post router**

In `src/routes/index.ts`, add the import alongside the others:
```typescript
import { postRouter } from '../modules/post/post.routes';
```
and mount it in the Feature Modules block (after the `search` line):
```typescript
router.use('/posts', postRouter);
```

- [ ] **Step 2: Add the `Post` Swagger tag**

In `src/config/swagger.config.ts`, inside the `tags: [ ... ]` array, add after the `Search` entry:
```typescript
    {
      name: 'Post',
      description: 'Create, edit, delete, and read posts, including multi-photo uploads',
    },
```

- [ ] **Step 3: Add the Post schemas**

In `src/config/swagger.config.ts`, inside `components.schemas`, add these entries (next to the other schema definitions):
```typescript
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
          postType: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'COVER_PHOTO'] },
          privacy: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] },
          category: { $ref: '#/components/schemas/ExploreCategory', nullable: true },
          mediaUrl: { type: 'string', nullable: true },
          thumbnailUrl: { type: 'string', nullable: true },
          media: { type: 'array', items: { $ref: '#/components/schemas/PostMediaView' } },
          viewCount: { type: 'integer', example: 0 },
          isLongFormVideo: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreatePostRequest: {
        type: 'object',
        properties: {
          content: { type: 'string', maxLength: 5000 },
          privacy: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] },
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
        properties: {
          content: { type: 'string', maxLength: 5000 },
          privacy: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'ONLY_ME'] },
          category: { $ref: '#/components/schemas/ExploreCategory' },
        },
      },
```

(`ExploreCategory` is already defined in `components.schemas` — confirmed at `swagger.config.ts:222` — so the `$ref`s resolve.)

- [ ] **Step 4: Verify the project compiles and the spec still builds**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.ts src/config/swagger.config.ts
git commit -m "feat(post): register router and add Swagger docs"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all suites pass, including the new post/storage suites and all pre-existing suites (no regressions).

- [ ] **Step 2: Lint the new code**

Run: `npm run lint`
Expected: no errors in the new files (fix any reported).

- [ ] **Step 3: Smoke-run the live server (per the `run` skill)**

Start the dev server and exercise the new endpoints as a client would:
```bash
npm run dev
```
Then, in another shell, with a valid Supabase access token in `$TOKEN`:
```bash
# Create a text post with a hashtag
curl -s -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F "content=hello from curl #launch"
# → 201, body.data has id, postType 'TEXT', media []

# Create a post with a photo
curl -s -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F "content=with a photo" \
  -F "images=@/path/to/local.jpg"
# → 201, body.data.media has one entry, mediaUrl is a public post-media URL

# Fetch it
curl -s http://localhost:3000/api/v1/posts/<id>
# → 200

# List by author
curl -s "http://localhost:3000/api/v1/posts?authorId=<userId>"
# → 200, data array + meta
```
Expected: status codes as noted; the photo URL resolves publicly in a browser. Stop the server when done.

- [ ] **Step 4: Final commit (if lint produced fixes)**

```bash
git add -A
git commit -m "chore(post): lint fixes"
```

---

## Self-review notes (author)

- **Spec coverage:** create (Task 7/8), edit text-only (Task 7 `updatePost`, photos excluded by design), delete + image cleanup (Task 7), get-one viewer-aware 404 (Task 7 `getPostById`), list-by-author paginated + filtered (Task 7 `listPostsByAuthor`), multi-photo via `PostMedia` (Task 2/6), backward-compat `mediaUrl` mirror (Task 7 `createPost`), hashtag auto-extract + count reconcile (Task 4/6/7), public bucket creation (Task 2), public URLs (Task 5). All spec sections map to a task.
- **No placeholders:** every code step contains complete code; every run step has an expected result.
- **Type consistency:** `PostView`/`PostMediaView`/`CreatePostInput`/`UpdatePostInput` (Task 6) are the exact shapes consumed by the service (Task 7) and controller (Task 8); repository function names (`createPost`, `findPostById`, `updatePost`, `deletePost`, `listPostsByAuthor`, `syncPostHashtags`, `findBlockBetween`, `isAcceptedFollower`) match their mocks in `post.service.spec.ts`; service function names (`createPost`, `getPostById`, `listPostsByAuthor`, `updatePost`, `deletePost`) match their mocks in `post.routes.spec.ts`.
