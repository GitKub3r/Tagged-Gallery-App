import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// En Docker, Vite solo ve la IP interna del contenedor, que no sirve desde otro dispositivo.
// docker-compose.yml le pasa la IP del PC en la red local (la detecta `npm run docker:up`).
const dockerNetworkUrl = () => ({
  name: 'tagged-docker-network-url',
  apply: 'serve',
  configureServer(server) {
    const hostIp = process.env.TAGGED_HOST_IP
    if (hostIp === undefined) return

    const printUrls = server.printUrls
    server.printUrls = () => {
      if (server.resolvedUrls) {
        server.resolvedUrls.network = hostIp ? [`http://${hostIp}:${server.config.server.port}/`] : []
      }
      printUrls()
      if (!hostIp) {
        server.config.logger.info('  ➜  Network: unknown. Start Docker with `npm run docker:up` to show this PC\'s LAN address here.')
      }
    }
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dockerNetworkUrl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
