"use client";

import { useState } from "react";
import { login } from "../api";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(e: any) {
        e.preventDefault();
        const result = await login(username, password);
        localStorage.setItem("token", result.access);
    }

    return (
        <form onSubmit={handleSubmit}>
            <h1>Login</h1>

            <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />

            <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Login</button>
        </form>
    );
}