/**
 * ElevenLabs Voice Service
 * ─────────────────────────────────────────────────────────────────────
 * TTS (Text-to-Speech): speakText()
 *   → Rangers ตอบกลับ → แปลงเป็นเสียงพูดผ่าน ElevenLabs Rachel voice
 *   → Proxy ผ่าน /api/elevenlabs (Vercel serverless) → API key ไม่เปิดเผยใน browser
 *
 * Note: STT (Speech-to-Text) ใช้ native Web Speech API ใน Workspace.jsx
 *       (window.SpeechRecognition / window.webkitSpeechRecognition, lang: th-TH)
 *       ไม่จำเป็นต้องใช้ ElevenLabs STT
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
