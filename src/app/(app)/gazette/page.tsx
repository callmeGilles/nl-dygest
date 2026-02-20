"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { HeadlineCard } from "@/components/headline-card";
import { HookCard } from "@/components/hook-card";
import { BriefItem } from "@/components/brief-item";
import { GazetteFooter } from "@/components/gazette-footer";
import { ArticleOverlay } from "@/components/article-overlay";

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
  section: string | null;
  position: number | null;
  expandedSummary: string | null;
}

interface Edition {
  id: number;
  generatedAt: string;
}

interface GazetteData {
  headline: Article[];
  worth_your_time: Article[];
  in_brief: Article[];
}

export default function GazettePage() {
  const [gazette, setGazette] = useState<GazetteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalNewsletters, setTotalNewsletters] = useState(0);
  const initialized = useRef(false);

  const markOnboardingComplete = useCallback(() => {
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true }),
    });
  }, []);

  const loadEdition = useCallback(async (editionId: number) => {
    const res = await fetch(`/api/editions/${editionId}`);
    const data = await res.json();
    setGazette({
      headline: data.articles.headline || [],
      worth_your_time: data.articles.worth_your_time || [],
      in_brief: data.articles.in_brief || [],
    });
    const total =
      (data.articles.headline?.length || 0) +
      (data.articles.worth_your_time?.length || 0) +
      (data.articles.in_brief?.length || 0);
    setTotalNewsletters(total);
    setLoading(false);
    setGenerating(false);
    markOnboardingComplete();
  }, [markOnboardingComplete]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Fetch past editions for header
    fetch("/api/editions")
      .then((r) => r.json())
      .then((data) => setEditions(Array.isArray(data) ? data : []));

    // Generate or load today's gazette
    setGenerating(true);
    fetch("/api/gazette", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          setGenerating(false);
          return;
        }
        loadEdition(data.editionId);
      })
      .catch(() => {
        setError("Failed to load gazette");
        setLoading(false);
        setGenerating(false);
      });
  }, [loadEdition]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const headlineArticle = gazette?.headline[0];
  let headlineKeyPoints: string[] = [];
  if (headlineArticle) {
    try { headlineKeyPoints = JSON.parse(headlineArticle.keyPoints); } catch { headlineKeyPoints = []; }
  }

  return (
    <div className="min-h-screen bg-background">
      <GazetteHeader pastEditions={editions} />

      <div className="max-w-xl mx-auto px-4 pb-12">
        {/* Date banner */}
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-stone-900">{today}</h1>
          {gazette && (
            <p className="text-sm text-stone-400 mt-1">
              {totalNewsletters} article{totalNewsletters !== 1 ? "s" : ""} from
              your newsletters
            </p>
          )}
        </div>

        {/* Loading / Generating state */}
        {(loading || generating) && (
          <div className="text-center space-y-4 py-12">
            <div className="flex justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-stone-400"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-stone-700">
                Curating your gazette
              </p>
              <p className="text-xs text-stone-400">
                Reading your newsletters and picking the best...
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-stone-500">{error}</p>
            <p className="text-xs text-stone-400 mt-1">
              Check back later when new newsletters arrive.
            </p>
          </div>
        )}

        {/* 3-tier gazette layout */}
        {gazette && !loading && !generating && (
          <div className="space-y-8">
            {/* Section 1: Headline */}
            {headlineArticle && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  Today&apos;s Pick
                </h3>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <HeadlineCard
                  interestTag={headlineArticle.category}
                  title={headlineArticle.headline}
                  summary={headlineArticle.summary}
                  takeaways={headlineKeyPoints}
                  sender={headlineArticle.sender}
                  receivedAt={headlineArticle.receivedAt}
                  onReadFull={() => setSelectedArticle(headlineArticle)}
                />
                </motion.div>
              </div>
            )}

            {/* Section 2: Worth Your Time */}
            {gazette.worth_your_time.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  Worth Your Time
                </h3>
                <div className="space-y-3">
                  {gazette.worth_your_time.map((article, i) => {
                    let takeaways: string[] = [];
                    try { takeaways = JSON.parse(article.keyPoints); } catch { takeaways = []; }
                    return (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                      >
                        <HookCard
                          interestTag={article.category}
                          hook={article.headline}
                          expandedSummary={article.expandedSummary || article.summary}
                          takeaways={takeaways}
                          sender={article.sender}
                          receivedAt={article.receivedAt}
                          onReadFull={() => setSelectedArticle(article)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: In Brief */}
            {gazette.in_brief.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  In Brief
                </h3>
                <div className="bg-card rounded-xl border border-stone-100 divide-y divide-stone-100">
                  {gazette.in_brief.map((article, i) => (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: 0.2 + i * 0.03 }}
                    >
                      <BriefItem
                        interestTag={article.category}
                        oneLiner={article.headline}
                        expandedSummary={article.expandedSummary || article.summary}
                        sender={article.sender}
                        onReadFull={() => setSelectedArticle(article)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <GazetteFooter
              sourcesToday={totalNewsletters}
              libraryTotal={totalNewsletters}
              librarySurfaced={totalNewsletters}
            />
          </div>
        )}
      </div>

      {/* Article overlay for "Read full" */}
      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
