"use client";

import "../globals.css";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getRecordings, uploadRecording, deleteRecording, renameRecording, getSessionKey } from "../api";
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  // Holds MediaRecorder and audio chunks during recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const pendingBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    async function fetchRecordings() {
      try {
        const data = await getRecordings();
        const sessionKey = getSessionKey();
        const loaded = await Promise.all(data.map(async (rec: any) => {
          if (!sessionKey) return { id: rec.id, name: rec.name, duration: rec.duration, created_at: rec.created_at, url: "" };

          const iv = Uint8Array.from(atob(rec.iv), c => c.charCodeAt(0));
          const encryptedBytes = Uint8Array.from(atob(rec.audio_data), c => c.charCodeAt(0));

          const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            sessionKey,
            encryptedBytes
          );

          const blob = new Blob([decrypted], { type: "audio/webm" });
          return {
            id: rec.id,
            name: rec.name,
            duration: rec.duration,
            created_at: rec.created_at,
            url: URL.createObjectURL(blob),
          };
        }));
        setRecordings(loaded);
      } catch {
        toast.error("Failed to load recordings.");
      }
    }
    fetchRecordings();
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    toast.success("Logging out.");
    router.replace("/login");
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

      const sessionKey = getSessionKey();
      if (!sessionKey) {
        toast.error("No encryption key. Please log in again.");
        return;
      }

      // Decrypt audio
      const iv = Uint8Array.from(atob(saved.iv), c => c.charCodeAt(0));
      const encryptedBytes = Uint8Array.from(atob(saved.audio_data), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        encryptedBytes
      );
      const blob = new Blob([decrypted], { type: "audio/webm" });

      setRecordings(prev => [{
        id: saved.id,
        name: saved.name,
        duration: saved.duration,
        created_at: saved.created_at,
        url: URL.createObjectURL(blob),
      }, ...prev]);

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

  async function handleRename(id: number) {
    if (!editingName.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    try {
      await renameRecording(id, editingName.trim());
      setRecordings(prev => prev.map(r => r.id === id ? { ...r, name: editingName.trim() } : r));
      setEditingId(null);
      setEditingName("");
      toast.success("Recording renamed.");
    } catch {
      toast.error("Failed to rename recording.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      toast.success("Recording successfully deleted.");
    } catch {
      toast.error("Deletion error.");
    }
  }

  return (
    <ProtectedRoute>
      <div className="h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
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
        <h2 className="text-cyan-400 font-mono tracking-widest text-xl mb-4 text-center">My Recordings</h2>
        <div className="relative z-10 flex-1 px-8 pt-2 pb-6 mb-40 space-y-3 overflow-y-auto max-w-3xl mx-auto w-full oblivox-scrollbar"
          style={{ maxHeight: 'calc(100vh - 280px)'}}
        >
          {recordings.length === 0 && (
            <p className="text-cyan-600 font-mono text-sm text-center">No recordings yet.</p>
          )}

          {recordings.map((rec, i) => (
            <div key={i} className="bg-[#0f1628] bg-opacity-80 border border-cyan-900 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {editingId === rec.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(rec.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="bg-[#141d30] border border-cyan-700 text-cyan-300 font-mono font-bold text-lg rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  ) : (
                    <p className="text-cyan-300 font-mono font-bold text-lg">{rec.name}</p>
                  )}
                  {editingId !== rec.id && (
                    <button
                      onClick={() => { setEditingId(rec.id); setEditingName(rec.name); }}
                      className="text-cyan-700 hover:text-cyan-400 transition text-sm"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                <p className="text-cyan-400 font-mono text-sm">
                  {new Date(rec.created_at).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <audio controls src={rec.url} className="h-8"/>
              <button
                onClick={() => setConfirmDeleteId(rec.id)}
                className="text-red-500 hover:text-red-400 font-mono text-sm border border-red-900 hover:border-red-500 px-4 py-1 rounded-lg transition"
              >
                Delete
              </button>
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
      {confirmDeleteId !== null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#0f1628] border border-red-900 rounded-2xl p-8 w-full max-w-sm space-y-4">
            <h2 className="text-red-400 font-mono tracking-widest text-center text-lg">Confirm Deletion</h2>
            <p className="text-cyan-600 font-mono text-sm text-center">
              Deletion is permanent and cannot be reversed. Do you want to continue?
            </p>
            <div className="flex gap-3">
              {/* Cancel */}
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-2 rounded-lg hover:bg-cyan-950 transition font-mono tracking-widest"
              >
                Cancel
              </button>
              {/* Confirm */}
              <button
                onClick={async () => {
                  await handleDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 bg-red-950 text-red-400 border border-red-700 p-2 rounded-lg hover:bg-red-900 transition font-mono tracking-widest"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
