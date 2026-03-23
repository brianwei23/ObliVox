"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    useEffect(() => {
        // If no token, go to login
        const token = localStorage.getItem("token");
        if (!token) {
            router.replace("/login");
        }
    }, []);

    // Render nothing until check completes
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;

    return <>{children}</>;
}