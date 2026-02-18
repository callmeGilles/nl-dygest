import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nl-dygest",
  description: "Your daily newsletter companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
