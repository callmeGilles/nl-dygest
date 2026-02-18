"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { ReadingPane } from "@/components/reading-pane";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-96 border-r p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalArticles = Object.values(data.articles).flat().length;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left panel — article list */}
      <div className="w-96 border-r border-slate-200 bg-white hidden md:block">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900">
            Edition #{data.edition.id}
          </h1>
          <p className="text-xs text-slate-400">
            {date} &middot; {totalArticles} articles
          </p>
        </div>
        <ArticleList
          articles={data.articles}
          selectedId={selectedArticle?.id || null}
          onSelect={setSelectedArticle}
        />
      </div>

      {/* Mobile list (when no article selected) */}
      <div className="md:hidden flex-1">
        {!selectedArticle && (
          <>
            <div className="p-4 border-b border-slate-200">
              <h1 className="text-lg font-bold text-slate-900">
                Edition #{data.edition.id}
              </h1>
              <p className="text-xs text-slate-400">
                {date} &middot; {totalArticles} articles
              </p>
            </div>
            <ArticleList
              articles={data.articles}
              selectedId={null}
              onSelect={setSelectedArticle}
            />
          </>
        )}
      </div>

      {/* Right panel — reading pane (desktop) */}
      <div className="flex-1 bg-white hidden md:block">
        {selectedArticle ? (
          <ReadingPane
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <p>Select an article to read</p>
          </div>
        )}
      </div>

      {/* Mobile reading pane (sheet) */}
      <Sheet open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <SheetContent side="bottom" className="h-[90vh] md:hidden p-0">
          {selectedArticle && (
            <ReadingPane
              article={selectedArticle}
              onClose={() => setSelectedArticle(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
