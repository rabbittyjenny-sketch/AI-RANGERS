/**
 * useVoiceInput — React hook สำหรับ Realtime STT
 * ─────────────────────────────────────────────────────────────────────
 * กดปุ่ม Mic → เปิด WebSocket → พูด → ข้อความขึ้น real-time ทันที
 * VAD (Voice Activity Detection) หยุดเองเมื่อเงียบ — ไม่ต้องกดหยุด
 * รองรับทุก browser รวม iPhone Safari
 * ─────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeSTT } from '../services/elevenlabsService';

export interface UseVoiceInputOptions {
  onResult: (text: string) => void;   // callback เมื่อได้ committed text
  onError?: (message: string) => void;
}

export interface UseVoiceInputReturn {
  isListening: boolean;       // กำลังฟัง + ส่ง audio อยู่
  isTranscribing: boolean;    // กำลังรอ committed transcript
  partialText: string;        // ข้อความ real-time ขณะพูด
  toggle: () => void;         // กดเริ่ม/หยุด — ใช้เป็น handleSpeechToggle
  stop: () => void;
  error: string | null;
}

export function useVoiceInput({ onResult, onError }: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sttRef = useRef<RealtimeSTT | null>(null);

  // Cleanup เมื่อ unmount
  useEffect(() => {
    return () => { sttRef.current?.stop(); };
  }, []);

  const stop = useCallback(async () => {
    await sttRef.current?.stop();
    sttRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setPartialText('');
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
        // ข้อความขึ้น real-time ขณะพูด
        setPartialText(text);
        setIsTranscribing(true);
      },
      onCommitted: (text) => {
        // ข้อความสมบูรณ์ → ส่งให้ parent component
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
