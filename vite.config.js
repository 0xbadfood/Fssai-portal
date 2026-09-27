import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import apiPlugin from './server/apiPlugin.js'

// Public hostnames, shared with the API (emailed links): config/site.json.
const SITE = JSON.parse(readFileSync(new URL('./config/site.json', import.meta.url), 'utf8'))

// Where the server listens. Default: this machine's VPN address (Caddy on the VPN master proxies to it).
// On deploy the systemd unit sets PORTAL_HOST=127.0.0.1 (its own Caddy proxies to it).
const LISTEN_HOST = process.env.PORTAL_HOST || '10.8.0.2'
const LISTEN_PORT = Number(process.env.PORTAL_PORT) || 8310

// Browser security headers for every response. The CSP allows only this site plus Google Fonts and the payment
// gateway's checkout (Cashfree's SDK, which sends the page to its payment page); PDF pages are rendered by a
// same-origin worker and shown as blob:/data: images.
const CASHFREE = 'https://sdk.cashfree.com https://sandbox.cashfree.com https://api.cashfree.com'
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src 'self' https://sdk.cashfree.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${CASHFREE}`,
    `frame-src ${CASHFREE}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${CASHFREE} https://payments.cashfree.com https://payments-test.cashfree.com`,
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
    host: LISTEN_HOST, // never a public interface: a Caddy in front terminates HTTPS and proxies here
    port: LISTEN_PORT,
    strictPort: true,
    allowedHosts: SITE.hosts,
    headers: SECURITY_HEADERS,
  },
  server: {
    host: LISTEN_HOST, // never a public interface: a Caddy in front terminates HTTPS and proxies here
    port: LISTEN_PORT,
    strictPort: true,
    allowedHosts: SITE.hosts,
  },
})
