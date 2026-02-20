"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { HeadlineCard } from "@/components/headline-card";
import { HookCard } from "@/components/hook-card";
import { BriefItem } from "@/components/brief-item";
import { GazetteFooter } from "@/components/gazette-footer";
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

export default function GazetteByIdPage() {
  const params = useParams();
  const [gazette, setGazette] = useState<GazetteData | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [totalNewsletters, setTotalNewsletters] = useState(0);

  useEffect(() => {
    fetch("/api/editions")
      .then((r) => r.json())
      .then((data) => setEditions(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const sections: GazetteData = {
          headline: data.articles.headline || [],
          worth_your_time: data.articles.worth_your_time || [],
          in_brief: data.articles.in_brief || [],
        };
        setGazette(sections);
        setTotalNewsletters(
          sections.headline.length +
          sections.worth_your_time.length +
          sections.in_brief.length
        );
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

  const headlineArticle = gazette?.headline[0];
  let headlineKeyPoints: string[] = [];
  if (headlineArticle) {
    try { headlineKeyPoints = JSON.parse(headlineArticle.keyPoints); } catch { headlineKeyPoints = []; }
  }

  return (
    <div className="min-h-screen bg-background">
      <GazetteHeader pastEditions={editions} />

      <div className="max-w-xl mx-auto px-4 pb-12">
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-foreground">{date}</h1>
          {gazette && (
            <p className="text-sm text-muted-foreground mt-1">
              {totalNewsletters} article{totalNewsletters !== 1 ? "s" : ""} from
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

        {gazette && !loading && (
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
                <div className="bg-card rounded-xl border border-border divide-y divide-border">
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

      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
