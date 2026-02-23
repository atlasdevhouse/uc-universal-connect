"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";

interface User {
  id: number; telegram_chat_id: string; telegram_username: string;
  display_name: string; role: string; subscription: string;
  status: string; install_token: string; created_at: string; last_login: string;
}
interface Stats { totalUsers: number; activeUsers: number; pendingUsers: number; totalDevices: number; onlineDevices: number; }

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, pendingUsers: 0, totalDevices: 0, onlineDevices: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ chatId: "", username: "", displayName: "", subscription: "free", role: "user" });

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
  const addUser = async () => {
    if (!newUser.chatId) return;
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewUser({ chatId: "", username: "", displayName: "", subscription: "free", role: "user" });
      fetchData();
    }
  };

  const statCards = [
    { label: "TOTAL USERS", value: stats.totalUsers, color: "border-blue-500", text: "text-blue-400" },
    { label: "ACTIVE USERS", value: stats.activeUsers, color: "border-green-500", text: "text-green-400" },
    { label: "PENDING", value: stats.pendingUsers, color: "border-yellow-500", text: "text-yellow-400" },
    { label: "TOTAL DEVICES", value: stats.totalDevices, color: "border-purple-500", text: "text-purple-400" },
    { label: "ONLINE", value: stats.onlineDevices, color: "border-cyan-500", text: "text-cyan-400" },
  ];

  return (
    <AppShell role="admin">
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">👥 User Management</h1>
          <p className="text-gray-500 text-sm">Manage subscribers and permissions</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition">
          + Add User
        </button>
      </header>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">+ Add New User</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telegram Chat ID *</label>
                <input type="text" value={newUser.chatId} onChange={e => setNewUser(u => ({ ...u, chatId: e.target.value }))}
                  placeholder="e.g. 2102262384"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telegram Username</label>
                <input type="text" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                  placeholder="@username"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input type="text" value={newUser.displayName} onChange={e => setNewUser(u => ({ ...u, displayName: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subscription</label>
                  <select value={newUser.subscription} onChange={e => setNewUser(u => ({ ...u, subscription: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none">
                    <option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none">
                    <option value="user">User</option><option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button onClick={addUser} disabled={!newUser.chatId}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-3 rounded-lg font-medium transition mt-2">
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 p-6">
        {statCards.map(s => (
          <div key={s.label} className={`bg-gray-900 border-l-4 ${s.color} rounded-xl p-4 text-center`}>
            <div className="text-xs text-gray-400 font-medium mb-1">{s.label}</div>
            <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="px-6">
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
                      "bg-red-900/50 text-red-400"}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.status === "pending" && <button onClick={() => updateUser(u.id, { status: "active" })} className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">Activate</button>}
                      {u.status === "active" && <button onClick={() => updateUser(u.id, { status: "suspended" })} className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-xs">Suspend</button>}
                      {u.status === "suspended" && <button onClick={() => updateUser(u.id, { status: "active" })} className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">Reactivate</button>}
                      <button onClick={() => deleteUser(u.id)} className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="text-center py-8 text-gray-500">No users yet</div>}
        </div>
      </div>
    </AppShell>
  );
}
