import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CallData {
  duration: number;
  riskLevel: 'safe' | 'warning' | 'blocked';
  riskScore: number;
  fraudIndicators: string[];
  scenarioType?: string;
  callerId?: string;
  transcript?: string;
  recordingUrl?: string;
  audioAnalysis?: Record<string, unknown>;
}

export function useCallHistory() {
  const [isSaving, setIsSaving] = useState(false);

  const saveCall = useCallback(async (callData: CallData, userEmail?: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("User not authenticated, skipping save");
        return null;
      }

      const { data: callRecord, error: callError } = await supabase
        .from("call_history")
        .insert({
          user_id: user.id,
          duration: callData.duration,
          risk_level: callData.riskLevel,
          risk_score: callData.riskScore,
          fraud_indicators: callData.fraudIndicators,
          scenario_type: callData.scenarioType || null,
          caller_id: callData.callerId || null,
          transcript: callData.transcript || null,
          recording_url: callData.recordingUrl || null,
          audio_analysis: callData.audioAnalysis || null,
        } as any)
        .select()
        .single();

      if (callError) throw callError;

      // If high-risk, create alert and send email notification
      if (callData.riskLevel === 'blocked' && callRecord) {
        // Create fraud alert
        await supabase
          .from("fraud_alerts")
          .insert({
            user_id: user.id,
            call_id: callRecord.id,
            alert_type: "high_risk",
            message: `High-risk fraud attempt detected with ${callData.riskScore.toFixed(0)}% confidence`,
          });

        // Send email notification if we have the user's email
        if (userEmail || user.email) {
          try {
            await supabase.functions.invoke("send-fraud-alert", {
              body: {
                email: userEmail || user.email,
                callId: callRecord.id,
                riskScore: callData.riskScore,
                fraudIndicators: callData.fraudIndicators,
                duration: callData.duration,
              },
            });
            
            toast({
              title: "Alert Sent",
              description: "Email notification sent for high-risk detection.",
            });
          } catch (emailError) {
            console.error("Failed to send email alert:", emailError);
          }
        }
      }

      return callRecord;
    } catch (error: unknown) {
      console.error("Error saving call:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save call data.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const getCallWithRecording = useCallback(async (callId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("call_history")
        .select("*")
        .eq("id", callId)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      // Get signed URL for recording if exists
      if (data?.recording_url) {
        const { data: urlData } = await supabase.storage
          .from("call-recordings")
          .createSignedUrl(data.recording_url, 3600); // 1 hour validity

        return {
          ...data,
          signedRecordingUrl: urlData?.signedUrl,
        };
      }

      return data;
    } catch (error) {
      console.error("Error fetching call:", error);
      return null;
    }
  }, []);

  return { saveCall, getCallWithRecording, isSaving };
}
