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
