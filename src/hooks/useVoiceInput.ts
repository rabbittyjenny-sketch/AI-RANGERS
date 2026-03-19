import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeSTT } from '../services/elevenlabsService';

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
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sttRef = useRef<RealtimeSTT | null>(null);
  const startingRef = useRef(false); // guard ป้องกัน start ซ้ำ

  useEffect(() => {
    return () => { sttRef.current?.stop(); };
  }, []);

  const stop = useCallback(() => {
    startingRef.current = false;
    setIsListening(false);
    setIsTranscribing(false);
    setPartialText('');
    sttRef.current?.stop().catch(() => {});
    sttRef.current = null;
  }, []);

  const start = useCallback(async () => {
    // ป้องกัน double-call
    if (startingRef.current || sttRef.current?.isActive()) return;
    startingRef.current = true;

    setError(null);
    setPartialText('');

    const stt = new RealtimeSTT({
      onStart: () => {
        startingRef.current = false;
        setIsListening(true);
        setIsTranscribing(false);
      },
      onPartial: (text) => {
        setPartialText(text);
        setIsTranscribing(true);
      },
      onCommitted: (text) => {
        setPartialText('');
        setIsTranscribing(false);
        if (text.trim()) onResult(text.trim());
      },
      onError: (msg) => {
        startingRef.current = false;
        setError(msg);
        onError?.(msg);
        stop();
      },
      onStop: () => {
        startingRef.current = false;
        setIsListening(false);
        setIsTranscribing(false);
        setPartialText('');
      },
    });

    sttRef.current = stt;
    await stt.start();
  }, [onResult, onError, stop]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, isTranscribing, partialText, toggle, stop, error };
}
