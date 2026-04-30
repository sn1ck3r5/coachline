import type { GoalProgressPayload, PracticeArea, ReportSummary } from "@coachline/shared";

export function buildPayload(
  area: PracticeArea,
  summary: ReportSummary | null | undefined
): GoalProgressPayload | null {
  if (!summary) return null;

  switch (area) {
    case "dok_mix": {
      const dok = summary.questions?.dok;
      if (!dok) return null;
      return {
        kind: "dok_mix",
        level1: dok.level1,
        level2: dok.level2,
        level3: dok.level3,
        level4: dok.level4,
        unclassified: dok.unclassified,
      };
    }
    case "praise_ratio": {
      const praise = summary.praise;
      if (!praise) return null;
      const specificToCorrection =
        praise.correction === 0 ? null : praise.specific / praise.correction;
      return {
        kind: "praise_ratio",
        specific: praise.specific,
        general: praise.general,
        correction: praise.correction,
        specificToCorrection,
      };
    }
    case "vocab_match": {
      const vocab = summary.vocabGradeLevel;
      if (!vocab) return null;
      return {
        kind: "vocab_match",
        teacherFleschKincaid: vocab.teacherFleschKincaid,
        targetGrade: vocab.targetGrade,
        deltaVsTarget: vocab.deltaVsTarget,
      };
    }
    default:
      return null;
  }
}
