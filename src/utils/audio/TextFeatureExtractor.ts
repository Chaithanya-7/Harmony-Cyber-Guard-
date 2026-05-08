// TextFeatureExtractor - Deep linguistic signal extraction from transcribed text

export interface TextFeatures {
  // Authority claims
  authorityScore: number;
  authorityPhrases: string[];

  // Urgency patterns
  urgencyScore: number;
  urgencyIndicators: string[];

  // Threat lexicon density
  threatDensity: number;
  threatTerms: string[];

  // Financial Requests (NEW)
  financialScore: number;
  financialTerms: string[];

  // PII requests
  piiRequestScore: number;
  piiTypes: string[];

  // Imperative frequency
  imperativeFrequency: number;
  imperativeVerbs: string[];

  // Cyberbullying/Harassment detection
  cyberbullyingScore: number;
  harassmentIndicators: string[];

  // Additional NLP features
  sentimentPolarity: number;
  subjectivityScore: number;
  questionFrequency: number;
  negationFrequency: number;

  // N-gram based scores
  bigramThreatScore: number;
  trigramPatternScore: number;

  // Overall fraud likelihood from text
  textFraudScore: number;
  threatPhrases: string[];
}

interface NGramScore {
  ngram: string;
  score: number;
  category: string;
}

export class TextFeatureExtractor {
  // Authority claim patterns
  private authorityPatterns: RegExp[] = [
    /\b(i am|this is|i'm calling from)\s+(the\s+)?(irs|fbi|police|government|department|agency|bank|microsoft|apple|amazon|social security|medicare|well\s+fargo|chase|boa|citibank)\b/i,
    /\b(official|authorized|certified|licensed|government|federal)\s+(agent|officer|representative|department)\b/i,
    /\bwe\s+(have|need)\s+(your|the)\s+(information|records|file|case|account\s+details)\b/i,
    /\b(badge\s+number|case\s+number|reference\s+number|warrant|account\s+verification)\b/i,
    /\byour\s+(account|case|file|security|access)\s+(has\s+been|is\s+being|will\s+be|was)\b/i,
  ];

  // Financial Request patterns (NEW - Catch "give me the money")
  private financialPatterns: RegExp[] = [
    /\b(money|cash|dollars|funds|payment|wire|transfer)\b/i,
    /\b(venmo|zelle|paypal|cashapp|western\s+union|moneygram)\b/i,
    /\b(bitcoin|crypto|ethereum|wallet\s+address)\b/i,
    /\b(won|winner|prize|reward|claim|inheritance|jackpot)\b/i,
    /\b(lottery|casino|betting|gamble)\b/i,
    /\b(give|send|pay|transfer)\s+(me\s+)?(the\s+)?(money|cash|dollars|funds)/i,
    /\b(how\s+much|amount)\s+(do\s+you|can\s+you)\s+(have|send|pay)/i,
    /\b(\$|usd|dollars)\s*\d+/i,
  ];

  // Urgency patterns
  private urgencyPatterns: RegExp[] = [
    /\b(immediately|urgent|right now|today|within\s+\d+\s+(hours?|minutes?|days?))/i,
    /\b(limited time|expires?|deadline|last chance|final notice)/i,
    /\b(act now|don't wait|hurry|quickly|as soon as possible|asap)/i,
    /\b(before\s+it's\s+too\s+late|time\s+is\s+running\s+out)/i,
    /\b(only\s+\d+\s+(left|remaining|available))/i,
  ];

  // Threat lexicon
  private threatPatterns: RegExp[] = [
    /\b(arrest|jail|prison|lawsuit|legal\s+action|prosecution)/i,
    /\b(suspend|terminate|cancel|freeze|block)\s+(your\s+)?(account|service|benefits)/i,
    /\b(warrant|subpoena|court\s+order|criminal\s+charges)/i,
    /\b(penalty|fine|fee|charge)\s+of\s+\$?\d+/i,
    /\b(if\s+you\s+don't|unless\s+you|failure\s+to)/i,
    /\b(consequences|serious|severe|immediate\s+action)/i,
  ];

  // PII request patterns
  private piiPatterns: Record<string, RegExp[]> = {
    ssn: [
      /\b(social\s+security|ssn|social\s+security\s+number)/i,
      /\b(last\s+four|last\s+4)\s+(digits|numbers)/i,
    ],
    financial: [
      /\b(bank\s+account|routing\s+number|credit\s+card|debit\s+card)/i,
      /\b(account\s+number|pin|cvv|security\s+code)/i,
    ],
    identity: [
      /\b(date\s+of\s+birth|dob|birthday|mother's\s+maiden)/i,
      /\b(driver's?\s+license|passport|id\s+number)/i,
    ],
    access: [
      /\b(password|login|username|email\s+address)/i,
      /\b(verification\s+code|one-time\s+password|otp)/i,
    ],
  };

  // Imperative verbs
  private imperativeVerbs: string[] = [
    'call', 'contact', 'provide', 'give', 'send', 'transfer', 'pay',
    'confirm', 'verify', 'enter', 'click', 'go', 'press', 'download',
    'install', 'open', 'access', 'log', 'sign', 'buy', 'purchase'
  ];

  // Cyberbullying and harassment patterns
  private cyberbullyingPatterns: RegExp[] = [
    // Direct insults and name-calling
    /\b(idiot|stupid|dumb|loser|pathetic|worthless|ugly|fat|disgusting|trash|garbage|moron|retard|clown|scum|rat|pig|freak)\b/i,
    // Profanity and vulgar insults
    /\b(f+u+c+k+|sh+i+t+|b+i+t+c+h+|a+s+s+h+o+l+e+|d+a+m+n+|hell|crap|bastard|dick|pussy|slut|whore|motherfucker)\b/i,
    // Aggressive Threats
    /\b(kill|murder|die|hurt|beat|punch|attack|destroy|strangle|shoot|stab|choke|burn)\s+(you|yourself|your)/i,
    /\b(i('ll|'m going to|will)|we('ll| will))\s+(kill|hurt|beat|destroy|attack|end|ruin|get)\s+you/i,
    /\b(you should|go)\s+(die|kill yourself|hang yourself|jump)\b/i,
    // Harassment and Emotional Abuse
    /\b(nobody likes you|everyone hates you|no one cares|you('re| are) nothing|you are a mistake|you should not exist)\b/i,
    /\b(shut (the fuck )?up|go away|leave me alone|fuck off|get lost|piece of shit)\b/i,
    /\b(i hate you|you('re| are) so (stupid|ugly|fat|dumb|worthless|disgusting))\b/i,
    // Stalking and Doxing Threats
    /\b(i('m| am) watching you|i know where you live|i('ll| will) find you|i am outside|your address is)\b/i,
    /\b(i will track you|i have your IP|i know your school|i know your family)\b/i,
    // Sexual harassment
    /\b(send (me )?nudes|show me your|touch (yourself|your)|naked|sexy|horny|want some)\b/i,
    // Intimidation
    /\b(you('ll| will) (regret|pay|be sorry)|watch your back|don't tell anyone|or else)\b/i,
    /\b(i('ll| will) (leak|share|post|expose|upload) your (photos|videos|nudes|address))\b/i,
    // Realistic Scam Scenarios (NEW)
    /\b(it's\s+your\s+grandson|i'm\s+your\s+grandchild|it's\s+me\s+grandma|i'm\s+in\s+jail|i'm\s+in\s+trouble)\b/i,
    /\b(electricity|water|gas|utility|power)\s+(will\s+be|is\s+being)\s+(cut\s+off|disconnected|shut\s+down)\b/i,
    /\b(gift\s+card|apple\s+card|steam\s+card|target\s+card|buy\s+a\s+card)\b/i,
    /\b(one-time\s+passcode|otp|verification\s+code|don't\s+share\s+this)\b/i,
    // Racial/ethnic/hate speech
    /\b(n+i+g+g+|ch+i+n+k+|sp+i+c+|k+i+k+e+|w+e+t+b+a+c+k+|terrorist|faggot|tranny)\b/i,
  ];

  // Threat bigrams for scoring
  private threatBigrams: Record<string, number> = {
    'arrest warrant': 0.9,
    'legal action': 0.8,
    'criminal charges': 0.9,
    'pay immediately': 0.85,
    'account suspended': 0.75,
    'verify identity': 0.6,
    'confirm information': 0.5,
    'gift card': 0.95,
    'wire transfer': 0.85,
    'bitcoin payment': 0.9,
    // Cyberbullying bigrams
    'kill yourself': 1.0,
    'hate you': 0.7,
    'hurt you': 0.9,
    'nobody likes': 0.6,
    'everyone hates': 0.7,
    'so ugly': 0.6,
    'so stupid': 0.6,
  };

  // Extract all features from text
  extract(text: string): TextFeatures {
    const words = this.tokenize(text);
    const sentences = this.splitSentences(text);

    const authorityResult = this.extractAuthorityFeatures(text);
    const urgencyResult = this.extractUrgencyFeatures(text);
    const threatResult = this.extractThreatFeatures(text);
    const financialResult = this.extractFinancialFeatures(text); // NEW
    const piiResult = this.extractPIIFeatures(text);
    const imperativeResult = this.extractImperativeFeatures(words);
    const cyberbullyingResult = this.extractCyberbullyingFeatures(text);

    const sentimentPolarity = this.calculateSentiment(text);
    const subjectivityScore = this.calculateSubjectivity(text);
    const questionFrequency = this.calculateQuestionFrequency(sentences);
    const negationFrequency = this.calculateNegationFrequency(words);

    const bigramThreatScore = this.calculateBigramScore(text);
    const trigramPatternScore = this.calculateTrigramScore(text);

    // Calculate overall text fraud score (includes cyberbullying)
    const textFraudScore = this.calculateOverallFraudScore({
      authorityScore: authorityResult.score,
      urgencyScore: urgencyResult.score,
      threatDensity: threatResult.density,
      financialScore: financialResult.score, // NEW
      piiRequestScore: piiResult.score,
      imperativeFrequency: imperativeResult.frequency,
      bigramThreatScore,
      trigramPatternScore,
      sentimentPolarity,
      questionFrequency,
      cyberbullyingScore: cyberbullyingResult.score,
    });

    // Collect all unique threat phrases for highlighting
    const threatPhrases = [...new Set([
      ...authorityResult.phrases,
      ...urgencyResult.indicators,
      ...threatResult.terms,
      ...financialResult.terms,
      ...piiResult.types,
      ...cyberbullyingResult.indicators,
    ])];

    return {
      authorityScore: authorityResult.score,
      authorityPhrases: authorityResult.phrases,
      urgencyScore: urgencyResult.score,
      urgencyIndicators: urgencyResult.indicators,
      threatDensity: threatResult.density,
      threatTerms: threatResult.terms,
      financialScore: financialResult.score, // ADDED
      financialTerms: financialResult.terms, // ADDED
      piiRequestScore: piiResult.score,
      piiTypes: piiResult.types,
      imperativeFrequency: imperativeResult.frequency,
      imperativeVerbs: imperativeResult.verbs,
      cyberbullyingScore: cyberbullyingResult.score,
      harassmentIndicators: cyberbullyingResult.indicators,
      sentimentPolarity,
      subjectivityScore,
      questionFrequency,
      negationFrequency,
      bigramThreatScore,
      trigramPatternScore,
      textFraudScore,
      threatPhrases,
    };
  }

  // Extract cyberbullying and harassment features
  private extractCyberbullyingFeatures(text: string): { score: number; indicators: string[] } {
    const indicators: string[] = [];
    let matchCount = 0;

    this.cyberbullyingPatterns.forEach(pattern => {
      const matches = text.match(new RegExp(pattern, 'gi'));
      if (matches) {
        matchCount += matches.length;
        indicators.push(...matches.map(m => m.toLowerCase()));
      }
    });

    // Score based on number of matches - cyberbullying is high priority
    const score = Math.min(1, matchCount * 0.3);

    console.log('[TextFeatures] Cyberbullying detection:', {
      matchCount,
      score,
      indicators: [...new Set(indicators)].slice(0, 5)
    });

    return { score, indicators: [...new Set(indicators)] };
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  }

  private splitSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private extractAuthorityFeatures(text: string): { score: number; phrases: string[] } {
    const phrases: string[] = [];
    let matchCount = 0;

    this.authorityPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matchCount++;
        phrases.push(matches[0]);
      }
    });

    const score = Math.min(1, matchCount * 0.3);
    return { score, phrases };
  }

  private extractFinancialFeatures(text: string): { score: number; terms: string[] } {
    const terms: string[] = [];
    let matchCount = 0;

    this.financialPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matchCount++; // Matches are weighted heavily
        terms.push(matches[0]);
      }
    });

    // "Give me the money" is a critical signal. Even one match is suspicious.
    // 1 match = 0.4, 2 matches = 0.8, 3+ = 1.0
    const score = Math.min(1, matchCount * 0.4);
    return { score, terms };
  }

  private extractUrgencyFeatures(text: string): { score: number; indicators: string[] } {
    const indicators: string[] = [];
    let matchCount = 0;

    this.urgencyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matchCount++;
        indicators.push(matches[0]);
      }
    });

    const score = Math.min(1, matchCount * 0.25);
    return { score, indicators };
  }

  private extractThreatFeatures(text: string): { density: number; terms: string[] } {
    const terms: string[] = [];
    let matchCount = 0;
    const words = this.tokenize(text);

    this.threatPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matchCount++;
        terms.push(matches[0]);
      }
    });

    const density = words.length > 0 ? Math.min(1, (matchCount * 3) / words.length) : 0;
    return { density, terms };
  }

  private extractPIIFeatures(text: string): { score: number; types: string[] } {
    const types: string[] = [];
    let totalScore = 0;

    Object.entries(this.piiPatterns).forEach(([type, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(text)) {
          types.push(type);
          totalScore += 0.25;
        }
      });
    });

    const score = Math.min(1, totalScore);
    return { score, types: [...new Set(types)] };
  }

  private extractImperativeFeatures(words: string[]): { frequency: number; verbs: string[] } {
    const foundVerbs: string[] = [];

    words.forEach((word, index) => {
      if (this.imperativeVerbs.includes(word)) {
        // Check if it's likely imperative (sentence start or after punctuation)
        if (index === 0 || words[index - 1]?.match(/[.!?]/)) {
          foundVerbs.push(word);
        } else {
          // Still count but with lower weight
          foundVerbs.push(word);
        }
      }
    });

    const frequency = words.length > 0 ? foundVerbs.length / words.length : 0;
    return { frequency, verbs: [...new Set(foundVerbs)] };
  }

  private calculateSentiment(text: string): number {
    // Simplified sentiment using word lists
    const positiveWords = ['good', 'great', 'help', 'opportunity', 'benefit', 'reward', 'winner', 'congratulations'];
    const negativeWords = ['bad', 'problem', 'issue', 'suspend', 'cancel', 'arrest', 'lawsuit', 'penalty', 'fraud', 'illegal'];

    const words = this.tokenize(text);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    const total = positiveCount + negativeCount;
    if (total === 0) return 0;

    return (positiveCount - negativeCount) / total;
  }

  private calculateSubjectivity(text: string): number {
    // Words indicating subjective vs objective language
    const subjectiveMarkers = ['think', 'believe', 'feel', 'opinion', 'seem', 'appear', 'probably', 'maybe', 'might'];
    const words = this.tokenize(text);

    const subjectiveCount = words.filter(w => subjectiveMarkers.includes(w)).length;
    return Math.min(1, subjectiveCount / 10);
  }

  private calculateQuestionFrequency(sentences: string[]): number {
    if (sentences.length === 0) return 0;
    const questions = sentences.filter(s => s.includes('?')).length;
    return questions / sentences.length;
  }

  private calculateNegationFrequency(words: string[]): number {
    const negations = ['not', "n't", 'no', 'never', 'none', 'nothing', 'neither', 'nobody', 'nowhere'];
    const negationCount = words.filter(w => negations.some(n => w.includes(n))).length;
    return words.length > 0 ? negationCount / words.length : 0;
  }

  private calculateBigramScore(text: string): number {
    const words = this.tokenize(text);
    let maxScore = 0;

    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const score = this.threatBigrams[bigram] || 0;
      maxScore = Math.max(maxScore, score);
    }

    return maxScore;
  }

  private calculateTrigramScore(text: string): number {
    // Pattern-based trigram scoring
    const dangerousPatterns = [
      { pattern: /send\s+\w+\s+money/i, score: 0.9 },
      { pattern: /buy\s+gift\s+cards?/i, score: 0.95 },
      { pattern: /don't\s+tell\s+anyone/i, score: 0.85 },
      { pattern: /keep\s+this\s+confidential/i, score: 0.8 },
      { pattern: /wire\s+\w+\s+immediately/i, score: 0.9 },
      { pattern: /verify\s+your\s+(identity|account)/i, score: 0.6 },
    ];

    let maxScore = 0;
    dangerousPatterns.forEach(({ pattern, score }) => {
      if (pattern.test(text)) {
        maxScore = Math.max(maxScore, score);
      }
    });

    return maxScore;
  }

  private calculateOverallFraudScore(features: {
    authorityScore: number;
    urgencyScore: number;
    threatDensity: number;
    financialScore: number; // NEW
    piiRequestScore: number;
    imperativeFrequency: number;
    bigramThreatScore: number;
    trigramPatternScore: number;
    sentimentPolarity: number;
    questionFrequency: number;
    cyberbullyingScore?: number;
  }): number {
    let score =
      features.authorityScore * 0.15 +
      features.urgencyScore * 0.15 +
      features.threatDensity * 0.2 +
      features.financialScore * 0.4 +
      features.piiRequestScore * 0.3 +
      features.imperativeFrequency * 0.1 +
      features.bigramThreatScore * 0.1 +
      features.trigramPatternScore * 0.1 +
      (features.cyberbullyingScore || 0) * 0.4;

    if ((features.cyberbullyingScore || 0) > 0.4) {
      return Math.max(0.88, (features.cyberbullyingScore || 0));
    }

    // SCAM ZERO-TOLERANCE: If clear financial scam keywords are detected, ensure it hits at least Warning level
    if (features.financialScore > 0.3) {
      score = Math.max(score, features.financialScore);
    }

    // Weighted combination of features
    // --- NEW: Contextual Combination Boost ---
    // Detects when multiple related threat vectors align (e.g., Urgency + Financial + Imperative)
    // This improves accuracy by focusing on the *combination* of behaviors rather than just keywords.
    let contextBoost = 0;

    // Scenario 1: Financial Pressure (Money term + Urgency + Imperative)
    // Updated to use the new financialScore for better accuracy
    if ((features.financialScore > 0.3 || features.piiRequestScore > 0.3) && features.urgencyScore > 0.4 && features.imperativeFrequency > 0.1) {
      contextBoost += 0.35; // Increased boost
      // This catches: "Give me the money right now"
    }

    // Scenario 2: Authority Intimidation (Authority term + Threat + Urgency)
    if (features.authorityScore > 0.3 && features.threatDensity > 0.2 && features.urgencyScore > 0.3) {
      contextBoost += 0.3;
      // This catches: "This is the police, we will arrest you if you don't act"
    }

    // Scenario 3: Tech Support Scam (Imperative + PII/Access + Subjectivity/Confusion)
    if (features.imperativeFrequency > 0.2 && features.piiRequestScore > 0.2 && features.questionFrequency > 0.1) {
      contextBoost += 0.2;
      // This catches: "Click the button. Do you see it? Enter your password now."
    }

    score += contextBoost;

    // Boost if multiple high-risk signals present
    const highRiskCount = [
      features.authorityScore > 0.5,
      features.urgencyScore > 0.5,
      features.piiRequestScore > 0.5,
      features.bigramThreatScore > 0.7,
      (features.cyberbullyingScore || 0) > 0.3, // Cyberbullying is high priority
    ].filter(Boolean).length;

    if (highRiskCount >= 2) {
      score = Math.min(1, score * 1.3);
    }
    if (highRiskCount >= 3) {
      score = Math.min(1, score * 1.2);
    }

    // Cyberbullying detected = automatic high risk
    if ((features.cyberbullyingScore || 0) > 0.5) {
      score = Math.max(score, 0.7);
    }

    return Math.min(1, score);
  }

  // Get feature vector for ML model input
  getFeatureVector(features: TextFeatures): number[] {
    return [
      features.authorityScore,
      features.urgencyScore,
      features.threatDensity,
      features.piiRequestScore,
      features.imperativeFrequency,
      features.sentimentPolarity,
      features.subjectivityScore,
      features.questionFrequency,
      features.negationFrequency,
      features.bigramThreatScore,
      features.trigramPatternScore,
    ];
  }
}

export const textFeatureExtractor = new TextFeatureExtractor();
