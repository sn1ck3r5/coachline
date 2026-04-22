"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Mode = "video" | "audio";
type RecordingState = "idle" | "previewing" | "recording" | "stopped" | "uploading" | "done" | "error";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSupportedMimeType(mode: Mode): string {
  if (mode === "video") {
    const videoTypes = [
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const type of videoTypes) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
  }
  const audioTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of audioTypes) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export default function RecordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("video");
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    stopStream();
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
  }, [stopTimer, stopStream]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startPreview = useCallback(async () => {
    setError("");
    cleanup();
    try {
      const constraints: MediaStreamConstraints =
        mode === "video"
          ? { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
          : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mode === "video" && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setState("previewing");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera/microphone access denied";
      if (msg.includes("NotAllowedError") || msg.includes("denied")) {
        setError("Please allow camera and microphone access in your browser settings.");
      } else {
        setError(msg);
      }
      setState("error");
    }
  }, [mode, facingMode, cleanup]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = getSupportedMimeType(mode);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      recordedBlobRef.current = blob;
      recordedUrlRef.current = URL.createObjectURL(blob);
      stopTimer();
      stopStream();
      setState("stopped");
    };

    recorder.start(1000);
    setState("recording");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [mode, stopTimer, stopStream]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((f) => (f === "user" ? "environment" : "user"));
  }, []);

  // Re-start preview when facing mode changes
  useEffect(() => {
    if (state === "previewing") {
      startPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const uploadRecording = useCallback(async () => {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    setState("uploading");
    setError("");

    try {
      const isVideo = blob.type.startsWith("video/");
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("webm") ? "webm" : "bin";
      const filename = `lesson-${Date.now()}.${ext}`;
      const contentType = blob.type || (isVideo ? "video/mp4" : "audio/webm");

      // Get presigned upload URL
      const { url, key } = await api.post<{ url: string; key: string; expiresAt: string }>(
        "/recordings/upload-url",
        { contentType, fileName: filename }
      );

      // Upload to S3
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });

      // Create recording record
      const durationSeconds = Math.round(elapsed);
      await api.post("/recordings", {
        audioUrl: key,
        durationSeconds,
        fileSizeBytes: blob.size,
        title: `Lesson ${new Date().toLocaleDateString()}`,
      });

      setState("done");
      setTimeout(() => router.push("/lessons"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setState("error");
    }
  }, [elapsed, router]);

  const reset = useCallback(() => {
    cleanup();
    recordedBlobRef.current = null;
    setState("idle");
    setElapsed(0);
    setError("");
  }, [cleanup]);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Record a Lesson</h1>
        <p className="text-gray-400 text-sm mt-1">
          Record video or audio directly from your device
        </p>
      </div>

      {/* Mode toggle */}
      {state === "idle" && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("video")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              mode === "video"
                ? "bg-violet-600 text-white"
                : "bg-[#1a1a1a] text-gray-400 border border-white/5"
            }`}
          >
            <span className="mr-2">📹</span> Video + Audio
          </button>
          <button
            onClick={() => setMode("audio")}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              mode === "audio"
                ? "bg-violet-600 text-white"
                : "bg-[#1a1a1a] text-gray-400 border border-white/5"
            }`}
          >
            <span className="mr-2">🎙️</span> Audio Only
          </button>
        </div>
      )}

      {/* Video / Recording area */}
      <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 mb-6">
        {/* Video preview / playback */}
        {mode === "video" && (
          <div className="relative aspect-video bg-black">
            {(state === "previewing" || state === "recording") && (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Camera flip button */}
                <button
                  onClick={flipCamera}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                {/* Recording indicator */}
                {state === "recording" && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-sm font-mono tabular-nums">{formatTime(elapsed)}</span>
                  </div>
                )}
              </>
            )}

            {state === "stopped" && recordedUrlRef.current && (
              <video
                src={recordedUrlRef.current}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            )}

            {state === "idle" && (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">Tap below to start camera</p>
              </div>
            )}
          </div>
        )}

        {/* Audio-only recording UI */}
        {mode === "audio" && (
          <div className="p-8 flex flex-col items-center">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all mb-4 ${
                state === "recording"
                  ? "border-red-500 bg-red-500/10 animate-pulse"
                  : "border-white/10 bg-[#0a0a0a]"
              }`}
            >
              <svg
                className={`w-10 h-10 ${state === "recording" ? "text-red-400" : "text-gray-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            {(state === "recording" || state === "stopped" || state === "previewing") && (
              <div className="text-3xl font-mono text-white tabular-nums">{formatTime(elapsed)}</div>
            )}
          </div>
        )}

        {/* Controls bar */}
        <div className="p-4 flex items-center justify-center gap-4">
          {state === "idle" && (
            <button
              onClick={startPreview}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors text-sm"
            >
              {mode === "video" ? "Open Camera" : "Prepare Microphone"}
            </button>
          )}

          {state === "previewing" && (
            <button
              onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg shadow-red-600/30"
            >
              <div className="w-6 h-6 rounded-full bg-white" />
            </button>
          )}

          {state === "recording" && (
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center border-4 border-red-500"
            >
              <div className="w-6 h-6 rounded-sm bg-red-500" />
            </button>
          )}

          {state === "stopped" && (
            <div className="flex gap-3 w-full">
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 text-white font-medium transition-colors text-sm"
              >
                Discard
              </button>
              <button
                onClick={uploadRecording}
                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors text-sm"
              >
                Upload & Analyze
              </button>
            </div>
          )}

          {state === "uploading" && (
            <div className="flex items-center gap-3 text-gray-300 text-sm">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              Uploading recording...
            </div>
          )}

          {state === "done" && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Uploaded! Redirecting...
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      {(state === "idle" || state === "previewing") && (
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Tips:</strong>{" "}
            {mode === "video"
              ? "Position your device where it can see the classroom. The rear camera usually works best. Audio is captured alongside video — the AI analyzes both."
              : "Place your device near where you teach. Background noise is okay — the AI is trained for classroom environments."}
          </p>
        </div>
      )}

      {/* File upload section */}
      {state === "idle" && (
        <div className="mt-6 bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Or upload a file</p>
          <label className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 hover:border-white/20 cursor-pointer transition-colors text-sm text-gray-400 hover:text-gray-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Choose audio or video file
            <input
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024 * 1024) {
                  setError("File too large. Maximum 2 GB.");
                  return;
                }
                recordedBlobRef.current = file;
                setElapsed(0);
                setState("stopped");
              }}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
