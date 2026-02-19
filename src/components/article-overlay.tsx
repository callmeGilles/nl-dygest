"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, User, Calendar, Clock } from "lucide-react";

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

const categoryColors: Record<string, string> = {
  Tech: "bg-sky-100 text-sky-700",
  Product: "bg-violet-100 text-violet-700",
  Business: "bg-emerald-100 text-emerald-700",
  Design: "bg-rose-100 text-rose-700",
  Other: "bg-stone-100 text-stone-600",
};

interface ArticleOverlayProps {
  article: Article | null;
  onClose: () => void;
}

export function ArticleOverlay({ article, onClose }: ArticleOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (article) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [article]);

  let keyPoints: string[] = [];
  if (article) {
    try { keyPoints = JSON.parse(article.keyPoints); } catch { keyPoints = []; }
  }

  const date = article
    ? new Date(article.receivedAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const colorClass = article
    ? categoryColors[article.category] || categoryColors.Other
    : "";

  return (
    <AnimatePresence>
      {article && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card z-50 shadow-2xl overflow-y-auto"
          >
            <div className="p-6 md:p-8 space-y-6">
              {/* Close button */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-stone-400 hover:text-stone-900"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Category + Headline */}
              <div className="space-y-3">
                <Badge className={`${colorClass} text-xs font-medium`}>
                  {article.category}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-stone-900 leading-tight">
                  {article.headline}
                </h1>
              </div>

              {/* Summary — hero section */}
              <div className="bg-stone-50 rounded-lg p-4 space-y-1">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Summary
                </h2>
                <p className="text-base text-stone-800 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              {/* Metadata bar */}
              <div className="flex items-center gap-4 bg-stone-50/50 rounded-lg px-4 py-3 text-sm text-stone-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {article.sender.replace(/<.*>/, "").trim()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readingTime} min read
                </span>
              </div>

              {/* Key points */}
              {keyPoints.length > 0 && (
                <div className="border-l-2 border-amber-300 pl-4 space-y-2">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    Key Points
                  </h2>
                  <ul className="space-y-2">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-stone-600">
                        <span className="text-stone-300 mt-0.5">&bull;</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-stone-200/60" />

              {/* Full newsletter */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Full Newsletter
                </h2>
                <div
                  className="prose prose-stone prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: article.rawHtml }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
