// Hook for capturing real microphone audio using Web Audio API

import { useState, useCallback, useRef, useEffect } from 'react';

export interface MicrophoneConfig {
  sampleRate?: number;
  channelCount?: number;
  chunkDuration?: number; // seconds
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  duration: number;
}

type ChunkCallback = (chunk: AudioChunk) => void;

export function useMicrophone(config: MicrophoneConfig = {}) {
  const {
    sampleRate = 24000,
    channelCount = 1,
    chunkDuration = 2.5,
    echoCancellation = true,
    noiseSuppression = true,
    autoGainControl = true,
  } = config;

  const [isRecording, setIsRecording] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunkBufferRef = useRef<Float32Array[]>([]);
  const chunkStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const chunkCallbackRef = useRef<ChunkCallback | null>(null);

  // Calculate samples per chunk
  const samplesPerChunk = Math.floor(sampleRate * chunkDuration);

  // Check permission status
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setIsPermissionGranted(result.state === 'granted');
        
        result.addEventListener('change', () => {
          setIsPermissionGranted(result.state === 'granted');
        });
      } catch {
        // Permissions API not supported, will check on request
        setIsPermissionGranted(null);
      }
    };
    
    checkPermission();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Process audio level for visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate RMS
    const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(1, rms / 128);
    
    setAudioLevel(normalizedLevel);
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async (onChunk?: ChunkCallback) => {
    try {
      setError(null);
      chunkCallbackRef.current = onChunk || null;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });

      streamRef.current = stream;
      setIsPermissionGranted(true);

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate });
      
      // Create source from stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create analyser for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Create processor for audio data
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // Initialize chunk buffer
      chunkBufferRef.current = [];
      chunkStartTimeRef.current = Date.now();

      // Process audio data
      processorRef.current.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        chunkBufferRef.current.push(chunk);

        // Check if we have enough samples for a chunk
        const totalSamples = chunkBufferRef.current.reduce((acc, c) => acc + c.length, 0);
        
        if (totalSamples >= samplesPerChunk) {
          // Combine buffer into single array
          const combinedData = new Float32Array(totalSamples);
          let offset = 0;
          for (const c of chunkBufferRef.current) {
            combinedData.set(c, offset);
            offset += c.length;
          }

          // Extract chunk and keep remainder
          const chunkData = combinedData.slice(0, samplesPerChunk);
          const remainder = combinedData.slice(samplesPerChunk);

          // Create audio chunk
          const audioChunk: AudioChunk = {
            data: chunkData,
            timestamp: chunkStartTimeRef.current,
            duration: chunkDuration,
          };

          // Callback with chunk
          if (chunkCallbackRef.current) {
            chunkCallbackRef.current(audioChunk);
          }

          // Reset buffer with remainder
          chunkBufferRef.current = remainder.length > 0 ? [remainder] : [];
          chunkStartTimeRef.current = Date.now();
        }
      };

      // Connect nodes
      sourceRef.current.connect(analyserRef.current);
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setIsRecording(true);
      
      // Start audio level updates
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      console.log('[Microphone] Recording started');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMessage);
      setIsPermissionGranted(false);
      console.error('[Microphone] Error:', err);
    }
  }, [sampleRate, channelCount, chunkDuration, echoCancellation, noiseSuppression, autoGainControl, samplesPerChunk, updateAudioLevel]);

  // Stop recording
  const stopRecording = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect and cleanup
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Process remaining buffer
    if (chunkBufferRef.current.length > 0 && chunkCallbackRef.current) {
      const totalSamples = chunkBufferRef.current.reduce((acc, c) => acc + c.length, 0);
      if (totalSamples > 0) {
        const finalData = new Float32Array(totalSamples);
        let offset = 0;
        for (const c of chunkBufferRef.current) {
          finalData.set(c, offset);
          offset += c.length;
        }

        const audioChunk: AudioChunk = {
          data: finalData,
          timestamp: chunkStartTimeRef.current,
          duration: totalSamples / sampleRate,
        };

        chunkCallbackRef.current(audioChunk);
      }
    }

    chunkBufferRef.current = [];
    chunkCallbackRef.current = null;
    setIsRecording(false);
    setAudioLevel(0);

    console.log('[Microphone] Recording stopped');
  }, [sampleRate]);

  // Toggle recording
  const toggleRecording = useCallback(async (onChunk?: ChunkCallback) => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording(onChunk);
    }
  }, [isRecording, startRecording, stopRecording]);

  // Request permission without starting recording
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setIsPermissionGranted(true);
      return true;
    } catch {
      setIsPermissionGranted(false);
      return false;
    }
  }, []);

  return {
    isRecording,
    isPermissionGranted,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording,
    requestPermission,
  };
}
