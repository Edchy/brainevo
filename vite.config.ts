import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Dev only: the voice guide's token endpoint (src/guide, scripts/guide-agent.ts). The browser asks for a short-lived
 * ElevenLabs conversation token; the API key stays here, read from .env.local on every request (so running
 * `npm run guide:setup` needs no restart). Answers only this machine. The production build has no such route.
 */
function guideToken(): Plugin {
  return {
    name: 'guide-token',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__guide/token', async (req, res) => {
        const send = (status: number, body: object) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        const ip = req.socket.remoteAddress ?? '';
        if (!/^(::1|127\.|::ffff:127\.)/.test(ip)) return send(403, { error: 'local-only' });
        const env = loadEnv(server.config.mode, server.config.root, '');
        const key = env.ELEVENLABS_API_KEY, agent = env.ELEVENLABS_AGENT_ID;
        if (!key) return send(503, { error: 'no-key' });
        if (!agent) return send(503, { error: 'no-agent' });
        try {
          const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`, { headers: { 'xi-api-key': key } });
          if (!r.ok) return send(502, { error: 'upstream', status: r.status, detail: (await r.text()).slice(0, 400) });
          const { token } = await r.json() as { token: string };
          send(200, { token });
        } catch (e) {
          send(502, { error: 'offline', detail: String(e) });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), guideToken()],
  build: {
    // The 3D stage (three.js + every procedural scene, ~1.6 MB raw / ~450 KB gzip) is one lazy chunk that loads while
    // the intro is already on screen (App.tsx lazy-imports it); the first-paint bundle is ~110 KB gzip.
    chunkSizeWarningLimit: 1800,
  },
})
