/**
 * ElevenLabs Voice Service
 * STT: Realtime WebSocket — ข้อความขึ้นทันทีขณะพูด
 * TTS: speakText() — available แต่ไม่ได้เปิดใช้
 */

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const MODEL_ID = 'eleven_multilingual_v2';
const STT_MODEL_ID = 'scribe_v2_realtime';
const WS_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';

export interface TTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export interface RealtimeSTTCallbacks {
  onPartial: (text: string) => void;
  onCommitted: (text: string) => void;
  onError: (msg: string) => void;
  onStart?: () => void;
  onStop?: () => void;
}

// ── TTS ───────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;

export async function speakText(text: string, options: TTSOptions = {}): Promise<void> {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }

  const clean = text
    .replace(/\[WORKFILE:[^\]]*\][\s\S]*?\[\/WORKFILE\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,3}\s/g, '')
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

// ── Realtime STT ──────────────────────────────────────────────────────

export class RealtimeSTT {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private callbacks: RealtimeSTTCallbacks;
  private isRunning = false;

  constructor(callbacks: RealtimeSTTCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      // 1. ขอ single-use token
      const tokenRes = await fetch('/api/elevenlabs-token', { method: 'POST' });
      if (!tokenRes.ok) throw new Error('ไม่สามารถขอ token ได้ค่ะ');
      const { token } = await tokenRes.json();

      // 2. เปิด WebSocket
      const wsUrl = `${WS_URL}?model_id=${STT_MODEL_ID}&token=${token}&commit_strategy=vad&language_code=th`;
      this.ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket timeout ค่ะ')), 8000);
        this.ws!.onopen = () => { clearTimeout(timeout); resolve(); };
        this.ws!.onerror = () => { clearTimeout(timeout); reject(new Error('เชื่อมต่อ Voice ไม่ได้ค่ะ')); };
      });

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.message_type === 'partial_transcript' && msg.text) {
            this.callbacks.onPartial(msg.text);
          } else if (msg.message_type === 'committed_transcript' && msg.text) {
            this.callbacks.onCommitted(msg.text);
          } else if (msg.message_type?.includes('error')) {
            this.callbacks.onError(msg.message || 'ElevenLabs STT error');
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.isRunning = false;
        this.callbacks.onStop?.();
      };

      this.ws.onerror = () => {
        this.callbacks.onError('เชื่อมต่อ Voice ไม่ได้ค่ะ');
        this.stop();
      };

      // 3. เปิด microphone
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // รองรับ Safari ด้วย webkitAudioContext
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const actualSampleRate = this.audioContext.sampleRate;
      const source = this.audioContext.createMediaStreamSource(this.stream);

      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
        }
        const uint8 = new Uint8Array(int16.buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          binary += String.fromCharCode(...Array.from(uint8.subarray(i, i + chunkSize)));
        }
        this.ws!.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: btoa(binary),
          sample_rate: actualSampleRate,
        }));
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isRunning = true;
      this.callbacks.onStart?.();

    } catch (err: any) {
      this.callbacks.onError(err.message || 'ไม่สามารถเริ่ม Voice ได้ค่ะ');
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.processor?.disconnect();
    this.processor = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    await this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
    this.ws = null;
  }

  isActive(): boolean { return this.isRunning; }
}
