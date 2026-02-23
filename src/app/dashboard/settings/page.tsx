"use client";
import AppShell from "@/components/AppShell";

export default function UserSettingsPage() {
  return (
    <AppShell role="user">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account</p>
      </header>
      <div className="p-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">⚙️</div>
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm mt-1">Account settings and notification preferences</p>
        </div>
      </div>
    </AppShell>
  );
}
