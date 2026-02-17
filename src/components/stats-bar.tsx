interface StatsBarProps {
  streak: number;
  readThisWeek: number;
  remaining: number;
}

export function StatsBar({ streak, readThisWeek, remaining }: StatsBarProps) {
  return (
    <div className="flex items-center gap-6 text-sm text-gray-500 py-3 border-b border-gray-300 mb-6">
      <span>
        <span className="text-orange-500 font-bold">{streak}-day</span> streak
      </span>
      <span>
        <span className="font-bold text-gray-700">{readThisWeek}</span> read this week
      </span>
      <span>
        <span className="font-bold text-gray-700">{remaining.toLocaleString()}</span> remaining
      </span>
    </div>
  );
}
