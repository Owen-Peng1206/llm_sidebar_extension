// vite.config.mts
import { defineConfig, type Plugin } from 'vite';
import { resolve, join } from 'path';
import fs from 'fs/promises';

const copyPlugin = (): Plugin => ({
  name: 'copy-static-resources',
  async writeBundle() {
    const outDir = resolve(__dirname, 'dist');
    const patterns: Array<{ src: string; dst: string }> = [
      { src: 'manifest.json', dst: 'manifest.json' },
      { src: join('src', 'ui', 'sidebar', 'sidebar.js'), dst: join('src', 'ui', 'sidebar', 'sidebar.js') },
      { src: join('src', 'ui', 'sidebar', 'markdown-it.min.js'), dst: join('src', 'ui', 'sidebar', 'markdown-it.min.js') },
      { src: join('src', 'ui', 'options', 'options.css'), dst: join('src', 'ui', 'options', 'options.css') },
      { src: join('src', 'ui', 'options', 'optionsTemplate.html'), dst: join('src', 'ui', 'options', 'optionsTemplate.html') },      
      { src: join('src', 'ui', 'options', 'options.js'), dst: join('src', 'ui', 'options', 'options.js') },   
    ];

    for (const { src, dst } of patterns) {
      const srcPath = resolve(__dirname, src);
      const dstPath = resolve(outDir, dst);
      const dstDir = resolve(outDir, join(...dst.split('/').slice(0, -1)));

      await fs.mkdir(dstDir, { recursive: true });
      await fs.copyFile(srcPath, dstPath);
    }
  },
});

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        sidebar: resolve(__dirname, 'src/ui/sidebar/index.html'),
        options: resolve(__dirname, 'src/ui/options/optionsTemplate.html'),
        content: resolve(__dirname, 'src/content/contentScript.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [copyPlugin()],
});