export type RiskLevel = 'safe' | 'low' | 'warning' | 'danger' | 'critical';

export interface MLSignal {
  id: string;
  label: string;
  probability: number;
  metadata?: Record<string, any>;
}

export interface MLResponse {
  riskScore: number;       // 0-100
  riskLevel: RiskLevel;
  confidence: number;     // 0-1
  signals: MLSignal[];
  categories: string[];   // ['scam', 'fraud', 'harassment', 'threat', 'pii_request']
  explanation: string;
  recommendedAction: string;
  isHeuristicFallback: boolean;
  processingTimeMs: number;
}

export interface LiveAnalysisPayload {
  transcript: string;
  audioFeatures?: any;
  speakerId?: string;
  callMetadata?: any;
}

export interface CallerMLRequest {
  phoneNumber: string;
  metadata: {
    carrier?: string;
    type?: string;
    location?: string;
    callHistory?: any[];
  };
}

export interface TextCheckRequest {
  text: string;
  context?: 'sms' | 'chat' | 'email';
}
