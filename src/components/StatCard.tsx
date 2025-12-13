import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
}

const StatCard = ({ label, value, icon: Icon, iconColor = "text-foreground", delay = 0 }: StatCardProps) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 1000;
      const steps = 20;
      const increment = value / steps;
      let current = 0;

      const interval = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(interval);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return (
    <Card className="bg-card border-border card-hover animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-4xl font-bold font-mono mt-1">{displayValue}</p>
        </div>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </CardContent>
    </Card>
  );
};

export default StatCard;
