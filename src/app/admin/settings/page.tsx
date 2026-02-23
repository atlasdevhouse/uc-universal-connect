"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";

interface TgSettings {
  botToken: string;
  adminChatId: string;
  notifications: {
    deviceOnline: boolean;
    deviceOffline: boolean;
    newDeviceRegistered: boolean;
    agentUninstalled: boolean;
    agentReinstalled: boolean;
    newUserRegistered: boolean;
    enabled: boolean;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "telegram" | "subscription">("telegram");
  const [settings, setSettings] = useState<TgSettings>({
    botToken: "",
    adminChatId: "",
    notifications: {
      deviceOnline: true,
      deviceOffline: true,
      newDeviceRegistered: true,
      agentUninstalled: true,
      agentReinstalled: true,
      newUserRegistered: true,
      enabled: true,
    },
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.telegram) setSettings(d.telegram);
    }).catch(() => {});
  }, []);

  const save = async () => {
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram: settings }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/admin/settings/test", { method: "POST" });
    const data = await res.json();
    setTestResult(data.ok ? "✅ Test notification sent!" : `❌ ${data.error}`);
    setTesting(false);
  };

  const toggle = (key: keyof TgSettings["notifications"]) => {
    setSettings(s => ({
      ...s,
      notifications: { ...s.notifications, [key]: !s.notifications[key] },
    }));
  };

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "telegram" as const, label: "Telegram" },
    { id: "subscription" as const, label: "Subscription" },
  ];

  const checkboxes: { key: keyof TgSettings["notifications"]; label: string }[] = [
    { key: "deviceOnline", label: "Device Online" },
    { key: "deviceOffline", label: "Device Offline" },
    { key: "newDeviceRegistered", label: "New Device Registered" },
    { key: "agentUninstalled", label: "Agent Uninstalled" },
    { key: "agentReinstalled", label: "Agent Reinstalled" },
    { key: "newUserRegistered", label: "New User Registered" },
    { key: "enabled", label: "Enable Telegram Notifications" },
  ];

  return (
    <AppShell role="admin">
      <header className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
        <p className="text-gray-500 text-sm">Configure your UC instance</p>
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
            {activeTab === "general" && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-lg font-medium">General Settings</p>
                <p className="text-sm mt-1">Organization name, branding, and agent defaults</p>
                <p className="text-xs mt-4 text-gray-600">Coming soon</p>
              </div>
            )}

            {activeTab === "telegram" && (
              <div className="space-y-6 max-w-lg">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Bot Token</label>
                  <input type="password" value={settings.botToken}
                    onChange={e => setSettings(s => ({ ...s, botToken: e.target.value }))}
                    placeholder="123456:ABC-DEF..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Chat ID</label>
                  <input type="text" value={settings.adminChatId}
                    onChange={e => setSettings(s => ({ ...s, adminChatId: e.target.value }))}
                    placeholder="-100123456789"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-mono text-sm" />
                </div>

                <div className="space-y-3 pt-2">
                  {checkboxes.map(cb => (
                    <label key={cb.key}
                      className={`flex items-center gap-3 cursor-pointer group ${
                        cb.key === "enabled" ? "pt-3 border-t border-gray-800" : ""
                      }`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                        settings.notifications[cb.key]
                          ? "bg-cyan-600 border-cyan-600"
                          : "border-gray-600 group-hover:border-gray-500"
                      }`}
                        onClick={() => toggle(cb.key)}>
                        {settings.notifications[cb.key] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${cb.key === "enabled" ? "font-semibold" : "text-gray-300"}`}>
                        {cb.label}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button onClick={save}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-medium transition">
                    {saved ? "✅ Saved!" : "Save Settings"}
                  </button>
                  <button onClick={sendTest} disabled={testing}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition disabled:opacity-50">
                    {testing ? "..." : "Send Test"}
                  </button>
                </div>
                {testResult && (
                  <p className={`text-sm ${testResult.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{testResult}</p>
                )}
              </div>
            )}

            {activeTab === "subscription" && (
              <div className="space-y-4 max-w-lg">
                <h3 className="font-semibold text-lg mb-4">Subscription Tiers</h3>
                {[
                  { tier: "Free", features: ["Dashboard access", "1 device", "No Telegram alerts"], color: "gray" },
                  { tier: "Basic", features: ["Dashboard access", "3 devices", "Telegram alerts", "Email support"], color: "blue" },
                  { tier: "Pro", features: ["Dashboard access", "Unlimited devices", "Telegram alerts", "Priority support", "Custom agent branding"], color: "cyan" },
                ].map(plan => (
                  <div key={plan.tier} className={`bg-gray-800 rounded-lg p-4 border ${
                    plan.color === "cyan" ? "border-cyan-600/50" : plan.color === "blue" ? "border-blue-600/30" : "border-gray-700"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{plan.tier}</h4>
                      {plan.color === "cyan" && <span className="text-xs bg-cyan-600/20 text-cyan-400 px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <ul className="space-y-1">
                      {plan.features.map(f => (
                        <li key={f} className="text-sm text-gray-400 flex items-center gap-2">
                          <span className="text-cyan-400">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-gray-500 text-xs">Pricing and Stripe integration coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
