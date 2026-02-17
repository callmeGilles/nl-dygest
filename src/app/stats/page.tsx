"use client";

import { useEffect, useState } from "react";

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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reading Stats</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-orange-500">{stats.streak}</p>
          <p className="text-sm text-gray-500">Day streak</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-blue-600">{stats.editions}</p>
          <p className="text-sm text-gray-500">Editions generated</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-green-600">{stats.kept}</p>
          <p className="text-sm text-gray-500">Newsletters read</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-3xl font-bold text-gray-700">{stats.remaining}</p>
          <p className="text-sm text-gray-500">Remaining</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
      {stats.recentSessions.length > 0 ? (
        <div className="space-y-2">
          {stats.recentSessions.map((session) => (
            <div
              key={session.date}
              className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border"
            >
              <span className="text-sm text-gray-600">{session.date}</span>
              <span className="text-sm text-gray-500">
                {session.newslettersRead} read &middot; {session.timeSpent} min
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No reading sessions yet. Start triaging!</p>
      )}
    </div>
  );
}
