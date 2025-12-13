
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCENARIOS = {
    irs: {
        role: "Officer John Smith from the IRS (Internal Revenue Service)",
        goal: "Convince the user they owe back taxes and must pay immediately via gift cards or wire transfer to avoid arrest.",
        style: "Authoritative, aggressive, urgent, bureaucratic.",
        opener: "This is Officer Smith from the IRS. We have a warrant for your arrest due to unpaid taxes of $5,000."
    },
    grandchild: {
        role: "The user's grandson/granddaughter (acting distressed)",
        goal: "Convince the grandparent code (user) that you are in jail/hospital in a foreign country and need bail money immediately. Do NOT reveal your name easy, make them guess.",
        style: "Panicked, emotional, pleading, fast-talking.",
        opener: "Grandma? Grandpa? It's me... I'm in so much trouble... please help."
    },
    tech: {
        role: "Microsoft/Windows Technical Support",
        goal: "Convince the user their computer has a virus and they need to give remote access or pay for 'antivirus' software.",
        style: "Helpful but urgent, using technical jargon, persistent.",
        opener: "Hello, this is Windows Support. We have detected a critical virus on your computer that is stealing your banking information."
    }
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { scenario: scenarioKey, history } = await req.json();

        const scenario = SCENARIOS[scenarioKey as keyof typeof SCENARIOS];
        if (!scenario) {
            throw new Error(`Invalid scenario: ${scenarioKey}`);
        }

        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const systemPrompt = `You are roleplaying a SCAM SCENARIO training simulation. 
    ROLE: ${scenario.role}
    GOAL: ${scenario.goal}
    STYLE: ${scenario.style}
    
    INSTRUCTIONS:
    1. Stay in character 100%. Do not break character.
    2. If the user successfully "catches" you or refuses to comply skeptically, try one more time to pressure them, then if they persist, admit defeat (e.g., hang up or curse).
    3. If the user gives sensitive info (fake is fine), act pleased and push for more.
    4. Keep responses relatively short (under 50 words) like a real conversation.
    
    EVALUATION:
    Along with your response, you must evaluate the USER'S last message.
    Did they reveal sensitive info? Did they successfully push back?
    
    Response Format (JSON):
    {
      "message": "Your in-character response",
      "userScore": number (0-100, where 100 is perfectly safe/skeptical, 0 is properly scammed),
      "feedback": "Brief hint if they messed up",
      "status": "ongoing" | "success" (user won) | "failed" (user got scammed)
    }`;

        // Construct messages
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: messages,
                temperature: 0.7,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI error: ${await response.text()}`);
        }

        const result = await response.json();
        const aiContent = JSON.parse(result.choices[0].message.content);

        return new Response(
            JSON.stringify(aiContent),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
