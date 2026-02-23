"use client";
import AppShell from "@/components/AppShell";

export default function AuditPage() {
  return (
    <AppShell role="admin">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">📋 Audit Log</h1>
        <p className="text-gray-500 text-sm">Connection history and activity logs</p>
      </header>
      <div className="p-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm mt-1">Activity logging will be available in the next update</p>
        </div>
      </div>
    </AppShell>
  );
}
