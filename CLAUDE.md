# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Coachline — AI-powered instructional coaching platform for K-12 teachers. Teachers record lessons; an async pipeline transcribes, diarizes, classifies segments, runs coaching analysis, and produces a report with highlighted moments, reflection prompts, talk-time metrics, and progress against a user-set goal.

## Monorepo layout

Turborepo + npm workspaces, Node ≥ 20.

- `apps/api` — Fastify HTTP API (`@coachline/api`), port 3001
- `apps/worker` — BullMQ worker (`@coachline/worker`), port 3002 (health only)
- `apps/web` — Next.js dashboard (port 3000)
- `apps/mobile` — Expo / React Native (expo-router)
- `packages/shared` (`@coachline/shared`) — Zod validators, constants, and cross-app TypeScript types; imported via `main: ./src/index.ts` (no build step)
- `prisma/` — single Prisma schema consumed by API and worker

## Commands

Run from repo root unless noted.

```bash
# Day-to-day
npm run dev                      # turbo dev — starts all apps in parallel
npm run build                    # turbo build
npm run typecheck                # turbo typecheck (CI runs this)
npm run lint                     # turbo lint
npm run test                     # turbo test (vitest across packages)

# Database (Prisma 6, Postgres 16)
npm run db:generate              # prisma generate
npm run db:migrate               # prisma migrate deploy (production-style)
npm run db:push                  # prisma db push (dev only, no migration file)

# Single app
npm run dev -w @coachline/api
npm run dev -w @coachline/worker
npm run dev -w web               # Next.js dev server
npm run -w mobile ios            # or: android, web, start

# Single test file / pattern (vitest)
npx vitest run apps/api/tests/routes/recordings.test.ts
npx vitest run -t "upload url"   # filter by test name

# After editing prisma/schema.prisma
npx prisma generate              # always; types are emitted into node_modules
npx prisma migrate dev --name <change>   # create a migration locally
```

## Architecture

### Request → processing flow

1. Client requests a presigned S3 upload URL: `POST /recordings/upload-url`.
2. Client uploads the media file directly to S3.
3. Client calls `POST /recordings` with the S3 key; the API creates a `LessonRecording` row (status `processing`) and enqueues a BullMQ job on the `lesson-processing` queue (Redis).
4. Worker picks up the job and runs `apps/worker/src/pipeline/orchestrator.ts`:
   - **transcribe** — Deepgram (diarization + word timings) via presigned GET URL
   - **classify** — local segment classification into teacher/student/group/silence/media, plus talk-time summary
   - **analyze** — AWS Bedrock (Claude) extracts raw insights (questions, wait-time, uptake, etc.) from diarized segments
   - **report** — Bedrock generates summary / highlighted moments / reflection prompts, factoring in the user's active goal
   - **persist** — single Prisma transaction writes `LessonReport`, `Transcript`, `Insight[]`, optional `GoalProgress`, and flips recording status to `completed`
5. On failure the worker writes the error into the recording's `title` field as `ERROR: ...` so it surfaces through the API (temporary debug mechanism — see `apps/worker/src/index.ts`).

### Auth (current state)

The API ships custom email/password auth in `apps/api/src/plugins/auth.ts` and `routes/auth.ts`:

- bcrypt password hashing (12 rounds), `jose` HS256 JWTs
- Access token 15m, refresh token 7d; refresh rotates both
- `fastify.authenticate` decorator reads `Authorization: Bearer <jwt>` and populates `request.userId` / `request.userEmail`
- `/auth/magic-link` and `/auth/callback` are stubs (SMTP + OAuth not wired)

Note: the product direction mentions WorkOS, but the implemented flow is JWT/bcrypt. Don't assume WorkOS primitives exist in code.

### Shared types contract

`@coachline/shared` is the single source of truth for cross-process shapes. When you change a DTO:

1. Update the Zod schema in `packages/shared/src/validators/*`
2. Re-export it from `packages/shared/src/index.ts`
3. Both API (`safeParse` on request bodies) and clients import from `@coachline/shared` — no duplicate type definitions

Prisma models and shared TS types overlap but are distinct — Prisma types come from `@prisma/client`, shared types are the API/client wire format.

### Prisma data model (summary)

Core models: `User`, `LessonRecording`, `LessonReport` (1:1 with recording), `Transcript` (1:1 with report), `Insight[]`, `Goal`, `GoalProgress`, `AuditLog`. `LessonReport.summary`, `highlightedMoments`, and `reflectionPrompts` are JSONB blobs whose shape is defined in `packages/shared/src/types/report.ts`. All PK/FK columns are UUIDs (`@db.Uuid`).

### Web app (`apps/web`)

Heads-up in `apps/web/AGENTS.md`: **this is a newer Next.js with breaking changes from what's in your training data.** Before writing Next.js code, consult `apps/web/node_modules/next/dist/docs/` for the actual APIs. Heed deprecation notices.

## CI / deploy

- `.github/workflows/ci.yml` runs typecheck, then tests against ephemeral Postgres 16 + Redis 7 services. `npx prisma migrate deploy` must succeed on the CI database.
- `render.yaml` defines three Render web services (api, worker, web) + Redis + managed Postgres. The worker runs as a **web** service (not background worker) because it needs a `/health` endpoint for Render's free tier. Worker S3 region is `us-west-1`; Bedrock region is `us-west-2`.
- Start commands use `npx tsx` directly on TS sources in production (no build step for api/worker).

## Shared memory

Project state is auto-loaded at session start from Obsidian:

@~/Obsidian/Claude-Shared-Memory/Projects/coachline/current-state.md

Commands: `/pickup`, `/handoff`, `/journal`, `/decision`.
