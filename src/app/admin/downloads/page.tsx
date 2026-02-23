"use client";
import AppShell from "@/components/AppShell";

const DEPLOY_CMD = 'mkdir C:\\UC 2>nul & curl -o C:\\UC\\agent.cs "https://raw.githubusercontent.com/atlasdevhouse/uc-universal-connect/main/agent/UCAgent.cs" && C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:winexe /out:C:\\UC\\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll /r:System.Web.Extensions.dll C:\\UC\\agent.cs && C:\\UC\\UCService.exe';

export default function DownloadsPage() {
  return (
    <AppShell role="admin">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">📥 Downloads &amp; Deploy</h1>
        <p className="text-gray-500 text-sm">Install agent on target devices</p>
      </header>

      <div className="p-6 space-y-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Organization Details</h3>
              <p className="text-gray-400 text-sm mt-1">UC Universal Connect</p>
            </div>
            <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center font-bold">UC</div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-2">⚡ Quick Deploy Command</h3>
          <p className="text-gray-400 text-sm mb-4">Run this on the target Windows PC (CMD as Administrator):</p>
          <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-cyan-400 break-all select-all border border-gray-800">
            {DEPLOY_CMD}
          </div>
          <button onClick={() => navigator.clipboard.writeText(DEPLOY_CMD)}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition">
            📋 Copy Command
          </button>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold text-lg mb-2">📝 Manual Steps</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex gap-3"><span className="text-cyan-400 font-bold">1.</span> Create folder: <code className="bg-gray-800 px-2 py-0.5 rounded text-cyan-400">mkdir C:\UC</code></div>
            <div className="flex gap-3"><span className="text-cyan-400 font-bold">2.</span> Download agent source from GitHub</div>
            <div className="flex gap-3"><span className="text-cyan-400 font-bold">3.</span> Compile with .NET csc.exe (included on all Windows)</div>
            <div className="flex gap-3"><span className="text-cyan-400 font-bold">4.</span> Run the compiled EXE — device appears in dashboard</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
