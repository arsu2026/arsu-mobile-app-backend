# Posts — Team Guide & Implementation Report

_Last updated: 2026-06-14_

This document is the reference for the **Post module**: what shipped, how it is
structured, every endpoint, the privacy model, how image upload works, error
handling, configuration, the test suite, the deviations we hit during the build,
and the work that is still outstanding.

It is the durable companion to the process artifacts produced during the build:

- Design spec: `docs/superpowers/specs/2026-06-14-post-endpoint-design.md`
- TDD plan: `docs/superpowers/plans/2026-06-14-post-module.md`

---

## 1. At a glance

A minimal-Facebook-style post system: a user can **write**, **edit**, and
**delete** posts, and **attach photos**. Reads are **viewer-aware** — what you
see depends on who you are (owner, follower, blocked, anonymous) and the post's
privacy setting.

| # | Method & path | Auth | Purpose |
|---|---------------|:----:|---------|
| 1 | `POST /api/v1/posts` | **yes** (Bearer) | Create a post (text and/or up to 10 photos) |
| 2 | `GET /api/v1/posts` | optional | List a user's posts (`?authorId=…`, paginated, viewer-aware) |
| 3 | `GET /api/v1/posts/:id` | optional | Get one post (viewer-aware; hidden posts return 404) |
| 4 | `PATCH /api/v1/posts/:id` | **yes** (Bearer) | Edit own post (content / privacy / category) |
| 5 | `DELETE /api/v1/posts/:id` | **yes** (Bearer) | Delete own post (cascades media + clears hashtags + deletes files) |

Base path: `/api/v1/posts`. Live, interactive API docs (Swagger UI) are served at
**`/api/v1/docs`** (raw spec at `/api/v1/docs.json`). The Post tag, request
bodies, and `PostView`/`PostMediaView` schemas are all registered there.

Images are stored in the Supabase Storage bucket **`post-media`**; the database
stores only public URLs.

---

## 2. Architecture & principles

The module follows the project's established layered convention. Every request
flows through the same pipeline, and each layer has one responsibility:

```
mobile app ──HTTP──▶ Route ─▶ [guard] ─▶ [upload] ─▶ validate(DTO) ─▶ Controller ─▶ Service ─▶ Repository ─▶ Prisma
                       │                                                  │            │
                       │                                                  │            └─▶ Supabase Storage (images)
                       └──────────────── central error handler ◀── throws AppError ─────┘
```

- **Routes** (`post.routes.ts`) — wire guards, multipart parsing, and DTO
  validation; carry the OpenAPI JSDoc. No business logic.
- **Controller** (`post.controller.ts`) — thin. Pulls `userId`/`viewerId` and
  params off the request, shapes the service input, calls `sendSuccess`.
- **Service** (`post.service.ts`) — all business logic: privacy enforcement,
  image orchestration, hashtag sync, ownership checks, mapping to `PostView`.
- **Repository** (`post.repository.ts`) — all Prisma access. The only layer that
  touches the database.
- **Storage helper** (`src/common/storage/storage.service.ts`) — Supabase
  Storage upload/delete, shared and reusable beyond posts.
- **Upload middleware** (`src/common/middleware/upload.middleware.ts`) — multer
  config for the `images` multipart field.

Cross-cutting pieces reused from the rest of the codebase: the `{ success, data,
message?, meta? }` response envelope, the `AppError` hierarchy → HTTP status
mapping, the `supabaseAuthGuard` / `optionalSupabaseAuthGuard` guards, and the
pagination utilities.

### Why these boundaries

- **Repositories are not unit-tested directly** — they are thin Prisma wrappers
  and are mocked inside the service specs. Tests target the layers that hold
  logic (DTOs, hashtag util, storage helper, service, routes).
- **The storage helper lives in `common/`, not in the post module** — image
  upload is generic infrastructure; future modules (avatars, etc.) reuse it.

---

## 3. Data model

A new table, **`post_media`**, was added; the existing `posts` table was reused
as-is. One post has many media rows, ordered by `position`.

```prisma
model PostMedia {
  id        String   @id @default(uuid()) @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  url       String
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_media")
}
```

- **`onDelete: Cascade`** — deleting a post removes its media rows automatically
  at the DB level. (The application *also* deletes the underlying files from
  Storage; the cascade only handles the DB rows.)
- **`position`** — preserves photo order; the repository always includes media
  `orderBy: { position: 'asc' }`.
- **`posts.mediaUrl` / `posts.thumbnailUrl`** — the first uploaded image's URL is
  mirrored into these existing single-value columns so older clients / list views
  that read a single image keep working. The full set lives in `post_media`.

Migration: `prisma/migrations/20260614130000_add_post_media/migration.sql`
(CREATE TABLE + index + FK). See §9 for why this was authored manually.

---

## 4. The endpoints

### 4.1 `POST /posts` — create

- **Auth:** required (`supabaseAuthGuard`). Author = `req.user.sub`.
- **Body:** `multipart/form-data`.
  - `content` — optional, string, ≤ 5000 chars.
  - `privacy` — optional enum (`PUBLIC` | `FOLLOWERS` | `ONLY_ME`), default `PUBLIC`.
  - `category` — optional `ExploreCategory` enum.
  - `images` — optional, up to **10** files (jpeg/png/webp/gif, ≤ **5 MB** each).
- **Rule:** a post must have **text or at least one image** — empty posts are
  rejected with `400`.
- **Behaviour:** uploads each image to Storage (in order), sets `postType` to
  `IMAGE` when any image is present else `TEXT`, mirrors the first URL into
  `mediaUrl`/`thumbnailUrl`, persists the post + media rows, then extracts and
  syncs hashtags from the content.
- **Response:** `201` with the created `PostView`.

### 4.2 `GET /posts?authorId=…` — list

- **Auth:** optional. A token reveals follower-only posts the viewer is allowed
  to see.
- **Query:** `authorId` (required, UUIDv4), `page` (default 1), `limit`
  (default 20, max 100).
- **Behaviour:** if the viewer is blocked by/blocking the author, returns an
  **empty page** (not an error). Otherwise applies a privacy filter:
  - owner → sees everything;
  - accepted follower → `PUBLIC` + `FOLLOWERS`;
  - everyone else → `PUBLIC` only.
- **Response:** `200` with `data: PostView[]` and `meta` pagination.

### 4.3 `GET /posts/:id` — read one

- **Auth:** optional.
- **Behaviour:** runs the same visibility check as list, but for a single post.
  Anything the viewer may not see (missing, `ONLY_ME` for a non-owner,
  `FOLLOWERS` for a non-follower, or either party blocked) returns **`404`** — we
  deliberately do not leak existence with a `403`.
- **Response:** `200` with the `PostView`.

### 4.4 `PATCH /posts/:id` — edit

- **Auth:** required. Must be the **owner** (else `403`).
- **Body (JSON):** any of `content`, `privacy`, `category`. An empty body → `400`.
- **Behaviour:** updates only the provided fields. If `content` changed, hashtags
  are re-synced (counts incremented/decremented to match the new text).
- **Response:** `200` with the updated `PostView`.

### 4.5 `DELETE /posts/:id` — delete

- **Auth:** required. Must be the **owner** (else `403`).
- **Behaviour, in order:** clear hashtag links (decrement `Hashtag.postCount`) →
  delete the post (DB cascade removes `post_media` rows) → delete the image files
  from Supabase Storage.
- **Response:** `200` with a success message and the deleted `id`.

---

## 5. Privacy & safety model

Visibility is enforced **server-side in the service**, never trusted from the
client. Two ideas combine:

1. **Block check** — if a block exists in either direction between viewer and
   author, the viewer sees nothing (single read → 404; list → empty page).
2. **Privacy filter** — `PUBLIC` is always visible; `FOLLOWERS` requires an
   `ACCEPTED` follow; `ONLY_ME` is owner-only. The owner always sees their own
   posts regardless of privacy.

Single-post reads collapse every "not allowed" case into **404** so the API
never reveals that a hidden post exists.

---

## 6. Image storage

Handled by `src/common/storage/storage.service.ts` against the `post-media`
bucket:

- **Upload** — object path is `${userId}/${randomUUID()}.${ext}`, namespacing
  every user's files under their own prefix. Returns the Supabase **public URL**
  (`${SUPABASE_URL}/storage/v1/object/public/post-media/<path>`). Throws on
  upload failure so the request fails cleanly.
- **Delete** — reverses the public URL back to an object path by slicing on the
  `/object/public/post-media/` marker, then calls `remove`. A no-op for an empty
  list.

The **upload middleware** (`uploadPostImages`) uses multer `memoryStorage`
(buffers, never touches local disk), enforces the mime allow-list and the 5 MB /
10-file limits, and translates multer's `LIMIT_FILE_SIZE` / `LIMIT_FILE_COUNT`
errors into friendly `BadRequestError` messages.

---

## 7. Validation & error handling

- **DTOs** (`dto/`) use `class-validator`; `validateBody` / `validateQuery`
  reject malformed input with **`422`** before any controller runs.
- **Service-level errors** map through the shared `AppError` hierarchy:
  - `BadRequestError` → 400 (empty post, empty update, malformed UUID),
  - `UnauthorizedError` → 401 (missing token on a protected route),
  - `ForbiddenError` → 403 (editing/deleting someone else's post),
  - `NotFoundError` → 404 (missing or not-visible post).
- IDs are UUID-validated in the service (`assertValidUuid`) before any DB hit, so
  a junk `:id` is a fast 400 rather than a DB round-trip.

---

## 8. Configuration

| Env var | Default | Purpose |
|---|---|---|
| `SUPABASE_POST_MEDIA_BUCKET` | `post-media` | Storage bucket name for post images |

Added to `.env.example` and to the test env bootstrap (`test/jest.setup-env.ts`).
The bucket itself was created in the Supabase project (id
`azdolvfakfifmmmkkrzf`) via an `insert into storage.buckets` statement.

Existing Supabase vars (`SUPABASE_URL`, service-role key, etc.) are reused — see
`docs/AUTH.md` §Configuration.

---

## 9. Build approach, deviations & decisions

The module was built **test-first (TDD)**: for each unit we wrote the failing
test, implemented the minimum to pass, then committed (red → green → commit). The
commit history (`feat(post): …`) reflects one logical unit per commit.

**Deviations worth knowing about:**

1. **Prisma migration was authored manually.** `prisma migrate dev` fails on this
   project (`P3006` — the shadow DB replays `add_profiles`, which has a
   cross-schema FK to Supabase's `auth.users`, and the blank shadow DB has no
   `auth` schema). We generated the migration non-destructively with a pure
   datamodel diff and applied it via `prisma migrate deploy` (which uses the
   direct URL, no shadow DB). The resulting SQL is identical to what `migrate
   dev` would have produced. **This is now the standard procedure for this repo
   — see the full runbook in the team memory note.**

2. **`PostView` schema was enriched, not duplicated.** Pre-existing uncommitted
   OpenAPI work already defined a basic `PostView`. Rather than add a colliding
   key, we widened the existing one into a backward-compatible superset
   (added `category`, `media[]`, `viewCount`). The unrelated pre-existing docs
   were committed separately first (`0cf4baf`), then the Post additions layered
   on top — we don't fold others' uncommitted work into our feature commits.

**Decisions:**

- First-image URL mirrored into `mediaUrl`/`thumbnailUrl` for backward
  compatibility (§3).
- All "not visible" single-read outcomes return 404, not 403 (§5).
- Blocked-viewer list returns an empty page rather than an error (§4.2).

---

## 10. Testing

All logic-bearing layers are unit-tested; repositories are mocked.

| Suite | Tests | Covers |
|---|:---:|---|
| `post.service.spec.ts` | 16 | create/read/list/update/delete, privacy, blocks, ownership, hashtags |
| `post.routes.spec.ts` | 10 | routing, guards, validation wiring, status codes |
| `storage.service.spec.ts` | 4 | upload path/URL, upload failure, delete URL→path, empty list |
| `dto/create-post.dto.spec.ts` | 4 | content/privacy/category validation |
| `dto/update-post.dto.spec.ts` | 3 | partial-update validation |
| `dto/list-posts.dto.spec.ts` | 3 | `authorId` UUID + pagination validation |
| `hashtag.util.spec.ts` | 3 | extraction, lowercasing, dedupe |

Run the full project suite with `npm test` (Jest). At ship time the whole
repository was green (**33 suites / 174 tests**), and a live smoke run against the
production database exercised the unauthenticated, optional-auth, and validation
paths end-to-end.

---

## 11. Outstanding work

- **Authenticated image-upload path not smoke-tested live.** Unit tests cover it
  (mocked Storage), and the unauthenticated/validation paths were verified
  against the live DB, but a real authenticated multipart upload to the live
  `post-media` bucket has not yet been exercised end-to-end. Recommend a manual
  pass (or an integration test) before relying on it in production.
- **`npm run lint` is broken — pre-existing, not introduced here.**
  `eslint.config.mjs` imports `@eslint/js` and `typescript-eslint`, which are not
  in `package.json` / `node_modules`. Code was instead verified with
  `prettier --check` (clean) and `tsc` (clean). Fix is a one-line follow-up:
  add those two packages to `devDependencies`.
- **No rate limiting / content moderation** on post creation or uploads — out of
  scope for this iteration; flag if/when the feature opens to untrusted traffic.

---

## 12. File map

```
src/modules/post/
  dto/
    create-post.dto.ts            update-post.dto.ts            list-posts.dto.ts
    (+ .spec.ts for each)
  hashtag.util.ts  (+ .spec.ts)   — #tag extraction
  post.types.ts                   — PostView, PostMediaView, service input types
  post.repository.ts              — Prisma access + hashtag sync (reconcile)
  post.service.ts  (+ .spec.ts)   — business logic, privacy, image orchestration
  post.controller.ts              — thin request→service glue
  post.routes.ts   (+ .spec.ts)   — routing, guards, validation, OpenAPI JSDoc

src/common/
  storage/storage.service.ts (+ .spec.ts, __mocks__) — Supabase Storage helper
  middleware/upload.middleware.ts                     — multer config (images field)

prisma/
  schema.prisma                                       — PostMedia model + relation
  migrations/20260614130000_add_post_media/migration.sql

src/routes/index.ts                                   — mounts postRouter at /posts
src/config/{env.config.ts, swagger.config.ts}         — bucket env + OpenAPI schemas
```
