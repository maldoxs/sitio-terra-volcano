import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // El sitio se sirve desde una subcarpeta en GitHub Pages; con './' los
  // assets se referencian relativos y funciona en cualquier ruta.
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets' },
});
