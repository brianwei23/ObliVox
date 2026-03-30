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
    const res = await fetch("http://localhost:8000/api/auth/recordings/", {
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

    const res = await fetch("http://localhost:8000/api/auth/recordings/", {
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