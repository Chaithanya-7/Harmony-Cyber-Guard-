import { Phone, ShieldOff, AlertTriangle, TrendingUp } from "lucide-react";
import StatCard from "./StatCard";

interface Stats {
  totalCalls: number;
  scamsBlocked: number;
  warnings: number;
  safeCalls: number;
}

interface StatsGridProps {
  stats: Stats;
}

const StatsGrid = ({ stats }: StatsGridProps) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Calls"
        value={stats.totalCalls}
        icon={Phone}
        iconColor="text-foreground"
        delay={100}
      />
      <StatCard
        label="Scams Blocked"
        value={stats.scamsBlocked}
        icon={ShieldOff}
        iconColor="text-primary"
        delay={200}
      />
      <StatCard
        label="Warnings"
        value={stats.warnings}
        icon={AlertTriangle}
        iconColor="text-warning"
        delay={300}
      />
      <StatCard
        label="Safe Calls"
        value={stats.safeCalls}
        icon={TrendingUp}
        iconColor="text-success"
        delay={400}
      />
    </div>
  );
};

export default StatsGrid;
