import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves a project site from /<repo-name>/, not the domain root; Vercel serves
  // every site from the root regardless of repo name. Vercel sets VERCEL=1 in its build
  // environment, so that's the signal, not NODE_ENV or a hand-maintained flag.
  base: process.env.VERCEL ? '/' : '/coffee-q-trainer/',
  plugins: [react()],
  server: { port: 5173 },
});
