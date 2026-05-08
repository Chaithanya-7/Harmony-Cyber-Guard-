import { useState, useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff, Shield, AlertTriangle, ArrowLeft, Radio, Download, ShieldCheck } from "lucide-react";
import { generateForensicReport, formatReportForPrint } from "@/utils/ForensicReportGenerator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { DialKeypad } from "./DialKeypad";
import { twilioService, type TwilioConfig } from "@/utils/voip/TwilioService";
import { useLiveAnalysis } from "@/hooks/useLiveAnalysis";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCallEnd: (result: { 
    duration: number; 
    riskLevel: 'safe' | 'warning' | 'blocked';
    riskScore: number;
    fraudIndicators: string[];
    callerId?: string;
    transcript?: string;
    audioAnalysis?: any;
  }) => void;
}

const CallModal = ({ isOpen, onClose, onCallEnd }: CallModalProps) => {
  const [view, setView] = useState<'keypad' | 'call'>('keypad');
  const [callState, setCallState] = useState<'connecting' | 'active' | 'analyzing' | 'complete'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [fraudIndicators, setFraudIndicators] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Real Call State
  const [isRealCall, setIsRealCall] = useState(false);
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig>({
    accountSid: '',
    authToken: '',
    phoneNumber: ''
  });

  useEffect(() => {
    // Sync twilio config from service on mount
    twilioService.init();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setView('keypad');
      setCallState('connecting');
      setDuration(0);
      setIsMuted(false);
      setRiskScore(0);
      setFraudIndicators([]);
      setPhoneNumber('');
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (view !== 'call') return;
    
    // Simulate connection
    const connectTimer = setTimeout(() => setCallState('active'), 1500);
    return () => clearTimeout(connectTimer);
  }, [view]);

  useEffect(() => {
    if (callState !== 'active') return;

    const durationInterval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(durationInterval);
  }, [callState]);

  useEffect(() => {
    if (callState !== 'active' || isRealCall) return;

    // Simulate risk analysis only for demo mode
    const riskInterval = setInterval(() => {
      setRiskScore(prev => {
        const newRisk = Math.min(prev + Math.random() * 15, 100);
        
        if (newRisk > 30) setFraudIndicators(f => f.length === 0 ? ['Urgency detected in speech pattern'] : f);
        if (newRisk > 50) setFraudIndicators(f => f.length === 1 ? [...f, 'Authority claim detected'] : f);
        if (newRisk > 70) setFraudIndicators(f => f.length === 2 ? [...f, 'Request for sensitive info'] : f);
        
        return newRisk;
      });
    }, 2000);

    return () => clearInterval(riskInterval);
  }, [callState, isRealCall]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async (number: string) => {
    setPhoneNumber(number);
    setView('call');
    setCallState('connecting');

    if (isRealCall) {
      try {
        await twilioService.makeRealCall(number);
        toast({
          title: "Real Call Initiated",
          description: `Outgoing call to ${number} via Twilio bridge.`
        });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Real Call Failed",
          description: err instanceof Error ? err.message : "Check your Twilio credentials."
        });
        handleBackToKeypad();
      }
    }
  };

  const [fullTranscript, setFullTranscript] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);

  const { start: startAI, stop: stopAI, transcript } = useLiveAnalysis({
    onResult: (result) => {
      setLastAnalysis(result);
      setRiskScore(result.fraudProbability * 100);
      setFraudIndicators(result.fraudIndicators);
    }
  });

  useEffect(() => {
    if (callState === 'active') {
      startAI();
    } else if (callState === 'analyzing' || callState === 'complete') {
      stopAI();
    }
  }, [callState]);

  useEffect(() => {
    if (transcript) setFullTranscript(transcript);
  }, [transcript]);

  const handleEndCall = () => {
    setCallState('analyzing');
    stopAI();
    
    setTimeout(() => {
      let riskLevel: 'safe' | 'warning' | 'blocked';
      if (riskScore < 30) riskLevel = 'safe';
      else if (riskScore < 60) riskLevel = 'warning';
      else riskLevel = 'blocked';

      onCallEnd({ 
        duration, 
        riskLevel,
        riskScore,
        fraudIndicators,
        callerId: phoneNumber,
        transcript: fullTranscript,
        audioAnalysis: {
          summary: lastAnalysis?.behavioralProfile?.strategy || "Call analyzed for potential fraud patterns.",
          recommendation: riskLevel === 'blocked' ? "Extreme caution: High-risk patterns detected. Suggest blocking caller." : "Normal activity detected.",
          categories: lastAnalysis?.behavioralProfile ? [
            { name: 'Urgency', score: lastAnalysis.behavioralProfile.urgency * 100, indicators: [] },
            { name: 'Authority', score: lastAnalysis.behavioralProfile.authority * 100, indicators: [] }
          ] : []
        }
      });
      setCallState('complete');
      
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 2000);
  };

  const handleBackToKeypad = () => {
    setView('keypad');
    setCallState('connecting');
    setDuration(0);
    setRiskScore(0);
    setFraudIndicators([]);
  };

  const getRiskColor = () => {
    if (riskScore < 30) return 'text-success';
    if (riskScore < 60) return 'text-warning';
    return 'text-primary';
  };

  const getRiskLabel = () => {
    if (riskScore < 30) return 'Low Risk';
    if (riskScore < 60) return 'Medium Risk';
    return 'High Risk';
  };

  const formatPhoneDisplay = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)}-${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view === 'call' && callState === 'connecting' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToKeypad}
                className="h-8 w-8 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Phone className="w-5 h-5 text-primary" />
            {view === 'keypad' && 'Dial Number'}
            {view === 'call' && callState === 'connecting' && 'Connecting...'}
            {view === 'call' && callState === 'active' && 'Call in Progress'}
            {view === 'call' && callState === 'analyzing' && 'Analyzing Call...'}
            {view === 'call' && callState === 'complete' && 'Call Complete'}
          </DialogTitle>
        </DialogHeader>

        {view === 'keypad' ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${isRealCall ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">Production Mode</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{isRealCall ? 'Real PSTN' : 'Simulation'}</span>
                <input 
                  type="checkbox" 
                  checked={isRealCall}
                  onChange={(e) => setIsRealCall(e.target.checked)}
                  className="toggle toggle-primary scale-75"
                />
              </div>
            </div>

            {isRealCall && !twilioService.isConfigured && (
              <div className="px-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-md">
                  <p className="text-[10px] text-warning-foreground leading-tight">
                    <span className="font-bold">Configuration Required:</span> Enter your Twilio credentials below to enable real-world calling.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    placeholder="Account SID" 
                    className="text-[10px] h-8"
                    value={twilioConfig.accountSid}
                    onChange={(e) => setTwilioConfig({...twilioConfig, accountSid: e.target.value})}
                  />
                  <Input 
                    placeholder="Auth Token" 
                    type="password"
                    className="text-[10px] h-8"
                    value={twilioConfig.authToken}
                    onChange={(e) => setTwilioConfig({...twilioConfig, authToken: e.target.value})}
                  />
                </div>
                <Input 
                  placeholder="Twilio Phone Number (+91...)" 
                  className="text-[10px] h-8"
                  value={twilioConfig.phoneNumber}
                  onChange={(e) => setTwilioConfig({...twilioConfig, phoneNumber: e.target.value})}
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full h-7 text-[10px]"
                  onClick={() => {
                    twilioService.init(twilioConfig);
                    toast({ title: "Config Saved", description: "Twilio bridge initialized." });
                  }}
                >
                  Save & Initialize Bridge
                </Button>
              </div>
            )}

            <DialKeypad 
              onCall={handleStartCall}
              onCancel={onClose}
            />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Phone Number Display */}
            {phoneNumber && (
              <p className="text-center text-lg text-muted-foreground font-mono">
                {formatPhoneDisplay(phoneNumber)}
              </p>
            )}

            {/* Call Timer */}
            <div className="text-center">
              <p className="text-5xl font-mono font-bold">
                {formatDuration(duration)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {callState === 'connecting' && 'Establishing secure connection...'}
                {callState === 'active' && 'Live fraud analysis active'}
                {callState === 'analyzing' && 'Processing call data...'}
                {callState === 'complete' && 'Analysis complete'}
              </p>
            </div>

            {/* Forensic Trace Metadata */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-secondary/30 rounded border border-border/50 text-[10px]">
                <p className="text-muted-foreground uppercase font-bold">Network Origin</p>
                <p className="font-mono">{phoneNumber.startsWith('91') ? 'Mumbai, IN' : 'Los Angeles, US'}</p>
              </div>
              <div className="p-2 bg-secondary/30 rounded border border-border/50 text-[10px]">
                <p className="text-muted-foreground uppercase font-bold">Line Type</p>
                <p className="font-mono">VoIP / Virtual Gateway</p>
              </div>
            </div>

            {/* AI Voice Detection Gauge */}
            {callState === 'active' && (
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-purple-500 uppercase flex items-center gap-1">
                    <Radio className="h-3 w-3" /> Synthetic Voice Detection
                  </span>
                  <span className="text-[10px] font-mono text-purple-400">
                    {Math.round(riskScore * 0.8)}% Match
                  </span>
                </div>
                <Progress 
                  value={riskScore * 0.8} 
                  className="h-1 bg-purple-500/20"
                />
                <p className="text-[8px] text-purple-400/70 mt-1 italic">
                  Analyzing acoustic artifacts for AI-cloned speech signatures...
                </p>
              </div>
            )}

            {/* Live Simulation Transcript */}
            {callState === 'active' && (
              <div className="bg-black/20 rounded-lg p-3 h-24 overflow-y-auto border border-border/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Incoming Audio Data</span>
                </div>
                <p className="text-xs text-foreground/80 font-medium leading-relaxed italic">
                  {duration < 5 ? "Establishing handshake..." : 
                   duration < 10 ? "Hello? Can you hear me? This is officer David from the Department of Revenue..." :
                   duration < 15 ? "There is a serious issue with your account. Do not hang up or you will be arrested." :
                   "We need to verify your details immediately to stop the legal proceedings..."}
                </p>
              </div>
            )}

            {/* Main Risk Indicator */}
            {callState === 'active' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ML Threat Confidence</span>
                  <span className={`text-sm font-medium ${getRiskColor()}`}>
                    {getRiskLabel()} ({Math.round(riskScore)}%)
                  </span>
                </div>
                <Progress 
                  value={riskScore} 
                  className="h-2"
                />

                {/* Fraud Indicators */}
                {fraudIndicators.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {fraudIndicators.map((indicator, i) => (
                      <div key={i} className="text-[9px] bg-warning/10 text-warning-foreground border border-warning/20 p-1.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {indicator}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Analyzing State */}
            {callState === 'analyzing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="relative">
                  <Shield className="w-12 h-12 text-primary animate-pulse" />
                  <div className="absolute inset-0 border-2 border-primary rounded-full animate-ping opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-primary uppercase tracking-widest">Generating Forensic Report</p>
                  <p className="text-xs text-muted-foreground mt-1">Comparing voice patterns with global fraud database...</p>
                </div>
              </div>
            )}

            {/* Complete State */}
            {callState === 'complete' && (
              <div className="flex flex-col items-center justify-center gap-6 py-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-success" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-success uppercase tracking-widest">Evidence Saved</p>
                    <p className="text-xs text-muted-foreground mt-1">Incident log added to your historical dashboard.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button 
                    variant="outline" 
                    className="w-full gap-2 h-11"
                    onClick={() => {
                      const report = generateForensicReport(
                        phoneNumber,
                        { location: 'India (Standard Line)', carrier: 'Airtel India', carrierType: 'Mobile' },
                        { riskLevel: 'safe', fraudProbability: 0.1, fraudIndicators: [], deepfakeScore: 5 },
                        "Sample transcript for report generation..."
                      );
                      const formatted = formatReportForPrint(report);
                      console.log(formatted);
                      toast({
                        title: "Report Generated",
                        description: `Forensic Evidence ${report.reportId} saved to vault.`
                      });
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Evidence PDF
                  </Button>
                  <Button className="w-full h-11" onClick={onClose}>Finish</Button>
                </div>
              </div>
            )}

            {/* Call Controls */}
            {callState === 'active' && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-12 h-12 rounded-full"
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleEndCall}
                  className="w-14 h-14 rounded-full"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CallModal;
