"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LessonReport, LessonRecording, Transcript } from "@coachline/shared";
import { ReportZone1 } from "./components/ReportZone1";
import { ReportZone2 } from "./components/ReportZone2";
import { ReportZone3 } from "./components/ReportZone3";

export default function LessonReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<LessonReport | null>(null);
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rep, trans] = await Promise.all([
          api.get<LessonReport>(`/reports/${params.id}`),
          api.get<Transcript>(`/reports/${params.id}/transcript`).catch(() => null),
        ]);
        setReport(rep);
        setTranscript(trans);
        if (rep.recordingId) {
          api.get<LessonRecording>(`/recordings/${rep.recordingId}`).then(setRecording).catch(() => null);
        }
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{error || "Report not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-400 hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  const intent = recording?.intent ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => router.back()}
        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {report.status !== "completed" && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-yellow-400 text-sm">
          This report is still {report.status}. Full analytics will be available when processing is complete.
        </div>
      )}

      {report.status === "completed" && report.summary && (
        <>
          <ReportZone1 report={report} intent={intent} />
          <ReportZone2 summary={report.summary} intent={intent} />
          <ReportZone3
            report={report}
            transcript={transcript}
            activeSegment={activeSegment}
            onSegmentPlay={(i) => {
              setActiveSegment(i);
              if (audioRef.current && transcript?.segments[i]) {
                audioRef.current.currentTime = transcript.segments[i].startMs / 1000;
                audioRef.current.play();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
