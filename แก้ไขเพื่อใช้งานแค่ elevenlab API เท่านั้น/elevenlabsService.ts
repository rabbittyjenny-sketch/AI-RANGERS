/**
 * ElevenLabs Voice Service
 * ─────────────────────────────────────────────────────────────────────
 * STT (Speech-to-Text): VoiceRecorder + transcribeAudio()
 *   ผู้ใช้กดปุ่ม Mic → อัดเสียง → ส่ง ElevenLabs Scribe → ได้ text
 *
 * TTS (Text-to-Speech): speakText()
 *   Rangers ตอบกลับ → แปลงเป็นเสียงพูดผ่าน ElevenLabs Rachel voice
 *
 * Proxy ผ่าน /api/elevenlabs (Vercel serverless) → API key ปลอดภัย
 * ─────────────────────────────────────────────────────────────────────
 */

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual incl. Thai
const MODEL_ID = 'eleven_multilingual_v2';

// ── TTS Types ──────────────────────────────────────────────────────────

export interface TTSOptions {
  voiceId?: string;
  stability?: number;       // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number;           // 0-1, default 0
}

// ── STT Types ──────────────────────────────────────────────────────────

export interface STTResult {
  text: string;
  language?: string;
}

// ── TTS: แปลง Text → เสียงพูด ────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;

/**
 * แปลง text → เสียงพูด แล้วเล่นในหน้าเว็บทันที
 * ถ้ากำลังเล่นอยู่ จะหยุดก่อนแล้วเล่นใหม่
 */
export async function speakText(text: string, options: TTSOptions = {}): Promise<void> {
  // หยุดเสียงที่กำลังเล่นอยู่
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // ทำความสะอาด text — ลบ markdown, WORKFILE tags, emojis พิเศษ
  const clean = text
    .replace(/\[WORKFILE:[^\]]*\][\s\S]*?\[\/WORKFILE\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,3}\s/g, '')
    .replace(/\[System.*?\]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 2500); // ElevenLabs limit

  if (!clean) return;

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const res = await fetch(`/api/elevenlabs/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: clean,
      model_id: MODEL_ID,
      voice_settings: {
        stability:        options.stability        ?? 0.5,
        similarity_boost: options.similarityBoost  ?? 0.75,
        style:            options.style            ?? 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS error ${res.status}: ${errText}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  audio.play();
  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
  };
}

/** หยุดเสียงที่กำลังเล่นอยู่ */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/** คืน true ถ้ากำลังเล่นเสียงอยู่ */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/** รายชื่อ voices ที่ใช้ได้ (สำหรับ voice picker UI) */
export async function getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
  const res = await fetch('/api/elevenlabs/v1/voices');
  if (!res.ok) throw new Error('Failed to fetch ElevenLabs voices');
  const data = await res.json() as any;
  return data.voices ?? [];
}

// ── STT: แปลงเสียง → Text ────────────────────────────────────────────

/**
 * ส่ง audio blob ไป ElevenLabs Scribe → ได้ text กลับมา
 * ใช้คู่กับ VoiceRecorder ด้านล่าง
 */
export async function transcribeAudio(audioBlob: Blob): Promise<STTResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('model_id', 'scribe_v1');

  const res = await fetch('/api/elevenlabs/v1/speech-to-text', {
    method: 'POST',
    // ห้ามใส่ Content-Type header เอง — browser จะ set boundary ใน multipart ให้เอง
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as any;
    const detail = errData?.detail?.message || errData?.detail || `Status ${res.status}`;
    throw new Error(`ElevenLabs STT error: ${detail}`);
  }

  const data = await res.json() as any;
  return {
    text:     data.text           || '',
    language: data.language_code  || undefined,
  };
}

// ── VoiceRecorder ─────────────────────────────────────────────────────

/**
 * อัดเสียงจาก microphone
 *
 * Usage:
 *   const rec = new VoiceRecorder()
 *   await rec.start()
 *   // ... user speaks ...
 *   const blob = await rec.stop()
 *   const { text } = await transcribeAudio(blob)
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    // ใช้ webm/opus ถ้า supported — ขนาดเล็ก คุณภาพดี
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : ''; // ให้ browser เลือกเอง

    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined
    );
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250); // collect ทุก 250ms
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('ไม่ได้เริ่มอัดเสียง'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        // หยุด microphone ทันทีหลังอัดเสร็จ
        this.stream?.getTracks().forEach(t => t.stop());
        this.stream = null;
        resolve(blob);
      };
      this.mediaRecorder.onerror = (e: any) => {
        reject(new Error(e.error?.message || 'MediaRecorder error'));
      };
      this.mediaRecorder.stop();
    });
  }

  /** คืน true ถ้ากำลังอัดเสียงอยู่ */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /** force stop microphone โดยไม่รอ blob (ใช้ตอน cleanup) */
  forceStop(): void {
    try { this.mediaRecorder?.stop(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }
}
