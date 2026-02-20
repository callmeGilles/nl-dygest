"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileText } from "lucide-react";

interface HookCardProps {
  interestTag: string;
  hook: string;
  expandedSummary: string;
  takeaways: string[];
  sender: string;
  receivedAt: string;
  onReadFull: () => void;
}

export function HookCard({
  interestTag,
  hook,
  expandedSummary,
  takeaways,
  sender,
  receivedAt,
  onReadFull,
}: HookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      onClick={() => setExpanded(!expanded)}
      className="bg-card rounded-xl p-5 shadow-sm shadow-amber-100/50 cursor-pointer active:shadow-md transition-shadow border border-stone-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge className="bg-stone-100 text-stone-600 text-[11px] font-medium border-0">
          {interestTag}
        </Badge>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-stone-300" />
        </motion.div>
      </div>

      {/* Source */}
      <p className="text-xs text-stone-400 mb-2">
        {sender.replace(/<.*>/, "").trim()} · {date}
      </p>

      {/* Hook */}
      <p className="text-[15px] font-medium text-stone-800 leading-snug">
        {hook}
      </p>

      {/* Expanded content */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-stone-600 leading-relaxed mt-4">
            {expandedSummary}
          </p>

          {takeaways.length > 0 && (
            <div className="mt-3 border-l-2 border-amber-200 pl-3 space-y-1.5">
              {takeaways.map((point, i) => (
                <p key={i} className="text-sm text-stone-500">
                  {point}
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReadFull();
              }}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Read full newsletter
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
