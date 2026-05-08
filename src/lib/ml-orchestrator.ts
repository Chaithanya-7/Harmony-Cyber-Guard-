import { MLResponse, RiskLevel } from '../types/ml';
import { textFeatureExtractor } from '../utils/audio/TextFeatureExtractor';
import { analyzeCallerLocally } from '../utils/CallerAnalyzer';
import { supabase } from '../integrations/supabase/client';

class MLOrchestrator {
  private static instance: MLOrchestrator;

  private constructor() {}

  public static getInstance(): MLOrchestrator {
    if (!MLOrchestrator.instance) {
      MLOrchestrator.instance = new MLOrchestrator();
    }
    return MLOrchestrator.instance;
  }

  /**
   * Main entry point for Live Call Analysis
   */
  async analyzeLiveCall(transcript: string, audioData?: Float32Array): Promise<MLResponse> {
    const startTime = Date.now();

    try {
      let audioBase64 = null;
      if (audioData) {
        // Convert Float32Array to Base64 for transport
        const buffer = audioData.buffer;
        audioBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer) as any));
      }

      // 1. Call Supabase Edge Function (Deep Path)
      const { data, error } = await supabase.functions.invoke('analyze-call', {
        body: { 
          transcript, 
          audioBase64 
        }
      });

      if (error || !data) throw error;

      return {
        ...data,
        processingTimeMs: Date.now() - startTime,
        isHeuristicFallback: false
      };
    } catch (err) {
      console.warn('[MLOrchestrator] Backend ML failed, falling back to heuristics:', err);
      return this.runHeuristicFallback(transcript, startTime);
    }
  }

  /**
   * Main entry point for Caller Analysis
   */
  async analyzeCaller(phoneNumber: string, metadata: any): Promise<MLResponse> {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('analyze-caller', {
        body: { callerId: phoneNumber, metadata }
      });
      if (error || !data) throw error;
      return { ...data, processingTimeMs: Date.now() - startTime, isHeuristicFallback: false };
    } catch (err) {
      return this.runCallerHeuristicFallback(phoneNumber, startTime);
    }
  }

  /**
   * Fallback logic using local TextFeatureExtractor
   */
  private runHeuristicFallback(text: string, startTime: number): MLResponse {
    const features = textFeatureExtractor.extract(text);
    const riskScore = Math.round(features.textFraudScore * 100);
    
    return {
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      confidence: 0.6, // Heuristics have fixed lower confidence
      signals: features.threatPhrases.map(phrase => ({
        id: 'heuristic_match',
        label: phrase,
        probability: 0.8
      })),
      categories: this.deriveCategories(features),
      explanation: "Analysis performed using local behavioral heuristics.",
      recommendedAction: riskScore > 70 ? "Caution advised. High risk patterns detected." : "No immediate threat detected.",
      isHeuristicFallback: true,
      processingTimeMs: Date.now() - startTime
    };
  }

  private runCallerHeuristicFallback(phoneNumber: string, startTime: number): MLResponse {
    const localAnalysis = analyzeCallerLocally(phoneNumber);
    const riskScore = Math.max(0, Math.min(100, 100 - localAnalysis.reputationScore));

    return {
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      confidence: localAnalysis.confidence / 100,
      signals: localAnalysis.threatIndicators.map((label) => ({
        id: 'caller_heuristic',
        label,
        probability: 0.75,
      })),
      categories: ['caller_risk'],
      explanation: localAnalysis.summary,
      recommendedAction: localAnalysis.recommendation,
      isHeuristicFallback: true,
      processingTimeMs: Date.now() - startTime
    };
  }

  private getRiskLevel(score: number): RiskLevel {
    if (score > 85) return 'critical';
    if (score > 70) return 'danger';
    if (score > 40) return 'warning';
    if (score > 15) return 'low';
    return 'safe';
  }

  private deriveCategories(features: any): string[] {
    const cats: string[] = [];
    if (features.authorityScore > 0.4) cats.push('impersonation');
    if (features.piiRequestScore > 0.4) cats.push('pii_request');
    if (features.financialScore > 0.4) cats.push('fraud');
    if (features.cyberbullyingScore > 0.4) cats.push('harassment');
    return cats;
  }
}

export const mlOrchestrator = MLOrchestrator.getInstance();
