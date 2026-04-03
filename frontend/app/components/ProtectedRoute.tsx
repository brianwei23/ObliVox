"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionKey } from "../api";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // If no token, go to login
        const token = localStorage.getItem("token");
        const sessionKey = getSessionKey();

        if (!token || !sessionKey) {
            router.replace("/login");
        } else {
            setChecked(true);
        }
    }, []);

    // Render nothing until check completes
    if (!checked) return null;

    return <>{children}</>;
}