// Deno.serve is now built-in
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallerAnalysisRequest {
  callerId: string;
  currentCallData?: {
    duration: number;
    riskScore: number;
    fraudIndicators: string[];
    transcript?: string;
  };
}

Deno.serve(async (req: Request) => {
  console.log("[analyze-caller] Function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { callerId, currentCallData }: CallerAnalysisRequest = await req.json();
    console.log("[analyze-caller] Analyzing caller:", callerId);

    // Fetch historical call data for this caller
    const { data: historicalCalls, error: fetchError } = await supabase
      .from("call_history")
      .select("duration, risk_score, risk_level, fraud_indicators, created_at, transcript")
      .eq("caller_id", callerId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error("[analyze-caller] Error fetching history:", fetchError);
    }

    const callHistory = historicalCalls || [];
    const totalCalls = callHistory.length;
    const avgRiskScore = totalCalls > 0
      ? callHistory.reduce((sum: number, c: any) => sum + Number(c.risk_score), 0) / totalCalls
      : 0;
    const blockedCalls = callHistory.filter((c: any) => c.risk_level === 'blocked').length;
    const warningCalls = callHistory.filter((c: any) => c.risk_level === 'warning').length;

    // Collect all historical fraud indicators
    const allIndicators: string[] = [];
    callHistory.forEach((c: any) => {
      if (c.fraud_indicators && Array.isArray(c.fraud_indicators)) {
        allIndicators.push(...c.fraud_indicators);
      }
    });
    const uniqueIndicators = [...new Set(allIndicators)];

    // Build context for AI analysis
    const analysisContext = {
      callerId,
      historicalSummary: {
        totalPreviousCalls: totalCalls,
        averageRiskScore: avgRiskScore.toFixed(1),
        blockedCalls,
        warningCalls,
        commonIndicators: uniqueIndicators.slice(0, 5),
      },
      currentCall: currentCallData || null,
    };

    console.log("[analyze-caller] Context built, calling AI...");

    // Call Lovable AI for intelligent analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert fraud detection AI analyst specializing in phone call security. Analyze caller behavior patterns and provide risk assessments.

Your task is to analyze a caller's behavior patterns based on their call history and current call data to provide:
1. A reputation score (0-100, where 0 is highly suspicious and 100 is fully trusted)
2. A risk assessment with specific behavioral patterns identified
3. Actionable recommendations for the user

Be concise but thorough. Focus on patterns that indicate potential fraud such as:
- Repeated calls with high risk scores
- Consistency in fraud indicators
- Unusual call patterns or timing
- Escalating urgency tactics

Respond with a JSON object containing:
{
  "reputationScore": number (0-100),
  "riskLevel": "trusted" | "neutral" | "suspicious" | "dangerous",
  "behaviorPatterns": string[] (list of identified patterns),
  "threatIndicators": string[] (specific red flags),
  "recommendation": string (what the user should do),
  "confidence": number (0-100, how confident you are in this assessment),
  "summary": string (brief 1-2 sentence summary)
}`
          },
          {
            role: "user",
            content: `Analyze this caller's behavior and provide a risk assessment:

${JSON.stringify(analysisContext, null, 2)}

Provide your analysis as a valid JSON object.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      console.error("[analyze-caller] AI gateway error:", status);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("[analyze-caller] AI response received");

    // Parse AI response
    let analysis;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[analyze-caller] Failed to parse AI response:", parseError);
      // Fallback to rule-based analysis
      analysis = {
        reputationScore: Math.max(0, 100 - avgRiskScore),
        riskLevel: avgRiskScore > 70 ? "dangerous" : avgRiskScore > 40 ? "suspicious" : avgRiskScore > 20 ? "neutral" : "trusted",
        behaviorPatterns: uniqueIndicators.length > 0 ? ["Pattern of suspicious behavior detected"] : ["No concerning patterns detected"],
        threatIndicators: uniqueIndicators.slice(0, 3),
        recommendation: avgRiskScore > 50 ? "Exercise caution with this caller. Consider blocking if behavior continues." : "No immediate action required.",
        confidence: 60,
        summary: `Caller has ${totalCalls} previous calls with an average risk score of ${avgRiskScore.toFixed(0)}%.`,
      };
    }

    // Add metadata
    const result = {
      ...analysis,
      callerId,
      analysisTimestamp: new Date().toISOString(),
      historicalData: {
        totalCalls,
        averageRiskScore: avgRiskScore,
        blockedCalls,
        warningCalls,
      },
    };

    console.log("[analyze-caller] Analysis complete:", result.riskLevel);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[analyze-caller] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
