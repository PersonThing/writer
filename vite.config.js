import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const rendererSrc = path.resolve(projectRoot, 'src/renderer/src')
const contentDir = path.resolve(projectRoot, 'content')

export default defineConfig({
  root: 'src/renderer',
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
