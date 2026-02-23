"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface User {
  id: number; telegram_chat_id: string; telegram_username: string;
  display_name: string; role: string; subscription: string;
  status: string; install_token: string; created_at: string; last_login: string; expires_at: string;
}
interface Stats { totalUsers: number; activeUsers: number; pendingUsers: number; totalDevices: number; onlineDevices: number; }

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, pendingUsers: 0, totalDevices: 0, onlineDevices: 0 });
  const [tab, setTab] = useState("users");

  const fetchData = async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) { const d = await res.json(); setStats(d.stats); setUsers(d.users); }
  };
  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, []);

  const updateUser = async (id: number, updates: Record<string, string>) => {
    await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    fetchData();
  };
  const deleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchData();
  };

  const statCards = [
    { label: "TOTAL USERS", value: stats.totalUsers, color: "border-blue-500", text: "text-blue-400" },
    { label: "ACTIVE USERS", value: stats.activeUsers, color: "border-green-500", text: "text-green-400" },
    { label: "PENDING APPROVAL", value: stats.pendingUsers, color: "border-yellow-500", text: "text-yellow-400" },
    { label: "TOTAL DEVICES", value: stats.totalDevices, color: "border-purple-500", text: "text-purple-400" },
    { label: "ONLINE DEVICES", value: stats.onlineDevices, color: "border-cyan-500", text: "text-cyan-400" },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-sm">UC</div>
            <div><div className="font-semibold text-sm">Universal Connect</div><div className="text-[10px] text-gray-500">ADMIN PANEL</div></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { key: "users", icon: "👥", label: "Users" },
            { key: "devices", icon: "🖥️", label: "Devices", href: "/dashboard" },
            { key: "downloads", icon: "📥", label: "Downloads" },
            { key: "audit", icon: "📋", label: "Audit Log" },
            { key: "settings", icon: "⚙️", label: "Settings" },
          ].map(item => (
            item.href ? (
              <Link key={item.key} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition text-sm">
                <span>{item.icon}</span>{item.label}
              </Link>
            ) : (
              <button key={item.key} onClick={() => setTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${tab === item.key ? "bg-cyan-600/20 text-cyan-400" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`}>
                <span>{item.icon}</span>{item.label}
              </button>
            )
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <Link href="/login" className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-white text-sm">🚪 Logout</Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <header className="px-6 py-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 p-6">
          {statCards.map(s => (
            <div key={s.label} className={`bg-gray-900 border-l-4 ${s.color} rounded-xl p-4 text-center`}>
              <div className="text-xs text-gray-400 font-medium mb-1">{s.label}</div>
              <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {tab === "users" && (
          <div className="px-6">
            <h2 className="text-lg font-semibold mb-3">👥 User Management</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-800/50 text-gray-400 text-left">
                  <th className="px-4 py-3">ID</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Chat ID</th>
                  <th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th><th className="px-4 py-3">Last Login</th><th className="px-4 py-3">Actions</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="px-4 py-3">{u.id}</td>
                      <td className="px-4 py-3 font-medium">{u.display_name || u.telegram_username || "N/A"}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.telegram_chat_id}</td>
                      <td className="px-4 py-3">
                        <select value={u.subscription} onChange={e => updateUser(u.id, { subscription: e.target.value })}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs">
                          <option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.status === "active" ? "bg-green-900/50 text-green-400" :
                          u.status === "pending" ? "bg-yellow-900/50 text-yellow-400" :
                          "bg-red-900/50 text-red-400"
                        }`}>{u.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {u.status === "pending" && (
                            <button onClick={() => updateUser(u.id, { status: "active" })}
                              className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">Activate</button>
                          )}
                          {u.status === "active" && (
                            <button onClick={() => updateUser(u.id, { status: "suspended" })}
                              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-xs">Suspend</button>
                          )}
                          {u.status === "suspended" && (
                            <button onClick={() => updateUser(u.id, { status: "active" })}
                              className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">Reactivate</button>
                          )}
                          <button onClick={() => deleteUser(u.id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div className="text-center py-8 text-gray-500">No users yet</div>}
            </div>
          </div>
        )}

        {tab === "downloads" && (
          <div className="px-6">
            <h2 className="text-lg font-semibold mb-3">📥 Downloads &amp; Deploy</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-4">
              <h3 className="font-medium mb-2">Organization Details</h3>
              <div className="flex justify-between items-center">
                <div><span className="text-gray-400 text-sm">Organization:</span> <span className="font-semibold">UC Universal Connect</span></div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="font-medium mb-3">⚡ Quick Deploy Command</h3>
              <p className="text-gray-400 text-sm mb-3">Run this on the target Windows PC (CMD or PowerShell):</p>
              <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-cyan-400 break-all select-all">
                curl -o C:\UC\agent.cs &quot;https://raw.githubusercontent.com/atlasdevhouse/uc-universal-connect/main/agent/UCAgent.cs&quot; &amp;&amp; C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:C:\UC\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll C:\UC\agent.cs &amp;&amp; C:\UC\UCService.exe
              </div>
              <button onClick={() => navigator.clipboard.writeText('curl -o C:\\UC\\agent.cs "https://raw.githubusercontent.com/atlasdevhouse/uc-universal-connect/main/agent/UCAgent.cs" && C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:winexe /out:C:\\UC\\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll C:\\UC\\agent.cs && C:\\UC\\UCService.exe')}
                className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition">📋 Copy Command</button>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="px-6"><h2 className="text-lg font-semibold mb-3">📋 Audit Log</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">Coming soon</div>
          </div>
        )}

        {tab === "settings" && (
          <div className="px-6"><h2 className="text-lg font-semibold mb-3">⚙️ Settings</h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">Coming soon</div>
          </div>
        )}
      </main>
    </div>
  );
}
