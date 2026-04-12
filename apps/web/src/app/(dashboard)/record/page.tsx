"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { PresignedUrlResponse } from "@coachline/shared";

const ACCEPTED_FORMATS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
const ACCEPTED_MIME = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
];

type RecordingState = "idle" | "recording" | "stopped" | "uploading" | "done" | "error";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordPage() {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm, fall back to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioBlobRef.current = blob;
        stopTimer();
        setState("stopped");
      };

      recorder.start(1000);
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      setState("error");
    }
  }, [stopTimer]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopTimer();
  }, [stopTimer]);

  const validateFile = useCallback((file: File): boolean => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const validExt = ACCEPTED_FORMATS.includes(ext);
    const validMime = ACCEPTED_MIME.some((m) => file.type.startsWith(m.split("/")[0]) && file.type.includes(m.split("/")[1]));
    if (!validExt && !validMime) {
      setError(`Unsupported format. Accepted: ${ACCEPTED_FORMATS.join(", ")}`);
      return false;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError("File too large. Maximum 500 MB.");
      return false;
    }
    return true;
  }, []);

  const uploadAudio = useCallback(
    async (blob: Blob, filename: string, mimeType: string) => {
      setState("uploading");
      setUploadProgress(0);
      setError("");
      try {
        // 1. Create recording entry + get presigned URL
        const { url, recordingId } = await api.post<
          PresignedUrlResponse & { recordingId: string }
        >("/recordings/presigned-url", { filename, mimeType });

        // 2. Upload to presigned URL
        const file = blob instanceof File ? blob : new File([blob], filename, { type: mimeType });
        await api.uploadFile(url, file);
        setUploadProgress(100);

        // 3. Confirm upload
        await api.patch(`/recordings/${recordingId}`, { status: "processing" });

        setState("done");
        setTimeout(() => router.push("/lessons"), 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setState("error");
      }
    },
    [router]
  );

  const handleRecordedUpload = useCallback(() => {
    const blob = audioBlobRef.current;
    if (!blob) return;
    const ext = blob.type.includes("webm") ? "webm" : "ogg";
    uploadAudio(blob, `recording-${Date.now()}.${ext}`, blob.type);
  }, [uploadAudio]);

  const handleFileSelected = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;
      setUploadFile(file);
      setError("");
    },
    [validateFile]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected]
  );

  const handleFileUpload = useCallback(() => {
    if (!uploadFile) return;
    uploadAudio(uploadFile, uploadFile.name, uploadFile.type || "audio/mpeg");
  }, [uploadFile, uploadAudio]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Record a Lesson</h1>
        <p className="text-gray-400 text-sm mt-1">
          Record directly from your browser or upload an existing audio file
        </p>
      </div>

      {/* Browser recording */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
          Browser Recording
        </h2>

        <div className="flex flex-col items-center gap-6">
          {/* Mic icon / waveform */}
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all ${
              state === "recording"
                ? "border-red-500 bg-red-500/10 animate-pulse"
                : "border-white/10 bg-[#111]"
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

          {/* Timer */}
          {(state === "recording" || state === "stopped") && (
            <div className="text-3xl font-mono text-white tabular-nums">{formatTime(elapsed)}</div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {state === "idle" && (
              <button
                onClick={startRecording}
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                Start Recording
              </button>
            )}
            {state === "recording" && (
              <button
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
              >
                Stop
              </button>
            )}
            {state === "stopped" && (
              <>
                <button
                  onClick={() => {
                    setState("idle");
                    setElapsed(0);
                    audioBlobRef.current = null;
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#111] border border-white/10 hover:border-white/20 text-white font-medium transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleRecordedUpload}
                  className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                >
                  Upload &amp; Analyze
                </button>
              </>
            )}
            {state === "uploading" && (
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                Uploading… {uploadProgress}%
              </div>
            )}
            {state === "done" && (
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Uploaded! Redirecting…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File upload */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
          Upload File
        </h2>

        {/* Drag zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
            isDragOver
              ? "border-violet-500 bg-violet-500/5"
              : uploadFile
                ? "border-green-500/50 bg-green-500/5"
                : "border-white/10 hover:border-white/20 bg-[#111]"
          }`}
        >
          <svg
            className={`w-10 h-10 ${uploadFile ? "text-green-400" : "text-gray-500"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {uploadFile ? (
            <div className="text-center">
              <p className="text-sm font-medium text-green-400">{uploadFile.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-300">
                Drag &amp; drop an audio file, or{" "}
                <span className="text-violet-400 underline">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports: {ACCEPTED_FORMATS.join(", ")}
              </p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />

        {uploadFile && state !== "uploading" && state !== "done" && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setUploadFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="px-4 py-2 rounded-lg bg-[#111] border border-white/10 hover:border-white/20 text-sm text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleFileUpload}
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors"
            >
              Upload &amp; Analyze
            </button>
          </div>
        )}

        {state === "uploading" && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Uploading…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {state === "done" && (
          <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Upload complete! Redirecting to lessons…
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
