# ARSU Mobile App — Modules

This directory contains all feature modules for the ARSU Mobile App backend.

## Structure

Each module follows this pattern:

```
modules/
└── <feature>/
    ├── <feature>.routes.ts      # Express router + route definitions
    ├── <feature>.controller.ts  # Request/response handling (thin layer)
    ├── <feature>.service.ts     # Business logic
    ├── <feature>.repository.ts  # Database queries (Prisma)
    ├── dto/
    │   ├── create-<feature>.dto.ts
    │   └── update-<feature>.dto.ts
    └── <feature>.spec.ts        # Unit tests
```

## Planned Modules

- `auth/`         — Registration, login, JWT, refresh tokens
- `users/`        — User profile management
- `posts/`        — Feed posts, media upload
- `feed/`         — Personalised feed algorithm
- `stories/`      — Stories / ephemeral content
- `notifications/`— Push + in-app notifications
- `follows/`      — Follow/unfollow graph
- `media/`        — Supabase Storage integration

## Adding a New Module

1. Create the folder under `modules/<name>/`
2. Create the router and mount it in `src/routes/index.ts`
3. Inject `prisma` from `../../prisma`
