import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface RiskBreakdownProps {
  data: {
    safe: number;
    warning: number;
    blocked: number;
  };
}

const COLORS = {
  safe: 'hsl(142, 71%, 45%)',
  warning: 'hsl(38, 92%, 50%)',
  blocked: 'hsl(0, 84%, 60%)',
};

const RiskBreakdown = ({ data }: RiskBreakdownProps) => {
  const chartData = [
    { name: 'Safe', value: data.safe, color: COLORS.safe },
    { name: 'Warning', value: data.warning, color: COLORS.warning },
    { name: 'Blocked', value: data.blocked, color: COLORS.blocked },
  ].filter(item => item.value > 0);

  const total = data.safe + data.warning + data.blocked;

  return (
    <Card className="bg-card border-border animate-slide-up" style={{ animationDelay: "600ms" }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="w-5 h-5 text-primary" />
          Risk Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No risk data yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RiskBreakdown;
