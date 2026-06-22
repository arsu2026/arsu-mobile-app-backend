# Notification Module — Design Spec

_Date: 2026-06-16_
_Status: Approved (design), pending implementation plan_

## 1. Goal

Add a **Notification module** to the ARSU backend that lets the signed-in user
**read and manage** their own notifications. The notification *rows* already
exist and are already **written** by the profile module (on follow / follow
request / follow accept) — this module adds the missing **read/manage** surface:
list, unread count, mark-read (one / all), and delete (one / all).

No new notification *types* and no schema migration: the existing
`Notification` table and `NotificationType` enum (`FOLLOW`, `FOLLOW_REQUEST`,
`FOLLOW_ACCEPTED`) are used as-is.

## 2. Scope

In scope:
- List my notifications, newest-first, paginated, with the actor embedded.
- Get my unread count (cheap, for the badge).
- Mark a single notification read.
- Mark all my notifications read.
- Delete a single notification.
- Delete (clear) all my notifications.

Out of scope (explicit):
- **Creating** notifications — already done by `profile.service`
  (`followUser`, `acceptFollowRequest`). This module never writes rows for the
  follow flow.
- **Push / FCM** — the app has no Firebase integration; notifications are
  pull-only.
- **Follow-request accept/decline** — already handled by the profile module and
  the Flutter Friends page.
- New types (likes, comments, mentions, …) — no such features exist yet.

## 3. Data model

No change. The model already exists (added in migration
`20260611130000_add_profile_module`):

```prisma
model Notification {
  id          String           @id @default(uuid()) @db.Uuid
  recipientId String           @map("recipient_id") @db.Uuid
  actorId     String           @map("actor_id") @db.Uuid
  type        NotificationType
  entityId    String?          @map("entity_id") @db.Uuid
  message     String?
  isRead      Boolean          @default(false) @map("is_read")
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  // … recipient / actor relations …
  @@index([recipientId, isRead, createdAt(sort: Desc)])
  @@map("notifications")
}

enum NotificationType { FOLLOW  FOLLOW_REQUEST  FOLLOW_ACCEPTED }
```

The existing `@@index([recipientId, isRead, createdAt desc])` already covers the
two hot queries: "my notifications, newest first" and "count of my unread".

## 4. API

Mounted at `/api/v1/notifications`. **Every** endpoint requires
`supabaseAuthGuard`; the user is always scoped as the **recipient**
(`recipientId = req.user.sub`).

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/notifications?page=&limit=` | — | `200` `NotificationView[]` + `meta` |
| GET | `/notifications/unread-count` | — | `200` `{ count: number }` |
| PATCH | `/notifications/read-all` | — | `200` `MessageResponse` |
| DELETE | `/notifications` | — | `200` `MessageResponse` |
| PATCH | `/notifications/:id/read` | — | `200` `NotificationView` |
| DELETE | `/notifications/:id` | — | `200` `MessageResponse` |

**Route ordering:** static paths (`/unread-count`, `/read-all`, and the `/`
list/clear) are registered **before** the `/:id` paths, matching the
static-before-param discipline in `profile.routes.ts`.

`unread-count` is a dedicated endpoint (rather than folding the count into the
list response) so it stays consistent with the list-returns-`data[]`+`meta`
convention used by every other list endpoint, and gives the badge a cheap call
that doesn't fetch rows.

### `NotificationView`

The stored row holds only `actorId`, so the read path joins the actor's
`Profile` (reusing `basicUserSelect` from `profile.repository.ts`):

```ts
interface NotificationActor {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

interface NotificationView {
  id: string;
  type: NotificationType;   // 'FOLLOW' | 'FOLLOW_REQUEST' | 'FOLLOW_ACCEPTED'
  actor: NotificationActor; // → FE userId / userName / userAvatar
  entityId: string | null;  // the follow row id → FE deep-link / actionUrl
  message: string | null;   // e.g. "started following you"
  isRead: boolean;
  createdAt: string;        // ISO 8601 — FE derives the "5 min ago" string
}
```

This maps 1:1 onto the Flutter `NotificationModel`. The FE keeps its broader
client-side enum and maps the three backend types into it; it derives its
relative-`time` string from `createdAt`.

## 5. Authorization & semantics

- **Ownership via query scoping.** Every read and mutation filters by
  `recipientId = req.user.sub`. There is no cross-user access path.
- **Mutations use scoped `updateMany` / `deleteMany`.** Mark/delete-one runs
  `where: { id, recipientId }`; a `count === 0` result means the id either
  doesn't exist or isn't the caller's → **404** `NotFoundError`. This also
  prevents id-enumeration leaks (a foreign id is indistinguishable from a
  missing one).
- **Explicit read-marking.** Listing does **not** auto-mark read; the FE has a
  separate `MarkAsRead` action.
- **`:id` validated as UUID** in the service (`BadRequestError` on bad format),
  mirroring profile's `assertValidUserId`.
- **Pagination** parsed in the controller via the shared
  `parsePaginationParams` (page ≥ 1, limit clamped 1–100) — no query DTO, matching
  `getUserPosts` / `getUserVideos`.
- **Mark-one-read returns the updated `NotificationView`** (handy for optimistic
  UI). Mark-all-read, delete-one, and clear-all return the standard
  `{ message }`.

All responses use the standard `{ success, data, message?, meta? }` envelope via
`sendSuccess`. Errors reuse existing `UnauthorizedError` / `BadRequestError` /
`NotFoundError` and the central error handler — no new error types.

## 6. File layout

```
src/modules/notification/
  notification.routes.ts       routes + supabaseAuthGuard + OpenAPI JSDoc
  notification.controller.ts   thin handlers (requireUserId, parsePaginationParams, sendSuccess)
  notification.service.ts      list/unread-count/mark-read/mark-all/delete/clear,
                               UUID validation, row→NotificationView mapping
  notification.repository.ts   Prisma access (mirrors profile.repository.ts)
  notification.types.ts        NotificationView, NotificationActor
  notification.service.spec.ts
  notification.routes.spec.ts
```

Also:
- Register `notificationRouter` in `src/routes/index.ts`
  (`router.use('/notifications', notificationRouter)`).
- Add a `Notifications` tag + `NotificationView` schema in
  `src/config/swagger.config.ts` (matching how the Post module documents its
  views).

**Deliberately not touched:** `createNotification` stays in
`profile.repository.ts`. It works and is only called by the profile module;
relocating it would ripple into profile against the repo's "Surgical Changes"
rule. (Future: if a second writer of notifications appears, consolidate writes
into this module — noted, not done now.)

## 7. Repository functions

All Prisma access lives in `notification.repository.ts`:

- `listByRecipient(recipientId, skip, take)` → rows ordered
  `createdAt desc`, with `actor` selected via `basicUserSelect`; plus a
  `count` for pagination meta.
- `countUnread(recipientId)` → `number`.
- `findOwned(recipientId, id)` → single row (with actor) or `null` (used by
  mark-one-read to 404 then return the mapped view).
- `markRead(recipientId, id)` → `updateMany({ where: { id, recipientId, isRead: false }, … })`
  (idempotent; returns count).
- `markAllRead(recipientId)` → `updateMany({ where: { recipientId, isRead: false }, … })`.
- `deleteOne(recipientId, id)` → `deleteMany({ where: { id, recipientId } })` (count → 404).
- `deleteAll(recipientId)` → `deleteMany({ where: { recipientId } })`.

## 8. Testing plan

Mirrors the module convention (`*.service.spec.ts` + `*.routes.spec.ts`),
**TDD per unit** (red → green → refactor):

1. **notification.service.spec** — repository mocked:
   - list: maps rows → `NotificationView`, correct `meta`, empty page.
   - unread-count: returns `{ count }`.
   - mark-one-read: returns updated view; foreign/missing id → `404`;
     malformed id → `400`.
   - mark-all-read / clear-all: call scoped repo fn, return message.
   - delete-one: `404` on foreign/missing id; success message.
2. **notification.routes.spec** — supertest, service + `supabaseAuthGuard`
   mocked (mirrors `profile.routes.spec.ts`): status codes, `401` without
   token, `400` bad id, `404` not-found, pagination `meta` shape.

`npm test` green at each step.

## 9. Risks / assumptions

- **Actor profile always exists.** Notifications reference a real `actorId`
  (set by the follow flow), so the join is expected to resolve. If an actor's
  profile were ever deleted, the row would still list with a `null`-ish actor;
  acceptable, and not a current scenario.
- **Reusing `basicUserSelect`** couples the read path to a profile-module
  export. Low risk (it's a stable shape); the alternative — duplicating the
  select — was rejected as needless duplication.
- **No `markRead` on an already-read row** is a no-op (count 0 on the
  `isRead: false` filter) but the row still exists; mark-one-read therefore
  checks existence via `findOwned` first so a valid, already-read id returns
  `200` (the view) rather than a false `404`.
