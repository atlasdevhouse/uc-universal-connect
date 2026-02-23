"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch device list
  useEffect(() => {
    const fetchPcs = async () => {
      try {
        const res = await fetch("/api/devices");
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) setPcs(data);
        }
      } catch { /* ignore */ }
    };
    fetchPcs();
    const interval = setInterval(fetchPcs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Stream screenshots when viewing a PC
  useEffect(() => {
    if (!selectedPc || !streaming) return;
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const res = await fetch(`/api/screenshot?deviceId=${encodeURIComponent(selectedPc.id)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.image) setScreenshot(data.image);
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 500)); // 2 FPS
      }
    };
    poll();
    return () => { active = false; };
  }, [selectedPc, streaming]);

  // Send input commands
  const sendCommand = useCallback(async (action: string, data: Record<string, unknown>) => {
    if (!selectedPc) return;
    await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: selectedPc.id, action, data }),
    });
  }, [selectedPc]);

  // Handle click on screenshot
  const handleScreenClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    sendCommand("click", { x, y });
  }, [sendCommand]);

  // Handle keyboard
  useEffect(() => {
    if (!selectedPc || !streaming) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyMap: Record<string, string> = {
        Enter: "{ENTER}", Backspace: "{BACKSPACE}", Tab: "{TAB}",
        Escape: "{ESC}", ArrowUp: "{UP}", ArrowDown: "{DOWN}",
        ArrowLeft: "{LEFT}", ArrowRight: "{RIGHT}", Delete: "{DELETE}",
        Home: "{HOME}", End: "{END}", F1: "{F1}", F2: "{F2}", F3: "{F3}",
        F4: "{F4}", F5: "{F5}", F11: "{F11}", F12: "{F12}",
      };
      if (keyMap[e.key]) {
        sendCommand("key", { key: keyMap[e.key] });
      } else if (e.key.length === 1) {
        sendCommand("type", { text: e.key });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPc, streaming, sendCommand]);

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
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/30 transition">
            <span>⚙️</span> Settings
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
            <h1 className="text-xl font-semibold">{selectedPc ? selectedPc.name : "Your Devices"}</h1>
            <p className="text-gray-500 text-sm">
              {selectedPc
                ? `${selectedPc.os} - ${selectedPc.ip} - ${selectedPc.resolution}`
                : `${pcs.filter(p => p.status === "online").length} online`
              }
            </p>
          </div>
          {selectedPc && (
            <div className="flex gap-2">
              <button
                onClick={() => { setStreaming(!streaming); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${streaming ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {streaming ? "⏹ Stop" : "▶ Start Viewing"}
              </button>
              <button
                onClick={() => { setSelectedPc(null); setStreaming(false); setScreenshot(null); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
              >
                ← Back
              </button>
            </div>
          )}
        </header>

        {selectedPc ? (
          <div className="flex-1 bg-black flex items-center justify-center p-4" ref={containerRef}>
            {screenshot ? (
              <img
                ref={imgRef}
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Remote screen"
                className="max-w-full max-h-full object-contain cursor-crosshair"
                onClick={handleScreenClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!imgRef.current) return;
                  const rect = imgRef.current.getBoundingClientRect();
                  const x = Math.round((e.clientX - rect.left) * (1920 / rect.width));
                  const y = Math.round((e.clientY - rect.top) * (1080 / rect.height));
                  sendCommand("rightclick", { x, y });
                }}
                draggable={false}
              />
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">🖥️</div>
                <p className="text-gray-400 text-lg">
                  {streaming ? "Waiting for first frame..." : "Click 'Start Viewing' to connect"}
                </p>
              </div>
            )}
          </div>
        ) : (
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
