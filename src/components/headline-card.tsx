"use client";

import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface HeadlineCardProps {
  interestTag: string;
  title: string;
  summary: string;
  takeaways: string[];
  sender: string;
  receivedAt: string;
  onReadFull: () => void;
}

export function HeadlineCard({
  interestTag,
  title,
  summary,
  takeaways,
  sender,
  receivedAt,
  onReadFull,
}: HeadlineCardProps) {
  const date = new Date(receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="bg-card rounded-2xl p-6 shadow-sm border border-border">
      <Badge className="bg-stone-100 text-stone-600 text-xs font-medium border-0 mb-4">
        {interestTag}
      </Badge>

      <h2 className="text-2xl font-bold text-foreground leading-tight mb-3">
        {title}
      </h2>

      <p className="text-sm text-muted-foreground mb-4">
        {sender.replace(/<.*>/, "").trim()} · {date}
      </p>

      <p className="text-base text-stone-700 leading-relaxed mb-5">
        {summary}
      </p>

      {takeaways.length > 0 && (
        <div className="border-l-2 border-stone-200 pl-4 mb-5 space-y-2">
          {takeaways.map((point, i) => (
            <p key={i} className="text-sm text-stone-500 leading-relaxed">
              {point}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onReadFull}
        className="flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-foreground transition-colors"
      >
        <FileText className="h-4 w-4" />
        Read original
      </button>
    </article>
  );
}
