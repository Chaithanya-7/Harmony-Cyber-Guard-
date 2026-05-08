// Hook for real-time speech-to-text transcription

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { textFeatureExtractor } from '@/utils/audio/TextFeatureExtractor';
import { analyzeTextWithML } from '@/lib/ml';

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments: TranscriptionSegment[];
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface UseTranscriptionOptions {
  onTranscript?: (result: TranscriptionResult) => void;
  onPartialTranscript?: (text: string) => void;
  language?: string;
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  const accumulatedTranscriptRef = useRef<string>('');
  const accumulatedSegmentsRef = useRef<TranscriptionSegment[]>([]);
  const optionsRef = useRef(options);
  
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const recognitionRef = useRef<any>(null); // Web Speech API

  // --- Whisper Web Worker (Offline Real-time AI Transcription) ---
  const processAudioChunk = useCallback((audioData: Float32Array) => {
    if (!whisperWorkerRef.current || !isTranscribing) return;
    
    // Send to web worker for transcription
    whisperWorkerRef.current.postMessage({
      type: 'transcribe',
      audioData: audioData
    });
  }, [isTranscribing]);

  const startStreaming = useCallback(() => {
    setIsTranscribing(true);
    console.log('[Transcription] Started Web Worker Streaming');
  }, []);

  const stopStreaming = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
  }, []);

  // --- Web Worker for Advanced Whisper AI Transcription ---
  const whisperWorkerRef = useRef<Worker | null>(null);
  
  useEffect(() => {
    // Initialize Web Worker for Whisper
    if (typeof window !== 'undefined') {
      try {
        whisperWorkerRef.current = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), {
          type: 'module'
        });
        
        whisperWorkerRef.current.onmessage = (e) => {
          const { type, text, error, progress } = e.data;
          
          if (type === 'progress') {
            setIsModelLoading(true);
            if (progress.status === 'progress') {
              setModelProgress(progress.progress);
            }
          }
          
          if (type === 'ready') {
            setIsModelLoading(false);
            setModelProgress(100);
            console.log('[Whisper Local] AI Model Ready');
          }

          if (type === 'result' && text) {
             const cleanedText = text.trim();
             if (cleanedText) {
                // Determine if we should add a period or just a space
                const isShort = cleanedText.split(' ').length < 3;
                const shouldAddPeriod = !/[.!?]$/.test(cleanedText) && !isShort;
                const formattedText = cleanedText + (shouldAddPeriod ? '.' : '');

                accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + formattedText;
                setTranscript(accumulatedTranscriptRef.current);
                
                const newSegment = {
                  text: formattedText,
                  start: Date.now() / 1000,
                  end: Date.now() / 1000 + 1,
                  confidence: 0.9
                };
                accumulatedSegmentsRef.current.push(newSegment);
                setSegments([...accumulatedSegmentsRef.current]);

                if (optionsRef.current.onTranscript) {
                  optionsRef.current.onTranscript({
                    text: cleanedText,
                    segments: [newSegment]
                  });
                }
             }
          }
          if (type === 'error') {
            console.error('[Whisper Local] Error:', error);
            setError(error);
            setIsModelLoading(false);
          }
        };
        
        // Load the model in background
        whisperWorkerRef.current.postMessage({ type: 'load' });
      } catch (err) {
        console.warn("Failed to initialize Whisper Web Worker:", err);
      }
    }
    
    return () => {
      whisperWorkerRef.current?.terminate();
    };
  }, []);

  // --- Backend Transcription (Legacy/Fallback) ---
  const transcribeAudio = useCallback(async (
    audioBlob: Blob | string
  ): Promise<TranscriptionResult | null> => {
    // If we are streaming locally, skip backend
    if (recognitionRef.current) return null;

    setError(null);
    setIsTranscribing(true);
    const startTime = performance.now();

    try {
      let base64Audio: string;
      if (typeof audioBlob === 'string') {
        base64Audio = audioBlob;
      } else {
        base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            resolve(res.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
      }

      console.log('[Transcription] Sending audio to Whisper (Backend)...');

      try {
        const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio, language: options.language },
        });

        if (fnError || data?.error) throw fnError || new Error(data?.error);

        const result: TranscriptionResult = {
          text: data.text || '',
          language: data.language,
          duration: data.duration,
          segments: data.segments || [],
          words: data.words || [],
        };

        // Update accumulated
        if (result.text) {
          accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + result.text;
          setTranscript(accumulatedTranscriptRef.current);
        }
        return result;

      } catch (backendErr) {
        console.warn("Backend transcription failed, ensuring local transcript is preserved.", backendErr);
        // If backend fails, we just rely on local info if any, or return empty
        return null;
      }
    } catch (err) {
      console.error('Transcription Error:', err);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [options]);

  // --- Local Fraud Analysis Engine ---
  const performLocalAnalysis = async (text: string) => {
    // UPDATED: Use the advanced DeBERTa ML Model for Live Analysis
    try {
      const mlResult = await analyzeTextWithML(text);
      
      const score = mlResult.score;
      const categories: any = {};
      
      mlResult.categories.forEach(cat => {
        categories[cat.toLowerCase()] = { score: mlResult.score, evidence: mlResult.indicators };
      });

      return {
        overallRiskScore: score,
        riskLevel: mlResult.threatLevel === 'danger' ? 'blocked' : (mlResult.threatLevel === 'warning' ? 'warning' : 'safe'),
        summary: mlResult.indicators.length > 0
          ? `Detected risk signals: ${mlResult.indicators.slice(0, 3).join(', ')}`
          : "No significant threats detected locally.",
        recommendation: score > 50 ? "Hang up immediately." : "Proceed with caution.",
        categories,
        fraudIndicators: mlResult.indicators
      };
    } catch (err) {
      console.warn("ML Analysis failed, falling back to basic rules.", err);
      // Absolute fallback to rules if ML fails
      const features = textFeatureExtractor.extract(text);
      return {
        overallRiskScore: Math.round(features.textFraudScore * 100),
        riskLevel: features.textFraudScore >= 0.7 ? 'blocked' : (features.textFraudScore >= 0.4 ? 'warning' : 'safe'),
        summary: "Analyzed using basic rule engine.",
        recommendation: "Proceed with caution.",
        categories: {},
        fraudIndicators: []
      };
    }
  };

  // Analyze full call transcript for fraud
  const analyzeTranscript = useCallback(async (
    fullTranscript: string,
    audioAnalysis?: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> => {
    try {
      console.log('[Transcription] Analyzing transcript for fraud...');

      // Try backend first
      try {
        const { data, error: fnError } = await supabase.functions.invoke('analyze-call', {
          body: { transcript: fullTranscript, audioAnalysis },
        });

        if (fnError || data?.error) throw fnError || new Error(data?.error);
        return data;

      } catch (backendErr) {
        console.warn("Backend analysis failed, using local engine.", backendErr);
        return await performLocalAnalysis(fullTranscript);
      }
    } catch (err) {
      console.error('[Transcription] Analysis error:', err);
      return await performLocalAnalysis(fullTranscript); // Analysis fail shouldn't stop flow
    }
  }, []);

  // Reset transcript state
  const reset = useCallback(() => {
    stopStreaming(); // Stop mic
    accumulatedTranscriptRef.current = '';
    accumulatedSegmentsRef.current = [];
    setTranscript('');
    setSegments([]);
    setError(null);
    setProcessingTime(0);
  }, [stopStreaming]);

  const getFullTranscript = useCallback(() => {
    return accumulatedTranscriptRef.current;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  return {
    isTranscribing,
    isModelLoading,
    modelProgress,
    transcript,
    segments,
    error,
    processingTime,
    startStreaming, // New
    stopStreaming, // New
    processAudioChunk, // New
    transcribeAudio,
    analyzeTranscript,
    reset,
    getFullTranscript,
  };
}

