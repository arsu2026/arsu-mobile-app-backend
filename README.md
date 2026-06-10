# ARSU Mobile App — Backend API

> Node.js · Express · TypeScript · Prisma · PostgreSQL (Supabase)

---

## 🏗 Project Structure

```
arsu-mobile-app-backend/
├── prisma/
│   ├── schema.prisma          # Prisma data model + datasource config
│   └── migrations/            # Auto-generated migration files
│
├── src/
│   ├── server.ts              # Entry point — bootstraps app + graceful shutdown
│   ├── app.ts                 # Express app factory — registers all middleware
│   │
│   ├── config/
│   │   ├── env.config.ts      # Type-safe env loader (validates required vars)
│   │   ├── cors.config.ts     # CORS options (origin whitelist)
│   │   ├── session.config.ts  # express-session options
│   │   ├── rate-limit.config.ts # express-rate-limit options
│   │   ├── passport.config.ts # Passport JWT + Local strategy setup
│   │   ├── mailer.config.ts   # Nodemailer transport
│   │   └── supabase.config.ts # Supabase client (public) + admin client
│   │
│   ├── prisma/
│   │   ├── prisma.client.ts   # Singleton PrismaClient (dev hot-reload safe)
│   │   ├── seed.ts            # Database seed script
│   │   └── index.ts           # Barrel export
│   │
│   ├── common/
│   │   ├── errors/
│   │   │   └── app.error.ts   # AppError + subclasses (NotFound, Unauthorized…)
│   │   ├── guards/
│   │   │   └── auth.guard.ts  # jwtGuard + localGuard middleware factories
│   │   ├── middleware/
│   │   │   ├── error-handler.middleware.ts  # Central Express error handler
│   │   │   ├── not-found.middleware.ts      # 404 catch-all
│   │   │   ├── request-id.middleware.ts     # X-Request-ID attachment
│   │   │   └── validate.middleware.ts       # class-validator DTO validation
│   │   └── utils/
│   │       ├── logger.ts          # Structured console logger
│   │       ├── response.util.ts   # sendSuccess / sendError helpers
│   │       └── paginate.util.ts   # Prisma pagination helper
│   │
│   ├── types/
│   │   ├── global.types.ts    # JwtPayload, pagination types, utility types
│   │   ├── express.d.ts       # Augments Express.User with JwtPayload
│   │   └── index.ts           # Barrel export
│   │
│   ├── routes/
│   │   └── index.ts           # Root API router — mounts feature module routers
│   │
│   └── modules/               # Feature modules (empty — to be built)
│       └── README.md          # Module structure guide
│
├── .env.example               # All required env vars with documentation
├── .gitignore
├── .npmrc                     # legacy-peer-deps=true
├── .prettierrc
├── eslint.config.mjs          # ESLint flat config
├── jest.config.ts
├── tsconfig.json
├── tsconfig.build.json        # Build-only config (excludes test files)
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js >= 20
- npm >= 10
- A Supabase project

### 2. Environment Setup

```bash
cp .env.example .env.local
# Fill in your values in .env.local
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Migrations

```bash
npm run migration:generate:local   # creates + applies a new migration
# or
npm run migration:run:local        # applies pending migrations
```

### 6. Start Dev Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api/v1`

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run dev:debug` | Start with Node.js inspector |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start compiled production server |
| `npm run lint` | Lint all TypeScript files |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format with Prettier |
| `npm test` | Run Jest test suite |
| `npm run test:cov` | Run tests with coverage report |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run migration:generate:local` | Create a new migration |
| `npm run db:seed` | Run database seed script |

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Express 5 |
| ORM | Prisma 6 |
| Database | PostgreSQL (Supabase) |
| Auth | Passport.js (JWT + Local) |
| Validation | class-validator + class-transformer |
| Email | Nodemailer |
| Security | Helmet, CORS, express-rate-limit |
| Testing | Jest + ts-jest + Supertest |
| Code Quality | ESLint + Prettier |

---

## 🏛 Adding a Feature Module

```
src/modules/
└── users/
    ├── users.routes.ts       # Router
    ├── users.controller.ts   # Request handler
    ├── users.service.ts      # Business logic
    ├── users.repository.ts   # Prisma queries
    ├── dto/
    │   ├── create-user.dto.ts
    │   └── update-user.dto.ts
    └── users.spec.ts         # Tests
```

Then mount in `src/routes/index.ts`:
```ts
import { usersRouter } from '../modules/users/users.routes';
router.use('/users', usersRouter);
```
