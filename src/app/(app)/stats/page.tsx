"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface Stats {
  total: number;
  triaged: number;
  kept: number;
  remaining: number;
  streak: number;
  editions: number;
  recentSessions: Array<{
    date: string;
    newslettersRead: number;
    timeSpent: number;
  }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your reading stats</h1>
        <p className="text-sm text-slate-500 mt-1">Track your newsletter habits</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard value={stats.streak} label="Day streak" icon="🔥" color="orange" />
        <StatCard value={stats.editions} label="Editions generated" icon="📰" color="blue" />
        <StatCard value={stats.kept} label="Newsletters read" icon="✓" color="green" />
        <StatCard value={stats.remaining} label="Remaining" icon="📬" color="slate" />
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
        {stats.recentSessions.length > 0 ? (
          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <Card
                key={session.date}
                className="flex items-center justify-between p-4 rounded-xl border-0 shadow-sm"
              >
                <span className="text-sm font-medium text-slate-700">{session.date}</span>
                <span className="text-sm text-slate-400">
                  {session.newslettersRead} read &middot; {session.timeSpent} min
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 rounded-xl border-0 shadow-sm text-center">
            <p className="text-sm text-slate-400">No reading sessions yet. Start triaging!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
