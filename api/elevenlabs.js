/**
 * Vercel Serverless Function — ElevenLabs API Proxy
 * Supports both TTS (POST JSON) and STT (POST FormData)
 */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
  }

  // Path: /api/elevenlabs/v1/text-to-speech/:voiceId or /v1/speech-to-text
  const path = req.url.replace('/api/elevenlabs', '');
  const targetUrl = `https://api.elevenlabs.io${path}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'xi-api-key': apiKey,
        ...(!req.headers['content-type']?.includes('multipart') && { 'Content-Type': 'application/json' }),
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('audio')) {
      const buffer = await upstreamRes.arrayBuffer();
      return res.status(upstreamRes.status).send(Buffer.from(buffer));
    }

    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
