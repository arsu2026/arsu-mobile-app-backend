# Friend-Request Endpoints — Design

**Date:** 2026-06-16
**Status:** Approved (design, revised after codebase audit)

## Goal

Give the Flutter `friends` feature (Friend Requests + Suggestions tabs, currently
100% mock) a real backend to talk to. The app speaks "friend" vocabulary
(Add Friend / Confirm / Delete / Suggestions); the backend is built on an
asymmetric **follow** model (`Follow` table with `PENDING`/`ACCEPTED` status).
A "friend request" is therefore a **pending follow** — the existing private-account
follow flow already implements send / list / accept / reject, **and a full
mutual-follow suggestions endpoint already exists**.

## Codebase audit — what already exists

A close read of `src/modules/profile` showed the surface is almost entirely built:

| Operation | Endpoint | Status |
| --- | --- | --- |
| Send request | `POST /profile/:userId/follow` | exists |
| List requests | `GET /profile/follow-requests` | exists → **enrich** |
| Accept request | `PUT /profile/follow-requests/:requesterId/accept` | exists |
| Reject request | `PUT /profile/follow-requests/:requesterId/reject` | exists |
| Cancel a sent request | `DELETE /profile/:userId/follow` | exists (unfollow deletes PENDING too) |
| Suggestions | `GET /profile/suggestions` | **exists** — mutual-follow ranking (`mutualCount`) + contacts + location backfill; excludes self/blocked; sets `isFollowing` |

So no new suggestions endpoint and no rebuilt request flow — building either would
duplicate working code (violates the repo's Simplicity-First / Surgical-Changes rules).

## Scope

**In scope (the genuinely missing pieces)**

- **Presence:** add `Profile.lastActiveAt`; `POST /profile/me/heartbeat` to update it;
  derive `isOnline` / `lastSeen`.
- **Surface presence on the friend cards only:** the user objects returned by
  `GET /profile/follow-requests` and `GET /profile/suggestions`. Other lists
  (followers / following / blocked / search) are left unchanged.
- **`mutualFriends` on `GET /profile/follow-requests`** (the requests list has no
  mutual count today; the suggestions list already does).
- A reusable `countMutualFollows` repository helper.
- FE→backend wiring note.
- Tests appended to the existing profile service + routes specs.

**Out of scope (reused as-is)**

- Send / list / accept / reject / cancel endpoints (above).
- The suggestions ranking algorithm and its contacts/location backfill — kept as-is,
  only its user objects gain presence fields.

**Explicitly not built**

- A separate bidirectional friendship table/model (conflicts with the follow architecture).
- Real-time presence (websockets / persistent sockets). Presence is heartbeat-based and approximate.
- Server-side `firstName`/`lastName` splitting (lossy; the FE adapts from `fullName`).
- Presence on followers / following / blocked / search responses.

## FE → Backend wiring

| FE BLoC event | Backend endpoint | Status |
| --- | --- | --- |
| `SendFriendRequest(userId)` | `POST /profile/:userId/follow` | exists |
| `LoadFriendRequests` | `GET /profile/follow-requests` | exists → enriched |
| `AcceptFriendRequest(friendId)` | `PUT /profile/follow-requests/:requesterId/accept` | exists |
| `RejectFriendRequest(friendId)` | `PUT /profile/follow-requests/:requesterId/reject` | exists |
| (cancel a sent request) | `DELETE /profile/:userId/follow` | exists |
| `LoadFriendSuggestions` | `GET /profile/suggestions` | exists |
| (presence ping) | `POST /profile/me/heartbeat` | **NEW** |

Note for the FE team: the `Friend` entity's `firstName`/`lastName` map from the
API's single `fullName`; `lastSeen`/`isOnline` come from the presence fields below;
`mutualFriends` maps from `mutualCount` (suggestions) / `mutualFriends` (requests).

## Data model

Single additive change to the `Profile` model:

```prisma
model Profile {
  // ... existing fields ...
  lastActiveAt DateTime? @map("last_active_at") @db.Timestamptz(6)
}
```

Nullable — existing profiles have no value until they first ping (correctly reads as
offline). `UserSession.lastActiveAt` is unrelated (per-device, for the security screen).

**Migration:** applied via the datamodel-diff + `migrate deploy` workaround
(`prisma migrate dev` fails against the Supabase auth schema's shadow DB).

## API

### `POST /profile/me/heartbeat` (NEW)

- **Auth:** required (`supabaseAuthGuard`).
- **Effect:** sets `profiles.last_active_at = now()` for the caller.
- **Response:** `{ lastActiveAt: string, isOnline: true }`.
- Pinged by the FE periodically (~60s) while foregrounded.

## View shapes

```ts
interface FriendCardUser extends BasicUserInfo {
  isOnline: boolean;
  lastSeen: string | null; // ISO timestamp of last_active_at, or null
}

interface FollowRequestView {
  requester: FriendCardUser;
  mutualFriends: number;
  requestedAt: string;
}

interface UserSuggestion {
  user: FriendCardUser;
  mutualCount: number;
  reason: 'mutual_followers' | 'contacts' | 'location';
}
```

`BasicUserInfo` (followers/following/blocked/search) is unchanged.

## Authorization & semantics

- Every endpoint is scoped to the authenticated caller (`req.user.sub`).
- **"Mutual friends" (requests list)** = the number of accounts the caller follows
  (ACCEPTED) who also follow the requester (ACCEPTED) — the "followed by N people you
  follow" metric. (Suggestions keep their existing `mutualCount` = shared-follower count.)
- **Presence (derived, not stored):**
  - `ONLINE_THRESHOLD_MS = 2 * 60 * 1000` (2 minutes).
  - `isOnline = lastActiveAt != null && (Date.now() - lastActiveAt) < ONLINE_THRESHOLD_MS`.
  - `lastSeen = lastActiveAt?.toISOString() ?? null`.
- Heartbeat is idempotent; repeated pings move `last_active_at` forward.

## File layout

All in the existing **profile** module. No new module.

- `prisma/schema.prisma` — add `lastActiveAt` to `Profile` (+ migration).
- `src/modules/profile/profile.types.ts` — add `FriendCardUser`; update `FollowRequestView`, `UserSuggestion`.
- `src/modules/profile/profile.repository.ts`
  - extend `basicUserSelect` with `lastActiveAt`
  - `touchLastActive(userId)` (heartbeat write)
  - `countMutualFollows(viewerId, otherIds[]) → Map<string, number>` (batched `groupBy`)
- `src/modules/profile/profile.service.ts`
  - `ONLINE_THRESHOLD_MS`, `toPresence(lastActiveAt)`, `toFriendCardUser(user, isFollowing)`
  - `recordHeartbeat(userId)`
  - enrich `getFollowRequests` (mutualFriends + presence) and `getSuggestions` (presence)
- `src/modules/profile/profile.controller.ts` — `heartbeat` handler.
- `src/modules/profile/profile.routes.ts` — `POST /me/heartbeat` (+ `@openapi` JSDoc).
- `src/config/swagger.config.ts` — add `FriendCardUser`; update `FollowRequestView`, `UserSuggestion`.

## Testing plan

Appended to the existing specs (mock repository / mock supabase):

- **profile.service.spec**: `recordHeartbeat` writes + reports online; `getFollowRequests`
  carries `mutualFriends` + presence; presence online/offline/null derivation;
  `getSuggestions` user carries `isOnline`/`lastSeen` and never leaks `lastActiveAt`.
- **profile.routes.spec**: `POST /profile/me/heartbeat` → 200 `{ isOnline: true }`; 401 without token.

## Risks

- **Migration on Supabase:** must use diff + `migrate deploy`, not `migrate dev`.
- **`groupBy` performance:** acceptable at current scale; `follows` is indexed on
  `(followerId, status)` and `(followingId, status)`.
- **Presence is best-effort:** granularity = ping interval + threshold; not live.
