import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 构建产物直接输出到 FastAPI 将挂载的 web/dist；base='/' 保证同源访问路径正确。
const outDir = fileURLToPath(new URL('../web/dist', import.meta.url))

export default defineConfig({
  base: '/',
  plugins: [vue()],
  build: {
    outDir,
    emptyOutDir: true,
  },
})
