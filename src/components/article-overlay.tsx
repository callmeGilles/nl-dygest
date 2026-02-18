"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
  Tech: "bg-blue-100 text-blue-700",
  Product: "bg-purple-100 text-purple-700",
  Business: "bg-green-100 text-green-700",
  Design: "bg-pink-100 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl overflow-y-auto"
          >
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-slate-400 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-3">
                <Badge className={`${colorClass} text-xs font-medium`}>
                  {article.category}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                  {article.headline}
                </h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>{article.sender}</span>
                  <span>&middot;</span>
                  <span>{date}</span>
                  <span>&middot;</span>
                  <span>{article.readingTime} min read</span>
                </div>
              </div>
              <div className="border-t border-slate-100" />
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Summary
                </h2>
                <p className="text-base text-slate-700 leading-relaxed">
                  {article.summary}
                </p>
              </div>
              {keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Key Points
                  </h2>
                  <ul className="space-y-2">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-600">
                        <span className="text-slate-300 mt-0.5">&bull;</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-slate-100" />
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Full Newsletter
                </h2>
                <div
                  className="prose prose-slate prose-sm max-w-none"
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
