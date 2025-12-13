import "https://deno.land/x/xhr@0.1.0/mod.ts";
// Deno.serve is now built-in

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, audioAnalysis } = await req.json();

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

    // Try Lovable AI first, fallback to OpenAI
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!lovableKey && !openaiKey) {
      throw new Error('No API key configured for analysis');
    }

    console.log('[AnalyzeCall] Analyzing transcript for fraud and cyberbullying...');

    // Build context with audio analysis if available
    let analysisContext = `TRANSCRIPT TO ANALYZE:\n"${transcript}"`;

    if (audioAnalysis) {
      analysisContext += `\n\nAUDIO CONTEXT:
- Voice Stress Level: ${((audioAnalysis.voiceStress || 0) * 100).toFixed(1)}%
- Speech Rate: ${audioAnalysis.speechRate ? 'Elevated' : 'Normal'}
- Emotional Trend: ${audioAnalysis.emotionalTrend || 'stable'}
- Speakers Detected: ${audioAnalysis.speakerCount || 'unknown'}`;
    }

    let analysis;

    // Use Lovable AI if available
    if (lovableKey) {
      console.log('[AnalyzeCall] Using Lovable AI gateway...');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: ANALYSIS_PROMPT },
            { role: 'user', content: analysisContext }
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        console.error('[AnalyzeCall] Lovable AI error:', status);

        if (status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fallback to OpenAI if Lovable fails
        if (openaiKey) {
          console.log('[AnalyzeCall] Falling back to OpenAI...');
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: ANALYSIS_PROMPT },
                { role: 'user', content: analysisContext }
              ],
              temperature: 0.3,
              response_format: { type: 'json_object' },
            }),
          });

          if (!openaiResponse.ok) {
            throw new Error('Both AI services failed');
          }

          const result = await openaiResponse.json();
          analysis = JSON.parse(result.choices[0].message.content);
        } else {
          throw new Error('Lovable AI failed and no OpenAI fallback');
        }
      } else {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON in response');
          }
        } catch (parseErr) {
          console.error('[AnalyzeCall] Parse error:', parseErr);
          // Create a basic analysis from the response
          analysis = {
            overallRiskScore: 50,
            riskLevel: 'warning',
            categories: {},
            fraudIndicators: ['Analysis parsing failed - manual review recommended'],
            harmfulContent: [],
            summary: content.substring(0, 200),
            recommendation: 'Manual review recommended',
            urgentAction: false
          };
        }
      }
    } else {
      // Use OpenAI directly
      console.log('[AnalyzeCall] Using OpenAI...');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: ANALYSIS_PROMPT },
            { role: 'user', content: analysisContext }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AnalyzeCall] OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const result = await response.json();
      analysis = JSON.parse(result.choices[0].message.content);
    }

    console.log('[AnalyzeCall] Analysis complete. Risk:', analysis.riskLevel, 'Score:', analysis.overallRiskScore);
    console.log('[AnalyzeCall] Harmful content found:', analysis.harmfulContent?.length || 0);

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
