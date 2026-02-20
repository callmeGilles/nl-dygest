"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabelPicker } from "@/components/label-picker";
import { InterestPicker } from "@/components/interest-picker";

export default function SettingsPage() {
  const [labelsSaved, setLabelsSaved] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-sm border-b border-border">
        <Link
          href="/gazette"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold text-base text-foreground">Settings</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-8 space-y-10">
        {/* Gmail Labels */}
        <section>
          {labelsSaved && (
            <div className="rounded-lg border border-border bg-secondary p-4 mb-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                <Check className="h-4 w-4" />
                Labels updated
              </div>
              <p className="text-xs text-muted-foreground">
                Your next gazette will use these labels.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-1">
                <Link href="/gazette">Back to gazette</Link>
              </Button>
            </div>
          )}
          <LabelPicker
            key={labelsSaved ? "labels-saved" : "labels"}
            mode="settings"
            onSaved={() => setLabelsSaved(true)}
          />
        </section>

        <div className="border-t border-border" />

        {/* Interests */}
        <section>
          {interestsSaved && (
            <div className="rounded-lg border border-border bg-secondary p-4 mb-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                <Check className="h-4 w-4" />
                Interests updated
              </div>
              <p className="text-xs text-muted-foreground">
                Your next gazette will reflect these changes.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-1">
                <Link href="/gazette">Back to gazette</Link>
              </Button>
            </div>
          )}
          <InterestPicker
            key={interestsSaved ? "interests-saved" : "interests"}
            mode="settings"
            onSaved={() => setInterestsSaved(true)}
          />
        </section>

        <div className="border-t border-border" />

        {/* Sign out */}
        <section>
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </section>
      </div>
    </div>
  );
}
