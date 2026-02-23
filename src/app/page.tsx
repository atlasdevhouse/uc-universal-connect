import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-sm">UC</div>
          <span className="text-xl font-semibold">Universal Connect</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-gray-400 hover:text-white transition">Log in</Link>
          <Link href="/login" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition font-medium">Get Started</Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          <div className="inline-block px-3 py-1 bg-cyan-600/20 text-cyan-400 rounded-full text-sm mb-6 border border-cyan-600/30">
            Secure &bull; Silent &bull; Instant
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your desktop,<br /><span className="text-cyan-500">anywhere.</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
            Access your PCs remotely with zero setup, zero footprint. Stealth mode means no one knows you&apos;re connected.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-lg font-medium transition">Start Free</Link>
            <a href="#features" className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg text-lg transition">Learn More</a>
          </div>
        </div>

        <div className="mt-16 w-full max-w-4xl">
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <div className="w-3 h-3 rounded-full bg-red-500" /><div className="w-3 h-3 rounded-full bg-yellow-500" /><div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-gray-500 text-sm">UC Dashboard — 3 PCs connected</span>
            </div>
            <div className="p-8 grid grid-cols-3 gap-4">
              {["NIMBUS — Online", "WORKSTATION — Online", "OFFICE-PC — Away"].map((pc, i) => (
                <div key={i} className={`rounded-lg p-4 border ${i < 2 ? "bg-gray-800/50 border-cyan-600/30" : "bg-gray-800/30 border-gray-700"}`}>
                  <div className={`w-2 h-2 rounded-full mb-2 ${i < 2 ? "bg-green-500" : "bg-yellow-500"}`} />
                  <div className="text-sm font-medium">{pc.split(" — ")[0]}</div>
                  <div className={`text-xs mt-1 ${i < 2 ? "text-green-400" : "text-yellow-400"}`}>{pc.split(" — ")[1]}</div>
                  <div className="text-xs text-gray-500 mt-2">Windows 11 &bull; 1920x1080</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Why UC?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "🔒", title: "Stealth Mode", desc: "Zero footprint on the target PC. No tabs, no popups, no tray icons." },
            { icon: "⚡", title: "Instant Access", desc: "One-click install on any Windows PC. Connect from any browser." },
            { icon: "🖥️", title: "Full Control", desc: "Real-time screen, mouse, and keyboard. Complete remote access." },
            { icon: "📱", title: "Any Device", desc: "Access from phone, tablet, or laptop. Works everywhere." },
            { icon: "🔔", title: "Smart Alerts", desc: "Telegram notifications when devices connect or disconnect." },
            { icon: "🛡️", title: "Secure", desc: "Encrypted connections. Your data stays private." },
          ].map((f, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-cyan-600/30 transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-800 px-6 py-6 text-center text-gray-500 text-sm">
        &copy; 2026 UC - Universal Connect. All rights reserved.
      </footer>
    </div>
  );
}
