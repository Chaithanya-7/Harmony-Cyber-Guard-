// Hook combining microphone input with fraud analysis pipeline

import { useState, useCallback, useRef } from 'react';
import { useMicrophone, type AudioChunk } from './useMicrophone';
import { useAudioAnalysis, type AudioAnalysisState } from './useAudioAnalysis';
import type { AnalysisResult } from '@/utils/audio/FraudAnalysisPipeline';

export interface LiveAnalysisConfig {
  fraudThreshold?: number;
  enableDiarization?: boolean;
  onAlert?: (result: AnalysisResult) => void;
  onChunkProcessed?: (result: AnalysisResult) => void;
}

export interface LiveAnalysisState extends AudioAnalysisState {
  isRecording: boolean;
  isPermissionGranted: boolean | null;
  microphoneError: string | null;
  audioLevel: number;
  chunksProcessed: number;
  averageLatency: number;
}

export function useLiveAnalysis(config: LiveAnalysisConfig = {}) {
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [latencies, setLatencies] = useState<number[]>([]);
  const transcriptRef = useRef<string>('');

  // Initialize microphone
  const microphone = useMicrophone({
    sampleRate: 24000,
    chunkDuration: 2.5,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });

  // Initialize analysis pipeline
  const analysis = useAudioAnalysis({
    fraudThreshold: config.fraudThreshold,
    enableDiarization: config.enableDiarization,
    onAlert: config.onAlert,
  });

  // Handle incoming audio chunks
  const handleAudioChunk = useCallback(async (chunk: AudioChunk) => {
    const startTime = performance.now();
    
    // Process through pipeline
    // Note: In a real implementation, you'd also run speech-to-text here
    // For now, we'll process audio features without transcript
    const result = await analysis.processChunk(chunk.data, transcriptRef.current || undefined);
    
    if (result) {
      const latency = performance.now() - startTime;
      setLatencies(prev => [...prev.slice(-49), latency]);
      setChunksProcessed(prev => prev + 1);
      
      if (config.onChunkProcessed) {
        config.onChunkProcessed(result);
      }
    }
  }, [analysis, config]);

  // Start live analysis
  const start = useCallback(async () => {
    // Start the analysis pipeline
    analysis.start();
    
    // Start microphone recording
    await microphone.startRecording(handleAudioChunk);
  }, [analysis, microphone, handleAudioChunk]);

  // Stop live analysis
  const stop = useCallback(() => {
    microphone.stopRecording();
    analysis.stop();
  }, [microphone, analysis]);

  // Reset everything
  const reset = useCallback(() => {
    microphone.stopRecording();
    analysis.reset();
    setChunksProcessed(0);
    setLatencies([]);
    transcriptRef.current = '';
  }, [microphone, analysis]);

  // Update transcript (for integration with speech-to-text)
  const updateTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
  }, []);

  // Calculate average latency
  const averageLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;

  return {
    // State
    ...analysis,
    isRecording: microphone.isRecording,
    isPermissionGranted: microphone.isPermissionGranted,
    microphoneError: microphone.error,
    audioLevel: microphone.audioLevel,
    chunksProcessed,
    averageLatency,
    
    // Actions
    start,
    stop,
    reset,
    updateTranscript,
    requestPermission: microphone.requestPermission,
  };
}
