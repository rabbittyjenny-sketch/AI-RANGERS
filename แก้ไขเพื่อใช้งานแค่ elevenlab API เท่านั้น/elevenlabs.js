/**
 * Vercel Serverless Function — ElevenLabs API Proxy
 * ─────────────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/elevenlabs/v1/text-to-speech/:voiceId → TTS (JSON body)
 *   POST /api/elevenlabs/v1/speech-to-text          → STT (multipart/form-data)
 *   GET  /api/elevenlabs/v1/voices                  → รายชื่อ voices
 *
 * สำคัญ: bodyParser: false — ต้องปิดเพราะ STT ส่งมาเป็น multipart form-data
 * ─────────────────────────────────────────────────────────────────────
 */

export const config = {
  api: {
    bodyParser: false, // จำเป็นสำหรับ multipart/form-data (STT)
  },
};

export default async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return res.status(200).end();
  }

  // ── API Key check ───────────────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY not configured',
      hint: 'เพิ่ม ELEVENLABS_API_KEY ใน .env หรือ Vercel Environment Variables ค่ะ',
    });
  }

  // ── Build target URL ────────────────────────────────────────────────
  // /api/elevenlabs/v1/text-to-speech/abc → /v1/text-to-speech/abc
  const path = req.url.replace('/api/elevenlabs', '');
  const targetUrl = `https://api.elevenlabs.io${path}`;

  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');
  const isJSON      = contentType.includes('application/json');
  const isGET       = req.method === 'GET';

  try {
    let upstreamBody;
    let upstreamContentType;

    if (isGET) {
      // GET /voices — ไม่มี body
      upstreamBody = undefined;
    } else if (isMultipart) {
      // STT — ส่ง raw bytes ไปตรงๆ พร้อม Content-Type เดิม (รวม boundary)
      upstreamBody = await getRawBody(req);
      upstreamContentType = contentType; // ต้องส่ง boundary ไปด้วย
    } else if (isJSON) {
      // TTS — parse JSON แล้วส่งต่อ
      const jsonBody = await getJsonBody(req);
      upstreamBody = JSON.stringify(jsonBody);
      upstreamContentType = 'application/json';
    } else {
      // fallback — ส่ง raw body ไป
      upstreamBody = await getRawBody(req);
      upstreamContentType = contentType || 'application/octet-stream';
    }

    // ── Forward ไป ElevenLabs ─────────────────────────────────────────
    const upstreamHeaders = {
      'xi-api-key': apiKey,
    };
    if (upstreamContentType) {
      upstreamHeaders['content-type'] = upstreamContentType;
    }

    // TTS ต้องการ Accept: audio/mpeg
    if (path.includes('text-to-speech')) {
      upstreamHeaders['accept'] = 'audio/mpeg';
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: upstreamBody,
    });

    // ── Forward response กลับ client ──────────────────────────────────
    const respContentType = upstreamRes.headers.get('content-type') || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', respContentType);

    // Error จาก ElevenLabs — return JSON error
    if (!upstreamRes.ok) {
      let errData;
      try { errData = await upstreamRes.json(); } catch { errData = {}; }
      const message =
        errData?.detail?.message ||
        errData?.detail ||
        errData?.message ||
        `ElevenLabs error ${upstreamRes.status}`;
      return res.status(upstreamRes.status).json({ error: message, status: upstreamRes.status });
    }

    // TTS response — binary audio
    if (respContentType.includes('audio')) {
      const buffer = await upstreamRes.arrayBuffer();
      return res.status(upstreamRes.status).send(Buffer.from(buffer));
    }

    // STT / voices — JSON
    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);

  } catch (err) {
    console.error('[elevenlabs proxy] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * อ่าน raw body เป็น Buffer (ใช้สำหรับ multipart/form-data)
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end',  ()      => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * อ่าน JSON body (ใช้สำหรับ TTS request)
 */
function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data',  (chunk) => { body += chunk.toString(); });
    req.on('end',   ()      => {
      try   { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}
