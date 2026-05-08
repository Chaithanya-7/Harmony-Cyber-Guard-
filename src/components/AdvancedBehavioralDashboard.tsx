import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, ShieldAlert, Zap, Lock, Siren, Users } from 'lucide-react';

interface BehavioralProfile {
  urgency: number;
  authority: number;
  fear: number;
  scarcity: number;
  isolation: number;
}

interface AdvancedBehavioralDashboardProps {
  profile: BehavioralProfile;
  strategy: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const AdvancedBehavioralDashboard: React.FC<AdvancedBehavioralDashboardProps> = ({
  profile,
  strategy,
  threatLevel
}) => {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 border-red-600 bg-red-50';
      case 'high': return 'text-orange-600 border-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 border-yellow-600 bg-yellow-50';
      default: return 'text-green-600 border-green-600 bg-green-50';
    }
  };

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Scammer Behavioral Profiling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Detected Strategy</span>
          <Badge variant="outline" className={`animate-pulse ${getThreatColor(threatLevel)}`}>
            {strategy.toUpperCase()}
          </Badge>
        </div>

        {/* Behavioral Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <MetricItem 
            label="Artificial Urgency" 
            value={profile.urgency} 
            icon={<Zap className="h-3 w-3" />} 
            color="bg-amber-500"
          />
          <MetricItem 
            label="Authority Abuse" 
            value={profile.authority} 
            icon={<Lock className="h-3 w-3" />} 
            color="bg-blue-500"
          />
          <MetricItem 
            label="Fear Induction" 
            value={profile.fear} 
            icon={<Siren className="h-3 w-3" />} 
            color="bg-red-500"
          />
          <MetricItem 
            label="Social Isolation" 
            value={profile.isolation} 
            icon={<Users className="h-3 w-3" />} 
            color="bg-purple-500"
          />
        </div>

        {/* Threat Level Indicator */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1 text-[10px] uppercase font-bold text-muted-foreground">
            <span>Overall Manipulation Score</span>
            <span>{Math.round(Math.max(...Object.values(profile)) * 100)}%</span>
          </div>
          <Progress 
            value={Math.max(...Object.values(profile)) * 100} 
            className="h-1"
          />
        </div>
      </CardContent>
    </Card>
  );
};

const MetricItem = ({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[10px]">
      <span className="flex items-center gap-1 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-500`} 
        style={{ width: `${value * 100}%` }}
      />
    </div>
  </div>
);
