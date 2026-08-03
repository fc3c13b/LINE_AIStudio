import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    define: {
      __LINE_API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || ''),
    },
    plugins: [
      react(),
      tailwindcss(),
      // ルートのIconimage.jpgをビルド成果物と開発サーバーに含める
      {
        name: 'iconimage-asset',
        configureServer(server: any) {
          server.middlewares.use('/iconimage.jpg', (_req: any, res: any) => {
            const p = path.resolve(__dirname, 'Iconimage.jpg');
            if (fs.existsSync(p)) { res.setHeader('Content-Type', 'image/jpeg'); res.end(fs.readFileSync(p)); }
            else res.writeHead(404).end();
          });
        },
        generateBundle(this: any) {
          const p = path.resolve(__dirname, 'Iconimage.jpg');
          if (fs.existsSync(p)) this.emitFile({ type: 'asset', fileName: 'iconimage.jpg', source: fs.readFileSync(p) });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
