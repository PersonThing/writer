import { defineConfig } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: [
          'electron-store',
          'electron-updater',
          '@anthropic-ai/sdk',
          'openai',
          'ffmpeg-static',
          'fluent-ffmpeg',
        ],
      },
    },
  },
  preload: {},
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html',
      },
    },
    plugins: [svelte()],
  },
});
