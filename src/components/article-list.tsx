"use client";

import { Card } from "@/components/ui/card";
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
  category: string;
}

interface ArticleListProps {
  articles: Record<string, Article[]>;
  selectedId: number | null;
  onSelect: (article: any) => void;
}

export function ArticleList({ articles, selectedId, onSelect }: ArticleListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="p-4 space-y-6">
        {Object.entries(articles).map(([category, categoryArticles]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white/90 backdrop-blur-sm py-1">
              <Badge variant="secondary" className="text-xs font-medium">
                {category}
              </Badge>
              <span className="text-xs text-slate-400">{categoryArticles.length}</span>
            </div>
            <div className="space-y-2">
              {categoryArticles.map((article) => (
                <Card
                  key={article.id}
                  onClick={() => onSelect(article)}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md border-l-2 ${
                    selectedId === article.id
                      ? "border-l-slate-900 bg-slate-50 shadow-sm"
                      : "border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <h3 className={`text-sm leading-snug mb-1 ${
                    selectedId === article.id ? "font-semibold" : "font-medium"
                  } text-slate-900`}>
                    {article.headline}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{article.readingTime} min</span>
                    <span>&middot;</span>
                    <span className="truncate">{article.sender}</span>
                  </div>
                </Card>
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
