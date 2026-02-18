"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/triage", label: "Triage" },
  { href: "/read", label: "Dygest" },
  { href: "/stats", label: "Stats" },
];

export function NavBar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <Link href="/" className="font-bold text-lg text-slate-900 tracking-tight">
        nl-dygest
      </Link>
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <div className="w-px h-5 bg-slate-200 mx-2" />
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500">
          Sign out
        </Button>
      </div>
    </nav>
  );
}
