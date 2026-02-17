"use client";

import { useState } from "react";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
}

export function ArticleCard({ article }: { article: Article }) {
  const [expanded, setExpanded] = useState(false);
  const keyPoints: string[] = JSON.parse(article.keyPoints);

  return (
    <article
      className="border-b border-gray-200 py-4 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">
          {article.headline}
        </h3>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
          {article.readingTime} min
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-1">{article.summary}</p>

      {expanded && (
        <div className="mt-3 pl-4 border-l-2 border-blue-200">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Key Points</p>
          <ul className="space-y-1">
            {keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-gray-700">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
