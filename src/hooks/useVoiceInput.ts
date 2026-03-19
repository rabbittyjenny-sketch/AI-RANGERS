/**
 * useVoiceInput — React hook สำหรับ Realtime STT
 * กดปุ่ม Mic → WebSocket เปิด → พูด → ข้อความขึ้น real-time ทันที
 * VAD หยุดเองเมื่อเงียบ — ไม่ต้องกดหยุด
 */

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

  useEffect(() => {
    return () => { sttRef.current?.stop(); };
  }, []);

  const stop = useCallback(() => {
    // reset UI ทันที ไม่รอ async
    setIsListening(false);
    setIsTranscribing(false);
    setPartialText('');
    sttRef.current?.stop().catch(() => {});
    sttRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPartialText('');

    const stt = new RealtimeSTT({
      onStart: () => {
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
        setError(msg);
        onError?.(msg);
        stop();
      },
      onStop: () => {
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
