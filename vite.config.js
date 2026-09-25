import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import apiPlugin from './server/apiPlugin.js'

// Browser security headers for every response. The CSP allows only this site plus Google Fonts; PDF pages are
// rendered by a same-origin worker and shown as blob:/data: images.
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000',
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  preview: {
    host: '10.8.0.2', // VPN interface only; Caddy on the VPN master terminates HTTPS and proxies here
    port: 8310,
    strictPort: true,
    allowedHosts: ['fssai.photovault.live'],
    headers: SECURITY_HEADERS,
  },
  server: {
    host: '10.8.0.2', // VPN interface only; Caddy on the VPN master terminates HTTPS and proxies here
    port: 8310,
    strictPort: true,
    allowedHosts: ['fssai.photovault.live'],
  },
})
