import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Brain,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Search,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';

interface CallerAnalysis {
  reputationScore: number;
  riskLevel: 'trusted' | 'neutral' | 'suspicious' | 'dangerous';
  behaviorPatterns: string[];
  threatIndicators: string[];
  recommendation: string;
  confidence: number;
  summary: string;
  callerId: string;
  historicalData: {
    totalCalls: number;
    averageRiskScore: number;
    blockedCalls: number;
    warningCalls: number;
  };
}

export function CallerAnalysisCard() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallerAnalysis | null>(null);

  const handleAnalyze = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Enter a phone number",
        description: "Please enter a caller ID to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-caller', {
        body: { callerId: phoneNumber.trim() },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast({
            title: "Rate Limited",
            description: "Too many requests. Please wait a moment and try again.",
            variant: "destructive",
          });
        } else {
          throw new Error(data.error);
        }
        return;
      }

      setAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: `Caller reputation: ${data.riskLevel}`,
      });
    } catch (err) {
      console.error('Analysis error:', err);
      toast({
        title: "Analysis Failed",
        description: err instanceof Error ? err.message : "Could not analyze caller",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'trusted':
        return <ShieldCheck className="h-8 w-8 text-success" />;
      case 'neutral':
        return <Shield className="h-8 w-8 text-muted-foreground" />;
      case 'suspicious':
        return <ShieldAlert className="h-8 w-8 text-warning" />;
      case 'dangerous':
        return <ShieldX className="h-8 w-8 text-destructive" />;
      default:
        return <Shield className="h-8 w-8" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'trusted':
        return 'text-success';
      case 'neutral':
        return 'text-muted-foreground';
      case 'suspicious':
        return 'text-warning';
      case 'dangerous':
        return 'text-destructive';
      default:
        return '';
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'trusted':
        return <Badge className="bg-success/20 text-success border-success/30">Trusted</Badge>;
      case 'neutral':
        return <Badge variant="secondary">Neutral</Badge>;
      case 'suspicious':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Suspicious</Badge>;
      case 'dangerous':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Dangerous</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getReputationColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Caller Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter phone number to analyze..."
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <Button onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Loading State */}
        {isAnalyzing && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 animate-pulse mr-3" />
            <span>Analyzing caller behavior patterns...</span>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !isAnalyzing && (
          <div className="space-y-4 animate-fade-in">
            {/* Main Score Card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                {getRiskIcon(analysis.riskLevel)}
                <p className="mt-2 text-sm text-muted-foreground">Risk Level</p>
                <div className="mt-1">{getRiskBadge(analysis.riskLevel)}</div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <div className={`text-3xl font-bold ${getReputationColor(analysis.reputationScore)}`}>
                  {analysis.reputationScore}
                </div>
                <p className="text-sm text-muted-foreground">Reputation Score</p>
                <Progress value={analysis.reputationScore} className="mt-2 h-2" />
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{analysis.summary}</p>
              </div>
            </div>

            {/* Historical Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-lg font-semibold">{analysis.historicalData.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-lg font-semibold">{analysis.historicalData.averageRiskScore.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Avg Risk</p>
              </div>
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-lg font-semibold text-destructive">{analysis.historicalData.blockedCalls}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-lg font-semibold text-warning">{analysis.historicalData.warningCalls}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>

            {/* Behavior Patterns */}
            {analysis.behaviorPatterns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Behavior Patterns
                </h4>
                <ul className="space-y-1">
                  {analysis.behaviorPatterns.map((pattern, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Threat Indicators */}
            {analysis.threatIndicators.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Threat Indicators
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.threatIndicators.map((indicator, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {indicator}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="p-3 border border-border rounded-lg">
              <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Recommendation
              </h4>
              <p className="text-sm text-muted-foreground">{analysis.recommendation}</p>
            </div>

            {/* Confidence */}
            <div className="text-xs text-muted-foreground text-right">
              Analysis confidence: {analysis.confidence}%
            </div>
          </div>
        )}

        {/* Empty State */}
        {!analysis && !isAnalyzing && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Enter a phone number to analyze caller behavior</p>
            <p className="text-xs mt-1">AI will review call history and provide a risk assessment</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
