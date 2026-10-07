import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

// Vercel serves this app under /staff and looks up files at that original path.
// Vite emits dist/assets and dist/index.html, so copy the build under dist/staff
// as well. /staff still resolves index.html at the output root.
function mirrorStaffBase(): Plugin {
  return {
    name: 'mirror-staff-base',
    apply: 'build',
    closeBundle() {
      if (!process.env.VERCEL) return;
      const dist = path.resolve(import.meta.dirname, 'dist');
      const staff = path.join(dist, 'staff');
      mkdirSync(staff, { recursive: true });
      for (const entry of readdirSync(dist)) {
        if (entry === 'staff') continue;
        cpSync(path.join(dist, entry), path.join(staff, entry), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: process.env.VERCEL ? '/staff/' : '/',
  plugins: [vue(), mirrorStaffBase()],
  envDir: path.resolve(import.meta.dirname, '../..'),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3001,
  },
});
