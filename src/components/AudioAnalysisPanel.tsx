import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  Brain, 
  Mic, 
  TrendingUp, 
  Users, 
  Volume2,
  Waves
} from 'lucide-react';
import type { AudioAnalysisState } from '@/hooks/useAudioAnalysis';
import type { AnalysisResult } from '@/utils/audio/FraudAnalysisPipeline';

interface AudioAnalysisPanelProps {
  state: AudioAnalysisState;
  result: AnalysisResult | null;
}

export function AudioAnalysisPanel({ state, result }: AudioAnalysisPanelProps) {
  const { stats, speakers, conversationState, emotionalTrend, metadata } = state;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Context Tracker Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4 text-primary" />
            Context Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Linguistic Continuity</span>
              <span>{((conversationState?.linguisticContinuity || 0) * 100).toFixed(0)}%</span>
            </div>
            <Progress value={(conversationState?.linguisticContinuity || 0) * 100} className="h-1.5" />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Emotional Trend</span>
            <Badge 
              variant={emotionalTrend === 'escalating' ? 'destructive' : 
                      emotionalTrend === 'de-escalating' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {emotionalTrend === 'escalating' && <TrendingUp className="mr-1 h-3 w-3" />}
              {emotionalTrend}
            </Badge>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Detected Topics</span>
            <div className="flex flex-wrap gap-1">
              {stats.detectedTopics.length > 0 ? (
                stats.detectedTopics.map(topic => (
                  <Badge key={topic} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/50">No topics detected</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Turn Count</span>
            <span>{conversationState?.turnCount || 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* Speaker Diarization Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Speaker Diarization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {speakers.length > 0 ? (
            speakers.map(speaker => (
              <div key={speaker.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: speaker.color }}
                    />
                    <span className="text-xs font-medium">{speaker.label}</span>
                  </div>
                  <Badge 
                    variant={speaker.fraudProbability > 0.6 ? 'destructive' : 
                            speaker.fraudProbability > 0.3 ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {(speaker.fraudProbability * 100).toFixed(0)}% risk
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Time: {speaker.totalSpeakingTime.toFixed(1)}s</span>
                  <span>Turns: {speaker.turnCount}</span>
                </div>
                <Progress 
                  value={speaker.avgConfidence * 100} 
                  className="h-1"
                />
              </div>
            ))
          ) : (
            <div className="flex h-20 items-center justify-center">
              <span className="text-xs text-muted-foreground/50">
                No speakers detected
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Feed Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4 text-primary" />
            Metadata Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Confidence Score</span>
              <span>{((metadata?.confidenceScore || 0) * 100).toFixed(0)}%</span>
            </div>
            <Progress value={(metadata?.confidenceScore || 0) * 100} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Background Noise</span>
              <span>{((metadata?.backgroundNoiseLevel || 0) * 100).toFixed(0)}%</span>
            </div>
            <Progress value={(metadata?.backgroundNoiseLevel || 0) * 100} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Audio Quality</span>
              <span>{((metadata?.qualityIndicators.audioIntegrity || 0) * 100).toFixed(0)}%</span>
            </div>
            <Progress value={(metadata?.qualityIndicators.audioIntegrity || 0) * 100} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Stress Markers</span>
            <Badge variant="outline" className="text-xs">
              {metadata?.stressMarkers.length || 0} detected
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Text Features Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Waves className="h-4 w-4 text-primary" />
            Text Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result?.textFeatures ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Authority</span>
                  <Progress value={result.textFeatures.authorityScore * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Urgency</span>
                  <Progress value={result.textFeatures.urgencyScore * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Threat</span>
                  <Progress value={result.textFeatures.threatDensity * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">PII Request</span>
                  <Progress value={result.textFeatures.piiRequestScore * 100} className="h-1.5" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Text Fraud Score</span>
                  <span className="font-medium">{(result.textFeatures.textFraudScore * 100).toFixed(0)}%</span>
                </div>
                <Progress 
                  value={result.textFeatures.textFraudScore * 100} 
                  className="h-2"
                />
              </div>
            </>
          ) : (
            <div className="flex h-20 items-center justify-center">
              <span className="text-xs text-muted-foreground/50">
                No text analysis yet
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audio Features Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Volume2 className="h-4 w-4 text-primary" />
            Audio Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result?.audioFeatures ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Voice Stress</span>
                  <Progress value={result.audioFeatures.voiceStress * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Speech Rate</span>
                  <Progress value={result.audioFeatures.speechRate * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Pitch Var.</span>
                  <Progress value={result.audioFeatures.pitchVariance * 100} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Energy</span>
                  <Progress value={result.audioFeatures.energyMean * 100} className="h-1.5" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  Jitter: {(result.audioFeatures.jitter * 100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Shimmer: {(result.audioFeatures.shimmer * 100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  HNR: {(result.audioFeatures.harmonicToNoiseRatio * 20).toFixed(1)}dB
                </Badge>
              </div>
            </>
          ) : (
            <div className="flex h-20 items-center justify-center">
              <span className="text-xs text-muted-foreground/50">
                No audio analysis yet
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fraud Indicators Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Fraud Indicators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Overall Fraud Probability</span>
              <span className="font-medium">{((result?.fraudProbability || 0) * 100).toFixed(0)}%</span>
            </div>
            <Progress 
              value={(result?.fraudProbability || 0) * 100} 
              className={`h-2 ${
                (result?.fraudProbability || 0) > 0.7 ? '[&>div]:bg-destructive' : 
                (result?.fraudProbability || 0) > 0.4 ? '[&>div]:bg-yellow-500' : ''
              }`}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Active Indicators</span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {result?.fraudIndicators && result.fraudIndicators.length > 0 ? (
                result.fraudIndicators.slice(0, 8).map((indicator, idx) => (
                  <Badge 
                    key={idx} 
                    variant="destructive" 
                    className="text-xs"
                  >
                    {indicator.replace(/_/g, ' ')}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/50">No indicators</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Alerts Triggered</span>
            <Badge variant={stats.alertsTriggered > 0 ? 'destructive' : 'secondary'}>
              {stats.alertsTriggered}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
