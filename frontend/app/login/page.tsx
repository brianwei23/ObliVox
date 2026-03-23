"use client";

import { useState } from "react";
import { login } from "../api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import Background from "../site-background"

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [lockTime, setLockTime] = useState<number | null>(null);

    const router = useRouter();

    async function handleSubmit(e: any) {
        e.preventDefault();

        if (lockTime && lockTime > 0) {
            toast.error(`Please wait ${lockTime}s before trying again.`);
            return;
        }

        try {
            const result = await login(username, password);
            // Only runs if login is successful
            localStorage.setItem("token", result.access);

            toast.success("Login successful!");
            
            router.push("/");
        } catch (err: any) {
            console.error(err);

            if (err?.remaining_seconds) {
                const seconds = err.remaining_seconds;
                setLockTime(seconds);
                toast.error(`Too many attempts. Try again in ${seconds}s`);

                let timer = seconds;
                const interval = setInterval(() => {
                    timer -= 1;
                    setLockTime(timer);

                    if (timer <= 0) {
                        clearInterval(interval);
                        setLockTime(null);
                    }
                }, 1000);
                return;
            }
            toast.error(err?.detail || "Invalid username or password");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0e1a]">
            <Background />
            <form 
                onSubmit={handleSubmit}
                className="relative z-10 bg-[#0f1628] border border-cyan-900 p-8 rounded-2xl w-full max-w-sm space-y-4"
            >
                <h1 className="text-2xl font-bold text-center text-cyan-400 tracking-widest font-mono">Login to ObliVox</h1>

                <p className="text-sm italic text-center text-cyan-600">
                    Silence to all but the chosen.
                </p>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 border border-cyan-900 rounded-lg bg-[#141d30] text-cyan-300 placeholder-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border border-cyan-900 rounded-lg bg-[#141d30] text-cyan-300 placeholder-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                />

                {lockTime && (
                    <p className="text-red-500 text-sm text-center">
                        Locked. Try again in {lockTime}s
                    </p>
                )}

                <button 
                    type="submit"
                    className={`w-full p-2 rounded-lg transition ${
                        lockTime
                            ? "bg-gray-800 cursor-not-allowed text-gray-600"
                            : "bg-[#0e4a5a] hover:bg-cyan-900 text-cyan-300 border border-cyan-700 font-mono tracking-widest"
                    }`}
                    disabled={!!lockTime}
                >
                    Login
                </button>

                <p className="text-sm text-center text-cyan-600">
                    Don't have an account?{" "}
                    <Link href="/register" className="text-cyan-500 hover:underline">
                        Register here.
                    </Link>
                </p>
        </form>
      </div>
    );
}