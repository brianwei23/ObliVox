"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Background from "../components/site-background"
import ProtectedRoute from "../components/ProtectedRoute"

export default function Home() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("token");
    toast.success("Logging out.");
    router.push("/login");
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0e1a]">
        <Background />
        <div className="relative z-10 text-center space-y-4">
          <h1 className="text-2xl font-bold text-cyan-400 tracking-widest font-mono">Your Files</h1>
          <button
            onClick={handleLogout}
            className="bg-[#0e4a5a] text-cyan-300 border border-cyan-700 px-6 py-2 rounded-lg hover:bg-cyan-900 transition font-mono tracking-widest"
          >
            Logout
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
