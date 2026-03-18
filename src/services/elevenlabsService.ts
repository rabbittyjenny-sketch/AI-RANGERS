/**
 * ElevenLabs Voice Service
 * ─────────────────────────────────────────────────────────────────────
 * STT (Speech-to-Text): VoiceRecorder + transcribeAudio()
 *   → ผู้ใช้กดปุ่ม Mic → อัดเสียง → ส่ง ElevenLabs Scribe API → ได้ text
 *
 * TTS (Text-to-Speech): speakText()
 *   → Rangers ตอบกลับ → แปลงเป็นเสียงพูดผ่าน ElevenLabs Rachel voice
 *
 * Proxy: ผ่าน /api/elevenlabs (Vercel serverless) → API key ไม่เปิดเผยใน browser
 * ─────────────────────────────────────────────────────────────────────
 */

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel — multilingual incl. Thai
const MODEL_ID = 'eleven_multilingual_v2';

export interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export interface STTResult {
  text: string;
  language?: string;
}

// ── TTS ───────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;

/** แปลง text → เสียงพูด แล้วเล่นในหน้าเว็บ */
export async function speakText(text: string, options: TTSOptions = {}): Promise<void> {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }

  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,3}\s/g, '')
    .replace(/\[WORKFILE:[^\]]*\][\s\S]*?\[\/WORKFILE\]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 2500);

  if (!clean) return;

  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const res = await fetch(`/api/elevenlabs/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text: clean,
      model_id: MODEL_ID,
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) throw new Error(`ElevenLabs TTS error ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.play();
  audio.onended = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null; };
}

export const stopSpeaking = () => { if (currentAudio) { currentAudio.pause(); currentAudio = null; } };
export const isSpeaking = () => currentAudio !== null && !currentAudio.paused;

// ── STT ───────────────────────────────────────────────────────────────

/** ส่ง audio blob ไป ElevenLabs Scribe → ได้ text กลับมา */
export async function transcribeAudio(audioBlob: Blob): Promise<STTResult> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('model_id', 'scribe_v1');

  const res = await fetch('/api/elevenlabs/v1/speech-to-text', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error(`ElevenLabs STT error ${res.status}`);
  const data = await res.json() as any;
  return { text: data.text || '', language: data.language_code };
}

// ── VoiceRecorder ─────────────────────────────────────────────────────

/**
 * อัดเสียงจาก microphone
 * Usage:
 *   const rec = new VoiceRecorder()
 *   await rec.start()
 *   const blob = await rec.stop()
 *   const { text } = await transcribeAudio(blob)
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.mediaRecorder.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) { reject(new Error('Not recording')); return; }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.stream?.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean { return this.mediaRecorder?.state === 'recording'; }
}
