import { defineConfig, type Plugin } from 'vitest/config';

const CRAZYGAMES_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** Adds the CrazyGames SDK script to <head> only for `--mode crazygames` builds. */
function crazyGamesSdk(mode: string): Plugin {
  return {
    name: 'crazygames-sdk',
    transformIndexHtml() {
      if (mode !== 'crazygames') return;
      return [{ tag: 'script', attrs: { src: CRAZYGAMES_SDK_URL }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig(({ mode }) => ({
  // CrazyGames requires relative paths.
  base: './',
  plugins: [crazyGamesSdk(mode)],
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    outDir: mode === 'crazygames' ? 'dist-crazygames' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
