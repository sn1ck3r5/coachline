import { PrismaClient } from "@prisma/client";
import { transcribeLesson } from "./transcribe";
import { classifySegments } from "./classify";
import { analyzeTranscript } from "./analyze";
import { generateReport } from "./report";
import { computeParticipationDistribution, computeDiscoursePatterns } from "./discourse";
import { getPresignedUrl } from "../services/s3";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export async function processLesson(data: {
  recordingId: string;
  userId: string;
  audioUrl: string;
}): Promise<void> {
  const { recordingId, userId, audioUrl } = data;
  const prisma = getPrisma();

  // Generate a presigned URL so Deepgram can fetch the audio from S3
  const presignedAudioUrl = await getPresignedUrl(audioUrl);

  // Stage 1: Transcription + Diarization
  const transcription = await transcribeLesson(presignedAudioUrl);

  // Stage 2: Segment Classification + Discourse Metrics
  const classification = classifySegments(
    transcription.rawSegments,
    transcription.teacherSpeakerId,
    transcription.durationMs
  );

  const participationDistribution = computeParticipationDistribution(
    transcription.rawSegments,
    transcription.teacherSpeakerId
  );

  // Stage 3: Coaching Analysis
  const rawInsights = await analyzeTranscript(transcription.segments);

  // Stage 4: Report Generation
  // Fetch active goal + user's target grade + recording intent in parallel
  const [activeGoal, user, recording] = await Promise.all([
    prisma.goal.findFirst({
      where: { userId, status: "active" },
      select: { id: true, practiceArea: true, targetMetric: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { targetGrade: true },
    }),
    prisma.lessonRecording.findUnique({
      where: { id: recordingId },
      select: { intent: true },
    }),
  ]);

  const teacherSegments = transcription.segments.filter(
    (s) => s.speaker === "teacher"
  );

  // Discourse patterns require the full insight list (for IRE closure rate)
  // so they're computed after the analyze stage.
  const discoursePatterns = computeDiscoursePatterns(transcription.segments, rawInsights);

  const { summary, highlightedMoments, reflectionPrompts } = await generateReport({
    insights: rawInsights,
    talkTime: classification.talkTime,
    totalDurationMs: transcription.durationMs,
    activeGoal,
    teacherSegments,
    targetGrade: user?.targetGrade ?? null,
    intent: (recording?.intent as import("@coachline/shared").LessonIntent | null) ?? null,
    participationDistribution,
    discoursePatterns,
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
    case "dok_mix": {
      // % of classified questions at DOK 3 or 4 — a higher value means more
      // questions are demanding strategic or extended thinking.
      const d = summary.questions?.dok;
      if (!d) return null;
      const total = d.level1 + d.level2 + d.level3 + d.level4;
      if (total === 0) return null;
      return ((d.level3 + d.level4) / total) * 100;
    }
    case "praise_ratio":
      return summary.praise?.praiseToCorrectionRatio ?? null;
    case "vocab_match": {
      // Distance from teacher target grade (0 = on target; positive = talking
      // above grade level; negative = below). Store absolute delta so goal
      // progress trends toward 0.
      const d = summary.vocabGradeLevel?.deltaVsTarget;
      return typeof d === "number" ? d : null;
    }
    default:
      return null;
  }
}
