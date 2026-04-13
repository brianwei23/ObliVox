"use client";

import { useState, useEffect } from "react";
import { getSharedRecordings, decryptText, base64ToUint8Array, deleteRecording } from "../api";
import Background from "../components/site-background";
import ProtectedRoute from "../components/ProtectedRoute";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function SharesPage() {
    const router = useRouter();
    const [shares, setShares] = useState<any[]>([]);
    const [passwords, setPasswords] = useState<{ [key: number]: string }>({});
    const [confirmDeleteShareId, setConfirmDeleteShareId] = useState<number | null>(null);

    useEffect(() => {
        fetchShares();
    }, []);

    async function fetchShares() {
        try {
            const data = await getSharedRecordings();
            setShares(data);
        } catch (err) {
            toast.error("Failed to load shared files.");
        }
    }

    async function unlockShare(shareId: number) {
        const share = shares.find((s) => s.id === shareId);
        const password = passwords[shareId];

        if (!password) return toast.error("Enter password first.");

        try {
            const { deriveKey } = await import("../api");
            const key = await deriveKey(password, share.salt);

            const name = await decryptText(share.name, share.name_iv, key);

            const iv = Uint8Array.from(atob(share.iv), (c) => c.charCodeAt(0));
            const encryptedBytes = base64ToUint8Array(share.audio_data);
            const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBytes);

            const blob = new Blob([decrypted], { type: "audio/webm" });
            const url = URL.createObjectURL(blob);

            setShares((prev) =>
                prev.map((s) => (s.id === shareId ? { ...s, name, url, unlocked: true } : s))
        );
        toast.success("Decrypted.");
    } catch (err) {
        toast.error("Invalid password. Decryption failed.");
    }
  }

  async function handleDeleteShare(id: number) {
    try {
        await deleteRecording(id);
        setShares(prev => prev.filter(s => s.id !== id));
        toast.success("Shared recording deleted.");
    } catch {
        toast.error("Failed to delete.");
    }
}

return (
    <ProtectedRoute>
        <>
            <div className="h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
                <Background />
                <div className="relative z-10 flex items-center px-8 py-4">
                    <button
                        onClick={() => router.push("/home")}
                        className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-4 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-base"
                    >
                        ← Back
                    </button>
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-cyan-400 tracking-widest font-mono">Shared With Me</h1>
                </div>

                <div className="relative z-10 flex-1 px-8 py-6 space-y-4 max-w-3xl mx-auto w-full overflow-y-auto">
                    {shares.length === 0 && <p className="text-center text-cyan-800 font-mono">No shares found.</p>}

                    {shares.map((share) => (
                        <div key={share.id} className="bg-[#0f1628]/80 border border-blue-900 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-blue-300 font-mono font-bold text-lg">
                                        {share.unlocked ? share.name: "Encrypted"}
                                    </h3>
                                    <p className="text-cyan-600 font-mono text-sm">
                                        Shared by: <span className="text-cyan-400">@{share.shared_by_username}</span>
                                    </p>
                                    <p className="text-cyan-700 font-mono text-sm">
                                        {new Date(share.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 items-center">
                                {share.unlocked ? (
                                    <audio controls src={share.url} className="w-full h-8" />
                                ) : (
                                    <input
                                        type="password"
                                        placeholder="Enter shared file password..."
                                        className="flex-1 bg-[#0a0e1a] border border-blue-900 rounded px-3 py-1 text-sm text-cyan-300 font-mono outline-none focus:border-blue-500"
                                        value={passwords[share.id] || ""}
                                        onChange={(e) => setPasswords({ ...passwords, [share.id]: e.target.value })}
                                    />
                                )}

                                {!share.unlocked && (
                                    <button
                                        onClick={() => unlockShare(share.id)}
                                        className="px-4 bg-blue-900/40 text-blue-400 border border-blue-700 py-2 rounded-lg text-xs font-mono hover:bg-blue-800 transition"
                                    >
                                        Unlock
                                    </button>
                                )}
                                <button
                                    onClick={() => setConfirmDeleteShareId(share.id)}
                                    className="w-fit px-4 bg-red-950/20 text-red-500 border border-red-900 hover:border-red-500 hover:text-red-400  py-2 rounded-lg text-xs font-mono transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {confirmDeleteShareId !== null && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="bg-[#0f1628] border border-red-900 rounded-2xl p-8 w-full max-w-sm space-y-4">
                        <h2 className="text-red-400 font-mono tracking-widest text-center text-lg">Confirm Deletion</h2>
                        <p className="text-cyan-600 font-mono text-sm text-center">
                            This is not reversible. Do you want to proceed?
                        </p>
                        <div className="flex gap-6">
                            <button
                                onClick={() => setConfirmDeleteShareId(null)}
                                className="flex-1 bg-[#0a0e1a] text-cyan-300 border border-cyan-900 p-2 rounded-lg hover:bg-cyan-950 transition font-mono tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await handleDeleteShare(confirmDeleteShareId!);
                                    setConfirmDeleteShareId(null);
                                }}
                                className="flex-1 bg-red-950 text-red-400 border border-red-700 p-2 rounded-lg hover:bg-red-900 transition font-mono tracking-widest"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    </ProtectedRoute>
  );

}