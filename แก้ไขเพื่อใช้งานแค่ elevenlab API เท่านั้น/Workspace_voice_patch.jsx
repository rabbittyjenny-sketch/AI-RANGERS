/**
 * WORKSPACE.JSX — ElevenLabs STT Integration
 * ─────────────────────────────────────────────────────────────────────
 * ไฟล์นี้แสดง 4 จุดที่ต้องแก้ใน Workspace.jsx
 * Copy-paste แต่ละ AFTER block ไปแทน BEFORE block ได้เลยค่ะ
 *
 * Files ที่ต้องมีก่อน:
 *   src/hooks/useVoiceInput.ts         ← useVoiceInput.ts ที่ได้มา
 *   src/services/elevenlabsService.ts  ← elevenlabsService.ts ที่ได้มา
 *   api/elevenlabs.js                  ← elevenlabs.js ที่ได้มา
 * ─────────────────────────────────────────────────────────────────────
 */


// ══════════════════════════════════════════════════════════════════════
// CHANGE 1 — Import (บรรทัดแรกของ Workspace.jsx)
// ══════════════════════════════════════════════════════════════════════

// ❌ BEFORE:
// import React, { useState, useEffect, useRef, useCallback } from 'react';

// ✅ AFTER — ลบ useEffect ออก เพิ่ม useVoiceInput:
import React, { useState, useRef, useCallback } from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';


// ══════════════════════════════════════════════════════════════════════
// CHANGE 2 — State + useEffect + handleSpeechToggle (ประมาณบรรทัด 100-160)
// ══════════════════════════════════════════════════════════════════════

// ❌ BEFORE — ลบทั้งก้อนนี้ออก:
/*
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const r = new SpeechRecognition();
      r.continuous = false; r.interimResults = true; r.lang = 'th-TH';
      r.onstart = () => setIsListening(true);
      r.onend = () => setIsListening(false);
      r.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript; if (t) setInputValue(t); };
      r.onerror = () => setIsListening(false);
      recognitionRef.current = r;
    }
  }, []);

  const handleSpeechToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else { setInputValue(''); recognitionRef.current.start(); }
  };
*/

// ✅ AFTER — วางหลัง useState declarations ทั้งหมด:
const {
  isListening,
  isTranscribing,
  toggle: handleSpeechToggle,
  error: voiceError,
} = useVoiceInput({
  // append text ต่อท้ายถ้ามีอยู่แล้ว (ไม่ลบสิ่งที่พิมพ์ไว้)
  onResult: (text) => setInputValue((prev) => prev ? `${prev} ${text}` : text),
  onError:  (msg)  => setError(msg),
});
// หมายเหตุ: speechSupported ไม่ต้องใช้แล้ว — ElevenLabs รองรับทุก browser
// หมายเหตุ: useEffect + recognitionRef ถูกลบออกทั้งหมด


// ══════════════════════════════════════════════════════════════════════
// CHANGE 3A — ปุ่ม Voice Mode ใน label row (ด้านบน textarea)
// หา: {speechSupported && ( ... Voice Mode ... )}
// ══════════════════════════════════════════════════════════════════════

// ❌ BEFORE:
/*
{speechSupported && (
  <button type="button" onClick={handleSpeechToggle} disabled={isLoading}
    style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px',
      borderRadius: 99, border: 'none', cursor: 'pointer',
      fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
      ...(isListening
        ? { background: '#10b981', color: '#fff', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }
        : { background: BG, color: '#64748b', ...NEU.raisedXs })
    }}>
    <Mic size={11} /> {isListening ? 'กำลังฟัง…' : 'Voice Mode'}
  </button>
)}
*/

// ✅ AFTER — แทนที่ทั้งก้อน (รวม wrapper ของ speechSupported):
<button
  type="button"
  onClick={handleSpeechToggle}
  disabled={isLoading || isTranscribing}
  title={
    isTranscribing ? 'กำลังแปลงเสียงเป็นข้อความ...' :
    isListening    ? 'กดอีกครั้งเพื่อหยุดและส่ง' :
    'กดค้างแล้วพูด — รองรับภาษาไทย/อังกฤษค่ะ'
  }
  style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 9px', borderRadius: 99, border: 'none',
    cursor: (isLoading || isTranscribing) ? 'wait' : 'pointer',
    fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
    ...(isListening
      ? { background: '#10b981', color: '#fff', boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }
      : isTranscribing
      ? { background: '#f59e0b', color: '#fff' }
      : { background: BG, color: '#64748b', ...NEU.raisedXs })
  }}>
  <Mic size={11} />
  {isTranscribing ? 'กำลังแปลง...' : isListening ? 'กำลังฟัง...' : 'Voice Mode'}
</button>


// ══════════════════════════════════════════════════════════════════════
// CHANGE 3B — ปุ่ม Mic Start ใน bottom button row
// หา: {speechSupported && ( ... Mic Start ... )}
// ══════════════════════════════════════════════════════════════════════

// ❌ BEFORE:
/*
{speechSupported && (
  <button type="button" onClick={handleSpeechToggle}
    style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '12px', borderRadius: 24, border: 'none',
      cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
      ...(isListening
        ? { background: '#10b981', color: '#fff', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.1)' }
        : { background: BG, color: '#475569', ...NEU.raisedSm })
    }}>
    <Mic size={14} /> {isListening ? 'กำลังฟัง...' : 'Mic Start'}
  </button>
)}
*/

// ✅ AFTER — แทนที่ทั้งก้อน (รวม wrapper ของ speechSupported):
<button
  type="button"
  onClick={handleSpeechToggle}
  disabled={isTranscribing}
  style={{
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '12px', borderRadius: 24, border: 'none',
    cursor: isTranscribing ? 'wait' : 'pointer',
    fontSize: '0.8rem', fontWeight: 700, transition: 'all 0.2s',
    ...(isListening
      ? { background: '#10b981', color: '#fff', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.1)' }
      : isTranscribing
      ? { background: '#f59e0b', color: '#fff' }
      : { background: BG, color: '#475569', ...NEU.raisedSm })
  }}>
  <Mic size={14} />
  {isTranscribing
    ? '⏳ กำลังแปลงเสียง...'
    : isListening
    ? '🔴 กำลังฟัง... (กดอีกครั้งเพื่อส่ง)'
    : 'Mic Start'}
</button>


// ══════════════════════════════════════════════════════════════════════
// CHANGE 4 — placeholder ใน <textarea>
// ══════════════════════════════════════════════════════════════════════

// ❌ BEFORE:
// placeholder={isListening ? '🎙 กำลังฟัง...' : selectedRanger ? `บอก${selectedRanger.name}ว่าต้องการอะไร...` : 'เลือก Ranger ก่อนพิมพ์...'}

// ✅ AFTER:
// placeholder={
//   isTranscribing ? '⏳ กำลังแปลงเสียงเป็นข้อความ...' :
//   isListening    ? '🎙 กำลังฟัง... (กดปุ่มอีกครั้งเพื่อหยุดและส่ง)' :
//   selectedRanger ? `บอก${selectedRanger.name}ว่าต้องการอะไร...` :
//   'เลือก Ranger ก่อนพิมพ์...'
// }
