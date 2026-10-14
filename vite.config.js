import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Dev only: ให้ `npm run dev` ใช้ serverless handler ตัวเดียวกับบน Vercel
 * (/api/anthropic, /api/guard) — จะได้ทดสอบการล็อก model/rate limit/guard จริงในเครื่อง
 */
function localApiFunctions(env) {
  const routes = {
    '/api/anthropic': './api/anthropic.js',
    '/api/guard': './api/guard.js',
  }
  return {
    name: 'local-api-functions',
    configureServer(server) {
      for (const key of ['ANTHROPIC_API_KEY', 'CLAUDE_MODEL', 'CLAUDE_EFFORT', 'CHAT_MAX_TOKENS',
        'WEB_SEARCH_MAX_USES', 'CHAT_RATE_LIMIT', 'GUARD_AI_ENABLED', 'GUARD_MODEL', 'GUARD_RATE_LIMIT', 'ALLOWED_ORIGINS']) {
        if (env[key] !== undefined && process.env[key] === undefined) process.env[key] = env[key]
      }
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        const route = Object.keys(routes).find(r => path === r || path.startsWith(r + '/'))
        if (!route) return next()
        try {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const raw = Buffer.concat(chunks).toString('utf8')
          req.body = raw ? JSON.parse(raw) : undefined
        } catch {
          req.body = undefined
        }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res }
        const mod = await server.ssrLoadModule(routes[route])
        await mod.default(req, res)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (no prefix filter — loads ANTHROPIC_API_KEY etc.)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), localApiFunctions(env)],

    // Expose only safe VITE_ prefixed vars to the browser bundle
    // ANTHROPIC_API_KEY and ELEVENLABS_API_KEY are intentionally NOT exposed —
    // they are injected by the server-side proxy below.
    define: {
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL || ''),
    },

    server: {
      port: 3000,
      open: true,
      host: true,
      proxy: {
        // /api/anthropic และ /api/guard ใช้ handler ใน api/ ผ่าน localApiFunctions() ด้านบน

        // ── ElevenLabs TTS API ──────────────────────────────────────────────
        '/api/elevenlabs': {
          target: 'https://api.elevenlabs.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/elevenlabs/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Inject ElevenLabs API key server-side — never exposed to browser
              proxyReq.setHeader('xi-api-key', env.ELEVENLABS_API_KEY || '');
              proxyReq.removeHeader('origin');
            });
          },
        },
      },
    },

    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'framer-motion'],
            services: [
              './src/services/aiService',
              './src/services/orchestratorEngine',
              './src/services/databaseService',
            ],
            data: [
              './src/data/agents',
              './src/data/agent-routing',
              './src/data/intelligence',
            ],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  }
})
