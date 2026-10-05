import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

function originOf(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null
  } catch {
    return null
  }
}

/**
 * Adds a Content-Security-Policy to the production HTML. The API origins (Supabase, backend) are read from the
 * build environment so the policy only allows the services this deployment actually talks to.
 */
function contentSecurityPolicy(env: Record<string, string>): Plugin {
  const connectSources = ["'self'", originOf(env.VITE_SUPABASE_URL), originOf(env.VITE_BACKEND_URL)].filter(
    (source): source is string => source !== null,
  )

  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Charts and Tailwind arbitrary values rely on inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'biltoki:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_'))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
  },
}))
