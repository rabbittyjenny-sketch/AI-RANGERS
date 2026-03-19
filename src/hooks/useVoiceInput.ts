/**
 * useVoiceInput — ElevenLabs Realtime STT
 * ใช้ useScribe จาก @elevenlabs/react@0.13.0
 */
import { useCallback, useRef, useState } from 'react';
import { useScribe } from '@elevenlabs/react';

export interface UseVoiceInputOptions {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  isTranscribing: boolean;
  partialText: string;
  toggle: () => void;
  stop: () => void;
  error: string | null;
}

export function useVoiceInput({ onResult, onError }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    languageCode: 'th',
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    onCommittedTranscript: (data) => {
      if (data.text?.trim()) {
        onResultRef.current(data.text.trim());
      }
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Voice error';
      setError(msg);
      onErrorRef.current?.(msg);
    },
    onAuthError: (data) => {
      const msg = data.error || 'Auth error';
      setError(msg);
      onErrorRef.current?.(msg);
    },
  });

  const toggle = useCallback(async () => {
    setError(null);

    if (scribe.isConnected) {
      scribe.disconnect();
      return;
    }

    try {
      // ขอ token จาก backend — API key ปลอดภัยอยู่ใน Vercel env
      const res = await fetch('/api/elevenlabs-token', { method: 'POST' });
      if (!res.ok) throw new Error('ขอ token ไม่ได้ค่ะ status: ' + res.status);
      const data = await res.json();
      if (!data.token) throw new Error(data.error || 'ไม่ได้รับ token ค่ะ');

      // ส่ง token ผ่าน connect()
      await scribe.connect({ token: data.token });

    } catch (err: any) {
      const msg = err.message || 'ไม่สามารถเริ่ม Voice ได้ค่ะ';
      setError(msg);
      onErrorRef.current?.(msg);
    }
  }, [scribe]);

  const stop = useCallback(() => {
    scribe.disconnect();
    setError(null);
  }, [scribe]);

  return {
    isListening: scribe.isConnected,
    isTranscribing: scribe.isTranscribing,
    partialText: scribe.partialTranscript || '',
    toggle,
    stop,
    error,
  };
}
