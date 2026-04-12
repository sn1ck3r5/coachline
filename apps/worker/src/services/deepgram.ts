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

  if (!result) {
    throw new Error("Deepgram returned no result for transcription");
  }

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
