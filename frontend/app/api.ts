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
    const token = localStorage.getItem("token");

    // Convert blob to base64
    const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(audioBlob);
    });

    const res = await authFetch("http://localhost:8000/api/auth/recordings/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({name, duration, audio_data: base64}),
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