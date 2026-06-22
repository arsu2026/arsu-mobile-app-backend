# Friend-Request Presence & Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Flutter `friends` feature to the existing follow endpoints, and add the one genuinely-missing capability — user presence (`isOnline`/`lastSeen`) plus a `mutualFriends` count on the follow-requests list — surfaced only on the friend cards (requests + suggestions).

**Architecture:** No new module. The follow/request/suggestions endpoints already exist in the `profile` module and are reused unchanged. We add a nullable `Profile.lastActiveAt` column, a `POST /profile/me/heartbeat` endpoint that stamps it, and derive `isOnline`/`lastSeen` when mapping the follow-request and suggestion user objects. The existing suggestions ranking algorithm is left intact; only its emitted user objects gain presence fields.

**Tech Stack:** Node.js, Express 5, TypeScript, Prisma (Supabase Postgres), Jest + supertest. Response envelope via `sendSuccess`; auth via `supabaseAuthGuard` (`req.user.sub`).

---

## Context the implementer needs

- **Module layout:** `src/modules/profile/` holds `profile.{types,repository,service,controller,routes}.ts` plus `profile.{service,routes}.spec.ts`.
- **Response envelope:** `sendSuccess(res, data, { message?, statusCode?, meta? })` from `src/common/utils/response.util`.
- **Auth:** `supabaseAuthGuard` sets `req.user.sub`. Controllers read it via the local `requireUserId(req)` helper already in `profile.controller.ts`.
- **Build check:** `npx tsc -p tsconfig.build.json --noEmit` (the bare `tsc` reports false `jest`/`describe` errors on spec files — use the build config).
- **Tests:** `npx jest src/modules/profile` runs both profile specs. The repository is auto-mocked via `jest.mock('./profile.repository')`, so new repo functions just need to exist to be mockable.
- **Migrations:** `prisma migrate dev` is BROKEN here (Supabase auth-schema shadow DB, error P3006). Use the datamodel-diff + `migrate deploy` recipe in Task 1 exactly.
- **"Mutual friends" definition (requests list):** count of accounts the caller follows (ACCEPTED) who also follow the requester (ACCEPTED).
- **Online threshold:** 2 minutes (`ONLINE_THRESHOLD_MS = 2 * 60 * 1000`).

---

## Task 1: Add `Profile.lastActiveAt` column + migration

**Files:**
- Modify: `prisma/schema.prisma` (Profile model, after `updatedAt` at line 138)
- Create: `prisma/migrations/<timestamp>_add_profile_last_active_at/migration.sql`

- [ ] **Step 1: Capture the pre-change schema** (needed for the diff; do this BEFORE editing)

Run:
```bash
git show HEAD:prisma/schema.prisma > /tmp/old_schema.prisma
```

- [ ] **Step 2: Add the column to the Profile model**

In `prisma/schema.prisma`, inside `model Profile { ... }`, add the field immediately after the `updatedAt` line:

```prisma
  updatedAt          DateTime            @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  lastActiveAt       DateTime?           @map("last_active_at") @db.Timestamptz(6)
```

- [ ] **Step 3: Generate the migration SQL from the datamodel diff (no DB, no shadow DB)**

Run:
```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_profile_last_active_at"
npx prisma migrate diff \
  --from-schema-datamodel /tmp/old_schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_add_profile_last_active_at/migration.sql"
echo "Wrote prisma/migrations/${TS}_add_profile_last_active_at/migration.sql"
```

- [ ] **Step 4: Inspect the generated SQL**

Run: `cat prisma/migrations/*_add_profile_last_active_at/migration.sql`
Expected: exactly one statement, nothing touching other tables:
```sql
ALTER TABLE "profiles" ADD COLUMN "last_active_at" TIMESTAMPTZ;
```
If it contains anything else (drift to other tables), STOP and report — do not deploy.

- [ ] **Step 5: Apply the migration and regenerate the client**

Run:
```bash
npx prisma migrate deploy
npx prisma generate
```
Expected: `migrate deploy` reports the new migration applied; `generate` succeeds.

- [ ] **Step 6: Verify the type is available**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no output (clean). `prisma.profile` now knows `lastActiveAt`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(profile): add lastActiveAt column for presence

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add presence-aware types

**Files:**
- Modify: `src/modules/profile/profile.types.ts:71-80` (`FollowRequestView`, `UserSuggestion`)

- [ ] **Step 1: Add `FriendCardUser` and update the two view types**

In `src/modules/profile/profile.types.ts`, replace the existing `FollowRequestView` and `UserSuggestion` blocks (lines 71–80) with:

```ts
export interface FriendCardUser extends BasicUserInfo {
  isOnline: boolean;
  lastSeen: string | null;
}

export interface FollowRequestView {
  requester: FriendCardUser;
  mutualFriends: number;
  requestedAt: string;
}

export interface UserSuggestion {
  user: FriendCardUser;
  mutualCount: number;
  reason: 'mutual_followers' | 'contacts' | 'location';
}
```

- [ ] **Step 2: Verify it compiles (expect downstream errors next, that's fine)**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: errors ONLY in `profile.service.ts` (getFollowRequests/getSuggestions don't yet supply the new fields). These are fixed in Task 4. No errors in `profile.types.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/modules/profile/profile.types.ts
git commit -m "feat(profile): add FriendCardUser presence type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add repository functions

**Files:**
- Modify: `src/modules/profile/profile.repository.ts` (`basicUserSelect` at lines 5-10; append two functions)

- [ ] **Step 1: Add `lastActiveAt` to `basicUserSelect`**

In `src/modules/profile/profile.repository.ts`, replace the `basicUserSelect` block (lines 5–10) with:

```ts
const basicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  lastActiveAt: true,
} satisfies Prisma.ProfileSelect;
```

This only adds a fetched column; response shapes stay controlled by the mappers, so followers/following/blocked/search responses are unchanged.

- [ ] **Step 2: Append the heartbeat-write and mutual-count helpers**

At the END of `src/modules/profile/profile.repository.ts`, append:

```ts
export async function touchLastActive(userId: string) {
  return prisma.profile.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
    select: { lastActiveAt: true },
  });
}

/**
 * For each id in `otherIds`, counts how many accounts the viewer follows
 * (ACCEPTED) also follow that user (ACCEPTED) — the "followed by N people you
 * follow" metric. Returns a map keyed by the other user's id.
 */
export async function countMutualFollows(
  viewerId: string,
  otherIds: string[],
): Promise<Map<string, number>> {
  if (otherIds.length === 0) return new Map();

  const myFollowing = await prisma.follow.findMany({
    where: { followerId: viewerId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = myFollowing.map((f) => f.followingId);
  if (followingIds.length === 0) return new Map();

  const groups = await prisma.follow.groupBy({
    by: ['followingId'],
    where: {
      followerId: { in: followingIds },
      followingId: { in: otherIds },
      status: 'ACCEPTED',
    },
    _count: { followingId: true },
  });

  return new Map(groups.map((g) => [g.followingId, g._count.followingId]));
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: still only the `profile.service.ts` errors from Task 2 (fixed next). No new errors in the repository file.

- [ ] **Step 4: Commit**

```bash
git add src/modules/profile/profile.repository.ts
git commit -m "feat(profile): add touchLastActive and countMutualFollows repo helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Service — presence helpers, heartbeat, and enriched requests/suggestions (TDD)

**Files:**
- Test: `src/modules/profile/profile.service.spec.ts` (append tests + mocks)
- Modify: `src/modules/profile/profile.service.ts`

- [ ] **Step 1: Write the failing tests**

In `src/modules/profile/profile.service.spec.ts`:

(a) Add these mock handles after the existing `mockFindBlock` line (after line 28):

```ts
const mockTouchLastActive = repo.touchLastActive as jest.Mock;
const mockListPendingFollowRequests = repo.listPendingFollowRequests as jest.Mock;
const mockFindFollowingIds = repo.findFollowingIds as jest.Mock;
const mockCountMutualFollows = repo.countMutualFollows as jest.Mock;
const mockFindBlockedUserIds = repo.findBlockedUserIds as jest.Mock;
const mockFindSecondDegreeConnections = repo.findSecondDegreeConnections as jest.Mock;
const mockFindProfilesByIds = repo.findProfilesByIds as jest.Mock;
const mockFindContactSuggestions = repo.findContactSuggestions as jest.Mock;
const mockFindLocationSuggestions = repo.findLocationSuggestions as jest.Mock;
```

(b) Extend the imports from `./profile.service` (lines 9–14) to also pull the new/used functions:

```ts
import {
  followUser,
  getProfile,
  updateProfile,
  blockUser,
  recordHeartbeat,
  getFollowRequests,
  getSuggestions,
} from './profile.service';
```

(c) Add these `describe` blocks INSIDE the top-level `describe('profile.service', ...)` (e.g. before its closing `});` on line 148):

```ts
  describe('recordHeartbeat', () => {
    it('stamps last active and reports the user online', async () => {
      const now = new Date('2026-06-16T12:00:00.000Z');
      mockTouchLastActive.mockResolvedValue({ lastActiveAt: now });

      const result = await recordHeartbeat(USER_A);

      expect(mockTouchLastActive).toHaveBeenCalledWith(USER_A);
      expect(result).toEqual({ lastActiveAt: now.toISOString(), isOnline: true });
    });
  });

  describe('getFollowRequests', () => {
    const requestRow = (lastActiveAt: Date | null) => ({
      follower: {
        id: USER_B,
        username: 'jane',
        fullName: 'Jane Doe',
        avatarUrl: null,
        lastActiveAt,
      },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
    });

    it('enriches requests with mutualFriends and online presence', async () => {
      mockListPendingFollowRequests.mockResolvedValue([requestRow(new Date())]);
      mockFindFollowingIds.mockResolvedValue([]);
      mockCountMutualFollows.mockResolvedValue(new Map([[USER_B, 3]]));

      const result = await getFollowRequests(USER_A);

      expect(result[0].mutualFriends).toBe(3);
      expect(result[0].requester.isOnline).toBe(true);
      expect(result[0].requester.lastSeen).not.toBeNull();
      expect(result[0].requestedAt).toBe('2026-06-16T10:00:00.000Z');
      expect(result[0].requester).not.toHaveProperty('lastActiveAt');
    });

    it('marks a stale or missing lastActiveAt as offline with zero mutuals', async () => {
      const stale = new Date(Date.now() - 10 * 60 * 1000);
      mockListPendingFollowRequests.mockResolvedValue([requestRow(stale)]);
      mockFindFollowingIds.mockResolvedValue([]);
      mockCountMutualFollows.mockResolvedValue(new Map());

      const result = await getFollowRequests(USER_A);

      expect(result[0].requester.isOnline).toBe(false);
      expect(result[0].mutualFriends).toBe(0);
    });
  });

  describe('getSuggestions presence', () => {
    it('attaches presence to suggested users and never leaks lastActiveAt', async () => {
      const recent = new Date();
      mockFindProfileById.mockResolvedValue({ ...baseProfile, id: USER_A, location: null });
      mockFindBlockedUserIds.mockResolvedValue([]);
      mockFindSecondDegreeConnections.mockResolvedValue([
        { followerId: USER_B, followingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      ]);
      mockFindProfilesByIds.mockResolvedValue([
        { id: USER_B, username: 'jane', fullName: 'Jane Doe', avatarUrl: null, lastActiveAt: recent },
      ]);
      mockFindContactSuggestions.mockResolvedValue([]);
      mockFindLocationSuggestions.mockResolvedValue([]);
      mockFindFollowingIds.mockResolvedValue([]);

      const result = await getSuggestions(USER_A);

      expect(result[0].user.id).toBe(USER_B);
      expect(result[0].mutualCount).toBe(1);
      expect(result[0].reason).toBe('mutual_followers');
      expect(result[0].user.isOnline).toBe(true);
      expect(result[0].user.lastSeen).toBe(recent.toISOString());
      expect(result[0].user).not.toHaveProperty('lastActiveAt');
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/modules/profile/profile.service.spec.ts -t "recordHeartbeat|getFollowRequests|getSuggestions presence"`
Expected: FAIL — `recordHeartbeat is not a function` / enrichment assertions fail (presence + mutualFriends not yet emitted).

- [ ] **Step 3: Add the presence helpers near the top of the service**

In `src/modules/profile/profile.service.ts`, immediately after the `assertValidUserId` function (after line 31), add:

```ts
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function toPresence(lastActiveAt: Date | null): { isOnline: boolean; lastSeen: string | null } {
  if (!lastActiveAt) return { isOnline: false, lastSeen: null };
  return {
    isOnline: Date.now() - lastActiveAt.getTime() < ONLINE_THRESHOLD_MS,
    lastSeen: lastActiveAt.toISOString(),
  };
}

function toFriendCardUser(
  user: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    lastActiveAt: Date | null;
  },
  isFollowing: boolean,
): FriendCardUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isFollowing,
    ...toPresence(user.lastActiveAt),
  };
}
```

- [ ] **Step 4: Import `FriendCardUser`**

In `src/modules/profile/profile.service.ts`, add `FriendCardUser` to the type import block (lines 11–22):

```ts
import type {
  BasicUserInfo,
  FollowRequestView,
  FriendCardUser,
  PostView,
  PrivacySettingsView,
  ProfileIntro,
  ProfileView,
  UpdateIntroInput,
  UpdatePrivacyInput,
  UpdateProfileInput,
  UserSuggestion,
} from './profile.types';
```

- [ ] **Step 5: Add `recordHeartbeat`**

Append to `src/modules/profile/profile.service.ts` (end of file):

```ts
export async function recordHeartbeat(
  userId: string,
): Promise<{ lastActiveAt: string; isOnline: true }> {
  const { lastActiveAt } = await repo.touchLastActive(userId);
  return { lastActiveAt: lastActiveAt.toISOString(), isOnline: true };
}
```

- [ ] **Step 6: Replace `getFollowRequests` with the enriched version**

Replace the existing `getFollowRequests` (lines 429–437) with:

```ts
export async function getFollowRequests(ownerId: string): Promise<FollowRequestView[]> {
  const rows = await repo.listPendingFollowRequests(ownerId);
  const requesterIds = rows.map((r) => r.follower.id);

  const [followingIds, mutualMap] = await Promise.all([
    repo.findFollowingIds(ownerId, requesterIds),
    repo.countMutualFollows(ownerId, requesterIds),
  ]);

  return rows.map((row) => ({
    requester: toFriendCardUser(row.follower, followingIds.includes(row.follower.id)),
    mutualFriends: mutualMap.get(row.follower.id) ?? 0,
    requestedAt: row.createdAt.toISOString(),
  }));
}
```

- [ ] **Step 7: Make `getSuggestions` emit `FriendCardUser`**

In `getSuggestions` (lines 499–578), change the three suggestion-construction sites to build presence-aware users via `toFriendCardUser`:

Replace `user: { ...user, isFollowing: false },` (mutual_followers branch) with:
```ts
        user: toFriendCardUser(user, false),
```

Replace `user: { ...contact.contactUser, isFollowing: false },` (contacts branch) with:
```ts
        user: toFriendCardUser(contact.contactUser, false),
```

Replace `user: { ...match, isFollowing: false },` (location branch) with:
```ts
        user: toFriendCardUser(match, false),
```

Leave the final `isFollowing` back-fill loop (lines 571–575) unchanged — it still sets `suggestion.user.isFollowing` correctly.

- [ ] **Step 8: Run the new tests to verify they pass**

Run: `npx jest src/modules/profile/profile.service.spec.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 9: Verify the whole project still type-checks**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no output (clean).

- [ ] **Step 10: Commit**

```bash
git add src/modules/profile/profile.service.ts src/modules/profile/profile.service.spec.ts
git commit -m "feat(profile): presence + mutualFriends on requests and suggestions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Controller + route for the heartbeat (TDD)

**Files:**
- Test: `src/modules/profile/profile.routes.spec.ts` (append)
- Modify: `src/modules/profile/profile.controller.ts` (append handler)
- Modify: `src/modules/profile/profile.routes.ts` (register route after line 156)

- [ ] **Step 1: Write the failing route tests**

In `src/modules/profile/profile.routes.spec.ts`:

(a) Add a mock handle after the existing `mockFindUsernameConflict` line (after line 27):

```ts
const mockTouchLastActive = repo.touchLastActive as jest.Mock;
```

(b) Append this `describe` block at the end of the file:

```ts
describe('POST /api/v1/profile/me/heartbeat', () => {
  it('updates presence for an authenticated user', async () => {
    authAs(USER_A);
    mockTouchLastActive.mockResolvedValue({ lastActiveAt: new Date('2026-06-16T12:00:00.000Z') });

    const res = await request(app)
      .post('/api/v1/profile/me/heartbeat')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isOnline).toBe(true);
    expect(mockTouchLastActive).toHaveBeenCalledWith(USER_A);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/profile/me/heartbeat');

    expect(res.status).toBe(401);
    expect(mockTouchLastActive).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/profile/profile.routes.spec.ts -t "heartbeat"`
Expected: FAIL — route returns 404 (not registered yet).

- [ ] **Step 3: Add the controller handler**

Append to `src/modules/profile/profile.controller.ts` (end of file):

```ts
export async function heartbeat(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const result = await profileService.recordHeartbeat(userId);
  sendSuccess(res, result, { message: 'Presence updated' });
}
```

- [ ] **Step 4: Register the route (static section, before `/:userId`)**

In `src/modules/profile/profile.routes.ts`, immediately after the `/follow-requests` route registration (line 156), add:

```ts

/**
 * @openapi
 * /profile/me/heartbeat:
 *   post:
 *     tags: [Profile]
 *     summary: Update the current user's presence (last-active timestamp)
 *     description: >
 *       Stamps `last_active_at = now()` for the authenticated user. The FE pings
 *       this periodically while foregrounded; `isOnline`/`lastSeen` on friend cards
 *       are derived from it.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Presence updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     lastActiveAt: { type: string, format: 'date-time' }
 *                     isOnline: { type: boolean, example: true }
 *       '401':
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/me/heartbeat', supabaseAuthGuard, profileController.heartbeat);
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `npx jest src/modules/profile/profile.routes.spec.ts`
Expected: PASS (existing + new heartbeat tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/profile/profile.controller.ts src/modules/profile/profile.routes.ts src/modules/profile/profile.routes.spec.ts
git commit -m "feat(profile): add POST /profile/me/heartbeat presence endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Update Swagger schemas

**Files:**
- Modify: `src/config/swagger.config.ts` (`FollowRequestView` at lines 359-365, `UserSuggestion` at lines 366-376; add `FriendCardUser`)

- [ ] **Step 1: Add the `FriendCardUser` schema and update the two views**

In `src/config/swagger.config.ts`, replace the `FollowRequestView` and `UserSuggestion` blocks (lines 359–376) with:

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/config/swagger.config.ts
git commit -m "docs(swagger): add FriendCardUser, presence on requests and suggestions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: FE wiring note

**Files:**
- Create: `docs/friend-request-integration.md`

- [ ] **Step 1: Write the integration note**

Create `docs/friend-request-integration.md` with:

````markdown
# Friends feature — FE → backend wiring

The Flutter `lib/features/friends` BLoC is mock today. Connect each event to the
existing backend endpoint below (base path `/api/v1`). All require the Supabase
Bearer token.

| FE BLoC event | Method & path | Notes |
| --- | --- | --- |
| `SendFriendRequest(userId)` | `POST /profile/:userId/follow` | 201; public → instant follow, private → pending request |
| `LoadFriendRequests` | `GET /profile/follow-requests` | array of `FollowRequestView` |
| `AcceptFriendRequest(friendId)` | `PUT /profile/follow-requests/:friendId/accept` | `friendId` = requester's user id |
| `RejectFriendRequest(friendId)` | `PUT /profile/follow-requests/:friendId/reject` | |
| (cancel a sent request) | `DELETE /profile/:userId/follow` | unfollow also deletes a pending request |
| `LoadFriendSuggestions` | `GET /profile/suggestions` | array of `UserSuggestion` |
| (presence ping) | `POST /profile/me/heartbeat` | call ~every 60s while foregrounded |

## Mapping the `Friend` entity

The API returns a single `fullName`, not split names, and uses follow vocabulary:

| FE `Friend` field | Source |
| --- | --- |
| `firstName` / `lastName` | split client-side from `fullName` (or show `fullName` directly) |
| `profilePicture` | `avatarUrl` |
| `mutualFriends` | `mutualFriends` (requests) / `mutualCount` (suggestions) |
| `isOnline` | `isOnline` |
| `lastSeen` | `lastSeen` (ISO timestamp; format client-side) |
| `id` | `requester.id` (requests) / `user.id` (suggestions) |

Presence (`isOnline`/`lastSeen`) is only present on the friend-request and
suggestion responses, derived from a 2-minute heartbeat window.
````

- [ ] **Step 2: Commit**

```bash
git add docs/friend-request-integration.md
git commit -m "docs: add friends feature FE-backend wiring note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no output.

- [ ] **Step 2: Full profile test suite**

Run: `npx jest src/modules/profile`
Expected: all suites pass (existing + new presence/heartbeat tests).

- [ ] **Step 3: Confirm the working tree is clean**

Run: `git status -s`
Expected: empty (everything committed across Tasks 1–7).

---

## Self-review (completed by plan author)

- **Spec coverage:** presence column (T1), types (T2), repo helpers (T3), service heartbeat + enrichment (T4), endpoint (T5), swagger (T6), FE wiring (T7) — every in-scope spec item maps to a task. Suggestions endpoint and send/accept/reject are reused, not rebuilt (no task, by design).
- **Type consistency:** `FriendCardUser`, `touchLastActive`, `countMutualFollows`, `recordHeartbeat`, `toPresence`, `toFriendCardUser`, `heartbeat` are named identically everywhere they appear; `FollowRequestView.requester`/`UserSuggestion.user` are `FriendCardUser` in both types and swagger.
- **No placeholders:** every code/test/command step contains the literal content to paste.
