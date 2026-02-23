"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [chatId, setChatId] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "admin">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true); setError(""); setSuccess("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push(data.role === "admin" ? "/admin" : "/dashboard");
  };

  const handleAdminLogin = async () => {
    setLoading(true); setError(""); setSuccess("");
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    router.push("/admin");
  };

  const handleRegister = async () => {
    setLoading(true); setError(""); setSuccess("");
    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess("Registration submitted! Waiting for admin approval.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (mode === "admin") handleAdminLogin();
      else if (mode === "login") handleLogin();
      else handleRegister();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-600 rounded-2xl mb-4">
              <span className="text-3xl font-bold">UC</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold">Universal Connect</h1>
          <p className="text-gray-400 mt-1">Secure Remote Access</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === "login" ? "bg-cyan-600" : "text-gray-400 hover:text-white"}`}>
              Login
            </button>
            <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === "register" ? "bg-cyan-600" : "text-gray-400 hover:text-white"}`}>
              Register
            </button>
          </div>

          <div className="space-y-4" onKeyDown={handleKeyDown}>
            {mode === "admin" ? (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Admin Chat ID</label>
                  <input type="text" value={chatId} onChange={e => setChatId(e.target.value)}
                    placeholder="Enter admin chat ID"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
                </div>
                <button onClick={handleAdminLogin} disabled={loading || !chatId}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition">
                  {loading ? "..." : "Admin Login"}
                </button>
                <button onClick={() => setMode("login")} className="w-full text-gray-500 hover:text-white text-sm transition">
                  ← Back to user login
                </button>
              </>
            ) : (
              <>
                {mode === "register" && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Min 6 characters" : "Enter password"}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
                </div>
                <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading || !email || !password}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition">
                  {loading ? "..." : mode === "login" ? "Login" : "Create Account"}
                </button>
              </>
            )}
            {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg px-3 py-2">{success}</p>}
          </div>

          {mode !== "admin" && (
            <button onClick={() => { setMode("admin"); setError(""); setSuccess(""); }}
              className="w-full text-gray-600 hover:text-gray-400 text-xs mt-4 transition">
              Admin access →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
