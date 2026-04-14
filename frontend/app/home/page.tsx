"use client";

import "../globals.css";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getRecordings, 
         uploadRecording, 
         deleteRecording, 
         renameRecording, 
         getSessionKey, 
         decryptText, 
         base64ToUint8Array, 
         searchUsers, 
         shareRecording 
       } from "../api";
import toast from "react-hot-toast";
import Background from "../components/site-background"
import ProtectedRoute from "../components/ProtectedRoute"
import { generateHash, computeIntegrity } from "../components/hashUtils";
import { stringify } from "querystring";

interface Recording {
  id: number;
  name: string;
  url: string;
  duration: number;
  created_at: string;
  expires_at: string | null;
  file_hash?: string;
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
  const [showSelfDestruct, setShowSelfDestruct] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState("");

  const [sharingRecordingId, setSharingRecordingId] = useState<number | null>(null);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{id: number, username: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: number; username: string } | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [integrityResult, setIntegrityResult] = useState<{
    storedHash: string;
    computedHash: string;
    matched: Boolean;
  } | null>(null);

  const selfDestructOptions = [
    { label: "5 minutes", minutes: 5 },
    { label: "10 minutes", minutes: 10 },
    { label: "30 minutes", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "6 hours", minutes: 360 },
    { label: "12 hours", minutes: 720 },
    { label: "1 day", minutes: 1440 },
    { label: "2 days", minutes: 2880 },
    { label: "3 days", minutes: 4320 },
    { label: "4 days", minutes: 5760 },
    { label: "5 days", minutes: 7200 },
  ]

  const handleFinalShare = async () => {
    if (!sharePassword || !targetUser || !sharingRecordingId) return;

    const recording = recordings.find(r => r.id === sharingRecordingId);
    if (!recording) return;

    setIsSharingLoading(true);
    try {
      await shareRecording(
        sharingRecordingId, 
        targetUser.id, 
        sharePassword, 
        recording.url, 
        recording.name,
        recording.file_hash
      );
      toast.success(`Encrypted and shared with ${targetUser.username}`);

      setSharingRecordingId(null);
      setTargetUser(null);
      setSharePassword("");
    } catch (error) {
      toast.error("Failed to encrypt and share.");
      console.error(error);
    } finally {
      setIsSharingLoading(false);
    }
  };

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
          if (!sessionKey) return { id: rec.id, name: "Encrypted", duration: rec.duration, created_at: rec.created_at, url: "" };

          const name = await decryptText(rec.name, rec.name_iv, sessionKey);

          const iv = Uint8Array.from(atob(rec.iv), c => c.charCodeAt(0));
          const encryptedBytes = base64ToUint8Array(rec.audio_data);

          const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            sessionKey,
            encryptedBytes
          );

          const blob = new Blob([decrypted], { type: "audio/webm" });
          return {
            id: rec.id,
            name,
            duration: rec.duration,
            created_at: rec.created_at,
            expires_at: rec.expires_at,
            url: URL.createObjectURL(blob),
            file_hash: rec.file_hash,
          };
        }));
        setRecordings(loaded);
      } catch {
        toast.error("Failed to load recordings.");
      }
    }
    fetchRecordings();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (shareSearchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const users = await searchUsers(shareSearchQuery);
        setSearchResults(users);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [shareSearchQuery])

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
    
    setPendingName(recordingName.trim());
    setShowNamePrompt(false);
    setShowSelfDestruct(true);
  }

  async function finalizeRecording(selectedExpiresAt: string | null) {
    if (!pendingRecording || !pendingBlobRef.current) return;

    try {
      const audioHash = await generateHash(pendingBlobRef.current);

      const saved = await uploadRecording(
        pendingName, 
        pendingRecording.duration, 
        pendingBlobRef.current, 
        selectedExpiresAt,
        null,
        undefined,
        false,
        audioHash
      );

      const sessionKey = getSessionKey();
      if (!sessionKey) {
        toast.error("No encryption key. Please log in again.");
        return;
      }
      const name = await decryptText(saved.name, saved.name_iv, sessionKey);

      const iv = Uint8Array.from(atob(saved.iv), c => c.charCodeAt(0));
      const encryptedBytes = base64ToUint8Array(saved.audio_data);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        encryptedBytes
      );
      const blob = new Blob([decrypted], { type: "audio/webm"});

      setRecordings(prev => [{
        id: saved.id,
        name,
        duration: saved.duration,
        created_at: saved.created_at,
        expires_at: saved.expires_at,
        url: URL.createObjectURL(blob),
        file_hash: saved.file_hash,
      }, ...prev]);

      setShowSelfDestruct(false);
      setRecordingName("");
      setPendingRecording(null);
      setPendingName("");
      setExpiresAt(null);
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
        <div className="relative z-10 flex gap-6 justify-center mb-4">
          <button
            onClick={() => {
              console.log("Folders button clicked");
              router.push("/folders");
            }}
            className="bg-[#146b83] text-cyan-300 border border-cyan-700 px-16 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-sm mt-2"
          >
            Folders
          </button>
          <button
            onClick={() => router.push("/shares")}
            className="bg-[#146b83] text-cyan-300 border border-cyan-700 px-12 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-sm mt-2"
          >
            View Shares
          </button>
        </div>
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
                {rec.expires_at && (
                  <p className="text-red-400 font-mono text-xs">
                    Expires: {new Date(rec.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <audio controls src={rec.url} className="h-8"/>
              <div className="flex gap-2">
                <button
                  onClick={() => setSharingRecordingId(rec.id)}
                  className="text-blue-400 hover:text-blue-300 font-mono text-sm border border-blue-900 hover:border-blue-500 px-4 py-1 rounded-lg transition"
                >
                  Share
                </button>
                <button
                  disabled={verifyingId === rec.id}
                  onClick={async () => {
                    setVerifyingId(rec.id);
                    const result = await computeIntegrity(rec.url, rec.file_hash);
                    setVerifyingId(null);
                    if (!result) {
                      setIntegrityResult({
                        storedHash: rec.file_hash || "N/A",
                        computedHash: "Failed to compute",
                        matched: false,
                      });
                    } else {
                      setIntegrityResult(result);
                    }
                  }}
                  className="text-cyan-400 hover:text-cyan-200 font-mono text-sm border border-cyan-900 hover:border-cyan-500 px-4 py-1 rounded-lg transition"
                >
                  {verifyingId === rec.id ? "Hashing..." : "Verify integrity"}
                </button>

                <button
                  onClick={() => setConfirmDeleteId(rec.id)}
                  className="text-red-500 hover:text-red-400 font-mono text-sm border border-red-900 hover:border-red-500 px-4 py-1 rounded-lg transition"
                >
                  Delete
                </button>
              </div>
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

        {showSelfDestruct && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
              <h2 className="text-cyan-400 font-mono tracking-widest text-center">Self Destruct?</h2>
              <p className="text-cyan-600 font-mono text-xs text-center">
                Should this recording automatically delete after a certain time? This action is irreversible.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selfDestructOptions.map((opt) => (
                  <button 
                    key={opt.label}
                    onClick={() => {
                      const expiry = new Date(Date.now() + opt.minutes * 60 * 1000).toISOString();
                      finalizeRecording(expiry);
                    }}
                    className="bg-[#141d30] text-cyan-300 border border-cyan-900 hover:border-cyan-500 px-3 py-2 rounded-lg font-mono text-xs transition"
                  > 
                    {opt.label}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => finalizeRecording(null)}
                className="w-full bg-[#0e4a5a] text-cyan-300 border border-cyan-700 p-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-sm"
              >
                No, keep forever.
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

      {sharingRecordingId !== null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#0f1628] border border-blue-900 rounded-2xl p-8 w-full max-w-sm space-y-4">
      
            {!targetUser ? (
              /* Step 1: Search */
              <>
                <h2 className="text-blue-400 font-mono tracking-widest text-center text-lg">Share Recording</h2>
                <p className="text-cyan-600 font-mono text-sm text-center">Search for the recipient.</p>
                <input
                  type="text"
                  value={shareSearchQuery}
                  onChange={(e) => setShareSearchQuery(e.target.value)}
                  placeholder="Search username..."
                  className="w-full bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-3 rounded-lg outline-none focus:border-cyan-500 font-mono"
                />
                <div className="min-h-30 max-h-50 bg-[#0a0e1a] border border-cyan-900 rounded-lg p-2 flex flex-col gap-2 overflow-y-auto">
                  {isSearching ? (
                    <p className="text-center animate-pulse py-4 font-mono text-cyan-700">Searching...</p>
                  ) : searchResults.map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => setTargetUser(user)}
                      className="w-full text-left px-4 py-3 bg-[#263552] border border-cyan-900/60 rounded-xl hover:bg-[#1a2b4a] hover:border-cyan-500 text-cyan-300 transition-all duration-200"
                    >
                      {user.username}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Step 2: Password */
              <>
                <h2 className="text-blue-400 font-mono tracking-widest text-center text-lg">Set Encryption Key</h2>
                <p className="text-cyan-600 font-mono text-xs text-center">
                  Create a password for <span className="text-cyan-300">@{targetUser.username}</span>. 
                  They need this to decrypt the audio.
                </p>
                <input
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Recipient's password..."
                  className="w-full bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-3 rounded-lg outline-none focus:border-cyan-500 font-mono"
                />
                <button 
                  disabled={isSharingLoading}
                  onClick={async () => {
                      const rec = recordings.find(r => r.id === sharingRecordingId);
                      if (!rec) return;
                      setIsSharingLoading(true);
                      try {
                          await shareRecording(sharingRecordingId, targetUser.id, sharePassword, rec.url, rec.name, rec.file_hash);
                          toast.success("Encrypted and shared.");
                          setSharingRecordingId(null);
                          setTargetUser(null);
                          setSharePassword("");
                      } catch {
                          toast.error("Sharing failed.");
                      } finally {
                          setIsSharingLoading(false);
                      }
                  }}
                  className="w-full bg-blue-900/40 text-blue-400 border border-blue-700 p-3 rounded-lg hover:bg-blue-800 transition font-mono"
                >
                  {isSharingLoading ? "Encrypting..." : "Encrypt & Send"}
                </button>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => {
                  if (targetUser) {
                      setTargetUser(null);
                      setSharePassword("");
                  } else {
                      setSharingRecordingId(null);
                      setShareSearchQuery("");
                  }
                }}
                className="flex-1 bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-2 rounded-lg hover:bg-cyan-950 transition font-mono tracking-widest"
              >
                {targetUser ? "Back" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {integrityResult !== null && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
              <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-lg space-y-4">
                  <h2 className="text-cyan-400 font-mono tracking-widest text-center text-lg">
                      Integrity Check (SHA-256)
                  </h2>

                  <div className="space-y-3">
                      <div>
                          <p className="text-cyan-600 font-mono text-sm mb-1">Stored Hash:</p>
                          <p className="text-cyan-300 font-mono text-sm break-all bg-[#0a0e1a] p-2 rounded-lg border border-cyan-900">
                              {integrityResult.storedHash}
                          </p>
                      </div>
                      <div>
                          <p className="text-cyan-600 font-mono text-sm mb-1">Current Computed Hash:</p>
                          <p className="text-cyan-300 font-mono text-sm break-all bg-[#0a0e1a] p-2 rounded-lg border border-cyan-900">
                              {integrityResult.computedHash}
                          </p>
                      </div>
                  </div>

                  <div className={`text-center font-mono text-lg font-bold py-2 rounded-lg ${
                      integrityResult.matched
                          ? "text-green-400 bg-green-950 border border-green-700"
                          : "text-red-400 bg-red-950 border border-red-700"
                  }`}>
                      {integrityResult.matched ? "Hashes match!" : "Hash mismatch."}
                  </div>

                  <button
                      onClick={() => setIntegrityResult(null)}
                      className="w-full bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-2 rounded-lg hover:bg-cyan-950 transition font-mono tracking-widest"
                  >
                      Close
                  </button>
              </div>
          </div>
      )}
    </ProtectedRoute>
  );
}
