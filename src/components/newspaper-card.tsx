"use client";

import { Badge } from "@/components/ui/badge";

interface Article {
  id: number;
  headline: string;
  summary: string;
  readingTime: number;
  sender: string;
  category: string;
}

const categoryColors: Record<string, string> = {
  Tech: "bg-blue-100 text-blue-700",
  Product: "bg-purple-100 text-purple-700",
  Business: "bg-green-100 text-green-700",
  Design: "bg-pink-100 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
};

interface NewspaperCardProps {
  article: Article;
  variant: "hero" | "standard";
  onClick: () => void;
}

export function NewspaperCard({ article, variant, onClick }: NewspaperCardProps) {
  const colorClass = categoryColors[article.category] || categoryColors.Other;

  if (variant === "hero") {
    return (
      <article
        onClick={onClick}
        className="col-span-full bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
      >
        <Badge className={`${colorClass} text-xs font-medium mb-3`}>
          {article.category}
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-3">
          {article.headline}
        </h2>
        <p className="text-base text-slate-600 leading-relaxed mb-4 max-w-2xl">
          {article.summary}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{article.sender}</span>
          <span>&middot;</span>
          <span>{article.readingTime} min read</span>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
    >
      <Badge className={`${colorClass} text-xs font-medium mb-3`}>
        {article.category}
      </Badge>
      <h3 className="text-lg font-semibold text-slate-900 leading-snug mb-2">
        {article.headline}
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">
        {article.summary}
      </p>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="truncate">{article.sender}</span>
        <span>&middot;</span>
        <span>{article.readingTime} min</span>
      </div>
    </article>
  );
}
