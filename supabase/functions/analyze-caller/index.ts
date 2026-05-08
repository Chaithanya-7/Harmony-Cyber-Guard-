// Deno.serve is now built-in
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region, x-request-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT",
  "Access-Control-Max-Age": "86400",
};

interface CallerAnalysisRequest {
  callerId: string;
  phoneNumber?: string;
  metadata?: {
    carrier?: string;
    type?: string;
    location?: string;
    callHistory?: unknown[];
  };
  currentCallData?: {
    duration: number;
    riskScore: number;
    fraudIndicators: string[];
    transcript?: string;
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ML_INFERENCE_URL = Deno.env.get("ML_INFERENCE_URL");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callerId, phoneNumber, metadata, currentCallData }: CallerAnalysisRequest = await req.json();
    const normalizedCallerId = callerId || phoneNumber;
    const startTime = Date.now();

    if (!normalizedCallerId) {
      return new Response(
        JSON.stringify({ error: "callerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch historical call data
    const { data: historicalCalls } = await supabase
      .from("call_history")
      .select("*")
      .eq("caller_id", normalizedCallerId)
      .order("created_at", { ascending: false })
      .limit(10);

    const callHistory = historicalCalls || [];
    
    // 2. Try Dedicated ML Inference Service (Deep Path - XGBoost Fusion)
    if (ML_INFERENCE_URL) {
      try {
        console.log('[analyze-caller] Calling external ML inference service...');
        const mlResponse = await fetch(`${ML_INFERENCE_URL}/analyze/caller`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: normalizedCallerId, metadata: metadata ?? currentCallData, callHistory })
        });
        
        if (mlResponse.ok) {
          return new Response(mlResponse.body, { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err) {
        console.warn('[analyze-caller] ML Service failed, falling back to LLM:', err);
      }
    }

    // 3. Fallback to LLM Analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Analyze caller behavior patterns. Return JSON: { reputationScore, riskLevel, behaviorPatterns, threatIndicators, recommendation, confidence, summary }" },
          { role: "user", content: JSON.stringify({ callerId: normalizedCallerId, callHistory, currentCallData, metadata }) }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await response.json();
    const rawAnalysis = JSON.parse(aiData.choices[0].message.content);

    // Map to unified MLResponse format
    const result = {
      riskScore: 100 - rawAnalysis.reputationScore,
      riskLevel: rawAnalysis.riskLevel === 'dangerous' ? 'critical' : rawAnalysis.riskLevel === 'suspicious' ? 'warning' : rawAnalysis.riskLevel,
      confidence: (rawAnalysis.confidence || 90) / 100,
      signals: (rawAnalysis.threatIndicators || []).map((label: string) => ({ id: 'caller_signal', label, probability: 0.8 })),
      categories: ['caller_risk'],
      explanation: rawAnalysis.summary,
      recommendedAction: rawAnalysis.recommendation,
      isHeuristicFallback: false,
      processingTimeMs: Date.now() - startTime
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[analyze-caller] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
