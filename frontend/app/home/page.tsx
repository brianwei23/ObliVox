"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getRecordings, uploadRecording } from "../api";
import toast from "react-hot-toast";
import Background from "../components/site-background"
import ProtectedRoute from "../components/ProtectedRoute"

interface Recording {
  id: number;
  name: string;
  url: string;
  duration: number;
  created_at: string;
}

export default function Home() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number } | null>(null);

  // Holds MediaRecorder and audio chunks during recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pendingBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    async function fetchRecordings() {
      try {
        const data = await getRecordings();
        const loaded = data.map((rec: any) => {
          const bytes = Uint8Array.from(atob(rec.audio_data), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: "audio/webm" });
          return {
            id: rec.id,
            name: rec.name,
            duration: rec.duration,
            created_at: rec.created_at,
            url: URL.createObjectURL(blob),
          };
        });
        setRecordings(loaded);
      } catch {
        toast.error("Failed to load recordings.");
      }
    }
    fetchRecordings();
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    toast.success("Logging out.");
    router.push("/login");
  }

  async function startRecording() {
    try {
      // Request microphone access from browser
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);

        pendingBlobRef.current = blob;

        setPendingRecording({
          url,
          duration,
        });
        setShowNamePrompt(true);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error("Microphone access is denied.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function saveRecording() {
    if (!recordingName.trim()) {
      toast.error("Please enter a name.");
      return;
    }
    if (!pendingRecording || !pendingBlobRef.current) return;

    try {
      const saved = await uploadRecording(recordingName.trim(), pendingRecording.duration, pendingBlobRef.current);

      // Convert base64 response to playable URL
      const bytes = Uint8Array.from(atob(saved.audio_data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/webm" });

      setRecordings(prev => [...prev, {
        id: saved.id,
        name: saved.name,
        duration: saved.duration,
        created_at: saved.created_at,
        url: URL.createObjectURL(blob),
      }]);

      setShowNamePrompt(false);
      setRecordingName("");
      setPendingRecording(null);
      pendingBlobRef.current = null;
      toast.success("Recording saved.");
    } catch {
      toast.error("Failed to save recording.");
    }
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
        <Background />
        <div className="relative z-10 flex items-center px-8 py-4 border-cyan-900">
          <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-cyan-400 tracking-widest font-mono">ObliVox</h1>
          <div className="ml-auto">
            <button
              onClick={handleLogout}
              className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-6 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-sm -mt-2"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Recordings list */}
        <div className="relative z-10 px-8 py-6 space-y-3 overflow-y-auto max-w-3xl mx-auto w-full">
          <h2 className="text-cyan-400 font-mono tracking-widest text-xl mb-4 text-center">My Recordings</h2>

          {recordings.length === 0 && (
            <p className="text-cyan-600 font-mono text-sm text-center">No recordings yet.</p>
          )}

          {recordings.map((rec, i) => (
            <div key={i} className="bg-[#0f1628] bg-opacity-80 border border-cyan-900 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-cyan-300 font-mono font-bold text-lg">{rec.name}</p>
                <p className="text-cyan-400 font-mono text-sm">
                  {new Date(rec.created_at).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <audio controls src={rec.url} className="h-8"/>
            </div>
          ))}
        </div>
        {/* Record button at bottom of page */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-16 h-16 rounded-full border-2 transition-all font-mono flex items-center justify-center text-2xl ${
              isRecording
                ? "bg-red-900 border-red-500 animate-pulse"
                : "bg-[#0e4a5a] border-cyan-500 hover:bg-cyan-900"
            }`}
          >
            {isRecording ? "■" : "●"}
          </button>
          <span className="text-cyan-600 font-mono text-base tracking-widest">
            {isRecording ? "STOP" : "RECORD"}
          </span>
        </div>

        {showNamePrompt && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
              <h2 className="text-cyan-400 font-mono tracking-widest text-center">Name your recording</h2>
              <input
                type="text"
                placeholder="e.g. Recording 1"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                // Save on Enter key
                onKeyDown={(e) => e.key === "Enter" && saveRecording()}
                className="w-full p-2 border border-cyan-900 rounded lg bg-[#141d30] text-cyan-300 placeholder-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 font-mono"
              />
              <button
                onClick={saveRecording}
                className="w-full bg-[#0e4a5a] text-cyan-300 border border-cyan-700 p-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
