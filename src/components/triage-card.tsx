"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { Card } from "@/components/ui/card";

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
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const keepOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);

  const date = new Date(newsletter.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const senderInitial = newsletter.sender.charAt(0).toUpperCase();

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto touch-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) {
          onDecision("kept");
        } else if (info.offset.x < -120) {
          onDecision("skipped");
        }
      }}
    >
      <Card className="p-6 min-h-[320px] flex flex-col rounded-2xl shadow-lg border-0 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
            {senderInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {newsletter.sender}
            </p>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 leading-snug">
          {newsletter.subject}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed flex-grow line-clamp-4">
          {newsletter.snippet}
        </p>
      </Card>

      {/* Swipe indicators */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-green-400 bg-green-50/30 flex items-center justify-center pointer-events-none"
        style={{ opacity: keepOpacity }}
      >
        <span className="text-2xl font-bold text-green-600">KEEP</span>
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-red-400 bg-red-50/30 flex items-center justify-center pointer-events-none"
        style={{ opacity: skipOpacity }}
      >
        <span className="text-2xl font-bold text-red-600">SKIP</span>
      </motion.div>
    </motion.div>
  );
}
