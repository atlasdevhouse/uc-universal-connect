"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

interface PC {
  id: string; name: string; os: string; ip: string;
  resolution: string; status: "online" | "away" | "offline"; lastSeen: string;
}

export default function DashboardPage() {
  const { role, userId } = useAuth(); // Get userId from auth hook
  const [pcs, setPcs] = useState<PC[]>([]);
  const [selectedPc, setSelectedPc] = useState<PC | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const fetchPcs = async () => {
      try {
        let apiUrl = "/api/devices";
        // Only filter by userId if the user is not an admin
        if (role !== "admin" && userId) {
          apiUrl += `?userId=${userId}`;
        }
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          setPcs(data);
        }
      } catch (e) { console.error("Error fetching devices:", e); }
    };
    fetchPcs();
    const interval = setInterval(fetchPcs, 5000);
    return () => clearInterval(interval);
  }, [role, userId]); // Re-run effect if role or userId changes

  useEffect(() => {
    if (!selectedPc || !streaming) return;
    let active = true;
    const poll = async () => {
      while (active) {
        try { const res = await fetch(`/api/screenshot?deviceId=${encodeURIComponent(selectedPc.id)}`); if (res.ok) { const data = await res.json(); if (data.image) setScreenshot(data.image); } } catch {}
        await new Promise(r => setTimeout(r, 500));
      }
    };
    poll();
    return () => { active = false; };
  }, [selectedPc, streaming]);

  const sendCommand = useCallback(async (action: string, data: Record<string, unknown>) => {
    if (!selectedPc) return;
    await fetch("/api/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: selectedPc.id, action, data }) });
  }, [selectedPc]);

  const handleScreenClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (1920 / rect.width));
    const y = Math.round((e.clientY - rect.top) * (1080 / rect.height));
    sendCommand("click", { x, y });
  }, [sendCommand]);

  useEffect(() => {
    if (!selectedPc || !streaming) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyMap: Record<string, string> = {
        Enter: "{ENTER}", Backspace: "{BACKSPACE}", Tab: "{TAB}", Escape: "{ESC}",
        ArrowUp: "{UP}", ArrowDown: "{DOWN}", ArrowLeft: "{LEFT}", ArrowRight: "{RIGHT}",
        Delete: "{DELETE}", Home: "{HOME}", End: "{END}",
      };
      if (keyMap[e.key]) sendCommand("key", { key: keyMap[e.key] });
      else if (e.key.length === 1) sendCommand("type", { text: e.key });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPc, streaming, sendCommand]);

  // If viewing a PC, render full-screen without AppShell
  if (selectedPc) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 text-white">
        <header className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div>
              <h1 className="text-sm font-semibold">{selectedPc.name}</h1>
              <p className="text-gray-500 text-xs">{selectedPc.os} &bull; {selectedPc.ip} &bull; {selectedPc.resolution}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStreaming(!streaming)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${streaming ? "bg-red-600 hover:bg-red-500" : "bg-cyan-600 hover:bg-cyan-500"}`}>
              {streaming ? "⏹ Stop" : "▶ Start Viewing"}
            </button>
            <button onClick={() => { setSelectedPc(null); setStreaming(false); setScreenshot(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">← Back</button>
          </div>
        </header>
        <div className="flex-1 bg-black flex items-center justify-center p-2">
          {screenshot ? (
            <img ref={imgRef} src={`data:image/jpeg;base64,${screenshot}`} alt="Remote screen"
              className="max-w-full max-h-full object-contain cursor-crosshair"
              onClick={handleScreenClick}
              onContextMenu={e => { e.preventDefault(); if (!imgRef.current) return; const rect = imgRef.current.getBoundingClientRect(); sendCommand("rightclick", { x: Math.round((e.clientX - rect.left) * (1920 / rect.width)), y: Math.round((e.clientY - rect.top) * (1080 / rect.height)) }); }}
              draggable={false} />
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">🖥️</div>
              <p className="text-gray-400">{streaming ? "Waiting for first frame..." : "Click 'Start Viewing' to connect"}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell role={role}>
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">🖥️ Devices</h1>
        <p className="text-gray-500 text-sm">{pcs.filter(p => p.status === "online").length} online &bull; {pcs.length} total</p>
      </header>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pcs.map(pc => (
            <button key={pc.id} onClick={() => pc.status === "online" && setSelectedPc(pc)}
              className={`text-left rounded-xl p-5 border transition ${
                pc.status === "online" ? "bg-gray-900 border-gray-700 hover:border-cyan-500 cursor-pointer" : "bg-gray-900/50 border-gray-800 opacity-60 cursor-not-allowed"
              }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${pc.status === "online" ? "bg-green-500" : pc.status === "away" ? "bg-yellow-500" : "bg-gray-500"}`} />
                  <span className="font-semibold">{pc.name}</span>
                </div>
                <span className={`text-xs ${pc.status === "online" ? "text-green-400" : pc.status === "away" ? "text-yellow-400" : "text-gray-500"}`}>{pc.status}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <p>{pc.os}</p>
                <p>{pc.ip} &bull; {pc.resolution}</p>
              </div>
              {pc.status === "online" && <div className="mt-3 text-cyan-400 text-sm font-medium">Click to connect →</div>}
            </button>
          ))}
        </div>
        {pcs.length === 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
            <div className="text-4xl mb-3">🖥️</div>
            <p className="text-lg font-medium">No devices connected</p>
            <p className="text-sm mt-1">Deploy the agent on a Windows PC to get started</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
