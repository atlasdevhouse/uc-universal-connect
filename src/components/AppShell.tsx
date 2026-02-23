"use client";
import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface SidebarProps {
  children: ReactNode;
  role?: "admin" | "user";
}

const adminNav = [
  { key: "users", icon: "👥", label: "Users", href: "/admin" },
  { key: "devices", icon: "🖥️", label: "Devices", href: "/dashboard" },
  { key: "downloads", icon: "📥", label: "Downloads", href: "/admin/downloads" },
  { key: "audit", icon: "📋", label: "Audit Log", href: "/admin/audit" },
  { key: "settings", icon: "⚙️", label: "Settings", href: "/admin/settings" },
];

const userNav = [
  { key: "devices", icon: "🖥️", label: "Devices", href: "/dashboard" },
  { key: "downloads", icon: "📥", label: "Downloads", href: "/dashboard/downloads" },
  { key: "settings", icon: "⚙️", label: "Settings", href: "/dashboard/settings" },
];

export default function AppShell({ children, role = "user" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === "admin" ? adminNav : userNav;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    document.cookie = "uc_chat_id=; path=/; max-age=0";
    document.cookie = "uc_role=; path=/; max-age=0";
    document.cookie = "uc_user_id=; path=/; max-age=0";
    router.push("/login");
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-sm">UC</div>
            <div>
              <div className="font-semibold text-sm">Universal Connect</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                {role === "admin" ? "Admin Panel" : "Dashboard"}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => {
            const active = pathname === item.href || (item.href !== "/admin" && item.href !== "/dashboard" && pathname.startsWith(item.href));
            const isExactAdmin = item.href === "/admin" && pathname === "/admin";
            const isExactDash = item.href === "/dashboard" && pathname === "/dashboard";
            const isActive = active || isExactAdmin || isExactDash;
            return (
              <Link key={item.key} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive ? "bg-cyan-600/20 text-cyan-400" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-white text-sm rounded-lg hover:bg-gray-800/50 transition">
            🚪 Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
