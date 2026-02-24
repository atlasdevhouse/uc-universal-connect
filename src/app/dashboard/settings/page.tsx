"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export default function UserSettingsPage() {
  const { userId, role, subscription } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "email_service">("account");
  const [smtpSettings, setSmtpSettings] = useState<SmtpConfig>({
    host: "", port: 587, secure: false, user: "", pass: ""
  });
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<string | null>(null);
  const isFreeUser = subscription === "free";

  useEffect(() => {
    if (userId) {
      fetch(`/api/user/settings?userId=${userId}&settingKey=smtp_config`)
        .then(r => r.json())
        .then(d => { if (d.value) setSmtpSettings(d.value); })
        .catch(() => console.error("Error fetching user SMTP settings"));
    }
  }, [userId]);

  const handleSmtpSave = async () => {
    if (!userId) return;
    await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId, settingKey: "smtp_config", settingValue: smtpSettings
      }),
    });
    setSmtpSaved(true);
    setTimeout(() => setSmtpSaved(false), 3000);
  };

  const handleSmtpTest = async () => {
    if (!userId) return;
    setSmtpTestResult("Sending test email...");
    // This would ideally be a separate API endpoint for just testing user SMTP
    // For now, we'll simulate or expand an existing email API to support a test.
    // Skipping actual test send for now to avoid complexity, focus on UI/save.
    setSmtpTestResult("✅ SMTP test UI complete. Actual test API not yet implemented.");
  };

  const tabs = [
    { id: "account" as const, label: "Account" },
    { id: "notifications" as const, label: "Notifications" },
    { id: "email_service" as const, label: "Email Service" },
  ];

  return (
    <AppShell role={role}>
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account and preferences</p>
      </header>

      <div className="p-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-6 py-3 text-sm font-medium transition relative ${
                  activeTab === t.id ? "text-cyan-400" : "text-gray-400 hover:text-white"
                }`}>
                {t.label}
                {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "account" && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-lg font-medium">Account Settings</p>
                <p className="text-sm mt-1">Manage profile, password and subscription</p>
                <p className="text-xs mt-4 text-gray-600">Coming soon</p>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🔔</div>
                <p className="text-lg font-medium">Notification Preferences</p>
                <p className="text-sm mt-1">Telegram alerts for device status</p>
                <p className="text-xs mt-4 text-gray-600">Coming soon</p>
              </div>
            )}

            {activeTab === "email_service" && (
              <div className="space-y-6 max-w-lg">
                <h3 className="font-semibold text-lg mb-4">Email Service Configuration</h3>
                {isFreeUser ? (
                  <p className="text-gray-400 text-sm">
                    As a free user, you need to provide your own SMTP settings to send emails with attached agents.
                    <br />
                    Premium users (Basic or Pro) can use our managed email service.
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm">
                    As a premium user, you use our managed email service. No configuration needed here.
                  </p>
                )}

                {isFreeUser && ( // Only show form for free users
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">SMTP Host</label>
                      <input type="text" value={smtpSettings.host} onChange={e => setSmtpSettings(s => ({ ...s, host: e.target.value }))}
                        placeholder="smtp.yourprovider.com"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1.5">Port</label>
                        <input type="number" value={smtpSettings.port} onChange={e => setSmtpSettings(s => ({ ...s, port: parseInt(e.target.value, 10) }))}
                          placeholder="587"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                      </div>
                      <button onClick={() => setSmtpSettings(s => ({ ...s, secure: !s.secure }))}
                        className={`mt-6 px-4 py-2 rounded-lg text-sm font-medium transition ${smtpSettings.secure ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 hover:bg-gray-600"}`}>
                        {smtpSettings.secure ? "🔒 Secure (SSL/TLS)" : "🔓 Insecure"}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Username</label>
                      <input type="text" value={smtpSettings.user} onChange={e => setSmtpSettings(s => ({ ...s, user: e.target.value }))}
                        placeholder="your_email@example.com"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                      <input type="password" value={smtpSettings.pass} onChange={e => setSmtpSettings(s => ({ ...s, pass: e.target.value }))}
                        placeholder="SMTP Password"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                      <button onClick={handleSmtpSave} disabled={!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass}
                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-medium transition disabled:opacity-50">
                        {smtpSaved ? "✅ Saved!" : "Save Settings"}
                      </button>
                      <button onClick={handleSmtpTest} disabled={!smtpSettings.host || !smtpSettings.user || !smtpSettings.pass}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition disabled:opacity-50">
                        Test SMTP
                      </button>
                    </div>
                    {smtpTestResult && (
                      <p className={`text-sm ${smtpTestResult.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{smtpTestResult}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
