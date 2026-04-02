let sessionKey: CryptoKey | null = null;

export function setSessionKey(key: CryptoKey) {
    sessionKey = key;
}

export function getSessionKey(): CryptoKey | null {
    return sessionKey;
}

export function clearSessionKey() {
    sessionKey = null;
}

export async function register(username: string, password: string) {
    const res = await fetch("http://localhost:8000/api/auth/register/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username,
            password,
        }),
    });

    let data;

    try {
        data = await res.json();
    } catch {
        data = {};
    }

    if (!res.ok) { throw data; }
    return data;
}

export async function login(username: string, password: string) {
    const res = await fetch("http://localhost:8000/api/auth/login/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username,
            password,
        }),
    });

    // Parse response
    let data;
    try {
        data = await res.json();
    } catch {
        data = {};
    }

    // Throw login error failed
    if (!res.ok) {
        throw data;
    }

    return data;
}

export async function getRecordings() {
    const token = localStorage.getItem("token");
    const res = await authFetch("http://localhost:8000/api/auth/recordings/", {
        headers: { "Authorization": `Bearer ${token}` },
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function uploadRecording(name: string, duration: number, audioBlob: Blob) {
    if (!sessionKey) throw { detail: "No encryption key. Please log in again." };

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Encrypt using session key derived from password
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        arrayBuffer
    );

    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    const res = await authFetch("http://localhost:8000/api/auth/recordings/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({name, duration, audio_data: audioBase64, iv: ivBase64 }),
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function renameRecording(id: number, name: string) {
    const token = localStorage.getItem("token");
    const res = await authFetch(`http://localhost:8000/api/auth/recordings/${id}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({name}),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function deleteRecording(id: number) {
    const token = localStorage.getItem("token");
    const res = await authFetch(`http://localhost:8000/api/auth/recordings/${id}/`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) throw await res.json();
}

async function refreshAccessToken(): Promise<string | null> {
    const refresh = localStorage.getItem("refresh");
    if (!refresh) return null;

    const res = await fetch("http://localhost:8000/api/auth/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem("token", data.access);
    return data.access;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Authorization": `Bearer ${token}`,
        },
    });

    if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) throw { detail: "Session expired. Please log in again." };

        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${newToken}`,
            },
        });
    }

    return res;
}

export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

    // Import password
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    // Derive AES-256-GCM key using 310,000 iterations
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 310000,
            hash: "SHA-256",
        },
        keyMaterial, 
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}