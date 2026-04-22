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
