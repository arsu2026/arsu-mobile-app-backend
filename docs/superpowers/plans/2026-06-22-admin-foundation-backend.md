# Admin Foundation — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a self-contained admin identity on the backend — `AdminUser` table + JWT login + RBAC guard + audit-log infrastructure + a seeded super-admin — exposed at `POST/GET /api/v1/admin/auth/{login,me,logout}`.

**Architecture:** A new `admin` module group under `src/modules/admin/` (auth + audit) following the existing functions-not-classes, `import * as` layered conventions (controller → service → repository; repository is the only module file importing `prisma`). Two new guards in `src/common/guards/` (`requireAdmin`, `requireRole`) mirror the existing `supabaseAuthGuard` — they reach infra clients directly and **throw** typed errors that the central `errorHandler` formats. Admin auth is fully independent of end-user Supabase auth.

**Tech Stack:** Express 5, Prisma 6 (Postgres/Supabase), `bcryptjs@^3`, `jsonwebtoken@^9`, class-validator/class-transformer DTOs, Jest + supertest + ts-jest.

**Source spec:** `docs/superpowers/specs/2026-06-22-admin-foundation-design.md` (§3.1, §4, §5, §8, §9).

## Global Constraints

- **Module path depth:** `src/modules/admin/auth/` and `src/modules/admin/audit/` are **three** levels under `src/` (vs. two for `src/modules/support/`). All cross-cutting imports from these files use `../../../` (e.g. `../../../prisma`, `../../../common/errors`, `../../../common/utils/response.util`, `../../../common/middleware/validate.middleware`, `../../../common/guards`, `../../../config/env.config`). Getting the depth wrong is the most likely error in this plan.
- **Response envelope (verbatim API):** controllers call `sendSuccess(res, data, { statusCode?, message?, meta? })` from `../../../common/utils/response.util`. Default status 200. Never build the envelope by hand.
- **Errors:** throw classes from `../../../common/errors` (`UnauthorizedError`→401, `ForbiddenError`→403, `BadRequestError`→400, `UnprocessableEntityError`→422, `NotFoundError`→404). Controllers/guards/services **throw**; never `try/catch` to write a response — Express 5 forwards async rejections to `errorHandler`.
- **Guards import infra directly:** `supabaseAuthGuard` imports `supabaseAdmin` directly (not a repository). By the same precedent, `requireAdmin` imports `prisma` from `../../prisma` directly. This does not violate the "repository-only prisma" rule, which governs the module CSR layers, not `common/` infra guards.
- **DTO validation:** `validateBody(LoginDto)` from `../../../common/middleware/validate.middleware`. Bad body → `UnprocessableEntityError` (422). DTO specs use `validateDto(DtoClass, payload)` from `test/helpers/validate-dto` and assert on the returned `ValidationError[]`.
- **Jest:** config is `jest.config.ts`, `rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'`, `setupFiles: ['<rootDir>/../test/jest.setup-env.ts']`, `clearMocks: true`, `moduleNameMapper { '^@/(.*)$': '<rootDir>/$1' }`. Specs are **co-located** `*.spec.ts` under `src/`. Run all: `npm test`. Run one: `npx jest <pathFragment>`.
- **No `prisma migrate dev`** (it fails P3006 — the shadow DB lacks Supabase's `auth` schema). Migrations are authored via `prisma migrate diff` (no DB / no shadow DB) and applied with `migrate deploy`. See Task 1.
- **Env files:** local scripts load `dotenv -e .env.local`. `src/config/env.config.ts` itself loads `.env` (no override of already-set vars). `.env.local` is gitignored; `.env.example` is committed documentation. Add new vars to **both**.
- **Dates:** services map DB `Date` columns to ISO strings via `.toISOString()` in a `*View` mapper.
- **Commits (USER POLICY — overrides the skill's per-task commit step):** the repo owner commits only on explicit request. **Do not run `git add`/`git commit` during execution.** Treat each task's final "Checkpoint" as a review pause; commit only if the user asks. Do not start on `main` without the user's consent — use a feature branch.
- **Reference module to mirror exactly:** `src/modules/support/` (controller/service/repository/routes/types + `dto/` + co-located specs). When unsure about a convention, match `support`.

---

### Task 1: Prisma schema — admin enums, tables, migration

**Files:**
- Modify: `prisma/schema.prisma` (append enums + two models)
- Create: `prisma/migrations/20260622000000_add_admin_foundation/migration.sql`

**Interfaces:**
- Produces: Prisma models `AdminUser`, `AdminAuditLog`; enums `AdminRole` (`SUPER_ADMIN|ADMIN|MODERATOR`), `AdminStatus` (`ACTIVE|SUSPENDED`); generated client types `AdminRole`, `AdminStatus`, `prisma.adminUser`, `prisma.adminAuditLog`. Every later task consumes these.

- [ ] **Step 1: Snapshot the current datamodel** (the migrate-diff "from" side)

Run: `git -C /Users/fardin/Documents/Arsu/arsu-mobile-app-backend show HEAD:prisma/schema.prisma > /tmp/old_schema.prisma`
Expected: file written, no output. (If the working tree already has uncommitted schema edits, instead `cp prisma/schema.prisma /tmp/old_schema.prisma` *before* Step 2.)

- [ ] **Step 2: Append the enums and models to `prisma/schema.prisma`**

Append at the end of the file (after the last existing model):

```prisma
enum AdminRole {
  SUPER_ADMIN
  ADMIN
  MODERATOR

  @@map("admin_role")
}

enum AdminStatus {
  ACTIVE
  SUSPENDED

  @@map("admin_status")
}

model AdminUser {
  id           String      @id @default(uuid()) @db.Uuid
  email        String      @unique @db.VarChar(255)
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
  action     String   @db.VarChar(100)
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

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Generate the migration SQL via diff (no DB, no shadow DB)**

Run:
```bash
npx prisma migrate diff \
  --from-schema-datamodel /tmp/old_schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```
Expected: SQL printed to stdout. It MUST contain ONLY the two new enums, the two new tables, the unique email index, the composite index, and the FK — nothing touching existing tables. It should match (modulo whitespace):

```sql
-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "admin_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "admin_role" NOT NULL DEFAULT 'MODERATOR',
    "status" "admin_status" NOT NULL DEFAULT 'ACTIVE',
    "last_active_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_created_at_idx" ON "admin_audit_logs"("admin_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

If the diff touches any other table, STOP — `/tmp/old_schema.prisma` was captured after the edit; re-capture from HEAD and redo.

- [ ] **Step 5: Save the diff to the migration file**

Create `prisma/migrations/20260622000000_add_admin_foundation/migration.sql` containing the **exact** SQL the diff printed (re-run Step 4 piping to the file):
```bash
mkdir -p prisma/migrations/20260622000000_add_admin_foundation
npx prisma migrate diff \
  --from-schema-datamodel /tmp/old_schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20260622000000_add_admin_foundation/migration.sql
```
(The `20260622000000` prefix sorts after the latest existing migration `20260617130100_add_endpoints_batch`.)

- [ ] **Step 6: Apply the migration**

Run: `npm run migration:run:local`
Expected: Prisma reports `1 migration found` / applies `20260622000000_add_admin_foundation`, ending with no error. (Uses `DATABASE_DIRECT_URL` from `.env.local`.)

- [ ] **Step 7: Regenerate the Prisma client**

Run: `npm run prisma:generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 8: Verify the new types exist**

Run: `node -e "const {AdminRole,AdminStatus}=require('@prisma/client'); console.log(AdminRole.SUPER_ADMIN, AdminStatus.ACTIVE)"`
Expected: `SUPER_ADMIN ACTIVE`

- [ ] **Step 9: Confirm existing suite still green**

Run: `npm test`
Expected: all existing specs pass (no new specs yet).

- [ ] **Step 10: Checkpoint** — review the schema diff and applied migration. (Commit only if the user asks.)

---

### Task 2: Shared admin types, env config, and Express augmentation

**Files:**
- Create: `src/modules/admin/auth/admin-auth.types.ts`
- Modify: `src/config/env.config.ts` (add admin vars)
- Modify: `src/types/express.d.ts` (add `req.admin`)
- Modify: `test/jest.setup-env.ts` (stub `ADMIN_JWT_SECRET`)
- Modify: `.env.example` and `.env.local` (document/set admin vars + `PORT=4000`)

**Interfaces:**
- Produces:
  - `AdminPrincipal { id: string; email: string; role: AdminRole }` — shape attached to `req.admin`.
  - `AdminTokenPayload { sub: string; email: string; role: AdminRole }` — JWT claims.
  - `AdminView { id; email; fullName; role: AdminRole; status: AdminStatus; lastActiveAt: string | null; createdAt: string }`.
  - `LoginResult { token: string; admin: AdminView }`.
  - `env.ADMIN_JWT_SECRET: string`, `env.ADMIN_JWT_EXPIRES_IN: string`, `env.ADMIN_SEED_EMAIL/PASSWORD/NAME: string`.
  - `Express.Request.admin?: AdminPrincipal`.

- [ ] **Step 1: Create `src/modules/admin/auth/admin-auth.types.ts`**

```ts
import type { AdminRole, AdminStatus } from '@prisma/client';

// Attached to req.admin by requireAdmin (decoded + DB-fresh identity).
export interface AdminPrincipal {
  id: string;
  email: string;
  role: AdminRole;
}

// Claims we sign into / verify out of the admin JWT.
export interface AdminTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
}

// API-facing admin shape (dates as ISO strings).
export interface AdminView {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  status: AdminStatus;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  admin: AdminView;
}
```

- [ ] **Step 2: Add admin env vars to `src/config/env.config.ts`**

Inside the `export const env = { … } as const;` object, after the existing `// JWT` block, add a new block:

```ts
  // Admin auth (dedicated — independent of end-user JWT_SECRET)
  ADMIN_JWT_SECRET: requireEnv('ADMIN_JWT_SECRET'),
  ADMIN_JWT_EXPIRES_IN: optionalEnv('ADMIN_JWT_EXPIRES_IN', '1d'),
  ADMIN_SEED_EMAIL: optionalEnv('ADMIN_SEED_EMAIL', ''),
  ADMIN_SEED_PASSWORD: optionalEnv('ADMIN_SEED_PASSWORD', ''),
  ADMIN_SEED_NAME: optionalEnv('ADMIN_SEED_NAME', 'Super Admin'),
```

- [ ] **Step 3: Stub `ADMIN_JWT_SECRET` in `test/jest.setup-env.ts`**

After the existing `process.env.JWT_REFRESH_SECRET ??= …` line, add:
```ts
process.env.ADMIN_JWT_SECRET ??= 'test-admin-jwt-secret';
```
(`requireEnv('ADMIN_JWT_SECRET')` would otherwise throw when env.config loads during tests.)

- [ ] **Step 4: Augment Express `Request` in `src/types/express.d.ts`**

Add an `admin?` field to the `interface Request` block (alongside `accessToken?`):
```ts
    interface Request {
      // Raw Supabase access token, set by supabaseAuthGuard after verification
      accessToken?: string;
      // Authenticated admin identity, set by requireAdmin
      admin?: import('../modules/admin/auth/admin-auth.types').AdminPrincipal;
    }
```
(Inline `import(...)` type avoids a top-level import that would change the file into needing a value import.)

- [ ] **Step 5: Document/set the new vars in `.env.example` and `.env.local`**

Append to **`.env.example`** (committed docs — no real secrets):
```dotenv
# ── Admin panel auth ──────────────────────────────────────────────
ADMIN_JWT_SECRET=change-me-to-a-long-random-string
ADMIN_JWT_EXPIRES_IN=1d
# Seed a first super-admin on `npm run db:seed` (leave blank to skip)
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
ADMIN_SEED_NAME=Super Admin
```
Append to **`.env.local`** (real local values; gitignored). Set a real secret and seed creds, and ensure the backend runs on port 4000 (so it doesn't collide with `next dev` on 3000):
```dotenv
PORT=4000
ADMIN_JWT_SECRET=local-dev-admin-secret-please-change
ADMIN_JWT_EXPIRES_IN=1d
ADMIN_SEED_EMAIL=admin@arsu.app
ADMIN_SEED_PASSWORD=ChangeMe123!
ADMIN_SEED_NAME=Super Admin
```
(If `PORT=` is already set in `.env.local`, change its value to `4000` rather than adding a duplicate.)

- [ ] **Step 6: Verify compile + existing suite**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no errors.
Run: `npm test`
Expected: existing specs still pass (the `ADMIN_JWT_SECRET` requireEnv is satisfied by the jest stub).

- [ ] **Step 7: Checkpoint.** (Commit only if the user asks.)

---

### Task 3: `LoginDto` + validation spec

**Files:**
- Create: `src/modules/admin/auth/dto/login.dto.ts`
- Test: `src/modules/admin/auth/dto/login.dto.spec.ts`

**Interfaces:**
- Produces: `class LoginDto { email: string; password: string }` (IsEmail; password MinLength 8 / MaxLength 200). Consumed by routes (`validateBody(LoginDto)`) and the controller (`req.body as LoginDto`).

- [ ] **Step 1: Write the failing spec** — `src/modules/admin/auth/dto/login.dto.spec.ts`

```ts
import { validateDto } from '../../../../../test/helpers/validate-dto';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid email + password', async () => {
    const errors = await validateDto(LoginDto, { email: 'admin@arsu.app', password: 'password123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto(LoginDto, { email: 'not-an-email', password: 'password123' });
    expect(errors.map((e) => e.property)).toContain('email');
  });

  it('rejects a password shorter than 8 chars', async () => {
    const errors = await validateDto(LoginDto, { email: 'admin@arsu.app', password: 'short' });
    expect(errors.map((e) => e.property)).toContain('password');
  });
});
```
(Note the **five** `../` to reach `test/helpers/validate-dto` from this 5-deep file.)

- [ ] **Step 2: Run it — verify it fails**

Run: `npx jest login.dto`
Expected: FAIL — `Cannot find module './login.dto'`.

- [ ] **Step 3: Implement `src/modules/admin/auth/dto/login.dto.ts`**

```ts
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `npx jest login.dto`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint.** (Commit only if the user asks.)

---

### Task 4: Audit repository — `writeAuditLog`

**Files:**
- Create: `src/modules/admin/audit/admin-audit.repository.ts`
- Test: `src/modules/admin/audit/admin-audit.repository.spec.ts`

**Interfaces:**
- Produces:
  - `interface WriteAuditLogInput { adminId: string; action: string; targetType?: string | null; targetId?: string | null; metadata?: Prisma.InputJsonValue; ipAddress?: string | null }`
  - `writeAuditLog(input: WriteAuditLogInput): Promise<AdminAuditLog>` — inserts one row.
- Consumed by: `admin-auth.service` (login/logout write `admin.login`/`admin.logout`).

- [ ] **Step 1: Write the failing spec** — `src/modules/admin/audit/admin-audit.repository.spec.ts`

```ts
jest.mock('../../../prisma', () => ({
  prisma: { adminAuditLog: { create: jest.fn() } },
}));

import { prisma } from '../../../prisma';
import { writeAuditLog } from './admin-audit.repository';

const mockCreate = (prisma.adminAuditLog as { create: jest.Mock }).create;

describe('writeAuditLog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an audit row with nullable fields defaulted to null', async () => {
    mockCreate.mockResolvedValue({ id: 'a1' });
    await writeAuditLog({ adminId: 'admin-1', action: 'admin.login', ipAddress: '127.0.0.1' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        adminId: 'admin-1',
        action: 'admin.login',
        targetType: null,
        targetId: null,
        metadata: undefined,
        ipAddress: '127.0.0.1',
      },
    });
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx jest admin-audit.repository`
Expected: FAIL — `Cannot find module './admin-audit.repository'`.

- [ ] **Step 3: Implement `src/modules/admin/audit/admin-audit.repository.ts`**

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma';

export interface WriteAuditLogInput {
  adminId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `npx jest admin-audit.repository`
Expected: PASS (1 test).

- [ ] **Step 5: Checkpoint.** (Commit only if the user asks.)

---

### Task 5: Auth repository + service (login/getMe/logout)

**Files:**
- Create: `src/modules/admin/auth/admin-auth.repository.ts` (thin; no spec — matches `support.repository` having no spec)
- Create: `src/modules/admin/auth/admin-auth.service.ts`
- Test: `src/modules/admin/auth/admin-auth.service.spec.ts`

**Interfaces:**
- Consumes: `repo.findByEmail/findById/updateLastActiveAt`, `auditRepo.writeAuditLog` (Task 4), `env.ADMIN_JWT_SECRET/ADMIN_JWT_EXPIRES_IN` (Task 2), `AdminView/LoginResult/AdminTokenPayload` (Task 2), `bcryptjs`, `jsonwebtoken`.
- Produces (service):
  - `login(input: { email: string; password: string }, ipAddress?: string): Promise<LoginResult>`
  - `getMe(adminId: string): Promise<AdminView>`
  - `logout(adminId: string, ipAddress?: string): Promise<{ success: true }>`
- Produces (repository):
  - `findByEmail(email: string)`, `findById(id: string)`, `updateLastActiveAt(id: string)` — all returning `AdminUser | null` / the row.

- [ ] **Step 1: Implement the repository `src/modules/admin/auth/admin-auth.repository.ts`**

```ts
import { prisma } from '../../../prisma';

export async function findByEmail(email: string) {
  return prisma.adminUser.findUnique({ where: { email } });
}

export async function findById(id: string) {
  return prisma.adminUser.findUnique({ where: { id } });
}

export async function updateLastActiveAt(id: string) {
  return prisma.adminUser.update({ where: { id }, data: { lastActiveAt: new Date() } });
}
```

- [ ] **Step 2: Write the failing service spec** — `src/modules/admin/auth/admin-auth.service.spec.ts`

```ts
jest.mock('./admin-auth.repository');
jest.mock('../audit/admin-audit.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as auditRepo from '../audit/admin-audit.repository';
import * as repo from './admin-auth.repository';
import { getMe, login, logout } from './admin-auth.service';

const mockFindByEmail = repo.findByEmail as jest.Mock;
const mockFindById = repo.findById as jest.Mock;
const mockUpdateLastActive = repo.updateLastActiveAt as jest.Mock;
const mockWriteAudit = auditRepo.writeAuditLog as jest.Mock;
const mockCompare = bcrypt.compare as unknown as jest.Mock;
const mockSign = jwt.sign as unknown as jest.Mock;

function adminRow(over: Record<string, unknown> = {}) {
  return {
    id: 'admin-1',
    email: 'admin@arsu.app',
    passwordHash: 'hashed',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastActiveAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

describe('admin-auth.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('returns a token + view, updates lastActiveAt, writes an audit row', async () => {
      mockFindByEmail.mockResolvedValue(adminRow());
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValue('signed.jwt.token');
      mockUpdateLastActive.mockResolvedValue(
        adminRow({ lastActiveAt: new Date('2026-06-22T00:00:00.000Z') }),
      );

      const result = await login({ email: 'Admin@Arsu.app', password: 'password123' }, '127.0.0.1');

      expect(mockFindByEmail).toHaveBeenCalledWith('admin@arsu.app'); // lowercased
      expect(mockCompare).toHaveBeenCalledWith('password123', 'hashed');
      expect(mockSign).toHaveBeenCalledWith(
        { sub: 'admin-1', email: 'admin@arsu.app', role: 'SUPER_ADMIN' },
        expect.any(String),
        expect.objectContaining({ expiresIn: expect.anything() }),
      );
      expect(mockUpdateLastActive).toHaveBeenCalledWith('admin-1');
      expect(mockWriteAudit).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'admin.login',
        ipAddress: '127.0.0.1',
      });
      expect(result.token).toBe('signed.jwt.token');
      expect(result.admin).toMatchObject({
        id: 'admin-1',
        email: 'admin@arsu.app',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        lastActiveAt: '2026-06-22T00:00:00.000Z',
        createdAt: '2026-06-01T00:00:00.000Z',
      });
    });

    it('throws 401 when the email is unknown (no enumeration)', async () => {
      mockFindByEmail.mockResolvedValue(null);
      await expect(login({ email: 'nobody@arsu.app', password: 'password123' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
      expect(mockSign).not.toHaveBeenCalled();
    });

    it('throws 401 with the same message when the password is wrong', async () => {
      mockFindByEmail.mockResolvedValue(adminRow());
      mockCompare.mockResolvedValue(false);
      await expect(login({ email: 'admin@arsu.app', password: 'wrongpass1' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('throws 403 when the account is suspended', async () => {
      mockFindByEmail.mockResolvedValue(adminRow({ status: 'SUSPENDED' }));
      mockCompare.mockResolvedValue(true);
      await expect(login({ email: 'admin@arsu.app', password: 'password123' })).rejects.toMatchObject({
        statusCode: 403,
        message: 'This admin account is suspended',
      });
      expect(mockSign).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('re-reads and maps the admin to a view', async () => {
      mockFindById.mockResolvedValue(adminRow());
      const view = await getMe('admin-1');
      expect(mockFindById).toHaveBeenCalledWith('admin-1');
      expect(view).toMatchObject({ id: 'admin-1', email: 'admin@arsu.app' });
    });

    it('throws 401 when the admin no longer exists', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(getMe('ghost')).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('logout', () => {
    it('writes an audit row and returns success', async () => {
      const result = await logout('admin-1', '10.0.0.1');
      expect(mockWriteAudit).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'admin.logout',
        ipAddress: '10.0.0.1',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
```

- [ ] **Step 3: Run it — verify it fails**

Run: `npx jest admin-auth.service`
Expected: FAIL — `Cannot find module './admin-auth.service'`.

- [ ] **Step 4: Implement `src/modules/admin/auth/admin-auth.service.ts`**

```ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.config';
import { ForbiddenError, UnauthorizedError } from '../../../common/errors';
import * as auditRepo from '../audit/admin-audit.repository';
import * as repo from './admin-auth.repository';
import type { AdminView, LoginResult } from './admin-auth.types';

type AdminRow = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

function mapAdmin(row: AdminRow): AdminView {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    lastActiveAt: row.lastActiveAt ? row.lastActiveAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function login(
  input: { email: string; password: string },
  ipAddress?: string,
): Promise<LoginResult> {
  const email = input.email.toLowerCase();
  const admin = await repo.findByEmail(email);

  // Same 401 for unknown email and bad password — avoid user enumeration.
  if (!admin) throw new UnauthorizedError('Invalid email or password');

  const passwordOk = await bcrypt.compare(input.password, admin.passwordHash);
  if (!passwordOk) throw new UnauthorizedError('Invalid email or password');

  if (admin.status !== 'ACTIVE') throw new ForbiddenError('This admin account is suspended');

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: admin.role },
    env.ADMIN_JWT_SECRET,
    { expiresIn: env.ADMIN_JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const updated = await repo.updateLastActiveAt(admin.id);
  await auditRepo.writeAuditLog({ adminId: admin.id, action: 'admin.login', ipAddress });

  return { token, admin: mapAdmin(updated) };
}

export async function getMe(adminId: string): Promise<AdminView> {
  const admin = await repo.findById(adminId);
  if (!admin) throw new UnauthorizedError('Invalid or expired token');
  return mapAdmin(admin);
}

export async function logout(adminId: string, ipAddress?: string): Promise<{ success: true }> {
  await auditRepo.writeAuditLog({ adminId, action: 'admin.logout', ipAddress });
  return { success: true };
}
```

- [ ] **Step 5: Run it — verify it passes**

Run: `npx jest admin-auth.service`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Checkpoint.** (Commit only if the user asks.)

---

### Task 6: Guards — `requireAdmin` + `requireRole`

**Files:**
- Create: `src/common/guards/admin-auth.guard.ts`
- Create: `src/common/guards/admin-role.guard.ts`
- Modify: `src/common/guards/index.ts` (add two exports)
- Test: `src/common/guards/admin-auth.guard.spec.ts`
- Test: `src/common/guards/admin-role.guard.spec.ts`

**Interfaces:**
- Consumes: `prisma` (`../../prisma`), `env.ADMIN_JWT_SECRET` (`../../config/env.config`), `UnauthorizedError`/`ForbiddenError` (`../errors`), `AdminTokenPayload` (`../../modules/admin/auth/admin-auth.types`), `jsonwebtoken`, `@prisma/client` `AdminRole`.
- Produces:
  - `requireAdmin(req, res, next): Promise<void>` — verifies Bearer admin JWT, loads the admin fresh, enforces `ACTIVE`, sets `req.admin`.
  - `requireRole(...roles: AdminRole[])` → middleware enforcing `req.admin.role ∈ roles`.
- Consumed by: `admin-auth.routes` (Task 7) and every later admin route.

- [ ] **Step 1: Write the failing `requireAdmin` spec** — `src/common/guards/admin-auth.guard.spec.ts`

```ts
jest.mock('../../prisma', () => ({
  prisma: { adminUser: { findUnique: jest.fn() } },
}));

import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.config';
import { prisma } from '../../prisma';
import { requireAdmin } from './admin-auth.guard';

const mockFindUnique = (prisma.adminUser as { findUnique: jest.Mock }).findUnique;

function ctx(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

function signToken(over: Record<string, unknown> = {}) {
  return jwt.sign({ sub: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', ...over }, env.ADMIN_JWT_SECRET);
}

const activeAdmin = { id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' };

describe('requireAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches req.admin and calls next for a valid token + active admin', async () => {
    mockFindUnique.mockResolvedValue(activeAdmin);
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await requireAdmin(req, res, next);
    expect(req.admin).toEqual({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN' });
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 401 when the Authorization header is missing', async () => {
    const { req, res, next } = ctx();
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a malformed / non-Bearer header', async () => {
    const { req, res, next } = ctx('Token abc');
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a token signed with the wrong secret', async () => {
    const bad = jwt.sign({ sub: 'admin-1', email: 'x', role: 'ADMIN' }, 'wrong-secret');
    const { req, res, next } = ctx(`Bearer ${bad}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when the admin no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 when the admin is suspended', async () => {
    mockFindUnique.mockResolvedValue({ ...activeAdmin, status: 'SUSPENDED' });
    const { req, res, next } = ctx(`Bearer ${signToken()}`);
    await expect(requireAdmin(req, res, next)).rejects.toMatchObject({ statusCode: 403 });
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx jest admin-auth.guard`
Expected: FAIL — `Cannot find module './admin-auth.guard'`.

- [ ] **Step 3: Implement `src/common/guards/admin-auth.guard.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.config';
import { prisma } from '../../prisma';
import { ForbiddenError, UnauthorizedError } from '../errors';
import type { AdminTokenPayload } from '../../modules/admin/auth/admin-auth.types';

const BEARER_PREFIX = 'Bearer ';

/**
 * Authenticate an admin request using our own admin JWT.
 *
 * Expects `Authorization: Bearer <token>`. Verifies with ADMIN_JWT_SECRET,
 * re-loads the AdminUser fresh (so a suspension takes effect before token
 * expiry), enforces ACTIVE status, and attaches req.admin. Throws on any
 * failure; Express 5 forwards the rejection to the central error handler.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Authentication required: missing or malformed Bearer token');
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication required: missing access token');
  }

  let payload: AdminTokenPayload;
  try {
    payload = jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin) {
    throw new UnauthorizedError('Invalid or expired token');
  }
  if (admin.status !== 'ACTIVE') {
    throw new ForbiddenError('This admin account is suspended');
  }

  req.admin = { id: admin.id, email: admin.email, role: admin.role };
  next();
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `npx jest admin-auth.guard`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing `requireRole` spec** — `src/common/guards/admin-role.guard.spec.ts`

```ts
import type { NextFunction, Request, Response } from 'express';
import { requireRole } from './admin-role.guard';

function ctx(admin?: { id: string; email: string; role: string }) {
  const req = { admin } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('requireRole', () => {
  it('calls next when the admin role is in the allowed set', () => {
    const { req, res, next } = ctx({ id: 'a', email: 'a@x.com', role: 'SUPER_ADMIN' });
    requireRole('SUPER_ADMIN', 'ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('throws 403 when the role is not allowed', () => {
    const { req, res, next } = ctx({ id: 'a', email: 'a@x.com', role: 'MODERATOR' });
    expect(() => requireRole('SUPER_ADMIN')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws 401 when no admin is attached (guard order misuse)', () => {
    const { req, res, next } = ctx(undefined);
    expect(() => requireRole('ADMIN')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    );
  });
});
```

- [ ] **Step 6: Run it — verify it fails**

Run: `npx jest admin-role.guard`
Expected: FAIL — `Cannot find module './admin-role.guard'`.

- [ ] **Step 7: Implement `src/common/guards/admin-role.guard.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors';

/**
 * RBAC guard. MUST run after requireAdmin (which sets req.admin).
 * Usage: router.post('/x', requireAdmin, requireRole('SUPER_ADMIN'), controller)
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.admin.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
```

- [ ] **Step 8: Run it — verify it passes**

Run: `npx jest admin-role.guard`
Expected: PASS (3 tests).

- [ ] **Step 9: Export both guards from the barrel** — append to `src/common/guards/index.ts`

```ts
export * from './admin-auth.guard';
export * from './admin-role.guard';
```

- [ ] **Step 10: Verify the barrel compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no errors.

- [ ] **Step 11: Checkpoint.** (Commit only if the user asks.)

---

### Task 7: Controller, routes, and mount

**Files:**
- Create: `src/modules/admin/auth/admin-auth.controller.ts`
- Create: `src/modules/admin/auth/admin-auth.routes.ts`
- Modify: `src/routes/index.ts` (import + mount `adminAuthRouter`)
- Test: `src/modules/admin/auth/admin-auth.routes.spec.ts`

**Interfaces:**
- Consumes: `service.login/getMe/logout` (Task 5), `sendSuccess` (`../../../common/utils/response.util`), `validateBody` (`../../../common/middleware/validate.middleware`), `requireAdmin` (`../../../common/guards`), `LoginDto` (Task 3).
- Produces: `adminAuthRouter` mounted at `/admin/auth` → final URLs `POST /api/v1/admin/auth/login`, `GET /api/v1/admin/auth/me`, `POST /api/v1/admin/auth/logout`.

- [ ] **Step 1: Write the failing routes spec** — `src/modules/admin/auth/admin-auth.routes.spec.ts`

```ts
jest.mock('./admin-auth.service', () => ({
  login: jest.fn(),
  getMe: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../../../prisma', () => ({
  prisma: { adminUser: { findUnique: jest.fn() } },
}));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { errorHandler } from '../../../common/middleware/error-handler.middleware';
import { env } from '../../../config/env.config';
import { UnauthorizedError } from '../../../common/errors';
import { prisma } from '../../../prisma';
import * as service from './admin-auth.service';
import { adminAuthRouter } from './admin-auth.routes';

const mockLogin = service.login as jest.Mock;
const mockGetMe = service.getMe as jest.Mock;
const mockLogout = service.logout as jest.Mock;
const mockFindUnique = (prisma.adminUser as { findUnique: jest.Mock }).findUnique;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/auth', adminAuthRouter);
  app.use(errorHandler);
  return app;
}

function bearer() {
  const token = jwt.sign({ sub: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN' }, env.ADMIN_JWT_SECRET);
  return `Bearer ${token}`;
}

describe('admin auth routes', () => {
  let app: express.Express;
  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('422s an invalid login body', async () => {
    const res = await request(app).post('/api/v1/admin/auth/login').send({ email: 'bad', password: 'x' });
    expect(res.status).toBe(422);
  });

  it('401s on bad credentials', async () => {
    mockLogin.mockRejectedValue(new UnauthorizedError('Invalid email or password'));
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@arsu.app', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, message: 'Invalid email or password' });
  });

  it('200s with a token + admin on success', async () => {
    mockLogin.mockResolvedValue({ token: 'jwt-123', admin: { id: 'admin-1', email: 'admin@arsu.app' } });
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@arsu.app', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { token: 'jwt-123' } });
  });

  it('401s /me without a token', async () => {
    const res = await request(app).get('/api/v1/admin/auth/me');
    expect(res.status).toBe(401);
  });

  it('200s /me with a valid token', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' });
    mockGetMe.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app' });
    const res = await request(app).get('/api/v1/admin/auth/me').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('admin-1');
    expect(mockGetMe).toHaveBeenCalledWith('admin-1');
  });

  it('200s /logout with a valid token', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin-1', email: 'admin@arsu.app', role: 'ADMIN', status: 'ACTIVE' });
    mockLogout.mockResolvedValue({ success: true });
    const res = await request(app).post('/api/v1/admin/auth/logout').set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx jest admin-auth.routes`
Expected: FAIL — `Cannot find module './admin-auth.routes'`.

- [ ] **Step 3: Implement the controller `src/modules/admin/auth/admin-auth.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../common/errors';
import { sendSuccess } from '../../../common/utils/response.util';
import type { LoginDto } from './dto/login.dto';
import * as adminAuthService from './admin-auth.service';

function requireAdminId(req: Request): string {
  if (!req.admin?.id) throw new UnauthorizedError('Authentication required');
  return req.admin.id;
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await adminAuthService.login(req.body as LoginDto, req.ip);
  sendSuccess(res, result, { message: 'Logged in' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const admin = await adminAuthService.getMe(requireAdminId(req));
  sendSuccess(res, admin);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const result = await adminAuthService.logout(requireAdminId(req), req.ip);
  sendSuccess(res, result, { message: 'Logged out' });
}
```

- [ ] **Step 4: Implement the routes `src/modules/admin/auth/admin-auth.routes.ts`**

```ts
import { Router } from 'express';
import { requireAdmin } from '../../../common/guards';
import { validateBody } from '../../../common/middleware/validate.middleware';
import * as adminAuthController from './admin-auth.controller';
import { LoginDto } from './dto/login.dto';

const router = Router();

router.post('/login', validateBody(LoginDto), adminAuthController.login);
router.get('/me', requireAdmin, adminAuthController.me);
router.post('/logout', requireAdmin, adminAuthController.logout);

export { router as adminAuthRouter };
```

- [ ] **Step 5: Run the routes spec — verify it passes**

Run: `npx jest admin-auth.routes`
Expected: PASS (6 tests).

- [ ] **Step 6: Mount the router in `src/routes/index.ts`**

Add the import alongside the other module-router imports (keep alphabetical-ish grouping):
```ts
import { adminAuthRouter } from '../modules/admin/auth/admin-auth.routes';
```
Add the mount in the `// ── Feature Modules ──` block (place it first, as the admin surface):
```ts
router.use('/admin/auth', adminAuthRouter);
```

- [ ] **Step 7: Full suite + compile**

Run: `npm test`
Expected: all specs pass (existing + all new admin specs).
Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: no errors.

- [ ] **Step 8: Checkpoint.** (Commit only if the user asks.)

---

### Task 8: Seed a first super-admin

**Files:**
- Modify: `src/prisma/seed.ts`

**Interfaces:**
- Consumes: `env.ADMIN_SEED_EMAIL/PASSWORD/NAME` (Task 2), `bcryptjs`, `prisma.adminUser.upsert`.
- Produces: an idempotent super-admin upsert keyed by lowercased email.

- [ ] **Step 1: Edit `src/prisma/seed.ts`** — add imports and an admin-seed block inside `seed()`

Add imports at the top (after the existing two imports):
```ts
import bcrypt from 'bcryptjs';
import { env } from '../config/env.config';
```
Replace the `// TODO: Add seed data here` placeholder block inside `seed()` with:
```ts
  await seedSuperAdmin();
```
And add this function below `seed()` (before the `seed().catch(...)` call):
```ts
async function seedSuperAdmin(): Promise<void> {
  const email = env.ADMIN_SEED_EMAIL.trim().toLowerCase();
  const password = env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    logger.info('⏭️  ADMIN_SEED_EMAIL/PASSWORD not set — skipping super-admin seed');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: env.ADMIN_SEED_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  logger.info(`👑 Super-admin ready: ${admin.email} (${admin.id})`);
}
```
(`update: {}` makes re-runs idempotent — an existing admin's password is **not** overwritten.)

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed`
Expected: logs `🌱 Starting database seed...`, `👑 Super-admin ready: admin@arsu.app (<uuid>)`, `✅ Seed complete`. (Requires `ADMIN_SEED_EMAIL`/`PASSWORD` in `.env.local` from Task 2 Step 5, and the migration from Task 1 applied.)

- [ ] **Step 3: Verify idempotency**

Run: `npm run db:seed`
Expected: same `👑 Super-admin ready` line with the **same** uuid — no duplicate-key error.

- [ ] **Step 4: Checkpoint.** (Commit only if the user asks.)

---

### Task 9: Definition-of-Done verification (whole backend)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: green — including `login.dto`, `admin-audit.repository`, `admin-auth.service`, `admin-auth.guard`, `admin-role.guard`, `admin-auth.routes`, and all pre-existing specs.

- [ ] **Step 2: Type + lint gates**

Run: `npx tsc -p tsconfig.build.json --noEmit` → no errors.
Run: `npm run lint` → no errors.

- [ ] **Step 3: Live smoke test** (backend running on :4000 via `npm run dev`)

```bash
# Login (seeded admin) → expect 200 + token
curl -s -X POST http://localhost:4000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@arsu.app","password":"ChangeMe123!"}'
# Capture the token, then:
TOKEN=<paste token>
curl -s http://localhost:4000/api/v1/admin/auth/me -H "Authorization: Bearer $TOKEN"        # 200 + AdminView
curl -s http://localhost:4000/api/v1/admin/auth/me                                          # 401
curl -s -X POST http://localhost:4000/api/v1/admin/auth/logout -H "Authorization: Bearer $TOKEN"  # 200
curl -s -X POST http://localhost:4000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@arsu.app","password":"wrongpass"}'  # 401 "Invalid email or password"
```

- [ ] **Step 4: Verify the audit trail** (Supabase SQL or `npx prisma studio`)

Confirm `admin_audit_logs` has rows with `action = 'admin.login'` and `action = 'admin.logout'` for the seeded admin.

- [ ] **Step 5: Final checkpoint.** Backend Foundation complete. The frontend plan (`2026-06-22-admin-foundation-frontend.md`) consumes this API contract. (Commit only if the user asks.)

---

## Self-Review

- **Spec coverage:** §4 data model → Task 1; §5 login/me/logout + guards → Tasks 5–7; §5 env → Task 2; §5 seed → Task 8; §8 testing (dto/service/routes/guards/audit specs) → Tasks 3–7; §9 DoD 1–3 → Tasks 1, 8, 9. ✅
- **Type consistency:** `AdminView`/`LoginResult`/`AdminTokenPayload`/`AdminPrincipal` defined once (Task 2) and consumed unchanged in Tasks 5–7 and `express.d.ts`. `writeAuditLog(WriteAuditLogInput)` defined in Task 4, called identically in Task 5. `requireAdmin`/`requireRole` signatures match between Task 6 and Task 7's router. ✅
- **Placeholder scan:** every code step shows complete code; migration SQL is provided in full (and regenerated by the diff command); no "TBD"/"handle errors"/"similar to". ✅
- **Path-depth check:** module files (3-deep) use `../../../`; guards (2-deep) use `../../`/`../`; dto spec uses `../../../../../`. ✅
