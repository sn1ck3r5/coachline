# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Coachline — AI-powered instructional coaching platform for K-12 teachers. Teachers record lessons; an async pipeline transcribes, diarizes, classifies segments, runs coaching analysis, and produces a report with highlighted moments, reflection prompts, talk-time metrics, and progress against a user-set goal.

## Monorepo layout

Turborepo + npm workspaces, Node ≥ 20.

- `apps/server` (`@coachline/server`) — single consolidated service: Fastify HTTP API + Next.js dashboard co-hosted on port 3001. Next.js source lives under `apps/server/web/`.
- `apps/mobile` — Expo / React Native (expo-router)
- `packages/shared` (`@coachline/shared`) — Zod validators, constants, and cross-app TypeScript types; imported via `main: ./src/index.ts` (no build step)
- `prisma/` — single Prisma schema; shared by server and pg-boss queue

## Commands

Run from repo root unless noted.

```bash
# Day-to-day
npm run dev          # turbo dev — starts all apps in parallel
npm run build        # turbo build
npm run typecheck    # turbo typecheck (CI runs this)
npm run lint         # turbo lint
npm run test         # turbo test (vitest across packages)

# Database (Prisma 6, Postgres 16)
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate deploy (production-style)
npm run db:push      # prisma db push (dev only, no migration file)

# Single workspace
npm run dev -w @coachline/server
npm run -w mobile ios           # or: android, web, start

# Single test file / pattern (vitest)
npx vitest run apps/server/tests/routes/auth.test.ts
npx vitest run -t "upload url"  # filter by test name

# After editing prisma/schema.prisma
npx prisma generate              # always; types are emitted into node_modules
npx prisma migrate dev --name <change>   # create a migration locally
```

## Architecture

### Unified server (`apps/server`)

Fastify runs as the HTTP process. All API routes are prefixed `/api/*`. Any request that doesn't match an API route falls through `setNotFoundHandler` to Next.js's request handler. This means:
- API routes must always be registered under `/api/` to avoid colliding with Next.js page paths (e.g. `/api/goals` vs the `/goals` Next.js page)
- Next.js pages live in `apps/server/web/src/app/` (App Router)
- The Next.js build artifact is compiled separately (`cd apps/server && npx next build web`) but served by the same process

### Request → processing flow

1. Client requests a presigned S3 upload URL: `POST /api/recordings/upload-url`.
2. Client uploads the media file directly to S3.
3. Client calls `POST /api/recordings` with the S3 key; the API creates a `LessonRecording` row (status `processing`) and enqueues a pg-boss job on the `lesson-processing` queue (backed by Postgres — no Redis).
4. pg-boss worker (running in the same process) picks up the job and runs `apps/server/src/pipeline/orchestrator.ts`:
   - **transcribe** — Deepgram (diarization + word timings) via presigned GET URL
   - **classify** — local segment classification into teacher/student/group/silence/media, plus talk-time summary
   - **analyze** — AWS Bedrock (Claude Sonnet) extracts raw insights (questions, wait-time, uptake, DOK, praise, teacher moves, FK readability, subject/topic) from diarized segments
   - **report** — Bedrock generates summary / highlighted moments / reflection prompts, factoring in the user's active goal and `LessonRecording.intent`
   - **persist** — single Prisma transaction writes `LessonReport`, `Transcript`, `Insight[]`, optional `GoalProgress`, and flips recording status to `completed`

### Auth

Custom email/password auth in `apps/server/src/plugins/auth.ts` and `src/routes/auth.ts`:

- bcrypt password hashing (12 rounds), `jose` HS256 JWTs
- Access token 15m, refresh token 7d; refresh rotates both
- `fastify.authenticate` decorator reads `Authorization: Bearer <jwt>` and populates `request.userId` / `request.userEmail`
- OAuth/magic-link stubs exist but SMTP/OAuth are not wired — JWT/bcrypt is the live auth path

### Web frontend

- API client in `apps/server/web/src/lib/api.ts`: same-origin calls to `/api/*` with JWT in `localStorage`. Set `NEXT_PUBLIC_API_URL` to point at a separate Fastify process for local dev if needed.
- Auth context in `apps/server/web/src/lib/auth.tsx` handles token storage and silent refresh.
- **Before writing Next.js code**, check `apps/server/web/node_modules/next/dist/docs/` for actual APIs — Next.js 16 has breaking changes from training-data versions.

### Shared types contract

`@coachline/shared` is the single source of truth for cross-process shapes. When changing a DTO:

1. Update the Zod schema in `packages/shared/src/validators/*`
2. Re-export from `packages/shared/src/index.ts`
3. Both server (`safeParse` on request bodies) and clients import from `@coachline/shared`

`LessonRecording.intent` is stored as a plain `String` column (not a Prisma enum) so that extending `LESSON_INTENTS` in `packages/shared/src/constants.ts` doesn't require a DDL migration.

Prisma types (`@prisma/client`) and shared TS types are distinct — shared types are the API/client wire format.

### Prisma data model (summary)

Core models: `User`, `LessonRecording`, `LessonReport` (1:1 with recording), `Transcript` (1:1 with report), `Insight[]`, `Goal`, `GoalProgress`, `AuditLog`. `LessonReport.summary`, `highlightedMoments`, and `reflectionPrompts` are JSONB blobs whose shape is defined in `packages/shared/src/types/report.ts`. All PK/FK columns are UUIDs (`@db.Uuid`).

## CI / deploy

- `.github/workflows/ci.yml` runs typecheck, then tests against ephemeral Postgres 16. `npx prisma migrate deploy` must succeed on the CI database.
- `render.yaml` defines one Render web service (`coachline-api`) + managed Postgres (`coachline-db`). Build command runs `next build`; start command uses `npx tsx src/server.ts` directly on TS sources (no separate compile step for API).
- S3 region: `us-west-1`; Bedrock region: `us-west-2`.

## Shared memory

Project state is auto-loaded at session start from Obsidian:

@~/Obsidian/Claude-Shared-Memory/Projects/coachline/current-state.md

Commands: `/pickup`, `/handoff`, `/journal`, `/decision`.
