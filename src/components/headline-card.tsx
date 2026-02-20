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
    <article className="bg-gradient-to-br from-amber-50/80 to-orange-50/40 rounded-2xl p-6 shadow-sm border border-amber-100/60">
      <Badge className="bg-amber-100 text-amber-800 text-xs font-medium border-0 mb-4">
        {interestTag}
      </Badge>

      <h2 className="text-2xl font-bold text-stone-900 leading-tight mb-3">
        {title}
      </h2>

      <p className="text-sm text-stone-400 mb-4">
        {sender.replace(/<.*>/, "").trim()} · {date}
      </p>

      <p className="text-base text-stone-700 leading-relaxed mb-5">
        {summary}
      </p>

      {takeaways.length > 0 && (
        <div className="border-l-2 border-amber-300 pl-4 mb-5 space-y-2">
          {takeaways.map((point, i) => (
            <p key={i} className="text-sm text-stone-600 leading-relaxed">
              {point}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onReadFull}
        className="flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-950 transition-colors"
      >
        <FileText className="h-4 w-4" />
        Read full newsletter
      </button>
    </article>
  );
}
