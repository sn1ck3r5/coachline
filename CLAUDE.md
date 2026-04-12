# Coachline

AI-powered instructional coaching platform for K-12 teachers.

## Tech Stack

- **Monorepo:** Turborepo (TypeScript)
- **Mobile:** Expo (React Native)
- **Web:** Next.js
- **API:** Fastify (Node.js)
- **Worker:** BullMQ (Node.js)
- **Database:** Postgres (Prisma ORM)
- **Queue:** Redis (BullMQ)
- **Storage:** AWS S3
- **AI:** Deepgram (transcription/diarization), AWS Bedrock / Claude (coaching analysis)
- **Auth:** WorkOS
- **Hosting:** Render
- **CI:** GitHub Actions

## Shared Memory

This project uses cross-device shared memory via Obsidian.

Project state (auto-loaded at session start):
@~/Obsidian/Claude-Shared-Memory/Projects/coachline/current-state.md

Commands: /pickup, /handoff, /journal, /decision
