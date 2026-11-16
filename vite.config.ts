import { defineConfig } from 'vite';
export default defineConfig({ root: 'public', publicDir: '../static', server:{proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}}, build: { outDir: '../dist', emptyOutDir: true } });
