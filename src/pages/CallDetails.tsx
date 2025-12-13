import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Shield,
  AlertTriangle,
  ShieldOff,
  Clock,
  Phone,
  FileText,
  Brain,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

interface AudioAnalysis {
  overallRiskScore?: number;
  riskLevel?: string;
  summary?: string;
  recommendation?: string;
  fraudIndicators?: string[];
  categories?: {
    name: string;
    score: number;
    indicators: string[];
  }[];
}

interface CallData {
  id: string;
  duration: number;
  risk_level: 'safe' | 'warning' | 'blocked';
  risk_score: number;
  fraud_indicators: string[];
  scenario_type: string | null;
  caller_id: string | null;
  notes: string | null;
  created_at: string;
  transcript: string | null;
  recording_url: string | null;
  transcript_segments: TranscriptSegment[] | null;
  audio_analysis: AudioAnalysis | null;
}

const CallDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [call, setCall] = useState<CallData | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchCallDetails();
    }
  }, [user, id]);

  const fetchCallDetails = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("call_history")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          variant: "destructive",
          title: "Call not found",
          description: "The requested call record could not be found.",
        });
        navigate("/history");
        return;
      }

      // Parse JSON fields
      const callData: CallData = {
        ...data,
        transcript_segments: Array.isArray(data.transcript_segments) 
          ? (data.transcript_segments as unknown as TranscriptSegment[]) 
          : null,
        audio_analysis: data.audio_analysis as unknown as AudioAnalysis | null,
      };

      setCall(callData);

      // Get signed URL for recording if available
      if (data.recording_url) {
        const path = data.recording_url.replace('call-recordings/', '');
        const { data: urlData, error: urlError } = await supabase.storage
          .from("call-recordings")
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (!urlError && urlData) {
          setSignedUrl(urlData.signedUrl);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        variant: "destructive",
        title: "Error fetching call details",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleDownload = () => {
    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = `call-${id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "blocked":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <ShieldOff className="w-3 h-3 mr-1" />
            Blocked
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warning
          </Badge>
        );
      default:
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Shield className="w-3 h-3 mr-1" />
            Safe
          </Badge>
        );
    }
  };

  const getRiskColor = (score: number) => {
    if (score > 60) return "text-primary";
    if (score > 30) return "text-warning";
    return "text-success";
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!call) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Call Details | CallGuard-Sentinel</title>
        <meta name="description" content="Review call recording, transcript, and AI fraud analysis" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6 animate-fade-in">
            <Button variant="outline" size="icon" onClick={() => navigate("/history")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Call Details</h1>
                {getRiskBadge(call.risk_level)}
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(call.created_at), "PPpp")}
              </p>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border animate-slide-up">
              <CardContent className="p-4 text-center">
                <Phone className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Caller ID</p>
                <p className="font-medium truncate">{call.caller_id || "Unknown"}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border animate-slide-up" style={{ animationDelay: '50ms' }}>
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-mono font-medium">{formatTime(call.duration)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border animate-slide-up" style={{ animationDelay: '100ms' }}>
              <CardContent className="p-4 text-center">
                <Shield className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <p className={`font-mono font-medium ${getRiskColor(call.risk_score)}`}>
                  {call.risk_score.toFixed(0)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border animate-slide-up" style={{ animationDelay: '150ms' }}>
              <CardContent className="p-4 text-center">
                <FileText className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Scenario</p>
                <p className="font-medium capitalize truncate">
                  {call.scenario_type?.replace("_", " ") || "Manual"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Audio Player */}
          {signedUrl && (
            <Card className="bg-card border-border mb-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Recording Playback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <audio
                  ref={audioRef}
                  src={signedUrl}
                  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handlePlayPause}
                      className="h-12 w-12"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </Button>

                    <div className="flex-1 space-y-1">
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" onClick={toggleMute}>
                        {isMuted ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        className="w-20 cursor-pointer"
                      />
                    </div>

                    <Button size="icon" variant="outline" onClick={handleDownload}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="analysis" className="animate-slide-up" style={{ animationDelay: '250ms' }}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="indicators" className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Indicators
              </TabsTrigger>
            </TabsList>

            {/* AI Analysis Tab */}
            <TabsContent value="analysis" className="mt-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  {call.audio_analysis ? (
                    <div className="space-y-6">
                      {/* Summary */}
                      {call.audio_analysis.summary && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Summary</h4>
                          <p className="text-sm text-muted-foreground">
                            {call.audio_analysis.summary}
                          </p>
                        </div>
                      )}

                      {/* Recommendation */}
                      {call.audio_analysis.recommendation && (
                        <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                          <h4 className="text-sm font-medium mb-1">Recommendation</h4>
                          <p className="text-sm text-muted-foreground">
                            {call.audio_analysis.recommendation}
                          </p>
                        </div>
                      )}

                      {/* Risk Categories */}
                      {call.audio_analysis.categories && call.audio_analysis.categories.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3">Risk Categories</h4>
                          <div className="space-y-4">
                            {call.audio_analysis.categories.map((cat, idx) => (
                              <div key={idx} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">{cat.name}</span>
                                  <span className={`text-sm font-mono ${getRiskColor(cat.score)}`}>
                                    {cat.score.toFixed(0)}%
                                  </span>
                                </div>
                                <Progress
                                  value={cat.score}
                                  className="h-2"
                                />
                                {cat.indicators && cat.indicators.length > 0 && (
                                  <ul className="pl-4 space-y-1">
                                    {cat.indicators.map((ind, i) => (
                                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                        <ChevronRight className="w-3 h-3" />
                                        {ind}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No AI analysis available for this call</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transcript Tab */}
            <TabsContent value="transcript" className="mt-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  {call.transcript ? (
                    <ScrollArea className="h-[400px]">
                      {call.transcript_segments && call.transcript_segments.length > 0 ? (
                        <div className="space-y-3">
                          {call.transcript_segments.map((segment, idx) => (
                            <div key={idx} className="flex gap-3">
                              <span className="text-xs text-muted-foreground font-mono min-w-[50px]">
                                {formatTime(segment.start)}
                              </span>
                              <p className="text-sm flex-1">{segment.text}</p>
                              {segment.confidence && (
                                <span className="text-xs text-muted-foreground">
                                  {(segment.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {call.transcript}
                        </p>
                      )}
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No transcript available for this call</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Indicators Tab */}
            <TabsContent value="indicators" className="mt-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  {call.fraud_indicators && call.fraud_indicators.length > 0 ? (
                    <div className="space-y-3">
                      {call.fraud_indicators.map((indicator, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg"
                        >
                          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                          <p className="text-sm">{indicator}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No fraud indicators detected</p>
                    </div>
                  )}

                  {call.notes && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{call.notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default CallDetails;
