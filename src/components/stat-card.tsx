import { Card } from "@/components/ui/card";

interface StatCardProps {
  value: number;
  label: string;
  icon: string;
  color: "orange" | "blue" | "green" | "slate";
}

const colorMap = {
  orange: "text-orange-500",
  blue: "text-blue-600",
  green: "text-green-600",
  slate: "text-foreground",
};

export function StatCard({ value, label, icon, color }: StatCardProps) {
  return (
    <Card className="p-6 rounded-2xl border-0 shadow-sm bg-white">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${colorMap[color]}`}>{value}</span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}
