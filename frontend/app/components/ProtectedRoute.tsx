"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSessionKey } from "../api";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // If no token, go to login
        const token = localStorage.getItem("token");
        const sessionKey = getSessionKey();

        console.log("ProtectedRoute checking auth", { pathname, hasToken: !!token, hasSessionKey: !!sessionKey });

        if (!token || !sessionKey) {
            // Save page for future redirect
            sessionStorage.setItem("redirectAfterLogin", pathname);
            console.log("Redirecting to login, no token or sessionKey");
            router.replace("/login");
        } else {
            console.log("Auth check passed, rendering children");
            setChecked(true);
        }
    }, [pathname, router]);

    // Render nothing until check completes
    if (!checked) return null;

    return <>{children}</>;
}