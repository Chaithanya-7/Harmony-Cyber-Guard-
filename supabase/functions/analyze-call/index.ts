// Standard Supabase Edge Function CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-request-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT',
  'Access-Control-Max-Age': '86400',
};

const ANALYSIS_PROMPT = `You are an expert call safety analyst. Analyze the following call transcript for potential threats including fraud, scams, AND cyberbullying/harassment.

DETECT THESE CATEGORIES (score 0-100 each):

1. **Fraud & Scam Indicators**:
   - Authority Impersonation: Claims to be from government, bank, tech support
   - Financial Requests: Asks for money, gift cards, wire transfers
   - Urgency Pressure: Creates artificial time pressure or threats
   - Personal Info Requests: Asks for SSN, passwords, bank details

2. **Cyberbullying & Harassment**:
   - Threats: Direct or implied threats of harm
   - Insults & Slurs: Name-calling, derogatory language, hate speech
   - Intimidation: Attempts to frighten, belittle, or demean
   - Stalking Language: Unwanted persistent contact, tracking references
   - Sexual Harassment: Inappropriate sexual content or advances

3. **Emotional Manipulation**:
   - Fear tactics, guilt-tripping, love-bombing
   - Gaslighting or dismissive language

IMPORTANT: Be sensitive to ANY form of harmful language including:
- Profanity and vulgar insults
- Racial, ethnic, religious, or gender-based slurs
- Body shaming or appearance-based insults
- Ableist language
- Death threats or wishes of harm
- Doxxing threats (revealing personal information)

Return a JSON response with:
{
  "overallRiskScore": number (0-100),
  "riskLevel": "safe" | "warning" | "blocked",
  "categories": {
    "fraudIndicators": { "score": number, "evidence": string[] },
    "cyberbullying": { "score": number, "evidence": string[] },
    "threats": { "score": number, "evidence": string[] },
    "harassment": { "score": number, "evidence": string[] },
    "emotionalManipulation": { "score": number, "evidence": string[] }
  },
  "fraudIndicators": string[],
  "harmfulContent": string[],
  "summary": string,
  "recommendation": string,
  "urgentAction": boolean
}

Set urgentAction=true if there are direct threats, severe harassment, or immediate danger indicators.`;

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const { transcript, audioBase64, audioAnalysis } = await req.json();

    console.log('[AnalyzeCall] Received request, transcript length:', transcript?.length || 0);

    if (!transcript || transcript.trim().length === 0) {
      console.log('[AnalyzeCall] No transcript provided');
      return new Response(
        JSON.stringify({
          overallRiskScore: 0,
          riskLevel: 'safe',
          categories: {},
          fraudIndicators: [],
          harmfulContent: [],
          summary: 'No transcript available for analysis',
          recommendation: 'Unable to analyze without transcript',
          urgentAction: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!lovableKey && !openaiKey) {
      throw new Error('No API key configured for analysis');
    }

    console.log('[AnalyzeCall] Analyzing transcript for fraud and cyberbullying...');

    // 1. Try Dedicated ML Inference Service (Deep Path)
    const mlInferenceUrl = Deno.env.get('ML_INFERENCE_URL');
    if (mlInferenceUrl) {
      try {
        console.log('[AnalyzeCall] Calling external ML inference service...');
        const mlResponse = await fetch(`${mlInferenceUrl}/analyze/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, audioBase64, audioAnalysis })
        });
        
        if (mlResponse.ok) {
          const result = await mlResponse.json();
          return new Response(JSON.stringify(result), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err) {
        console.warn('[AnalyzeCall] ML Service failed, falling back to LLM:', err);
      }
    }

    let analysis;
    const llmAnalysisContext = `TRANSCRIPT: "${transcript}"\nAUDIO: ${JSON.stringify(audioAnalysis)}`;

    try {
      const response = await fetch(lovableKey ? 'https://ai.gateway.lovable.dev/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey || openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: lovableKey ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: ANALYSIS_PROMPT },
            { role: 'user', content: llmAnalysisContext }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '{}';
      const rawAnalysis = JSON.parse(content);

      // Map LLM response to unified MLResponse format
      analysis = {
        riskScore: rawAnalysis.overallRiskScore,
        riskLevel: rawAnalysis.riskLevel === 'blocked' ? 'danger' : rawAnalysis.riskLevel,
        confidence: 0.85,
        signals: (rawAnalysis.fraudIndicators || []).map((label: string) => ({
          id: 'llm_signal',
          label,
          probability: 0.9
        })),
        categories: Object.keys(rawAnalysis.categories || {}).filter(k => rawAnalysis.categories[k].score > 30),
        explanation: rawAnalysis.summary,
        recommendedAction: rawAnalysis.recommendation,
        isHeuristicFallback: false,
        processingTimeMs: 0,
      };
    } catch (err) {
      console.error('[AnalyzeCall] LLM analysis failed:', err);
      throw err;
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AnalyzeCall] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
