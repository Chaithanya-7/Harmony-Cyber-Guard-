import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioAnalysisPanel } from './AudioAnalysisPanel';
import { AdvancedBehavioralDashboard } from './AdvancedBehavioralDashboard';
import { useLiveAnalysis } from '@/hooks/useLiveAnalysis';
import { useCallRecording } from '@/hooks/useCallRecording';
import { useTranscription } from '@/hooks/useTranscription';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from '@/hooks/use-toast';
import {
  Mic,
  MicOff,
  Activity,
  AlertTriangle,
  Shield,
  Clock,
  Waves,
  Radio,
  Save,
  FileText,
  Brain,
  Download,
  Pause,
  Play,
  Square,
  Bell,
  BellOff
} from 'lucide-react';
import type { AnalysisResult } from '@/utils/audio/FraudAnalysisPipeline';

interface LiveAnalysisViewProps {
  onCallEnd?: (result: {
    duration: number;
    riskLevel: 'safe' | 'warning' | 'blocked';
    riskScore: number;
    fraudIndicators: string[];
    transcript?: string;
    recordingUrl?: string;
    audioAnalysis?: any;
  }) => void;
}

export function LiveAnalysisView({ onCallEnd }: LiveAnalysisViewProps) {
  const navigate = useNavigate();
  const [callDuration, setCallDuration] = useState(0);
  const [peakRisk, setPeakRisk] = useState(0);
  const [activeTab, setActiveTab] = useState('realtime');
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  
  // Audio Level and Status Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotificationRiskRef = useRef(0);
  const pushNotifications = usePushNotifications();

  // Initialize Transcription service (Local Whisper)
  const transcription = useTranscription();
  
  // Initialize Analysis Pipeline (ML Engine)
  const liveAnalysis = useLiveAnalysis({
    onRawAudioChunk: (chunk) => {
      transcription.processAudioChunk(chunk);
    },
    onResult: (result) => {
      // Trigger critical notification for high risk
      if (result.fraudProbability >= 0.5 && result.fraudProbability > lastNotificationRiskRef.current + 0.1) {
        lastNotificationRiskRef.current = result.fraudProbability;
        pushNotifications.sendNotification({
          title: "Fraud Alert: High Risk Detected",
          body: `Confidence: ${(result.fraudProbability * 100).toFixed(0)}%. ${result.fraudIndicators[0] || 'Unusual behavior detected.'}`,
          tag: 'fraud-alert',
        });
      }
    }
  });

  // Track Peak Risk from both Heuristics and ML
  useEffect(() => {
    const currentHeuristicRisk = liveAnalysis.currentResult?.fraudProbability || 0;
    const currentMLRisk = (liveAnalysis.mlResult?.riskScore || 0) / 100;
    const maxRisk = Math.max(currentHeuristicRisk, currentMLRisk);
    
    if (maxRisk > peakRisk) {
      setPeakRisk(maxRisk);
    }
  }, [liveAnalysis.currentResult, liveAnalysis.mlResult, peakRisk]);

  // Initialize Recording service
  const recording = useCallRecording();

  // Sync transcription to analysis engine
  useEffect(() => {
    if (transcription.transcript) {
      liveAnalysis.updateTranscript(transcription.transcript);
    }
  }, [transcription.transcript, liveAnalysis]);

  // Duration Timer
  useEffect(() => {
    if (liveAnalysis.isRecording) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [liveAnalysis.isRecording]);

  const handleStart = async () => {
    try {
      // Start all pipelines
      await liveAnalysis.start();
      await transcription.startStreaming();
      await recording.startRecording();
      
      setCallDuration(0);
      setPeakRisk(0);
      lastNotificationRiskRef.current = 0;
      setAiAnalysis(null);
      
      toast({
        title: "Analysis Started",
        description: "Real-time fraud detection is active.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Initialization Failed",
        description: err instanceof Error ? err.message : "Could not access audio devices.",
      });
    }
  };

  const handleStop = async () => {
    // Stop all pipelines
    liveAnalysis.stop();
    transcription.stopStreaming();
    const recordingResult = await recording.stopRecording();
    
    let finalAiAnalysis = null;
    
    // Final analysis of the full transcript
    if (transcription.transcript) {
      setIsAnalyzingTranscript(true);
      try {
        finalAiAnalysis = await transcription.analyzeTranscript(transcription.transcript);
        setAiAnalysis(finalAiAnalysis);
        setActiveTab('ai-analysis');
      } catch (err) {
        console.error("Final analysis failed:", err);
      } finally {
        setIsAnalyzingTranscript(false);
      }
    }

    if (onCallEnd) {
      const finalTranscript = transcription.transcript || liveAnalysis.transcript;
      onCallEnd({
        duration: callDuration,
        riskLevel: peakRisk >= 0.8 ? 'blocked' : peakRisk >= 0.5 ? 'warning' : 'safe',
        riskScore: Math.round(peakRisk * 100),
        fraudIndicators: [...(liveAnalysis.currentResult?.fraudIndicators || []), ...(finalAiAnalysis?.fraudIndicators || [])],
        transcript: finalTranscript,
        recordingUrl: recordingResult?.url,
        audioAnalysis: {
          summary: finalAiAnalysis?.summary || "Live forensic analysis completed.",
          recommendation: peakRisk >= 0.8 ? "CRITICAL: Scammer patterns detected. Block immediately." : "Activity monitored.",
          categories: [
            { name: 'Urgency', score: (finalAiAnalysis?.urgencyScore || 0) * 100, indicators: [] },
            { name: 'Authority', score: (liveAnalysis.behavioralProfile?.authority || 0) * 100, indicators: [] }
          ]
        }
      });
    }
  };

  const renderHighlightedText = (text: string) => {
    const threatPhrases = liveAnalysis.currentResult?.textFeatures?.threatPhrases || [];
    if (threatPhrases.length === 0) return text;

    // Create a regex to match any of the threat phrases
    const pattern = new RegExp(`(${threatPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, i) => 
      pattern.test(part) ? (
        <span key={i} className="bg-destructive/20 text-destructive font-bold px-0.5 rounded border-b border-destructive/40">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 0.8) return 'text-destructive';
    if (risk >= 0.5) return 'text-warning';
    return 'text-success';
  };

  const getRiskBg = (risk: number) => {
    if (risk >= 0.8) return 'bg-destructive/10 border-destructive/20';
    if (risk >= 0.5) return 'bg-warning/10 border-warning/20';
    return 'bg-success/10 border-success/20';
  };

  const allIndicators = [
    ...(liveAnalysis.currentResult?.fraudIndicators || []),
    ...(aiAnalysis?.fraudIndicators || [])
  ];

  return (
    <div className="space-y-6">
      {/* NEW: CRITICAL THREAT ALERT OVERLAY */}
      {peakRisk > 0.7 && liveAnalysis.isRecording && (
        <div className="fixed inset-x-0 top-20 z-50 px-4 animate-in slide-in-from-top-full duration-500">
          <div className="max-w-xl mx-auto bg-destructive text-destructive-foreground p-4 rounded-xl shadow-2xl border-4 border-white/20 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-lg uppercase tracking-tighter">Immediate Threat Detected</h3>
              <p className="text-sm font-bold opacity-90">
                Pattern: {liveAnalysis.currentResult?.fraudIndicators[0] || "HIGH RISK FRAUD PATTERN FOUND"}
              </p>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="font-bold h-10 px-4"
              onClick={() => {
                liveAnalysis.stop();
                toast({ title: "Protective Stop", description: "Call analysis stopped for safety." });
              }}
            >
              Hang Up
            </Button>
          </div>
        </div>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden relative">
        {/* Visual Pulse Background */}
        {liveAnalysis.isRecording && (
          <div className="absolute top-0 right-0 p-4">
            <div className="flex gap-1 items-end h-8">
              {[1, 2, 3, 4, 5].map(i => (
                <div 
                  key={i} 
                  className="w-1 bg-primary/40 rounded-full animate-wave"
                  style={{ 
                    height: `${20 + Math.random() * 60}%`,
                    animationDelay: `${i * 0.1}s` 
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${liveAnalysis.isRecording ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
              Live Fraud Analysis Engine
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notification Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  if (pushNotifications.permission !== 'granted') {
                    const granted = await pushNotifications.requestPermission();
                    if (granted) {
                      toast({
                        title: "Notifications Enabled",
                        description: "You'll receive alerts for high-risk fraud detection.",
                      });
                    }
                  } else {
                    toast({
                      title: "Notifications Active",
                      description: "Push notifications are already enabled.",
                    });
                  }
                }}
                className="relative"
                title={pushNotifications.permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
              >
                {pushNotifications.permission === 'granted' ? (
                  <Bell className="h-4 w-4 text-success" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {recording.isRecording && (
                <Badge variant="outline" className="gap-1">
                  <Save className="h-3 w-3" />
                  Recording
                </Badge>
              )}
              {liveAnalysis.isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-current animate-pulse" />
                  LIVE
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              size="lg"
              variant={liveAnalysis.isRecording ? "destructive" : "default"}
              onClick={liveAnalysis.isRecording ? handleStop : handleStart}
              disabled={isAnalyzingTranscript}
              className="gap-2"
            >
              {isAnalyzingTranscript ? (
                <>
                  <Brain className="h-5 w-5 animate-pulse" />
                  Processing...
                </>
              ) : liveAnalysis.isRecording ? (
                <>
                  <Square className="h-5 w-5" />
                  Stop & Analyze
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" />
                  Start Live Analysis
                </>
              )}
            </Button>

            {liveAnalysis.isRecording && (
              <>
                <Button
                  variant="outline"
                  onClick={recording.isPaused ? recording.resumeRecording : recording.pauseRecording}
                  className="gap-2"
                >
                  {recording.isPaused ? (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatDuration(callDuration)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    {liveAnalysis.chunksProcessed} chunks
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>{liveAnalysis.averageLatency.toFixed(0)}ms</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Audio Level Visualization */}
          {liveAnalysis.isRecording && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Waves className="h-4 w-4" />
                  Audio Level
                </span>
                <span>{(liveAnalysis.audioLevel * 100).toFixed(0)}%</span>
              </div>
              <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                  style={{ width: `${liveAnalysis.audioLevel * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Transcription Status */}
          {liveAnalysis.isRecording && transcription.transcript && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Live Transcript</span>
                {transcription.isTranscribing && (
                  <Badge variant="secondary" className="text-xs">Processing...</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {transcription.transcript}
              </p>
            </div>
          )}

          {/* AI Model Loading State */}
          {transcription.isModelLoading && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Brain className="h-4 w-4 animate-pulse" />
                  <span className="font-medium">Initializing AI Transcription...</span>
                </div>
                <span className="text-muted-foreground">{Math.round(transcription.modelProgress)}%</span>
              </div>
              <Progress value={transcription.modelProgress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground text-center">
                This only happens once. The 40MB Whisper model is being cached for offline use.
              </p>
            </div>
          )}

          {/* Error Messages */}
          {(liveAnalysis.microphoneError || recording.error || transcription.error) && (
            <div className="flex items-center gap-2 text-destructive text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">
                {liveAnalysis.microphoneError || recording.error || transcription.error}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Tabs */}
      {(liveAnalysis.isRecording || liveAnalysis.currentResult || aiAnalysis) && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="realtime" className="gap-2">
              <Activity className="h-4 w-4" />
              Real-time
            </TabsTrigger>
            <TabsTrigger value="transcript" className="gap-2">
              <FileText className="h-4 w-4" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="ai-analysis" className="gap-2" disabled={!aiAnalysis}>
              <Brain className="h-4 w-4" />
              AI Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="mt-4 space-y-4">
            {/* NEW: Advanced Behavioral Profiling */}
            {liveAnalysis.behavioralProfile && (
              <AdvancedBehavioralDashboard 
                profile={{
                  urgency: liveAnalysis.behavioralProfile.urgency,
                  authority: liveAnalysis.behavioralProfile.authority,
                  fear: liveAnalysis.behavioralProfile.fear,
                  scarcity: liveAnalysis.behavioralProfile.scarcity,
                  isolation: liveAnalysis.behavioralProfile.isolation,
                }}
                strategy={liveAnalysis.behavioralProfile.strategy}
                threatLevel={peakRisk >= 0.8 ? 'critical' : peakRisk >= 0.5 ? 'high' : 'low'}
              />
            )}

            {/* Deep ML Analysis Alert */}
            {liveAnalysis.mlResult && liveAnalysis.mlResult.riskScore > 40 && (
              <Card className={`border-2 animate-in zoom-in-95 duration-300 ${
                liveAnalysis.mlResult.riskLevel === 'critical' ? 'border-destructive bg-destructive/10' :
                liveAnalysis.mlResult.riskLevel === 'danger' ? 'border-orange-500 bg-orange-500/10' :
                'border-warning bg-warning/10'
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      liveAnalysis.mlResult.riskLevel === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'
                    }`}>
                      <Brain className="h-6 w-6" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">Deep ML Analysis</h3>
                        <Badge variant={liveAnalysis.mlResult.riskLevel === 'critical' ? 'destructive' : 'outline'}>
                          {liveAnalysis.mlResult.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{liveAnalysis.mlResult.explanation}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {liveAnalysis.mlResult.signals.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {s.label} ({(s.probability * 100).toFixed(0)}%)
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 border-t pt-2 italic">
                        Recommended: {liveAnalysis.mlResult.recommendedAction}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Deepfake / Synthetic Voice Alert */}
            {liveAnalysis.currentResult?.audioFeatures?.syntheticProbability &&
              liveAnalysis.currentResult.audioFeatures.syntheticProbability > 0.6 && (
                <Card className="border-purple-500/50 bg-purple-500/10 animate-pulse">
                  <CardContent className="pt-6 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-full">
                      <Waves className="h-8 w-8 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-purple-500 flex items-center gap-2">
                        ⚠️ ARTIFICIAL VOICE DETECTED
                      </h3>
                      <p className="text-sm text-foreground/80">
                        High probability ({(liveAnalysis.currentResult.audioFeatures.syntheticProbability * 100).toFixed(0)}%) that the speaker is using a voice cloners or AI synthesizer.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Real-time Risk Display */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className={`border ${getRiskBg(liveAnalysis.currentResult?.fraudProbability || 0)}`}>
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <Shield className={`h-12 w-12 mx-auto ${getRiskColor(liveAnalysis.currentResult?.fraudProbability || 0)}`} />
                    <div className={`text-3xl font-bold ${getRiskColor(liveAnalysis.currentResult?.fraudProbability || 0)}`}>
                      {((liveAnalysis.currentResult?.fraudProbability || 0) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Current Risk</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <AlertTriangle className={`h-12 w-12 mx-auto ${getRiskColor(peakRisk)}`} />
                    <div className={`text-3xl font-bold ${getRiskColor(peakRisk)}`}>
                      {(peakRisk * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Peak Risk</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <Radio className={`h-12 w-12 mx-auto ${liveAnalysis.currentResult?.audioFeatures?.syntheticProbability && liveAnalysis.currentResult.audioFeatures.syntheticProbability > 0.5 ? 'text-purple-500 animate-pulse' : 'text-primary'}`} />
                    <div className="text-3xl font-bold">
                      {((liveAnalysis.currentResult?.audioFeatures?.syntheticProbability || 0) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">AI Voice Prob.</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Indicators */}
            {allIndicators.length > 0 && (
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Detected Indicators ({allIndicators.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {allIndicators.map((indicator, idx) => (
                      <Badge key={idx} variant="destructive" className="text-xs">
                        {indicator.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Analysis Panel */}
            <AudioAnalysisPanel
              state={liveAnalysis as any}
              result={liveAnalysis.currentResult}
            />
          </TabsContent>

          <TabsContent value="transcript" className="mt-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Call Transcript
                  </div>
                  {transcription.transcript && (
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  {transcription.transcript ? (
                    <div className="space-y-4">
                      {transcription.segments.map((segment, idx) => (
                        <div key={idx} className="flex gap-4 group">
                          <span className="text-[10px] text-muted-foreground w-12 pt-1 font-mono">
                            {formatDuration(Math.floor(segment.start))}
                          </span>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm leading-relaxed">
                              {renderHighlightedText(segment.text)}
                            </p>
                            {segment.confidence < 0.7 && (
                              <Badge variant="secondary" className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                Low confidence
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No transcript available yet.</p>
                      <p className="text-xs">Start recording to see live transcription.</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-analysis" className="mt-4">
             {aiAnalysis && (
               <div className="grid gap-4 md:grid-cols-2">
                 <Card className="border-primary/20 bg-primary/5">
                   <CardHeader>
                     <CardTitle className="text-sm">Sentiment Analysis</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Urgency Level</span>
                          <Badge>{(aiAnalysis.urgencyScore * 100).toFixed(0)}%</Badge>
                        </div>
                        <Progress value={aiAnalysis.urgencyScore * 100} className="h-2" />
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Aggression Level</span>
                          <Badge variant="outline">{(aiAnalysis.aggressionScore * 100).toFixed(0)}%</Badge>
                        </div>
                        <Progress value={aiAnalysis.aggressionScore * 100} className="h-2" />
                     </div>
                   </CardContent>
                 </Card>
                 
                 <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-sm">Detected Intent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.intents.map((intent: string, i: number) => (
                          <Badge key={i} variant="secondary">{intent}</Badge>
                        ))}
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground italic">
                        "{aiAnalysis.summary}"
                      </p>
                    </CardContent>
                 </Card>
               </div>
             )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
