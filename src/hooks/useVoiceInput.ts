/**
 * useVoiceInput — ใช้ ElevenLabs official useScribe hook
 * กดปุ่ม Mic → พูด → ข้อความขึ้น real-time ทันที
 * VAD ตัดเองเมื่อเงียบ — ไม่ต้องกดหยุด
 */
import { useCallback, useState } from 'react';
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

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    onPartialTranscript: (data) => {
      // ข้อความขึ้น real-time ขณะพูด — ไม่ต้องทำอะไร UI จะแสดงผ่าน partialTranscript
    },
    onCommittedTranscript: (data) => {
      if (data.text?.trim()) {
        onResult(data.text.trim());
      }
    },
  });

  const toggle = useCallback(async () => {
    setError(null);
    if (scribe.isConnected) {
      scribe.disconnect();
      return;
    }
    try {
      const res = await fetch('/api/elevenlabs-token', { method: 'POST' });
      if (!res.ok) throw new Error('ไม่สามารถขอ token ได้ค่ะ');
      const { token } = await res.json();
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      const msg = err.message || 'ไม่สามารถเริ่ม Voice ได้ค่ะ';
      setError(msg);
      onError?.(msg);
    }
  }, [scribe, onResult, onError]);

  const stop = useCallback(() => {
    scribe.disconnect();
  }, [scribe]);

  return {
    isListening: scribe.isConnected,
    isTranscribing: scribe.isConnected && !!scribe.partialTranscript,
    partialText: scribe.partialTranscript || '',
    toggle,
    stop,
    error,
  };
}
