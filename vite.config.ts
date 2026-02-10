
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: './',
    define: {
      // توفير قيمة افتراضية لتجنب أخطاء البناء إذا لم يتم ضبط المفتاح
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      outDir: 'dist',
    }
  };
});
