/**
 * Vercel Serverless Function — ElevenLabs Single-Use Token
 * ─────────────────────────────────────────────────────────────────────
 * POST /api/elevenlabs-token
 * → ขอ single-use token จาก ElevenLabs เพื่อใช้กับ Realtime STT WebSocket
 * → API key อยู่ฝั่ง server เท่านั้น ไม่เปิดเผยใน browser
 * ─────────────────────────────────────────────────────────────────────
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY not configured',
      hint: 'เพิ่ม ELEVENLABS_API_KEY ใน Vercel Environment Variables ค่ะ',
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/token', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.detail?.message || err?.detail || 'ElevenLabs token error',
        status: response.status,
      });
    }

    const data = await response.json();
    return res.status(200).json({ token: data.token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
