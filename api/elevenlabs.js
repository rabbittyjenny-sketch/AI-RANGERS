/**
 * Vercel Serverless Function — ElevenLabs API Proxy
 * รองรับทั้ง:
 *   POST /api/elevenlabs/v1/text-to-speech/:voiceId  → TTS (JSON body)
 *   POST /api/elevenlabs/v1/speech-to-text           → STT (multipart/form-data)
 *   GET  /api/elevenlabs/v1/voices                   → รายชื่อ voices
 */

export const config = {
  api: {
    bodyParser: false, // ต้องปิด — เพราะ STT ส่งมาเป็น multipart form-data
  },
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY not configured',
      hint: 'เพิ่ม ELEVENLABS_API_KEY ใน .env หรือ Vercel Environment Variables ค่ะ'
    });
  }

  // แปลง path: /api/elevenlabs/v1/... → /v1/...
  const path = req.url.replace('/api/elevenlabs', '');
  const targetUrl = `https://api.elevenlabs.io${path}`;

  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');
  const isJSON = contentType.includes('application/json');

  try {
    let upstreamBody;

    if (isMultipart) {
      // STT: ส่ง raw body ไปตรงๆ พร้อม Content-Type เดิม
      upstreamBody = await getRawBody(req);
    } else if (isJSON) {
      // TTS: อ่าน JSON body
      upstreamBody = await getJsonBody(req);
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'xi-api-key': apiKey,
        ...(isMultipart ? { 'content-type': contentType } : {}),
        ...(isJSON ? { 'content-type': 'application/json' } : {}),
      },
      body: req.method !== 'GET'
        ? (isMultipart ? upstreamBody : JSON.stringify(upstreamBody))
        : undefined,
    });

    const respContentType = upstreamRes.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', respContentType);

    if (respContentType.includes('audio')) {
      // TTS response — binary audio
      const buffer = await upstreamRes.arrayBuffer();
      return res.status(upstreamRes.status).send(Buffer.from(buffer));
    }

    // STT / voices — JSON
    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({
        error: data?.detail?.message || data?.detail || 'ElevenLabs error',
        status: upstreamRes.status,
      });
    }

    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}
