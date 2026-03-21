"use client";

import { useState } from "react";
import { register } from "../api";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const router = useRouter();

    async function handleSubmit(e: any) {
        e.preventDefault();
        try {
            const result = await register(username, password);
            toast.success("Account creation successful.");
            setTimeout(() => {
                router.push("/login");
            }, 1000);
        } catch (err: any) {
            if (err?.username) {
                toast.error("Registration failed.");
            } else if (err?.password) {
                toast.error(err.password[0]);
            } else if (err?.non_field_errors) {
                toast.error(err.non_field_errors[0]);
            } else {
                toast.error("Registration failed.");
            }
        }
    }
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form 
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded 2xl shadow-md w-full max-w-sm space-y-4"
        >
            <h1 className="text-2xl font-bold text-center">Register with ObliVox</h1>

            <p className="text-sm italic text-center text-gray-500">
                Your voice. Your secrets. Fully protected.
            </p>

            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-blue-500"
            />
            <button 
                type="submit"
                className="w-full bg-[#0e4a5a] text-cyan-300 border border-cyan-700 p-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest"
            >
                Register
            </button>
            <p className="text-sm text-center text-cyan-900">
                Already have an account?{" "}
                <Link href="/login" className="text-cyan-500 hover:underline">
                    Login here.
                </Link>
            </p>
        </form>
      </div>
    );
}