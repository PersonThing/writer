import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const rendererSrc = path.resolve(projectRoot, 'src/renderer/src')
const contentDir = path.resolve(projectRoot, 'content')

// On GH Pages the app is served under a subpath (/shigorika/), so we need
// relative asset URLs. Everywhere else (local dev, Railway) the app is at
// the origin root — absolute URLs work on every route including /writer/*.
const isStaticBuild = process.env.VITE_STATIC_BUILD === '1'

export default defineConfig({
  root: 'src/renderer',
  base: isStaticBuild ? './' : '/',
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': rendererSrc,
      '@components': path.join(rendererSrc, 'components'),
      '@lib': path.join(rendererSrc, 'lib'),
      '@content': contentDir,
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3456',
      '/auth': 'http://localhost:3456',
    },
  },
})
