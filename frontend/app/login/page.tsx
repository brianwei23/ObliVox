"use client";

import { useState } from "react";
import { login } from "../api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    async function handleSubmit(e: any) {
        e.preventDefault();
        try {
            const result = await login(username, password);
            localStorage.setItem("token", result.access);
            
            router.push("/");
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <form 
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm space-y-4"
            >
                <h1 className="text-2xl font-bold text-center">Login to ObliVox</h1>

                <p className="text-sm italic text-center text-gray-500">
                    Silence to all but the chosen.
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
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button 
                    type="submit"
                    className="w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition"
                >
                    Login
                </button>

                <p className="text-sm text-center text-gray-600">
                    Don't have an account?{" "}
                    <Link href="/register" className="text-blue-600 hover:underline">
                        Register here.
                    </Link>
                </p>
        </form>
      </div>
    );
}