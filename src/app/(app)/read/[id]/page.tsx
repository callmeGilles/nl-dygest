"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { StatsBar } from "@/components/stats-bar";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
}

interface EditionData {
  edition: { id: number; generatedAt: string };
  articles: Record<string, Article[]>;
}

const CATEGORY_ICONS: Record<string, string> = {
  Tech: "~",
  Product: "#",
  Business: "$",
  Design: "*",
  Other: "+",
};

export default function NewspaperPage() {
  const params = useParams();
  const [data, setData] = useState<EditionData | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading your edition...</p>
      </div>
    );
  }

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalArticles = Object.values(data.articles).flat().length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Newspaper header */}
      <header className="text-center border-b-4 border-double border-gray-900 pb-4 mb-2">
        <h1 className="text-4xl font-serif font-bold tracking-tight text-gray-900">
          nl-dygest
        </h1>
        <p className="text-sm text-gray-500 mt-1">{date}</p>
        <p className="text-xs text-gray-400">
          Edition #{data.edition.id} &middot; {totalArticles} articles
        </p>
      </header>

      <StatsBar streak={1} readThisWeek={totalArticles} remaining={0} />

      {/* Articles by category */}
      {Object.entries(data.articles).map(([category, articles]) => (
        <section key={category} className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
            {CATEGORY_ICONS[category] || "+"} {category}
          </h2>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </section>
      ))}
    </div>
  );
}
