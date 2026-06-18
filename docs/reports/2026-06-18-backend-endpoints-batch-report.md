# Branch Report — `feat/backend-endpoints-batch`

**Date:** 2026-06-18
**Branch:** `feat/backend-endpoints-batch` (pushed to `origin`, tracking set)
**Base (merge-base with `main`):** `5a8613a`
**Head:** `932d841`
**Status:** ✅ All tests green (321 / 63 suites), production typecheck clean. Not yet merged into `main`.

---

## 1. Executive summary

This branch ships the FE-driven backend endpoints (everything except Stories) across **7 loosely-coupled subsystems**: notifications activation, saved items, memories, activity log, contacts sync, settings/security, and support. Each is a self-contained module under `src/modules/<name>/` following the established `routes → controller → service → repository → types + dto` shape (standalone `export async function`s, consumed via `import * as x`).

Cross-cutting side-effects (notification emission, activity logging) are fired from the engagement/post/profile flows wrapped in a `bestEffort()` helper, so a side-effect failure never breaks the core action.

**Footprint of the batch** (`a2891c2..HEAD`): **97 files changed, +3,601 / −16**, 2 schema migrations, 7 module directories touched/created.

On top of the feature batch, this session added a **code review**, a **production-affecting bug fix** (finding #1), and a **cleanup pass** (`/simplify`). Those are detailed in §5.

---

## 2. Endpoint reference (complete brief)

**Conventions.** All paths are under `/api/v1` and mounted in `src/routes/index.ts` (`c027bac`). Every endpoint below requires the `supabaseAuthGuard` (Bearer access token) unless stated otherwise; on a missing/invalid token they return **401**. Success responses use the `sendSuccess` envelope `{ success: true, data, message?, meta? }`; list endpoints add `meta` (`PaginationMeta`) and accept `page` (default 1) / `limit` (default 20, max 100). Body/query validation failures return **422**. `[batch]` marks endpoints added by this branch; unmarked settings routes pre-date it and are listed for completeness.

### 2.1 Notifications — mounted at `/notifications`
Scoped to the current user as recipient. Notifications are not created via an endpoint — they are emitted best-effort from engagement/follow flows (§2.8) through `emitNotification`, gated by the recipient's preferences (§2.2).

- **`GET /notifications`** — List the user's notifications, newest first, paginated. Each item is enriched with a batched `entityPreview` (post thumbnail/snippet) via `fetchPostPreviews`. → `NotificationView[]` + `meta`. Query: `page`, `limit`.
- **`GET /notifications/unread-count`** — Unread badge count. → `{ count }`.
- **`PATCH /notifications/read-all`** — Mark all the user's notifications read. → message.
- **`DELETE /notifications`** — Clear (delete) all the user's notifications. → message.
- **`PATCH /notifications/:id/read`** — Mark one notification read. Path `id` (uuid). → updated `NotificationView`. Errors: 400 malformed id, 404 not found / not caller's.
- **`DELETE /notifications/:id`** — Delete one notification. Path `id` (uuid). → message. Errors: 400, 404.

### 2.2 Settings — mounted at `/settings`
- **`PUT /settings/password`** — Change password; requires the current password for re-auth. Body `ChangePasswordRequest`. → message. Errors: 401 wrong current password.
- **`PUT /settings/email`** — Start an email change; sends a 6-digit code to the new address (not applied until verified). Body `ChangeEmailRequest`. → `{ message, pendingEmail }`. Errors: 409 email already in use.
- **`PUT /settings/email/verify`** — Confirm the email change with the 6-digit code. Body `VerifyOtpRequest`. → message. Errors: 400 invalid/expired code.
- **`PUT /settings/phone`** — Start a phone change; sends a 6-digit code to the new number (not applied until verified). Body `ChangePhoneRequest` (`newPhone`). → `{ message, pendingPhone }` (masked). **Normalizes the number before storing `pendingPhone` and rejects un-normalizable input** (the §5.2 fix). Errors: 422.
- **`PUT /settings/phone/verify`** — Confirm the phone change with the 6-digit code; promotes the already-normalized `pendingPhone` → `phone`. Body `VerifyOtpRequest`. → message. Errors: 400 invalid/expired code.
- **`GET /settings/account`** — Account information. → `AccountInfoView`.
- **`GET /settings/security`** — Security overview: 2FA status, active-session count, last-login details. → `SecurityOverviewView`.
- **`GET /settings/privacy`** — Current privacy settings. → `PrivacySettingsView`.
- **`PUT /settings/privacy/posts`** — Set default post visibility. Body `UpdatePostPrivacyRequest`. → updated `PrivacySettingsView`.
- **`PUT /settings/privacy/messages`** — Set who may send direct messages. Body `UpdateMessagePrivacyRequest`. → updated `PrivacySettingsView`.
- **`GET /settings/sessions`** — List active sessions (current session flagged). → `SessionView[]`.
- **`DELETE /settings/sessions/:sessionId`** — Revoke a session (sign out a device). Path `sessionId` (uuid). → message. Errors: 404 session not found.
- **`GET /settings/notifications`** `[batch]` — Current notification preferences + channels. → preferences object.
- **`PUT /settings/notifications`** `[batch]` — Update notification preferences. Body `UpdateNotificationPreferencesDto` (`{ preferences, channels }`). → updated preferences.
- **`POST /settings/two-factor/enable`** `[batch]` — Begin SMS 2FA enrollment; sends a code to the verified phone. → message. Errors: 400 no verified phone on file, 409 2FA already enabled.
- **`POST /settings/two-factor/verify`** `[batch]` — Confirm SMS 2FA enrollment. Body `VerifyTwoFactorDto` (code). → message. Errors: 400 invalid/expired code.
- **`DELETE /settings/two-factor`** `[batch]` — Disable 2FA; requires the password. Body `DisableTwoFactorDto`. → message. Errors: 401 incorrect password.
- **`GET /settings/login-alerts`** `[batch]` — Login-alert flag + recent logins. → `{ enabled, recentLogins }`.
- **`PUT /settings/login-alerts`** `[batch]` — Toggle login alerts. Body `UpdateLoginAlertsDto`. → updated flag.
- **`DELETE /settings/account`** `[batch]` — Schedule account deletion (soft delete, 30-day grace); requires the password, bans the auth user, and marks the profile for purge. Body `DeleteAccountDto`. → message. Errors: 401 incorrect password. *(Purge executed by the scheduled `purge-deleted-accounts` job.)*

### 2.3 Saved — mounted at `/saved` `[batch — new module]`
- **`POST /saved/collections`** — Create a collection. Body `{ name (required), description? }`. → 201 created collection. Errors: 409 a collection with this name already exists.
- **`GET /saved/collections`** — List the user's collections with item counts. → collections[].
- **`POST /saved`** — Save a post, video, or link. Body `{ type: POST|VIDEO|LINK (required), postId?, linkUrl?, linkTitle?, linkThumbnailUrl?, collectionId? }`. → 201 saved item. Errors: 404 post/collection not found, 409 post already saved.
- **`GET /saved`** — List saved items, paginated. Query `type` (post|video|link), `collection` (uuid), `page`. → items[] + meta.
- **`DELETE /saved/:id`** — Remove a saved item. Path `id` (uuid). → message. Errors: 404 saved item not found.

### 2.4 Memories — mounted at `/memories` `[batch — new module]`
- **`GET /memories`** — "On this day": the user's past posts from this calendar day. Query `date` (MM-DD; defaults to today, UTC). → posts[]. Errors: 422 `date` not a valid MM-DD.

### 2.5 Activity log — mounted at `/activity-log` `[batch — new module]`
- **`GET /activity-log`** — The user's activity log, paginated. Query `type` (`posts|liked|comments|shares|follows|watched-videos`), `page`. → activity items[] + meta. *(Entries are written best-effort from engagement/post/profile flows.)*

### 2.6 Contacts — mounted at `/contacts` `[batch — new module]`
- **`POST /contacts/sync`** — Upload phone contacts and find matching registered users. Body `{ contacts: [{ phone (required), name? }] }` (max 1000). Phones are normalized via the shared `normalizePhone` and matched against verified phone numbers; matched users are added as contacts. → `{ syncedCount, matchedCount, matches[] }`. *(The §5.2 fix is what makes these matches actually resolve.)*

### 2.7 Support — mounted at `/support` `[batch — new module]`
- **`POST /support/reports`** — File a support report. Body `{ description (required, 1–1000 chars), subject? (≤200), category? (≤50) }`. → created `SupportReportView` (`id, subject, category, description, status, adminResponse, createdAt, updatedAt`).
- **`GET /support/inbox`** — List the user's own reports, paginated. → reports[] + meta.

### 2.8 Engagement emitters — mounted at `/posts` (notification + activity source)
These routes pre-date the batch; the batch wired **best-effort notification + activity emission** into them (`3f07524`, `2fdbb6f`). The behaviors the batch added:
- **`POST /posts/:postId/like`** — emits a *like* notification to the post owner.
- **`POST /posts/:postId/comments`** — emits a *comment* notification, and parses `@mentions` (casing preserved) into *mention* notifications.
- **`POST /posts/:postId/share`** — emits a *share* notification and records the share for the activity log.
*(Unchanged siblings on the same router: `DELETE /posts/:postId/like`, `GET /posts/:postId/likes`, `GET /posts/:postId/comments`, `DELETE /posts/:postId/comments/:id`, `POST /posts/:postId/comments/:id/like`.)*

---

## 3. Database changes

Two hand-authored SQL migrations (per project memory: `prisma migrate dev` fails on Supabase's `auth` schema shadow-DB, so migrations are authored as SQL folders + `migrate deploy`):

- **`20260617130000_extend_notification_type`** — extends the notification type enum for the new emitters (like / comment / share / mention).
- **`20260617130100_add_endpoints_batch`** — the consolidated schema for saved items & collections, memories support, activity log, support reports, and 2FA / account-settings columns.

New app tables get `ENABLE ROW LEVEL SECURITY` with no policies (deny-all; Prisma's privileged role bypasses RLS). PKs are `@default(uuid()) @db.Uuid` with a DB-side `gen_random_uuid()` backstop; timestamps `@db.Timestamptz(6)`; tables `@@map`-ped to snake_case.

---

## 4. Cross-cutting infrastructure

- **`common/utils/side-effect.util.ts` — `bestEffort(label, fn)`**: wraps notification/activity writes at the call site so a failed side-effect logs and swallows rather than throwing out of the core action. Tests assert the core action still succeeds when the side-effect rejects.
- **`common/utils/post-preview.util.ts` — `fetchPostPreviews(postIds)`**: batched `Map<postId, PostPreview>` lookup shared by the notification enrichment and the activity log (avoids N+1 per-item fetches).
- **`engagement/mention.util.ts` — `parseMentions`**: extracts `@username` mentions (casing preserved) to drive mention notifications.

---

## 5. This session's work — review, fix, cleanup

### 5.1 Code review of the branch
Reviewed the genuinely-new batch (`a2891c2..HEAD`), treating subagent findings as leads and reading the actual code before reporting. Outcome:

- **One production-affecting bug (finding #1)** — fixed (see §5.2).
- **Calibrated-down observations** — e.g. the agents flagged the new 2FA verify endpoint as a brute-force "Critical"; on reading, that endpoint only gates *enrollment*, so it was downgraded to Medium. An email/phone re-auth gap was traced to **pre-existing commit `885e995`** (predates this branch) and ruled out of scope.
- Lower-severity notes (e.g. unconditional `PostShare` insert, `createSavedItem` not catching `P2002`) were recorded as observations, not changed — out of the "fix #1 only" scope.

### 5.2 Fix — finding #1: contacts phone-normalization mismatch (commit `932d841`)
**Bug:** `contacts.syncContacts` queries accounts by **normalized** phone (via `normalizePhone`), but `settings.changePhone` stored the **raw** user-entered string. A user who entered a formatted number (e.g. `+1 (555) 999-8888`) was stored verbatim and never matched by contact sync — the new discovery feature silently failed for them.

**Fix (normalize-on-write, single shared contract):**
- Promoted `normalizePhone` from `modules/contacts/phone.util.ts` → **`common/utils/phone.util.ts`** so the phone *writer* (settings) and *reader* (contacts) share one normalizer and can't drift apart again.
- `settings.changePhone` now normalizes before storing `pendingPhone`, and rejects un-normalizable input with `BadRequestError`. `verifyPhoneChange` needed no change — it promotes the already-canonical `pendingPhone` to `phone`.
- Added 3 tests: normalizes on store, rejects invalid, treats a reformatted current number as unchanged.

### 5.3 Cleanup — `/simplify` pass (folded into commit `932d841`)
Ran four cleanup lenses (reuse / simplification / efficiency / altitude). Every actionable finding was ground-checked against the real codebase; most were false positives (e.g. "remove the `if (!normalizedPhone)` guard" — the guard catches inputs the DTO's `MinLength(7)`-on-characters permits but `normalizePhone`'s digit-count bounds reject). **One real item applied:** deleted the vestigial `common/utils/index.ts` barrel — it re-exported only 3 of ~7 utils and nothing imported through it (every consumer uses direct paths), so it was a misleading false signal.

---

## 6. Verification

- **Tests:** `npx jest` → **63 suites / 321 tests, all passing.**
- **Typecheck:** `npx tsc -p tsconfig.build.json --noEmit` → clean. *(Note: the build config is required — a bare `tsc --noEmit` falsely flags spec files.)*
- Side-effect best-effort behavior is covered by tests asserting the core action survives a rejected side-effect.

---

## 7. Commit history (this branch, ahead of `main`)

```
932d841  fix(contacts): normalize phone on write so contact matching finds accounts   ← this session
c027bac  feat(routes): mount saved, memories, activity-log, contacts, and support routers
5f19699  feat(settings): add soft-delete account endpoint, guard enforcement, and purge job
3698bdc  feat(settings): add login-alerts preference endpoints
9d21ac7  feat(settings): add SMS two-factor enrollment endpoints
08c4104  feat(support): add support reports and inbox endpoints
6a834c7  feat(contacts): add phone contact sync endpoint
bd65022  feat(memories): add on-this-day memories endpoint
90c3976  feat(saved): add saved items and collections endpoints
2fdbb6f  feat(activity-log): add activity log module and event writers
6447cbd  feat(settings): add GET/PUT /settings/notifications preferences endpoints
3f07524  feat(engagement): emit like/comment/share/mention notifications (best-effort)
22f0fbd  feat(notification): enrich GET /notifications with batched entityPreview
62a0b5b  feat(notification): add preference gating, emitNotification, prefs views
b7b726a  feat(common): add bestEffort + fetchPostPreviews shared utils
100688d  feat(db): add saved/memories/activity/support/2FA schema + extend notification types
```

---

## 8. Open items / follow-ups

1. **Phone backfill (operational).** The §5.2 fix normalizes *future* writes only. Any existing `user_account_settings.phone` rows written before the fix still hold un-normalized values and won't match contact sync until rewritten. If the table holds real verified phones, a one-time backfill (`normalizePhone` over existing values) is needed. Not yet written — touches live data.
2. **Calibrated review notes (not bugs, not yet actioned):** unconditional `PostShare` insert (no `@@unique`), `createSavedItem` lacking a `P2002` catch. Decide whether to harden or leave.
3. **Pre-existing, out of scope:** email/phone change re-auth gap (commit `885e995`) — flagged for awareness, not part of this branch.
4. **Merge decision pending:** branch is pushed but not merged. Options: open a PR, merge to `main` locally, or keep as-is.

---

## 9. Reviewing & merging

- Open a PR: `https://github.com/arsu2026/arsu-mobile-app-backend/pull/new/feat/backend-endpoints-batch`
- The two planning artifacts (`docs/superpowers/plans/2026-06-17-backend-endpoints-batch.md`, `docs/superpowers/specs/2026-06-17-backend-endpoints-batch-design.md`) remain intentionally **uncommitted** and describe the original goal/spec if a reviewer wants the design rationale.
