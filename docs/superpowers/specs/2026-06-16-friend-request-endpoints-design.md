# Friend-Request Endpoints — Design

**Date:** 2026-06-16
**Status:** Approved (design)

## Goal

Give the Flutter `friends` feature (Friend Requests + Suggestions tabs, currently
100% mock) a real backend to talk to. The app speaks "friend" vocabulary
(Add Friend / Confirm / Delete / Suggestions); the backend is built on an
asymmetric **follow** model (`Follow` table with `PENDING`/`ACCEPTED` status).
A "friend request" is therefore a **pending follow** — the existing private-account
follow flow already implements send / list / accept / reject.

The new work is small and surgical: add the two pieces that genuinely don't exist
yet (a **suggestions** endpoint and **presence**), enrich the existing
follow-requests response with the display fields the FE card needs, and document
the FE→backend wiring.

## Scope

**In scope**

- `GET /profile/suggestions` — mutual-follow ("people you may know") suggestions.
- `POST /profile/me/heartbeat` — presence ping; updates `last_active_at`.
- Presence model: `profiles.last_active_at` column + derived `isOnline` / `lastSeen`.
- Enrich the existing `GET /profile/follow-requests` response with
  `mutualFriends`, `isOnline`, `lastSeen`.
- A reusable `countMutualFollows` repository helper.
- FE→backend wiring documentation.
- Tests (service + routes) matching the existing module test style.

**Out of scope (already exists — reused, not rebuilt)**

- Send request: `POST /profile/:userId/follow`
- Accept request: `PUT /profile/follow-requests/:requesterId/accept`
- Reject request: `PUT /profile/follow-requests/:requesterId/reject`
- Cancel a sent request: `DELETE /profile/:userId/follow` (unfollow deletes PENDING too)
- List requests: `GET /profile/follow-requests` (enriched, not replaced)

**Explicitly not built**

- A separate bidirectional friendship table/model (would conflict with the follow architecture).
- Real-time presence (websockets / persistent socket connections). Presence is heartbeat-based and approximate.
- Server-side `firstName`/`lastName` splitting (lossy; FE adapts from `fullName`).

## FE → Backend wiring

| FE BLoC event | Backend endpoint | Status |
| --- | --- | --- |
| `SendFriendRequest(userId)` | `POST /profile/:userId/follow` | exists |
| `LoadFriendRequests` | `GET /profile/follow-requests` | exists → enriched |
| `AcceptFriendRequest(friendId)` | `PUT /profile/follow-requests/:requesterId/accept` | exists |
| `RejectFriendRequest(friendId)` | `PUT /profile/follow-requests/:requesterId/reject` | exists |
| (cancel a sent request) | `DELETE /profile/:userId/follow` | exists |
| `LoadFriendSuggestions` | `GET /profile/suggestions` | **NEW** |
| (presence ping) | `POST /profile/me/heartbeat` | **NEW** |

Note for the FE team: the `Friend` entity's `firstName`/`lastName` map from the
API's single `fullName`; `lastSeen`/`isOnline` come from the presence fields below.

## Data model

Single additive change to the `Profile` model:

```prisma
model Profile {
  // ... existing fields ...
  lastActiveAt DateTime? @map("last_active_at") @db.Timestamptz(6)
}
```

No other schema changes. `Follow`, `FollowStatus`, `Notification`,
`NotificationType` are unchanged.

**Migration:** applied via the datamodel-diff + `migrate deploy` workaround
(`prisma migrate dev` fails against the Supabase auth schema's shadow DB).

## API

### `GET /profile/suggestions`

- **Auth:** required (`supabaseAuthGuard`).
- **Query:** `page` (default 1, min 1), `limit` (default 20, min 1, max 100).
- **Algorithm (mutual-follow):** candidates = accounts followed (ACCEPTED) by the
  accounts the caller follows (ACCEPTED), ranked by mutual count descending.
  Excludes: the caller, anyone the caller already follows or has a PENDING request
  to, and users blocked in either direction.
- **Backfill:** when mutual results number fewer than `limit`, top up with the
  newest profiles the caller does not follow (and is not blocked with),
  `mutualFriends: 0`, appended after the ranked results.
- **Response:** `FriendUserView[]` + pagination `meta`.

### `POST /profile/me/heartbeat`

- **Auth:** required.
- **Effect:** sets `profiles.last_active_at = now()` for the caller.
- **Response:** `{ lastActiveAt: string, isOnline: true }`.
- Intended to be pinged by the FE periodically (~60s) while foregrounded.

## View shapes

```ts
interface FriendUserView {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  mutualFriends: number;
  isOnline: boolean;
  lastSeen: string | null; // ISO timestamp of last_active_at, or null
}
```

The enriched `FollowRequestView` keeps `requestedAt` and promotes its `requester`
to a `FriendUserView` (additive fields: `mutualFriends`, `isOnline`, `lastSeen`).

## Authorization & semantics

- Every endpoint is scoped to the authenticated caller (`req.user.sub`).
- **"Mutual" — one definition everywhere:** the number of accounts the caller
  follows (ACCEPTED) who also follow the other user (ACCEPTED). This is the
  "followed by N people you follow" metric and is exactly what the suggestion
  ranking computes — reused for the requests list for consistency.
- **Presence (derived, not stored):**
  - `ONLINE_THRESHOLD_MS = 2 * 60 * 1000` (2 minutes).
  - `isOnline = lastActiveAt != null && (now - lastActiveAt) < ONLINE_THRESHOLD_MS`.
  - `lastSeen = lastActiveAt?.toISOString() ?? null`.
- Heartbeat is idempotent; repeated pings simply move `last_active_at` forward.

## File layout

Everything lives in the existing **profile** module (consistent with the
"reuse follows" decision; the data lives on `Profile`). No new module.

- `prisma/schema.prisma` — add `lastActiveAt` to `Profile` (+ migration).
- `src/modules/profile/profile.types.ts` — add `FriendUserView`; extend `FollowRequestView`.
- `src/modules/profile/profile.repository.ts`
  - extend `basicUserSelect` with `lastActiveAt`
  - `countMutualFollows(viewerId, otherIds[]) → Map<string, number>` (batched `groupBy`)
  - `listMutualFollowSuggestions(viewerId, skip, take)` (groupBy ranking + exclusions)
  - `listNewestUnfollowed(viewerId, excludeIds[], take)` (backfill)
  - `touchLastActive(userId)` (heartbeat write)
- `src/modules/profile/profile.service.ts`
  - `getSuggestions(viewerId, page, limit)` (compose ranking + backfill + presence + mutual)
  - `recordHeartbeat(userId)`
  - a small `toPresence(lastActiveAt)` helper → `{ isOnline, lastSeen }`
  - enrich `getFollowRequests` with `mutualFriends` + presence
- `src/modules/profile/profile.controller.ts` — `getSuggestions`, `heartbeat` handlers.
- `src/modules/profile/profile.routes.ts` — register the two routes (+ `@openapi` JSDoc).
- `src/config/swagger.config.ts` — add `FriendUserView` schema.

## Testing plan

- **profile.service.spec** (mock repository):
  - suggestions: maps mutual counts, applies presence, backfills when thin, excludes self.
  - heartbeat: calls `touchLastActive` with the caller id.
  - presence derivation: online within threshold, offline past it, null `lastActiveAt`.
  - follow-requests enrichment: requester carries `mutualFriends` + presence.
- **profile.routes.spec** (mock supabase + repository):
  - `GET /profile/suggestions` → 200 with array + meta; 401 without token; pagination passthrough.
  - `POST /profile/me/heartbeat` → 200 `{ isOnline: true }`; 401 without token.

## Risks

- **Migration on Supabase:** must use diff + `migrate deploy`, not `migrate dev`.
- **`groupBy` performance:** acceptable at current scale; `follows` is already
  indexed on `(followerId, status)` and `(followingId, status)`.
- **Presence is best-effort:** granularity = ping interval + threshold; not live.
- **Empty graph:** mitigated by the newest-users backfill so the Suggestions tab
  is never empty.
