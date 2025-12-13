// Fraud Analysis Pipeline - Integrates all audio analysis components

import { ContextTracker, contextTracker, type ConversationState, type TopicShift, type EmotionalState } from './ContextTracker';
import { SpeakerDiarizationEngine, speakerDiarization, type SpeakerProfile, type DiarizationResult } from './SpeakerDiarization';
import { ContextualMetadataFeed, contextualMetadataFeed, type AggregatedMetadata, type FusionLayerInput } from './ContextualMetadataFeed';
import { TextFeatureExtractor, textFeatureExtractor, type TextFeatures } from './TextFeatureExtractor';
import { AudioFeatureExtractor, audioFeatureExtractor, type AudioFeatures } from './AudioFeatureExtractor';

export interface PipelineConfig {
  chunkDuration: number; // seconds
  enableDiarization: boolean;
  enableTextAnalysis: boolean;
  enableAudioFeatures: boolean;
  enableMetadataFeed: boolean;
  fraudThreshold: number;
}

export interface AnalysisResult {
  timestamp: number;
  chunkId: number;
  
  // Individual component results
  textFeatures: TextFeatures | null;
  audioFeatures: AudioFeatures | null;
  speakerInfo: SpeakerProfile | null;
  metadata: AggregatedMetadata | null;
  conversationState: ConversationState | null;
  
  // Fused predictions
  fraudProbability: number;
  riskLevel: 'safe' | 'warning' | 'blocked';
  confidenceScore: number;
  
  // Detected indicators
  fraudIndicators: string[];
  emotionalState: EmotionalState | null;
  topicShift: TopicShift | null;
}

export interface PipelineStats {
  totalChunksProcessed: number;
  averageProcessingTime: number;
  peakFraudProbability: number;
  dominantSpeaker: string | null;
  detectedTopics: string[];
  alertsTriggered: number;
}

type AlertCallback = (result: AnalysisResult) => void;
type ResultCallback = (result: AnalysisResult) => void;

export class FraudAnalysisPipeline {
  private config: PipelineConfig;
  private chunkCounter: number = 0;
  private processingTimes: number[] = [];
  private alertCallbacks: AlertCallback[] = [];
  private resultCallbacks: ResultCallback[] = [];
  private stats: PipelineStats;
  private isActive: boolean = false;
  private lastTopicShift: TopicShift | null = null;
  private lastEmotionalState: EmotionalState | null = null;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      chunkDuration: 2.5,
      enableDiarization: true,
      enableTextAnalysis: true,
      enableAudioFeatures: true,
      enableMetadataFeed: true,
      fraudThreshold: 0.7,
      ...config,
    };

    this.stats = this.initializeStats();
    this.setupEventListeners();
  }

  private initializeStats(): PipelineStats {
    return {
      totalChunksProcessed: 0,
      averageProcessingTime: 0,
      peakFraudProbability: 0,
      dominantSpeaker: null,
      detectedTopics: [],
      alertsTriggered: 0,
    };
  }

  private setupEventListeners(): void {
    contextTracker.onTopicShift((shift) => {
      this.lastTopicShift = shift;
      if (!this.stats.detectedTopics.includes(shift.toTopic)) {
        this.stats.detectedTopics.push(shift.toTopic);
      }
    });

    contextTracker.onEmotionChange((emotion) => {
      this.lastEmotionalState = emotion;
    });

    speakerDiarization.onFraudUpdate((speakerId, probability) => {
      if (probability > this.stats.peakFraudProbability) {
        this.stats.peakFraudProbability = probability;
      }
    });
  }

  // Start the analysis pipeline
  start(): void {
    this.isActive = true;
    this.reset();
    console.log('[FraudPipeline] Started');
  }

  // Stop the analysis pipeline
  stop(): void {
    this.isActive = false;
    console.log('[FraudPipeline] Stopped');
  }

  // Process an audio chunk with optional transcript
  async processChunk(
    audioData: Float32Array | number[],
    transcript?: string
  ): Promise<AnalysisResult> {
    if (!this.isActive) {
      throw new Error('Pipeline is not active. Call start() first.');
    }

    const startTime = performance.now();
    const timestamp = Date.now();
    const chunkId = this.chunkCounter++;

    // Initialize result
    let textFeatures: TextFeatures | null = null;
    let audioFeatures: AudioFeatures | null = null;
    let speakerInfo: SpeakerProfile | null = null;
    let metadata: AggregatedMetadata | null = null;
    let conversationState: ConversationState | null = null;

    // 1. Extract audio features
    if (this.config.enableAudioFeatures) {
      const data = audioData instanceof Float32Array 
        ? audioData 
        : new Float32Array(audioData);
      audioFeatures = audioFeatureExtractor.extract(data);
    }

    // 2. Process through metadata feed
    if (this.config.enableMetadataFeed && audioFeatures) {
      const data = audioData instanceof Float32Array 
        ? audioData 
        : new Float32Array(audioData);
      contextualMetadataFeed.processAudioChunk(data);
      metadata = contextualMetadataFeed.getAggregatedMetadata();
    }

    // 3. Speaker diarization
    if (this.config.enableDiarization) {
      const data = audioData instanceof Float32Array 
        ? audioData 
        : new Float32Array(audioData);
      const segment = speakerDiarization.processSegment({
        audioData: data,
        startTime: (chunkId * this.config.chunkDuration),
        endTime: ((chunkId + 1) * this.config.chunkDuration),
        transcript,
      });
      speakerInfo = speakerDiarization.getSpeaker(segment.speakerId) || null;
    }

    // 4. Text feature extraction
    if (this.config.enableTextAnalysis && transcript) {
      textFeatures = textFeatureExtractor.extract(transcript);
    }

    // 5. Update context tracker
    contextTracker.processChunk({
      transcript,
      duration: this.config.chunkDuration,
      speakerId: speakerInfo?.id,
      audioFeatures: audioFeatures ? {
        pitchVariance: audioFeatures.pitchVariance,
        energyLevel: audioFeatures.energyMean,
        speechRate: audioFeatures.speechRate,
        voiceStress: audioFeatures.voiceStress,
      } : undefined,
    });
    conversationState = contextTracker.getState();

    // 6. Fusion layer - combine all signals for fraud prediction
    const fusionResult = this.fuseSignals(
      textFeatures,
      audioFeatures,
      metadata,
      speakerInfo
    );

    // 7. Apply contextual weighting
    const finalProbability = metadata
      ? contextualMetadataFeed.applyContextualWeighting(
          fusionResult.probability,
          contextualMetadataFeed.prepareFusionInput(
            textFeatures ? textFeatureExtractor.getFeatureVector(textFeatures).reduce((acc, v, i) => ({ ...acc, [`f${i}`]: v }), {}) : {},
            audioFeatures ? audioFeatureExtractor.getFeatureVector(audioFeatures).reduce((acc, v, i) => ({ ...acc, [`f${i}`]: v }), {}) : {},
            {
              speakerId: speakerInfo?.id || null,
              turnCount: conversationState?.turnCount || 0,
              speakingDuration: speakerInfo?.totalSpeakingTime || 0,
            }
          )
        )
      : fusionResult.probability;

    // 8. Determine risk level
    const riskLevel = this.determineRiskLevel(finalProbability);

    // 9. Collect fraud indicators
    const fraudIndicators = this.collectFraudIndicators(
      textFeatures,
      audioFeatures,
      speakerInfo,
      metadata
    );

    // Calculate processing time
    const processingTime = performance.now() - startTime;
    this.updateProcessingStats(processingTime, finalProbability);

    // Build result
    const result: AnalysisResult = {
      timestamp,
      chunkId,
      textFeatures,
      audioFeatures,
      speakerInfo,
      metadata,
      conversationState,
      fraudProbability: finalProbability,
      riskLevel,
      confidenceScore: fusionResult.confidence,
      fraudIndicators,
      emotionalState: this.lastEmotionalState,
      topicShift: this.lastTopicShift,
    };

    // Clear last topic shift after including in result
    if (this.lastTopicShift) {
      this.lastTopicShift = null;
    }

    // Notify callbacks
    this.resultCallbacks.forEach(cb => cb(result));

    // Check for alerts
    if (finalProbability >= this.config.fraudThreshold) {
      this.stats.alertsTriggered++;
      this.alertCallbacks.forEach(cb => cb(result));
    }

    return result;
  }

  private fuseSignals(
    textFeatures: TextFeatures | null,
    audioFeatures: AudioFeatures | null,
    metadata: AggregatedMetadata | null,
    speakerInfo: SpeakerProfile | null
  ): { probability: number; confidence: number } {
    const weights = {
      text: 0.35,
      audio: 0.25,
      speaker: 0.2,
      context: 0.2,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    let confidenceSum = 0;

    // Text-based fraud score
    if (textFeatures) {
      weightedSum += textFeatures.textFraudScore * weights.text;
      totalWeight += weights.text;
      confidenceSum += 0.9; // High confidence in text analysis
    }

    // Audio-based stress and anomaly score
    if (audioFeatures) {
      const audioScore = (
        audioFeatures.overallStressScore * 0.4 +
        audioFeatures.voiceStress * 0.3 +
        (audioFeatures.speechRate > 0.7 ? 0.2 : 0) +
        (audioFeatures.energySpikes > 0.5 ? 0.1 : 0)
      );
      weightedSum += audioScore * weights.audio;
      totalWeight += weights.audio;
      confidenceSum += audioFeatures.audioQualityScore;
    }

    // Speaker-based fraud probability
    if (speakerInfo) {
      weightedSum += speakerInfo.fraudProbability * weights.speaker;
      totalWeight += weights.speaker;
      confidenceSum += speakerInfo.avgConfidence;
    }

    // Context-based adjustments
    if (metadata) {
      const contextScore = (
        (metadata.stressMarkers.length > 0 ? 0.2 : 0) +
        (metadata.backgroundNoiseLevel > 0.5 ? 0.1 : 0) +
        (1 - metadata.confidenceScore) * 0.1
      );
      weightedSum += contextScore * weights.context;
      totalWeight += weights.context;
      confidenceSum += metadata.qualityIndicators.audioIntegrity;
    }

    const probability = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = confidenceSum / 4; // Average confidence

    return { probability: Math.min(1, probability), confidence };
  }

  private determineRiskLevel(probability: number): 'safe' | 'warning' | 'blocked' {
    if (probability >= 0.8) return 'blocked';
    if (probability >= 0.5) return 'warning';
    return 'safe';
  }

  private collectFraudIndicators(
    textFeatures: TextFeatures | null,
    audioFeatures: AudioFeatures | null,
    speakerInfo: SpeakerProfile | null,
    metadata: AggregatedMetadata | null
  ): string[] {
    const indicators: string[] = [];

    if (textFeatures) {
      if (textFeatures.authorityScore > 0.5) {
        indicators.push('authority_impersonation');
        textFeatures.authorityPhrases.forEach(p => indicators.push(`phrase: ${p}`));
      }
      if (textFeatures.urgencyScore > 0.5) indicators.push('high_urgency');
      if (textFeatures.piiRequestScore > 0.5) {
        indicators.push('pii_solicitation');
        textFeatures.piiTypes.forEach(t => indicators.push(`pii_type: ${t}`));
      }
      if (textFeatures.threatDensity > 0.3) indicators.push('threat_language');
      if (textFeatures.bigramThreatScore > 0.7) indicators.push('dangerous_phrases');
    }

    if (audioFeatures) {
      if (audioFeatures.voiceStress > 0.7) indicators.push('high_voice_stress');
      if (audioFeatures.speechRate > 0.8) indicators.push('rapid_speech');
      if (audioFeatures.energySpikes > 0.6) indicators.push('aggressive_tone');
      if (audioFeatures.backgroundNoiseType === 'call_center') indicators.push('call_center_background');
    }

    if (speakerInfo && speakerInfo.fraudProbability > 0.6) {
      indicators.push(`high_risk_speaker:${speakerInfo.id}`);
    }

    if (metadata) {
      if (metadata.stressMarkers.length > 3) indicators.push('multiple_stress_markers');
      if (metadata.qualityIndicators.clippingDetected) indicators.push('audio_manipulation');
    }

    return [...new Set(indicators)];
  }

  private updateProcessingStats(processingTime: number, fraudProbability: number): void {
    this.stats.totalChunksProcessed++;
    this.processingTimes.push(processingTime);
    
    // Keep only last 100 times
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
    
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    if (fraudProbability > this.stats.peakFraudProbability) {
      this.stats.peakFraudProbability = fraudProbability;
    }

    // Update dominant speaker
    const speakers = speakerDiarization.getAllSpeakers();
    if (speakers.length > 0) {
      const dominant = speakers.reduce((a, b) => 
        a.totalSpeakingTime > b.totalSpeakingTime ? a : b
      );
      this.stats.dominantSpeaker = dominant.id;
    }
  }

  // Event listeners
  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  onResult(callback: ResultCallback): void {
    this.resultCallbacks.push(callback);
  }

  // Getters
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  getDiarizationResult(): DiarizationResult {
    return speakerDiarization.getResult();
  }

  getConversationState(): ConversationState {
    return contextTracker.getState();
  }

  getEmotionalTrend(): 'escalating' | 'de-escalating' | 'stable' {
    return contextTracker.getEmotionalTrend();
  }

  isRunning(): boolean {
    return this.isActive;
  }

  // Reset all components
  reset(): void {
    this.chunkCounter = 0;
    this.processingTimes = [];
    this.stats = this.initializeStats();
    this.lastTopicShift = null;
    this.lastEmotionalState = null;
    
    contextTracker.reset();
    speakerDiarization.reset();
    contextualMetadataFeed.reset();
  }
}

// Export singleton instance
export const fraudAnalysisPipeline = new FraudAnalysisPipeline();
