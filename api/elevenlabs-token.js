/**
 * Vercel Serverless — ElevenLabs Single-Use Token
 * ขอ token สำหรับ Realtime STT (scribe_v2_realtime)
 * API key อยู่ใน Vercel environment — ไม่เปิดเผยใน browser
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      { method: 'POST', headers: { 'xi-api-key': apiKey } }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail?.message || `ElevenLabs error ${response.status}`);
    }
    const data = await response.json();
    return res.status(200).json({ token: data.token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
