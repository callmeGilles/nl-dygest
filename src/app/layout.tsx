import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "nl-dygest",
  description: "Your daily newsletter companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <Link href="/" className="font-serif font-bold text-lg text-gray-900">
            nl-dygest
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/triage" className="text-gray-600 hover:text-gray-900">
              Triage
            </Link>
            <Link href="/stats" className="text-gray-600 hover:text-gray-900">
              Stats
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
