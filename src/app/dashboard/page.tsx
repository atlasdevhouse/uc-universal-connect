"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

interface PC {
  id: string;
  name: string;
  os: string;
  ip: string;
  resolution: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
}

type Point = { x: number; y: number };
type Ripple = {
  id: string;
  x: number; // px within displayed image box
  y: number;
  kind: "left" | "right" | "double";
  createdAt: number;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const uuid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

export default function DashboardPage() {
  const { role, userId, loaded } = useAuth();

  const [pcs, setPcs] = useState<PC[]>([]);
  const [selectedPc, setSelectedPc] = useState<PC | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [terminating, setTerminating] = useState(false);

  // --- Ripple overlay state ---
  const [ripples, setRipples] = useState<Ripple[]>([]);

  // --- Latency compensation (optional) ---
  // Tracks when the currently displayed frame arrived.
  const lastFrameShownAtRef = useRef<number>(Date.now());
  // Estimate cursor velocity (in SCREEN pixel units per ms, because we compute from naturalWidth mapping)
  const lastMoveRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const velocityRef = useRef<Point>({ x: 0, y: 0 });

  const fetchPcs = async () => {
    if (!loaded) return;
    if (role !== "admin" && !userId) return;

    try {
      const apiUrl = "/api/devices";
      const res = await fetch(apiUrl, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPcs(data);
      } else if (res.status === 401) {
        setPcs([]);
      }
    } catch (e) {
      console.error("Error fetching devices:", e);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPcs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleTerminate = async (deviceId: string) => {
    const confirmed = window.confirm(
      "Terminate this device connection? This will remove it from your dashboard."
    );
    if (!confirmed) return;

    setTerminating(true);
    try {
      const res = await fetch("/api/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deviceId, hardDelete: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to terminate device");
      }

      setSelectedPc(null);
      setStreaming(false);
      setScreenshot(null);
      await fetchPcs();
    } catch (e) {
      console.error("Terminate failed:", e);
      alert(e instanceof Error ? e.message : "Failed to terminate device");
    } finally {
      setTerminating(false);
    }
  };

  useEffect(() => {
    fetchPcs();
    const interval = setInterval(fetchPcs, 5000);
    return () => clearInterval(interval);
  }, [role, userId]);

  // Poll screenshots
  useEffect(() => {
    if (!selectedPc || !streaming) return;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const res = await fetch(
            `/api/screenshot?deviceId=${encodeURIComponent(selectedPc.id)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.image) {
              setScreenshot(data.image);
              lastFrameShownAtRef.current = Date.now();
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, [selectedPc, streaming]);

  const sendCommand = useCallback(
    async (action: string, data: Record<string, unknown>) => {
      if (!selectedPc) return;
      await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: selectedPc.id, action, data }),
      });
    },
    [selectedPc]
  );

  // ------------------------
  // Coordinate utilities
  // ------------------------
  const getScaledXYFromMouseEvent = useCallback(
    (e: React.MouseEvent<HTMLImageElement>): Point | null => {
      const img = imgRef.current;
      if (!img) return null;

      const rect = img.getBoundingClientRect();
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      if (!naturalWidth || !naturalHeight) return null;

      const rawX = (e.clientX - rect.left) * (naturalWidth / rect.width);
      const rawY = (e.clientY - rect.top) * (naturalHeight / rect.height);

      return {
        x: Math.round(clamp(rawX, 0, naturalWidth - 1)),
        y: Math.round(clamp(rawY, 0, naturalHeight - 1)),
      };
    },
    []
  );

  const getOverlayXY = useCallback((e: React.MouseEvent<HTMLImageElement>): Point | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  }, []);

  const applyLatencyComp = useCallback((scaled: Point): Point => {
    const img = imgRef.current;
    if (!img) return scaled;

    const ageMs = clamp(Date.now() - lastFrameShownAtRef.current, 0, 500);
    const damp = 0.65;

    const dx = velocityRef.current.x * ageMs * damp;
    const dy = velocityRef.current.y * ageMs * damp;

    return {
      x: Math.round(clamp(scaled.x + dx, 0, img.naturalWidth - 1)),
      y: Math.round(clamp(scaled.y + dy, 0, img.naturalHeight - 1)),
    };
  }, []);

  // ------------------------
  // Ripple overlay
  // ------------------------
  const pushRipple = useCallback(
    (e: React.MouseEvent<HTMLImageElement>, kind: Ripple["kind"]) => {
      const pt = getOverlayXY(e);
      if (!pt) return;
      setRipples((prev) => [
        ...prev,
        { id: uuid(), x: pt.x, y: pt.y, kind, createdAt: Date.now() },
      ]);
    },
    [getOverlayXY]
  );

  useEffect(() => {
    if (ripples.length === 0) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - 800;
      setRipples((prev) => prev.filter((r) => r.createdAt > cutoff));
    }, 200);
    return () => clearInterval(t);
  }, [ripples.length]);

  const rippleDots = useMemo(() => {
    return ripples.map((r) => {
      const size = r.kind === "double" ? 34 : 28;
      const border =
        r.kind === "right"
          ? "2px solid rgba(255,255,255,.85)"
          : r.kind === "double"
          ? "2px solid rgba(255,255,255,.95)"
          : "2px solid rgba(255,255,255,.8)";
      return (
        <span
          key={r.id}
          style={{
            position: "absolute",
            left: r.x - size / 2,
            top: r.y - size / 2,
            width: size,
            height: size,
            borderRadius: "999px",
            border,
            boxShadow: "0 0 0 2px rgba(0,0,0,.25)",
            transform: "scale(0.7)",
            opacity: 0.95,
            pointerEvents: "none",
            animation: "ucRipple 650ms ease-out forwards",
          }}
        />
      );
    });
  }, [ripples]);

  // ------------------------
  // Mouse move velocity (for latency comp)
  // ------------------------
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      const scaled = getScaledXYFromMouseEvent(e);
      if (!scaled) return;

      const t = nowMs();
      const last = lastMoveRef.current;
      if (!last) {
        lastMoveRef.current = { t, x: scaled.x, y: scaled.y };
        return;
      }

      const dt = t - last.t;
      if (dt <= 0) return;

      const vx = (scaled.x - last.x) / dt;
      const vy = (scaled.y - last.y) / dt;

      const alpha = 0.25; // smoothing
      velocityRef.current = {
        x: velocityRef.current.x * (1 - alpha) + vx * alpha,
        y: velocityRef.current.y * (1 - alpha) + vy * alpha,
      };

      lastMoveRef.current = { t, x: scaled.x, y: scaled.y };

      // If dragging, also send drag_move
      if (draggingRef.current) {
        const now = nowMs();
        if (now - lastDragSentRef.current >= 16) {
          lastDragSentRef.current = now;
          sendCommand("drag_move", scaled);
        }
      }
    },
    [getScaledXYFromMouseEvent, sendCommand]
  );

  // ------------------------
  // Click + RightClick + DoubleClick
  // ------------------------
  const handleScreenClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (e.button !== 0) return; // left only
      const scaled = getScaledXYFromMouseEvent(e);
      if (!scaled) return;

      pushRipple(e, "left");
      sendCommand("click", applyLatencyComp(scaled));
    },
    [applyLatencyComp, getScaledXYFromMouseEvent, pushRipple, sendCommand]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      e.preventDefault();
      const scaled = getScaledXYFromMouseEvent(e);
      if (!scaled) return;

      pushRipple(e, "right");
      sendCommand("rightclick", applyLatencyComp(scaled));
    },
    [applyLatencyComp, getScaledXYFromMouseEvent, pushRipple, sendCommand]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      const scaled = getScaledXYFromMouseEvent(e);
      if (!scaled) return;

      pushRipple(e, "double");
      sendCommand("doubleclick", applyLatencyComp(scaled));
    },
    [applyLatencyComp, getScaledXYFromMouseEvent, pushRipple, sendCommand]
  );

  // ------------------------
  // Scroll wheel
  // ------------------------
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLImageElement>) => {
      e.preventDefault();
      const img = imgRef.current;
      if (!img) return;

      // Try to include pointer position; WheelEvent on React includes clientX/clientY
      const rect = img.getBoundingClientRect();
      const clientX = (e as any).clientX ?? rect.left + rect.width / 2;
      const clientY = (e as any).clientY ?? rect.top + rect.height / 2;

      // Build a compatible object for scaler
      const fake = { clientX, clientY } as any as React.MouseEvent<HTMLImageElement>;
      const scaled = getScaledXYFromMouseEvent(fake);
      if (!scaled) return;

      const deltaY = clamp(e.deltaY, -1200, 1200);
      const deltaX = clamp(e.deltaX, -1200, 1200);

      sendCommand("scroll", { ...scaled, deltaX, deltaY });
    },
    [getScaledXYFromMouseEvent, sendCommand]
  );

  // ------------------------
  // Drag support
  // ------------------------
  const draggingRef = useRef(false);
  const lastDragSentRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (e.button !== 0) return;
      const scaled = getScaledXYFromMouseEvent(e);
      if (!scaled) return;

      draggingRef.current = true;
      lastDragSentRef.current = nowMs();

      // Send drag start (agent should mouse-down at x,y)
      sendCommand("drag_start", scaled);
    },
    [getScaledXYFromMouseEvent, sendCommand]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!draggingRef.current) return;
      const scaled = getScaledXYFromMouseEvent(e);
      draggingRef.current = false;

      // On mouse up, end drag
      sendCommand("drag_end", scaled ?? {});
    },
    [getScaledXYFromMouseEvent, sendCommand]
  );

  const handleMouseLeave = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    sendCommand("drag_cancel", {});
  }, [sendCommand]);

  // ------------------------
  // Keyboard handling (keep your existing)
  // ------------------------
  useEffect(() => {
    if (!selectedPc || !streaming) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyMap: Record<string, string> = {
        Enter: "{ENTER}",
        Backspace: "{BACKSPACE}",
        Tab: "{TAB}",
        Escape: "{ESC}",
        ArrowUp: "{UP}",
        ArrowDown: "{DOWN}",
        ArrowLeft: "{LEFT}",
        ArrowRight: "{RIGHT}",
        Delete: "{DELETE}",
        Home: "{HOME}",
        End: "{END}",
      };

      if (keyMap[e.key]) sendCommand("key", { key: keyMap[e.key] });
      else if (e.key.length === 1) sendCommand("type", { text: e.key });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPc, streaming, sendCommand]);

  // ------------------------
  // Loading state
  // ------------------------
  if (!loaded) {
    return (
      <AppShell role={role}>
        <div className="p-6 text-gray-400">Loading devices...</div>
      </AppShell>
    );
  }

  // ------------------------
  // Single device view
  // ------------------------
  if (selectedPc) {
    return (
      <div className="flex flex-col h-screen bg-gray-950 text-white">
        <header className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <div>
              <h1 className="text-sm font-semibold">{selectedPc.name}</h1>
              <p className="text-gray-500 text-xs">
                {selectedPc.os} &bull; {selectedPc.ip} &bull; {selectedPc.resolution}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStreaming(!streaming)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                streaming ? "bg-red-600 hover:bg-red-500" : "bg-cyan-600 hover:bg-cyan-500"
              }`}
            >
              {streaming ? "⏹ Stop" : "▶ Start Viewing"}
            </button>

            <button
              onClick={() => handleTerminate(selectedPc.id)}
              disabled={terminating}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg text-sm transition"
            >
              {terminating ? "Terminating..." : "🗑 Terminate"}
            </button>

            <button
              onClick={() => {
                setSelectedPc(null);
                setStreaming(false);
                setScreenshot(null);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
            >
              ← Back
            </button>
          </div>
        </header>

        <div className="flex-1 bg-black flex items-center justify-center p-2">
          {screenshot ? (
            <div className="relative">
              <style>{`
                @keyframes ucRipple {
                  0%   { transform: scale(0.7); opacity: 0.95; }
                  70%  { transform: scale(1.25); opacity: 0.35; }
                  100% { transform: scale(1.6); opacity: 0; }
                }
              `}</style>

              <img
                ref={imgRef}
                src={`data:image/jpeg;base64,${screenshot}`}
                alt="Remote screen"
                className="max-w-full max-h-full object-contain cursor-crosshair select-none"
                draggable={false}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onClick={handleScreenClick}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
              />

              {/* Ripple overlay */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-none">
                {rippleDots}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">🖥️</div>
              <p className="text-gray-400">
                {streaming ? "Waiting for first frame..." : "Click 'Start Viewing' to connect"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------
  // Devices list
  // ------------------------
  return (
    <AppShell role={role}>
      <header className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">🖥️ Devices</h1>
          <p className="text-gray-500 text-sm">
            {pcs.filter((p) => p.status === "online").length} online &bull; {pcs.length} total
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm font-medium transition"
        >
          <span className={refreshing ? "animate-spin" : ""}>🔄</span>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pcs.map((pc) => (
            <button
              key={pc.id}
              onClick={() => pc.status === "online" && setSelectedPc(pc)}
              className={`text-left rounded-xl p-5 border transition ${
                pc.status === "online"
                  ? "bg-gray-900 border-gray-700 hover:border-cyan-500 cursor-pointer"
                  : "bg-gray-900/50 border-gray-800 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      pc.status === "online"
                        ? "bg-green-500"
                        : pc.status === "away"
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }`}
                  />
                  <span className="font-semibold">{pc.name}</span>
                </div>
                <span
                  className={`text-xs ${
                    pc.status === "online"
                      ? "text-green-400"
                      : pc.status === "away"
                      ? "text-yellow-400"
                      : "text-gray-500"
                  }`}
                >
                  {pc.status}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <p>{pc.os}</p>
                <p>
                  {pc.ip} &bull; {pc.resolution}
                </p>
                <p className="text-xs text-gray-500">
                  Last seen: {pc.lastSeen ? new Date(pc.lastSeen).toLocaleString() : "never"}
                </p>
              </div>
              {pc.status === "online" && (
                <div className="mt-3 text-cyan-400 text-sm font-medium">Click to connect →</div>
              )}
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