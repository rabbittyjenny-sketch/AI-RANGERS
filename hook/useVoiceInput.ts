/**
 * useVoiceInput — React Hook สำหรับ ElevenLabs STT (Scribe)
 * ─────────────────────────────────────────────────────────────────────
 * แทนที่ Web Speech API เดิมด้วย ElevenLabs Scribe
 * รองรับทุก browser รวมถึง iOS Safari และ Firefox
 *
 * Usage ใน Workspace.jsx:
 *
 *   const { isListening, isTranscribing, toggle, error } = useVoiceInput({
 *     onResult: (text) => setInputValue(text),
 *     onError:  (msg)  => setError(msg),
 *   })
 *
 *   <button onClick={toggle}>
 *     {isListening ? '🔴 กำลังฟัง...' : 'Mic Start'}
 *   </button>
 *
 * States:
 *   isListening    — microphone เปิดอยู่ อัดเสียงอยู่
 *   isTranscribing — ส่ง blob ไป ElevenLabs รอผลอยู่
 * ─────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react';
import { VoiceRecorder, transcribeAudio } from '../services/elevenlabsService';

interface UseVoiceInputOptions {
  /** callback เมื่อได้ text กลับมาจาก ElevenLabs */
  onResult: (text: string) => void;
  /** callback เมื่อเกิด error (optional) */
  onError?: (message: string) => void;
  /** callback เมื่อเริ่มอัดเสียง (optional) */
  onStart?: () => void;
  /** callback เมื่อหยุดอัดเสียงและกำลัง transcribe (optional) */
  onStop?: () => void;
}

interface UseVoiceInputReturn {
  /** กำลังอัดเสียงอยู่ */
  isListening: boolean;
  /** ส่ง blob ไป ElevenLabs รอผลอยู่ */
  isTranscribing: boolean;
  /** toggle เปิด/ปิด microphone */
  toggle: () => Promise<void>;
  /** หยุดทันที (ใช้เมื่อ unmount หรือ cancel) */
  stop: () => Promise<void>;
  /** error message ล่าสุด (null ถ้าไม่มี error) */
  error: string | null;
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  // ── หยุดอัดเสียง → ส่ง blob → รับ text ──────────────────────────────
  const stop = useCallback(async () => {
    if (!recorderRef.current?.isRecording()) return;

    setIsListening(false);
    setIsTranscribing(true);
    options.onStop?.();

    try {
      const blob = await recorderRef.current.stop();

      // ตรวจขนาด blob — ถ้าเงียบเกินไปจะได้ blob เล็กมาก
      if (blob.size < 1000) {
        throw new Error('ไม่ได้ยินเสียง กรุณาพูดให้ดังขึ้นและลองใหม่อีกครั้งค่ะ');
      }

      const result = await transcribeAudio(blob);

      if (result.text.trim()) {
        options.onResult(result.text.trim());
        setError(null);
      } else {
        const msg = 'ไม่ได้ยินเสียง กรุณาลองใหม่อีกครั้งค่ะ';
        setError(msg);
        options.onError?.(msg);
      }
    } catch (err: any) {
      // แปล error ให้เป็นข้อความไทยที่เข้าใจง่าย
      let msg: string;
      if (err.message?.includes('401')) {
        msg = 'กรุณาตั้งค่า ELEVENLABS_API_KEY ใน .env ก่อนใช้ Voice Input ค่ะ';
      } else if (err.message?.includes('404')) {
        msg = 'ไม่พบ ElevenLabs API endpoint — ตรวจสอบ api/elevenlabs.js ค่ะ';
      } else if (err.message?.includes('429')) {
        msg = 'ใช้งาน Voice มากเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ';
      } else if (err.message?.includes('500')) {
        msg = 'ElevenLabs server error กรุณาลองใหม่อีกครั้งค่ะ';
      } else {
        msg = err.message || 'Voice input error กรุณาลองใหม่ค่ะ';
      }
      setError(msg);
      options.onError?.(msg);
    } finally {
      setIsTranscribing(false);
      recorderRef.current = null;
    }
  }, [options]);

  // ── Toggle เปิด/ปิด microphone ──────────────────────────────────────
  const toggle = useCallback(async () => {
    setError(null);

    // กำลังฟังอยู่ → หยุด + transcribe
    if (isListening) {
      await stop();
      return;
    }

    // กำลัง transcribe อยู่ → ไม่ทำอะไร (ป้องกัน double-click)
    if (isTranscribing) return;

    // เริ่มฟัง
    try {
      // ตรวจสอบว่า browser รองรับ MediaRecorder
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Browser ไม่รองรับ microphone กรุณาใช้ Chrome, Edge, Safari หรือ Firefox เวอร์ชันล่าสุดค่ะ'
        );
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Browser ไม่รองรับ MediaRecorder API ค่ะ');
      }

      recorderRef.current = new VoiceRecorder();
      await recorderRef.current.start();
      setIsListening(true);
      options.onStart?.();
    } catch (err: any) {
      let msg: string;
      if (
        err.message?.includes('Permission') ||
        err.message?.includes('NotAllowed') ||
        err.name === 'NotAllowedError'
      ) {
        msg = 'กรุณาอนุญาตให้ใช้ microphone ในการตั้งค่า browser ก่อนค่ะ';
      } else if (err.name === 'NotFoundError') {
        msg = 'ไม่พบ microphone กรุณาเชื่อมต่อ microphone แล้วลองใหม่ค่ะ';
      } else {
        msg = err.message || 'ไม่สามารถเปิด microphone ได้ค่ะ';
      }
      setError(msg);
      options.onError?.(msg);
      setIsListening(false);
    }
  }, [isListening, isTranscribing, stop, options]);

  return { isListening, isTranscribing, toggle, stop, error };
}
