"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

interface BriefItemProps {
  interestTag: string;
  oneLiner: string;
  expandedSummary: string;
  sender: string;
  onReadFull: () => void;
}

export function BriefItem({
  interestTag,
  oneLiner,
  expandedSummary,
  sender,
  onReadFull,
}: BriefItemProps) {
  const [expanded, setExpanded] = useState(false);
  const senderName = sender.replace(/<.*>/, "").trim();

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors"
    >
      {/* Header line */}
      <p className="text-xs text-stone-400 mb-1">
        {senderName} · <span className="text-stone-300">{interestTag}</span>
      </p>

      {/* One-liner */}
      <p className="text-sm text-stone-700 leading-relaxed">{oneLiner}</p>

      {/* Expanded */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-stone-500 leading-relaxed mt-2">
            {expandedSummary}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReadFull();
            }}
            className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-700 transition-colors mt-2"
          >
            <FileText className="h-3 w-3" />
            Read full
          </button>
        </div>
      </div>
    </div>
  );
}
