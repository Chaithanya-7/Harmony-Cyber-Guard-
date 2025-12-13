// Hook for recording audio and saving to Supabase storage

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RecordingConfig {
  mimeType?: string;
  audioBitsPerSecond?: number;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  duration: number;
  storagePath?: string;
  publicUrl?: string;
}

export function useCallRecording(config: RecordingConfig = {}) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    mimeType = 'audio/webm;codecs=opus',
    audioBitsPerSecond = 128000,
  } = config;

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
        audioBitsPerSecond,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Capture in 1-second chunks

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      // Update duration
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      console.log('[Recording] Started');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('[Recording] Error:', err);
    }
  }, [mimeType, audioBitsPerSecond]);

  // Stop recording and return blob
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        const url = URL.createObjectURL(blob);
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        setIsRecording(false);
        setIsPaused(false);
        setRecordingDuration(0);

        console.log('[Recording] Stopped, duration:', duration, 'seconds');

        resolve({ blob, url, duration });
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log('[Recording] Paused');
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      console.log('[Recording] Resumed');
    }
  }, []);

  // Upload recording to Supabase storage
  const uploadRecording = useCallback(async (
    blob: Blob,
    callId?: string
  ): Promise<{ path: string; publicUrl: string } | null> => {
    if (!user) {
      setError('Must be logged in to upload recordings');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const fileName = callId 
        ? `${callId}.webm`
        : `recording_${timestamp}.webm`;
      const filePath = `${user.id}/${fileName}`;

      console.log('[Recording] Uploading to:', filePath);

      const { data, error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, blob, {
          contentType: 'audio/webm',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the URL
      const { data: urlData } = supabase.storage
        .from('call-recordings')
        .getPublicUrl(data.path);

      console.log('[Recording] Upload complete:', data.path);

      return {
        path: data.path,
        publicUrl: urlData.publicUrl,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload recording';
      setError(errorMessage);
      console.error('[Recording] Upload error:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  // Convert blob to base64 for API calls
  const blobToBase64 = useCallback(async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Get recording as base64 (useful for transcription)
  const getRecordingBase64 = useCallback(async (): Promise<string | null> => {
    if (chunksRef.current.length === 0) return null;
    
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    return blobToBase64(blob);
  }, [blobToBase64]);

  return {
    isRecording,
    isPaused,
    isUploading,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadRecording,
    blobToBase64,
    getRecordingBase64,
  };
}
