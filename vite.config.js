import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (no prefix filter — loads ANTHROPIC_API_KEY etc.)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // Expose only safe VITE_ prefixed vars to the browser bundle
    // ANTHROPIC_API_KEY and ELEVENLABS_API_KEY are intentionally NOT exposed —
    // they are injected by the server-side proxy below.
    define: {
      'process.env.CLAUDE_MODEL': JSON.stringify(env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'),
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL || ''),
    },

    server: {
      port: 3000,
      open: true,
      host: true,
      proxy: {
        // ── Anthropic / Claude API ──────────────────────────────────────────
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY || '');
              proxyReq.setHeader('anthropic-version', '2023-06-01');
              proxyReq.removeHeader('origin');
            });
          },
        },

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
