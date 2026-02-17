"use client";

import { useEffect, useState, useCallback } from "react";
import { TriageCard } from "@/components/triage-card";
import { ProgressBar } from "@/components/progress-bar";
import { useRouter } from "next/navigation";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

export default function TriagePage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/newsletters")
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(data);
        setLoading(false);
      });
  }, []);

  const handleDecision = useCallback(
    async (decision: "kept" | "skipped") => {
      const newsletter = newsletters[currentIndex];
      await fetch("/api/newsletters/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterId: newsletter.id, decision }),
      });
      setCurrentIndex((i) => i + 1);
    },
    [newsletters, currentIndex]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentIndex >= newsletters.length) return;
      if (e.key === "ArrowRight") handleDecision("kept");
      if (e.key === "ArrowLeft") handleDecision("skipped");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDecision, currentIndex, newsletters.length]);

  const handleGenerate = async () => {
    const res = await fetch("/api/editions", { method: "POST" });
    const data = await res.json();
    if (data.editionId) {
      router.push(`/read/${data.editionId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading newsletters...</p>
      </div>
    );
  }

  const isDone = currentIndex >= newsletters.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Triage</h1>

      {!isDone ? (
        <>
          <ProgressBar current={currentIndex} total={newsletters.length} />
          <TriageCard
            newsletter={newsletters[currentIndex]}
            onDecision={handleDecision}
          />
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleDecision("skipped")}
              className="px-6 py-3 bg-red-100 text-red-700 rounded-full font-medium hover:bg-red-200 transition"
            >
              Skip
            </button>
            <button
              onClick={() => handleDecision("kept")}
              className="px-6 py-3 bg-green-100 text-green-700 rounded-full font-medium hover:bg-green-200 transition"
            >
              Keep
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Use arrow keys: ← skip · → keep
          </p>
        </>
      ) : (
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">
            All caught up! Ready to generate your edition.
          </p>
          <button
            onClick={handleGenerate}
            className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
          >
            Generate My Edition
          </button>
        </div>
      )}
    </div>
  );
}
