import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import SimulationLab from "@/components/SimulationLab";
import StatsGrid from "@/components/StatsGrid";
import CallDurationChart from "@/components/CallDurationChart";
import RiskBreakdown from "@/components/RiskBreakdown";
import CallModal from "@/components/CallModal";
import { LiveAnalysisView } from "@/components/LiveAnalysisView";
import { CallerAnalysisCard } from "@/components/CallerAnalysisCard";
import { toast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCallHistory } from "@/hooks/useCallHistory";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, FlaskConical, Brain, MessageSquare } from "lucide-react";
import { TextAnalysisPanel } from "@/components/TextAnalysisPanel";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { saveCall } = useCallHistory();
  
  const [stats, setStats] = useState({
    totalCalls: 0,
    scamsBlocked: 0,
    warnings: 0,
    safeCalls: 0,
  });

  const [callHistory, setCallHistory] = useState<Array<{ call: number; duration: number; risk: number }>>([]);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch existing stats from database
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("call_history")
        .select("risk_level, duration, risk_score")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      if (data && data.length > 0) {
        const newStats = {
          totalCalls: data.length,
          scamsBlocked: data.filter(c => c.risk_level === 'blocked').length,
          warnings: data.filter(c => c.risk_level === 'warning').length,
          safeCalls: data.filter(c => c.risk_level === 'safe').length,
        };
        setStats(newStats);

        const history = data.map((call, index) => ({
          call: index + 1,
          duration: call.duration,
          risk: Number(call.risk_score),
        }));
        setCallHistory(history);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleRefresh = useCallback(() => {
    fetchStats();
    toast({
      title: "Dashboard Refreshed",
      description: "All data has been synchronized.",
    });
  }, []);

  const handleMakeCall = useCallback(() => {
    setIsCallModalOpen(true);
  }, []);

  const handleScenarioComplete = useCallback(async (result: { type: string; blocked: boolean }) => {
    const duration = Math.floor(Math.random() * 120) + 30;
    const riskScore = result.blocked ? 85 : 45;
    const riskLevel = result.blocked ? 'blocked' : 'warning';

    // Save to database
    await saveCall({
      duration,
      riskLevel: riskLevel as 'blocked' | 'warning' | 'safe',
      riskScore,
      fraudIndicators: result.blocked 
        ? ['Urgency pattern detected', 'Authority claim detected', 'Request for sensitive information']
        : ['Slight urgency detected'],
      scenarioType: result.type,
    }, user?.email);

    setStats((prev) => ({
      ...prev,
      totalCalls: prev.totalCalls + 1,
      scamsBlocked: prev.scamsBlocked + (result.blocked ? 1 : 0),
      warnings: prev.warnings + (result.blocked ? 0 : 1),
    }));

    setCallHistory((prev) => [
      ...prev.slice(-9),
      {
        call: prev.length + 1,
        duration,
        risk: riskScore,
      },
    ]);
  }, [saveCall, user]);

  const handleCallEnd = useCallback(async (result: { 
    duration: number; 
    riskLevel: 'safe' | 'warning' | 'blocked'; 
    riskScore: number; 
    fraudIndicators: string[]; 
    transcript?: string; 
    recordingUrl?: string;
    callerId?: string;
  }) => {
    // Save to database
    await saveCall({
      duration: result.duration,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      fraudIndicators: result.fraudIndicators,
      transcript: result.transcript,
      recordingUrl: result.recordingUrl,
      callerId: result.callerId,
    }, user?.email);

    setStats((prev) => ({
      ...prev,
      totalCalls: prev.totalCalls + 1,
      scamsBlocked: prev.scamsBlocked + (result.riskLevel === 'blocked' ? 1 : 0),
      warnings: prev.warnings + (result.riskLevel === 'warning' ? 1 : 0),
      safeCalls: prev.safeCalls + (result.riskLevel === 'safe' ? 1 : 0),
    }));

    setCallHistory((prev) => [
      ...prev.slice(-9),
      {
        call: prev.length + 1,
        duration: result.duration,
        risk: result.riskScore,
      },
    ]);
  }, [saveCall, user]);

  const riskData = {
    safe: stats.safeCalls,
    warning: stats.warnings,
    blocked: stats.scamsBlocked,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>CallGuard-Sentinel | Real-time Call Fraud Detection</title>
        <meta name="description" content="Advanced AI-powered call fraud detection system with real-time voice analysis, speaker diarization, and multimodal threat assessment." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pb-8 max-w-7xl">
          <Header onRefresh={handleRefresh} onMakeCall={handleMakeCall} />

          <main className="space-y-6">
            <Tabs defaultValue="live" className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="live" className="gap-2">
                  <Radio className="h-4 w-4" />
                  Live Analysis
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Text Check
                </TabsTrigger>
                <TabsTrigger value="caller" className="gap-2">
                  <Brain className="h-4 w-4" />
                  Caller AI
                </TabsTrigger>
                <TabsTrigger value="simulation" className="gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Simulation
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="live" className="mt-6">
                <LiveAnalysisView onCallEnd={handleCallEnd} />
              </TabsContent>

              <TabsContent value="text" className="mt-6">
                <TextAnalysisPanel />
              </TabsContent>

              <TabsContent value="caller" className="mt-6">
                <CallerAnalysisCard />
              </TabsContent>
              
              <TabsContent value="simulation" className="mt-6">
                <SimulationLab onScenarioComplete={handleScenarioComplete} />
              </TabsContent>
            </Tabs>
            
            <StatsGrid stats={stats} />

            <div className="grid gap-4 lg:grid-cols-3">
              <CallDurationChart data={callHistory} />
              <RiskBreakdown data={riskData} />
            </div>
          </main>
        </div>

        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          onCallEnd={handleCallEnd}
        />
      </div>
    </>
  );
};

export default Index;
