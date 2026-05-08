import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { mlOrchestrator } from '@/lib/ml-orchestrator';
import { MLResponse, RiskLevel } from '@/types/ml';
import {
  Brain,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Search,
  Loader2,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';

export function CallerAnalysisCard() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mlResult, setMlResult] = useState<MLResponse | null>(null);

  const [scanStep, setScanStep] = useState(0);
  const scanSteps = [
    "Querying Global Fraud Blacklists...",
    "Analyzing Carrier Metadata (VoIP/Landline)...",
    "Checking Community Spam Reports (Last 24h)...",
    "Running AI Behavioral Correlation...",
    "Finalizing Reputation Score..."
  ];

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
    setMlResult(null);
    setScanStep(0);

    // Simulate multi-step deep scan for realism
    for (let i = 0; i < scanSteps.length; i++) {
      setScanStep(i);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    }

    try {
      const result = await mlOrchestrator.analyzeCaller(phoneNumber.trim(), {});
      setMlResult(result);
      
      toast({
        title: "Deep Analysis Complete",
        description: `Risk profile: ${result.riskLevel}`,
      });
    } catch (err) {
      console.error("Deep analysis failed:", err);
      toast({
        variant: "destructive",
        title: "Analysis Error",
        description: "Could not complete deep scan. Using cached intelligence.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskIcon = (level: RiskLevel) => {
    switch (level) {
      case 'safe':
        return <ShieldCheck className="h-8 w-8 text-success" />;
      case 'low':
        return <Shield className="h-8 w-8 text-muted-foreground" />;
      case 'warning':
        return <ShieldAlert className="h-8 w-8 text-warning" />;
      case 'danger':
      case 'critical':
        return <ShieldX className="h-8 w-8 text-destructive" />;
      default:
        return <Shield className="h-8 w-8" />;
    }
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'safe':
        return 'text-success';
      case 'low':
        return 'text-muted-foreground';
      case 'warning':
        return 'text-warning';
      case 'danger':
      case 'critical':
        return 'text-destructive';
      default:
        return '';
    }
  };

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'safe':
        return <Badge className="bg-success/20 text-success border-success/30">Safe</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
      case 'danger':
      case 'critical':
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
    <Card className="border-border/50 bg-card/50 backdrop-blur overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 animate-pulse" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Real-Time Threat Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2 relative">
          <Input
            placeholder="Enter phone number to analyze..."
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="font-mono pl-10"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Button onClick={handleAnalyze} disabled={isAnalyzing} className="relative overflow-hidden group">
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="relative z-10">Scan</span>
                <div className="absolute inset-0 bg-primary/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </>
            )}
          </Button>
        </div>

        {/* Realistic Loading State */}
        {isAnalyzing && (
          <div className="space-y-4 py-6 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-primary animate-pulse">{scanSteps[scanStep]}</span>
              <span className="text-muted-foreground">{Math.round(((scanStep + 1) / scanSteps.length) * 100)}%</span>
            </div>
            <Progress value={((scanStep + 1) / scanSteps.length) * 100} className="h-1.5" />
            
            <div className="grid grid-cols-5 gap-1">
              {scanSteps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-colors duration-300 ${i <= scanStep ? 'bg-primary' : 'bg-secondary'}`} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {mlResult && !isAnalyzing && (
          <div className="space-y-4 animate-fade-in">
            {/* Main Score Card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <Badge variant="outline" className="text-[8px] opacity-50">ML</Badge>
                </div>
                {getRiskIcon(mlResult.riskLevel)}
                <p className="mt-2 text-sm text-muted-foreground">Risk Level</p>
                <div className="mt-1">{getRiskBadge(mlResult.riskLevel)}</div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg text-center">
                <div className={`text-3xl font-bold ${getReputationColor(100 - mlResult.riskScore)}`}>
                  {100 - mlResult.riskScore}
                </div>
                <p className="text-sm text-muted-foreground">Safety Score</p>
                <Progress value={100 - mlResult.riskScore} className="mt-2 h-2" />
              </div>
            </div>

            {/* AI Explanation */}
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="flex items-start gap-2">
                <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm italic">{mlResult.explanation}</p>
              </div>
            </div>

            {/* Signals */}
            {mlResult.signals.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Neural Signal Detection
                </h4>
                <div className="flex flex-wrap gap-2">
                  {mlResult.signals.map((signal, idx) => (
                    <Badge key={idx} variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                      {signal.label} ({(signal.probability * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation */}
            <div className="p-3 border border-border rounded-lg bg-card/30">
              <h4 className="text-sm font-medium mb-1 flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                Actionable Recommendation
              </h4>
              <p className="text-sm text-muted-foreground">{mlResult.recommendedAction}</p>
            </div>

            {/* Confidence */}
            <div className="text-[10px] text-muted-foreground text-right flex items-center justify-end gap-1">
              {mlResult.isHeuristicFallback ? (
                <span className="text-warning">Running in heuristic fallback mode</span>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-success" />
                  ML Confidence Index: {(mlResult.confidence * 100).toFixed(0)}%
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!mlResult && !isAnalyzing && (
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
