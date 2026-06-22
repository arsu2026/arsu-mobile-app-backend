# Post Module — Design Spec

_Date: 2026-06-14_
_Status: Approved (design), pending implementation plan_

## 1. Goal

Add a **Post module** to the ARSU backend: a minimal "Facebook-style" posting
feature. A user can **write**, **edit**, and **delete** a post, and **upload
photos** with a post. The backend receives the image bytes (multipart upload)
and stores them in a **public Supabase Storage bucket** (`post-media`), then
saves the resulting public URLs. Reads are **viewer-aware** (privacy-filtered).
Hashtags in the post text are **auto-extracted** and linked.

Built with **Test-Driven Development** (tests first, per unit).

## 2. Scope

In scope:
- Create a post (text and/or multiple photos).
- Edit a post (text / privacy / category — **not** photos).
- Delete a post (removes DB rows + image objects from the bucket).
- Get a single post (`GET /posts/:id`), viewer-aware.
- List a user's posts (`GET /posts?authorId=…`), paginated, viewer-aware.
- Auto-extract `#hashtags` from post text on create/edit.
- Create the `post-media` public Storage bucket.

Out of scope (explicit):
- Changing/adding/removing photos during edit. Photos are fixed at creation.
- Video uploads (existing `PostType.VIDEO` path untouched).
- Likes, comments, shares, feed ranking.

## 3. Data model

`Post` already exists. It has a single `mediaUrl` column, which the **profile**
and **search** modules read. To support multiple photos we add a child table.

### New table: `PostMedia`

```prisma
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

- Add `media PostMedia[]` to the `Post` model.
- **Backward compatibility:** on create, also set `Post.mediaUrl` and
  `Post.thumbnailUrl` to the **first** image URL, so profile/search (which read
  `mediaUrl`) keep working with no change.
- `postType` is inferred: `IMAGE` if any photos, else `TEXT`.
- Requires **one Prisma migration** (`npm run migration:generate:local`, which
  uses `.env.local` + `DATABASE_DIRECT_URL`) and `prisma generate`.

### Hashtags

`Hashtag` (unique `name`, `postCount`) and `PostHashtag` (composite PK) already
exist. On create/edit: parse `#tag` tokens from `content`, upsert each
`Hashtag`, reconcile `PostHashtag` links, and keep `postCount` accurate.

## 4. API

Mounted at `/api/v1/posts`.

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| POST | `/posts` | required | `multipart/form-data`: `content?`, `privacy?`, `category?`, `images[]` (files) | `201` `PostView` |
| GET | `/posts/:id` | optional | — | `200` `PostView` |
| GET | `/posts?authorId=&page=&limit=` | optional | — | `200` `PostView[]` + `meta` |
| PATCH | `/posts/:id` | required (owner) | `application/json`: `content?`, `privacy?`, `category?` | `200` `PostView` |
| DELETE | `/posts/:id` | required (owner) | — | `200` `MessageResponse` |

Validation/error conventions follow the existing modules: `validateBody` /
`validateQuery` (whitelisted DTOs) → `422`; missing/invalid token → `401`;
not-owner on edit/delete → `403`; missing post → `404`. All responses use the
standard `{ success, data, message?, meta? }` envelope.

Notes:
- On `POST`, `multer` runs **before** `validateBody` so text fields land on
  `req.body` and files on `req.files`.
- A create must contain **at least one of** `content` or one image (enforced in
  the service).

## 5. Visibility rules (`canView`)

For a viewer `V` and post `P` by author `A`:

1. If `V === A` → visible (owner always sees own posts).
2. Else if `A` blocked `V` or `V` blocked `A` → hidden.
3. Else by `P.privacy`:
   - `PUBLIC` → visible to anyone.
   - `FOLLOWERS` → visible only if `V` follows `A` with an **accepted** follow.
   - `ONLY_ME` → hidden (owner-only, already handled by rule 1).

Application:
- `GET /posts/:id` on a hidden post → **404** (do not leak existence).
- `GET /posts?authorId` → hidden posts are filtered out of the page.

The `Block` and follow models already exist; the profile module sets the
precedent for this filtering.

## 6. File layout

```
src/modules/post/
  post.routes.ts          routes + guards + multer + validate + OpenAPI JSDoc
  post.controller.ts      thin handlers (req.user.sub, sendSuccess)
  post.service.ts         create/update/delete/getById/listByAuthor,
                          hashtag reconcile, visibility, view-mapping
  post.repository.ts      Prisma access (mirrors profile.repository.ts)
  post.types.ts           PostView, PostMediaView
  dto/
    create-post.dto.ts    content?, privacy?, category?
    update-post.dto.ts    content?, privacy?, category?  (≥1 present)
    list-posts.dto.ts     authorId (uuid, required), page, limit
  post.service.spec.ts
  post.routes.spec.ts
  dto/*.spec.ts

src/common/storage/
  storage.service.ts      uploadImage(buffer, mimetype, userId) -> public URL,
                          deleteImages(urls) for cleanup on delete
  storage.service.spec.ts
  __mocks__/storage.service.ts   jest manual mock (mirrors config/__mocks__)

src/common/middleware/
  upload.middleware.ts    multer memoryStorage, image-only fileFilter,
                          5 MB/file, max 10 files
```

Also:
- Register `postRouter` in `src/routes/index.ts` (`router.use('/posts', postRouter)`).
- Add `Post` tag + `PostView` / `PostMediaView` schemas (and the multipart
  request body) in `src/config/swagger.config.ts`.
- Add deps: `multer` (`^2`, Express-5 compatible) + `@types/multer`.

## 7. Storage helper

`storage.service.ts` wraps `supabaseAdmin.storage.from('post-media')` so the
upload boundary can be mocked in tests:

- `uploadImage(buffer, mimetype, userId)`: derive an object path
  (`<userId>/<uuid>.<ext>`), upload bytes with the service-role client, return
  `getPublicUrl(path).publicUrl`.
- `deleteImages(urls)`: map stored public URLs back to object paths and remove
  them (best-effort on post delete).

The bucket name comes from config (`SUPABASE_POST_MEDIA_BUCKET`, default
`post-media`). The bucket is created (public) as part of this work via the
Supabase MCP.

## 8. TDD plan

Infra first (not business logic): add deps → add `PostMedia` to schema →
generate migration + client → create `post-media` public bucket. Then
**red → green → refactor** per unit, tests written first:

1. **DTO specs** — create/update/list validation (via `test/helpers/validate-dto.ts`).
2. **storage.service.spec** — mock `supabaseAdmin.storage`; assert upload path
   + returned public URL; assert delete maps URL→path.
3. **post.service.spec** — mock repository + storage:
   create (text-only / with photos / hashtag extraction / postType inference),
   getById (each visibility branch + block + 404),
   listByAuthor (pagination + filtering),
   update (owner check, 403/404, hashtag re-reconcile),
   delete (owner check, image cleanup).
4. **post.routes.spec** — supertest, mock service + guard (mirrors
   `profile.routes.spec.ts`): status codes, multipart handling, `422`, `401`,
   `403`, `404`.

`npm test` green at each step.

## 9. Risks / assumptions

- **multer + Express 5**: use `multer@^2`; verify at install.
- **Migration** runs against the real Supabase DB via `DATABASE_DIRECT_URL`;
  needs DB connectivity (same as prior migrations).
- **Public bucket**: anyone with a stored URL can view the image — matches the
  "public URLs" decision.
- **Edit excludes photos** and **hidden single-post → 404** are deliberate
  design choices, approved.
