import { pipeline, env } from '@xenova/transformers';
import { textFeatureExtractor } from '@/utils/audio/TextFeatureExtractor';

// Configuration for local transformers
env.allowLocalModels = false;
env.useBrowserCache = true;

let classifier: any = null;

export const analyzeTextWithML = async (text: string, onProgress?: (progress: any) => void) => {
  try {
    // 1. Perform Heuristic Deep Scan (High Accuracy for known slurs/abuse)
    const heuristicResult = textFeatureExtractor.extract(text);
    const hasHighAbuse = heuristicResult.cyberbullyingScore > 0.4;

    if (!classifier) {
      // Use a lightweight model for zero-shot classification
      classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall', {
        progress_callback: onProgress
      });
    }

    const labels = [
      'safe conversation',
      'personal insult or harassment',
      'aggressive threat',
      'hate speech',
      'request for money or payment',
      'request for personal identity details',
      'financial coercion or pressure',
      'tech support scam'
    ];

    const result = await classifier(text, labels);
    
    // Process results
    const topLabel = result.labels[0];
    const topScore = result.scores[0];
    
    // --- ADVANCED HYBRID LOGIC ---
    // 1. Detect Harassment
    const isCyberbullying = 
      hasHighAbuse || 
      (['personal insult or harassment', 'aggressive threat', 'hate speech'].includes(topLabel) && topScore > 0.5);

    // 2. Detect Specific Fraud Vectors (Money/PII)
    const moneyRequestIndex = result.labels.indexOf('request for money or payment');
    const piiRequestIndex = result.labels.indexOf('request for personal identity details');
    const hasCriticalFraudSignal = 
      (moneyRequestIndex !== -1 && result.scores[moneyRequestIndex] > 0.4) ||
      (piiRequestIndex !== -1 && result.scores[piiRequestIndex] > 0.4);

    const isScam = !isCyberbullying && (topLabel !== 'safe conversation' || hasCriticalFraudSignal) && (topScore > 0.35 || hasCriticalFraudSignal);
    
    const indicators = [...new Set([
      ...(isCyberbullying ? heuristicResult.threatPhrases.slice(0, 3) : []),
      ...result.labels.slice(0, 3).filter((_: any, i: number) => result.scores[i] > 0.3)
    ])];

    // Final score is a weighted fusion of ML and Heuristics
    // If critical signals are found, we boost the score significantly
    let finalScore = Math.max(Math.round(topScore * 100), Math.round(heuristicResult.textFraudScore * 100));
    
    if (hasCriticalFraudSignal) {
      finalScore = Math.max(finalScore, 75); // Ensure critical signals hit warning/danger levels
    }

    return {
      isCyberbullying,
      isScam,
      threatLevel: isCyberbullying || finalScore > 75 ? 'danger' : finalScore > 45 ? 'warning' : 'safe',
      score: finalScore,
      indicators: indicators.map((l: string) => l.replace(/ /g, '_')),
      categories: indicators
    };
  } catch (error) {
    console.error('ML Analysis Error:', error);
    // Fallback to purely heuristic if ML fails
    const hResult = textFeatureExtractor.extract(text);
    return {
      isCyberbullying: hResult.cyberbullyingScore > 0.3,
      isScam: hResult.textFraudScore > 0.5,
      threatLevel: hResult.textFraudScore > 0.7 ? 'danger' : 'safe',
      score: Math.round(hResult.textFraudScore * 100),
      indicators: hResult.threatPhrases.slice(0, 3),
      categories: hResult.threatPhrases.slice(0, 2)
    };
  }
};
