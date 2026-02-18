"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

interface ReadingPaneProps {
  article: Article;
  onClose: () => void;
}

export function ReadingPane({ article, onClose }: ReadingPaneProps) {
  const [showFull, setShowFull] = useState(false);
  const keyPoints = JSON.parse(article.keyPoints) as string[];
  const date = new Date(article.receivedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{article.category}</Badge>
              <span className="text-xs text-slate-400">{article.readingTime} min read</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {article.headline}
            </h1>
            <p className="text-sm text-slate-500">
              {article.sender} &middot; {date}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
            &times;
          </Button>
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Digest
          </h2>
          <p className="text-base text-slate-700 leading-relaxed">
            {article.summary}
          </p>
        </div>

        {/* Key Points */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Key Points
          </h2>
          <ul className="space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600">
                <span className="text-slate-400 mt-0.5">&bull;</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Full newsletter */}
        <div>
          <Button
            variant="outline"
            onClick={() => setShowFull(!showFull)}
            className="w-full rounded-xl"
          >
            {showFull ? "Hide full newsletter" : "Read full newsletter"}
          </Button>
          {showFull && (
            <div
              className="mt-4 prose prose-slate prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: article.rawHtml }}
            />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
