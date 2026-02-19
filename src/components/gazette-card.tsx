"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  Tech: "bg-sky-50 text-sky-700",
  Product: "bg-violet-50 text-violet-700",
  Business: "bg-emerald-50 text-emerald-700",
  Design: "bg-rose-50 text-rose-700",
  Other: "bg-stone-100 text-stone-500",
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
    <article
      onClick={() => setExpanded(!expanded)}
      className="bg-card rounded-xl p-5 shadow-sm shadow-stone-200/50 cursor-pointer active:shadow-md transition-shadow"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${colorClass} text-[11px] font-medium border-0`}>
          {article.category}
        </Badge>
        <span className="text-xs text-stone-400">{article.readingTime} min</span>
      </div>

      {/* Headline */}
      <h3 className="text-[17px] font-semibold text-stone-900 leading-snug mb-2">
        {article.headline}
      </h3>

      {/* Summary — truncated when collapsed, full when expanded */}
      <p
        className={`text-sm text-stone-500 leading-relaxed ${
          !expanded ? "line-clamp-2" : ""
        }`}
      >
        {article.summary}
      </p>

      {/* Expanded content — CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          {/* Key points */}
          {keyPoints.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Key Points
              </h4>
              <ul className="space-y-1.5">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="text-stone-300 shrink-0">&bull;</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Read original link */}
          <div className="mt-4 pt-3 border-t border-stone-200/60">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReadOriginal(article);
              }}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Read original newsletter
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-stone-400 truncate">
          {article.sender.replace(/<.*>/, "").trim()} · {date}
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-stone-300" />
        </motion.div>
      </div>
    </article>
  );
}
