import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const timestamp = Date.now();

/**
 * 自定义插件：构建前仅清理 public/assets 目录和 public/index.html。
 * 保留 public/skill-images、public/uploads、public/favicon.svg 等由运行时生成或手工维护的资源。
 *
 * 注意：必须使用 apply: 'build' 限定仅在 vite build 时挂载，
 * 否则 vite dev 启动时 buildStart 钩子也会被触发，会误删上一次 build 的产物。
 */
const cleanAssetsOnly = () => ({
  name: 'clean-assets-only',
  apply: 'build' as const,
  buildStart() {
    const publicDir = path.resolve(__dirname, '../public');
    const assetsDir = path.join(publicDir, 'assets');
    const indexHtml = path.join(publicDir, 'index.html');
    if (fs.existsSync(assetsDir)) {
      fs.rmSync(assetsDir, { recursive: true, force: true });
    }
    if (fs.existsSync(indexHtml)) {
      fs.rmSync(indexHtml, { force: true });
    }
  },
});

export default defineConfig({
  plugins: [vue(), cleanAssetsOnly()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9527',
        changeOrigin: true,
        // SSE 关键配置：不缓冲响应、保持长连接
        // 这是修复 AI 智能助手 SSE 流被 proxy 缓冲导致前端断开 + 后端 abort 的关键
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 透传 Accept 头（http-proxy 默认会保留，这里仅做防御）
            proxyReq.setHeader('X-Accel-Buffering', 'no');
          });
          proxy.on('proxyRes', (proxyRes) => {
            // 强制透传 SSE 头，禁止任何中间缓冲
            proxyRes.headers['cache-control'] = 'no-cache, no-transform';
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
      // 技能卡片图片：由后端 Express 以 express.static 挂载在 /skill-images 下
      '/skill-images': {
        target: 'http://localhost:9527',
        changeOrigin: true,
      },
      // 上传附件目录同理（由后端 /uploads 托管）
      '/uploads': {
        target: 'http://localhost:9527',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    // 关闭全量清空：由上面的 cleanAssetsOnly 插件精准清理，避免误删 skill-images / uploads
    emptyOutDir: false,
    // 提高 chunk 告警阈值（TDesign 全量引入较大）
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        entryFileNames: `assets/index-${timestamp}.[hash].js`,
        chunkFileNames: `assets/chunk-${timestamp}.[hash].js`,
        assetFileNames: `assets/[name]-${timestamp}.[hash].[ext]`,
        // 手动分包：将大依赖拆分成独立 chunk
        manualChunks: {
          // Vue 核心生态
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // TDesign UI 组件库（最大头）
          'tdesign': ['tdesign-vue-next'],
          // CodeMirror 代码编辑器
          'codemirror': [
            'codemirror',
            '@codemirror/autocomplete',
            '@codemirror/commands',
            '@codemirror/lang-json',
            '@codemirror/language',
            '@codemirror/state',
            '@codemirror/theme-one-dark',
            '@codemirror/view',
          ],
          // 工具库
          'utils': ['axios', 'marked'],
        },
      },
    },
  },
});
