import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves a project site from /<repo-name>/, not the domain root.
  base: '/coffee-q-trainer/',
  plugins: [react()],
  server: { port: 5173 },
});
