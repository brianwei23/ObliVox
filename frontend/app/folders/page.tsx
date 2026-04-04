"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getFolders, createFolder, deleteFolder, renameFolder, decryptText, getSessionKey } from "../api";
import toast from "react-hot-toast";
import Background from "../components/site-background";
import ProtectedRoute from "../components/ProtectedRoute";

interface Folder {
    id: number;
    name: string;
    created_at: string;
}

export default function FoldersPage() {
    const router = useRouter();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [folderName, setFolderName] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    useEffect(() => {
        async function fetchFolders() {
            try {
                const data = await getFolders();
                const sessionKey = getSessionKey();
                if (!sessionKey) return;

                const loaded = await Promise.all(data.map(async (f: any) => {
                    const name = await decryptText(f.name, f.name_iv, sessionKey);
                    return { id: f.id, name, created_at: f.created_at };
                }));
                setFolders(loaded);
            } catch {
                toast.error("Failed to load folders.");
            }
        }
        fetchFolders();
    }, [])

    async function handleCreate() {
        if (!folderName.trim()) return;
        try {
            const saved = await createFolder(folderName.trim());
            const sessionKey = getSessionKey();
            if (!sessionKey) return;

            const name = await decryptText(saved.name, saved.name_iv, sessionKey);
            setFolders(prev => [{ id: saved.id, name, created_at: saved.created_at }, ...prev]);
            setFolderName("");
            setShowNamePrompt(false);
            toast.success("Folder created.");
        } catch {
            toast.error("Failed to create folder.");
        }
    }

    async function handleRename(id: number) {
        if (!editingName.trim()) {
            toast.error("Name cannot be empty.");
            return;
        }
        try {
            await renameFolder(id, editingName.trim());
            setFolders(prev => prev.map(f => f.id === id ? { ...f, name: editingName.trim() } : f));
            setEditingId(null);
            setEditingName("");
            toast.success("Folder renamed.");
        } catch {
            toast.error("Failed to rename folder.");
        }
    }

    async function handleDelete(id: number) {
        try {
            await deleteFolder(id);
            setFolders(prev => prev.filter(f => f.id !== id));
            toast.success("Folder deleted.");
        } catch {
            toast.error("Failed to delete folder.");
        }
    }

    return (
        <ProtectedRoute>
            <div className="h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
                <Background />
                <div className="relative z-10 flex items-center px-8 py-2">
                    <button
                        onClick={() => router.push("/home")}
                        className="bg-[#0e4a5a] text-cyan-600 hover:text-cyan-700 px-7 py-2 font-mono text-lg rounded-lg transition"
                    >
                        Back
                    </button>
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-cyan-400 tracking-widest font-mono">Folders</h1>
                </div>

                <div className="relative z-10 flex justify-center mt-2 mb-6">
                    <button
                        onClick={() => setShowNamePrompt(true)}
                        className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-16 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-sm"
                    >
                        + Add Folder
                    </button>
                </div>

                <div className="relative z-10 flex-1 px-8 overflow-y-auto max-w-3xl mx-auto w-full">
                    {folders.length === 0 && (
                        <p className="text-cyan-700 font-mono text-sm text-center">No folders yet.</p>
                    )}

                    <div className="flex flex-wrap gap-4">
                        {[...folders].map((folder) => (
                            <div
                                key={folder.id}
                                className="bg-[#0f1628] border border-cyan-900 rounded-xl p-4 flex flex-col items-center justify-center w-32 h-32 cursor-pointer hover:border-cyan-500 transition"
                            >
                                <div className="text-4xl mb-2">📁</div>
                                {editingId === folder.id ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRename(folder.id);
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                        autoFocus
                                        className="bg-[#141d30] border border-cyan-700 text-cyan-300 font-mono text-xs rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                ) : (
                                    <div className="flex items-center gap-1 w-full justify-center">
                                        <p className="text-cyan-300 font-mono text-xs truncate">{folder.name}</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingId(folder.id);
                                                setEditingName(folder.name);
                                            }}
                                            className="text-cyan-700 hover:text-cyan-400 transition text-xs shrink-0"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(folder.id);
                                    }}
                                    className="text-red-700 hover:text-red-400 transition text-xs mt-3"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {showNamePrompt && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-[#0f1628] border border-cyan-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
                            <h2 className="text-cyan-400 font-mono tracking-widest text-center">Name your folder</h2>
                            <input
                                type="text"
                                placeholder="e.g. Folder 1"
                                value={folderName}
                                onChange={(e) => setFolderName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                                autoFocus
                                className="w-full p-2 border border-cyan-900 rounded-lg bg-[#141d30] text-cyan-300 placeholder-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-600 font-mono"
                            />
                            <button
                                onClick={handleCreate}
                                className="w-full bg-[#0e4a5a] text-cyan-300 border border-cyan-700 p-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => { setShowNamePrompt(false); setFolderName(""); }}
                                className="w-full text-cyan-700 font-mono text-sm text-center hover:text-cyan-500 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {confirmDeleteId !== null && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-[#0f1628] border border-red-900 rounded-2xl p-8 w-full max-w-sm space-y-4">
                            <h2 className="text-red-400 font-mono tracking-widest text-center text-lg">Delete Folder</h2>
                            <p className="text-cyan-600 font-mono text-sm text-center">
                                Deletion is permanent and includes any content within it. Do you want to continue?
                            </p>
                            <div className="flex gap-3">
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
            </div>
        </ProtectedRoute>
    );
}