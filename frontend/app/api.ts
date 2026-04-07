let sessionKey: CryptoKey | null = null;

const folderKeys: Map<number, CryptoKey> = new Map();

export function setSessionKey(key: CryptoKey) {
    sessionKey = key;
}

export function getSessionKey(): CryptoKey | null {
    return sessionKey;
}

export function clearSessionKey() {
    sessionKey = null;
}

const decoyKeys: Map<number, CryptoKey> = new Map();

export function setDecoyKey(folderId: number, key: CryptoKey) {
    decoyKeys.set(folderId, key);
}

export function getDecoyKey(folderId: number): CryptoKey | null {
    return decoyKeys.get(folderId) || null;
}

const folderIsDecoy: Map<number, boolean> = new Map();

export function setFolderDecoyMode(folderId: number, isDecoy: boolean) {
    folderIsDecoy.set(folderId, isDecoy);
}

export function getFolderDecoyMode(folderId: number): boolean {
    return folderIsDecoy.get(folderId) || false;
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

export async function getRecordings(folderId: number | null = null, isDecoy: boolean = false) {
    let url = "http://localhost:8000/api/auth/recordings/";
    if (folderId) {
        url += `?folder_id=${folderId}&is_decoy=${isDecoy}`;
    }
    const res = await authFetch(url); 
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function uploadRecording(name: string, duration: number, audioBlob: Blob, expiresAt: string | null, folderId: number | null = null, encryptionKey?: CryptoKey, isDecoy: boolean = false) {
    const keyToUse = encryptionKey || sessionKey;
    if (!keyToUse) throw { detail: "No encryption key. Please log in again."};

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Encrypt using key derived from password
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        keyToUse,
        arrayBuffer
    );

    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const { encrypted: encryptedName, iv: nameIv } = await encryptText(name, keyToUse);

    const res = await authFetch("http://localhost:8000/api/auth/recordings/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: encryptedName, 
            name_iv: nameIv, 
            duration, 
            audio_data: audioBase64, 
            iv: ivBase64, 
            expires_at: expiresAt, 
            folder_id: folderId,
            is_decoy: isDecoy,
        }),
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function renameRecording(id: number, name: string, encryptionKey?: CryptoKey) {
    const keyToUse = encryptionKey || sessionKey;
    if (!keyToUse) throw { detail: "No encryption key. Please log in again." };

    const { encrypted: encryptedName, iv: nameIv } = await encryptText(name, keyToUse);

    const res = await authFetch(`http://localhost:8000/api/auth/recordings/${id}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({name: encryptedName, name_iv: nameIv}),
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

export async function encryptText(text: string, key: CryptoKey): Promise<{ encrypted: string, iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );
    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
    };
}

export async function decryptText(encryptedBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedBytes
    );
    return new TextDecoder().decode(decrypted);
}

export async function getFolders() {
    const res = await authFetch("http://localhost:8000/api/auth/folders/");
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function getFolder(id: number) {
    const res = await authFetch(`http://localhost:8000/api/auth/folders/${id}/`);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function createFolder(name: string, folderPassword: string | null = null, decoyPassword: string | null = null) {
    if (!sessionKey) throw { detail: "No encryption key. Please log in again." };

    const { encrypted: encryptedName, iv: nameIv } = await encryptText(name, sessionKey);

    let has_password = false;
    let folder_salt = null;
    let password_check = null;
    let password_check_iv = null;
    let decoy_salt = null;
    let decoy_check = null;
    let decoy_check_iv = null;

    if (folderPassword) {
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        folder_salt = btoa(String.fromCharCode(...saltBytes));
        has_password = true;

        const folderKey = await deriveKey(folderPassword, folder_salt);

        const { encrypted, iv } = await encryptText("oblivox-verify", folderKey);
        password_check = encrypted;
        password_check_iv = iv;

        if (decoyPassword) {
            const decoySaltBytes = crypto.getRandomValues(new Uint8Array(16));
            decoy_salt = btoa(String.fromCharCode(...decoySaltBytes));

            const decoyKey = await deriveKey(decoyPassword, decoy_salt);
            const { encrypted: de, iv: div } = await encryptText("oblivox-verify", decoyKey);
            decoy_check = de;
            decoy_check_iv = div;
        }
    }

    const res = await authFetch("http://localhost:8000/api/auth/folders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            name: encryptedName, 
            name_iv: nameIv, 
            has_password, 
            folder_salt, 
            password_check, 
            password_check_iv,
            decoy_salt,
            decoy_check,
            decoy_check_iv,
        }),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;

    if (folderPassword && folder_salt) {
        const key = await deriveKey(folderPassword, folder_salt);
        setFolderKey(data.id, key);
    }
    return data;
}

export async function renameFolder(id: number, name: string) {
    if (!sessionKey) throw { detail: "No encryption key. Please log in again." };

    const { encrypted: encryptedName, iv: nameIv }  = await encryptText(name, sessionKey);

    const res = await authFetch(`http://localhost:8000/api/auth/folders/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: encryptedName, name_iv: nameIv }),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw data;
    return data;
}

export async function deleteFolder(id: number) {
    const res = await authFetch(`http://localhost:8000/api/auth/folders/${id}/`, {
        method: "DELETE",
    });
    if (!res.ok) throw await res.json();
}

export function setFolderKey(folderId: number, key: CryptoKey) {
    folderKeys.set(folderId, key);
}

export function getFolderKey(folderId: number): CryptoKey | null {
    return folderKeys.get(folderId) || null;
}

export function clearFolderKey(folderId: number) {
    folderKeys.delete(folderId);
}

export function clearDecoyKey(folderId: number) {
    decoyKeys.delete(folderId);
}