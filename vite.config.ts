import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Phaser's loader fetches assets by URL: keep them as files, never inlined data URIs.
  build: { assetsInlineLimit: 0 },
});
