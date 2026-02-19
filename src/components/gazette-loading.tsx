"use client";

import { Progress } from "@/components/ui/progress";

interface GazetteLoadingProps {
  current: number;
  total: number;
}

export function GazetteLoading({ current, total }: GazetteLoadingProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="text-center space-y-4 py-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">
          Preparing your gazette
        </p>
        <p className="text-xs text-slate-400">
          {current} of {total} articles ready
        </p>
      </div>
      <div className="max-w-48 mx-auto">
        <Progress value={percentage} className="h-1" />
      </div>
    </div>
  );
}
