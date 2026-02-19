"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileText } from "lucide-react";

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
  Tech: "bg-blue-50 text-blue-600",
  Product: "bg-purple-50 text-purple-600",
  Business: "bg-green-50 text-green-600",
  Design: "bg-pink-50 text-pink-600",
  Other: "bg-slate-50 text-slate-500",
};

interface GazetteCardProps {
  article: Article;
  onReadOriginal: (article: Article) => void;
}

export function GazetteCard({ article, onReadOriginal }: GazetteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = categoryColors[article.category] || categoryColors.Other;

  let keyPoints: string[] = [];
  try {
    keyPoints = JSON.parse(article.keyPoints);
  } catch {
    keyPoints = [];
  }

  const date = new Date(article.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <motion.article
      layout
      onClick={() => setExpanded(!expanded)}
      className="bg-white rounded-xl p-5 shadow-sm cursor-pointer active:shadow-md transition-shadow"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${colorClass} text-[11px] font-medium border-0`}>
          {article.category}
        </Badge>
        <span className="text-xs text-slate-400">{article.readingTime} min</span>
      </div>

      {/* Headline */}
      <h3 className="text-[17px] font-semibold text-slate-900 leading-snug mb-2">
        {article.headline}
      </h3>

      {/* Summary — truncated when collapsed, full when expanded */}
      <p
        className={`text-sm text-slate-500 leading-relaxed ${
          !expanded ? "line-clamp-2" : ""
        }`}
      >
        {article.summary}
      </p>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* Key points */}
            {keyPoints.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Key Points
                </h4>
                <ul className="space-y-1.5">
                  {keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-slate-300 shrink-0">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Read original link */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReadOriginal(article);
                }}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Read original newsletter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400 truncate">
          {article.sender.replace(/<.*>/, "").trim()} · {date}
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
        </motion.div>
      </div>
    </motion.article>
  );
}
