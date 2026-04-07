"use client";

import "../../globals.css";
import { useRouter, useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getRecordings, uploadRecording, deleteRecording, renameRecording, getSessionKey, getFolderKey, getDecoyKey, getFolderDecoyMode, decryptText, getFolder } from "../../api";
import toast from "react-hot-toast";
import Background from "../../components/site-background";
import ProtectedRoute from "../../components/ProtectedRoute";

interface Recording {
    id: number;
    name: string;
    url: string;
    duration: number;
    created_at: string;
    expires_at: string | null;
}

export default function FolderPage() {
    const router = useRouter();
    const params = useParams();
    const folderId = Number(params.id);

    const isDecoyMode = typeof window !== "undefined"
        ? sessionStorage.getItem(`folder_mode_${folderId}`) === "decoy"
        : false;

    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [recordingName, setRecordingName] = useState("");
    const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [showSelfDestruct, setShowSelfDestruct] = useState(false);
    const [pendingName, setPendingName] = useState("");
    const [folderName, setFolderName] = useState("Folder");
    const [folderHasPassword, setFolderHasPassword] = useState(false);

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
    ];

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const pendingBlobRef = useRef<Blob | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const folderData = await getFolder(folderId);
                console.log("has_password:", folderData.has_password);
                console.log("folder key exists:", !!getFolderKey(folderId));
                console.log("session key exists:", !!getSessionKey());
                
                setFolderHasPassword(folderData.has_password);

                const encKey = getEncryptionKey(folderData.has_password);

                if (!encKey) {
                    toast.error("No encryption key. Please enter your password again.");
                    router.push("/folders");
                    return;
                }

                const decryptedFolderName = await decryptText(folderData.name, folderData.name_iv, getSessionKey()!);
                setFolderName(decryptedFolderName);

                const isDecoy = getFolderDecoyMode(folderId);
                const data = await getRecordings(folderId, isDecoyMode);
                const loaded = await Promise.all(data.map(async (rec: any) => {
                    const name = await decryptText(rec.name, rec.name_iv, encKey);
                    const iv = Uint8Array.from(atob(rec.iv), c => c.charCodeAt(0));
                    const encryptedBytes = Uint8Array.from(atob(rec.audio_data), c => c.charCodeAt(0));
                    const decrypted = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv },
                        encKey,
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
                    };
                }));
                setRecordings(loaded);
            } catch {
                toast.error("Failed to load recordings.");
            }
        }
        fetchData();
    }, [folderId]);

    async function startRecording() {
        try {
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
                setPendingRecording({ url, duration });
                setShowNamePrompt(true);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch {
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

            const isDecoy = getFolderDecoyMode(folderId);
            // Pass folderId so recording is saved to this folder
            const saved = await uploadRecording(
                pendingName, 
                pendingRecording.duration, 
                pendingBlobRef.current, 
                selectedExpiresAt, 
                folderId, 
                getEncryptionKey() ?? undefined,
                isDecoy,
            );

            const encKey = getEncryptionKey();
            if (!encKey) {
                toast.error("No encryption key.")
                return;
            }

            const name = await decryptText(saved.name, saved.name_iv, encKey);
            const iv = Uint8Array.from(atob(saved.iv), c => c.charCodeAt(0));
            const encryptedBytes = Uint8Array.from(atob(saved.audio_data), c => c.charCodeAt(0));
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                encKey,
                encryptedBytes
            );
            const blob = new Blob([decrypted], { type: "audio/webm" });

            setRecordings(prev => [{
                id: saved.id,
                name,
                duration: saved.duration,
                created_at: saved.created_at,
                expires_at: saved.expires_at,
                url: URL.createObjectURL(blob),
            }, ...prev]);

            setShowSelfDestruct(false);
            setRecordingName("");
            setPendingRecording(null);
            setPendingName("");
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
            await renameRecording(id, editingName.trim(), getEncryptionKey() ?? undefined);
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
            toast.success("Recording deleted.");
        } catch {
            toast.error("Deletion error.");
        }
    }

    function getEncryptionKey(hasPassword?: boolean): CryptoKey | null {
        const passwordProtected = hasPassword !== undefined ? hasPassword : folderHasPassword;
        if (passwordProtected) {
            if (isDecoyMode) return getDecoyKey(folderId);
            return getFolderKey(folderId);
        }
        return getSessionKey();
    }

    return (
        <ProtectedRoute>
            <div className="h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
                <Background />

                {/* Header */}
                <div className="relative z-10 flex items-center px-8 py-4">
                    <button
                        onClick={() => router.push("/folders")}
                        className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-4 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-base"
                    >
                        ← Back
                    </button>
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-cyan-400 tracking-widest font-mono">
                        {folderName}
                    </h1>
                </div>

                {/* Recordings list */}
                <h2 className="relative z-10 text-cyan-400 font-mono tracking-widest text-xl mb-4 text-center">Recordings</h2>
                <div
                    className="relative z-10 flex-1 px-8 pt-2 pb-6 mb-40 space-y-3 overflow-y-auto max-w-3xl mx-auto w-full"
                    style={{ maxHeight: 'calc(100vh - 280px)' }}
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
                            <audio controls src={rec.url} className="h-8" />
                            <button
                                onClick={() => setConfirmDeleteId(rec.id)}
                                className="text-red-500 hover:text-red-400 font-mono text-sm border border-red-900 hover:border-red-500 px-4 py-1 rounded-lg transition"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>

                {/* Record button */}
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

                {/* Name prompt modal */}
                {showNamePrompt && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
                            <h2 className="text-cyan-400 font-mono tracking-widest text-center">Name your recording</h2>
                            <input
                                type="text"
                                placeholder="e.g. Recording 1"
                                value={recordingName}
                                onChange={(e) => setRecordingName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveRecording()}
                                className="w-full p-2 border border-cyan-900 rounded-lg bg-[#141d30] text-cyan-300 placeholder-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-600 font-mono"
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

                {/* Self destruct modal */}
                {showSelfDestruct && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
                            <h2 className="text-cyan-400 font-mono tracking-widest text-center">Self Destruct?</h2>
                            <p className="text-cyan-600 font-mono text-xs text-center">
                                Should this recording automatically delete after a certain time?
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

            {/* Delete confirm modal */}
            {confirmDeleteId !== null && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-[#0f1628] border border-red-900 rounded-2xl p-8 w-full max-w-sm space-y-4">
                        <h2 className="text-red-400 font-mono tracking-widest text-center text-lg">Confirm Deletion</h2>
                        <p className="text-cyan-600 font-mono text-sm text-center">
                            Deletion is permanent and cannot be reversed. Do you want to continue?
                        </p>
                        <div className="flex gap-6">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-2 rounded-lg hover:bg-cyan-950 transition font-mono tracking-widest"
                            >
                                Cancel
                            </button>
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