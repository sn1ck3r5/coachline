# Coachline MVP Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Author:** Kyle + Claude

## Overview

Coachline is an AI-powered instructional coaching platform that analyzes classroom audio recordings to provide teachers with private, actionable, evidence-based feedback. This spec covers the MVP: a teacher records a lesson, the AI produces a structured coaching report, and the teacher tracks progress toward self-selected goals.

## Scope

**In scope (MVP):**
- Audio recording via mobile app (iOS + Android)
- Audio recording via web browser (MediaRecorder API)
- Audio file upload via web (drag-and-drop, file picker — MP3, WAV, M4A, AAC, OGG)
- Maximum recording length: 90 minutes
- Voice enrollment (teacher voice sample for speaker identification)
- AI analysis: transcription, speaker diarization, talk-time segmentation, question detection/classification, wait time 1 & 2, uptake detection, long/short student contribution detection
- Lesson report: talk-time breakdown, question summary, wait time stats, uptake moments, highlighted moments, reflection prompts, full transcript with audio playback
- Goal setting and progress tracking over time
- Individual teacher accounts (no org hierarchy yet)
- FERPA/COPPA-compliant privacy design

**Out of scope (deferred — see Post-MVP Roadmap):**
- School/district hierarchy, admin dashboards, coach dashboards
- PLC groups, moment sharing, collaborative features
- Zoom/Teams/Meet integrations
- Badges, streaks, monthly challenges
- Per-student equity analytics (virtual)
- SSO/SAML (WorkOS supports it, but not exposed in MVP UI until district sales)

## Architecture

### Deployable Units

| Unit | Tech | Deploys To | Purpose |
|------|------|-----------|---------|
| `apps/mobile` | Expo (React Native) | App Store / Play Store via EAS | Audio recording, lesson review, goal tracking |
| `apps/web` | Next.js | Render static/web service | Teacher dashboard, lesson reports, onboarding |
| `apps/api` | Node.js + Fastify | Render web service | REST API for all clients |
| `apps/worker` | Node.js (BullMQ consumer) | Render background worker | Async audio processing pipeline |
| `packages/shared` | TypeScript | npm workspace (not deployed) | Shared types, validators, constants |

### Managed Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Postgres | Render | Primary database (Prisma ORM) |
| Redis | Render | BullMQ job queue |
| Object Storage | AWS S3 | Audio files, voice enrollment samples |
| Transcription + Diarization | Deepgram | Speech-to-text with speaker labels |
| LLM (coaching analysis) | AWS Bedrock (Claude) | Question classification, uptake detection, report generation |
| Authentication | WorkOS | Email/password, Google OAuth, magic link, SSO/SAML |
| Push Notifications | Expo Push | Notify teacher when report is ready |
| CI/CD | GitHub Actions | Lint, test, deploy |
| Mobile Builds | EAS (Expo) | iOS + Android builds and OTA updates |

### Monorepo Structure

```
coachline/
├── apps/
│   ├── mobile/          # Expo React Native app
│   ├── web/             # Next.js dashboard
│   ├── api/             # Node.js REST API
│   └── worker/          # BullMQ job consumer
├── packages/
│   └── shared/          # Shared types, validators, constants
├── turbo.json
├── package.json
└── tsconfig.base.json
```

### Data Flow

1. Teacher records audio in mobile app (or uploads via web)
2. Client gets a presigned S3 URL from the API, uploads directly to S3
3. API creates a `LessonRecording` record and enqueues a processing job via BullMQ
4. Worker picks up the job:
   - Stage 1: Deepgram transcription + diarization
   - Stage 2: Local segment classification
   - Stage 3: Bedrock coaching analysis
   - Stage 4: Bedrock report generation
   - Stage 5: Persist to Postgres + push notification
5. Client polls or receives push notification when report is ready

## Data Model

```
User
  id                  UUID, PK
  email               string, unique
  name                string
  role                enum (teacher|coach|admin) — MVP: always "teacher"
  avatarUrl           string, nullable
  voiceEnrollmentUrl  string, nullable (S3 path)
  createdAt           timestamp
  updatedAt           timestamp

LessonRecording
  id                  UUID, PK
  userId              UUID, FK → User
  audioUrl            string (S3 path)
  durationSeconds     integer
  fileSizeBytes        integer
  status              enum (uploading|processing|completed|failed)
  title               string, nullable (auto-generated if blank)
  recordedAt          timestamp
  createdAt           timestamp

LessonReport
  id                  UUID, PK
  recordingId         UUID, FK → LessonRecording, unique
  userId              UUID, FK → User
  summary             JSONB (talk time percentages, question counts, wait time stats)
  highlightedMoments  JSONB array (top 3-5 moments with timestamps)
  reflectionPrompts   JSONB array (AI-generated questions)
  status              enum (processing|completed|failed)
  createdAt           timestamp

Transcript
  id                  UUID, PK
  reportId            UUID, FK → LessonReport, unique
  segments            JSONB array ([{speaker, text, startMs, endMs, type}])
  fullText            text (searchable plain text)

Insight
  id                  UUID, PK
  reportId            UUID, FK → LessonReport
  type                enum (question_open|question_closed|question_focusing|
                            question_procedural|question_rhetorical|
                            wait_time_1|wait_time_2|uptake|
                            long_student_talk|short_student_response)
  startMs             integer
  endMs               integer
  durationMs          integer
  metadata            JSONB (type-specific data)
  createdAt           timestamp

Goal
  id                  UUID, PK
  userId              UUID, FK → User
  practiceArea        enum (wait_time|open_questions|student_talk_ratio|uptake|custom)
  targetMetric        string
  customLabel         string, nullable
  status              enum (active|completed|paused)
  createdAt           timestamp
  updatedAt           timestamp

GoalProgress
  id                  UUID, PK
  goalId              UUID, FK → Goal
  reportId            UUID, FK → LessonReport
  value               numeric
  createdAt           timestamp

AuditLog
  id                  UUID, PK
  userId              UUID, FK → User
  action              string (e.g., "recording.delete", "report.view", "account.delete")
  resourceType        string
  resourceId          UUID
  metadata            JSONB
  createdAt           timestamp
```

Key decisions:
- JSONB columns for flexible structured data (summary, segments, metadata) — avoids schema churn as AI analysis evolves. Postgres JSONB is queryable and indexable.
- Insights are normalized rows, not embedded — enables cross-lesson queries and trend charts.
- GoalProgress links goals to reports — each lesson generates a progress data point.
- No school/district tables yet — when needed, add `School`, `District`, and `userId → schoolId` FK.

## AI Processing Pipeline

### Stage 1: Transcription + Diarization (Deepgram)

- Input: S3 audio URL
- Output: Timestamped transcript with speaker labels
- Deepgram returns diarized speakers as numbered IDs (Speaker 0, Speaker 1, etc.)
- Post-diarization speaker matching: compare voice characteristics of each speaker against the teacher's enrollment sample to identify which speaker ID is the teacher. Approaches: (a) the teacher is likely the dominant speaker — use talk-time heuristic as primary signal, confirmed by the enrollment sample via an embedding similarity check if Deepgram or a lightweight model supports it, or (b) send a short sample of each speaker + the enrollment sample to Bedrock for identification. Start with the heuristic approach (simplest); add embedding-based confirmation if accuracy is insufficient.
- All non-teacher speakers labeled as "Student" (aggregate)

### Stage 2: Segment Classification (local logic)

- Input: Diarized transcript
- Output: Talk-time segments classified as: teacher_talk, student_talk, group_talk, silence, media
- Rules-based from diarization output: measure gaps (silence), overlapping speakers (group_talk), single speakers (teacher/student)
- Calculates percentages and builds timeline data

### Stage 3: Coaching Analysis (Bedrock / Claude)

- Input: Classified transcript + segments
- Output: Structured insights matching the Insight schema
- Single structured prompt with JSON output schema:
  - Identify all teacher questions, classify by type (open-ended, closed/recall, focusing/probing, procedural, rhetorical)
  - Detect wait time 1 and 2 instances, measure duration
  - Detect uptake moments (teacher building on student contributions)
  - Flag long student contributions (>7s) and short responses (<3s)
- For 90-min lessons: chunk transcript into ~15-min windows with overlap to avoid missing cross-boundary patterns

### Stage 4: Report Generation (Bedrock / Claude)

- Input: All insights + transcript + segment data
- Output: Lesson summary, highlighted moments, reflection prompts
- Second Claude call synthesizing raw insights into:
  - Human-readable summary stats
  - Top 3-5 highlighted moments (best examples of teacher's focus practice)
  - 2-3 personalized reflection prompts based on the data
- If teacher has an active Goal, tailor highlights and prompts toward that goal's practice area

### Stage 5: Persistence + Notification

- Single transaction write: LessonReport, Transcript, Insights, GoalProgress
- Update LessonRecording status to "completed"
- Send Expo push notification to mobile app

### Error Handling

- Each stage is independently retryable
- After 3 retries per stage, mark recording as `failed` and notify teacher with option to re-process
- Failed jobs include error context for debugging

## API Design

REST API served from `apps/api`. All endpoints require authentication (WorkOS JWT) except auth routes.

### Auth

```
POST   /auth/signup              email/password registration
POST   /auth/login               email/password login
POST   /auth/magic-link          send magic link email
GET    /auth/callback            OAuth/magic link/SSO callback
POST   /auth/refresh             refresh access token
DELETE /auth/logout              revoke session
```

### Recordings

```
POST   /recordings/upload-url   presigned S3 URL for upload
POST   /recordings              create recording record + enqueue processing
GET    /recordings               list user's recordings (paginated, cursor-based)
GET    /recordings/:id           recording details + status
DELETE /recordings/:id           delete recording + S3 object + all associated data
```

### Voice Enrollment

```
POST   /voice-enrollment/upload-url   presigned URL for voice sample
POST   /voice-enrollment              save enrollment record
GET    /voice-enrollment              current enrollment status
```

### Reports

```
GET    /reports                  list user's lesson reports (paginated, filterable)
GET    /reports/:id              full report (summary, highlights, reflections)
GET    /reports/:id/transcript   transcript with segments
GET    /reports/:id/insights     insights list (filterable by type)
GET    /reports/:id/audio-url    time-limited presigned playback URL
```

### Goals

```
POST   /goals                   create a new goal
GET    /goals                   list user's goals
PATCH  /goals/:id               update goal (status, target)
GET    /goals/:id/progress      progress data points across lessons
```

### User

```
GET    /users/me                current user profile
PATCH  /users/me                update profile
DELETE /users/me                delete account + all data (FERPA compliance)
```

### Design Decisions

- Presigned URLs for audio — clients upload/download directly to/from S3, never through the API
- All data scoped to authenticated user — every query filters by userId from JWT
- Hard delete on recording deletion — removes S3 object, all reports, insights, transcript
- Cursor-based pagination for list endpoints

## Mobile App (Expo)

### Screens

1. **Welcome / Sign In** — email input, Continue with Email, Continue with Google, Sign in with SSO
2. **Voice Enrollment** — guided 30-second voice sample recording during onboarding
3. **Home / Dashboard** — active goal progress card, recent lessons with key stats, big record button
   - Web also includes: browser-based recording (MediaRecorder API), drag-and-drop file upload
4. **Recording** — timer, waveform visualization, background recording support, stop button
5. **Lesson Report** — talk-time bar chart, stat cards (questions, wait time, uptake), highlighted moments with audio playback links, reflection prompts
6. **Lessons List** — paginated history of all recorded lessons with status and summary stats
7. **Goal Selection** — curated practice areas (wait time, open questions, student talk ratio, uptake) + custom
8. **Goal Progress** — trend line chart over time, starting vs current metric, lesson count
9. **Profile** — account settings, voice enrollment status, delete account

### Tab Navigation

Home | Lessons | Record (center) | Goals | Profile

### UI Stack

- **ReactBits** — Aurora backgrounds, animated text/counters, spotlight cards, gradient effects (web dashboard, with Reanimated-inspired equivalents on mobile)
- **Nativewind** — Tailwind CSS for React Native
- **Tailwind CSS** — Next.js web dashboard
- **react-native-reanimated** — animations on mobile (ReactBits-inspired patterns)
- **Recharts** (web) / **Victory Native** (mobile) — goal progress trend charts

## Security & Privacy

### Encryption

- All data encrypted at rest: Postgres (Render managed, AES-256), S3 (SSE-S3 or SSE-KMS)
- All data encrypted in transit: TLS 1.2+ everywhere
- Presigned S3 URLs: 15-min expiry for uploads, 1-hour expiry for playback

### Authentication & Sessions

- WorkOS handles all auth flows
- JWTs: 15-min access token, 7-day refresh token
- Refresh tokens: HTTP-only cookies (web), secure storage (mobile)
- All auth endpoints rate-limited

### Authorization

- Every API query filters by authenticated user's ID
- No endpoint can return another user's data
- MVP: single role (teacher). When org hierarchy is added, Postgres row-level security enforces boundaries.

### Data Ownership & Deletion

- `DELETE /users/me`: cascading hard delete of all user data (DB + S3)
- `DELETE /recordings/:id`: hard delete of S3 object + all downstream data in single transaction
- No soft deletes for user-facing data

### Student Privacy

- In-person recordings: all student audio treated as aggregate
- No individual student identification, no student names stored
- Transcripts label speakers as "Teacher" and "Student" (generic)
- Voice enrollment is teacher-only

### Audit Logging

- Append-only audit table for all data access, sharing, deletion, admin actions
- Retained for 2 years
- Never contains audio content or transcript text — metadata only

### Compliance

- FERPA: education records encrypted, access-controlled, deletable, no third-party sharing of raw data
- COPPA: no data collected directly from children
- DPA template ready for district procurement

## Testing Strategy

### Unit Tests (Vitest)

- Shared package validators and type guards
- AI pipeline stage logic (segment classification, transcript chunking)
- API route handlers (auth checks, input validation, response shaping)
- Goal progress calculation logic

### Integration Tests (Vitest + Supertest)

- API endpoints against real test Postgres
- Full auth flows
- Recording lifecycle (create → upload → process → report)
- Deletion cascades

### E2E Tests (Detox for mobile, Playwright for web)

- Golden paths only:
  - Sign up → voice enrollment → record → view report
  - Set goal → record → check progress
  - Delete recording → confirm gone

### CI Pipeline (GitHub Actions)

- Lint + type check on every push
- Unit + integration tests on every PR
- E2E tests on main branch merges only
- Security scan before deploy

## Post-MVP Roadmap

### Wave 2 — After First Pilot Users

| ID | Feature |
|----|---------|
| AI-05 | Student question detection |
| AI-10 | Short student response detection |
| AI-11 | Student cross-talk / student-to-student talk detection |
| AI-14 | Practice tagging inline in transcript |
| LR-10 | Reflection journal / teacher response capture |
| LR-11 | Lesson comparison across lessons |
| LR-13 | PDF export of lesson reports |
| TG-03 | Practice score card per lesson |
| TG-04 | Badges and milestones |
| TG-07 | Iteration tracking (record/reflect/adjust cycles) |

### Wave 3 — District Sales

| ID | Feature |
|----|---------|
| AD-01 | Aggregated school-level admin dashboard |
| AD-03 | Subject/grade-level filtering |
| AD-05 | PD impact measurement |
| AD-06 | CSV/PDF export for admin dashboards |
| AD-07 | Role-based access control (teacher/coach/admin) |
| CL-01–03 | PLC Studio (groups, moment sharing, comments) |
| CL-04 | Coach-teacher sharing |
| EQ-01 | Equity of voice — virtual per-student analytics |
| EQ-04 | Equity trend tracking |
| INT-07 | SCIM provisioning |

### Wave 4 — Platform Maturity

| ID | Feature |
|----|---------|
| AC-09 | Offline recording with sync-on-reconnect |
| AD-02 | District-level dashboard |
| AD-04 | Coaching insights for leaders |
| AI-12 | Academic vocabulary extraction |
| AI-15 | Specific praise detection |
| AI-16 | Discourse pattern classification (ping-pong vs volleyball) |
| AI-17 | Lesson segment detection |
| AL-03 | Spanish language UI |
| AL-04 | Multilingual classroom support |
| CL-05 | Observation companion mode |
| EQ-05 | Equity coaching prompts |
| INT-01–03 | Zoom / Teams / Google Meet integrations |
| INT-04–05 | SIS and LMS integrations |
| LR-12 | Lesson snapshot image |
| SP-09 | SOC 2 Type II certification |
| TG-05 | Monthly challenges |
| TG-06 | Streaks |
