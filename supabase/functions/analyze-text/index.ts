// Deno.serve is now built-in, no import needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-request-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT',
  'Access-Control-Max-Age': '86400',
};

// --- Advanced Detection Configuration ---

type ThreatCategory = 'Phishing' | 'Financial' | 'Emergency' | 'Harassment' | 'Unknown';

interface DetectionRule {
  pattern: RegExp;
  category: ThreatCategory;
  score: number;
  label: string;
}

const detectionRules: DetectionRule[] = [
  // --- Harassment / Cyberbullying ---
  { pattern: /\b(kill|murder|hurt|harm|beat|punch|stab|shoot)\s*(you|yourself|u|ur)/i, category: 'Harassment', score: 30, label: 'Direct Threat' },
  { pattern: /\b(die|death)\b/i, category: 'Harassment', score: 20, label: 'Hostile Language' },
  { pattern: /\b(i('ll|m\s+gonna|will)\s+(kill|hurt|find|get))/i, category: 'Harassment', score: 40, label: 'Intent to Harm' },
  { pattern: /\b(ugly|fat|stupid|dumb|idiot|loser|pathetic|worthless|useless)\b/i, category: 'Harassment', score: 15, label: 'Insult' },
  { pattern: /\b(go\s*away|leave|disappear|kill\s*yourself|kys)\b/i, category: 'Harassment', score: 50, label: 'Severe Harassment' },
  // (Slurs masked for code safety policies, but pattern logic remains similar to original)

  // --- Phishing / Credential Theft ---
  { pattern: /\b(verify\s*(your)?\s*account|confirm\s*(your)?\s*identity|unauthorized\s*access)\b/i, category: 'Phishing', score: 35, label: 'Fake Security Alert' },
  { pattern: /\b(click\s*here|link\s*below|open\s*(the)?\s*attachment|login\s*at)\b/i, category: 'Phishing', score: 25, label: 'Suspicious Link Prompt' },
  { pattern: /\b(password|pin|ssn|social\s*security|credit\s*card)\b/i, category: 'Phishing', score: 40, label: 'Sensitive Data Request' },

  // --- Financial Scams ---
  { pattern: /\b(won|winner|lottery|prize|reward|cash|claim)\b/i, category: 'Financial', score: 40, label: 'Too Good To Be True' },
  { pattern: /\b(investment|crypto|profit|bitcoin|money\s*back|guaranteed\s*return)\b/i, category: 'Financial', score: 35, label: 'Investment Scam' },
  { pattern: /\b(gift\s*card|steam\s*card|amazon\s*card|wire\s*transfer)\b/i, category: 'Financial', score: 45, label: 'Non-taceable Payment Request' },

  // --- Emergency / Pressure Scams ---
  { pattern: /\b(urgent|immediately|act\s*now|action\s*required|arrest|warrant|police|irs)\b/i, category: 'Emergency', score: 30, label: 'Artificial Urgency' },
  { pattern: /\b(family\s*member|grandson|accident|hospital|jail)\b/i, category: 'Emergency', score: 35, label: 'Emergency False Flag' },
];

function extractEntities(text: string) {
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-zA-Z0-9-]+\.(com|net|org|xyz|info|biz)\b)/gi;
  const phonePattern = /\b(\+?\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  const cryptoPattern = /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g; // Basic Bitcoin regex

  const urls = text.match(urlPattern) || [];
  const phones = text.match(phonePattern) || [];
  const crypto = text.match(cryptoPattern) || [];

  return { urls, phones, crypto };
}

function detectLeetspeak(text: string): boolean {
  // Simple check for common substitutions in potential threat words
  // e.g., 'p@ssw0rd'
  const leetHacks = [
    { pattern: /[\$s]c[@a]m/gi, original: 'scam' },
    { pattern: /p[@a]ss/gi, original: 'pass' },
    { pattern: /cr[y7]pt0/gi, original: 'crypto' }
  ];
  return leetHacks.some(h => h.pattern.test(text));
}

function analyzeText(text: string): {
  isCyberbullying: boolean;
  isScam: boolean;
  threatLevel: 'safe' | 'warning' | 'danger';
  score: number;
  indicators: string[];
  categories: ThreatCategory[];
  entities: { urls: string[], phones: string[], crypto: string[] };
} {
  const lowerText = text.toLowerCase();
  const indicators: string[] = [];
  const categories: Set<ThreatCategory> = new Set();
  let score = 0;

  // 1. Rule-based analysis
  for (const rule of detectionRules) {
    if (rule.pattern.test(text)) {
      if (!indicators.includes(rule.label)) {
        indicators.push(rule.label);
        score += rule.score;
        categories.add(rule.category);
      }
    }
  }

  // 2. Entity Analysis
  const entities = extractEntities(text);
  if (entities.urls.length > 0) {
    score += 20;
    indicators.push(`Contains ${entities.urls.length} URL(s)`);
    categories.add('Phishing');
  }
  if (entities.crypto.length > 0) {
    score += 40; // High risk
    indicators.push('Crypto Address Detected');
    categories.add('Financial');
  }

  // 3. Behavioral / Stylistic Analysis
  // Caps Lock Aggression
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  if (capsWords.length > 2) {
    indicators.push('Aggressive caps usage');
    score += 10;
  }

  // Obfuscation
  if (detectLeetspeak(text)) {
    indicators.push('Obfuscated text detected');
    score += 15;
  }

  // 4. Final Scoring & classification
  let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';
  // Cap score at 100
  score = Math.min(score, 100);

  if (score >= 60) {
    threatLevel = 'danger';
  } else if (score >= 30) {
    threatLevel = 'warning';
  }

  const isScam = categories.has('Financial') || categories.has('Phishing') || categories.has('Emergency');
  const isCyberbullying = categories.has('Harassment');

  return {
    isCyberbullying,
    isScam,
    threatLevel,
    score,
    indicators: indicators.slice(0, 15),
    categories: Array.from(categories),
    entities
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, senderNumber } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    console.log(`Analyzing message: ${message.substring(0, 50)}...`);

    // 1. Try Dedicated ML Inference Service (Deep Path - ModernBERT)
    const mlInferenceUrl = Deno.env.get('ML_INFERENCE_URL');
    if (mlInferenceUrl) {
      try {
        const mlResponse = await fetch(`${mlInferenceUrl}/analyze/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message })
        });
        
        if (mlResponse.ok) {
          const result = await mlResponse.json();
          return new Response(JSON.stringify(result), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err) {
        console.warn('[AnalyzeText] ML Service failed, falling back to heuristics:', err);
      }
    }

    // 2. Fallback to Local Heuristics
    const analysis = analyzeText(message);
    
    // Map to unified MLResponse format
    const response = {
      riskScore: analysis.score,
      riskLevel: analysis.threatLevel === 'danger' ? 'critical' : analysis.threatLevel,
      confidence: 0.7,
      signals: analysis.indicators.map(label => ({
        id: 'heuristic_signal',
        label,
        probability: 0.8
      })),
      categories: analysis.categories.map(c => c.toLowerCase()),
      explanation: `Heuristic analysis detected ${analysis.categories.join(' and ')} patterns.`,
      recommendedAction: analysis.threatLevel !== 'safe' ? 'Exercise caution with this message.' : 'No immediate threat detected.',
      isHeuristicFallback: true,
      processingTimeMs: Date.now() - startTime
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing text:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
