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
  const [localListening, setLocalListening] = useState(false);
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
    onConnect: () => setLocalListening(true),
    onDisconnect: () => setLocalListening(false),
    onCommittedTranscript: (data) => {
      if (data.text?.trim()) {
        onResultRef.current(data.text.trim());
      }
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Voice error';
      setError(msg);
      setLocalListening(false);
      onErrorRef.current?.(msg);
    },
    onAuthError: (data) => {
      const msg = data.error || 'Auth error';
      setError(msg);
      setLocalListening(false);
      onErrorRef.current?.(msg);
    },
  });

  const stop = useCallback(() => {
    scribe.disconnect();
    setLocalListening(false);
    setError(null);
  }, [scribe]);

  const toggle = useCallback(async () => {
    setError(null);

    if (localListening) {
      stop();
      return;
    }

    try {
      const res = await fetch('/api/elevenlabs-token', { method: 'POST' });
      if (!res.ok) throw new Error('ขอ token ไม่ได้ค่ะ status: ' + res.status);
      const data = await res.json();
      if (!data.token) throw new Error(data.error || 'ไม่ได้รับ token ค่ะ');
      await scribe.connect({ token: data.token });
    } catch (err: any) {
      const msg = err.message || 'ไม่สามารถเริ่ม Voice ได้ค่ะ';
      setError(msg);
      setLocalListening(false);
      onErrorRef.current?.(msg);
    }
  }, [localListening, scribe, stop]);

  return {
    isListening: localListening,
    isTranscribing: scribe.isTranscribing,
    partialText: scribe.partialTranscript || '',
    toggle,
    stop,
    error,
  };
}
