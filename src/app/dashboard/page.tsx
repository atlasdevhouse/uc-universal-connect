"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface PC {
  id: string;
  name: string;
  os: string;
  ip: string;
  resolution: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
}

export default function DashboardPage() {
  const [pcs, setPcs] = useState<PC[]>([]);
  const [selectedPc, setSelectedPc] = useState<PC | null>(null);

  useEffect(() => {
    const fetchPcs = async () => {
      try {
        const res = await fetch("/api/devices");
        if (res.ok) setPcs(await res.json());
      } catch {
        // Demo data fallback
        setPcs([
          { id: "1", name: "NIMBUS", os: "Windows 11", ip: "192.168.1.101", resolution: "1920x1080", status: "online", lastSeen: "now" },
          { id: "2", name: "WORKSTATION", os: "Windows 10", ip: "10.0.0.5", resolution: "2560x1440", status: "online", lastSeen: "now" },
          { id: "3", name: "OFFICE-PC", os: "Windows 11", ip: "172.16.0.22", resolution: "1920x1080", status: "offline", lastSeen: "2h ago" },
        ]);
      }
    };
    fetchPcs();
    const interval = setInterval(fetchPcs, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (s: string) => s === "online" ? "bg-green-500" : s === "away" ? "bg-yellow-500" : "bg-gray-500";
  const statusText = (s: string) => s === "online" ? "text-green-400" : s === "away" ? "text-yellow-400" : "text-gray-500";

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">UC</div>
          <span className="font-semibold">Dashboard</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 text-white">
            <span>🖥️</span> Devices
          </Link>
          <Link href="/dashboard/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/30 transition">
            <span>⚙️</span> Admin
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/30 transition">
            <span>🔔</span> Alerts
          </Link>
        </nav>
        <div className="p-3 border-t border-gray-800">
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/30 transition text-sm">
            ← Log out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Your Devices</h1>
            <p className="text-gray-500 text-sm">{pcs.filter(p => p.status === "online").length} online · {pcs.length} total</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
            + Add PC
          </button>
        </header>

        {selectedPc ? (
          /* Remote viewer */
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${statusColor(selectedPc.status)}`}></div>
                <span className="font-medium">{selectedPc.name}</span>
                <span className="text-gray-500 text-sm">{selectedPc.ip} · {selectedPc.resolution}</span>
              </div>
              <button onClick={() => setSelectedPc(null)} className="text-gray-400 hover:text-white text-sm">✕ Close</button>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🖥️</div>
                <p className="text-gray-400 text-lg">Connecting to {selectedPc.name}...</p>
                <p className="text-gray-600 text-sm mt-2">WebRTC stream will appear here</p>
                <div className="mt-6 flex gap-3 justify-center">
                  <button className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">📋 Clipboard</button>
                  <button className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">📁 Files</button>
                  <button className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">⌨️ Keys</button>
                  <button className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition">⏻ Disconnect</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PC grid */
          <div className="flex-1 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pcs.map((pc) => (
                <button
                  key={pc.id}
                  onClick={() => pc.status === "online" && setSelectedPc(pc)}
                  className={`text-left rounded-xl p-5 border transition ${
                    pc.status === "online"
                      ? "bg-gray-900 border-gray-700 hover:border-blue-500 cursor-pointer"
                      : "bg-gray-900/50 border-gray-800 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColor(pc.status)}`}></div>
                      <span className="font-semibold">{pc.name}</span>
                    </div>
                    <span className={`text-xs ${statusText(pc.status)}`}>{pc.status}</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>{pc.os}</p>
                    <p>{pc.ip} · {pc.resolution}</p>
                    <p className="text-gray-600">Last seen: {pc.lastSeen}</p>
                  </div>
                  {pc.status === "online" && (
                    <div className="mt-3 text-blue-400 text-sm font-medium">Click to connect →</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
