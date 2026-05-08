// Hook combining microphone input with fraud analysis pipeline

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMicrophone, type AudioChunk } from './useMicrophone';
import { useAudioAnalysis, type AudioAnalysisState } from './useAudioAnalysis';
import type { AnalysisResult } from '@/utils/audio/FraudAnalysisPipeline';
import { mlOrchestrator } from '@/lib/ml-orchestrator';
import { MLResponse } from '@/types/ml';

export interface LiveAnalysisConfig {
  fraudThreshold?: number;
  enableDiarization?: boolean;
  onAlert?: (result: AnalysisResult) => void;
  onChunkProcessed?: (result: AnalysisResult) => void;
  onResult?: (result: AnalysisResult) => void;
  onRawAudioChunk?: (audioData: Float32Array) => void;
}

export interface LiveAnalysisState extends AudioAnalysisState {
  isRecording: boolean;
  isPermissionGranted: boolean | null;
  microphoneError: string | null;
  audioLevel: number;
  chunksProcessed: number;
  averageLatency: number;
  behavioralProfile: any | null;
  mlResult: MLResponse | null;
}

export function useLiveAnalysis(config: LiveAnalysisConfig = {}) {
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [transcriptState, setTranscriptState] = useState<string>('');
  const [mlResult, setMlResult] = useState<MLResponse | null>(null);
  const transcriptRef = useRef<string>('');
  const audioBufferRef = useRef<Float32Array>(new Float32Array(0));
  const configRef = useRef(config);

  // Keep config ref updated
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Initialize microphone
  const microphone = useMicrophone({
    sampleRate: 16000, // Updated to 16kHz for Whisper compatibility
    chunkDuration: 0.5, // REDUCED for near-instant realism
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
    if (configRef.current.onRawAudioChunk) {
      configRef.current.onRawAudioChunk(chunk.data);
    }

    // Append to buffer and keep last 5 seconds (5 * 16000 samples)
    const newBuffer = new Float32Array(audioBufferRef.current.length + chunk.data.length);
    newBuffer.set(audioBufferRef.current);
    newBuffer.set(chunk.data, audioBufferRef.current.length);
    audioBufferRef.current = newBuffer.slice(-80000); 
    
    const result = await analysis.processChunk(chunk.data, transcriptRef.current || undefined);
    
    // Process UI Updates
    if (result) {
      const latency = performance.now() - startTime;
      setLatencies(prev => [...prev.slice(-49), latency]);
      setChunksProcessed(prev => prev + 1);
      
      if (configRef.current.onChunkProcessed) {
        configRef.current.onChunkProcessed(result);
      }
      if (configRef.current.onResult) {
        configRef.current.onResult(result);
      }
    }
  }, [analysis]);

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
  const updateTranscript = useCallback(async (text: string) => {
    transcriptRef.current = text;
    setTranscriptState(text);
    
    if (text && analysis.isActive) {
      // 1. Run quick local heuristic analysis
      const bufferToUse = audioBufferRef.current.length > 0 
        ? audioBufferRef.current 
        : new Float32Array(24000); // Pass a clean 1-second silence buffer if empty to avoid crashes
        
      analysis.processChunk(bufferToUse, text).then(result => {
        if (result && configRef.current.onResult) {
          configRef.current.onResult(result);
        }
      });

      // 2. Run deep ML analysis via Orchestrator
      try {
        const result = await mlOrchestrator.analyzeLiveCall(text, audioBufferRef.current);
        setMlResult(result);
      } catch (err) {
        console.error('Deep ML analysis failed:', err);
      }
    }
  }, [analysis]);

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
    transcript: transcriptState,
    mlResult,
    
    // Actions
    start,
    stop,
    reset,
    updateTranscript,
    requestPermission: microphone.requestPermission,
  };
}
