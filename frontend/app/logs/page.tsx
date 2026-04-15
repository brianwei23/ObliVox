"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLoginLogs } from "../api";
import Background from "../components/site-background";
import ProtectedRoute from "../components/ProtectedRoute";
import toast from "react-hot-toast";

interface LoginLog {
    id: number;
    logged_in_at: string;
    logged_out_at: string | null;
}

export default function LogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<LoginLog[]>([]);

    useEffect(() => {
        async function fetchLogs() {
            try {
                const data = await getLoginLogs();
                setLogs(data);
            } catch {
                toast.error("Failed to fetch logs.");
            }
        }
        fetchLogs();
    }, []);

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleString([], {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        });
    }

    return (
        <ProtectedRoute>
            <div className="h-screen flex flex-col relative overflow-hidden bg-[#0a0e1a]">
                <Background />

                <div className="relative z-10 flex items-center px-8 py-4">
                    <button
                        onClick={() => router.push("/home")}
                        className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-4 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest text-base"
                    >
                        ← Back
                    </button>
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-cyan-400 tracking-widest font-mono">Login Logs</h1>
                </div>

                <div className="relative z-10 flex-1 px-8 py-6 space-y-3 overflow-y-auto max-w-3xl mx-auto w-full">
                    {logs.length === 0 && (
                        <p className="text-cyan-700 font-mono text-sm text-center">No login history so far.</p>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className="bg-[#0f1628] border border-cyan-900 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-cyan-400 font-mono text-sm">
                                        <span className="text-cyan-300">Logged in:</span> {formatDate(log.logged_in_at)}
                                    </p>
                                    <p className="text-cyan-400 font-mono text-sm">
                                        <span className="text-cyan-300">Logged out:</span>{" "}
                                        {log.logged_out_at ? formatDate(log.logged_out_at) : (
                                            <span className="text-green-400">Active session</span>
                                        )}
                                    </p>
                                </div>
                                <div className={`text-xs font-mono px-3 py-1 rounded-full border ${
                                    log.logged_out_at
                                        ? "text-cyan-400 border-cyan-900"
                                        : "text-green-400 border-green-700 bg-green-950"
                                }`}>
                                    {log.logged_out_at ? "Ended" : "Active"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ProtectedRoute>
    );
}