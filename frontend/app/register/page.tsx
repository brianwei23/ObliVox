"use client";

import { useState } from "react";
import { register } from "../api";

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(e: any) {
        e.preventDefault();
        const result = await register(username, password);
        console.log(result);
    }
    return (
        <form onSubmit={handleSubmit}>
            <h1>Register</h1>
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
            <button type="submit">Register</button>
        </form>
    );
}