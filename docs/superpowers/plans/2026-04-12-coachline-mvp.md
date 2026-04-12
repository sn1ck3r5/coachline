# Coachline MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working MVP where a teacher can record classroom audio, receive an AI-generated coaching report (talk time, questions, wait time, uptake, highlights, reflection prompts), and track progress toward self-selected goals.

**Architecture:** TypeScript Turborepo monorepo with 4 apps (Expo mobile, Next.js web, Fastify API, BullMQ worker) and 1 shared package. Audio uploads to S3 via presigned URLs. Async pipeline: Deepgram transcription/diarization → local segment classification → Bedrock coaching analysis → Bedrock report generation. WorkOS for auth. Postgres via Prisma. Redis for BullMQ.

**Tech Stack:** TypeScript, Turborepo, Expo (React Native), Next.js 14, Fastify, BullMQ, Prisma, Postgres, Redis, AWS S3, Deepgram, AWS Bedrock (Claude), WorkOS, Vitest, Nativewind, ReactBits

**Spec:** `docs/superpowers/specs/2026-04-12-coachline-mvp-design.md`

---

## File Structure

```
coachline/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts              # Fastify server setup, plugin registration
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts            # WorkOS JWT verification plugin
│   │   │   │   ├── cors.ts            # CORS configuration
│   │   │   │   └── rate-limit.ts      # Rate limiting plugin
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts            # POST signup, login, magic-link, refresh; GET callback; DELETE logout
│   │   │   │   ├── recordings.ts      # POST upload-url, POST create; GET list, GET by id; DELETE
│   │   │   │   ├── voice-enrollment.ts # POST upload-url, POST create; GET status
│   │   │   │   ├── reports.ts         # GET list, GET by id, GET transcript, GET insights, GET audio-url
│   │   │   │   ├── goals.ts           # POST create; GET list; PATCH update; GET progress
│   │   │   │   └── users.ts           # GET me; PATCH me; DELETE me
│   │   │   ├── services/
│   │   │   │   ├── s3.ts              # Presigned URL generation, object deletion
│   │   │   │   ├── queue.ts           # BullMQ producer — enqueue processing jobs
│   │   │   │   └── push.ts            # Expo push notification sender
│   │   │   └── middleware/
│   │   │       └── audit.ts           # Audit log writer
│   │   ├── tests/
│   │   │   ├── routes/
│   │   │   │   ├── auth.test.ts
│   │   │   │   ├── recordings.test.ts
│   │   │   │   ├── reports.test.ts
│   │   │   │   ├── goals.test.ts
│   │   │   │   └── users.test.ts
│   │   │   └── setup.ts              # Test database setup, Fastify test instance
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── worker/
│   │   ├── src/
│   │   │   ├── index.ts              # BullMQ worker entrypoint
│   │   │   ├── pipeline/
│   │   │   │   ├── orchestrator.ts    # Runs stages sequentially, handles retries
│   │   │   │   ├── transcribe.ts      # Stage 1: Deepgram transcription + diarization
│   │   │   │   ├── classify.ts        # Stage 2: Talk-time segment classification
│   │   │   │   ├── analyze.ts         # Stage 3: Bedrock coaching analysis
│   │   │   │   └── report.ts          # Stage 4: Bedrock report generation
│   │   │   └── services/
│   │   │       ├── deepgram.ts        # Deepgram SDK wrapper
│   │   │       ├── bedrock.ts         # Bedrock SDK wrapper
│   │   │       └── speaker-match.ts   # Post-diarization teacher identification
│   │   ├── tests/
│   │   │   ├── pipeline/
│   │   │   │   ├── classify.test.ts
│   │   │   │   ├── analyze.test.ts
│   │   │   │   ├── report.test.ts
│   │   │   │   └── orchestrator.test.ts
│   │   │   └── services/
│   │   │       └── speaker-match.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── web/
│   │   ├── src/
│   │   │   └── app/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx           # Landing / sign-in
│   │   │       ├── (auth)/
│   │   │       │   ├── login/page.tsx
│   │   │       │   ├── signup/page.tsx
│   │   │       │   └── callback/page.tsx
│   │   │       └── (dashboard)/
│   │   │           ├── layout.tsx     # Authenticated layout with nav
│   │   │           ├── page.tsx       # Home dashboard
│   │   │           ├── lessons/
│   │   │           │   ├── page.tsx   # Lesson list
│   │   │           │   └── [id]/page.tsx  # Lesson report
│   │   │           ├── record/page.tsx    # Browser recording + upload
│   │   │           ├── goals/
│   │   │           │   ├── page.tsx   # Goals list + create
│   │   │           │   └── [id]/page.tsx  # Goal progress
│   │   │           └── profile/page.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   └── next.config.js
│   └── mobile/
│       ├── app/
│       │   ├── _layout.tsx            # Root layout with auth guard
│       │   ├── (auth)/
│       │   │   ├── _layout.tsx
│       │   │   ├── welcome.tsx
│       │   │   ├── login.tsx
│       │   │   └── voice-enrollment.tsx
│       │   └── (tabs)/
│       │       ├── _layout.tsx        # Tab navigator
│       │       ├── index.tsx          # Home dashboard
│       │       ├── lessons/
│       │       │   ├── index.tsx      # Lesson list
│       │       │   └── [id].tsx       # Lesson report
│       │       ├── record.tsx         # Recording screen
│       │       ├── goals/
│       │       │   ├── index.tsx      # Goals list + create
│       │       │   └── [id].tsx       # Goal progress
│       │       └── profile.tsx
│       ├── components/
│       │   ├── LessonTimeline.tsx     # Color-coded talk-time bar
│       │   ├── StatCard.tsx           # Metric display card
│       │   ├── HighlightCard.tsx      # Highlighted moment with play button
│       │   ├── GoalProgressChart.tsx  # Trend line chart
│       │   ├── AudioRecorder.tsx      # Recording UI with waveform
│       │   └── AudioPlayer.tsx        # Playback with seek to timestamp
│       ├── lib/
│       │   ├── api.ts                 # API client (fetch wrapper with auth)
│       │   ├── auth.ts                # Auth state management
│       │   └── storage.ts             # Secure token storage
│       ├── package.json
│       ├── tsconfig.json
│       ├── app.json
│       └── nativewind-env.d.ts
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── user.ts
│       │   │   ├── recording.ts
│       │   │   ├── report.ts
│       │   │   ├── insight.ts
│       │   │   ├── goal.ts
│       │   │   └── api.ts            # Request/response types for all endpoints
│       │   ├── validators/
│       │   │   ├── recording.ts
│       │   │   ├── goal.ts
│       │   │   └── user.ts
│       │   ├── constants.ts           # Insight types, goal practice areas, etc.
│       │   └── index.ts               # Re-exports
│       ├── tests/
│       │   └── validators.test.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── turbo.json
├── package.json
├── tsconfig.base.json
├── .gitignore
├── .env.example
├── CLAUDE.md
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-04-12-coachline-mvp-design.md
        └── plans/
            └── 2026-04-12-coachline-mvp.md   # (this file)
```

---

## Task 1: Initialize Git Repo and Turborepo Monorepo

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`
- Create: `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `apps/mobile/app.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/kyle/Desktop/projects/coachline
git init
git remote add origin git@github.com:sn1ck3r5/coachline.git
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "coachline",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "prettier": "^3.4.0"
  },
  "packageManager": "npm@10.9.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.next/
.expo/
.turbo/
.env
.env.local
*.tsbuildinfo
.superpowers/
```

- [ ] **Step 6: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/coachline

# Redis
REDIS_URL=redis://localhost:6379

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=coachline-audio

# Deepgram
DEEPGRAM_API_KEY=

# AWS Bedrock
BEDROCK_REGION=us-east-1

# WorkOS
WORKOS_API_KEY=
WORKOS_CLIENT_ID=

# Expo Push
EXPO_ACCESS_TOKEN=

# App
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
```

- [ ] **Step 7: Create packages/shared/package.json**

```json
{
  "name": "@coachline/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^3.1.0",
    "typescript": "^5.7.0"
  },
  "dependencies": {
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 8: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "node_modules"]
}
```

- [ ] **Step 9: Create packages/shared/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 10: Create apps/api/package.json**

```json
{
  "name": "@coachline/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@coachline/shared": "*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/rate-limit": "^10.2.0",
    "@fastify/cookie": "^11.0.0",
    "@prisma/client": "^6.4.0",
    "@aws-sdk/client-s3": "^3.750.0",
    "@aws-sdk/s3-request-presigner": "^3.750.0",
    "bullmq": "^5.30.0",
    "jose": "^6.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.1.0",
    "@types/node": "^22.0.0",
    "prisma": "^6.4.0"
  }
}
```

- [ ] **Step 11: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "node_modules"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 12: Create apps/api/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 13: Create apps/worker/package.json**

```json
{
  "name": "@coachline/worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@coachline/shared": "*",
    "@prisma/client": "^6.4.0",
    "bullmq": "^5.30.0",
    "@deepgram/sdk": "^3.9.0",
    "@aws-sdk/client-bedrock-runtime": "^3.750.0",
    "expo-server-sdk": "^3.13.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 14: Create apps/worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "node_modules"],
  "references": [{ "path": "../../packages/shared" }]
}
```

- [ ] **Step 15: Create apps/worker/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 16: Create apps/web scaffolding**

```bash
cd apps
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

After creation, update `apps/web/package.json` to add `@coachline/shared` dependency:

```json
{
  "dependencies": {
    "@coachline/shared": "*"
  }
}
```

- [ ] **Step 17: Create apps/mobile scaffolding**

```bash
cd apps
npx create-expo-app@latest mobile --template blank-typescript
```

After creation, update `apps/mobile/package.json` to add workspace dependency:

```json
{
  "dependencies": {
    "@coachline/shared": "*"
  }
}
```

- [ ] **Step 18: Install all dependencies**

```bash
cd /Users/kyle/Desktop/projects/coachline
npm install
```

Run: `npx turbo typecheck`
Expected: All packages pass type checking (possibly with warnings on empty apps, which is fine)

- [ ] **Step 19: Commit**

```bash
git add -A
git commit -m "chore: initialize Turborepo monorepo with all app scaffolding"
```

---

## Task 2: Shared Types and Validators

**Files:**
- Create: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/types/recording.ts`
- Create: `packages/shared/src/types/report.ts`
- Create: `packages/shared/src/types/insight.ts`
- Create: `packages/shared/src/types/goal.ts`
- Create: `packages/shared/src/types/api.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/validators/recording.ts`
- Create: `packages/shared/src/validators/goal.ts`
- Create: `packages/shared/src/validators/user.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/tests/validators.test.ts`

- [ ] **Step 1: Write validator tests**

Create `packages/shared/tests/validators.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  CreateRecordingSchema,
  CreateGoalSchema,
  UpdateGoalSchema,
  UpdateUserSchema,
} from "../src/validators";

describe("CreateRecordingSchema", () => {
  it("accepts valid recording input", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 2700,
      fileSizeBytes: 45000000,
      title: "Period 3 Biology",
    });
    expect(result.success).toBe(true);
  });

  it("rejects recording over 90 minutes", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 5401,
      fileSizeBytes: 45000000,
    });
    expect(result.success).toBe(false);
  });

  it("allows empty title", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 1800,
      fileSizeBytes: 30000000,
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateGoalSchema", () => {
  it("accepts valid goal with preset practice area", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "wait_time",
      targetMetric: "3+ seconds average wait time",
    });
    expect(result.success).toBe(true);
  });

  it("requires customLabel for custom practice area", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "custom",
      targetMetric: "my target",
    });
    expect(result.success).toBe(false);
  });

  it("accepts custom goal with label", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "custom",
      targetMetric: "50% student talk",
      customLabel: "More student voice in discussions",
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateGoalSchema", () => {
  it("accepts status update", () => {
    const result = UpdateGoalSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = UpdateGoalSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateUserSchema", () => {
  it("accepts name update", () => {
    const result = UpdateUserSchema.safeParse({ name: "Ms. Rodriguez" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = UpdateUserSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL — modules not found

- [ ] **Step 3: Create constants**

Create `packages/shared/src/constants.ts`:

```typescript
export const INSIGHT_TYPES = [
  "question_open",
  "question_closed",
  "question_focusing",
  "question_procedural",
  "question_rhetorical",
  "wait_time_1",
  "wait_time_2",
  "uptake",
  "long_student_talk",
  "short_student_response",
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

export const PRACTICE_AREAS = [
  "wait_time",
  "open_questions",
  "student_talk_ratio",
  "uptake",
  "custom",
] as const;

export type PracticeArea = (typeof PRACTICE_AREAS)[number];

export const RECORDING_STATUSES = [
  "uploading",
  "processing",
  "completed",
  "failed",
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

export const REPORT_STATUSES = [
  "processing",
  "completed",
  "failed",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const GOAL_STATUSES = ["active", "completed", "paused"] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const SEGMENT_TYPES = [
  "teacher_talk",
  "student_talk",
  "group_talk",
  "silence",
  "media",
] as const;

export type SegmentType = (typeof SEGMENT_TYPES)[number];

export const MAX_RECORDING_SECONDS = 5400; // 90 minutes

export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg",      // MP3
  "audio/wav",        // WAV
  "audio/x-m4a",     // M4A
  "audio/mp4",       // M4A variant
  "audio/aac",       // AAC
  "audio/ogg",       // OGG
] as const;
```

- [ ] **Step 4: Create type definitions**

Create `packages/shared/src/types/user.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: "teacher" | "coach" | "admin";
  avatarUrl: string | null;
  voiceEnrollmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Create `packages/shared/src/types/recording.ts`:

```typescript
import type { RecordingStatus } from "../constants";

export interface LessonRecording {
  id: string;
  userId: string;
  audioUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
  status: RecordingStatus;
  title: string | null;
  recordedAt: string;
  createdAt: string;
}
```

Create `packages/shared/src/types/report.ts`:

```typescript
import type { ReportStatus, SegmentType } from "../constants";

export interface TalkTimeSummary {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

export interface QuestionSummary {
  total: number;
  openEnded: number;
  closed: number;
  focusing: number;
  procedural: number;
  rhetorical: number;
}

export interface WaitTimeSummary {
  waitTime1Count: number;
  waitTime1AvgMs: number;
  waitTime2Count: number;
  waitTime2AvgMs: number;
  bestMoments: Array<{ startMs: number; durationMs: number }>;
}

export interface ReportSummary {
  talkTime: TalkTimeSummary;
  questions: QuestionSummary;
  waitTime: WaitTimeSummary;
  uptakeCount: number;
  longStudentTalkCount: number;
  studentQuestionCount: number;
  totalDurationMs: number;
}

export interface HighlightedMoment {
  title: string;
  description: string;
  startMs: number;
  endMs: number;
  type: string;
}

export interface LessonReport {
  id: string;
  recordingId: string;
  userId: string;
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
  status: ReportStatus;
  createdAt: string;
}

export interface TranscriptSegment {
  speaker: "teacher" | "student";
  text: string;
  startMs: number;
  endMs: number;
  type: SegmentType;
}

export interface Transcript {
  id: string;
  reportId: string;
  segments: TranscriptSegment[];
  fullText: string;
}
```

Create `packages/shared/src/types/insight.ts`:

```typescript
import type { InsightType } from "../constants";

export interface Insight {
  id: string;
  reportId: string;
  type: InsightType;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

Create `packages/shared/src/types/goal.ts`:

```typescript
import type { PracticeArea, GoalStatus } from "../constants";

export interface Goal {
  id: string;
  userId: string;
  practiceArea: PracticeArea;
  targetMetric: string;
  customLabel: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  id: string;
  goalId: string;
  reportId: string;
  value: number;
  createdAt: string;
}
```

Create `packages/shared/src/types/api.ts`:

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresAt: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
```

- [ ] **Step 5: Create validators**

Create `packages/shared/src/validators/recording.ts`:

```typescript
import { z } from "zod";
import { MAX_RECORDING_SECONDS, SUPPORTED_AUDIO_FORMATS } from "../constants";

export const CreateRecordingSchema = z.object({
  audioUrl: z.string().min(1),
  durationSeconds: z.number().int().positive().max(MAX_RECORDING_SECONDS),
  fileSizeBytes: z.number().int().positive(),
  title: z.string().min(1).optional(),
});

export type CreateRecordingInput = z.infer<typeof CreateRecordingSchema>;

export const UploadUrlSchema = z.object({
  contentType: z.enum(SUPPORTED_AUDIO_FORMATS),
  fileName: z.string().min(1),
});

export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;
```

Create `packages/shared/src/validators/goal.ts`:

```typescript
import { z } from "zod";
import { PRACTICE_AREAS, GOAL_STATUSES } from "../constants";

export const CreateGoalSchema = z
  .object({
    practiceArea: z.enum(PRACTICE_AREAS),
    targetMetric: z.string().min(1),
    customLabel: z.string().min(1).optional(),
  })
  .refine(
    (data) => data.practiceArea !== "custom" || data.customLabel !== undefined,
    { message: "customLabel is required for custom practice area", path: ["customLabel"] }
  );

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const UpdateGoalSchema = z.object({
  status: z.enum(GOAL_STATUSES).optional(),
  targetMetric: z.string().min(1).optional(),
});

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;
```

Create `packages/shared/src/validators/user.ts`:

```typescript
import { z } from "zod";

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

- [ ] **Step 6: Create barrel export**

Create `packages/shared/src/index.ts`:

```typescript
// Types
export type { User } from "./types/user";
export type { LessonRecording } from "./types/recording";
export type {
  LessonReport,
  ReportSummary,
  TalkTimeSummary,
  QuestionSummary,
  WaitTimeSummary,
  HighlightedMoment,
  Transcript,
  TranscriptSegment,
} from "./types/report";
export type { Insight } from "./types/insight";
export type { Goal, GoalProgress } from "./types/goal";
export type {
  PaginatedResponse,
  PresignedUrlResponse,
  ErrorResponse,
} from "./types/api";

// Validators
export {
  CreateRecordingSchema,
  UploadUrlSchema,
  type CreateRecordingInput,
  type UploadUrlInput,
} from "./validators/recording";
export {
  CreateGoalSchema,
  UpdateGoalSchema,
  type CreateGoalInput,
  type UpdateGoalInput,
} from "./validators/goal";
export {
  UpdateUserSchema,
  type UpdateUserInput,
} from "./validators/user";

// Constants
export {
  INSIGHT_TYPES,
  PRACTICE_AREAS,
  RECORDING_STATUSES,
  REPORT_STATUSES,
  GOAL_STATUSES,
  SEGMENT_TYPES,
  MAX_RECORDING_SECONDS,
  SUPPORTED_AUDIO_FORMATS,
  type InsightType,
  type PracticeArea,
  type RecordingStatus,
  type ReportStatus,
  type GoalStatus,
  type SegmentType,
} from "./constants";
```

Update the test import in `packages/shared/tests/validators.test.ts` — change the import line:

```typescript
import {
  CreateRecordingSchema,
  CreateGoalSchema,
  UpdateGoalSchema,
  UpdateUserSchema,
} from "../src";
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run`
Expected: All 7 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, validators, and constants"
```

---

## Task 3: Prisma Schema and Database Setup

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Create Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  teacher
  coach
  admin
}

enum RecordingStatus {
  uploading
  processing
  completed
  failed
}

enum ReportStatus {
  processing
  completed
  failed
}

enum GoalStatus {
  active
  completed
  paused
}

model User {
  id                 String            @id @default(uuid()) @db.Uuid
  email              String            @unique
  name               String
  role               UserRole          @default(teacher)
  avatarUrl          String?
  voiceEnrollmentUrl String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  recordings         LessonRecording[]
  reports            LessonReport[]
  goals              Goal[]
  auditLogs          AuditLog[]

  @@map("users")
}

model LessonRecording {
  id              String          @id @default(uuid()) @db.Uuid
  userId          String          @db.Uuid
  audioUrl        String
  durationSeconds Int
  fileSizeBytes   Int
  status          RecordingStatus @default(uploading)
  title           String?
  recordedAt      DateTime        @default(now())
  createdAt       DateTime        @default(now())
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  report          LessonReport?

  @@index([userId, createdAt(sort: Desc)])
  @@map("lesson_recordings")
}

model LessonReport {
  id                 String          @id @default(uuid()) @db.Uuid
  recordingId        String          @unique @db.Uuid
  userId             String          @db.Uuid
  summary            Json
  highlightedMoments Json
  reflectionPrompts  Json
  status             ReportStatus    @default(processing)
  createdAt          DateTime        @default(now())
  recording          LessonRecording @relation(fields: [recordingId], references: [id], onDelete: Cascade)
  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  transcript         Transcript?
  insights           Insight[]
  goalProgress       GoalProgress[]

  @@index([userId, createdAt(sort: Desc)])
  @@map("lesson_reports")
}

model Transcript {
  id       String       @id @default(uuid()) @db.Uuid
  reportId String       @unique @db.Uuid
  segments Json
  fullText String
  report   LessonReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@map("transcripts")
}

model Insight {
  id         String       @id @default(uuid()) @db.Uuid
  reportId   String       @db.Uuid
  type       String
  startMs    Int
  endMs      Int
  durationMs Int
  metadata   Json         @default("{}")
  createdAt  DateTime     @default(now())
  report     LessonReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId, type])
  @@map("insights")
}

model Goal {
  id           String         @id @default(uuid()) @db.Uuid
  userId       String         @db.Uuid
  practiceArea String
  targetMetric String
  customLabel  String?
  status       GoalStatus     @default(active)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  progress     GoalProgress[]

  @@index([userId, status])
  @@map("goals")
}

model GoalProgress {
  id        String       @id @default(uuid()) @db.Uuid
  goalId    String       @db.Uuid
  reportId  String       @db.Uuid
  value     Float
  createdAt DateTime     @default(now())
  goal      Goal         @relation(fields: [goalId], references: [id], onDelete: Cascade)
  report    LessonReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@unique([goalId, reportId])
  @@map("goal_progress")
}

model AuditLog {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @db.Uuid
  action       String
  resourceType String
  resourceId   String   @db.Uuid
  metadata     Json     @default("{}")
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([resourceType, resourceId])
  @@map("audit_logs")
}
```

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

- [ ] **Step 3: Create first migration (requires running Postgres)**

If you have a local Postgres running:
```bash
npx prisma migrate dev --name init
```

If not, use `prisma db push` to validate the schema:
```bash
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma validate
```
Expected: Schema is valid

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema with all MVP entities"
```

---

## Task 4: API Server Foundation (Fastify + Auth + S3)

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/plugins/cors.ts`
- Create: `apps/api/src/plugins/rate-limit.ts`
- Create: `apps/api/src/services/s3.ts`
- Create: `apps/api/src/services/queue.ts`
- Create: `apps/api/src/services/push.ts`
- Create: `apps/api/src/middleware/audit.ts`
- Create: `apps/api/tests/setup.ts`

- [ ] **Step 1: Write server setup test**

Create `apps/api/tests/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../setup";
import type { FastifyInstance } from "fastify";

describe("Auth routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated requests to protected routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/recordings",
    });
    expect(response.statusCode).toBe(401);
  });

  it("health check returns 200", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run`
Expected: FAIL — setup module not found

- [ ] **Step 3: Create test setup**

Create `apps/api/tests/setup.ts`:

```typescript
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Register plugins
  await app.register(import("../src/plugins/cors"));
  await app.register(import("../src/plugins/auth"));

  // Register routes
  await app.register(import("../src/routes/auth"), { prefix: "/auth" });
  await app.register(import("../src/routes/recordings"), { prefix: "/recordings" });
  await app.register(import("../src/routes/voice-enrollment"), { prefix: "/voice-enrollment" });
  await app.register(import("../src/routes/reports"), { prefix: "/reports" });
  await app.register(import("../src/routes/goals"), { prefix: "/goals" });
  await app.register(import("../src/routes/users"), { prefix: "/users" });

  await app.ready();
  return app;
}
```

- [ ] **Step 4: Create auth plugin**

Create `apps/api/src/plugins/auth.ts`:

```typescript
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as jose from "jose";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
  const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

  fastify.decorateRequest("userId", "");
  fastify.decorateRequest("userEmail", "");

  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "unauthorized", message: "Missing token" });
      }

      const token = authHeader.slice(7);

      try {
        // In production, verify against WorkOS JWKS
        // For MVP, decode and verify the JWT structure
        const JWKS = jose.createRemoteJWKSet(
          new URL(`https://api.workos.com/sso/jwks/${WORKOS_CLIENT_ID}`)
        );
        const { payload } = await jose.jwtVerify(token, JWKS);

        request.userId = payload.sub as string;
        request.userEmail = payload.email as string;
      } catch {
        return reply.status(401).send({ error: "unauthorized", message: "Invalid token" });
      }
    }
  );
}

export default fp(authPlugin);
```

Add `fastify-plugin` to `apps/api/package.json` dependencies:

```json
"fastify-plugin": "^5.0.0"
```

- [ ] **Step 5: Create CORS plugin**

Create `apps/api/src/plugins/cors.ts`:

```typescript
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: [
      process.env.WEB_URL || "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
}

export default fp(corsPlugin);
```

- [ ] **Step 6: Create rate limit plugin**

Create `apps/api/src/plugins/rate-limit.ts`:

```typescript
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
}

export default fp(rateLimitPlugin);
```

- [ ] **Step 7: Create S3 service**

Create `apps/api/src/services/s3.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET = process.env.S3_BUCKET_NAME || "coachline-audio";

export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<{ url: string; expiresAt: Date }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const expiresIn = 900; // 15 minutes
  const url = await getSignedUrl(s3, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return { url, expiresAt };
}

export async function getPlaybackUrl(key: string): Promise<{ url: string; expiresAt: Date }> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const expiresIn = 3600; // 1 hour
  const url = await getSignedUrl(s3, command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return { url, expiresAt };
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  await s3.send(command);
}
```

- [ ] **Step 8: Create queue service**

Create `apps/api/src/services/queue.ts`:

```typescript
import { Queue } from "bullmq";

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"),
};

export const processingQueue = new Queue("lesson-processing", { connection });

export async function enqueueProcessingJob(data: {
  recordingId: string;
  userId: string;
  audioUrl: string;
}) {
  await processingQueue.add("process-lesson", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
}
```

- [ ] **Step 9: Create push notification service**

Create `apps/api/src/services/push.ts`:

```typescript
import { Expo } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string
) {
  if (!Expo.isExpoPushToken(pushToken)) {
    return;
  }

  await expo.sendPushNotificationsAsync([
    {
      to: pushToken,
      sound: "default",
      title,
      body,
    },
  ]);
}
```

Add `expo-server-sdk` to `apps/api/package.json` dependencies:

```json
"expo-server-sdk": "^3.13.0"
```

- [ ] **Step 10: Create audit middleware**

Create `apps/api/src/middleware/audit.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logAudit(params: {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata ?? {},
    },
  });
}
```

- [ ] **Step 11: Create placeholder route files**

Create stub route files so the test setup can import them. Each returns a Fastify plugin that registers no routes yet (we'll fill them in subsequent tasks):

Create `apps/api/src/routes/auth.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function authRoutes(fastify: FastifyInstance) {
  // Auth routes — implemented in Task 5
}
```

Create `apps/api/src/routes/recordings.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);
  // Recording routes — implemented in Task 6
}
```

Create `apps/api/src/routes/voice-enrollment.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function voiceEnrollmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);
  // Voice enrollment routes — implemented in Task 7
}
```

Create `apps/api/src/routes/reports.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);
  // Report routes — implemented in Task 8
}
```

Create `apps/api/src/routes/goals.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);
  // Goal routes — implemented in Task 9
}
```

Create `apps/api/src/routes/users.ts`:

```typescript
import type { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);
  // User routes — implemented in Task 10
}
```

- [ ] **Step 12: Create main server entrypoint**

Create `apps/api/src/server.ts`:

```typescript
import Fastify from "fastify";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

// Health check
app.get("/health", async () => ({ status: "ok" }));

// Plugins
app.register(import("./plugins/cors"));
app.register(import("./plugins/auth"));
app.register(import("./plugins/rate-limit"));

// Routes
app.register(import("./routes/auth"), { prefix: "/auth" });
app.register(import("./routes/recordings"), { prefix: "/recordings" });
app.register(import("./routes/voice-enrollment"), { prefix: "/voice-enrollment" });
app.register(import("./routes/reports"), { prefix: "/reports" });
app.register(import("./routes/goals"), { prefix: "/goals" });
app.register(import("./routes/users"), { prefix: "/users" });

const PORT = parseInt(process.env.PORT || "3001");

async function start() {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 13: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: Both tests PASS (health check 200, unauthenticated request 401)

- [ ] **Step 14: Commit**

```bash
git add apps/api/ prisma/
git commit -m "feat: add API server foundation with auth, S3, queue, and audit services"
```

---

## Tasks 5-10: API Route Implementations

> **Note:** Tasks 5-10 follow the same TDD pattern: write failing test → implement route → verify passes → commit. Each task implements one route group from the API design. Due to plan length, these are described at the route level with key implementation details rather than repeating the full TDD ceremony for each endpoint.

### Task 5: Auth Routes

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Create: `apps/api/tests/routes/auth.test.ts` (extend)

- [ ] **Step 1: Install WorkOS SDK**

Add to `apps/api/package.json`:
```json
"@workos-inc/node": "^7.0.0"
```

Run: `cd apps/api && npm install`

- [ ] **Step 2: Implement auth routes**

Replace `apps/api/src/routes/auth.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { WorkOS } from "@workos-inc/node";
import { PrismaClient } from "@prisma/client";
import * as jose from "jose";

const prisma = new PrismaClient();
const workos = new WorkOS(process.env.WORKOS_API_KEY);

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post<{
    Body: { email: string; password: string; name: string };
  }>("/signup", async (request, reply) => {
    const { email, password, name } = request.body;

    const authResponse = await workos.userManagement.createUser({
      email,
      password,
      firstName: name.split(" ")[0],
      lastName: name.split(" ").slice(1).join(" ") || undefined,
    });

    const user = await prisma.user.create({
      data: {
        id: authResponse.id,
        email: authResponse.email,
        name,
        role: "teacher",
      },
    });

    const session = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  });

  // POST /auth/login
  fastify.post<{
    Body: { email: string; password: string };
  }>("/login", async (request, reply) => {
    const { email, password } = request.body;

    const session = await workos.userManagement.authenticateWithPassword({
      email,
      password,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    return { user, accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // POST /auth/magic-link
  fastify.post<{
    Body: { email: string };
  }>("/magic-link", async (request, reply) => {
    const { email } = request.body;

    await workos.userManagement.createMagicAuth({
      email,
    });

    return { message: "Magic link sent" };
  });

  // GET /auth/callback
  fastify.get<{
    Querystring: { code: string };
  }>("/callback", async (request, reply) => {
    const { code } = request.query;

    const session = await workos.userManagement.authenticateWithCode({
      code,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    // Upsert user — they may be signing in for the first time via OAuth/magic link
    const user = await prisma.user.upsert({
      where: { id: session.user.id },
      update: { email: session.user.email },
      create: {
        id: session.user.id,
        email: session.user.email,
        name:
          [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
          session.user.email,
        role: "teacher",
      },
    });

    return { user, accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // POST /auth/refresh
  fastify.post<{
    Body: { refreshToken: string };
  }>("/refresh", async (request, reply) => {
    const { refreshToken } = request.body;

    const session = await workos.userManagement.authenticateWithRefreshToken({
      refreshToken,
      clientId: process.env.WORKOS_CLIENT_ID!,
    });

    return { accessToken: session.accessToken, refreshToken: session.refreshToken };
  });

  // DELETE /auth/logout
  fastify.delete("/logout", async (request, reply) => {
    // Client-side token disposal — server is stateless with JWTs
    return reply.status(204).send();
  });
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/
git commit -m "feat: implement auth routes with WorkOS integration"
```

---

### Task 6: Recording Routes

**Files:**
- Modify: `apps/api/src/routes/recordings.ts`
- Create: `apps/api/tests/routes/recordings.test.ts`

- [ ] **Step 1: Implement recording routes**

Replace `apps/api/src/routes/recordings.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { CreateRecordingSchema, UploadUrlSchema } from "@coachline/shared";
import { getUploadUrl, deleteObject } from "../services/s3";
import { enqueueProcessingJob } from "../services/queue";
import { logAudit } from "../middleware/audit";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

export default async function recordingRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /recordings/upload-url
  fastify.post<{
    Body: { contentType: string; fileName: string };
  }>("/upload-url", async (request, reply) => {
    const parsed = UploadUrlSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", message: parsed.error.message });
    }

    const key = `recordings/${request.userId}/${randomUUID()}/${parsed.data.fileName}`;
    const { url, expiresAt } = await getUploadUrl(key, parsed.data.contentType);

    return { url, key, expiresAt: expiresAt.toISOString() };
  });

  // POST /recordings
  fastify.post<{
    Body: { audioUrl: string; durationSeconds: number; fileSizeBytes: number; title?: string };
  }>("/", async (request, reply) => {
    const parsed = CreateRecordingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", message: parsed.error.message });
    }

    const recording = await prisma.lessonRecording.create({
      data: {
        userId: request.userId,
        audioUrl: parsed.data.audioUrl,
        durationSeconds: parsed.data.durationSeconds,
        fileSizeBytes: parsed.data.fileSizeBytes,
        title: parsed.data.title ?? null,
        status: "processing",
      },
    });

    await enqueueProcessingJob({
      recordingId: recording.id,
      userId: request.userId,
      audioUrl: recording.audioUrl,
    });

    await logAudit({
      userId: request.userId,
      action: "recording.create",
      resourceType: "LessonRecording",
      resourceId: recording.id,
    });

    return reply.status(201).send(recording);
  });

  // GET /recordings
  fastify.get<{
    Querystring: { cursor?: string; limit?: string };
  }>("/", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "20"), 50);
    const cursor = request.query.cursor;

    const recordings = await prisma.lessonRecording.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = recordings.length > limit;
    const data = hasMore ? recordings.slice(0, limit) : recordings;

    return {
      data,
      cursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    };
  });

  // GET /recordings/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const recording = await prisma.lessonRecording.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!recording) {
      return reply.status(404).send({ error: "not_found", message: "Recording not found" });
    }

    return recording;
  });

  // DELETE /recordings/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const recording = await prisma.lessonRecording.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!recording) {
      return reply.status(404).send({ error: "not_found", message: "Recording not found" });
    }

    // Delete S3 object
    await deleteObject(recording.audioUrl);

    // Cascade delete handles reports, transcripts, insights, goal progress
    await prisma.lessonRecording.delete({ where: { id: recording.id } });

    await logAudit({
      userId: request.userId,
      action: "recording.delete",
      resourceType: "LessonRecording",
      resourceId: recording.id,
    });

    return reply.status(204).send();
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/
git commit -m "feat: implement recording routes with S3 upload and queue integration"
```

---

### Task 7: Voice Enrollment Routes

**Files:**
- Modify: `apps/api/src/routes/voice-enrollment.ts`

- [ ] **Step 1: Implement voice enrollment routes**

Replace `apps/api/src/routes/voice-enrollment.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { getUploadUrl } from "../services/s3";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

export default async function voiceEnrollmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /voice-enrollment/upload-url
  fastify.post("/upload-url", async (request) => {
    const key = `voice-enrollment/${request.userId}/${randomUUID()}.m4a`;
    const { url, expiresAt } = await getUploadUrl(key, "audio/x-m4a");

    return { url, key, expiresAt: expiresAt.toISOString() };
  });

  // POST /voice-enrollment
  fastify.post<{
    Body: { voiceEnrollmentUrl: string };
  }>("/", async (request) => {
    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { voiceEnrollmentUrl: request.body.voiceEnrollmentUrl },
    });

    return { voiceEnrollmentUrl: user.voiceEnrollmentUrl };
  });

  // GET /voice-enrollment
  fastify.get("/", async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { voiceEnrollmentUrl: true },
    });

    return {
      enrolled: user.voiceEnrollmentUrl !== null,
      voiceEnrollmentUrl: user.voiceEnrollmentUrl,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/
git commit -m "feat: implement voice enrollment routes"
```

---

### Task 8: Report Routes

**Files:**
- Modify: `apps/api/src/routes/reports.ts`

- [ ] **Step 1: Implement report routes**

Replace `apps/api/src/routes/reports.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { getPlaybackUrl } from "../services/s3";
import { logAudit } from "../middleware/audit";

const prisma = new PrismaClient();

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /reports
  fastify.get<{
    Querystring: { cursor?: string; limit?: string };
  }>("/", async (request) => {
    const limit = Math.min(parseInt(request.query.limit || "20"), 50);
    const cursor = request.query.cursor;

    const reports = await prisma.lessonReport.findMany({
      where: { userId: request.userId, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: { recording: { select: { title: true, durationSeconds: true, recordedAt: true } } },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = reports.length > limit;
    const data = hasMore ? reports.slice(0, limit) : reports;

    return { data, cursor: hasMore ? data[data.length - 1].id : null, hasMore };
  });

  // GET /reports/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const report = await prisma.lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      include: { recording: { select: { title: true, durationSeconds: true, recordedAt: true } } },
    });

    if (!report) {
      return reply.status(404).send({ error: "not_found", message: "Report not found" });
    }

    await logAudit({
      userId: request.userId,
      action: "report.view",
      resourceType: "LessonReport",
      resourceId: report.id,
    });

    return report;
  });

  // GET /reports/:id/transcript
  fastify.get<{ Params: { id: string } }>("/:id/transcript", async (request, reply) => {
    const report = await prisma.lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      select: { id: true },
    });

    if (!report) {
      return reply.status(404).send({ error: "not_found", message: "Report not found" });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { reportId: report.id },
    });

    if (!transcript) {
      return reply.status(404).send({ error: "not_found", message: "Transcript not found" });
    }

    return transcript;
  });

  // GET /reports/:id/insights
  fastify.get<{
    Params: { id: string };
    Querystring: { type?: string };
  }>("/:id/insights", async (request, reply) => {
    const report = await prisma.lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      select: { id: true },
    });

    if (!report) {
      return reply.status(404).send({ error: "not_found", message: "Report not found" });
    }

    const insights = await prisma.insight.findMany({
      where: {
        reportId: report.id,
        ...(request.query.type ? { type: request.query.type } : {}),
      },
      orderBy: { startMs: "asc" },
    });

    return insights;
  });

  // GET /reports/:id/audio-url
  fastify.get<{ Params: { id: string } }>("/:id/audio-url", async (request, reply) => {
    const report = await prisma.lessonReport.findFirst({
      where: { id: request.params.id, userId: request.userId },
      include: { recording: { select: { audioUrl: true } } },
    });

    if (!report) {
      return reply.status(404).send({ error: "not_found", message: "Report not found" });
    }

    const { url, expiresAt } = await getPlaybackUrl(report.recording.audioUrl);

    return { url, expiresAt: expiresAt.toISOString() };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/
git commit -m "feat: implement report routes with transcript, insights, and audio playback"
```

---

### Task 9: Goal Routes

**Files:**
- Modify: `apps/api/src/routes/goals.ts`

- [ ] **Step 1: Implement goal routes**

Replace `apps/api/src/routes/goals.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { CreateGoalSchema, UpdateGoalSchema } from "@coachline/shared";
import { logAudit } from "../middleware/audit";

const prisma = new PrismaClient();

export default async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // POST /goals
  fastify.post<{
    Body: { practiceArea: string; targetMetric: string; customLabel?: string };
  }>("/", async (request, reply) => {
    const parsed = CreateGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", message: parsed.error.message });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: request.userId,
        practiceArea: parsed.data.practiceArea,
        targetMetric: parsed.data.targetMetric,
        customLabel: parsed.data.customLabel ?? null,
      },
    });

    await logAudit({
      userId: request.userId,
      action: "goal.create",
      resourceType: "Goal",
      resourceId: goal.id,
    });

    return reply.status(201).send(goal);
  });

  // GET /goals
  fastify.get("/", async (request) => {
    const goals = await prisma.goal.findMany({
      where: { userId: request.userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return goals;
  });

  // PATCH /goals/:id
  fastify.patch<{
    Params: { id: string };
    Body: { status?: string; targetMetric?: string };
  }>("/:id", async (request, reply) => {
    const parsed = UpdateGoalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", message: parsed.error.message });
    }

    const goal = await prisma.goal.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!goal) {
      return reply.status(404).send({ error: "not_found", message: "Goal not found" });
    }

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: parsed.data,
    });

    return updated;
  });

  // GET /goals/:id/progress
  fastify.get<{ Params: { id: string } }>("/:id/progress", async (request, reply) => {
    const goal = await prisma.goal.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });

    if (!goal) {
      return reply.status(404).send({ error: "not_found", message: "Goal not found" });
    }

    const progress = await prisma.goalProgress.findMany({
      where: { goalId: goal.id },
      orderBy: { createdAt: "asc" },
      include: {
        report: {
          select: { createdAt: true, recording: { select: { title: true, recordedAt: true } } },
        },
      },
    });

    return progress;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/
git commit -m "feat: implement goal routes with progress tracking"
```

---

### Task 10: User Routes

**Files:**
- Modify: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Implement user routes**

Replace `apps/api/src/routes/users.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { UpdateUserSchema } from "@coachline/shared";
import { deleteObject } from "../services/s3";
import { logAudit } from "../middleware/audit";

const prisma = new PrismaClient();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", fastify.authenticate);

  // GET /users/me
  fastify.get("/me", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
    });

    if (!user) {
      return reply.status(404).send({ error: "not_found", message: "User not found" });
    }

    return user;
  });

  // PATCH /users/me
  fastify.patch<{
    Body: { name?: string; avatarUrl?: string | null };
  }>("/me", async (request, reply) => {
    const parsed = UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation", message: parsed.error.message });
    }

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: parsed.data,
    });

    return user;
  });

  // DELETE /users/me
  fastify.delete("/me", async (request, reply) => {
    // Find all recordings to delete S3 objects
    const recordings = await prisma.lessonRecording.findMany({
      where: { userId: request.userId },
      select: { audioUrl: true },
    });

    // Find voice enrollment to delete
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { voiceEnrollmentUrl: true },
    });

    // Delete all S3 objects
    const deletePromises = recordings.map((r) => deleteObject(r.audioUrl));
    if (user?.voiceEnrollmentUrl) {
      deletePromises.push(deleteObject(user.voiceEnrollmentUrl));
    }
    await Promise.allSettled(deletePromises);

    await logAudit({
      userId: request.userId,
      action: "account.delete",
      resourceType: "User",
      resourceId: request.userId,
    });

    // Cascade delete handles all related records
    await prisma.user.delete({ where: { id: request.userId } });

    return reply.status(204).send();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/
git commit -m "feat: implement user routes with full account deletion"
```

---

## Task 11: Worker — AI Processing Pipeline

**Files:**
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/pipeline/orchestrator.ts`
- Create: `apps/worker/src/pipeline/transcribe.ts`
- Create: `apps/worker/src/pipeline/classify.ts`
- Create: `apps/worker/src/pipeline/analyze.ts`
- Create: `apps/worker/src/pipeline/report.ts`
- Create: `apps/worker/src/services/deepgram.ts`
- Create: `apps/worker/src/services/bedrock.ts`
- Create: `apps/worker/src/services/speaker-match.ts`
- Create: `apps/worker/tests/pipeline/classify.test.ts`
- Create: `apps/worker/tests/services/speaker-match.test.ts`

- [ ] **Step 1: Write classify tests**

Create `apps/worker/tests/pipeline/classify.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifySegments } from "../../src/pipeline/classify";

describe("classifySegments", () => {
  it("calculates talk time percentages", () => {
    const segments = [
      { speaker: 0, startMs: 0, endMs: 10000, text: "Teacher speaking" },
      { speaker: 1, startMs: 10000, endMs: 15000, text: "Student response" },
      { speaker: 0, startMs: 18000, endMs: 25000, text: "More teacher" },
    ];

    const result = classifySegments(segments, 0, 25000);

    expect(result.talkTime.teacherPercent).toBeCloseTo(68, 0); // 17000/25000
    expect(result.talkTime.studentPercent).toBeCloseTo(20, 0); // 5000/25000
    expect(result.talkTime.silencePercent).toBeCloseTo(12, 0); // 3000/25000
  });

  it("detects silence gaps", () => {
    const segments = [
      { speaker: 0, startMs: 0, endMs: 5000, text: "Question?" },
      { speaker: 1, startMs: 9000, endMs: 12000, text: "Answer" },
    ];

    const result = classifySegments(segments, 0, 12000);

    const silenceSegments = result.timeline.filter((s) => s.type === "silence");
    expect(silenceSegments).toHaveLength(1);
    expect(silenceSegments[0].startMs).toBe(5000);
    expect(silenceSegments[0].endMs).toBe(9000);
  });

  it("detects group talk from overlapping speakers", () => {
    const segments = [
      { speaker: 1, startMs: 0, endMs: 5000, text: "Student A" },
      { speaker: 2, startMs: 2000, endMs: 6000, text: "Student B" },
    ];

    const result = classifySegments(segments, 0, 6000);

    expect(result.talkTime.groupPercent).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/worker && npx vitest run`
Expected: FAIL — module not found

- [ ] **Step 3: Implement classify stage**

Create `apps/worker/src/pipeline/classify.ts`:

```typescript
import type { SegmentType } from "@coachline/shared";

interface DiarizedSegment {
  speaker: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface TimelineSegment {
  type: SegmentType;
  speaker: "teacher" | "student" | null;
  startMs: number;
  endMs: number;
}

interface TalkTimeSummary {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

interface ClassifyResult {
  talkTime: TalkTimeSummary;
  timeline: TimelineSegment[];
}

export function classifySegments(
  segments: DiarizedSegment[],
  teacherSpeakerId: number,
  totalDurationMs: number
): ClassifyResult {
  if (segments.length === 0 || totalDurationMs === 0) {
    return {
      talkTime: { teacherPercent: 0, studentPercent: 0, groupPercent: 0, silencePercent: 100, mediaPercent: 0 },
      timeline: [{ type: "silence", speaker: null, startMs: 0, endMs: totalDurationMs }],
    };
  }

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  const timeline: TimelineSegment[] = [];
  let teacherMs = 0;
  let studentMs = 0;
  let groupMs = 0;
  let lastEndMs = 0;

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];

    // Add silence gap before this segment
    if (seg.startMs > lastEndMs) {
      timeline.push({ type: "silence", speaker: null, startMs: lastEndMs, endMs: seg.startMs });
    }

    // Check for overlap with next segment (group talk)
    const nextSeg = sorted[i + 1];
    if (nextSeg && nextSeg.startMs < seg.endMs && seg.speaker !== nextSeg.speaker) {
      // Overlap region
      const overlapStart = nextSeg.startMs;
      const overlapEnd = Math.min(seg.endMs, nextSeg.endMs);
      const overlapMs = overlapEnd - overlapStart;

      // Pre-overlap: single speaker
      if (overlapStart > seg.startMs) {
        const isTeacher = seg.speaker === teacherSpeakerId;
        const dur = overlapStart - seg.startMs;
        timeline.push({
          type: isTeacher ? "teacher_talk" : "student_talk",
          speaker: isTeacher ? "teacher" : "student",
          startMs: seg.startMs,
          endMs: overlapStart,
        });
        if (isTeacher) teacherMs += dur;
        else studentMs += dur;
      }

      // Overlap: group talk
      timeline.push({ type: "group_talk", speaker: null, startMs: overlapStart, endMs: overlapEnd });
      groupMs += overlapMs;

      lastEndMs = Math.max(seg.endMs, lastEndMs);
      continue;
    }

    // Single speaker segment
    const isTeacher = seg.speaker === teacherSpeakerId;
    const effectiveStart = Math.max(seg.startMs, lastEndMs);
    const dur = seg.endMs - effectiveStart;

    if (dur > 0) {
      timeline.push({
        type: isTeacher ? "teacher_talk" : "student_talk",
        speaker: isTeacher ? "teacher" : "student",
        startMs: effectiveStart,
        endMs: seg.endMs,
      });
      if (isTeacher) teacherMs += dur;
      else studentMs += dur;
    }

    lastEndMs = Math.max(seg.endMs, lastEndMs);
  }

  // Trailing silence
  if (lastEndMs < totalDurationMs) {
    timeline.push({ type: "silence", speaker: null, startMs: lastEndMs, endMs: totalDurationMs });
  }

  const silenceMs = totalDurationMs - teacherMs - studentMs - groupMs;

  return {
    talkTime: {
      teacherPercent: (teacherMs / totalDurationMs) * 100,
      studentPercent: (studentMs / totalDurationMs) * 100,
      groupPercent: (groupMs / totalDurationMs) * 100,
      silencePercent: Math.max(0, (silenceMs / totalDurationMs) * 100),
      mediaPercent: 0,
    },
    timeline,
  };
}
```

- [ ] **Step 4: Run classify tests**

Run: `cd apps/worker && npx vitest run tests/pipeline/classify.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Write speaker-match tests**

Create `apps/worker/tests/services/speaker-match.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { identifyTeacherSpeaker } from "../../src/services/speaker-match";

describe("identifyTeacherSpeaker", () => {
  it("identifies dominant speaker as teacher", () => {
    const speakerStats = [
      { speakerId: 0, totalMs: 20000 },
      { speakerId: 1, totalMs: 8000 },
      { speakerId: 2, totalMs: 3000 },
    ];

    const result = identifyTeacherSpeaker(speakerStats);
    expect(result).toBe(0);
  });

  it("handles single speaker", () => {
    const speakerStats = [{ speakerId: 0, totalMs: 45000 }];

    const result = identifyTeacherSpeaker(speakerStats);
    expect(result).toBe(0);
  });
});
```

- [ ] **Step 6: Implement speaker-match service**

Create `apps/worker/src/services/speaker-match.ts`:

```typescript
interface SpeakerStats {
  speakerId: number;
  totalMs: number;
}

/**
 * Identifies the teacher speaker using a dominant-speaker heuristic.
 * The teacher is typically the speaker with the most total talk time.
 *
 * Future enhancement: compare voice embeddings against the teacher's
 * enrollment sample for more accurate identification.
 */
export function identifyTeacherSpeaker(speakerStats: SpeakerStats[]): number {
  if (speakerStats.length === 0) {
    throw new Error("No speakers found in recording");
  }

  const sorted = [...speakerStats].sort((a, b) => b.totalMs - a.totalMs);
  return sorted[0].speakerId;
}

/**
 * Compute per-speaker talk time from diarized segments.
 */
export function computeSpeakerStats(
  segments: Array<{ speaker: number; startMs: number; endMs: number }>
): SpeakerStats[] {
  const statsMap = new Map<number, number>();

  for (const seg of segments) {
    const current = statsMap.get(seg.speaker) || 0;
    statsMap.set(seg.speaker, current + (seg.endMs - seg.startMs));
  }

  return Array.from(statsMap.entries()).map(([speakerId, totalMs]) => ({
    speakerId,
    totalMs,
  }));
}
```

- [ ] **Step 7: Run speaker-match tests**

Run: `cd apps/worker && npx vitest run tests/services/speaker-match.test.ts`
Expected: Both tests PASS

- [ ] **Step 8: Create Deepgram service**

Create `apps/worker/src/services/deepgram.ts`:

```typescript
import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

interface DeepgramSegment {
  speaker: number;
  startMs: number;
  endMs: number;
  text: string;
}

interface TranscribeResult {
  segments: DeepgramSegment[];
  fullText: string;
  durationMs: number;
}

export async function transcribeAudio(audioUrl: string): Promise<TranscribeResult> {
  const { result } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: "nova-3",
      smart_format: true,
      diarize: true,
      punctuate: true,
      utterances: true,
    }
  );

  const utterances = result.results?.utterances || [];
  const segments: DeepgramSegment[] = utterances.map((u: any) => ({
    speaker: u.speaker,
    startMs: Math.round(u.start * 1000),
    endMs: Math.round(u.end * 1000),
    text: u.transcript,
  }));

  const fullText = segments.map((s) => s.text).join(" ");
  const durationMs = result.metadata?.duration
    ? Math.round(result.metadata.duration * 1000)
    : segments.length > 0
      ? segments[segments.length - 1].endMs
      : 0;

  return { segments, fullText, durationMs };
}
```

- [ ] **Step 9: Create Bedrock service**

Create `apps/worker/src/services/bedrock.ts`:

```typescript
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || "us-east-1",
});

const MODEL_ID = "anthropic.claude-sonnet-4-20250514";

interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export async function invokeClaudeJson<T>(
  systemPrompt: string,
  messages: BedrockMessage[]
): Promise<T> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system: systemPrompt,
    messages,
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content[0].text;

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1].trim()) as T;
}
```

- [ ] **Step 10: Create analyze stage**

Create `apps/worker/src/pipeline/analyze.ts`:

```typescript
import { invokeClaudeJson } from "../services/bedrock";
import type { InsightType } from "@coachline/shared";

interface TranscriptSegment {
  speaker: "teacher" | "student";
  text: string;
  startMs: number;
  endMs: number;
}

interface RawInsight {
  type: InsightType;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
}

interface AnalyzeResult {
  insights: RawInsight[];
}

const SYSTEM_PROMPT = `You are an expert instructional coach analyzing a classroom lesson transcript. Your job is to identify specific teaching practices in the transcript and return them as structured JSON.

For each practice you detect, return an object with:
- type: one of "question_open", "question_closed", "question_focusing", "question_procedural", "question_rhetorical", "wait_time_1", "wait_time_2", "uptake", "long_student_talk", "short_student_response"
- startMs: start timestamp in milliseconds
- endMs: end timestamp in milliseconds
- durationMs: endMs - startMs
- metadata: an object with type-specific details

Type-specific metadata:
- question_*: { "text": "the question text" }
- wait_time_1: { "questionText": "preceding question", "durationMs": silence duration }
- wait_time_2: { "studentResponse": "what student said", "durationMs": silence duration }
- uptake: { "studentContribution": "what student said", "teacherResponse": "how teacher built on it" }
- long_student_talk: { "text": "what student said", "durationMs": how long }
- short_student_response: { "text": "what student said", "durationMs": how long }

Question classification guide:
- open: requires explanation, reasoning, or multiple valid answers ("Why...", "How might...", "What do you think...")
- closed: single correct answer, recall ("What is...", "When did...", "How many...")
- focusing: probes student thinking ("Can you explain more?", "What makes you say that?", "What evidence...")
- procedural: classroom management ("Did everyone turn to page 5?", "Who needs more time?")
- rhetorical: not expecting an answer ("Isn't that interesting?", "Right?")

Wait time thresholds:
- wait_time_1: silence >= 1 second between teacher question and student response
- wait_time_2: silence >= 1 second between student response and teacher's next utterance

Student talk thresholds:
- long_student_talk: student speaking >= 7 seconds
- short_student_response: student speaking < 3 seconds (only after a teacher question)

Return ONLY a JSON array of insight objects. No other text.`;

export async function analyzeTranscript(
  segments: TranscriptSegment[],
  chunkSizeMs: number = 900000 // 15 minutes
): Promise<RawInsight[]> {
  if (segments.length === 0) return [];

  const totalDurationMs = segments[segments.length - 1].endMs;
  const allInsights: RawInsight[] = [];

  // Chunk transcript for long lessons
  const overlapMs = 60000; // 1 minute overlap
  let chunkStart = 0;

  while (chunkStart < totalDurationMs) {
    const chunkEnd = Math.min(chunkStart + chunkSizeMs, totalDurationMs);
    const chunkSegments = segments.filter(
      (s) => s.endMs > chunkStart && s.startMs < chunkEnd
    );

    if (chunkSegments.length > 0) {
      const transcriptText = chunkSegments
        .map((s) => `[${s.speaker} ${s.startMs}ms-${s.endMs}ms] ${s.text}`)
        .join("\n");

      const result = await invokeClaudeJson<RawInsight[]>(
        SYSTEM_PROMPT,
        [{ role: "user", content: `Analyze this transcript chunk:\n\n${transcriptText}` }]
      );

      // Deduplicate insights from overlap regions
      for (const insight of result) {
        const isDuplicate = allInsights.some(
          (existing) =>
            existing.type === insight.type &&
            Math.abs(existing.startMs - insight.startMs) < 5000
        );
        if (!isDuplicate) {
          allInsights.push(insight);
        }
      }
    }

    chunkStart += chunkSizeMs - overlapMs;
  }

  return allInsights;
}
```

- [ ] **Step 11: Create report generation stage**

Create `apps/worker/src/pipeline/report.ts`:

```typescript
import { invokeClaudeJson } from "../services/bedrock";
import type { ReportSummary, HighlightedMoment } from "@coachline/shared";

interface RawInsight {
  type: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: Record<string, unknown>;
}

interface TalkTime {
  teacherPercent: number;
  studentPercent: number;
  groupPercent: number;
  silencePercent: number;
  mediaPercent: number;
}

interface GenerateReportInput {
  insights: RawInsight[];
  talkTime: TalkTime;
  totalDurationMs: number;
  activeGoal?: { practiceArea: string; targetMetric: string } | null;
}

interface GenerateReportResult {
  summary: ReportSummary;
  highlightedMoments: HighlightedMoment[];
  reflectionPrompts: string[];
}

const SYSTEM_PROMPT = `You are an instructional coach synthesizing lesson analysis data into a coaching report. Your tone is encouraging and growth-oriented — lead with strengths, then areas for growth.

Given the raw analysis data, generate:

1. highlightedMoments: The top 3-5 most notable moments from the lesson. Each has:
   - title: short label (e.g., "Great uptake at 14:32")
   - description: 1-2 sentences describing what happened and why it matters
   - startMs, endMs: timestamps
   - type: the insight type this relates to

2. reflectionPrompts: 2-3 personalized reflection questions based on the data. These should be specific to what happened in THIS lesson, not generic. Reference actual numbers.

If the teacher has an active goal, weight highlights and prompts toward that practice area.

Return JSON with keys: highlightedMoments, reflectionPrompts`;

export async function generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
  const { insights, talkTime, totalDurationMs, activeGoal } = input;

  // Compute summary stats from raw insights
  const questions = insights.filter((i) => i.type.startsWith("question_"));
  const waitTime1 = insights.filter((i) => i.type === "wait_time_1");
  const waitTime2 = insights.filter((i) => i.type === "wait_time_2");
  const uptake = insights.filter((i) => i.type === "uptake");
  const longStudentTalk = insights.filter((i) => i.type === "long_student_talk");

  const avgWt1 = waitTime1.length > 0
    ? waitTime1.reduce((sum, i) => sum + i.durationMs, 0) / waitTime1.length
    : 0;
  const avgWt2 = waitTime2.length > 0
    ? waitTime2.reduce((sum, i) => sum + i.durationMs, 0) / waitTime2.length
    : 0;

  const summary: ReportSummary = {
    talkTime,
    questions: {
      total: questions.length,
      openEnded: questions.filter((q) => q.type === "question_open").length,
      closed: questions.filter((q) => q.type === "question_closed").length,
      focusing: questions.filter((q) => q.type === "question_focusing").length,
      procedural: questions.filter((q) => q.type === "question_procedural").length,
      rhetorical: questions.filter((q) => q.type === "question_rhetorical").length,
    },
    waitTime: {
      waitTime1Count: waitTime1.length,
      waitTime1AvgMs: Math.round(avgWt1),
      waitTime2Count: waitTime2.length,
      waitTime2AvgMs: Math.round(avgWt2),
      bestMoments: waitTime1
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 3)
        .map((w) => ({ startMs: w.startMs, durationMs: w.durationMs })),
    },
    uptakeCount: uptake.length,
    longStudentTalkCount: longStudentTalk.length,
    studentQuestionCount: 0, // Deferred to Wave 2 (AI-05)
    totalDurationMs,
  };

  // Generate highlights and reflection prompts via Claude
  const dataForClaude = JSON.stringify({
    summary,
    insightSamples: insights.slice(0, 30), // Limit context size
    activeGoal,
  });

  const { highlightedMoments, reflectionPrompts } = await invokeClaudeJson<{
    highlightedMoments: HighlightedMoment[];
    reflectionPrompts: string[];
  }>(SYSTEM_PROMPT, [
    { role: "user", content: `Generate the coaching report from this data:\n\n${dataForClaude}` },
  ]);

  return { summary, highlightedMoments, reflectionPrompts };
}
```

- [ ] **Step 12: Create transcribe stage**

Create `apps/worker/src/pipeline/transcribe.ts`:

```typescript
import { transcribeAudio } from "../services/deepgram";
import { computeSpeakerStats, identifyTeacherSpeaker } from "../services/speaker-match";
import type { TranscriptSegment } from "@coachline/shared";

interface TranscribeResult {
  segments: TranscriptSegment[];
  rawSegments: Array<{ speaker: number; startMs: number; endMs: number; text: string }>;
  teacherSpeakerId: number;
  fullText: string;
  durationMs: number;
}

export async function transcribeLesson(audioUrl: string): Promise<TranscribeResult> {
  const { segments: rawSegments, fullText, durationMs } = await transcribeAudio(audioUrl);

  // Identify which speaker is the teacher
  const speakerStats = computeSpeakerStats(rawSegments);
  const teacherSpeakerId = identifyTeacherSpeaker(speakerStats);

  // Map to labeled segments
  const segments: TranscriptSegment[] = rawSegments.map((seg) => ({
    speaker: seg.speaker === teacherSpeakerId ? "teacher" : "student",
    text: seg.text,
    startMs: seg.startMs,
    endMs: seg.endMs,
    type: seg.speaker === teacherSpeakerId ? "teacher_talk" : "student_talk",
  }));

  return { segments, rawSegments, teacherSpeakerId, fullText, durationMs };
}
```

- [ ] **Step 13: Create pipeline orchestrator**

Create `apps/worker/src/pipeline/orchestrator.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { transcribeLesson } from "./transcribe";
import { classifySegments } from "./classify";
import { analyzeTranscript } from "./analyze";
import { generateReport } from "./report";

const prisma = new PrismaClient();

export async function processLesson(data: {
  recordingId: string;
  userId: string;
  audioUrl: string;
}): Promise<void> {
  const { recordingId, userId, audioUrl } = data;

  // Stage 1: Transcription + Diarization
  const transcription = await transcribeLesson(audioUrl);

  // Stage 2: Segment Classification
  const classification = classifySegments(
    transcription.rawSegments,
    transcription.teacherSpeakerId,
    transcription.durationMs
  );

  // Stage 3: Coaching Analysis
  const { insights: rawInsights } = { insights: await analyzeTranscript(transcription.segments) };

  // Stage 4: Report Generation
  // Fetch active goal if any
  const activeGoal = await prisma.goal.findFirst({
    where: { userId, status: "active" },
    select: { id: true, practiceArea: true, targetMetric: true },
  });

  const { summary, highlightedMoments, reflectionPrompts } = await generateReport({
    insights: rawInsights,
    talkTime: classification.talkTime,
    totalDurationMs: transcription.durationMs,
    activeGoal,
  });

  // Stage 5: Persist everything in a transaction
  await prisma.$transaction(async (tx) => {
    const report = await tx.lessonReport.create({
      data: {
        recordingId,
        userId,
        summary: summary as any,
        highlightedMoments: highlightedMoments as any,
        reflectionPrompts: reflectionPrompts as any,
        status: "completed",
      },
    });

    await tx.transcript.create({
      data: {
        reportId: report.id,
        segments: transcription.segments as any,
        fullText: transcription.fullText,
      },
    });

    if (rawInsights.length > 0) {
      await tx.insight.createMany({
        data: rawInsights.map((insight) => ({
          reportId: report.id,
          type: insight.type,
          startMs: insight.startMs,
          endMs: insight.endMs,
          durationMs: insight.durationMs,
          metadata: insight.metadata as any,
        })),
      });
    }

    // Update goal progress if there's an active goal
    if (activeGoal) {
      const value = computeGoalMetric(activeGoal.practiceArea, summary);
      if (value !== null) {
        await tx.goalProgress.create({
          data: { goalId: activeGoal.id, reportId: report.id, value },
        });
      }
    }

    // Mark recording as completed
    await tx.lessonRecording.update({
      where: { id: recordingId },
      data: { status: "completed" },
    });
  });
}

function computeGoalMetric(
  practiceArea: string,
  summary: any
): number | null {
  switch (practiceArea) {
    case "wait_time":
      return summary.waitTime.waitTime1AvgMs / 1000; // seconds
    case "open_questions":
      return summary.questions.openEnded;
    case "student_talk_ratio":
      return summary.talkTime.studentPercent;
    case "uptake":
      return summary.uptakeCount;
    default:
      return null;
  }
}
```

- [ ] **Step 14: Create worker entrypoint**

Create `apps/worker/src/index.ts`:

```typescript
import { Worker } from "bullmq";
import { processLesson } from "./pipeline/orchestrator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"),
};

const worker = new Worker(
  "lesson-processing",
  async (job) => {
    console.log(`Processing job ${job.id}: recording ${job.data.recordingId}`);
    await processLesson(job.data);
    console.log(`Completed job ${job.id}`);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", async (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);

  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    // Mark recording as failed after all retries exhausted
    await prisma.lessonRecording.update({
      where: { id: job.data.recordingId },
      data: { status: "failed" },
    });
  }
});

worker.on("ready", () => {
  console.log("Worker ready and listening for jobs");
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
```

- [ ] **Step 15: Run all worker tests**

Run: `cd apps/worker && npx vitest run`
Expected: All 5 tests PASS (3 classify + 2 speaker-match)

- [ ] **Step 16: Commit**

```bash
git add apps/worker/
git commit -m "feat: implement AI processing pipeline with Deepgram, Bedrock, and BullMQ"
```

---

## Task 12: Mobile App — Auth Flow and Navigation

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/welcome.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(auth)/voice-enrollment.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/lib/api.ts`
- Create: `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/lib/storage.ts`

> **Note:** This task sets up Expo Router file-based navigation, auth state management, and the API client. It produces the complete navigation skeleton. Subsequent tasks fill in individual screens.

- [ ] **Step 1: Install mobile dependencies**

```bash
cd apps/mobile
npx expo install expo-router expo-secure-store expo-av expo-file-system expo-notifications
npx expo install react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context
npm install nativewind tailwindcss react-native-css-interop
npm install victory-native react-native-svg
```

- [ ] **Step 2: Create secure storage**

Create `apps/mobile/lib/storage.ts`:

```typescript
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "coachline_access_token";
const REFRESH_TOKEN_KEY = "coachline_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
```

- [ ] **Step 3: Create API client**

Create `apps/mobile/lib/api.ts`:

```typescript
import { getAccessToken, setAccessToken, setRefreshToken, getRefreshToken, clearTokens } from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401 && token) {
      // Try refresh
      const refreshed = await this.refresh();
      if (refreshed) {
        const newToken = await getAccessToken();
        const retryResponse = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
        if (!retryResponse.ok) throw new ApiError(retryResponse.status, await retryResponse.text());
        return retryResponse.json();
      }
      throw new ApiError(401, "Session expired");
    }

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  private async refresh(): Promise<boolean> {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        return false;
      }

      const data = await response.json();
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      return true;
    } catch {
      await clearTokens();
      return false;
    }
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }
  delete(path: string) {
    return this.request<void>(path, { method: "DELETE" });
  }
}

class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API Error ${status}: ${body}`);
  }
}

export const api = new ApiClient();
```

- [ ] **Step 4: Create auth state**

Create `apps/mobile/lib/auth.ts`:

```typescript
import { createContext, useContext } from "react";
import { getAccessToken, clearTokens, setAccessToken, setRefreshToken } from "./storage";
import { api } from "./api";
import type { User } from "@coachline/shared";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

- [ ] **Step 5: Create root layout with auth provider**

Create `apps/mobile/app/_layout.tsx`:

```tsx
import { useEffect, useState, useCallback } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthContext, type AuthState } from "../lib/auth";
import { getAccessToken, setAccessToken, setRefreshToken, clearTokens } from "../lib/storage";
import { api } from "../lib/api";
import type { User } from "@coachline/shared";

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        const me = await api.get<User>("/users/me");
        setUser(me);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      // Check voice enrollment
      if (!user.voiceEnrollmentUrl) {
        router.replace("/(auth)/voice-enrollment");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [user, segments, isLoading]);

  const authState: AuthState = {
    user,
    isLoading,
    signIn: async (email, password) => {
      const result = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
        "/auth/login", { email, password }
      );
      await setAccessToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      setUser(result.user);
    },
    signUp: async (email, password, name) => {
      const result = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
        "/auth/signup", { email, password, name }
      );
      await setAccessToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      setUser(result.user);
    },
    signOut: async () => {
      await api.delete("/auth/logout");
      await clearTokens();
      setUser(null);
    },
    checkAuth,
  };

  return (
    <AuthContext.Provider value={authState}>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 6: Create auth layout and welcome screen**

Create `apps/mobile/app/(auth)/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `apps/mobile/app/(auth)/welcome.tsx`:

```tsx
import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function Welcome() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0a0a0a" }}>
      <Text style={{ fontSize: 32, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 8 }}>
        Coachline
      </Text>
      <Text style={{ fontSize: 16, color: "#888", textAlign: "center", marginBottom: 48 }}>
        Your private instructional coach
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor="#555"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16,
          color: "#fff", fontSize: 16, marginBottom: 12,
          borderWidth: 1, borderColor: "#333",
        }}
      />

      <Pressable
        onPress={() => router.push({ pathname: "/(auth)/login", params: { email } })}
        style={{
          backgroundColor: "#2563eb", borderRadius: 12, padding: 16,
          alignItems: "center", marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Continue with Email</Text>
      </Pressable>

      <Pressable
        style={{
          backgroundColor: "#4285f4", borderRadius: 12, padding: 16,
          alignItems: "center", marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 7: Create tab layout**

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#222" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#666",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () => null }} />
      <Tabs.Screen name="lessons" options={{ title: "Lessons", tabBarIcon: () => null }} />
      <Tabs.Screen name="record" options={{ title: "Record", tabBarIcon: () => null }} />
      <Tabs.Screen name="goals" options={{ title: "Goals", tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: () => null }} />
    </Tabs>
  );
}
```

- [ ] **Step 8: Create placeholder tab screens**

Create `apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { View, Text } from "react-native";

export default function Home() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
      <Text style={{ color: "#fff", fontSize: 18 }}>Home Dashboard</Text>
    </View>
  );
}
```

Create the same pattern for `lessons/index.tsx`, `record.tsx`, `goals/index.tsx`, `profile.tsx` — each with a placeholder View and Text showing the screen name.

- [ ] **Step 9: Verify mobile app builds**

Run: `cd apps/mobile && npx expo start --no-dev --minify`
Expected: Expo starts without errors. Press `i` for iOS simulator or `a` for Android.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/
git commit -m "feat: set up mobile app with auth flow, navigation, and API client"
```

---

## Tasks 13-17: Mobile Screens (Summary)

> **Note:** Tasks 13-17 implement the individual mobile screens. Each follows the same pattern: create the screen component, wire up the API client, test on device. These are described at the component level with key implementation details.

### Task 13: Recording Screen (`apps/mobile/app/(tabs)/record.tsx`, `apps/mobile/components/AudioRecorder.tsx`)
- Implement `expo-av` Audio recording with waveform visualization
- Background recording support via `Audio.setAudioModeAsync({ allowsRecordingIOS: true, staysActiveInBackground: true })`
- On stop: get presigned URL, upload to S3 via `fetch` PUT, create recording via API, navigate to lessons list
- Timer display, animated record/stop button

### Task 14: Lesson Report Screen (`apps/mobile/app/(tabs)/lessons/[id].tsx`, `apps/mobile/components/LessonTimeline.tsx`, `apps/mobile/components/StatCard.tsx`, `apps/mobile/components/HighlightCard.tsx`)
- Fetch report, transcript, and insights from API
- Render talk-time bar (colored horizontal segments)
- Render stat cards grid (questions, wait time, uptake, student voice)
- Render highlighted moments with audio playback via `expo-av` Audio.Sound
- Render reflection prompts
- Audio playback with seek-to-timestamp from transcript and highlights

### Task 15: Home Dashboard (`apps/mobile/app/(tabs)/index.tsx`)
- Fetch active goal with latest progress
- Fetch recent lesson reports (last 5)
- Render goal progress card with progress bar
- Render recent lessons list with summary stats
- Big record button at bottom

### Task 16: Goal Screens (`apps/mobile/app/(tabs)/goals/index.tsx`, `apps/mobile/app/(tabs)/goals/[id].tsx`, `apps/mobile/components/GoalProgressChart.tsx`)
- Goal selection screen with curated practice areas + custom
- Goal progress screen with trend line chart (Victory Native)
- Starting vs current metric display
- Goal list with status badges

### Task 17: Voice Enrollment and Profile (`apps/mobile/app/(auth)/voice-enrollment.tsx`, `apps/mobile/app/(tabs)/profile.tsx`)
- Voice enrollment: guided recording with passage to read, 30-second timer, upload to S3, save via API
- Profile: account info, voice enrollment status, sign out, delete account with confirmation

---

## Task 18: Web Dashboard (Next.js) — Core Pages

> **Note:** The web dashboard mirrors the mobile report and goals views. Recording and upload are also supported via browser.

**Key files:**
- `apps/web/src/app/(dashboard)/page.tsx` — Home dashboard
- `apps/web/src/app/(dashboard)/lessons/[id]/page.tsx` — Lesson report
- `apps/web/src/app/(dashboard)/record/page.tsx` — Browser recording + file upload
- `apps/web/src/app/(dashboard)/goals/page.tsx` — Goals list + create
- `apps/web/src/app/(dashboard)/goals/[id]/page.tsx` — Goal progress

Implementation notes:
- Use ReactBits components for visual polish: Aurora background on auth pages, animated counters on stat cards, spotlight cards for highlights
- Browser recording via `MediaRecorder` API (fallback to file upload)
- Drag-and-drop file upload with format validation (MP3, WAV, M4A, AAC, OGG)
- Recharts for goal progress trend charts
- Tailwind CSS for all styling
- Server components for data fetching where possible, client components for interactive elements

- [ ] **Step 1: Implement web auth pages and API middleware**
- [ ] **Step 2: Implement dashboard home page**
- [ ] **Step 3: Implement lesson report page with timeline, stats, highlights, transcript**
- [ ] **Step 4: Implement browser recording + file upload page**
- [ ] **Step 5: Implement goals pages**
- [ ] **Step 6: Add ReactBits components (Aurora, animated counters, spotlight cards)**
- [ ] **Step 7: Verify all pages in browser**
- [ ] **Step 8: Commit**

---

## Task 19: CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx turbo typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: coachline_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/coachline_test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npx turbo test
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions CI pipeline"
```

---

## Task 20: Initial Deployment Setup

- [ ] **Step 1: Push to GitHub**

```bash
git push -u origin main
```

- [ ] **Step 2: Set up Render services**

Create on Render dashboard:
1. **Web Service** — `coachline-api` pointing to `apps/api`, build command: `npm ci && npx prisma generate && npm run build`, start: `npm start`
2. **Background Worker** — `coachline-worker` pointing to `apps/worker`, same build, start: `npm start`
3. **PostgreSQL** — `coachline-db`
4. **Redis** — `coachline-redis`

Set environment variables from `.env.example` on all services.

- [ ] **Step 3: Run initial migration on Render**

```bash
npx prisma migrate deploy
```

- [ ] **Step 4: Set up S3 bucket**

Create `coachline-audio` S3 bucket with:
- Server-side encryption (SSE-S3)
- CORS policy allowing uploads from web domain
- Lifecycle rule: move to IA after 90 days (cost optimization)

- [ ] **Step 5: Verify end-to-end**

- API health check: `curl https://coachline-api.onrender.com/health`
- Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit any config changes**

```bash
git add -A
git commit -m "chore: add deployment configuration"
```
