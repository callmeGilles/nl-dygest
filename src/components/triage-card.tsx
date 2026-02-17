"use client";

import { useState } from "react";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

interface TriageCardProps {
  newsletter: Newsletter;
  onDecision: (decision: "kept" | "skipped") => void;
}

export function TriageCard({ newsletter, onDecision }: TriageCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setDragX(e.touches[0].clientX - startX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragX > 100) {
      onDecision("kept");
    } else if (dragX < -100) {
      onDecision("skipped");
    }
    setDragX(0);
  };

  const date = new Date(newsletter.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="relative w-full max-w-sm mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
        transition: isDragging ? "none" : "transform 0.3s ease",
      }}
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 min-h-[300px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">{newsletter.sender}</span>
          <span className="text-xs text-gray-400">{date}</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{newsletter.subject}</h2>
        <p className="text-sm text-gray-600 flex-grow">{newsletter.snippet}</p>
      </div>

      {/* Swipe indicators */}
      {dragX > 50 && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
          KEEP
        </div>
      )}
      {dragX < -50 && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
          SKIP
        </div>
      )}
    </div>
  );
}
