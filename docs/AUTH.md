# Authentication — Team Guide

_Last updated: 2026-06-11_

This document explains how authentication works in the ARSU mobile app backend:
the architecture, every endpoint, the token model the mobile app must follow,
error handling, security decisions, configuration, testing, and the work that is
still outstanding.

---

## 1. At a glance

Auth is **fully delegated to Supabase Auth**. The backend is a thin, mediating
layer: the mobile app talks **only to this API**, never to Supabase directly.
The API calls Supabase, translates Supabase's responses into our standard
response envelope, and returns tokens to the app.

| # | Method & path | Auth required | Purpose |
|---|---------------|:------------:|---------|
| 1 | `POST /api/v1/auth/users/email/signup` | no | Register with email + password |
| 2 | `POST /api/v1/auth/users/email/login` | no | Log in, receive a session |
| 3 | `POST /api/v1/auth/users/logout` | **yes** (Bearer) | Revoke the user's sessions (all devices) |
| 4 | `POST /api/v1/auth/users/email/forgot-password` | no | Email a password-reset code |
| 5 | `POST /api/v1/auth/users/email/reset-password` | no | Reset password using the emailed code |
| 6 | `POST /api/v1/auth/users/token/refresh` | no | Trade a refresh token for a fresh session |

Base path: `/api/v1/auth` (the API prefix `api/v1` is configurable via
`API_PREFIX`). Live, interactive API docs (Swagger UI) are served at
**`/api/v1/docs`** (raw spec at `/api/v1/docs.json`).

---

## 2. Architecture & principles

```
mobile app ──HTTP──▶  Route  ─▶ validateBody(DTO) ─▶ [guard] ─▶ Controller ─▶ Service ─▶ Supabase Auth
                        │                                                          │
                        └──────────────── central error handler ◀── throws AppError ┘
```

- **Backend-mediated.** The app never holds Supabase client credentials or talks
  to Supabase directly. It calls our endpoints; we call Supabase. This is why we
  need our own `logout`, `refresh`, and password-reset endpoints — the app can't
  perform those against Supabase on its own.
- **Two Supabase clients** (`src/config/supabase.config.ts`):
  - `supabaseClient` — uses the **anon** key. Used for public user flows
    (signup, login, password reset, refresh).
  - `supabaseAdmin` — uses the **service-role** key. **Server-side only, never
    exposed to clients.** Used for privileged operations (token verification in
    the guard, session revocation, admin password update).
  - Both are configured **stateless** (`autoRefreshToken: false`,
    `persistSession: false`) because they're shared singletons reused across every
    request — they must not carry one user's session into another's request.
- **Layered, thin handlers.** Routes wire middleware; controllers are thin HTTP
  adapters that `throw` on failure (Express 5 forwards rejected promises to the
  central error handler — no `try/catch` in handlers); services hold the logic
  and translate Supabase errors. DTOs define and validate request bodies.
- **One error vocabulary.** The service maps Supabase's `AuthError` shape onto
  our `AppError` hierarchy (`mapAuthError`), so the central handler renders
  consistent responses regardless of which Supabase call failed.

---

## 3. Request & response conventions

### Success envelope (`sendSuccess`)
```json
{
  "success": true,
  "data": { "...": "endpoint-specific" },
  "message": "Human-readable summary"
}
```

### Error envelope (`sendError`)
```json
{
  "success": false,
  "message": "What went wrong",
  "errors": { "fieldName": ["per-field validation messages"] }
}
```
`errors` is present only for validation failures. A `stack` field is added only
for **unexpected** (non-operational) errors and **only when `NODE_ENV=development`**.

### Validation
Every request body is validated by `validateBody(Dto)` (class-validator +
class-transformer) **before** the controller runs. Options: `whitelist: true`
(unknown properties are stripped), `forbidNonWhitelisted: false` (extra
properties are dropped, not rejected), `skipMissingProperties: false` (missing
required fields fail). A failure returns **422** with the per-field `errors` map
and the controller/service is never reached.

---

## 4. Endpoints in detail

> All examples omit the response envelope's outer fields for brevity where noted.
> `session` contains `access_token`, `refresh_token`, `token_type`, `expires_in`,
> `expires_at`.

### 4.1 Signup — `POST /api/v1/auth/users/email/signup`

- **Body** (`EmailSignupDto`): `email` (valid email), `password` (8–72 chars).
- **Flow:** `signUpWithEmail` → `supabaseClient.auth.signUp({ email, password })`.
- **Success `201`:**
  ```json
  { "success": true, "message": "Account created successfully.",
    "data": { "user": { "...": "" }, "session": { "access_token": "...", "refresh_token": "..." } } }
  ```
- **Email confirmation:** When confirmation is enabled on the Supabase project
  (the hosted default), `session` is `null` and the message becomes
  _"Account created. Check your email to confirm your address before logging
  in."_ — the user must confirm before they can log in. When disabled, a session
  is returned immediately.
- **Errors:** `409` email already exists · `422` weak password / invalid body.

### 4.2 Login — `POST /api/v1/auth/users/email/login`

- **Body** (`EmailLoginDto`): `email` (valid email), `password` (non-empty).
  Login deliberately enforces **no** password-strength policy — strength is a
  signup concern; re-checking it here would leak the rules and reject accounts
  created under an older policy. A bad password is a failed credential, not a 422.
- **Flow:** `signInWithEmail` → `supabaseClient.auth.signInWithPassword(...)`.
- **Success `200`:** `{ user, session }`.
- **Errors:** `401` invalid credentials · `403` email not confirmed ·
  `422` missing email/password.

### 4.3 Logout — `POST /api/v1/auth/users/logout`

- **Auth:** requires `Authorization: Bearer <access_token>` (the
  `supabaseAuthGuard`).
- **Body:** none.
- **Flow:** `signOut(accessToken)` → `supabaseAdmin.auth.admin.signOut(token, 'global')`.
- **Behaviour:** **`global` scope revokes every refresh token for the user**,
  logging them out on all devices.
- **Important caveat:** the access token presented in the request **stays valid
  until its own `exp`** — revocation kills refresh tokens, not already-issued
  access tokens. Keep access-token lifetime short for prompt effect.
- **Success `200`:** `{ "message": "Logged out successfully", "data": null }`.
- **Errors:** `401` missing/malformed/invalid/expired token.

### 4.4 Forgot password — `POST /api/v1/auth/users/email/forgot-password`

- **Body** (`ForgotPasswordDto`): `email` (valid email).
- **Flow:** `requestPasswordReset` → `supabaseClient.auth.resetPasswordForEmail(email)`.
- **No account enumeration:** Supabase returns success even for unregistered
  emails, so this endpoint **always responds `200`** with a generic message and
  never reveals whether the account exists.
  ```json
  { "success": true, "data": null,
    "message": "If an account exists for that email, a password reset code has been sent." }
  ```
- **Errors:** `422` invalid email · `429` too many reset emails (rate limited).
- **⚠️ Prerequisite:** depends on the Supabase email template emitting a 6-digit
  code (`{{ .Token }}`). See [§9 Outstanding setup](#9-outstanding-setup--known-gaps).

### 4.5 Reset password — `POST /api/v1/auth/users/email/reset-password`

- **Body** (`ResetPasswordDto`): `email`, `token` (the 6-digit code from the
  email), `password` (8–72 chars — same policy as signup).
- **Flow (three Supabase steps):**
  1. `supabaseClient.auth.verifyOtp({ email, token, type: 'recovery' })` — proves
     the caller owns the address.
  2. `supabaseAdmin.auth.admin.updateUserById(userId, { password })` — sets the
     new password (admin client, because our shared clients are stateless and
     hold no recovery session).
  3. `signOut(session.access_token)` — **revokes every session** so the change
     forces a fresh login everywhere.
- **Success `200`:** `{ "message": "Password reset successfully. Please log in with your new password.", "data": null }` — **no session is returned**; the user logs in again.
- **Errors:** `400` `OTP_EXPIRED` (code invalid/expired — password is never
  touched) · `422` validation / weak password.

### 4.6 Token refresh — `POST /api/v1/auth/users/token/refresh`

- **Body** (`RefreshTokenDto`): `refresh_token` (the `refresh_token` from the
  last session; snake_case to match the Supabase session shape the app holds).
- **Flow:** `refreshAccessToken` → `supabaseClient.auth.refreshSession({ refresh_token })`.
- **Success `200`:** `{ user, session }` with a **new access + refresh pair**.
- **Errors:** `401` `UNAUTHORIZED` — refresh token missing/expired/already-used
  ("Your session has expired. Please log in again.") · `422` missing
  `refresh_token`.
- See [§6 Token & session model](#6-token--session-model-mobile-client-contract).

---

## 5. The auth guard (protected routes)

`supabaseAuthGuard` (`src/common/guards/supabase-auth.guard.ts`) protects any
route that needs an authenticated user (currently: logout).

1. Reads `Authorization: Bearer <token>`. Missing/malformed → `401`.
2. Verifies the token with `supabaseAdmin.auth.getUser(token)`. Invalid/expired → `401`.
3. On success, attaches to the request:
   - `req.user = { sub, email, role }` — the decoded identity.
   - `req.accessToken = <raw token>` — the raw JWT string (logout needs it to
     revoke the session, not just the decoded claims).
4. Calls `next()`.

The `req.accessToken` augmentation is declared in `src/types/express.d.ts`.

To protect a new route, add `supabaseAuthGuard` before the controller:
```ts
router.post('/something', supabaseAuthGuard, controller.handler);
```

---

## 6. Token & session model (mobile client contract)

A Supabase `session` is **two tokens**:

| Token | Lifetime | Used for |
|-------|----------|----------|
| `access_token` (JWT) | **short** (Supabase default ~1h) | Sent as `Authorization: Bearer` on every authenticated request; verified by the guard. |
| `refresh_token` | long, **single-use & rotating** | Exchanged for a new pair via the refresh endpoint. |

**Rules the mobile app must follow:**

1. On **login/signup**, store both `access_token` and `refresh_token` from
   `data.session` in **secure storage** (Keychain / Keystore) — never plain
   `AsyncStorage`.
2. Send `access_token` as `Authorization: Bearer <token>` on authenticated calls.
3. When a call fails with `401` because the access token expired, call
   **`POST /users/token/refresh`** with the stored `refresh_token`.
4. On a successful refresh, **overwrite BOTH stored tokens** with the new pair.
   Supabase **rotates** refresh tokens: each refresh returns a new one and
   invalidates the old. Reusing the old token returns `401`
   (`refresh_token_already_used`).
5. If the **refresh call itself returns `401`**, the session is truly gone
   (expired or revoked) → route the user to login.

**What revokes refresh tokens (forcing re-login everywhere):**
- **Logout** (`global` scope).
- **Password reset** (step 3 revokes all sessions).

---

## 7. Error handling & Supabase error mapping

Services convert Supabase `AuthError`s into `AppError`s via `mapAuthError`
(`src/modules/auth/auth.service.ts`). The central handler then renders them.

| Supabase `code` | HTTP | App `code` | Message |
|-----------------|:----:|------------|---------|
| `user_already_exists`, `email_exists` | 409 | `CONFLICT` | An account with this email already exists |
| `invalid_credentials` | 401 | `UNAUTHORIZED` | Invalid email or password |
| `refresh_token_not_found`, `refresh_token_already_used` | 401 | `UNAUTHORIZED` | Your session has expired. Please log in again. |
| `email_not_confirmed` | 403 | `EMAIL_NOT_CONFIRMED` | Email address has not been confirmed yet |
| `weak_password` | 422 | `WEAK_PASSWORD` | _(Supabase's message)_ |
| `otp_expired` | 400 | `OTP_EXPIRED` | The reset code is invalid or has expired. Please request a new one. |
| `over_request_rate_limit`, `over_email_send_rate_limit` | 429 | `RATE_LIMITED` | _(Supabase's message)_ |
| _anything else_ | Supabase status (or 400) | uppercased code (or `SUPABASE_AUTH_ERROR`) | _(Supabase's message)_ |

The `AppError` hierarchy lives in `src/common/errors/app.error.ts`
(`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`,
`ConflictError`, `UnprocessableEntityError`).

---

## 8. Security model & decisions

- **Service-role key is server-only.** `supabaseAdmin` uses it; it is never sent
  to clients. Public flows use the anon key (`supabaseClient`).
- **Stateless shared clients.** No session persistence/auto-refresh on the shared
  singletons, so one request can't leak another user's session.
- **No account enumeration** on forgot-password (always `200`).
- **Password policy:** 8–72 characters. The 72 cap exists because bcrypt (used by
  Supabase) silently truncates beyond 72 bytes — rejecting longer input avoids a
  "works but ignores the tail" surprise. Enforced at signup and reset; **not** at
  login.
- **Password reset revokes all sessions** (defense against a stolen session
  surviving a reset) and returns no session (forces a fresh, intentional login).
- **Authorization data:** if/when role-based checks are added, store them in
  `app_metadata` (server-controlled), **never** `user_metadata` (user-editable).
- **Recommended dashboard hardening:** enable **Leaked Password Protection**
  (Supabase Auth advisor currently flags this as a warning) and keep access-token
  lifetimes short.

---

## 9. Outstanding setup & known gaps

### 9.1 Password-reset email template (blocks reset emails) — ACTION REQUIRED
The reset flow expects the email to contain a **6-digit code** (`{{ .Token }}`).
Supabase's **default** template sends a **link** instead, and on the free /
built-in email service the template body is **locked** ("Set up custom SMTP to
edit templates"). Until this is resolved, `forgot-password` returns `200` and an
email is sent, but it won't carry the code `reset-password` expects.

**Decision pending** — three options:
1. **Custom SMTP** (recommended): connect an email provider (e.g. Resend), which
   unlocks the template → paste a `{{ .Token }}` body. **Zero code changes.**
2. **Send Email Hook:** Supabase forwards `email_data.token` (the OTP) to our
   backend, which sends the email itself. More control, more code.
3. **Magic-link flow:** use the default link template (no SMTP), but the mobile
   app must handle a deep link and the `reset-password` endpoint would be
   reworked.

> Note: `env.config.ts` defines `MAIL_*` SMTP variables, but the auth module does
> **not** currently send email itself — it relies on Supabase to send. Those vars
> are not wired into the reset flow today.

### 9.2 Legacy Passport scaffolding (unused)
`src/common/guards/auth.guard.ts` (Passport `jwtGuard`/`localGuard` stubs) and the
`JWT_SECRET` / `JWT_REFRESH_SECRET` / `SESSION_SECRET` env vars are **not used by
the live Supabase-based flow**. The active guard is `supabaseAuthGuard`. This
scaffolding is a candidate for removal — flagged, not yet removed.

---

## 10. Configuration (environment)

Auth-relevant variables (see `src/config/env.config.ts`):

| Variable | Required | Used for |
|----------|:--------:|----------|
| `SUPABASE_URL` | yes | Both Supabase clients |
| `SUPABASE_ANON_KEY` | yes | `supabaseClient` (public flows) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `supabaseAdmin` (server-only) |
| `API_PREFIX` | no (default `api/v1`) | URL prefix |
| `NODE_ENV` | no (default `development`) | Controls `stack` in error responses |

`JWT_*`, `SESSION_SECRET`, and `MAIL_*` exist in config but are not used by the
current Supabase auth flow (see §9).

---

## 11. Validation DTOs

| DTO | Fields & rules |
|-----|----------------|
| `EmailSignupDto` | `email` (email), `password` (string, 8–72) |
| `EmailLoginDto` | `email` (email), `password` (string, non-empty) |
| `ForgotPasswordDto` | `email` (email) |
| `ResetPasswordDto` | `email` (email), `token` (string, non-empty), `password` (string, 8–72) |
| `RefreshTokenDto` | `refresh_token` (string, non-empty) |

---

## 12. Testing

- **Approach:** Test-Driven Development. The only thing mocked is the **Supabase
  SDK boundary**; all of our middleware, guard, validation, service logic, error
  mapping, and Express wiring run for real.
- **Shared manual mock:** `src/config/__mocks__/supabase.config.ts` stubs the
  Supabase clients. Specs opt in with a bare `jest.mock('../../config/supabase.config')`.
  (Excluded from the production build via `**/__mocks__/**` in `tsconfig.build.json`.)
- **Spec types:**
  - **DTO specs** — validate each DTO against the real middleware options via the
    `test/helpers/validate-dto.ts` helper.
  - **Service spec** (`auth.service.spec.ts`) — error mapping + return shapes.
  - **Routes spec** (`auth.routes.spec.ts`) — full-stack integration with
    `supertest` (validation → guard → service → controller → error handler).
  - **Controller spec** (`auth.controller.spec.ts`) — the logout no-token guard
    branch.
- **Run:**
  ```bash
  npm test                              # full Jest suite
  npx tsc -p tsconfig.build.json --noEmit   # production typecheck
  npx tsc -p tsconfig.spec.json             # test typecheck
  ```
- **Current status:** 63 tests across 9 suites, green; both typechecks clean.

---

## 13. File map

```
src/
├── config/
│   ├── supabase.config.ts            # supabaseClient (anon) + supabaseAdmin (service role), stateless
│   ├── swagger.config.ts             # OpenAPI schemas + Swagger UI mount
│   ├── env.config.ts                 # typed environment
│   └── __mocks__/supabase.config.ts  # shared Jest manual mock (test only)
├── common/
│   ├── guards/
│   │   ├── supabase-auth.guard.ts    # ACTIVE Bearer-token guard
│   │   └── auth.guard.ts             # legacy Passport stubs (unused, see §9.2)
│   ├── middleware/
│   │   ├── validate.middleware.ts    # validateBody(Dto) → 422 on failure
│   │   └── error-handler.middleware.ts  # central AppError renderer
│   ├── errors/app.error.ts           # AppError hierarchy
│   └── utils/response.util.ts        # sendSuccess / sendError envelopes
├── modules/auth/
│   ├── auth.routes.ts                # routes + OpenAPI JSDoc
│   ├── auth.controller.ts            # thin HTTP handlers
│   ├── auth.service.ts               # logic + mapAuthError (Supabase → AppError)
│   └── dto/                          # EmailSignup / EmailLogin / ForgotPassword / ResetPassword / RefreshToken
├── routes/index.ts                   # mounts authRouter at /auth
└── types/express.d.ts                # req.user / req.accessToken augmentation
```

---

## 14. Quick reference — example calls

```bash
# Signup
curl -X POST $BASE/api/v1/auth/users/email/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"S3curePassw0rd"}'

# Login
curl -X POST $BASE/api/v1/auth/users/email/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"S3curePassw0rd"}'

# Authenticated logout
curl -X POST $BASE/api/v1/auth/users/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Forgot password (sends the code)
curl -X POST $BASE/api/v1/auth/users/email/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}'

# Reset password (with the emailed code)
curl -X POST $BASE/api/v1/auth/users/email/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","token":"123456","password":"N3wPassw0rd"}'

# Refresh the session
curl -X POST $BASE/api/v1/auth/users/token/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<refresh_token>"}'
```
