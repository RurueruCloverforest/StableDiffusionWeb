import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps built asset paths relative so the app can be deployed
// under any subpath (GitHub Pages project sites, S3 prefixes, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
});
