"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { GazetteCard } from "@/components/gazette-card";
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

export default function GazetteByIdPage() {
  const params = useParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const allArticles = Object.values(
          data.articles as Record<string, Article[]>
        ).flat();
        setArticles(allArticles);
        setDate(
          new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        );
        setLoading(false);
      });
  }, [params.id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <GazetteHeader />

      <div className="max-w-xl mx-auto px-4 pb-12">
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-slate-900">{date}</h1>
          {articles.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {articles.length} article{articles.length !== 1 ? "s" : ""} from
              your newsletters
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <GazetteCard
                article={article}
                onReadOriginal={setSelectedArticle}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
