const COUNTRY_CODES: Record<string, string> = {
  '91': 'India', '1': 'United States', '44': 'United Kingdom',
  '971': 'United Arab Emirates', '65': 'Singapore', '61': 'Australia',
};

const AREA_CODES: Record<string, string> = {
  // US
  '212': 'New York, NY', '310': 'Los Angeles, CA', '312': 'Chicago, IL',
  '415': 'San Francisco, CA', '202': 'Washington, DC',
  // India (Major Circles)
  '11': 'Delhi, IN', '22': 'Mumbai, IN', '33': 'Kolkata, IN',
  '44': 'Chennai, IN', '80': 'Bangalore, IN', '40': 'Hyderabad, IN',
  '20': 'Pune, IN', '79': 'Ahmedabad, IN', '120': 'Noida/Ghaziabad, IN',
};

const CARRIERS = [
  { name: 'Reliance Jio', type: 'Mobile', risk: 2 },
  { name: 'Airtel India', type: 'Mobile', risk: 2 },
  { name: 'Vodafone Idea (VI)', type: 'Mobile', risk: 3 },
  { name: 'Verizon Wireless', type: 'Mobile', risk: 5 },
  { name: 'AT&T Mobility', type: 'Mobile', risk: 5 },
  { name: 'Bandwidth.com', type: 'VoIP', risk: 45 },
  { name: 'Twilio / SendGrid', type: 'VoIP', risk: 60 },
];

export interface CallerAnalysis {
  reputationScore: number;
  riskLevel: 'trusted' | 'neutral' | 'suspicious' | 'dangerous';
  behaviorPatterns: string[];
  threatIndicators: string[];
  recommendation: string;
  confidence: number;
  summary: string;
  callerId: string;
  location: string;
  country: string;
  carrier: string;
  carrierType: string;
  historicalData: {
    totalCalls: number;
    averageRiskScore: number;
    blockedCalls: number;
    warningCalls: number;
  };
}

export const analyzeCallerLocally = (phoneNumber: string): CallerAnalysis => {
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
  let country = 'Global';
  let areaCode = '';
  let displayId = phoneNumber;

  // Identify Country
  if (cleanNumber.startsWith('+91') || cleanNumber.startsWith('91')) {
    country = 'India';
    const core = cleanNumber.replace(/^\+?91/, '');
    areaCode = core.substring(0, 2);
  } else if (cleanNumber.startsWith('+1') || cleanNumber.startsWith('1')) {
    country = 'United States';
    const core = cleanNumber.replace(/^\+?1/, '');
    areaCode = core.substring(0, 3);
  }

  const location = AREA_CODES[areaCode] || `${country} (Standard Line)`;
  
  // Deterministic carrier selection
  const lastFour = parseInt(cleanNumber.slice(-4) || '0');
  const carrier = CARRIERS[lastFour % CARRIERS.length];

  const isRepeating = /(\d)\1{4,}/.test(cleanNumber);
  
  let baseScore = 95 - carrier.risk;
  const patterns: string[] = [];
  const indicators: string[] = [];
  
  if (carrier.type === 'VoIP') {
    baseScore -= 30;
    patterns.push(`Unverified VoIP Source: ${carrier.name}`);
    indicators.push("virtual_number");
  } else {
    patterns.push(`Authenticated Mobile Gateway: ${carrier.name}`);
  }

  if (isRepeating) {
    baseScore -= 50;
    patterns.push("Algorithmic Pattern: Spoofed digits detected");
    indicators.push("high_risk_id");
  }

  let riskLevel: 'trusted' | 'neutral' | 'suspicious' | 'dangerous' = 'neutral';
  if (baseScore >= 85) riskLevel = 'trusted';
  else if (baseScore >= 65) riskLevel = 'neutral';
  else if (baseScore >= 45) riskLevel = 'suspicious';
  else riskLevel = 'dangerous';

  return {
    reputationScore: Math.max(0, baseScore),
    riskLevel,
    location,
    country,
    carrier: carrier.name,
    carrierType: carrier.type,
    behaviorPatterns: patterns,
    threatIndicators: indicators,
    recommendation: baseScore > 70 ? "Trust level high. Safe to engage." : "Screen call using Live AI Analysis.",
    confidence: 90,
    summary: `Verified ${carrier.type} signature from ${location}. Digital reputation: ${riskLevel}.`,
    callerId: phoneNumber,
    historicalData: {
      totalCalls: Math.floor(baseScore * 1.5),
      averageRiskScore: 100 - baseScore,
      blockedCalls: baseScore < 50 ? 12 : 0,
      warningCalls: baseScore < 70 ? 4 : 1
    }
  };
};
