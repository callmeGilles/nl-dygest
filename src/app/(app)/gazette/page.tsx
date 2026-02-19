"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { GazetteCard } from "@/components/gazette-card";
import { GazetteLoading } from "@/components/gazette-loading";
import { ArticleOverlay } from "@/components/article-overlay";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  sender: string;
  rawHtml: string;
  receivedAt: string;
  category: string;
}

interface Edition {
  id: number;
  generatedAt: string;
}

export default function GazettePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const loadReadyGazette = useCallback(async (editionId: number) => {
    const res = await fetch(`/api/editions/${editionId}`);
    const data = await res.json();
    const allArticles = Object.values(data.articles as Record<string, Article[]>).flat();
    setArticles(allArticles);
    setLoading(false);
  }, []);

  const streamGazette = useCallback(
    (editionId: number, newsletterIds: number[], total: number) => {
      setGenerating(true);
      setProgress({ current: 0, total });
      setLoading(false);

      const eventSource = new EventSource(
        `/api/gazette/${editionId}/stream?newsletterIds=${newsletterIds.join(",")}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "article") {
          setArticles((prev) => [...prev, data.article]);
          setProgress(data.progress);
        }

        if (data.type === "complete") {
          setGenerating(false);
          eventSource.close();
        }

        if (data.type === "error") {
          setProgress(data.progress);
        }
      };

      eventSource.onerror = () => {
        setGenerating(false);
        eventSource.close();
      };
    },
    []
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Fetch past editions for header
    fetch("/api/editions")
      .then((r) => r.json())
      .then((data) => setEditions(Array.isArray(data) ? data : []));

    // Generate or load today's gazette
    fetch("/api/gazette", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        if (data.status === "ready") {
          loadReadyGazette(data.editionId);
        } else if (data.status === "generating") {
          streamGazette(data.editionId, data.newsletterIds, data.total);
        }
      })
      .catch(() => {
        setError("Failed to load gazette");
        setLoading(false);
      });
  }, [loadReadyGazette, streamGazette]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <GazetteHeader pastEditions={editions} />

      <div className="max-w-xl mx-auto px-4 pb-12">
        {/* Date banner */}
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-slate-900">{today}</h1>
          {articles.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {articles.length} article{articles.length !== 1 ? "s" : ""} from
              your newsletters
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Generation progress */}
        {generating && <GazetteLoading {...progress} />}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">{error}</p>
            <p className="text-xs text-slate-400 mt-1">
              Check back later when new newsletters arrive.
            </p>
          </div>
        )}

        {/* Article cards */}
        <div className="space-y-3">
          {articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: generating ? 0 : i * 0.05 }}
            >
              <GazetteCard
                article={article}
                onReadOriginal={setSelectedArticle}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Article overlay for "Read original" */}
      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
