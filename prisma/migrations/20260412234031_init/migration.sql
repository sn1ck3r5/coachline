-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('teacher', 'coach', 'admin');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('uploading', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'completed', 'paused');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'teacher',
    "avatarUrl" TEXT,
    "voiceEnrollmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_recordings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'uploading',
    "title" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_reports" (
    "id" UUID NOT NULL,
    "recordingId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "summary" JSONB NOT NULL,
    "highlightedMoments" JSONB NOT NULL,
    "reflectionPrompts" JSONB NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'processing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "segments" JSONB NOT NULL,
    "fullText" TEXT NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "targetMetric" TEXT NOT NULL,
    "customLabel" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_progress" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "lesson_recordings_userId_createdAt_idx" ON "lesson_recordings"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_reports_recordingId_key" ON "lesson_reports"("recordingId");

-- CreateIndex
CREATE INDEX "lesson_reports_userId_createdAt_idx" ON "lesson_reports"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_reportId_key" ON "transcripts"("reportId");

-- CreateIndex
CREATE INDEX "insights_reportId_type_idx" ON "insights"("reportId", "type");

-- CreateIndex
CREATE INDEX "goals_userId_status_idx" ON "goals"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goal_progress_goalId_reportId_key" ON "goal_progress"("goalId", "reportId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "lesson_recordings" ADD CONSTRAINT "lesson_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_reports" ADD CONSTRAINT "lesson_reports_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "lesson_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_reports" ADD CONSTRAINT "lesson_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lesson_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lesson_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lesson_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
