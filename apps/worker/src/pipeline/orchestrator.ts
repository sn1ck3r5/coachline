import { PrismaClient } from "@prisma/client";
import { transcribeLesson } from "./transcribe";
import { classifySegments } from "./classify";
import { analyzeTranscript } from "./analyze";
import { generateReport } from "./report";

let _prisma: PrismaClient;
function getPrisma() { return (_prisma ??= new PrismaClient()); }

export async function processLesson(data: {
  recordingId: string;
  userId: string;
  audioUrl: string;
}): Promise<void> {
  const { recordingId, userId, audioUrl } = data;
  const prisma = getPrisma();

  // Stage 1: Transcription + Diarization
  const transcription = await transcribeLesson(audioUrl);

  // Stage 2: Segment Classification
  const classification = classifySegments(
    transcription.rawSegments,
    transcription.teacherSpeakerId,
    transcription.durationMs
  );

  // Stage 3: Coaching Analysis
  const rawInsights = await analyzeTranscript(transcription.segments);

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
