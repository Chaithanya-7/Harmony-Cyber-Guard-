// Hook for real-time speech-to-text transcription

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { textFeatureExtractor } from '@/utils/audio/TextFeatureExtractor';

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

  const accumulatedTranscriptRef = useRef<string>('');
  const accumulatedSegmentsRef = useRef<TranscriptionSegment[]>([]);
  const recognitionRef = useRef<any>(null); // Web Speech API

  // --- Web Speech API (Offline Real-time) ---
  const startStreaming = useCallback(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = options.language || 'en-US';

        recognition.onresult = (event: any) => {
          let finalChunk = '';
          let interimChunk = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalChunk += event.results[i][0].transcript;
            } else {
              interimChunk += event.results[i][0].transcript;
            }
          }

          if (finalChunk) {
            accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + finalChunk;
            setTranscript(accumulatedTranscriptRef.current);

            const newSegment = {
              text: finalChunk,
              start: Date.now() / 1000,
              end: Date.now() / 1000 + 1,
              confidence: 0.9
            };
            accumulatedSegmentsRef.current.push(newSegment);
            setSegments([...accumulatedSegmentsRef.current]);

            if (options.onTranscript) {
              options.onTranscript({
                text: finalChunk,
                segments: [newSegment]
              });
            }
          }

          if (interimChunk && options.onPartialTranscript) {
            options.onPartialTranscript(interimChunk);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error", event.error);
          setError(event.error);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsTranscribing(true);
      } else {
        setError("Speech Recognition not supported in this browser.");
      }
    }
  }, [options]);

  const stopStreaming = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
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
  const performLocalAnalysis = (text: string) => {
    // UPDATED: Use the centralized advanced extractor
    const features = textFeatureExtractor.extract(text);

    // Map features to analysis result
    const categories: any = {};
    const evidence: string[] = [];

    if (features.financialScore > 0.2) {
      categories.financial = { score: features.financialScore * 100, evidence: features.financialTerms };
      evidence.push(...features.financialTerms);
    }
    if (features.urgencyScore > 0.3) {
      categories.urgency = { score: features.urgencyScore * 100, evidence: features.urgencyIndicators };
      evidence.push(...features.urgencyIndicators);
    }
    if (features.threatDensity > 0) {
      categories.threat = { score: features.threatDensity * 100, evidence: features.threatTerms };
      evidence.push(...features.threatTerms);
    }
    if (features.piiRequestScore > 0) {
      categories.pii = { score: features.piiRequestScore * 100, evidence: features.piiTypes };
      evidence.push('PII Requested');
    }

    const score = Math.round(features.textFraudScore * 100);

    return {
      overallRiskScore: score,
      riskLevel: score >= 70 ? 'blocked' : (score >= 40 ? 'warning' : 'safe'),
      summary: evidence.length > 0
        ? `Detected risk signals: ${evidence.slice(0, 3).join(', ')}`
        : "No significant threats detected locally.",
      recommendation: score > 50 ? "Hang up immediately." : "Proceed with caution.",
      categories,
      fraudIndicators: evidence
    };
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
        return performLocalAnalysis(fullTranscript);
      }
    } catch (err) {
      console.error('[Transcription] Analysis error:', err);
      return performLocalAnalysis(fullTranscript); // Analysis fail shouldn't stop flow
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
    transcript,
    segments,
    error,
    processingTime,
    startStreaming, // New
    stopStreaming, // New
    transcribeAudio,
    analyzeTranscript,
    reset,
    getFullTranscript,
  };
}

