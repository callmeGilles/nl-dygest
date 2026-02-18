"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TriageCard } from "@/components/triage-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [keptCount, setKeptCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/newsletters")
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(Array.isArray(data) ? data : []);
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
      if (decision === "kept") setKeptCount((c) => c + 1);
      else setSkippedCount((c) => c + 1);
      setCurrentIndex((i) => i + 1);
    },
    [newsletters, currentIndex]
  );

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
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/editions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        setGenerating(false);
        return;
      }
      if (data.editionId) {
        // Mark onboarding as complete
        await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingCompleted: true }),
        });
        router.push(`/read/${data.editionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 gap-4">
        <Skeleton className="w-full max-w-sm h-80 rounded-2xl" />
        <div className="flex gap-4">
          <Skeleton className="w-24 h-12 rounded-xl" />
          <Skeleton className="w-24 h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  if (newsletters.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <p className="text-lg text-slate-500">No newsletters to triage.</p>
        <p className="text-sm text-slate-400 mt-1">Check back later or connect a different label.</p>
      </div>
    );
  }

  const isDone = currentIndex >= newsletters.length;
  const progress = (currentIndex / newsletters.length) * 100;

  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center p-4">
      {!isDone ? (
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>{currentIndex + 1} of {newsletters.length}</span>
              <span>Kept: {keptCount} &middot; Skipped: {skippedCount}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <TriageCard
            key={newsletters[currentIndex].id}
            newsletter={newsletters[currentIndex]}
            onDecision={handleDecision}
          />

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleDecision("skipped")}
              className="rounded-xl w-28 h-12 text-red-600 border-red-200 hover:bg-red-50"
            >
              Skip
            </Button>
            <Button
              size="lg"
              onClick={() => handleDecision("kept")}
              className="rounded-xl w-28 h-12 bg-green-600 hover:bg-green-700"
            >
              Keep
            </Button>
          </div>

          <p className="text-xs text-slate-400 text-center">&larr; skip &middot; keep &rarr;</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">All done!</h2>
          <p className="text-slate-500">
            Kept {keptCount} &middot; Skipped {skippedCount}
          </p>
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl h-12 px-8 text-base"
          >
            {generating ? "Generating..." : "Generate my briefflow"}
          </Button>
          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
