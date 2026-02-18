"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NewspaperCard } from "@/components/newspaper-card";
import { ArticleOverlay } from "@/components/article-overlay";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
  sender: string;
  rawHtml: string;
  receivedAt: string;
  category: string;
}

interface EditionData {
  edition: { id: number; generatedAt: string };
  articles: Record<string, Article[]>;
}

export default function NewspaperPage() {
  const params = useParams();
  const [data, setData] = useState<EditionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [params.id]);

  if (loading || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Flatten grouped articles into a single list
  const allArticles = Object.values(data.articles).flat();
  const heroArticle = allArticles[0];
  const gridArticles = allArticles.slice(1);

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Edition header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Your Briefflow</h1>
          <p className="text-sm text-slate-400 mt-1">
            {date} &middot; {allArticles.length} articles
          </p>
        </div>

        {/* Newspaper grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Hero article — full width */}
          {heroArticle && (
            <NewspaperCard
              article={heroArticle}
              variant="hero"
              onClick={() => setSelectedArticle(heroArticle)}
            />
          )}

          {/* Remaining articles */}
          {gridArticles.map((article) => (
            <NewspaperCard
              key={article.id}
              article={article}
              variant="standard"
              onClick={() => setSelectedArticle(article)}
            />
          ))}
        </div>
      </div>

      {/* Article overlay */}
      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
