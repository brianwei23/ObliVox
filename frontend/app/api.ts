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
    return res.json();
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
    return res.json();
}