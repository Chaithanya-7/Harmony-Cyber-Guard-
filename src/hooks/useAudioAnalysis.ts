// Hook for integrating the fraud analysis pipeline with React components

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FraudAnalysisPipeline, 
  type AnalysisResult, 
  type PipelineStats 
} from '@/utils/audio/FraudAnalysisPipeline';
import { type ConversationState } from '@/utils/audio/ContextTracker';
import { type SpeakerProfile } from '@/utils/audio/SpeakerDiarization';
import { type AggregatedMetadata } from '@/utils/audio/ContextualMetadataFeed';

export interface UseAudioAnalysisOptions {
  fraudThreshold?: number;
  enableDiarization?: boolean;
  onAlert?: (result: AnalysisResult) => void;
}

export interface AudioAnalysisState {
  isActive: boolean;
  currentResult: AnalysisResult | null;
  stats: PipelineStats;
  conversationState: ConversationState | null;
  speakers: SpeakerProfile[];
  metadata: AggregatedMetadata | null;
  emotionalTrend: 'escalating' | 'de-escalating' | 'stable';
}

export function useAudioAnalysis(options: UseAudioAnalysisOptions = {}) {
  const pipelineRef = useRef<FraudAnalysisPipeline | null>(null);
  const [state, setState] = useState<AudioAnalysisState>({
    isActive: false,
    currentResult: null,
    stats: {
      totalChunksProcessed: 0,
      averageProcessingTime: 0,
      peakFraudProbability: 0,
      dominantSpeaker: null,
      detectedTopics: [],
      alertsTriggered: 0,
    },
    conversationState: null,
    speakers: [],
    metadata: null,
    emotionalTrend: 'stable',
  });

  // Initialize pipeline
  useEffect(() => {
    pipelineRef.current = new FraudAnalysisPipeline({
      fraudThreshold: options.fraudThreshold ?? 0.7,
      enableDiarization: options.enableDiarization ?? true,
    });

    // Set up result callback
    pipelineRef.current.onResult((result) => {
      const diarizationResult = pipelineRef.current?.getDiarizationResult();
      const conversationState = pipelineRef.current?.getConversationState();
      const emotionalTrend = pipelineRef.current?.getEmotionalTrend() || 'stable';

      setState(prev => ({
        ...prev,
        currentResult: result,
        stats: pipelineRef.current?.getStats() || prev.stats,
        conversationState: conversationState || null,
        speakers: diarizationResult ? Array.from(diarizationResult.speakers.values()) : [],
        metadata: result.metadata,
        emotionalTrend,
      }));
    });

    // Set up alert callback
    if (options.onAlert) {
      pipelineRef.current.onAlert(options.onAlert);
    }

    return () => {
      if (pipelineRef.current?.isRunning()) {
        pipelineRef.current.stop();
      }
    };
  }, [options.fraudThreshold, options.enableDiarization, options.onAlert]);

  // Start analysis
  const start = useCallback(() => {
    if (pipelineRef.current) {
      pipelineRef.current.start();
      setState(prev => ({ ...prev, isActive: true }));
    }
  }, []);

  // Stop analysis
  const stop = useCallback(() => {
    if (pipelineRef.current) {
      pipelineRef.current.stop();
      setState(prev => ({ ...prev, isActive: false }));
    }
  }, []);

  // Process audio chunk
  const processChunk = useCallback(async (
    audioData: Float32Array | number[],
    transcript?: string
  ): Promise<AnalysisResult | null> => {
    if (!pipelineRef.current?.isRunning()) {
      console.warn('Pipeline is not running');
      return null;
    }

    try {
      return await pipelineRef.current.processChunk(audioData, transcript);
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      return null;
    }
  }, []);

  // Reset analysis
  const reset = useCallback(() => {
    if (pipelineRef.current) {
      pipelineRef.current.reset();
      setState({
        isActive: pipelineRef.current.isRunning(),
        currentResult: null,
        stats: {
          totalChunksProcessed: 0,
          averageProcessingTime: 0,
          peakFraudProbability: 0,
          dominantSpeaker: null,
          detectedTopics: [],
          alertsTriggered: 0,
        },
        conversationState: null,
        speakers: [],
        metadata: null,
        emotionalTrend: 'stable',
      });
    }
  }, []);

  // Generate simulated audio data for testing
  const generateSimulatedAudio = useCallback((durationSeconds: number = 2.5): Float32Array => {
    const sampleRate = 24000;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const audioData = new Float32Array(numSamples);

    // Generate realistic-ish audio waveform
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      // Mix of speech-like frequencies with some noise
      audioData[i] = 
        0.3 * Math.sin(2 * Math.PI * 150 * t) +  // Fundamental
        0.15 * Math.sin(2 * Math.PI * 300 * t) + // 2nd harmonic
        0.1 * Math.sin(2 * Math.PI * 450 * t) +  // 3rd harmonic
        0.05 * (Math.random() - 0.5);             // Noise
    }

    return audioData;
  }, []);

  return {
    ...state,
    start,
    stop,
    reset,
    processChunk,
    generateSimulatedAudio,
    pipeline: pipelineRef.current,
  };
}
