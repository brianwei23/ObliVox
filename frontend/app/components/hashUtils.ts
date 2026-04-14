import toast from "react-hot-toast";

export async function generateHash(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function computeIntegrity(url: string, storedHash?: string): Promise< {
    storedHash: string;
    computedHash: string;
    matched: Boolean;
} | null> {
    if (!storedHash) return null;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const computedHash = await generateHash(blob);

        return {
            storedHash,
            computedHash,
            matched: computedHash === storedHash,
        };
    } catch {
        return null;
    }
}
