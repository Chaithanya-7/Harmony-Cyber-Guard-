import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioAnalysisPanel } from './AudioAnalysisPanel';
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
  }) => void;
}

export function LiveAnalysisView({ onCallEnd }: LiveAnalysisViewProps) {
  const navigate = useNavigate();
  const [callDuration, setCallDuration] = useState(0);
  const [peakRisk, setPeakRisk] = useState(0);
  const [allIndicators, setAllIndicators] = useState<string[]>([]);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState('realtime');
  const [lastCallId, setLastCallId] = useState<string | null>(null);

  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionQueueRef = useRef<string[]>([]);
  const lastTranscriptionTimeRef = useRef(0);
  const lastNotificationRiskRef = useRef(0);

  // Push notifications hook
  const pushNotifications = usePushNotifications();

  // Initialize hooks
  const liveAnalysis = useLiveAnalysis({
    fraudThreshold: 0.7,
    enableDiarization: true,
    onAlert: (result) => {
      toast({
        title: "⚠️ Fraud Alert!",
        description: `High risk detected: ${(result.fraudProbability * 100).toFixed(0)}%`,
        variant: "destructive",
      });

      // Send push notification for high-risk alerts
      const riskLevel = result.fraudProbability >= 0.8 ? 'blocked' : 'warning';
      if (result.fraudProbability >= 0.5 && result.fraudProbability > lastNotificationRiskRef.current + 0.1) {
        lastNotificationRiskRef.current = result.fraudProbability;
        pushNotifications.sendFraudAlert(
          riskLevel,
          result.fraudProbability * 100,
          result.fraudIndicators,
          () => {
            // Navigate to call details when notification is clicked
            if (lastCallId) {
              navigate(`/call/${lastCallId}`);
            }
          }
        );
      }
    },
    onChunkProcessed: (result) => {
      if (result.fraudProbability > peakRisk) {
        setPeakRisk(result.fraudProbability);
      }
      if (result.fraudIndicators.length > 0) {
        setAllIndicators(prev => [...new Set([...prev, ...result.fraudIndicators])]);
      }
    },
  });

  const recording = useCallRecording();
  const transcription = useTranscription({
    onTranscript: (result) => {
      // Update the live analysis with transcript for text feature extraction
      if (result.text) {
        liveAnalysis.updateTranscript(result.text);
      }
    },
  });

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (liveAnalysis.isRecording) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveAnalysis.isRecording]);

  // No interval needed for streaming transcription
  // Only use periodic sync if we want to save audio chunks, but streaming text is handled by startStreaming()
  useEffect(() => {
    // Optional: We can still monitor recording health here
  }, [liveAnalysis.isRecording]);


  const handleStart = async () => {
    if (!liveAnalysis.isPermissionGranted) {
      const granted = await liveAnalysis.requestPermission();
      if (!granted) {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access to use live analysis.",
          variant: "destructive",
        });
        return;
      }
    }

    // Request notification permission if not already granted
    if (pushNotifications.permission === 'default') {
      await pushNotifications.requestPermission();
    }

    // Reset state
    setCallDuration(0);
    setPeakRisk(0);
    setAllIndicators([]);
    setAiAnalysis(null);
    setLastCallId(null);
    audioChunksRef.current = [];
    lastTranscriptionTimeRef.current = Date.now();
    lastNotificationRiskRef.current = 0;
    transcription.reset();

    // Start recording and analysis
    await Promise.all([
      liveAnalysis.start(),
      recording.startRecording(),
    ]);

    // Start Real-Time Transcription
    transcription.startStreaming();

    toast({
      title: "Live Analysis Started",
      description: "Recording and monitoring audio for fraud signals...",
    });
  };

  const handleStop = async () => {
    // Stop recording and analysis
    liveAnalysis.stop();
    transcription.stopStreaming();

    const recordingResult = await recording.stopRecording();

    // Get final transcript
    let finalTranscript = transcription.getFullTranscript();

    // If we have a recording, do final transcription
    if (recordingResult && recordingResult.blob.size > 0) {
      toast({
        title: "Processing...",
        description: "Transcribing and analyzing call...",
      });

      setIsAnalyzingTranscript(true);

      try {
        // Final transcription
        const base64 = await recording.blobToBase64(recordingResult.blob);
        const transcriptResult = await transcription.transcribeAudio(base64);

        if (transcriptResult?.text) {
          finalTranscript = transcriptResult.text;
        }

        // AI analysis of transcript
        if (finalTranscript) {
          const analysis = await transcription.analyzeTranscript(finalTranscript, {
            voiceStress: liveAnalysis.currentResult?.audioFeatures?.voiceStress || 0,
            speechRate: liveAnalysis.currentResult?.audioFeatures?.speechRate || 0,
            emotionalTrend: liveAnalysis.emotionalTrend,
            speakerCount: liveAnalysis.speakers.length,
          });

          if (analysis) {
            setAiAnalysis(analysis);

            // Update peak risk if AI analysis found higher risk
            const aiRisk = (analysis.overallRiskScore as number) / 100;
            if (aiRisk > peakRisk) {
              setPeakRisk(aiRisk);
            }
          }
        }

        // Upload recording
        const uploadResult = await recording.uploadRecording(recordingResult.blob);

        if (uploadResult) {
          toast({
            title: "Recording Saved",
            description: "Call recording uploaded successfully.",
          });
        }

        // Calculate final risk level
        const riskLevel = peakRisk >= 0.8 ? 'blocked' : peakRisk >= 0.5 ? 'warning' : 'safe';

        if (onCallEnd) {
          onCallEnd({
            duration: callDuration,
            riskLevel,
            riskScore: Math.round(peakRisk * 100),
            fraudIndicators: allIndicators,
            transcript: finalTranscript,
            recordingUrl: uploadResult?.path,
          });
        }

        toast({
          title: "Analysis Complete",
          description: `Call ended. Risk level: ${riskLevel}`,
        });
      } catch (err) {
        console.error('Error processing call:', err);
        toast({
          title: "Processing Error",
          description: "Some analysis features failed. Basic results saved.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzingTranscript(false);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskColor = (risk: number) => {
    if (risk >= 0.8) return 'text-destructive';
    if (risk >= 0.5) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getRiskBg = (risk: number) => {
    if (risk >= 0.8) return 'bg-destructive/20 border-destructive/50';
    if (risk >= 0.5) return 'bg-yellow-500/20 border-yellow-500/50';
    return 'bg-green-500/20 border-green-500/50';
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Live Fraud Analysis
            </div>
            <div className="flex items-center gap-2">
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

          {/* Error Messages */}
          {(liveAnalysis.microphoneError || recording.error || transcription.error) && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {liveAnalysis.microphoneError || recording.error || transcription.error}
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
                    <Activity className="h-12 w-12 mx-auto text-primary" />
                    <div className="text-3xl font-bold text-primary">
                      {((liveAnalysis.currentResult?.confidenceScore || 0) * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Confidence</div>
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
              state={{
                isActive: liveAnalysis.isActive,
                currentResult: liveAnalysis.currentResult,
                stats: liveAnalysis.stats,
                conversationState: liveAnalysis.conversationState,
                speakers: liveAnalysis.speakers,
                metadata: liveAnalysis.metadata,
                emotionalTrend: liveAnalysis.emotionalTrend,
              }}
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
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {transcription.transcript}
                      </p>
                      {transcription.segments.length > 0 && (
                        <div className="pt-4 border-t">
                          <h4 className="text-sm font-medium mb-2">Segments</h4>
                          <div className="space-y-2">
                            {transcription.segments.map((segment, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground">
                                <span className="font-mono">[{segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s]</span>
                                <span className="ml-2">{segment.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 opacity-50" />
                      <p>No transcript available yet.</p>
                      <p className="text-xs">Start recording to begin transcription.</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-analysis" className="mt-4">
            {aiAnalysis && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Overall Analysis */}
                <Card className={`border ${getRiskBg((aiAnalysis.overallRiskScore as number) / 100)}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI Fraud Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getRiskColor((aiAnalysis.overallRiskScore as number) / 100)}`}>
                        {aiAnalysis.overallRiskScore as number}%
                      </div>
                      <Badge
                        variant={
                          aiAnalysis.riskLevel === 'blocked' ? 'destructive' :
                            aiAnalysis.riskLevel === 'warning' ? 'secondary' : 'outline'
                        }
                        className="mt-2"
                      >
                        {aiAnalysis.riskLevel as string}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {aiAnalysis.summary as string}
                    </p>
                    <div className="p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Recommendation:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {aiAnalysis.recommendation as string}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card className="border-border/50 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Risk Categories</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {aiAnalysis.categories && Object.entries(aiAnalysis.categories as Record<string, { score: number; evidence: string[] }>).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className={getRiskColor(value.score / 100)}>{value.score}%</span>
                        </div>
                        <Progress value={value.score} className="h-2" />
                        {value.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {value.evidence.slice(0, 2).map((e, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {e.substring(0, 30)}...
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Fraud Indicators */}
                {aiAnalysis.fraudIndicators && (aiAnalysis.fraudIndicators as string[]).length > 0 && (
                  <Card className="border-border/50 bg-card/50 md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        AI-Detected Fraud Indicators
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {(aiAnalysis.fraudIndicators as string[]).map((indicator, idx) => (
                          <Badge key={idx} variant="destructive">
                            {indicator}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
