"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export default function UserDownloadsPage() {
  const { userId, role } = useAuth(); 
  const [token, setToken] = useState<string | null>(null);
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || "https://uc-universal-connect-omega.vercel.app";
  useEffect(() => {
    if (userId) {
      // Fetch the install token for the logged-in user
      fetch(`/api/auth/token?userId=${userId}`)
        .then(r => r.json())
        .then(d => { if (d.token) setToken(d.token); })
        .catch(() => {});
    }
  }, [userId]);

  const downloadLink = token ? `${vercelUrl}/api/agent/download?token=${token}` : "#";
  const deployCmd = `mkdir C:\\UC 2>nul & curl -o C:\\UC\\UCAgent_${token?.substring(0, 8) || ""}.cs "${downloadLink}" && C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:winexe /out:C:\\UC\\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll /r:System.Web.Extensions.dll C:\\UC\\UCAgent_${token?.substring(0, 8) || ""}.cs && C:\\UC\\UCService.exe`;

  return (
    <AppShell role={role}>
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">📥 Downloads</h1>
        <p className="text-gray-500 text-sm">Install the agent on your Windows PC</p>
      </header>

      <div className="p-6 space-y-6">
        {token && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h3 className="font-semibold text-lg mb-2">🔑 Your Install Token</h3>
            <p className="text-gray-400 text-sm mb-3">This token links devices to your account</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-cyan-400 font-mono text-sm select-all">{token}</code>
              <button onClick={() => navigator.clipboard.writeText(token)}
                className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition whitespace-nowrap">📋 Copy</button>
            </div>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-2">⚡ Quick Deploy</h3>
          <p className="text-gray-400 text-sm mb-4">Run this command on your Windows PC (CMD as Administrator):</p>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-cyan-400 break-all select-all border border-gray-800">
            {deployCmd}
          </div>
          <button onClick={() => navigator.clipboard.writeText(deployCmd)}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition">📋 Copy Command</button>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-4">📋 How It Works</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: "1", icon: "💻", title: "Run Command", desc: "Paste the deploy command into CMD on any Windows PC" },
              { step: "2", icon: "🔗", title: "Auto Connect", desc: "Agent compiles and starts — your device appears instantly" },
              { step: "3", icon: "🖥️", title: "Remote Access", desc: "View and control the PC from your dashboard" },
            ].map(s => (
              <div key={s.step} className="bg-gray-950 rounded-lg p-4 border border-gray-800 text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="text-cyan-400 text-xs font-bold mb-1">STEP {s.step}</div>
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-gray-400 text-xs mt-1">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
