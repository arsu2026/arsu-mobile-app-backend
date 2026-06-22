# ARSU Admin Panel — Increment 0: Foundation (Design Spec)

**Date:** 2026-06-22
**Status:** Approved (design); pending spec review → implementation plan
**Spans two repos:**
- Backend — `/Users/fardin/Documents/Arsu/arsu-mobile-app-backend` (Express 5 + Prisma + Supabase)
- Frontend — `/Users/fardin/Documents/Arsu/arsu-admin-panel-fe` (Next.js 16.2.9 + React 19 + Tailwind v4 + shadcn)

---

## 1. Goal

Stand up the **Foundation** every other admin page sits on: a self-contained admin identity (dedicated `AdminUser` table + JWT + RBAC + audit infrastructure) on the backend, and the app shell + Login + protected routing on the frontend. After this increment a provisioned super-admin can log in and land on a protected dashboard shell; an invalid/expired token bounces to `/login`.

This is the first of a series of **full-stack vertical slices built in P1→P5 priority order** (roadmap in Appendix A). Foundation is mandatory and first because nothing else can be built without an admin identity to authenticate and authorize against.

## 2. Why a dedicated admin identity (recap of approved decisions)

- **Admin auth is fully independent of end-user Supabase auth.** End users authenticate via Supabase (`supabaseAuthGuard` → `req.user`). Admins authenticate via a new `AdminUser` table + our own JWT (`requireAdmin` → `req.admin`). The two never mix. This matches the spec's "admins are provisioned, no public registration."
- **The backend already ships the machinery:** `bcryptjs` + `jsonwebtoken` are installed; a stubbed `passport-jwt` strategy and `JWT_SECRET`/`JWT_REFRESH_SECRET` env vars already exist (currently unused by any route). We add a **dedicated `ADMIN_JWT_SECRET`** rather than overloading the end-user secret, keeping admin tokens semantically and cryptographically distinct.
- **Audit trail is infrastructure, not a P4 page.** Every destructive admin action in later increments (ban, remove, approve) must record *who did what*. So the `AdminAuditLog` table + a `writeAuditLog()` helper ship here in Foundation (and login writes the first audit row). Only the audit *viewer page* waits for P4.

## 3. Architecture

### 3.1 Backend (new `/api/v1/admin/*` surface)

A new `admin` module group under `src/modules/admin/`, plus two shared guards in `src/common/guards/`. Everything follows the existing module conventions verbatim (functions-not-classes, `import * as` between layers, controllers throw and never try/catch — Express 5 forwards async rejections to the central `errorHandler`, all output via `sendSuccess`/`sendError`).

```
src/modules/admin/
  auth/
    admin-auth.controller.ts      # thin: extract body/ip, call service, sendSuccess
    admin-auth.service.ts         # bcrypt verify, sign JWT, map row→view, write audit
    admin-auth.repository.ts      # the ONLY admin-auth file importing prisma
    admin-auth.routes.ts          # Router; validateBody(LoginDto); requireAdmin on me/logout
    admin-auth.types.ts           # AdminPrincipal, AdminView, LoginResult, AdminTokenPayload
    dto/
      login.dto.ts                # class-validator LoginDto
      login.dto.spec.ts
    admin-auth.service.spec.ts
    admin-auth.routes.spec.ts
  audit/
    admin-audit.repository.ts     # writeAuditLog() helper (+ WriteAuditLogInput)
    admin-audit.repository.spec.ts

src/common/guards/
  admin-auth.guard.ts             # requireAdmin: verify ADMIN_JWT, load AdminUser, attach req.admin
  admin-role.guard.ts             # requireRole(...roles): RBAC check on req.admin.role
  admin-auth.guard.spec.ts
  admin-role.guard.spec.ts
  index.ts                        # +export requireAdmin, requireRole

src/config/env.config.ts          # +ADMIN_JWT_SECRET, +ADMIN_JWT_EXPIRES_IN, +ADMIN_SEED_*
src/types/express.d.ts            # +req.admin?: AdminPrincipal
src/prisma/seed.ts                # +upsert first SUPER_ADMIN from env
src/routes/index.ts               # +import adminAuthRouter; router.use('/admin/auth', adminAuthRouter)
test/jest.setup-env.ts            # +ADMIN_JWT_SECRET stub
prisma/schema.prisma              # +AdminRole, +AdminStatus, +AdminUser, +AdminAuditLog
prisma/migrations/<ts>_add_admin_foundation/migration.sql
```

Final URLs: `POST /api/v1/admin/auth/login`, `GET /api/v1/admin/auth/me`, `POST /api/v1/admin/auth/logout`. Later admin features mount as `router.use('/admin/<feature>', …)`.

### 3.2 Frontend (app shell + login + protected routing)

App Router at repo root (no `src/`), alias `@/*` → `./*`. shadcn is configured (`style: radix-vega`, `baseColor: neutral`, RSC, lucide) but **zero UI components exist yet** — we install the ones we need. Auth state lives in a Zustand store (persisted to `localStorage`); the axios client attaches the Bearer token and redirects to `/login` on 401; route protection is a **client-side `AuthGuard`** in the protected layout (the token is not a cookie, so `proxy.ts`/Server Components can't gate on it).

```
app/
  layout.tsx                       # REPLACE boilerplate: Inter + JetBrains_Mono fonts, real metadata, <Providers>
  providers.tsx                    # 'use client': QueryClientProvider (+ Sonner <Toaster/>)
  globals.css                      # retarget --primary to Arsu blue; add status tokens + mono var (light only)
  page.tsx                         # REPLACE: redirect('/dashboard')
  (auth)/
    login/page.tsx                 # public login screen (renders <LoginForm/>)
  (dashboard)/
    layout.tsx                     # protected shell: <AuthGuard><AppShell>{children}</AppShell></AuthGuard>
    dashboard/page.tsx             # placeholder "Dashboard" (real KPIs = Increment 1)
lib/
  api/client.ts                    # axios instance + request(Bearer)/response(401→logout) interceptors
  api/admin-auth.ts                # login()/me()/logout() + response types
  stores/auth-store.ts             # zustand persist: { token, admin, hasHydrated, setAuth, clearAuth }
  validations/auth.ts              # zod loginSchema + LoginValues
  validations/auth.test.ts         # bun test (pure)
  stores/auth-store.test.ts        # bun test (pure)
  query-client.ts                  # makeQueryClient()
components/
  providers/auth-guard.tsx         # 'use client': redirect if hydrated && !token; validate via me()
  layout/app-shell.tsx             # 'use client': grid sidebar(240px) + topbar + <main>
  layout/sidebar.tsx               # nav tree (role-filtered)
  layout/topbar.tsx                # page title slot + admin menu (logout)
  layout/nav-items.ts              # NAV config (icon, label, href, roles) from the requirement doc
  auth/login-form.tsx              # 'use client': react-hook-form + zodResolver + shadcn Form
  ui/*                             # shadcn: button input label card form sonner dropdown-menu avatar badge skeleton separator
.env.local                         # NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## 4. Data model (Prisma)

Append to `prisma/schema.prisma`. Minimal by design — invite columns, password-reset, and 2FA are **deferred to P4 Admin Management** (YAGNI). `passwordHash` is therefore NOT NULL (the seed always sets it).

```prisma
enum AdminRole {
  SUPER_ADMIN
  ADMIN
  MODERATOR
}

enum AdminStatus {
  ACTIVE
  SUSPENDED
}

model AdminUser {
  id           String      @id @default(uuid()) @db.Uuid
  email        String      @unique @db.VarChar(255)        // stored lowercased
  passwordHash String      @map("password_hash")
  fullName     String      @map("full_name")
  role         AdminRole   @default(MODERATOR)
  status       AdminStatus @default(ACTIVE)
  lastActiveAt DateTime?   @map("last_active_at") @db.Timestamptz(6)
  createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime    @updatedAt @map("updated_at") @db.Timestamptz(6)

  auditLogs    AdminAuditLog[]

  @@map("admin_users")
}

model AdminAuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  adminId    String   @map("admin_id") @db.Uuid
  action     String   @db.VarChar(100)                     // e.g. "admin.login", "admin.logout"
  targetType String?  @map("target_type") @db.VarChar(50)
  targetId   String?  @map("target_id")
  metadata   Json?
  ipAddress  String?  @map("ip_address") @db.VarChar(45)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  admin      AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId, createdAt(sort: Desc)])
  @@map("admin_audit_logs")
}
```

**Migration is via the documented Supabase workaround** (`prisma migrate dev` fails with P3006 because the shadow DB lacks Supabase's `auth` schema). Procedure:
1. `git show HEAD:prisma/schema.prisma > /tmp/old_schema.prisma`
2. Edit `prisma/schema.prisma` (add the blocks above).
3. `npx prisma migrate diff --from-schema-datamodel /tmp/old_schema.prisma --to-schema-datamodel prisma/schema.prisma --script` → inspect SQL (must contain only the two new tables + enums).
4. Save as `prisma/migrations/<timestampAfterLast>_add_admin_foundation/migration.sql`.
5. `npm run migration:run:local` (`prisma migrate deploy` — uses `directUrl`, no shadow DB).
6. `npm run prisma:generate`.

## 5. Backend API contract

All responses use the standard envelope: success `{ success: true, data, message? }`, error `{ success: false, message, errors? }`.

### `POST /api/v1/admin/auth/login`
- Body (`LoginDto`): `{ email: string (IsEmail), password: string (MinLength 8, MaxLength 200) }`.
- 200 → `data: { token: string, admin: AdminView }` where `AdminView = { id, email, fullName, role, status, lastActiveAt, createdAt }` (dates ISO strings).
- Behaviour: look up by lowercased email; if not found OR `bcrypt.compare` fails → **401 `Invalid email or password`** (same message for both, to avoid user enumeration). If `status !== ACTIVE` → **403 `This admin account is suspended`**. On success: `jwt.sign({ sub, email, role }, ADMIN_JWT_SECRET, { expiresIn: ADMIN_JWT_EXPIRES_IN })`, update `lastActiveAt = now()`, `writeAuditLog({ adminId, action: 'admin.login', ipAddress: req.ip })`.

### `GET /api/v1/admin/auth/me`  (guard: `requireAdmin`)
- 200 → `data: AdminView` (the current admin, re-read fresh from DB). 401 if token missing/invalid/expired; 403 if account suspended/not found.

### `POST /api/v1/admin/auth/logout`  (guard: `requireAdmin`)
- 200 → `data: { success: true }`, plus `writeAuditLog({ adminId, action: 'admin.logout', ipAddress: req.ip })`. JWT is stateless, so logout is effectively client-side token discard; **no server-side token revocation in Foundation** (noted limitation — a denylist/short-lived+refresh model can be added later).

### Guards
- **`requireAdmin(req, res, next)`** — read `Authorization: Bearer <token>`; `jwt.verify(token, env.ADMIN_JWT_SECRET)` (catch → `UnauthorizedError('Invalid or expired token')`); load `AdminUser` by `payload.sub`; missing → `UnauthorizedError`; `status !== ACTIVE` → `ForbiddenError('This admin account is suspended')`; attach `req.admin = { id, email, role }`; `next()`. Throws (never writes response) — central `errorHandler` formats it, exactly like `supabaseAuthGuard`.
- **`requireRole(...roles: AdminRole[])`** — returns middleware; assumes `requireAdmin` ran first; if `!req.admin` → `UnauthorizedError`; if `!roles.includes(req.admin.role)` → `ForbiddenError('Insufficient permissions')`; else `next()`. (No Foundation route gates on a role yet, but RBAC is an explicit Foundation deliverable and every later increment consumes it; shipped with full unit tests.)

### Types (`admin-auth.types.ts`)
```ts
import type { AdminRole, AdminStatus } from '@prisma/client';

export interface AdminPrincipal { id: string; email: string; role: AdminRole; }     // req.admin
export interface AdminTokenPayload { sub: string; email: string; role: AdminRole; }   // JWT claims
export interface AdminView {
  id: string; email: string; fullName: string;
  role: AdminRole; status: AdminStatus;
  lastActiveAt: string | null; createdAt: string;   // ISO
}
export interface LoginResult { token: string; admin: AdminView; }
```
`src/types/express.d.ts` adds `admin?: import('../modules/admin/auth/admin-auth.types').AdminPrincipal;` to the Express `Request` augmentation (alongside the existing `user`/`accessToken`).

### Env (`src/config/env.config.ts`) + `.env.example` + `test/jest.setup-env.ts`
- `ADMIN_JWT_SECRET: requireEnv('ADMIN_JWT_SECRET')`
- `ADMIN_JWT_EXPIRES_IN: optionalEnv('ADMIN_JWT_EXPIRES_IN', '1d')`
- `ADMIN_SEED_EMAIL: optionalEnv('ADMIN_SEED_EMAIL', '')`
- `ADMIN_SEED_PASSWORD: optionalEnv('ADMIN_SEED_PASSWORD', '')`
- `ADMIN_SEED_NAME: optionalEnv('ADMIN_SEED_NAME', 'Super Admin')`
- `test/jest.setup-env.ts`: `process.env.ADMIN_JWT_SECRET ??= 'test-admin-jwt-secret'`.

### Seed (`src/prisma/seed.ts`)
Inside the existing `seed()` body: if `env.ADMIN_SEED_EMAIL` and `env.ADMIN_SEED_PASSWORD` are set, `bcrypt.hash(password, 12)` and `prisma.adminUser.upsert({ where: { email }, update: {}, create: { email: lower, passwordHash, fullName: ADMIN_SEED_NAME, role: 'SUPER_ADMIN', status: 'ACTIVE' } })`. Idempotent; logs whether it created or found the admin. Run via `npm run db:seed`.

## 6. Frontend design detail

### 6.1 Theme & fonts (`app/globals.css`, `app/layout.tsx`) — light only
Keep the existing shadcn neutral light palette as the active theme (no dark mode). Surgical token changes in `:root`:
- `--primary: oklch(0.55 0.22 257)`  *(Arsu blue `#1877F2`; final value to be confirmed with an exact sRGB→OKLCH conversion in the plan)*
- `--primary-foreground: oklch(0.985 0 0)` *(white)*
- Add status tokens (starting values, confirm in plan): `--success: oklch(0.70 0.16 165)` (`#10B981`), `--warning: oklch(0.77 0.16 70)` (`#F59E0B`), `--info: oklch(0.72 0.13 220)` (`#06B6D4`). `--destructive` already ≈ `#EF4444` — keep.
- In `@theme inline`: add `--color-success/-warning/-info: var(--success/--warning/--info)` so `bg-success` etc. resolve; change `--font-mono: var(--font-jetbrains-mono)`.
- Leave the `.dark` block untouched (never applied; removing it is needless churn).

`app/layout.tsx`: replace CNA boilerplate — load `Inter` (`variable: '--font-sans'`) and `JetBrains_Mono` (`variable: '--font-jetbrains-mono'`) from `next/font/google`, drop the Geist fonts, set real `metadata` (`title: 'ARSU Admin'`), put `${inter.variable} ${jetbrainsMono.variable}` on `<html>`, and wrap `<body>` children in `<Providers>`.

### 6.2 Providers & data layer
- `lib/query-client.ts`: `makeQueryClient()` returning a configured `QueryClient` (sane defaults: `staleTime: 30_000`, `retry: 1`).
- `app/providers.tsx` (`'use client'`): instantiate the client once (`useState(() => makeQueryClient())`), wrap children in `QueryClientProvider`, render Sonner `<Toaster richColors />`.
- `lib/api/client.ts`: `axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL })`. Request interceptor reads `useAuthStore.getState().token` and sets `Authorization: Bearer …` when present. Response interceptor: on `error.response?.status === 401`, call `useAuthStore.getState().clearAuth()` and `window.location.href = '/login'` (interceptors run outside React).
- `lib/api/admin-auth.ts`: `login(values)`, `me()`, `logout()` calling the three endpoints; return the unwrapped `data`.

### 6.3 Auth store (`lib/stores/auth-store.ts`)
Zustand + `persist` (key `arsu-admin-auth`, localStorage). State: `{ token: string | null, admin: AdminView | null, hasHydrated: boolean, setAuth(token, admin), clearAuth() }`. `onRehydrateStorage` sets `hasHydrated = true`. Pure reducer logic (`setAuth`/`clearAuth`) is unit-tested with `bun test`.

### 6.4 Routing & protection
- `app/page.tsx`: server component, `redirect('/dashboard')`.
- `(auth)/login/page.tsx`: renders `<LoginForm/>`. `LoginForm` ('use client') uses react-hook-form + `zodResolver(loginSchema)` + shadcn `Form` primitives; on submit calls a TanStack `useMutation(login)`; on success `setAuth(...)` then `router.replace('/dashboard')`; on error shows a Sonner toast + inline message. If already authenticated (store has token) it redirects to `/dashboard`.
- `(dashboard)/layout.tsx`: server component rendering `<AuthGuard><AppShell>{children}</AppShell></AuthGuard>`.
- `components/providers/auth-guard.tsx` ('use client'): while `!hasHydrated` → render a full-screen `Skeleton`; once hydrated, if `!token` → `router.replace('/login')` and render nothing; else fire `useQuery(['admin','me'], me)` to validate the token — on error the 401 interceptor already clears+redirects. Children render once a token is present.

This means **react-hook-form** + **@hookform/resolvers** are added (the reusable form foundation for every later admin page). zod is already installed.

### 6.5 App shell & nav
- `app-shell.tsx` ('use client'): CSS grid — fixed 240px sidebar + topbar + scrollable `<main>` (`p-6`).
- `sidebar.tsx`: renders `NAV_ITEMS` (grouped, with lucide icons), highlights the active route via `usePathname()`, filtered by the current admin's `role`.
- `topbar.tsx`: left = current page label; right = admin avatar + name + a shadcn `DropdownMenu` with "Log out" (calls `logout()` then `clearAuth()` + redirect).
- `nav-items.ts`: the full nav tree transcribed from the requirement doc (Dashboard, Users, Posts, Comments, Videos, Verification, Reports, Support, Referral, Messenger, Notifications, Logs, Settings…), each tagged with the roles allowed to see it. **Only Dashboard routes to a real page this increment; the rest are present-but-inert placeholders** (they render, links exist, target pages arrive in later increments). This is intentional so the shell is complete and later increments only fill pages.

### 6.6 Dev ports / CORS
Backend `PORT` defaults to 3000 and `next dev` also defaults to 3000 — they collide. **Run the backend on `PORT=4000`** (in backend `.env.local`) and the frontend on 3000. Set FE `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`. Backend `ALLOWED_ORIGINS` already defaults to `http://localhost:3000` (the FE origin). Auth uses a Bearer header (not cookies), so no CORS-credentials/CSRF setup is needed.

## 7. Error handling
- **Backend:** throw the existing error classes (`UnauthorizedError` 401, `ForbiddenError` 403, `UnprocessableEntityError` 422 from `validateBody`, `BadRequestError` 400). The central `errorHandler` formats them. Login deliberately returns an identical 401 message for "no such email" and "wrong password."
- **Frontend:** the axios 401 interceptor is the single global handler (clear auth + redirect). Form/network errors surface as Sonner toasts plus inline field errors from react-hook-form/zod. The `AuthGuard` renders a skeleton during hydration to avoid a login-flash.

## 8. Testing strategy
- **Backend (Jest + supertest, `*.spec.ts`):**
  - `login.dto.spec.ts` — invalid email / short password rejected; valid passes (via `test/helpers/validate-dto`).
  - `admin-auth.service.spec.ts` — `jest.mock` the repository + audit + `bcryptjs` + `jsonwebtoken`: success returns `{ token, admin }` + writes audit + updates `lastActiveAt`; wrong password → 401; suspended → 403; row→view mapping (ISO dates).
  - `admin-auth.routes.spec.ts` — `buildApp()` + supertest: 422 on bad body, 401 on bad creds, 200 + token on success; `/me` 401 without token and 200 with a signed token (mock the repository lookup); `/logout` 200.
  - `admin-auth.guard.spec.ts` / `admin-role.guard.spec.ts` — requireAdmin allows valid token / rejects missing/expired/suspended; requireRole allows in-set / 403 out-of-set.
  - `admin-audit.repository.spec.ts` — `writeAuditLog` calls `prisma.adminAuditLog.create` with the mapped data.
- **Frontend:** `bun test` for the two pure modules (`loginSchema`, auth-store reducers). Component/E2E coverage is verified manually against the running backend this increment (no RTL/vitest harness yet — deferred to avoid scope creep). Static gates: `bunx tsc --noEmit` clean, `bun run build` succeeds, `bun run lint` clean.

## 9. Success criteria (Definition of Done)
1. Migration applied; `npm run db:seed` provisions one `SUPER_ADMIN` from env (idempotent).
2. `npm test` green for all new backend specs; existing suites still pass.
3. `POST /admin/auth/login` returns a JWT + `AdminView` for the seeded admin; wrong password → 401; `/me` works with the token, 401 without; `/logout` → 200; an `admin.login` row exists in `admin_audit_logs`.
4. Frontend: `bunx tsc --noEmit` + `bun run build` + `bun run lint` clean; `bun test` green.
5. End-to-end (backend on :4000, FE on :3000): visiting `/` redirects to `/dashboard`; unauthenticated → bounced to `/login`; logging in with the seeded admin lands on the dashboard shell (240px sidebar + topbar + brand-blue accents); reloading keeps the session (persisted); "Log out" returns to `/login`; tampering the stored token → next request 401 → bounced to `/login`.

## 10. Out of scope (Foundation)
Admin invites / set-password flow, password reset, 2FA, server-side token revocation/refresh tokens, the audit-log *viewer* page, real dashboard KPIs, any user/post/moderation data, dark mode, FE component/E2E test harness. Each lands in its named later increment.

## 11. Key decisions & rationale
| Decision | Choice | Why |
|---|---|---|
| Admin identity | Dedicated `AdminUser` + own JWT | Spec = provisioned admins, no public signup; isolates from Supabase end-user auth |
| JWT secret | New `ADMIN_JWT_SECRET` | Keep admin tokens distinct from the unused end-user `JWT_SECRET` |
| Token transport | Bearer access token in body → Zustand(+persist) → `Authorization` header | Matches the backend's existing Bearer convention; simplest. Trade-off: localStorage is XSS-exposed; httpOnly-cookie refresh can be layered later |
| Route protection | Client-side `AuthGuard` | Token isn't a cookie, so `proxy.ts`/RSC can't gate; normal shape for an authed dashboard |
| Audit table | Ships in Foundation; viewer in P4 | Every later destructive action must audit; retrofitting is costly |
| `passwordHash` | NOT NULL (seed sets it) | Invite/set-password deferred to P4 (YAGNI) |
| Theme | Light only, brand blue `--primary` | User directive: no dark theme; retargeting one token propagates brand to all shadcn components |
| Forms | react-hook-form + shadcn Form | Reusable form foundation for all later admin pages |

---

## Appendix A — Program roadmap (vertical slices, P1→P5)
- **P1 Core:** **0 Foundation (this doc)** → 1 Dashboard (stats endpoints + KPI cards/charts) → 2 All Users (*+account-status model*) → 3 User Profile View → 4 All Posts (*+content moderation-status*) → 5 Reported Posts (*+content-report model*).
- **P2 Moderation:** Reported Comments · All/Reported Videos · Verification Queue (*new verification + doc storage*) · Reports & Support.
- **P3 Management:** Referral Overview + Withdrawals (*new models*) · Messenger Oversight (*new chat models — largest*) · Broadcast Notifications (*new model*).
- **P4 Logs & Settings:** Platform Logs · Admin Audit Trail (*viewer*) · System Settings · Admin Management (*invites — adds the deferred AdminUser columns*).
- **P5 Supporting:** Banned Users view · Verification history · Help Articles.

New backend models are introduced exactly when the first consuming slice needs them — nothing speculative.
